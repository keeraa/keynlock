import * as THREE from '../vendor/three.js';
import { createFallbackKeyPainter } from './fallback-canvas-keys.js';
import { createFallbackArchitecture } from './fallback-canvas-architecture.js?v=2';
import { getKeyFallbackHeadPoints } from './key-factory.js?v=3';
import { KEY_TYPES, getProgress, bathContents } from './rules.js?v=23';
import { sampleThrow } from './throw-physics.js';
import { CABINET_Z, CABINET_CAPACITY, CABINET_COLUMNS, CABINET_ROWS,
  CABINET_COLUMN_WIDTH, CABINET_ROW_HEIGHT, CABINET_GRID_BOTTOM_Y,
  CABINET_BLANK_ROW_BOTTOM_Y, pegForSlot } from './cabinet-layout.js?v=23';
import { FIXTURE_OFFSETS, bathId } from './station-layout.js?v=2';
import { drawBathActivity, drawBathKeys, drawForgeActivity } from './station-canvas-effects.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

// Canvas-only illustration code. No collision, input, save, or game-state mutation.
export function createFallbackCanvasRenderer({
  ctx, scene, camera, surfaces, state, cabinets, workstations,
  thrownKeys, placingKeys, discardingKeys, fixtureHover, keyHover,
}) {
  let width = 0, height = 0, frameTime = 0, lastDraw = -Infinity;
  let visualSettings = null, hovered = null, carriedKey = null;
  const point3 = new THREE.Vector3();
  const eyePoint = new THREE.Vector3();
  function project(x, y, z) {
    eyePoint.set(x, y, z).applyMatrix4(camera.matrixWorldInverse);
    if (eyePoint.z >= -.08) return null;
    point3.set(x, y, z).project(camera);
    if (!Number.isFinite(point3.x) || !Number.isFinite(point3.y)) return null;
    return {
      x: (point3.x + 1) * width * .5,
      y: (1 - point3.y) * height * .5,
      depth: -eyePoint.z,
    };
  }

  function path3(points, fill, stroke = null, strokeWidth = 1) {
    const projections = points.map(p => project(...p));
    if (projections.some(p => !p)) return false;
    ctx.beginPath();
    projections.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
    ctx.closePath();
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
      // The Canvas fallback also needs a visibly adjustable cartoon material.
      // A flat pigment glaze reduces painted-pattern detail without a costly
      // whole-canvas CSS filter or pixel-by-pixel image processing.
      const toon = visualSettings.toonEnabled ?
        visualSettings.toonLight * visualSettings.cartoonMaterial / 10000 : 0;
      if (toon > 0 && typeof fill !== 'string') {
        ctx.save();
        ctx.globalAlpha = toon * .43;
        ctx.fillStyle = fill === surfaces.wood ? '#b38d6e' :
          fill === surfaces.ceiling ? '#76513b' :
          fill === surfaces.carpet ? '#a27a82' : '#b8c2b1';
        ctx.fill();
        ctx.restore();
      }
    }
    if (stroke) {
      if (visualSettings.outlineEnabled) {
        ctx.strokeStyle = `rgba(51,42,35,${.91 * visualSettings.outlineStrength / 100})`;
        ctx.lineWidth = strokeWidth + visualSettings.outlineWidth *
          (1.4 + .6 * visualSettings.outlineSensitivity / 100);
        ctx.stroke();
      }
      ctx.strokeStyle = stroke;
      ctx.lineWidth = strokeWidth;
      ctx.stroke();
    }
    return true;
  }

  function segment(from, to, color, lineWidth = 1) {
    const a = project(...from);
    const b = project(...to);
    if (!a || !b) return;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = color;
    ctx.stroke();
  }

  const architecturePainter = createFallbackArchitecture({ ctx, camera, surfaces, project, path3, segment });
  const { background, architecture } = architecturePainter;

  function drawCabinet(type) {
    const left = type < 5;
    const z = CABINET_Z[type % 5];
    const faceX = left ? -10.78 : 10.78;
    const x1 = left ? -10.8 : 10.8;
    const base = [[x1, -.04, z - 1.95], [x1, -.04, z + 1.95],
      [x1, 4.85, z + 1.95], [x1, 4.85, z - 1.95]];
    if (!path3(base, surfaces.wood, '#d0a675', 4)) return;
    path3([[faceX, .31, z - 1.52], [faceX, .31, z + 1.52], [faceX, 3.88, z + 1.52], [faceX, 3.88, z - 1.52]], '#0b0d0d', '#d5b384', 2);
    path3([[faceX, .31, z - 1.62], [faceX, .31, z + 1.62],
      [faceX, CABINET_BLANK_ROW_BOTTOM_Y, z + 1.62], [faceX, CABINET_BLANK_ROW_BOTTOM_Y, z - 1.62]],
    surfaces.wood, '#b99263', 2);
    path3([[faceX, CABINET_BLANK_ROW_BOTTOM_Y, z - 1.62],
      [faceX, CABINET_BLANK_ROW_BOTTOM_Y, z + 1.62],
      [faceX, CABINET_GRID_BOTTOM_Y, z + 1.62],
      [faceX, CABINET_GRID_BOTTOM_Y, z - 1.62]], '#695043', '#b99263', 2);
    for (let row = 0; row <= CABINET_ROWS * 2; row++) {
      const y = CABINET_GRID_BOTTOM_Y + row * CABINET_ROW_HEIGHT / 2;
      segment([faceX, y, z - 1.55], [faceX, y, z + 1.55], '#b89163', 4);
    }
    for (let divider = 0; divider <= CABINET_COLUMNS * 2; divider++) {
      const shift = -1.62 + divider * CABINET_COLUMN_WIDTH / 2;
      const dividerZ = z + (left ? -shift : shift);
      segment([faceX, CABINET_GRID_BOTTOM_Y, dividerZ],
        [faceX, CABINET_GRID_BOTTOM_Y + CABINET_ROWS * CABINET_ROW_HEIGHT, dividerZ], '#b99263', 4);
    }
    const sign = project(faceX, 4.25, z + (left ? -.32 : .32));
    if (sign) {
      const charSize = clamp(123 / sign.depth * 3, 12, 30);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ecd2a0';
      ctx.font = `${charSize}px Georgia`;
      ctx.shadowColor = '#000';
      ctx.shadowBlur = 5;
      ctx.fillText(KEY_TYPES[type].name.toUpperCase(), sign.x, sign.y, 220);
      ctx.shadowBlur = 0;
    }
    const signKey = project(faceX, 4.25, z + (left ? 1.23 : -1.23));
    if (signKey) {
      ctx.font = `${clamp(110 / signKey.depth * 3, 12, 28)}px Georgia`;
      ctx.fillStyle = '#dbbd8c';
      ctx.fillText('⚿', signKey.x, signKey.y);
    }
    // The 2D renderer shows the same family crest above each cabinet.
    const crownX = faceX + (left ? -.10 : .10);
    const crownMetal = `#${KEY_TYPES[type].metal.toString(16).padStart(6, '0')}`;
    path3([[crownX, 5.02, z - .136], [crownX, 5.87, z - .136],
      [crownX, 5.87, z + .136], [crownX, 5.02, z + .136]],
    crownMetal, '#4b372a', 2);
    const headPoints = getKeyFallbackHeadPoints(type);
    const crest = headPoints.map(([x, y]) => [crownX, 5.97 + y * 2.8, z + x * 2.8]);
    path3(crest, crownMetal, '#ecce92', 2.5);
    const cutout = Array.from({ length: 18 }, (_, i) => {
      const angle = i * Math.PI * 2 / 18;
      return [crownX, 5.97 + Math.sin(angle) * .272, z + Math.cos(angle) * .272];
    });
    path3(cutout, '#302a25', '#876e4b', 1.5);
    const count = cabinetCounts[type];
    const inFlight = new Set([...placingKeys.values()].map(motion => motion.key.id));
    const showKeys = Math.hypot(camera.position.x - faceX, camera.position.z - z) < 17;
    for (let i = 0; showKeys && i < CABINET_CAPACITY; i++) {
      const peg = pegForSlot(i);
      const hookZ = z + (left ? -peg.x : peg.x);
      const hook = project(faceX + (left ? .05 : -.05), peg.y, hookZ);
      if (!hook) continue;
      const size = clamp(15 / hook.depth, .9, 3.5);
      const occupantId = cabinetSlots[type].get(i);
      if (occupantId && !inFlight.has(occupantId)) {
        ctx.fillStyle = '#ebd9b6';
        ctx.beginPath();
        ctx.arc(hook.x, hook.y + size * 1.5, size * .9, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#99784f';
        ctx.lineWidth = Math.max(.7, size * .5);
        ctx.beginPath();
        ctx.moveTo(hook.x, hook.y + size * 2.3);
        ctx.lineTo(hook.x, hook.y + size * 4.5);
        ctx.stroke();
      }
    }
    if (hovered?.kind === 'cabinet' && hovered.type === type) {
      // The bright outline stays on the cabinet front, above the floor joint.
      const frontX = faceX + (left ? .07 : -.07);
      const corners = [[frontX, .55, z - 1.82], [frontX, .55, z + 1.82],
        [frontX, 4.84, z + 1.82], [frontX, 4.84, z - 1.82]];
      for (let edge = 0; edge < 4; edge++)
        segment(corners[edge], corners[(edge + 1) % 4], 'rgba(255,239,193,.86)', 2.5);
      if (Number.isInteger(hovered.slot)) {
        const peg = pegForSlot(hovered.slot);
        const cellZ = z + (left ? -peg.x : peg.x);
        const square = [[frontX, peg.y - .126, cellZ - .126],
          [frontX, peg.y - .126, cellZ + .126],
          [frontX, peg.y + .126, cellZ + .126],
          [frontX, peg.y + .126, cellZ - .126]];
        for (let edge = 0; edge < 4; edge++)
          segment(square[edge], square[(edge + 1) % 4], '#ffe2a2', 3);
      }
    }
    if (count === requiredCounts[type]) {
      const top = project(faceX, 4.73, z);
      if (top) {
        ctx.fillStyle = '#f1cb84';
        ctx.beginPath(); ctx.arc(top.x, top.y, clamp(28 / top.depth, 3, 10), 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  function drawStation(station) {
    const { x, z } = station;
    const table = [[x - 2.52, .88, z - .74], [x + 2.52, .88, z - .74],
      [x + 2.52, .88, z + .87], [x - 2.52, .88, z + .87]];
    path3(table, surfaces.wood, '#cba774', 3);
    const tableHover = Math.max(fixtureHover.get(bathId(station.id, 'mud')) || 0,
      fixtureHover.get(bathId(station.id, 'rust')) || 0,
      fixtureHover.get(`forge:${station.id}`) || 0);
    if (tableHover > .005) {
      ctx.save(); ctx.globalAlpha = tableHover;
      path3(table, null, '#ffffff', 5);
      ctx.restore();
    }
    for (const edgeX of [x - 2.28, x + 2.28]) {
      segment([edgeX, .8, z - .58], [edgeX, .15, z - .58], '#59483c', 6);
      segment([edgeX, .8, z + .67], [edgeX, .15, z + .67], '#59483c', 6);
    }
    for (const kind of ['mud', 'rust']) {
      const bx = x + FIXTURE_OFFSETS[kind];
      const p = project(bx, 1.24, z + .10);
      if (!p) continue;
      const r = clamp(80 / p.depth, 7, 45);
      const active = fixtureHover.get(bathId(station.id, kind)) || 0;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, r, r * .43, 0, 0, Math.PI * 2);
      ctx.fillStyle = kind === 'mud' ? '#597770' : '#8c6055';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#cfaf82';
      ctx.stroke();
      const contents = bathContents(state, bathId(station.id, kind));
      const wallTime = Date.now();
      drawBathActivity(ctx, p, r, kind, contents.keys, frameTime, wallTime);
      drawBathKeys(ctx, p, r, kind, contents.keys, wallTime);
      if (active > .005) {
        ctx.save(); ctx.globalAlpha = active;
        ctx.lineWidth = 6; ctx.strokeStyle = '#ffffff'; ctx.stroke();
        ctx.restore();
      }
      ctx.fillStyle = '#f5e8d0';
      ctx.font = `bold ${clamp(80 / p.depth, 10, 20)}px Arial`;
      ctx.textAlign = 'center';
      ctx.fillText(`${contents.ready.length ? '✓ ' : ''}${contents.keys.length}/4`, p.x, p.y + 4);
      const label = project(bx, 1.70, z + .10);
      if (label) {
        ctx.font = `${clamp(80 / label.depth, 9, 17)}px Georgia`;
        ctx.fillStyle = '#ead2aa';
        ctx.fillText(kind === 'mud' ? 'ВОДА' : 'РАСТВОР', label.x, label.y);
      }
    }
    const f = project(x, 1.52, z + .08);
    if (f) {
      const r = clamp(89 / f.depth, 8, 49);
      ctx.beginPath();
      ctx.ellipse(f.x, f.y, r, r * .40, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#dd793c'; ctx.fill();
      drawForgeActivity(ctx, f, r, frameTime, station.forge.impactAt);
      ctx.strokeStyle = '#756151';
      ctx.lineWidth = 5; ctx.stroke();
      const active = fixtureHover.get(`forge:${station.id}`) || 0;
      if (active > .005) {
        ctx.save(); ctx.globalAlpha = active;
        ctx.lineWidth = 7; ctx.strokeStyle = '#ffffff'; ctx.stroke();
        ctx.restore();
      }
    }
    const label = project(x, 2.25, z - .55);
    if (label) {
      ctx.fillStyle = '#f4deb7'; ctx.textAlign = 'center';
      ctx.font = `${clamp(140 / label.depth, 11, 20)}px Georgia`;
      ctx.fillText(`СТАНЦИЯ · ${station.name}`, label.x, label.y);
    }
  }

  const cabinetCounts = new Array(KEY_TYPES.length).fill(0);
  const cabinetSlots = Array.from({ length: KEY_TYPES.length }, () => new Map());
  const requiredCounts = getProgress(state).required;
  const keyPainter = createFallbackKeyPainter({ ctx, project, keyHover });
  const { drawKey, drawHand, drawPlacingKey, drawDiscardingKey, drawDistantKeys } = keyPainter;

  function draw() {
    const currentTime = performance.now();
    if (currentTime - lastDraw < 28) return false;
    lastDraw = currentTime;
    scene.updateMatrixWorld(true);
    camera.updateMatrixWorld(true);
    ctx.clearRect(0, 0, width, height);
    architecturePainter.setFrame({ width, height, frameTime, visualSettings });
    background();
    architecture();
    const drawables = [];
    const distantKeys = KEY_TYPES.map(() => []);
    for (let type = 0; type < 10; type++) {
      const pos = cabinets[type].group.position;
      const distance = camera.position.distanceTo(pos);
      drawables.push({ distance, draw: () => drawCabinet(type) });
    }
    for (const station of workstations.stations)
      drawables.push({ distance: camera.position.distanceTo(station.group.position),
        draw: () => drawStation(station) });
    for (const key of state.keys) if (key.status === 'floor' && !thrownKeys.has(key.id)) {
      const distance = Math.hypot(camera.position.x - key.x, camera.position.z - key.z);
      if (distance > 9.4 && hovered?.id !== key.id) distantKeys[key.type].push(key);
      else drawables.push({ distance, draw: () => drawKey(key) });
    }
    for (const motion of thrownKeys.values()) {
      const pose = sampleThrow(motion.start, motion.end, (currentTime - motion.startTime) / 1000);
      const airborne = { ...motion.key, x: pose.x, z: pose.z };
      drawables.push({ distance: Math.hypot(camera.position.x - pose.x, camera.position.z - pose.z),
        draw: () => drawKey(airborne, pose.y, pose.spin) });
    }
    for (const motion of placingKeys.values()) {
      const distance = camera.position.distanceTo(motion.end);
      drawables.push({ distance, draw: () => drawPlacingKey(motion, currentTime) });
    }
    for (const motion of discardingKeys.values()) {
      const distance = camera.position.distanceTo(motion.end);
      drawables.push({ distance, draw: () => drawDiscardingKey(motion, currentTime) });
    }
    drawables.sort((a, b) => b.distance - a.distance);
    drawDistantKeys(distantKeys);
    for (const item of drawables) item.draw();
    drawHand();
    // Soft vignette retains the room's depth in the 2D fallback.
    const shade = ctx.createRadialGradient(width / 2, height * .47, width * .09, width / 2, height * .48, width * .73);
    shade.addColorStop(0, 'rgba(0,0,0,0)');
    shade.addColorStop(1, 'rgba(9,17,13,.29)');
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, width, height);
    if (visualSettings.toonEnabled && visualSettings.toonLight && visualSettings.cartoonMaterial) {
      const strength = visualSettings.toonLight * visualSettings.cartoonMaterial / 10000;
      const bands = Math.max(2, visualSettings.toonSteps);
      ctx.save();
      ctx.globalAlpha = strength * .12;
      ctx.globalCompositeOperation = 'soft-light';
      for (let i = 0; i < bands; i++) {
        ctx.fillStyle = i % 2 ? '#b3a07d' : '#f6dbb7';
        ctx.fillRect(0, height * i / bands, width, height / bands + 1);
      }
      ctx.restore();
    }
    return true;
  }

  function refreshCabinet(type) {
    const sorted = state.keys.filter(key => key.type === type && key.status === 'sorted');
    cabinetCounts[type] = sorted.length;
    cabinetSlots[type] = new Map(sorted.map(key => [key.cabinetSlot, key.id]));
  }

  return {
    setSize(w, h) { width = w; height = h; },
    refreshCabinet,
    render({ hovered: currentHover, carriedKey: currentHand, frameTime: now, visualSettings: settings }) {
      hovered = currentHover;
      carriedKey = currentHand;
      frameTime = now;
      visualSettings = settings;
      keyPainter.setFrame({ width, height, frameTime, carriedKey });
      return draw();
    },
  };
}
