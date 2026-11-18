import * as THREE from '../vendor/three.js';
import { createFallbackKeyPainter } from './fallback-canvas-keys.js';
import { ENTRANCE_DOOR_TEXTURE_URL } from './entrance-door-texture.js';
import { KEY_TYPES, getProgress, bathContents } from './rules.js?v=23';
import { sampleThrow } from './throw-physics.js';
import { CABINET_Z, CABINET_CAPACITY, CABINET_COLUMNS, CABINET_ROWS,
  CABINET_COLUMN_WIDTH, CABINET_ROW_HEIGHT, CABINET_GRID_BOTTOM_Y,
  CABINET_BLANK_ROW_BOTTOM_Y, CABINET_OUTLINE, pegForSlot } from './cabinet-layout.js?v=21';
import { FIXTURE_OFFSETS, bathId } from './station-layout.js?v=2';
import { WINDOW_CENTERS, PILASTER_CENTERS, PERIMETER_BAND_Y, vaultHeight,
  WINDOW_SILL_Y, WINDOW_SPRING_Y } from './hall-architecture.js?v=23';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

// Canvas-only illustration code. No collision, input, save, or game-state mutation.
export function createFallbackCanvasRenderer({
  ctx, scene, camera, surfaces, state, cabinets, workstations,
  thrownKeys, placingKeys, discardingKeys, cabinetHover, fixtureHover, keyHover,
}) {
  let width = 0, height = 0, frameTime = 0, lastDraw = -Infinity;
  let visualSettings = null, hovered = null, carriedKey = null;
  const entrancePainting = new Image();
  entrancePainting.src = ENTRANCE_DOOR_TEXTURE_URL;
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

  function background() {
    const horizon = height * (.48 + camera.rotation.x * .65);
    const wall = ctx.createLinearGradient(0, 0, 0, height);
    const toon = visualSettings.toonEnabled ? visualSettings.toonLight * visualSettings.cartoonMaterial / 10000 : 0;
    wall.addColorStop(0, '#344c47');
    wall.addColorStop(.45 - toon * .10, '#566e60');
    wall.addColorStop(.45 + toon * .10, toon > .1 ? '#748873' : '#66796a');
    wall.addColorStop(1, '#43554c');
    ctx.fillStyle = wall;
    ctx.fillRect(0, 0, width, height);
    const floor = ctx.createLinearGradient(0, horizon, 0, height);
    floor.addColorStop(0, '#776c60');
    floor.addColorStop(1, '#987361');
    ctx.fillStyle = floor;
    ctx.fillRect(0, Math.max(0, horizon), width, height);
    const ceiling = ctx.createLinearGradient(0, 0, 0, Math.max(10, horizon));
    ceiling.addColorStop(0, 'rgba(24,42,39,.64)');
    ceiling.addColorStop(1, 'rgba(59,77,65,0)');
    ctx.fillStyle = ceiling;
    ctx.fillRect(0, 0, width, Math.max(10, horizon));
  }

  function drawWindowSnow(x, z) {
    if (!visualSettings.wetSnowEnabled || visualSettings.snowIntensity === 0) return;
    const amount = visualSettings.snowIntensity / 100;
    const wind = visualSettings.snowWind / 100;
    const visible = Math.round(4 + amount * 29);
    const seconds = frameTime / 1000;
    ctx.save();
    for (let index = 0; index < visible; index++) {
      const seed = index * 17.13 + z * 1.71 + x * 2.7;
      const random = n => (Math.sin(n * 78.233) * 43758.5453 + 1) % 1;
      const u = ((random(seed) + seconds * wind * .034 * (1 + index % 3)) % 1 + 1) % 1;
      const v = ((random(seed + 3.5) - seconds * (.082 + index % 7 * .014)) % 1 + 1) % 1;
      const position = project(x, 6.31 + v * 2.79, z - .93 + u * 1.86);
      if (!position) continue;
      const size = clamp((index % 5 === 0 ? 12 : 8) / position.depth, .75, 2.8);
      ctx.fillStyle = `rgba(228,242,238,${(.34 + amount * .48).toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(position.x, position.y, size, 0, Math.PI * 2);
      ctx.fill();
      if (index % 5 === 0) {
        ctx.strokeStyle = `rgba(192,217,216,${(amount * .42).toFixed(2)})`;
        ctx.lineWidth = .8;
        ctx.beginPath();
        ctx.moveTo(position.x, position.y - size);
        ctx.lineTo(position.x - wind * 2, position.y + size * 3);
        ctx.stroke();
      }
    }
    // Condensed meltwater drifts down the glass more slowly than the flakes.
    for (let index = 0; index < 4; index++) {
      const offset = ((index * .273 + .12) % 1) * 1.72 - .86;
      const lead = ((seconds * (.019 + index * .006) + index * .21) % 1 + 1) % 1;
      const from = project(x, 8.86 - lead * 1.8, z + offset);
      const to = project(x, 8.63 - lead * 1.8, z + offset - wind * .04);
      if (!from || !to) continue;
      ctx.strokeStyle = `rgba(219,244,241,${(amount * .27).toFixed(2)})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawEntranceDoor() {
    if (!entrancePainting.naturalWidth) return;
    // Approximate perspective in the fallback renderer with an affine image
    // transform. The actual WebGL entrance uses the same image on a flat plane.
    const topLeft = project(2.2, 6.67, 22.665);
    const topRight = project(-2.2, 6.67, 22.665);
    const bottomLeft = project(2.2, .23, 22.665);
    if (!topLeft || !topRight || !bottomLeft) return;
    const w = entrancePainting.naturalWidth;
    const h = entrancePainting.naturalHeight;
    ctx.save();
    ctx.transform((topRight.x - topLeft.x) / w, (topRight.y - topLeft.y) / w,
      (bottomLeft.x - topLeft.x) / h, (bottomLeft.y - topLeft.y) / h,
      topLeft.x, topLeft.y);
    ctx.drawImage(entrancePainting, 0, 0);
    ctx.restore();
  }

  function architecture() {
    // The room is drawn as a set of projected linework and painted wall planes.
    path3([[-11.8, 0, -23], [11.8, 0, -23], [11.8, 0, 23], [-11.8, 0, 23]], surfaces.wood);
    path3([[-11.85, 0, -23], [-11.85, 11, -23], [-11.85, 11, 23], [-11.85, 0, 23]], surfaces.plaster, '#a0906e');
    path3([[11.85, 0, -23], [11.85, 11, -23], [11.85, 11, 23], [11.85, 0, 23]], surfaces.plaster, '#a0906e');
    path3([[-11.8, 0, -23], [11.8, 0, -23], [11.8, 11, -23], [-11.8, 11, -23]], surfaces.plaster, '#b7a078');
    path3([[-11.8, vaultHeight(-11.8), -23], [11.8, vaultHeight(11.8), -23],
      [11.8, vaultHeight(11.8), 23], [-11.8, vaultHeight(-11.8), 23]], surfaces.ceiling);

    // Red-brown sorting rug with hand-painted brass border.
    path3([[-8, .017, -18.6], [8, .017, -18.6], [8, .017, 18.2], [-8, .017, 18.2]], surfaces.carpet, '#ddbd81', 3);
    if (visualSettings.windowDaylight > 0) {
      ctx.save();
      ctx.globalAlpha = visualSettings.windowDaylight / 100 * .17;
      for (const z of WINDOW_CENTERS) {
        path3([[-8.4, .021, z - 1.15], [-2.9, .021, z + .45],
          [-2.9, .021, z + 2.35], [-8.4, .021, z + .75]], '#f9dc9c');
      }
      ctx.restore();
    }
    for (let x = -10; x <= 10; x += 2) {
      for (let z = -22; z < 23; z += 2) segment([x, .02, z], [x, .02, z + 2], 'rgba(184,151,104,.16)', 1);
    }
    for (let z = -22; z <= 22; z += 2) {
      for (let x = -10; x < 11; x += 2) segment([x, .02, z], [x + 2, .02, z], 'rgba(184,151,104,.12)', 1);
    }

    // Pilasters and transoms that repeat in perspective.
    for (const x of [-11.78, 11.78]) {
      for (const z of PILASTER_CENTERS) {
        segment([x, .2, z], [x, 10.7, z], '#9bae9d', 10);
        segment([x, PERIMETER_BAND_Y, z - .32], [x, PERIMETER_BAND_Y, z + .32], '#76573f', 7);
        segment([x, 10.66, z - .34], [x, 10.66, z + .34], '#76573f', 7);
      }
      for (const z of WINDOW_CENTERS) {
        const pane = [[x, WINDOW_SILL_Y, z - 1.07], [x, WINDOW_SILL_Y, z + 1.07],
          [x, WINDOW_SPRING_Y, z + 1.07]];
        for (let i = 0; i <= 16; i++) {
          const angle = Math.PI * i / 16;
          pane.push([x, WINDOW_SPRING_Y + 1.07 * Math.sin(angle), z + 1.07 * Math.cos(angle)]);
        }
        path3(pane, 'rgba(177,219,204,.46)', '#e0c58e', 3);
        drawWindowSnow(x, z);
        segment([x, WINDOW_SILL_Y, z], [x, WINDOW_SPRING_Y + 1.07, z], '#76573f', 3);
        for (const y of [7.43, 8.64])
          segment([x, y, z - 1.07], [x, y, z + 1.07], '#76573f', 3);
      }
    }
    for (const z of PILASTER_CENTERS) {
      for (let i = 0; i < 24; i++) {
        const x1 = -11.8 + i * 23.6 / 24;
        const x2 = -11.8 + (i + 1) * 23.6 / 24;
        segment([x1, vaultHeight(x1) - .04, z], [x2, vaultHeight(x2) - .04, z], '#8d6e58', 5);
      }
    }
    segment([-11.8, PERIMETER_BAND_Y, -23], [-11.8, PERIMETER_BAND_Y, 23], '#76573f', 4);
    segment([11.8, PERIMETER_BAND_Y, -23], [11.8, PERIMETER_BAND_Y, 23], '#76573f', 4);
    for (const z of [-23, 23]) segment([-11.8, PERIMETER_BAND_Y, z],
      [11.8, PERIMETER_BAND_Y, z], '#76573f', 4);
    // A sealed door ahead, visible behind the scattered keys.
    path3([[-2.5, .15, -22.7], [2.5, .15, -22.7], [2.5, 7, -22.7], [-2.5, 7, -22.7]], '#221f1e', '#c4a576', 5);
    for (const x of [-1.55, -.8, 0, .8, 1.55]) segment([x, .2, -22.6], [x, 6.8, -22.6], '#70563c', 3);
    const emblem = project(0, 5.1, -22.5);
    if (emblem) {
      const radius = clamp(50 / emblem.depth * 3, 5, 24);
      ctx.fillStyle = '#c9a46c';
      ctx.beginPath();
      ctx.arc(emblem.x, emblem.y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#30251e';
      ctx.beginPath();
      ctx.arc(emblem.x, emblem.y - radius * .23, radius * .28, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(emblem.x - radius * .18, emblem.y, radius * .36, radius * .57);
    }
    drawEntranceDoor();
    for (const z of [-13, 0, 13]) {
      segment([0, 11, z], [0, 8, z], '#ac9367', 3);
      const bulb = project(0, 7.92, z);
      if (!bulb) continue;
      const radius = clamp(26 / bulb.depth * 3, 3, 18);
      const glow = ctx.createRadialGradient(bulb.x, bulb.y, 1, bulb.x, bulb.y, radius * 2.8);
      glow.addColorStop(0, 'rgba(255,219,147,.9)');
      glow.addColorStop(.25, 'rgba(255,198,111,.38)');
      glow.addColorStop(1, 'rgba(255,193,108,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(bulb.x, bulb.y, radius * 2.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }

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
    const count = cabinetCounts[type];
    const inFlight = [...placingKeys.values()].filter(motion => motion.key.type === type).length;
    const showKeys = Math.hypot(camera.position.x - faceX, camera.position.z - z) < 17;
    for (let i = 0; showKeys && i < CABINET_CAPACITY; i++) {
      const peg = pegForSlot(i);
      const hookZ = z + (left ? -peg.x : peg.x);
      const hook = project(faceX + (left ? .05 : -.05), peg.y, hookZ);
      if (!hook) continue;
      const size = clamp(15 / hook.depth, .9, 3.5);
      if (i < count - inFlight) {
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
    if (cabinetHover[type] > .005) {
      ctx.save();
      ctx.globalAlpha = cabinetHover[type];
      ctx.shadowColor = 'rgba(255,255,255,.8)';
      ctx.shadowBlur = 8;
      const halfBorder = CABINET_OUTLINE.width / 2;
      const baseY = CABINET_GROUND_OFFSET + CABINET_OUTLINE.bottom;
      const topY = CABINET_GROUND_OFFSET + CABINET_OUTLINE.top;
      path3([[x1, baseY, z - halfBorder], [x1, baseY, z + halfBorder],
        [x1, topY, z + halfBorder], [x1, topY, z - halfBorder]], null, '#ffffff', 4);
      ctx.restore();
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
      if (active > .005) {
        ctx.save(); ctx.globalAlpha = active;
        ctx.lineWidth = 6; ctx.strokeStyle = '#ffffff'; ctx.stroke();
        ctx.restore();
      }
      const contents = bathContents(state, bathId(station.id, kind));
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
    cabinetCounts[type] = state.keys.filter(key => key.type === type && key.status === 'sorted').length;
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
