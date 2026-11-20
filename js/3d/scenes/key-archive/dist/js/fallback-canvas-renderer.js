import { familyName } from './i18n.js';
import * as THREE from '../vendor/three.js';
import { createCabinetCompletion } from './cabinet-completion.js?v=wax-and-bundles';
import { PERIMETER_BAND_Y } from './hall-architecture.js?v=alchemy-candles';
import { CANDLE_FLAME_HEIGHT, CANDLE_FLAME_WIDTH, CANDLE_WICK_Y, sampleCandleFlicker } from './archive-candles.js?v=key-catalog';
import { createFallbackKeyPainter } from './fallback-canvas-keys.js?v=stable-pickup';
import { createFallbackArchitecture } from './fallback-canvas-architecture.js?v=key-catalog';
import { getKeyFallbackHeadPoints } from './key-factory.js?v=key-ring';
import { KEY_TYPES, getProgress } from './rules.js?v=key-ring';
import { cabinetContactGlow } from './archive-key-motion.js?v=key-ring';
import { sampleThrow } from './archive-throw-trajectory.js?v=archive-foley';
import { RIGHT_HAND_RELEASE } from './held-key-motion.js';
import { windowBeamLightAt } from './archive-window-rays.js?v=alchemy-candles';
import { CABINET_Z, CABINET_GRID_HALF_WIDTH, CABINET_BODY_WIDTH, CABINET_CAPACITY, CABINET_COLUMNS, CABINET_ROWS,
  CABINET_CROWN_SCALE_FACTOR, CABINET_DEPTH_FACTOR, CABINET_KEY_OFFSET_Y, CABINET_KEY_SCALE_FACTOR, CABINET_COLUMN_WIDTH, CABINET_ROW_HEIGHT, CABINET_GRID_BOTTOM_Y, CABINET_GRID_TOP_Y, CABINET_HEADER_Y, CABINET_CORNICE_TOP,
  pegForSlot, CABINET_CELL_INNER_HALF_WIDTH,
  CABINET_CELL_INNER_HALF_HEIGHT } from './cabinet-layout.js?v=cabinet-cell-glow';
import { FIXTURE_OFFSETS, bathId, FORGE_SURFACE_Y } from './station-layout.js?v=working-baths';
import { drawBathActivity, drawBathKeys, drawForgeActivity } from './station-canvas-effects.js?v=stable-pickup';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

// Canvas-only illustration code. No collision, input, save, or game-state mutation.
export function createFallbackCanvasRenderer({
  ctx, scene, camera, surfaces, state, cabinets, workstations, keyIndex,
  thrownKeys, placingKeys, discardingKeys, fixtureHover, keyHover, candles,
}) {
  let width = 0, height = 0, frameTime = 0, lastDraw = -Infinity;
  let playing = false, ledgerVisible = true;
  let visualSettings = null, hovered = null, carriedKey = null;
  // Frames baked from the lab shader for browsers that fall back to Canvas.
  const flameAtlas = new Image();
  flameAtlas.decoding = 'async';
  flameAtlas.src = new URL('../assets/alchemy-candle-flame.png', import.meta.url).href;
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
        ctx.fillStyle = fill === surfaces.wood || fill === surfaces.bench ? '#b38d6e' :
          fill === surfaces.ceiling ? '#76513b' :
          fill === surfaces.carpet ? '#a27a82' : '#b8c2b1';
        ctx.fill();
        ctx.restore();
      }
    }
    if (stroke) {
      if (visualSettings.outlineEnabled) {
        ctx.strokeStyle = `rgba(51,42,35,${.91 * visualSettings.outlineStrength / 100})`;
        ctx.lineWidth = strokeWidth + 1.7;
        ctx.stroke();
      }
      ctx.strokeStyle = stroke;
      ctx.lineWidth = strokeWidth;
      ctx.stroke();
    }
    if (fill && typeof fill !== 'string') {
      const depth = projections.reduce((total, p) => total + p.depth, 0) / projections.length;
      const t = clamp((depth - 10) / 32, 0, 1);
      if (t > 0) {
        ctx.save(); ctx.globalAlpha = t * t * (3 - 2 * t) * .28;
        ctx.fillStyle = '#959e95'; ctx.fill(); ctx.restore();
      }
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
    const completion = cabinetCompletion[type];
    const reward = completion.frame(frameTime);
    const settledRows = completion.settledRows();
    const inFlight = new Set([...placingKeys.values()].map(motion => motion.key.id));
    const left = type < 5;
    const z = CABINET_Z[type % 5];
    const faceX = left ? -10.78 : 10.78;
    const x1 = left ? -10.8 : 10.8;
    const base = [[x1, -.04, z - CABINET_BODY_WIDTH / 2], [x1, -.04, z + CABINET_BODY_WIDTH / 2],
      [x1, CABINET_CORNICE_TOP, z + CABINET_BODY_WIDTH / 2], [x1, CABINET_CORNICE_TOP, z - CABINET_BODY_WIDTH / 2]];
    if (!path3(base, surfaces.wood, '#d0a675', 4)) return;
    path3([[faceX, .31, z - CABINET_GRID_HALF_WIDTH], [faceX, .31, z + CABINET_GRID_HALF_WIDTH],
      [faceX, CABINET_GRID_BOTTOM_Y, z + CABINET_GRID_HALF_WIDTH],
      [faceX, CABINET_GRID_BOTTOM_Y, z - CABINET_GRID_HALF_WIDTH]], '#695043', '#b99263', 2);
    if (Math.hypot(camera.position.x - faceX, camera.position.z - z) < 9) {
      for (let slot = 0; slot < CABINET_CAPACITY; slot++) {
        const cell = pegForSlot(slot);
        const cz = z + (left ? -cell.x : cell.x);
        const y0 = cell.y - CABINET_ROW_HEIGHT / 4;
        const y1 = cell.y + CABINET_ROW_HEIGHT / 4;
        const top = project(faceX, y1, cz);
        const bottom = project(faceX, y0, cz);
        if (!top || !bottom) continue;
        const shade = ctx.createLinearGradient(top.x, top.y, bottom.x, bottom.y);
        shade.addColorStop(0, '#8e7b65');
        shade.addColorStop(.72, '#b5a087');
        shade.addColorStop(1, '#a18b71');
        const half = CABINET_COLUMN_WIDTH / 4;
        const panel = [[faceX, y0, cz - half], [faceX, y0, cz + half],
          [faceX, y1, cz + half], [faceX, y1, cz - half]];
        path3(panel, shade);
        ctx.save();
        ctx.globalAlpha = .16;
        path3(panel, surfaces.ceiling);
        ctx.restore();
        const occupant = cabinetSlots[type].get(slot);
        const motion = placingKeys.get(occupant);
        const flash = motion?.fromRing ? cabinetContactGlow((frameTime - motion.startTime) / 1000) : 0;
        const center = occupant && (!inFlight.has(occupant) || flash > 0)
          ? project(faceX, cell.y + CABINET_KEY_OFFSET_Y, cz) : null;
        if (center) {
          const row = Math.floor(slot / (CABINET_COLUMNS * 2));
          const brightness = flash ? .53 * flash : settledRows & (1 << row) ? .40 : .25;
          const radius = Math.max(1, Math.abs(top.y - bottom.y) * .64);
          const glow = ctx.createRadialGradient(center.x, center.y, 0, center.x, center.y, radius);
          glow.addColorStop(0, `rgba(255,195,109,${brightness})`);
          glow.addColorStop(1, 'rgba(255,195,109,0)');
          path3(panel, glow);
        }
      }
    }
    for (let row = 0; row <= CABINET_ROWS * 2; row++) {
      const y = CABINET_GRID_BOTTOM_Y + row * CABINET_ROW_HEIGHT / 2;
      segment([faceX, y, z - CABINET_GRID_HALF_WIDTH + .07], [faceX, y, z + CABINET_GRID_HALF_WIDTH - .07], '#86634d', 4);
      segment([faceX, y + .009, z - CABINET_GRID_HALF_WIDTH + .07], [faceX, y + .009, z + CABINET_GRID_HALF_WIDTH - .07], '#bd966d', 1.25);
    }
    for (let divider = 0; divider <= CABINET_COLUMNS * 2; divider++) {
      const shift = -CABINET_GRID_HALF_WIDTH + divider * CABINET_COLUMN_WIDTH / 2;
      const dividerZ = z + (left ? -shift : shift);
      segment([faceX, CABINET_GRID_BOTTOM_Y, dividerZ],
        [faceX, CABINET_GRID_BOTTOM_Y + CABINET_ROWS * CABINET_ROW_HEIGHT, dividerZ], '#b99263', 4);
    }
    const sign = project(faceX, CABINET_HEADER_Y, z);
    if (sign) {
      const charSize = clamp(123 / sign.depth * 3, 12, 30);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ecd2a0';
      ctx.font = `${charSize}px Georgia`;
      ctx.shadowColor = '#000';
      ctx.shadowBlur = 5;
      ctx.fillText(familyName(type).toUpperCase(), sign.x, sign.y, 220);
      ctx.shadowBlur = 0;
    }
    // The 2D renderer shows the same family crest above each cabinet.
    const crownX = faceX + (left ? -.13 : .13);
    const crownMetal = `#${KEY_TYPES[type].metal.toString(16).padStart(6, '0')}`;
    const crestY = (CABINET_CORNICE_TOP + PERIMETER_BAND_Y) / 2;
    const headPoints = getKeyFallbackHeadPoints(type);
    const halfHead = Math.max(...headPoints.map(([,y]) => Math.abs(y)), .01);
    const crestScale = Math.min(2.8, (PERIMETER_BAND_Y - CABINET_CORNICE_TOP) * .43 / halfHead) * CABINET_CROWN_SCALE_FACTOR;
    ctx.save();
    ctx.shadowColor = '#ffd68b';
    ctx.shadowBlur = reward.crownGlow * 35;
    const stemBottom = CABINET_CORNICE_TOP + .02;
    path3([[crownX, stemBottom, z - .136], [crownX, crestY - .10, z - .136],
      [crownX, crestY - .10, z + .136], [crownX, stemBottom, z + .136]],
    crownMetal, '#4b372a', 2);
    const crest = headPoints.map(([x, y]) => [crownX, crestY + y * crestScale, z + x * crestScale]);
    path3(crest, crownMetal, '#ecce92', 2.5);
    const cutout = Array.from({ length: 18 }, (_, i) => {
      const angle = i * Math.PI * 2 / 18;
      return [crownX, crestY + Math.sin(angle) * .272 * crestScale / 2.8, z + Math.cos(angle) * .272 * crestScale / 2.8];
    });
    path3(cutout, '#302a25', '#876e4b', 1.5);
    ctx.restore();
    const count = cabinetCounts[type];
    const showKeys = Math.hypot(camera.position.x - faceX, camera.position.z - z) < 17;
    for (let i = 0; showKeys && i < CABINET_CAPACITY; i++) {
      const peg = pegForSlot(i);
      const hookZ = z + (left ? -peg.x : peg.x);
      const hook = project(faceX + (left ? -.025 : .025), peg.y + CABINET_KEY_OFFSET_Y, hookZ);
      if (!hook) continue;
      const size = clamp(15 / hook.depth, .9, 3.5) * CABINET_KEY_SCALE_FACTOR;
      const occupantId = cabinetSlots[type].get(i);
      if (occupantId && !inFlight.has(occupantId)) {
        ctx.fillStyle = '#ebd9b6';
        ctx.beginPath();
        ctx.arc(hook.x, hook.y - size * .85, size * .9, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#99784f';
        ctx.lineWidth = Math.max(.7, size * .5);
        ctx.beginPath();
        ctx.moveTo(hook.x, hook.y - size * .03);
        ctx.lineTo(hook.x, hook.y + size * 2.15);
        ctx.stroke();
      }
    }
    function celebration(y0, y1, halfWidth, pulse) {
      if (!pulse) return;
      const quad = [[faceX, y0, z - halfWidth], [faceX, y0, z + halfWidth],
        [faceX, y1, z + halfWidth], [faceX, y1, z - halfWidth]];
      const a = project(faceX, (y0 + y1) / 2, z + (left ? halfWidth : -halfWidth));
      const b = project(faceX, (y0 + y1) / 2, z + (left ? -halfWidth : halfWidth));
      if (!a || !b) return;
      ctx.save();
      if (path3(quad, null)) {
        ctx.clip();
        ctx.globalCompositeOperation = 'lighter';
        const gradient = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
        const center = pulse.sweep * 1.24 - .12;
        gradient.addColorStop(0, 'rgba(255,207,115,0)');
        gradient.addColorStop(clamp(center - .12, 0, 1), 'rgba(255,207,115,0)');
        gradient.addColorStop(clamp(center, 0, 1), `rgba(255,207,115,${.56 * pulse.fade})`);
        gradient.addColorStop(clamp(center + .12, 0, 1), 'rgba(255,207,115,0)');
        gradient.addColorStop(1, 'rgba(255,207,115,0)');
        ctx.fillStyle = gradient; ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = `rgba(255,216,143,${pulse.flash * pulse.fade * .48})`;
        ctx.fillRect(0, 0, width, height);
      }
      ctx.restore();
    }
    for (const pulse of reward.rows) {
      const y = CABINET_GRID_TOP_Y - pulse.row * CABINET_ROW_HEIGHT / 2;
      celebration(y - CABINET_ROW_HEIGHT / 2, y, CABINET_GRID_HALF_WIDTH, pulse);
    }
    celebration(0, CABINET_CORNICE_TOP, CABINET_BODY_WIDTH / 2, reward.cabinet);
    if (hovered?.kind === 'cabinet' && hovered.type === type) {
      const gridHalfWidth = CABINET_COLUMNS * CABINET_COLUMN_WIDTH / 2;
      const corners = [[faceX, CABINET_GRID_BOTTOM_Y, z - gridHalfWidth],
        [faceX, CABINET_GRID_BOTTOM_Y, z + gridHalfWidth],
        [faceX, CABINET_GRID_TOP_Y, z + gridHalfWidth],
        [faceX, CABINET_GRID_TOP_Y, z - gridHalfWidth]];
      for (let edge = 0; edge < 4; edge++)
        segment(corners[edge], corners[(edge + 1) % 4], 'rgba(255,239,193,.74)', 2.5);
      if (Number.isInteger(hovered.slot)) {
        const peg = pegForSlot(hovered.slot);
        const cellZ = z + (left ? -peg.x : peg.x);
        const halfW = CABINET_CELL_INNER_HALF_WIDTH;
        const halfH = CABINET_CELL_INNER_HALF_HEIGHT;
        const cornersAt = x => [[x, peg.y - halfH, cellZ - halfW],
          [x, peg.y - halfH, cellZ + halfW],
          [x, peg.y + halfH, cellZ + halfW],
          [x, peg.y + halfH, cellZ - halfW]];
        const rearX = faceX + (left ? -.052 : .052) * CABINET_DEPTH_FACTOR;
        ctx.save();
        if (path3(cornersAt(faceX), null, null)) {
          ctx.clip();
          if (path3(cornersAt(rearX), null, null)) {
            ctx.fillStyle = 'rgba(255,219,148,.17)';
            ctx.fill();
            ctx.strokeStyle = '#ffe2a2';
            ctx.lineWidth = 2;
            ctx.stroke();
          }
        }
        ctx.restore();
      }
    }
    if (count === requiredCounts[type]) {
      const top = project(faceX, CABINET_CORNICE_TOP - .19, z);
      if (top) {
        ctx.fillStyle = '#f1cb84';
        ctx.beginPath(); ctx.arc(top.x, top.y, clamp(28 / top.depth, 3, 10), 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  function drawCandle(candle) {
    const { x, y, z, mountX, collider } = candle;
    if (mountX !== undefined) {
      const plate = mountX - Math.sign(x) * .075;
      path3([[plate, y - .17, z - .12], [plate, y + .12, z - .12],
        [plate, y + .12, z + .12], [plate, y - .17, z + .12]], '#896440', '#493122', 1);
      const base = project(x, y, z);
      if (base) segment([x, y - .027, z], [plate, y - .027, z], '#88643e',
        Math.max(1.5, 27 / base.depth));
    }
    const base = project(x, y, z);
    const top = project(x, y + .27, z);
    const wick = project(x, y + CANDLE_WICK_Y, z);
    if (!base || !top || !wick) return;
    const size = Math.max(1, 39 / base.depth);
    ctx.fillStyle = '#82603e';
    ctx.fillRect(base.x - size, base.y - size * .22, size * 2, Math.max(1, size * .35));
    segment([x, y + .025, z], [x, y + .27, z], '#d9bd89', Math.max(1, size * .83));
    segment([x, y + .27, z], [x, y + CANDLE_WICK_Y, z], '#3d2a1e', Math.max(1, size * .18));
    if (!collider.userData.lit) return;
    const flicker = sampleCandleFlicker(frameTime, x, z);
    const height = CANDLE_FLAME_HEIGHT * (1 + .065 * flicker);
    const tip = project(x, y + CANDLE_WICK_Y + height, z);
    if (!tip) return;
    const glowY = wick.y + (tip.y - wick.y) * .40;
    const radius = size * 3.5;
    const glow = ctx.createRadialGradient(wick.x, glowY, 0, wick.x, glowY, radius);
    glow.addColorStop(0, `rgba(255,174,67,${.48 + .035 * flicker})`);
    glow.addColorStop(1, 'rgba(255,174,67,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(wick.x - radius, glowY - radius, radius * 2, radius * 2);
    if (!flameAtlas.naturalWidth) return;
    const frame = Math.round(11.5 * (1 + flicker));
    const screenHeight = Math.max(1, Math.abs(tip.y - wick.y));
    const screenWidth = screenHeight * CANDLE_FLAME_WIDTH / CANDLE_FLAME_HEIGHT;
    ctx.save();
    ctx.translate(wick.x, wick.y);
    ctx.rotate(-.048 * flicker);
    ctx.drawImage(flameAtlas, frame % 6 * 40, Math.floor(frame / 6) * 80, 40, 80,
      -screenWidth / 2, -screenHeight, screenWidth, screenHeight);
    ctx.restore();
  }

  function drawStation(station) {
    const { x, z } = station;
    const table = [[x - 2.52, .88, z - .74], [x + 2.52, .88, z - .74],
      [x + 2.52, .88, z + .87], [x - 2.52, .88, z + .87]];
    path3(table, surfaces.bench, '#cba774', 3);
    for (const edgeX of [x - 2.28, x + 2.28]) {
      segment([edgeX, .8, z - .58], [edgeX, .15, z - .58], '#59483c', 6);
      segment([edgeX, .8, z + .67], [edgeX, .15, z + .67], '#59483c', 6);
    }
    for (const kind of ['mud', 'rust']) {
      const bx = x + FIXTURE_OFFSETS[kind];
      const isWater = kind === 'mud';
      const p = project(bx, isWater ? 1.19 : 1.415, z + .10);
      const base = project(bx, .91, z + .10);
      if (!p || !base) continue;
      const r = clamp((isWater ? 88 : 65) / p.depth, 6, 52);
      const active = fixtureHover.get(bathId(station.id, kind)) || 0;
      ctx.beginPath();
      ctx.moveTo(p.x - r, p.y);
      ctx.quadraticCurveTo(p.x - r * .94, base.y, base.x - r * .65, base.y);
      ctx.quadraticCurveTo(base.x, base.y + r * .40, base.x + r * .65, base.y);
      ctx.quadraticCurveTo(p.x + r * .94, base.y, p.x + r, p.y);
      ctx.ellipse(p.x, p.y, r, r * .43, 0, 0, Math.PI, true);
      ctx.closePath();
      ctx.fillStyle = isWater ? '#416e6c' : '#626e4e';
      ctx.fill();
      if (active > .005) {
        ctx.save(); ctx.globalAlpha = active * .86;
        ctx.lineWidth = 3; ctx.strokeStyle = '#fff2ce'; ctx.stroke();
        ctx.restore();
      }
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, r, r * .43, 0, 0, Math.PI * 2);
      ctx.fillStyle = isWater ? '#78a29d' : '#a0a678';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = isWater ? '#94b6ad' : '#b7b994';
      ctx.stroke();
      const id = bathId(station.id, kind);
      const keys = keyIndex.bathKeys(id);
      const wallTime = Date.now();
      drawBathActivity(ctx, p, r, kind, keys, frameTime, wallTime);
      drawBathKeys(ctx, p, r, kind, keys, wallTime, workstations.lifts.get(id), frameTime);
    }
    const f = project(x, FORGE_SURFACE_Y, z + .08);
    const base = project(x, .91, z + .08);
    if (f && base) {
      const r = clamp(89 / f.depth, 8, 49);
      const lipHeight = r * .40;
      ctx.beginPath();
      ctx.moveTo(f.x - r, f.y);
      ctx.lineTo(base.x - r * .76, base.y);
      ctx.quadraticCurveTo(base.x, base.y + r * .46, base.x + r * .76, base.y);
      ctx.lineTo(f.x + r, f.y);
      ctx.ellipse(f.x, f.y, r, lipHeight, 0, 0, Math.PI, true);
      ctx.closePath();
      ctx.fillStyle = '#4a403b';
      ctx.fill();
      const active = fixtureHover.get(`forge:${station.id}`) || 0;
      if (active > .005) {
        ctx.save();
        ctx.globalAlpha = active * .9;
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#fff2ce';
        ctx.stroke();
        ctx.restore();
      }
      ctx.beginPath();
      ctx.ellipse(f.x, f.y, r, r * .40, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#dd793c'; ctx.fill();
      drawForgeActivity(ctx, f, r, frameTime, station.forge.impactAt);
      ctx.strokeStyle = '#756151';
      ctx.lineWidth = 5; ctx.stroke();
    }

  }

  const cabinetCompletion = KEY_TYPES.map(() => createCabinetCompletion());
  const cabinetCounts = new Array(KEY_TYPES.length).fill(0);
  const cabinetSlots = Array.from({ length: KEY_TYPES.length }, () => new Map());
  const requiredCounts = getProgress(state).required;
  const keyPainter = createFallbackKeyPainter({ ctx, project, keyHover });
  const handWorldPosition = new THREE.Vector3();
  const { drawKey, drawHand, drawPlacingKey, drawDiscardingKey, drawDistantKeys } = keyPainter;

  function draw() {
    const currentTime = performance.now();
    if (currentTime - lastDraw < 28) return false;
    lastDraw = currentTime;
    scene.updateMatrixWorld(true);
    camera.updateMatrixWorld(true);
    ctx.clearRect(0, 0, width, height);
    architecturePainter.setFrame({ width, height, frameTime, playing, visualSettings, ledgerVisible, ledgerHovered: hovered?.kind === 'ledger' });
    background();
    architecture();
    const drawables = [];
    const distantKeys = KEY_TYPES.map(() => []);
    for (let type = 0; type < 10; type++) {
      const pos = cabinets[type].group.position;
      const distance = camera.position.distanceTo(pos);
      drawables.push({ distance, draw: () => drawCabinet(type) });
    }
    for (const candle of candles)
      drawables.push({ distance: Math.hypot(camera.position.x - candle.x, camera.position.z - candle.z),
        draw: () => drawCandle(candle) });
    for (const station of workstations.stations)
      drawables.push({ distance: camera.position.distanceTo(station.group.position),
        draw: () => drawStation(station) });
    for (const key of state.keys) if (key.status === 'floor' && !thrownKeys.has(key.id)) {
      const distance = Math.hypot(camera.position.x - key.x, camera.position.z - key.z);
      if (distance > 9.4 && !key.wax && hovered?.id !== key.id) distantKeys[key.type].push(key);
      else drawables.push({ distance, draw: () => drawKey(key) });
    }
    for (const motion of thrownKeys.values()) {
      const pose = sampleThrow(motion.start, motion.end, (currentTime - motion.startTime) / 1000);
      const airborne = { ...motion.key, x: pose.x, z: pose.z };
      drawables.push({ distance: Math.hypot(camera.position.x - pose.x, camera.position.z - pose.z),
        draw: () => drawKey(airborne, pose.y, pose.spin) });
    }
    for (const motion of placingKeys.values()) {
      if (currentTime < motion.startTime) continue;
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
    cabinetCompletion[type].refresh(sorted.filter(key => !placingKeys.has(key.id)));
    cabinetCounts[type] = sorted.length;
    cabinetSlots[type] = new Map(sorted.map(key => [key.cabinetSlot, key.id]));
  }

  return {
    setSize(w, h) { width = w; height = h; },
    refreshCabinet,
    completionFor: type => cabinetCompletion[type],
    render({ hovered: currentHover, carriedKey: currentHand, pickupLift, frameTime: now, visualSettings: settings, playing: isPlaying, ledgerVisible: currentLedgerVisibility }) {
      hovered = currentHover;
      ledgerVisible = currentLedgerVisibility;
      carriedKey = currentHand;
      frameTime = now;
      playing = isPlaying;
      visualSettings = settings;
      const daylight = settings.windowDaylight / 100;
      let heldKeyLight = 0;
      if (carriedKey && daylight > 0) {
        const { x, y, z } = RIGHT_HAND_RELEASE;
        camera.localToWorld(handWorldPosition.set(x, y, z));
        heldKeyLight = daylight * windowBeamLightAt(handWorldPosition.x, handWorldPosition.y, handWorldPosition.z);
      }
      keyPainter.setFrame({ width, height, frameTime, carriedKey, daylight, heldKeyLight, pickupLift });
      return draw();
    },
  };
}
