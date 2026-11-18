import * as THREE from '../vendor/three.js';
import { KEY_TYPES, KEYS_PER_TYPE } from './rules.js?v=23';
import { createFallbackSurfaces } from './fallback-surfaces.js';
import { createFallbackCanvasRenderer } from './fallback-canvas-renderer.js?v=2';
import { getKeyColliderSize } from './key-factory.js?v=3';
import { sampleThrow } from './throw-physics.js';
import { findFloorKeyAtReticle } from './key-picking.js?v=2';
import { CABINET_Z, CABINET_GROUND_OFFSET, pegForSlot } from './cabinet-layout.js?v=21';
import { STATIONS, FIXTURE_OFFSETS, bathId } from './station-layout.js?v=2';
import { restingKeyY } from './floor-contact.js';
import { PLAYER_EYE_HEIGHT } from './player-config.js';

// A lightweight first-person perspective renderer for browsers that disable WebGL.
// All picking and game rules still use the same Three.js world coordinates.
export function createFallbackWorld(canvas, state, initialVisualSettings) {
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Не удалось инициализировать 2D- или 3D-графику.');
  const surfaces = createFallbackSurfaces(ctx);
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

  const colliderMaterial = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 });
  const dummy = new THREE.Object3D();
  const keyColliders = KEY_TYPES.map((_, type) => {
    const collider = new THREE.InstancedMesh(
      new THREE.BoxGeometry(...getKeyColliderSize(type).map(size => size * .72)), colliderMaterial, KEYS_PER_TYPE);
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

  const canvasRenderer = createFallbackCanvasRenderer({
    ctx, scene, camera, surfaces, state, cabinets, workstations,
    thrownKeys, placingKeys, discardingKeys, cabinetHover, fixtureHover, keyHover,
  });

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
  function animateDiscard(key, stationId = 'center') {
    camera.updateMatrixWorld(true);
    const start = camera.localToWorld(new THREE.Vector3(.42, -.37, -.84));
    const station = workstations.stations.find(item => item.id === stationId) || workstations.stations[0];
    station.forge.impactAt = performance.now() + 440;
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
  function refreshCabinet(type) { canvasRenderer.refreshCabinet(type); }
  for (const key of state.keys) syncKey(key);
  for (let type = 0; type < KEY_TYPES.length; type++) refreshCabinet(type);
  resize();

  return {
    THREE, scene, camera, interactables, cabinets, workstations,
    renderer: { render: () => canvasRenderer.render({ hovered, carriedKey, frameTime, visualSettings }) },
    getGeometryStats: () => null,
    getVisualStatus: () => ({ mode: 'canvas', error: '' }),
    setVisualSettings,
    refreshHand, syncKey, refreshCabinet, highlight, update, resize,
    keyIdFromHit, animateThrow, animatePlace, animateDiscard, isThrowing, pickTarget, throwingCount: () => thrownKeys.size,
    bounds: { x: 11.12, z: 22.53 },
  };
}
