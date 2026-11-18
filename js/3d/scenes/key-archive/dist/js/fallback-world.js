import * as THREE from '../vendor/three.js';
import { KEY_TYPES, KEYS_PER_TYPE, getProgress, keyCondition, bathContents } from './rules.js?v=21';
import { keyHeadPoints, makePaintTexture } from './art.js?v=17';
import { sampleThrow } from './throw-physics.js';
import { METAL_BY_KEY_TYPE, PAINTED_METALS } from './painted-textures.js';
import { findFloorKeyAtReticle } from './key-picking.js';
import {
  CABINET_Z, CABINET_CAPACITY, CABINET_COLUMNS, CABINET_ROWS,
  CABINET_COLUMN_WIDTH, CABINET_ROW_HEIGHT, CABINET_GRID_BOTTOM_Y,
  CABINET_BLANK_ROW_BOTTOM_Y, CABINET_GROUND_OFFSET,
  CABINET_OUTLINE, pegForSlot,
} from './cabinet-layout.js?v=20';
import { STATIONS, FIXTURE_OFFSETS, bathId } from './station-layout.js';
import { getPatinaTexture } from './key-patina.js';
import { restingKeyY } from './floor-contact.js';
import { PLAYER_EYE_HEIGHT } from './player-config.js';
import { HALL_SURFACE_URLS } from './hall-surface-textures.js?v=23';
import {
  WINDOW_CENTERS, PILASTER_CENTERS, PERIMETER_BAND_Y, vaultHeight,
  WINDOW_SILL_Y, WINDOW_SPRING_Y,
} from './hall-architecture.js?v=23';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

// A lightweight first-person perspective renderer for browsers that disable WebGL.
// All picking and game rules still use the same Three.js world coordinates.
export function createFallbackWorld(canvas, state, initialVisualSettings) {
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Не удалось инициализировать 2D- или 3D-графику.');
  const woodPattern = ctx.createPattern(makePaintTexture('wood', 45).image, 'repeat');
  let plasterPattern = ctx.createPattern(makePaintTexture('plaster', 32).image, 'repeat');
  let ceilingPattern = woodPattern;
  const wallImage = new Image();
  wallImage.onload = () => { plasterPattern = ctx.createPattern(wallImage, 'repeat') || plasterPattern; };
  wallImage.src = HALL_SURFACE_URLS.wall;
  const ceilingImage = new Image();
  ceilingImage.onload = () => { ceilingPattern = ctx.createPattern(ceilingImage, 'repeat') || ceilingPattern; };
  ceilingImage.src = HALL_SURFACE_URLS.ceiling;
  let rugPattern = ctx.createPattern(makePaintTexture('rug', 177).image, 'repeat');
  const rugImage = new Image();
  rugImage.onload = () => { rugPattern = ctx.createPattern(rugImage, 'repeat') || rugPattern; };
  rugImage.src = HALL_SURFACE_URLS.carpet;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(73, 1, .06, 120);
  camera.position.set(0, PLAYER_EYE_HEIGHT, 20.2);
  scene.add(camera);
  const interactables = [];
  const keyTargets = new Map();
  const keysByType = KEY_TYPES.map(() => []);
  for (const key of state.keys) keysByType[key.type].push(key);
  const thrownKeys = new Map();
  const placingKeys = new Map();
  const discardingKeys = new Map();
  const cabinets = [];
  let hovered = null;
  const cabinetHover = new Float32Array(KEY_TYPES.length);
  const fixtureHover = new Map();
  const keyHover = { id: null, opacity: 0, target: 0 };
  let lastHoverFrame = performance.now();
  let carriedKey = null;
  let frameTime = 0;
  let lastDraw = -Infinity;
  let width = 0;
  let height = 0;
  let visualSettings = initialVisualSettings;

  function setVisualSettings(settings) {
    visualSettings = settings;
    // Preserve the fast Canvas path; CSS full-canvas filters force costly
    // software compositing on devices that have already lost WebGL.
    canvas.style.filter = 'none';
  }
  setVisualSettings(initialVisualSettings);

  const colliderGeometry = new THREE.BoxGeometry(.43, .21, .65);
  const colliderMaterial = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 });
  const dummy = new THREE.Object3D();
  const keyColliders = KEY_TYPES.map((_, type) => {
    const collider = new THREE.InstancedMesh(colliderGeometry, colliderMaterial, KEYS_PER_TYPE);
    collider.userData = { kind: 'key-batch', type };
    collider.frustumCulled = false;
    scene.add(collider);
    interactables.push(collider);
    keysByType[type].forEach((key, index) => keyTargets.set(key.id, { type, index }));
    return collider;
  });
  for (let type = 0; type < KEY_TYPES.length; type++) {
    const left = type < 5;
    const group = new THREE.Group();
    group.position.set(left ? -11.58 : 11.58, CABINET_GROUND_OFFSET, CABINET_Z[type % 5]);
    group.rotation.y = left ? Math.PI / 2 : -Math.PI / 2;
    const collider = new THREE.Mesh(new THREE.BoxGeometry(3.82, 4.65, .15));
    collider.position.set(0, 2.53, .74);
    collider.userData = { kind: 'cabinet', type };
    group.add(collider);
    scene.add(group);
    interactables.push(collider);
    cabinets.push({ type, group, collider });
  }
  const workstations = { stations: [], interactables: [] };
  for (const station of STATIONS) {
    const group = new THREE.Group();
    group.position.set(station.x, 0, station.z);
    scene.add(group);
    const baths = ['mud', 'rust'].map(kind => {
      const collider = new THREE.Mesh(new THREE.BoxGeometry(1.18, .78, .98));
      collider.position.set(FIXTURE_OFFSETS[kind], 1.22, .13);
      collider.userData = { kind: 'bath', id: bathId(station.id, kind), bathKind: kind, stationId: station.id };
      group.add(collider);
      return { collider, id: collider.userData.id, kind };
    });
    const forgeCollider = new THREE.Mesh(new THREE.CylinderGeometry(.69, .69, .94, 14));
    forgeCollider.position.set(0, 1.29, .08);
    forgeCollider.userData = { kind: 'forge', stationId: station.id };
    group.add(forgeCollider);
    workstations.stations.push({ ...station, group, baths, forge: { collider: forgeCollider } });
    workstations.interactables.push(...baths.map(bath => bath.collider), forgeCollider);
  }
  interactables.push(...workstations.interactables);

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    width = Math.max(1, Math.round(rect.width));
    height = Math.max(1, Math.round(rect.height));
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);

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
        ctx.fillStyle = fill === woodPattern ? '#b38d6e' :
          fill === ceilingPattern ? '#76513b' :
          fill === rugPattern ? '#a27a82' : '#b8c2b1';
        ctx.fill();
        ctx.restore();
      }
    }
    if (stroke) {
      if (visualSettings.outlineEnabled) {
        ctx.strokeStyle = `rgba(20,28,27,${visualSettings.outlineStrength / 100})`;
        ctx.lineWidth = strokeWidth + visualSettings.outlineWidth * 1.7;
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

  function architecture() {
    // The room is drawn as a set of projected linework and painted wall planes.
    path3([[-11.8, 0, -23], [11.8, 0, -23], [11.8, 0, 23], [-11.8, 0, 23]], woodPattern);
    path3([[-11.85, 0, -23], [-11.85, 11, -23], [-11.85, 11, 23], [-11.85, 0, 23]], plasterPattern, '#a0906e');
    path3([[11.85, 0, -23], [11.85, 11, -23], [11.85, 11, 23], [11.85, 0, 23]], plasterPattern, '#a0906e');
    path3([[-11.8, 0, -23], [11.8, 0, -23], [11.8, 11, -23], [-11.8, 11, -23]], plasterPattern, '#b7a078');
    path3([[-11.8, vaultHeight(-11.8), -23], [11.8, vaultHeight(11.8), -23],
      [11.8, vaultHeight(11.8), 23], [-11.8, vaultHeight(-11.8), 23]], ceilingPattern);

    // Red-brown sorting rug with hand-painted brass border.
    path3([[-8, .017, -18.6], [8, .017, -18.6], [8, .017, 18.2], [-8, .017, 18.2]], rugPattern, '#ddbd81', 3);
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
    if (!path3(base, woodPattern, '#d0a675', 4)) return;
    path3([[faceX, .31, z - 1.52], [faceX, .31, z + 1.52], [faceX, 3.88, z + 1.52], [faceX, 3.88, z - 1.52]], '#0b0d0d', '#d5b384', 2);
    path3([[faceX, .31, z - 1.62], [faceX, .31, z + 1.62],
      [faceX, CABINET_BLANK_ROW_BOTTOM_Y, z + 1.62], [faceX, CABINET_BLANK_ROW_BOTTOM_Y, z - 1.62]],
    woodPattern, '#b99263', 2);
    path3([[faceX, CABINET_BLANK_ROW_BOTTOM_Y, z - 1.62],
      [faceX, CABINET_BLANK_ROW_BOTTOM_Y, z + 1.62],
      [faceX, CABINET_GRID_BOTTOM_Y, z + 1.62],
      [faceX, CABINET_GRID_BOTTOM_Y, z - 1.62]], '#695043', '#b99263', 2);
    for (let row = 0; row <= CABINET_ROWS; row++) {
      const y = CABINET_GRID_BOTTOM_Y + row * CABINET_ROW_HEIGHT;
      segment([faceX, y, z - 1.55], [faceX, y, z + 1.55], '#b89163', 4);
    }
    for (let divider = 0; divider <= CABINET_COLUMNS; divider++) {
      const shift = -1.62 + divider * CABINET_COLUMN_WIDTH;
      const dividerZ = z + (left ? -shift : shift);
      segment([faceX, CABINET_GRID_BOTTOM_Y, dividerZ],
        [faceX, CABINET_GRID_BOTTOM_Y + CABINET_ROWS * CABINET_ROW_HEIGHT, dividerZ], '#b99263', 4);
    }
    const sign = project(faceX, 4.25, z);
    if (sign) {
      const charSize = clamp(100 / sign.depth * 3, 9, 24);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#ecd2a0';
      ctx.font = `${charSize}px Georgia`;
      ctx.shadowColor = '#000';
      ctx.shadowBlur = 5;
      ctx.fillText(KEY_TYPES[type].name.toUpperCase(), sign.x, sign.y, 220);
      ctx.shadowBlur = 0;
    }
    segment([faceX, 4.81, z], [faceX, 5.75, z], '#674b38', 5);
    const medallion = project(faceX, 5.85, z);
    if (medallion) {
      ctx.textAlign = 'center';
      ctx.fillStyle = '#d4b16e';
      ctx.font = `${clamp(160 / medallion.depth * 3, 15, 44)}px Georgia`;
      ctx.fillText(['◯', '△', '□', '◇', '⬟', '⬡', '★', '✿', '⬭', '♛'][type], medallion.x, medallion.y);
    }
    const count = cabinetCounts[type];
    const inFlight = [...placingKeys.values()].filter(motion => motion.key.type === type).length;
    const showPegs = Math.hypot(camera.position.x - faceX, camera.position.z - z) < 17;
    for (let i = 0; showPegs && i < CABINET_CAPACITY; i++) {
      const peg = pegForSlot(i);
      const hookZ = z + (left ? -peg.x : peg.x);
      const hook = project(faceX + (left ? .05 : -.05), peg.y, hookZ);
      if (!hook) continue;
      const size = clamp(15 / hook.depth, .9, 3.5);
      ctx.strokeStyle = '#171d1d';
      ctx.lineWidth = size;
      ctx.beginPath();
      ctx.moveTo(hook.x, hook.y);
      ctx.lineTo(hook.x + (left ? size * .20 : -size * .20), hook.y + size * .08);
      ctx.stroke();
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
    path3(table, woodPattern, '#cba774', 3);
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

  const headShapes = KEY_TYPES.map((_, type) => keyHeadPoints(type));
  const cabinetCounts = new Array(KEY_TYPES.length).fill(0);
  const requiredCounts = getProgress(state).required;
  // Cached gouache-like key stamps: no per-frame polygon tessellation on Canvas.
  const keyStamps = headShapes.map((shape, type) => {
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
  const brokenStamps = keyStamps.map(stamp => {
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
  function stampFor(key) {
    if (key.broken) return brokenStamps[key.type];
    const condition = keyCondition(key);
    if (condition === 'clean') return keyStamps[key.type];
    const id = `${key.type}-${condition}`;
    if (!patinaStamps.has(id)) {
      const canvas = document.createElement('canvas');
      canvas.width = 160; canvas.height = 220;
      const brush = canvas.getContext('2d');
      brush.drawImage(keyStamps[key.type], 0, 0);
      brush.save();
      brush.globalCompositeOperation = 'source-atop';
      for (const kind of ['mud', 'rust']) if (key[kind]) {
        brush.globalAlpha = kind === 'mud' ? .88 : .71;
        brush.drawImage(getPatinaTexture(key.type, kind).image, 0, 0, 160, 220);
      }
      brush.restore();
      patinaStamps.set(id, canvas);
    }
    return patinaStamps.get(id);
  }
  const handPatterns = {};
  for (const [metal, source] of Object.entries(PAINTED_METALS)) {
    if (!new Set(METAL_BY_KEY_TYPE).has(metal)) continue;
    const image = new Image();
    image.onload = () => {
      handPatterns[metal] = ctx.createPattern(image, 'repeat');
      patinaStamps.clear();
      for (let type = 0; type < keyStamps.length; type++) {
        if (METAL_BY_KEY_TYPE[type] !== metal) continue;
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
    const shape = keyHeadPoints(carriedKey.type);
    const scale = Math.min(width, height) * .077;
    ctx.save();
    ctx.translate(width * .67, height * .77 + Math.sin(frameTime * .003) * 6);
    ctx.rotate(-.45);
    ctx.shadowColor = 'rgba(0,0,0,.65)';
    ctx.shadowBlur = 22;
    ctx.strokeStyle = '#241c17';
    ctx.fillStyle = carriedKey.mud ? '#817455' : carriedKey.rust ? '#a97047' : handPatterns[METAL_BY_KEY_TYPE[carriedKey.type]] ||
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
    const travel = Math.min(1, elapsed / .30);
    const ease = 1 - (1 - travel) ** 3;
    const position = motion.start.clone().lerp(motion.end, ease);
    position.y += Math.sin(Math.PI * travel) * .16;
    const p = project(position.x, position.y, position.z);
    if (!p) return;
    const finalSize = clamp(53 / p.depth, 5, 17);
    const size = (1 - ease) * Math.min(76, height * .12) + ease * finalSize;
    const sway = elapsed > .30 ? Math.sin((elapsed - .30) * 15) * .20 * Math.exp(-(elapsed - .30) * 2.6) : 0;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(sway);
    ctx.drawImage(stampFor(motion.key), -size * .5, -size * .45, size, size * 1.39);
    ctx.restore();
  }

  function drawDiscardingKey(motion, now) {
    const progress = clamp((now - motion.startTime) / 480, 0, 1);
    const ease = 1 - (1 - progress) ** 3;
    const position = motion.start.clone().lerp(motion.end, ease);
    position.y += Math.sin(Math.PI * progress) * .26;
    const p = project(position.x, position.y, position.z);
    if (!p) return;
    const size = Math.max(2, (1 - ease) * 56 + 3);
    ctx.save();
    ctx.translate(p.x, p.y); ctx.rotate(progress * Math.PI * 1.3);
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
    // Fine stipple keeps the gouache atmosphere even on a 2D-only machine.
    const shade = ctx.createRadialGradient(width / 2, height * .47, width * .09, width / 2, height * .48, width * .73);
    shade.addColorStop(0, 'rgba(0,0,0,0)');
    shade.addColorStop(1, 'rgba(9,17,13,.29)');
    ctx.fillStyle = shade;
    ctx.fillRect(0, 0, width, height);
    return true;
  }

  function syncKey(key) {
    const target = keyTargets.get(key.id);
    if (!target) return;
    dummy.position.set(key.x, restingKeyY(key.x, key.z) + (key.layer || 0) + .105, key.z);
    dummy.rotation.set(0, key.rotation, 0);
    dummy.scale.setScalar(key.status === 'floor' && !thrownKeys.has(key.id) ? 1 : .000001);
    dummy.updateMatrix();
    keyColliders[target.type].setMatrixAt(target.index, dummy.matrix);
    keyColliders[target.type].instanceMatrix.needsUpdate = true;
  }
  function keyIdFromHit(type, index) { return keysByType[type]?.[index]?.id || null; }
  const forward = new THREE.Vector3();
  function pickTarget() {
    forward.set(0, 0, -1).applyQuaternion(camera.quaternion);
    const nearKey = findFloorKeyAtReticle(camera.position, forward, state.keys, id => thrownKeys.has(id));
    if (nearKey) return { kind: 'key', id: nearKey.id };
    let fixture = null;
    let bestFixtureScore = Infinity;
    for (const station of workstations.stations) for (const object of [
      ...station.baths.map(bath => bath.collider), station.forge.collider,
    ]) {
      const point = object.getWorldPosition(new THREE.Vector3());
      const dx = point.x - camera.position.x;
      const dy = point.y - camera.position.y;
      const dz = point.z - camera.position.z;
      const distance = Math.hypot(dx, dy, dz);
      const alignment = (forward.x * dx + forward.y * dy + forward.z * dz) / distance;
      const score = (1 - alignment) * 8 + distance * .018;
      if (distance < 4.7 && alignment > .90 && score < bestFixtureScore) {
        bestFixtureScore = score;
        fixture = object.userData;
      }
    }
    if (fixture) return fixture;
    let nearestCabinet = null;
    let distanceBest = 6.5;
    for (const cabinet of cabinets) {
      const x = cabinet.type < 5 ? -10.84 : 10.84;
      const dx = x - camera.position.x;
      const dy = 2.53 - camera.position.y;
      const dz = cabinet.group.position.z - camera.position.z;
      const distance = Math.hypot(dx, dy, dz);
      const alignment = (forward.x * dx + forward.y * dy + forward.z * dz) / distance;
      if (distance < distanceBest && alignment > .85) {
        nearestCabinet = cabinet;
        distanceBest = distance;
      }
    }
    return nearestCabinet && { kind: 'cabinet', type: nearestCabinet.type };
  }
  function animateThrow(key, start, end) {
    thrownKeys.set(key.id, { key, start, end, startTime: performance.now() });
    syncKey(key);
  }
  function animatePlace(key, slotIndex) {
    camera.updateMatrixWorld(true);
    const start = camera.localToWorld(new THREE.Vector3(.42, -.37, -.84));
    const cabinet = cabinets[key.type];
    cabinet.group.updateMatrixWorld(true);
    const peg = pegForSlot(slotIndex);
    const end = cabinet.group.localToWorld(new THREE.Vector3(peg.x, peg.y, peg.z));
    placingKeys.set(key.id, { key, start, end, startTime: performance.now() });
  }
  function animateDiscard(key, stationId = 'near') {
    camera.updateMatrixWorld(true);
    const start = camera.localToWorld(new THREE.Vector3(.42, -.37, -.84));
    const station = workstations.stations.find(item => item.id === stationId) || workstations.stations[2];
    station.group.updateMatrixWorld(true);
    const end = station.group.localToWorld(new THREE.Vector3(0, 1.48, .08));
    discardingKeys.set(key.id, { key, start, end, startTime: performance.now() });
  }
  function isThrowing(id) { return thrownKeys.has(id); }
  function highlight(target) {
    hovered = target;
    if (target?.kind === 'key') keyHover.id = target.id;
    keyHover.target = target?.kind === 'key' ? 1 : 0;
  }
  function refreshHand(key) { carriedKey = key; }
  function update(now) {
    const elapsed = Math.max(0, Math.min(.1, (now - lastHoverFrame) / 1000));
    lastHoverFrame = now;
    const hoverFactor = 1 - Math.exp(-elapsed / .15);
    cabinetHover.forEach((amount, type) => {
      const target = hovered?.kind === 'cabinet' && hovered.type === type ? 1 : 0;
      cabinetHover[type] = amount + (target - amount) * hoverFactor;
    });
    for (const station of STATIONS) {
      for (const id of [bathId(station.id, 'mud'), bathId(station.id, 'rust'), `forge:${station.id}`]) {
        const target = hovered?.kind === 'bath' && hovered.id === id ||
          hovered?.kind === 'forge' && id === `forge:${hovered.stationId}` ? 1 : 0;
        const amount = fixtureHover.get(id) || 0;
        fixtureHover.set(id, amount + (target - amount) * hoverFactor);
      }
    }
    keyHover.opacity += (keyHover.target - keyHover.opacity) * hoverFactor;
    frameTime = now;
    for (const [id, motion] of thrownKeys) {
      if (!sampleThrow(motion.start, motion.end, (now - motion.startTime) / 1000).landed) continue;
      thrownKeys.delete(id);
      syncKey(motion.key);
    }
    for (const [id, motion] of placingKeys) {
      if ((now - motion.startTime) / 1000 < 1.65) continue;
      placingKeys.delete(id);
    }
    for (const [id, motion] of discardingKeys) {
      if ((now - motion.startTime) / 1000 < .48) continue;
      discardingKeys.delete(id);
    }
  }
  function refreshCabinet(type) {
    cabinetCounts[type] = state.keys.filter(key => key.type === type && key.status === 'sorted').length;
  }
  for (const key of state.keys) syncKey(key);
  for (let type = 0; type < KEY_TYPES.length; type++) refreshCabinet(type);
  resize();

  return {
    THREE, scene, camera, interactables, cabinets, workstations,
    renderer: { render: draw },
    setVisualSettings,
    refreshHand, syncKey, refreshCabinet, highlight, update, resize,
    keyIdFromHit, animateThrow, animatePlace, animateDiscard, isThrowing, pickTarget, throwingCount: () => thrownKeys.size,
    bounds: { x: 11.12, z: 22.53 },
  };
}
