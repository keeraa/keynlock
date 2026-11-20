import * as THREE from '../vendor/three.js';
import { floorSurfaceY, RUG_TOP } from './floor-contact.js';
import { createLedgerCollider } from './archive-ledger.js';
import { createArchiveCandles } from './archive-candles.js';
import { KEY_TYPES } from './rules.js';
import { createFallbackSurfaces } from './fallback-surfaces.js';
import { createFallbackCanvasRenderer } from './fallback-canvas-renderer.js';
import { samplePickupLift } from './held-key-motion.js';
import { sampleThrow } from './archive-throw-trajectory.js';
import { playMotionContact, samplePlacement, sampleDiscard } from './archive-key-motion.js';
import { CABINET_GRID_WIDTH, CABINET_Z, CABINET_CORNICE_TOP, cabinetKeyPose } from './cabinet-layout.js';
import { STATIONS, FIXTURE_OFFSETS, bathId, FORGE_SURFACE_Y } from './station-layout.js';
import { BATH_LIFT_MS } from './station-visual-state.js';
import { PLAYER_EYE_HEIGHT } from './player-config.js';

// A lightweight first-person perspective renderer for browsers that disable WebGL.
// All picking and game rules still use the same Three.js world coordinates.
export function createFallbackWorld(canvas, state, initialVisualSettings, keyIndex, stationNow = Date.now, sceneNow = () => performance.now()) {
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Не удалось инициализировать 2D- или 3D-графику.');
  const surfaces = createFallbackSurfaces(ctx);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(73, 1, .06, 120);
  camera.position.set(0, PLAYER_EYE_HEIGHT, 20.2);
  scene.add(camera);
  const interactables = [];
  const thrownKeys = new Map();
  const placingKeys = new Map();
  const discardingKeys = new Map();
  const cabinets = [];
  let hovered = null;
  const fixtureHover = new Map();
  const keyHover = { id: null, opacity: 0, target: 0 };
  let lastHoverFrame = sceneNow();
  let carriedKey = null;
  let pickupAt = -Infinity;
  let frameTime = 0;
  let playing = false;
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

  for (let type = 0; type < KEY_TYPES.length; type++) {
    const left = type < 5;
    const group = new THREE.Group();
    // This plane coincides with the cabinet grid drawn by the Canvas renderer.
    group.position.set(left ? -10.78 : 10.78, 0, CABINET_Z[type % 5]);
    group.rotation.y = left ? Math.PI / 2 : -Math.PI / 2;
    const collider = new THREE.Mesh(new THREE.BoxGeometry(CABINET_GRID_WIDTH + .58, CABINET_CORNICE_TOP - .29, .06));
    collider.position.set(0, (CABINET_CORNICE_TOP + .29) / 2, 0);
    collider.userData = { kind: 'cabinet', type };
    group.add(collider);
    scene.add(group);
    interactables.push(collider);
    cabinets.push({ type, group, collider, cellAimDepth: 0 });
  }
  const workstations = { stations: [], interactables: [], lifts: new Map(),
    liftKey(id, key) { this.lifts.set(id, { key, startedAt: sceneNow() }); },
    isLifting(keyId) { return Array.from(this.lifts.values()).some(lift => lift.key.id === keyId); },
  };
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
    workstations.stations.push({ ...station, group, baths, forge: { collider: forgeCollider, impactAt: -Infinity } });
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
    canvasRenderer.setSize(width, height);
  }
  window.addEventListener('resize', resize);

  const candleSet = createArchiveCandles(scene);
  const ledgerCollider = createLedgerCollider();
  scene.add(ledgerCollider);
  interactables.push(...candleSet.colliders, ledgerCollider);
  let ledgerVisible = true;
  const canvasRenderer = createFallbackCanvasRenderer({
    candles: candleSet.candles, stationNow, sceneNow,
    ctx, scene, camera, surfaces, state, cabinets, workstations, keyIndex,
    thrownKeys, placingKeys, discardingKeys, fixtureHover, keyHover,
  });
  cabinets.forEach(cabinet => { cabinet.completion = canvasRenderer.completionFor(cabinet.type); });

  function animateThrow(key, start, end) {
    thrownKeys.set(key.id, { key, start, end, startTime: sceneNow() });
  }
  function animatePlace(key, slotIndex, { fromRing = false, delay = 0 } = {}) {
    camera.updateMatrixWorld(true);
    const start = camera.localToWorld(new THREE.Vector3(fromRing ? -.49 : .42, -.37, -.84));
    const cabinet = cabinets[key.type];
    const peg = cabinetKeyPose(slotIndex, .185);
    const left = key.type < 5;
    // The fallback's stored glyph is drawn on the cabinet face at this point.
    const end = new THREE.Vector3(left ? -10.805 : 10.805, peg.y,
      cabinet.group.position.z + (left ? -peg.x : peg.x));
    placingKeys.set(key.id, { key, fromRing, start, end, startTime: sceneNow() + delay });
  }
  function animateDiscard(key, stationId = 'center') {
    camera.updateMatrixWorld(true);
    const start = camera.localToWorld(new THREE.Vector3(.42, -.37, -.84));
    const station = workstations.stations.find(item => item.id === stationId) || workstations.stations[0];
    station.forge.impactAt = sceneNow() + 440;
    station.group.updateMatrixWorld(true);
    const end = station.group.localToWorld(new THREE.Vector3(0, FORGE_SURFACE_Y, .08));
    discardingKeys.set(key.id, { key, start, end, startTime: sceneNow() });
  }
  function isThrowing(id) { return thrownKeys.has(id); }
  function cancelPlace(keyId) { placingKeys.delete(keyId); }
  function highlight(target) {
    hovered = target;
    if (target?.kind === 'key') keyHover.id = target.id;
    keyHover.target = target?.kind === 'key' ? 1 : 0;
  }
  function refreshHand(key) {
    if (carriedKey?.id !== key?.id) pickupAt = -Infinity;
    carriedKey = key;
  }
  function update(now, _moving, isPlaying, playSound) {
    const elapsed = Math.max(0, Math.min(.1, (now - lastHoverFrame) / 1000));
    lastHoverFrame = now;
    const hoverFactor = 1 - Math.exp(-elapsed / .15);
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
    for (const [id, lift] of workstations.lifts)
      if (now - lift.startedAt >= BATH_LIFT_MS) workstations.lifts.delete(id);
    playing = isPlaying;
    for (const [id, motion] of thrownKeys) {
      const pose = sampleThrow(motion.start, motion.end, (now - motion.startTime) / 1000);
      if (pose.contact && !motion.soundPlayed)
        playMotionContact(motion, true, floorSurfaceY(pose.x, pose.z) === RUG_TOP ? 'dropRug' : 'dropWood', playSound);
      if (!pose.landed) continue;
      thrownKeys.delete(id);
    }
    for (const [id, motion] of placingKeys) {
      const pose = samplePlacement(motion.start, motion.end, (now - motion.startTime) / 1000);
      playMotionContact(motion, pose.contact, 'place', playSound);
      if (!pose.landed) continue;
      placingKeys.delete(id);
      refreshCabinet(motion.key.type);
    }
    for (const [id, motion] of discardingKeys) {
      const pose = sampleDiscard(motion.start, motion.end, (now - motion.startTime) / 1000);
      playMotionContact(motion, pose.contact, 'melt', playSound);
      if (!pose.landed) continue;
      discardingKeys.delete(id);
    }
  }
  function refreshCabinet(type) {
    canvasRenderer.refreshCabinet(type);
    candleSet.update(frameTime, cabinets);
  }
  for (let type = 0; type < KEY_TYPES.length; type++) refreshCabinet(type);
  // Canvas does not invoke WebGL's scene update; world matrices must still be
  // initialized so the shared raycaster can hit cabinet and station colliders.
  scene.updateMatrixWorld(true);
  resize();

  return {
    THREE, scene, camera, interactables, cabinets, workstations,
    renderer: { render: () => canvasRenderer.render({
      hovered, carriedKey: workstations.isLifting(carriedKey?.id) ? null : carriedKey,
      pickupLift: samplePickupLift((frameTime - pickupAt) / 1000),
      frameTime, visualSettings, playing, ledgerVisible,
    }) },
    getGeometryStats: () => null,
    getVisualStatus: () => ({ mode: 'canvas', error: '' }),
    setVisualSettings, setLedgerVisible(visible) { ledgerVisible = visible; },
    candles: candleSet.candles, animatePickup() { pickupAt = sceneNow(); }, refreshHand, refreshCabinet, highlight, update, resize,
    animateThrow, animatePlace, animateDiscard, isThrowing, cancelPlace,
    throwingCount: () => thrownKeys.size,
    bounds: { x: 11.12, z: 22.53 },
  };
}
