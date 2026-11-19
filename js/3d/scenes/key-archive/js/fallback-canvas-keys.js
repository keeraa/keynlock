import { KEY_TYPES, keyCondition } from './rules.js?v=23';
import { getKeyFallbackHeadPoints, createKeyFallbackStamp, getKeyMetal } from './key-factory.js?v=3';
import { PAINTED_METALS } from './painted-textures.js';
import { keyAssetUrl, RUST_TEXTURE } from './key-data.js';
import { dirtPaint, stableNoise } from './key-dirt.js';
import { restingKeyY } from './floor-contact.js';
import { samplePlacement, sampleDiscard } from './archive-key-motion.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

// Key paint, stains, carrying pose, and movement thumbnails for Canvas 2D.
export function createFallbackKeyPainter({ ctx, project, keyHover }) {
  let width = 0, height = 0, frameTime = 0, carriedKey = null, throwPose = null;
  const headShapes = KEY_TYPES.map((_, type) => getKeyFallbackHeadPoints(type));
  const providedStamps = KEY_TYPES.map((_, type) => [
    createKeyFallbackStamp(type, false), createKeyFallbackStamp(type, true),
  ]);
  // Cached gouache-like key stamps: no per-frame polygon tessellation on Canvas.
  const keyStamps = headShapes.map((shape, type) => {
    const provided = providedStamps[type][0];
    if (provided) return provided;
    const stamp = document.createElement('canvas');
    stamp.width = 160;
    stamp.height = 220;
    const brush = stamp.getContext('2d');
    const metal = `#${KEY_TYPES[type].metal.toString(16).padStart(6, '0')}`;
    const sheen = brush.createLinearGradient(20, 0, 145, 190);
    sheen.addColorStop(0, '#f3d7a1');
    sheen.addColorStop(.42, metal);
    sheen.addColorStop(1, '#6b5139');
    brush.lineJoin = 'round';
    brush.lineCap = 'round';
    brush.fillStyle = sheen;
    brush.strokeStyle = '#31241b';
    brush.lineWidth = 4;
    brush.beginPath();
    shape.forEach(([x, y], i) => i ? brush.lineTo(80 + x * 158, 73 - y * 158)
      : brush.moveTo(80 + x * 158, 73 - y * 158));
    brush.closePath();
    brush.moveTo(98, 73);
    brush.arc(80, 73, type === 8 ? 15 : 19, 0, Math.PI * 2, true);
    brush.fill('evenodd');
    brush.stroke();
    brush.fillRect(72, 107, 16, 87);
    brush.strokeRect(72, 107, 16, 87);
    brush.fillRect(67, 110, 26, 10);
    for (let i = 0; i < 2 + type % 3; i++) {
      const toothY = 175 - i * 14;
      brush.fillRect(85, toothY, 22 + (i % 2) * 7, 9);
      brush.strokeRect(85, toothY, 22 + (i % 2) * 7, 9);
    }
    return stamp;
  });
  const brokenStamps = keyStamps.map((stamp, type) => {
    const provided = providedStamps[type][1];
    if (provided) return provided;
    const broken = document.createElement('canvas');
    broken.width = stamp.width;
    broken.height = stamp.height;
    const brush = broken.getContext('2d');
    brush.drawImage(stamp, 0, 0, 160, 154, 0, 0, 160, 154);
    brush.strokeStyle = '#3e2924';
    brush.lineWidth = 4;
    brush.beginPath();
    brush.moveTo(68, 153); brush.lineTo(75, 147);
    brush.lineTo(82, 155); brush.lineTo(90, 149);
    brush.stroke();
    return broken;
  });
  const patinaStamps = new Map();
  const forgeRust = new Image();
  forgeRust.onload = () => patinaStamps.clear();
  forgeRust.src = keyAssetUrl(RUST_TEXTURE);
  function stampFor(key) {
    if (key.broken) return brokenStamps[key.type];
    const condition = keyCondition(key);
    if (condition === 'clean') return keyStamps[key.type];
    const id = `${key.type}-${condition}-${key.variation ?? 0}`;
    if (!patinaStamps.has(id)) {
      const canvas = document.createElement('canvas');
      canvas.width = 160; canvas.height = 220;
      const brush = canvas.getContext('2d');
      brush.drawImage(keyStamps[key.type], 0, 0);
      brush.save();
      brush.globalCompositeOperation = 'source-atop';
      if (key.rust && forgeRust.naturalWidth) {
        brush.globalAlpha = .85;
        brush.drawImage(forgeRust, (key.type % 3 - 1) * 13, (key.variation % 3 - 1) * 9,
          184, 242);
      }
      if (key.mud) {
        // Same opaque earthen pigments as Forge's 3D crust, simplified for 2D.
        brush.globalAlpha = 1;
        brush.fillStyle = dirtPaint[0];
        brush.fillRect(0, 0, 160, 220);
        brush.globalAlpha = .22;
        for (let y = 0; y < 220; y += 9) for (let x = 0; x < 160; x += 9) {
          const n = stableNoise(x * .21 + y * .13 + key.type * 5 + (key.variation ?? 0));
          brush.fillStyle = dirtPaint[Math.floor(n * dirtPaint.length)];
          brush.fillRect(x, y, 9, 9);
        }
      }
      brush.restore();
      patinaStamps.set(id, canvas);
    }
    return patinaStamps.get(id);
  }
  const handPatterns = {};
  for (const [metal, source] of Object.entries(PAINTED_METALS)) {
    if (!KEY_TYPES.some((_, type) => getKeyMetal(type) === metal)) continue;
    const image = new Image();
    image.onload = () => {
      handPatterns[metal] = ctx.createPattern(image, 'repeat');
      patinaStamps.clear();
      for (let type = 0; type < keyStamps.length; type++) {
        if (getKeyMetal(type) !== metal) continue;
        for (const stamp of [keyStamps[type], brokenStamps[type]]) {
          const brush = stamp.getContext('2d');
          brush.save();
          brush.globalCompositeOperation = 'source-atop';
          brush.globalAlpha = .53;
          brush.drawImage(image, 0, 0, stamp.width, stamp.height);
          brush.restore();
        }
      }
    };
    image.src = source;
  }
  function drawKey(key, elevation = restingKeyY(key.x, key.z), spin = 0) {
    if (key.status !== 'floor') return;
    const center = project(key.x, elevation, key.z);
    if (!center || center.depth > 46 || center.x < -250 || center.x > width + 250 ||
      center.y < -250 || center.y > height + 250) return;
    const rotation = key.rotation + spin;
    if (center.depth > 15) {
      const length = clamp(25 / center.depth, .6, 1.6);
      const lineWidth = clamp(20 / center.depth, .7, 1.7);
      ctx.beginPath();
      ctx.moveTo(center.x - Math.sin(rotation) * length, center.y - Math.cos(rotation) * length * .5);
      ctx.lineTo(center.x + Math.sin(rotation) * length, center.y + Math.cos(rotation) * length * .5);
      if (keyHover.id === key.id && keyHover.opacity > .005) {
        ctx.save(); ctx.globalAlpha = keyHover.opacity;
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = lineWidth + 5;
        ctx.stroke(); ctx.restore();
      }
      ctx.strokeStyle = `#${KEY_TYPES[key.type].metal.toString(16).padStart(6, '0')}`;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
    } else {
      const dx = Math.sin(rotation) * .24;
      const dz = Math.cos(rotation) * .24;
      const head = project(key.x + dx, elevation, key.z + dz);
      const tip = project(key.x - dx, elevation, key.z - dz);
      if (!head || !tip) return;
      const length = clamp(Math.hypot(head.x - tip.x, head.y - tip.y), .9, 170);
      const widthStamp = length * .65;
      ctx.save();
      ctx.translate(center.x, center.y);
      ctx.rotate(Math.atan2(tip.x - head.x, tip.y - head.y));
      const stamp = stampFor(key);
      if (keyHover.id === key.id && keyHover.opacity > .005) {
        ctx.globalAlpha = keyHover.opacity;
        ctx.filter = 'brightness(0) invert(1)';
        for (const [offsetX, offsetY] of [[-4,0],[4,0],[0,-4],[0,4],[-3,-3],[3,3],[-3,3],[3,-3]]) {
          ctx.drawImage(stamp, -widthStamp / 2 + offsetX, -length * .49 + offsetY, widthStamp, length * 1.15);
        }
        ctx.filter = 'none';
        ctx.globalAlpha = 1;
      }
      if (key.mud) {
        ctx.shadowColor = '#3a3025';
        ctx.shadowBlur = 9;
      }
      ctx.drawImage(stamp, -widthStamp / 2, -length * .49, widthStamp, length * 1.15);
      ctx.restore();
    }
  }

  function drawHand() {
    if (!carriedKey) return;
    // Windup is drawn in the right hand before the airborne key appears.
    const handX = width * .67 + (throwPose ? (throwPose.x - .43) * width * .29 : 0);
    const handY = height * .77 + Math.sin(frameTime * .003) * 6 -
      (throwPose ? (throwPose.y + .45) * height * .34 : 0);
    const handAngle = -.45 + (throwPose ? (throwPose.rotationZ + .53) * .8 : 0);
    if (providedStamps[carriedKey.type][carriedKey.broken ? 1 : 0]) {
      const stamp = stampFor(carriedKey);
      const scale = Math.min(width, height) * .0008;
      ctx.save();
      ctx.translate(handX, handY);
      ctx.rotate(handAngle);
      ctx.drawImage(stamp, -80 * scale, -110 * scale, 160 * scale, 220 * scale);
      ctx.restore();
      return;
    }
    const shape = getKeyFallbackHeadPoints(carriedKey.type);
    const scale = Math.min(width, height) * .077;
    ctx.save();
    ctx.translate(handX, handY);
    ctx.rotate(handAngle);
    ctx.shadowColor = 'rgba(0,0,0,.65)';
    ctx.shadowBlur = 22;
    ctx.strokeStyle = '#241c17';
    ctx.fillStyle = carriedKey.mud ? '#817455' : carriedKey.rust ? '#a97047' : handPatterns[getKeyMetal(carriedKey.type)] ||
      `#${KEY_TYPES[carriedKey.type].metal.toString(16).padStart(6, '0')}`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    shape.forEach(([x, y], i) => i ? ctx.lineTo(x * scale, (-y - .35) * scale) : ctx.moveTo(x * scale, (-y - .35) * scale));
    ctx.closePath();
    for (let i = 0; i <= 24; i++) {
      const angle = i / 24 * Math.PI * 2;
      const x = Math.cos(angle) * .11 * scale;
      const y = (-.35 - Math.sin(angle) * .11) * scale;
      if (!i) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill('evenodd'); ctx.stroke();
    ctx.fillRect(-scale * .05, -scale * .08, scale * .1, carriedKey.broken ? scale * .30 : scale * .54);
    for (let i = 0; i < (carriedKey.broken ? 1 : carriedKey.type % 3 + 2); i++)
      ctx.fillRect(scale * .02, scale * (.29 - i * .10), scale * .19, scale * .058);
    if (carriedKey.broken) {
      ctx.strokeStyle = '#ec9f8d';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(0, scale * .18); ctx.lineTo(-scale * .04, scale * .23);
      ctx.lineTo(scale * .05, scale * .25); ctx.stroke();
    }
    ctx.restore();
  }

  function drawPlacingKey(motion, now) {
    const elapsed = (now - motion.startTime) / 1000;
    const pose = samplePlacement(motion.start, motion.end, elapsed);
    const p = project(pose.x, pose.y, pose.z);
    if (!p) return;
    const finalSize = clamp(15 / p.depth, .9, 3.5);
    const size = (1 - pose.ease) * Math.min(76, height * .12) + pose.ease * finalSize * 2;
    const glyphBlend = clamp((elapsed - .24) / .18, 0, 1);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(pose.sway);
    if (glyphBlend < 1) {
      ctx.globalAlpha = 1 - glyphBlend;
      ctx.drawImage(stampFor(motion.key), -size * .5, -size * .45, size, size * 1.39);
    }
    if (glyphBlend > 0) {
      ctx.globalAlpha = glyphBlend;
      ctx.fillStyle = '#ebd9b6';
      ctx.beginPath();
      ctx.arc(0, finalSize * 1.5, finalSize * .9, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#99784f';
      ctx.lineWidth = Math.max(.7, finalSize * .5);
      ctx.beginPath();
      ctx.moveTo(0, finalSize * 2.3);
      ctx.lineTo(0, finalSize * 4.5);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawDiscardingKey(motion, now) {
    const pose = sampleDiscard(motion.start, motion.end, (now - motion.startTime) / 1000);
    const p = project(pose.x, pose.y, pose.z);
    if (!p) return;
    const size = Math.max(2, (1 - pose.ease) * 56 + 3);
    ctx.save();
    ctx.translate(p.x, p.y); ctx.rotate(pose.rotationX);
    ctx.drawImage(stampFor(motion.key), -size / 2, -size / 2, size, size * 1.36);
    ctx.restore();
  }

  function drawDistantKeys(groups) {
    // One batched stroke per family avoids hundreds of expensive tiny image transforms.
    for (let type = 0; type < groups.length; type++) {
      if (!groups[type].length) continue;
      ctx.beginPath();
      for (const key of groups[type]) {
        const p = project(key.x, restingKeyY(key.x, key.z), key.z);
        if (!p || p.depth > 46 || p.x < -6 || p.x > width + 6 || p.y < -6 || p.y > height + 6) continue;
        const size = clamp(38 / p.depth, .75, 4.2);
        const dx = Math.sin(key.rotation) * size;
        const dy = Math.cos(key.rotation) * size * .50;
        ctx.moveTo(p.x - dx, p.y - dy);
        ctx.lineTo(p.x + dx, p.y + dy);
      }
      ctx.lineCap = 'round';
      ctx.strokeStyle = `#${KEY_TYPES[type].metal.toString(16).padStart(6, '0')}`;
      ctx.lineWidth = 1.6;
      ctx.stroke();
    }
  }

  return {
    setFrame(frame) {
      width = frame.width; height = frame.height;
      frameTime = frame.frameTime; carriedKey = frame.carriedKey;
      throwPose = frame.throwPose ?? null;
    },
    drawKey, drawHand, drawPlacingKey, drawDiscardingKey, drawDistantKeys,
  };
}
