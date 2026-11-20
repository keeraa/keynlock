import * as THREE from '../vendor/three.js';
import { createArchiveCandles, CANDLE_WICK_Y, CANDLE_FLAME_HEIGHT } from './archive-candles.js?v=key-catalog';
import { createCleaningEffects } from './cleaning-effects.js?v=paused-scene';
import { getKeyCoatLayout, buildKeyCoatGeometry, getKeyCoatPoint } from './key-factory.js?v=key-ring';
import { meltWaxBlobs } from './key-wax.js?v=forge-coats';
import { KEY_TYPES, getProgress } from './rules.js?v=key-ring';
import {
  createKeyModel, createCombinedKeyGeometry,
  getKeyMaterial, getKeyCrustGeometry, getKeyCrustMaterial, getKeyRustStrength,
  getKeyDisplayScale, disposeKeySceneModel,
} from './key-factory.js?v=key-ring';
import { createPaintedInstanceGeometry, setKeyInstanceFinish } from './key-instance-finish.js?v=wax-and-bundles';
import { createKeyThumbnailRenderer } from './key-thumbnails.js?v=key-ring';
import { createWorldKeyAnimations } from './world-key-animations.js?v=paused-scene';
import { restingKeyY } from './floor-contact.js';
import { createWorkstations } from './wash-forge-stations.js?v=paused-scene';
import { createPaintedRenderer } from './painted-renderer.js?v=cabinet-rewards';
import { patchSceneShadowHatch, setShadowHatch } from './shadow-hatch.js';
import { createSceneGeometryStatsCache } from './geometry-stats.js';
import { createWindowSky } from './archive-sky.js';
import { windowLightPalette } from './window-light-palette.js';
import { PLAYER_EYE_HEIGHT } from './player-config.js';
import { createKeyHoverOutline } from './key-hover-outline.js?v=readable-ink';
import { batchStaticHallMeshes } from './static-mesh-batches.js';
import { createMaterials } from './world-materials.js?v=shadow-footprints';
import { addArchiveLedger } from './archive-ledger.js?v=key-catalog';
import { makeHall } from './world-architecture.js?v=furniture-shadows';
import { makeChandeliers } from './world-lighting.js?v=key-ring';
import { createCabinet } from './world-cabinet.js?v=paused-scene';
import { addEntranceLighting, createEntranceContactShadows, createEntranceKeyMaterial } from './archive-entrance-light.js?v=alchemy-candles';
import { WINDOW_LIGHT_POSITION, addWindowAirLight, windowBeamLightAt } from './archive-window-rays.js?v=alchemy-candles';
import { addWindowBird } from './archive-window-bird.js?v=paused-scene';
import { addDust } from './world-particles.js?v=alchemy-candles';
import { createHeldKeyClearance } from './held-key-clearance.js';
import { nextHandMotionWeight, samplePickupLift, RIGHT_HAND_RELEASE } from './held-key-motion.js?v=stable-pickup';
import { addHeldKeyWindowLight } from './held-key-light.js?v=clear-day';
import { pegForSlot, CABINET_CELL_INNER_HALF_WIDTH, CABINET_CELL_INNER_HALF_HEIGHT,
  CABINET_CELL_BACK_Z, CABINET_COLUMNS, CABINET_COLUMN_WIDTH, CABINET_GRID_BOTTOM_Y,
  CABINET_GRID_TOP_Y, CABINET_SHELF_CENTER_Z, CABINET_SHELF_DEPTH } from './cabinet-layout.js?v=cabinet-cell-glow';

const ROOM = { halfWidth: 12, halfLength: 23.4, height: 13.5 };

export function createWorld(canvas, state, visualSettings, keyIndex, stationNow = Date.now, sceneNow = () => performance.now()) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  // Keep counts from every scene/postprocess pass within a single frame.
  renderer.info.autoReset = false;
  // Preserve native Retina detail: the old 1.35 cap enlarged thin key silhouettes.
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  // Window geometry is static, so render the costly sunlight shadow map once.
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.37;
  renderer.setClearColor(0x35433d, 1);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x3e4f47);
  scene.fog = new THREE.FogExp2(0x536459, .010);
  const camera = new THREE.PerspectiveCamera(73, 1, .055, 120);
  camera.position.set(0, PLAYER_EYE_HEIGHT, 20.2);
  scene.add(camera);

  scene.add(new THREE.HemisphereLight(0xdce7f5, 0x776052, 1.58));
  const daylight = new THREE.DirectionalLight(0xc7ddff, 3.5);
  daylight.position.set(...WINDOW_LIGHT_POSITION);
  daylight.castShadow = true;
  daylight.shadow.mapSize.set(1536, 1536);
  Object.assign(daylight.shadow.camera, { left: -33, right: 33, top: 33, bottom: -33,
    near: 1, far: 75 });
  daylight.shadow.camera.updateProjectionMatrix();
  daylight.shadow.bias = -.0007;
  daylight.shadow.normalBias = .035;
  daylight.shadow.radius = 3;
  scene.add(daylight);
  const cool = new THREE.DirectionalLight(0xb9c9dc, .43);
  cool.position.set(9, 5, 8);
  scene.add(cool);

  const mat = createMaterials();
  const sky = createWindowSky();
  mat.glass = sky.material;
  const hall = new THREE.Group();
  scene.add(hall);
  makeHall(hall, mat);
  const handObstacles = [];
  function cacheHandObstacle(mesh) {
    mesh.updateWorldMatrix(true, false);
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    const bounds = mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld);
    if (bounds.min.y > PLAYER_EYE_HEIGHT + 1.6 || bounds.max.y < -.08) return;
    handObstacles.push(bounds.expandByScalar(.018));
  }
  hall.traverse(object => {
    if (object.isMesh && !object.isInstancedMesh && object.material?.isMeshStandardMaterial &&
        !object.material.transparent) cacheHandObstacle(object);
  });
  const limitHandReach = createHeldKeyClearance(handObstacles);
  makeChandeliers(hall, mat);
  batchStaticHallMeshes(hall);
  const ledger = addArchiveLedger(scene, mat);
  const windowBird = addWindowBird(scene);
  const setWindowWash = addEntranceLighting(scene, windowBird.shadowUniforms);
  const setWindowAirLight = addWindowAirLight(scene, windowBird.shadowUniforms);
  const dust = addDust(scene);
  const windowDaylight = { value: 0 };
  const windowWarmth = { value: 0 };
  const applyWindowDaylight = settings => {
    const strength = settings.windowDaylight / 100;
    const palette = windowLightPalette(settings.nightLighting);
    windowDaylight.value = strength;
    windowWarmth.value = settings.nightLighting ? 0 : 1;
    daylight.color.setHex(palette.sun);
    sky.setNight(settings.nightLighting);
    mat.windowLight.color.setHex(palette.glow);
    daylight.intensity = 4.3 * strength;
    setWindowWash(strength, palette.wash);
    setWindowAirLight(strength, palette.air);
    dust.setWindowDaylight(strength, palette.dust);
    mat.windowLight.opacity = .035 + .08 * strength;
  };
  applyWindowDaylight(visualSettings);
  // Key Forge's normal/depth outline is part of this single scene-wide pass.
  // 1000 keys remain 20 geometry batches: outlines add no polygon shells.
  const painted = createPaintedRenderer(renderer, scene, camera, visualSettings);
  const cabinets = KEY_TYPES.map((_, index) => createCabinet(scene, index, mat, sceneNow));
  cabinets.forEach(cabinet => cabinet.setContour(visualSettings));
  setShadowHatch(visualSettings.hatchShadows);
  cabinets[0].warmEffects(renderer, camera);
  const candleSet = createArchiveCandles(scene, { drawMeshes: true });
  const cleaningEffects = createCleaningEffects(scene, camera);
  let pendingHandShine = null;
  const workstations = createWorkstations(scene, mat, keyIndex, {
    effects: cleaningEffects,
    stationNow, sceneNow,
    // The key leaves the bath for the hand: glint once it is fully clean.
    onLiftDone: (key, from) => {
      startHandFlight(key, from);
      if (!key.mud && !key.rust && !key.wax) shineHand(key.id);
    },
  });
  for (const cabinet of cabinets) cacheHandObstacle(cabinet.collider);
  for (const occluder of workstations.occluders) cacheHandObstacle(occluder);
  const syncEntranceShadow = createEntranceContactShadows(scene, state.keys);
  const floorKeys = new Map(); // key ID -> its family batch and instance index
  const keysById = new Map(state.keys.map(key => [key.id, key]));
  const keysByType = KEY_TYPES.map(() => []);
  for (const key of state.keys) keysByType[key.type].push(key);
  const interactables = [...cabinets.map(cabinet => cabinet.collider), ...workstations.interactables, ...candleSet.colliders, ledger.collider];
  const floorBatches = KEY_TYPES.map((_, type) => {
    const material = createEntranceKeyMaterial(getKeyMaterial(type), windowDaylight, windowWarmth, windowBird.shadowUniforms);
    // A small depth bias keeps thin metal faces stable against the painted
    // floor during the transition from a flying model to its pooled instance.
    material.polygonOffset = true;
    material.polygonOffsetFactor = -1;
    material.polygonOffsetUnits = -1;
    const healthyKeys = keysByType[type].filter(key => !key.broken);
    const damagedKeys = keysByType[type].filter(key => key.broken);
    const muddyKeys = healthyKeys.filter(key => key.mud);
    const waxedKeys = healthyKeys.filter(key => key.wax);
    const healthy = new THREE.InstancedMesh(
      createPaintedInstanceGeometry(createCombinedKeyGeometry(type), healthyKeys.length),
      material, healthyKeys.length);
    const damaged = new THREE.InstancedMesh(
      createPaintedInstanceGeometry(createCombinedKeyGeometry(type, true), damagedKeys.length),
      material, damagedKeys.length);
    const mudGeometry = getKeyCrustGeometry(type, false, 'mud');
    const mudMaterial = getKeyCrustMaterial('mud');
    const mudCrust = mudGeometry && mudMaterial ?
      new THREE.InstancedMesh(mudGeometry, mudMaterial, muddyKeys.length) : null;
    const waxGeometry = getKeyCrustGeometry(type, false, 'wax');
    const waxCrust = waxGeometry && waxedKeys.length
      ? new THREE.InstancedMesh(waxGeometry, getKeyCrustMaterial('wax'), waxedKeys.length) : null;
    for (const instance of [healthy, damaged, mudCrust, waxCrust].filter(Boolean)) {
      instance.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      instance.frustumCulled = false;
    }
    scene.add(...[healthy, damaged, mudCrust, waxCrust].filter(Boolean));
    keysByType[type].forEach(key => {
      const list = key.broken ? damagedKeys : healthyKeys;
      const visibleIndex = list.indexOf(key);
      floorKeys.set(key.id, { type, broken: key.broken, visibleIndex,
        mudIndex: muddyKeys.indexOf(key), waxIndex: waxedKeys.indexOf(key) });
      const mesh = key.broken ? damaged : healthy;
      mesh.setColorAt(visibleIndex, new THREE.Color().setScalar([.94, 1, .83][key.variation % 3]));
      setKeyInstanceFinish(mesh, visibleIndex, key, getKeyRustStrength(type));
    });
    if (healthy.instanceColor) healthy.instanceColor.needsUpdate = true;
    if (damaged.instanceColor) damaged.instanceColor.needsUpdate = true;
    return { healthy, damaged, mudCrust, waxCrust };
  });
  const keyOutline = new THREE.Mesh(createCombinedKeyGeometry(0));
  keyOutline.raycast = () => {};
  keyOutline.visible = false;
  const hoverOutline = createKeyHoverOutline(renderer, camera, keyOutline);
  // All interactable silhouettes share the same post-render pixel contour as keys.
  const objectMask = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
  objectMask.matrixAutoUpdate = false;
  objectMask.visible = false;
  const objectOutline = createKeyHoverOutline(renderer, camera, objectMask, { depthAware: true });
  const cabinetGridHeight = CABINET_GRID_TOP_Y - CABINET_GRID_BOTTOM_Y;
  const cabinetGridCenterY = CABINET_GRID_BOTTOM_Y + cabinetGridHeight / 2;
  const cabinetGridFrontZ = CABINET_SHELF_CENTER_Z + CABINET_SHELF_DEPTH / 2;
  const cabinetMaskGeometry = new THREE.PlaneGeometry(CABINET_COLUMNS * CABINET_COLUMN_WIDTH, cabinetGridHeight);
  const innerW = CABINET_CELL_INNER_HALF_WIDTH;
  const innerH = CABINET_CELL_INNER_HALF_HEIGHT;
  const cellOutline = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-innerW, -innerH, 0), new THREE.Vector3(innerW, -innerH, 0),
    new THREE.Vector3(innerW, innerH, 0), new THREE.Vector3(-innerW, innerH, 0),
  ]), new THREE.LineBasicMaterial({ color: 0xffe4ad, depthTest: true, depthWrite: false }));
  const cellGlow = new THREE.Mesh(new THREE.PlaneGeometry(innerW * 2, innerH * 2),
    new THREE.MeshBasicMaterial({ color: 0xffdb94, transparent: true, opacity: .17, depthWrite: false }));
  const cellHighlight = new THREE.Group();
  cellHighlight.add(cellGlow, cellOutline);
  cellHighlight.matrixAutoUpdate = false;
  cellHighlight.visible = false;
  scene.add(cellHighlight);
  const dummy = new THREE.Object3D();
  let geometryStatsCache;
  const keyAnimations = createWorldKeyAnimations({ scene, camera, cabinets, workstations, sceneNow,
    invalidate: () => geometryStatsCache?.invalidate(), syncKey, refreshCabinet });
  const { thrownKeys, placingKeys, animateThrow, animatePlace, animateDiscard,
    isThrowing, cancelPlace } = keyAnimations;
  const hand = new THREE.Group();
  hand.position.set(RIGHT_HAND_RELEASE.x, RIGHT_HAND_RELEASE.y, RIGHT_HAND_RELEASE.z);
  camera.add(hand);
  // Soft fill for the key in hand. It sits ~0.4 m from the key, so with
  // physical falloff a strong value washes pale metals (steel, silver) out.
  const handLight = new THREE.PointLight(0xffd6a1, .85, 3);
  handLight.position.set(.3, -.3, -.5);
  camera.add(handLight);
  let displayedHandId = null;
  let handModel = null;
  let disposeHandLight = null;
  const heldKeyDaylight = { value: 0 };
  const handWorldPosition = new THREE.Vector3();
  const carryBounds = new THREE.Box3();
  const carryWorldBounds = new THREE.Box3();
  const carryEye = new THREE.Vector3();
  let handReach = 1;
  let handMotion = 0;
  let pickupAt = -Infinity;
  let hovered = null;
  let keyHoverOpacity = 0;
  let keyHoverTarget = 0;
  let objectHoverOpacity = 0;
  let objectHoverTarget = 0;
  let lastHoverFrame = sceneNow();
  let highlightedShape = '0:false';

  function lightAtHand() {
    hand.getWorldPosition(handWorldPosition);
    const { x, y, z } = handWorldPosition;
    return windowDaylight.value * windowBeamLightAt(x, y, z);
  }

  let displayedHandWax = false;
  function refreshHand(key) {
    if (displayedHandId === (key?.id || null) && displayedHandWax === Boolean(key?.wax)) return;
    displayedHandWax = Boolean(key?.wax);
    if (handModel) {
      hand.remove(handModel);
      disposeHandLight();
      disposeKeySceneModel(handModel);
    }
    if (displayedHandId !== (key?.id || null)) pickupAt = -Infinity;
    displayedHandId = key?.id || null;
    handModel = null;
    geometryStatsCache?.invalidate();
    if (!key) return;
    handModel = createKeyModel(key.type, { id: key.id, scale: getKeyDisplayScale('hand', key.type),
      variation: key.variation, broken: key.broken, mud: key.mud, rust: key.rust, wax: key.wax });
    handModel.rotation.set(-.12, -.34, -.53);
    carryBounds.setFromObject(handModel);
    hand.add(handModel);
    heldKeyDaylight.value = lightAtHand();
    disposeHandLight = addHeldKeyWindowLight(handModel, heldKeyDaylight, windowWarmth);
  }

  // Wax melting over a candle while the player holds the key to the flame.
  // progress 0 restores the full coat; beads fall into the flame meanwhile.
  let waxBeadAt = 0;
  // While wax melts the key leaves the hand and lies flat over the flame,
  // then flies back. `meltPose.blend` eases between the two poses.
  const HAND_POSE = new THREE.Euler(-.12, -.34, -.53);
  const meltPose = { candleId: null, blend: 0 };
  const poseScratch = { quaternion: new THREE.Quaternion(), hand: new THREE.Quaternion(),
    base: new THREE.Quaternion(), target: new THREE.Vector3(), yaw: new THREE.Euler() };
  // A key taken from a bath flies from where it was raised into the hand.
  const HAND_FLIGHT_MS = 420;
  let handFlight = null;
  function startHandFlight(key, from) {
    if (!from) return;
    const position = new THREE.Vector3(), quaternion = new THREE.Quaternion(), scale = new THREE.Vector3();
    from.decompose(position, quaternion, scale);
    handFlight = { keyId: key.id, position, quaternion, scale: scale.x, startedAt: sceneNow() };
  }
  function flyToHand() {
    if (!handFlight || displayedHandId !== handFlight.keyId) { handFlight = null; return false; }
    const t = Math.min(1, (sceneNow() - handFlight.startedAt) / HAND_FLIGHT_MS);
    const ease = 1 - Math.pow(1 - t, 3);
    hand.updateMatrixWorld(true);
    const local = hand.worldToLocal(handFlight.position.clone());
    const handTurn = hand.getWorldQuaternion(new THREE.Quaternion()).invert();
    const localTurn = handTurn.multiply(handFlight.quaternion);
    const localScale = handFlight.scale / hand.getWorldScale(new THREE.Vector3()).x;
    // A small arc on the way, so it reads as a toss rather than a slide.
    handModel.position.copy(local).multiplyScalar(1 - ease);
    handModel.position.y += Math.sin(Math.PI * t) * .08;
    handModel.quaternion.copy(localTurn).slerp(poseScratch.base.setFromEuler(HAND_POSE), ease);
    handModel.scale.setScalar(localScale + (handModel.userData.handScale - localScale) * ease);
    if (t >= 1) handFlight = null;
    return true;
  }

  function placeHeldKey(elapsed) {
    if (!handModel) return;
    handModel.userData.handScale ??= handModel.scale.x;
    if (flyToHand()) return;
    const goal = meltPose.candleId ? 1 : 0;
    meltPose.blend += (goal - meltPose.blend) * (1 - Math.exp(-elapsed / .12));
    if (Math.abs(goal - meltPose.blend) < .002) meltPose.blend = goal;
    poseScratch.base.setFromEuler(HAND_POSE);
    const candle = candleSet.candles.find(item => item.id === meltPose.lastCandleId);
    // The flame gutters while the wax over it melts.
    candle?.disturb?.(meltPose.candleId ? meltPose.blend : 0);
    if (!candle || meltPose.blend <= 0) {
      handModel.position.set(0, 0, 0);
      handModel.quaternion.copy(poseScratch.base);
      handModel.scale.setScalar(handModel.userData.handScale);
      return;
    }
    // Target: flat, face up, lying across the view (head left, teeth right).
    // The wax sits in the tip of the flame.
    poseScratch.target.set(candle.x, candle.y + CANDLE_WICK_Y + CANDLE_FLAME_HEIGHT * .8, candle.z);
    camera.getWorldQuaternion(poseScratch.quaternion);
    poseScratch.yaw.setFromQuaternion(poseScratch.quaternion, 'YXZ');
    // Slide the key back and forth along its length, so the flame passes
    // under the wax from the head to the teeth.
    const sweep = Math.sin(sceneNow() * .0042) * .14 * meltPose.blend;
    poseScratch.target.x += Math.cos(poseScratch.yaw.y) * sweep;
    poseScratch.target.z -= Math.sin(poseScratch.yaw.y) * sweep;
    hand.updateMatrixWorld(true);
    const local = hand.worldToLocal(poseScratch.target.clone());
    // Yaw +90°: the key's length runs left to right in front of the player.
    const flat = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, poseScratch.yaw.y + Math.PI / 2, 0, 'YXZ'));
    hand.getWorldQuaternion(poseScratch.hand);
    const localTurn = poseScratch.hand.invert().multiply(flat);
    const t = meltPose.blend * meltPose.blend * (3 - 2 * meltPose.blend);
    handModel.position.set(0, 0, 0).lerp(local, t);
    handModel.quaternion.copy(poseScratch.base).slerp(localTurn, t);
    // A little smaller over the small candle than up close in the hand.
    handModel.scale.setScalar(handModel.userData.handScale * (1 - .3 * t));
  }

  function meltHeldWax(progress, candleId, { restoreCoat = true } = {}) {
    meltPose.candleId = progress > 0 && candleId ? candleId : null;
    if (meltPose.candleId) meltPose.lastCandleId = meltPose.candleId;
    if (!restoreCoat && !meltPose.candleId) return;
    // The held model wears per-model material copies: find the wax by its tag.
    const crust = handModel?.children.find(child => child.isMesh && child.userData.coatKind === 'wax');
    if (!crust) return;
    const key = keyIndex.get(displayedHandId);
    if (!key) return;
    crust.userData.fullCoat ??= crust.geometry;
    const now = sceneNow();
    if (!(progress > 0)) {
      releaseMelt(crust);
      crust.geometry = crust.userData.fullCoat;
      return;
    }
    // Heat builds up only on the wax right above the flame, so the pool the
    // flame is under melts while the rest waits for its turn.
    if (melt.keyId !== key.id) {
      releaseMelt(crust);
      const layout = getKeyCoatLayout(key.type, key.broken, 'wax') || [];
      Object.assign(melt, { keyId: key.id, layout, heat: new Float32Array(layout.length),
        points: layout.map(blob => getKeyCoatPoint(key.type, key.broken, blob.x, blob.y, 0)),
        reach: layout.map(blob => Math.max(blob.rx, blob.ry)), last: now, built: 0 });
    }
    const dt = Math.min(.1, (now - melt.last) / 1000);
    melt.last = now;
    const candle = candleSet.candles.find(item => item.id === candleId);
    if (!candle || !melt.layout.length) return;
    crust.updateMatrixWorld(true);
    const flame = crust.worldToLocal(new THREE.Vector3(candle.x,
      candle.y + CANDLE_WICK_Y + CANDLE_FLAME_HEIGHT * .6, candle.z));
    const scale = getKeyCoatPoint(key.type, key.broken, 1, 0, 0)
      ?.distanceTo(getKeyCoatPoint(key.type, key.broken, 0, 0, 0)) || .3;
    let hottest = -1, hottestRate = 0;
    melt.layout.forEach((blob, index) => {
      const point = melt.points[index];
      if (!point) return;
      // Distance in the key's plane, measured in Forge units.
      const distance = Math.hypot(point.x - flame.x, point.y - flame.y) / scale;
      const rate = 1.5 * Math.exp(-Math.pow(distance / (.35 + melt.reach[index]), 2));
      melt.heat[index] = Math.min(1, melt.heat[index] + rate * dt);
      if (rate > hottestRate && melt.heat[index] < 1) { hottest = index; hottestRate = rate; }
    });
    // The rules finish melting on a timer; make sure nothing is left by then.
    const catchUp = Math.max(0, progress * 1.6 - .6);
    const melted = blob => Math.min(1, melt.heat[melt.layout.indexOf(blob)] + catchUp);
    if (now - melt.built > 60) {
      melt.built = now;
      const blobs = meltWaxBlobs(melt.layout, melted, { sag: false });
      if (melt.geometry) melt.geometry.dispose();
      melt.geometry = buildKeyCoatGeometry(key.type, key.broken, 'wax', { blobs, heightScale: 1 - .35 * progress });
      crust.geometry = melt.geometry;
    }
    // Beads drip from the pool that is melting right now.
    if (hottest >= 0 && hottestRate > .25 && now - waxBeadAt > 150) {
      waxBeadAt = now;
      const blob = melt.layout[hottest];
      const local = getKeyCoatPoint(key.type, key.broken, blob.x + (Math.random() - .5) * blob.rx,
        blob.y + (Math.random() - .5) * blob.ry, -.02);
      if (local) cleaningEffects.drop('wax', crust.localToWorld(local), .007 + Math.random() * .006,
        candle.y + CANDLE_WICK_Y + .05);
    }
  }
  const melt = { keyId: null, geometry: null };
  function releaseMelt(crust) {
    if (melt.geometry && crust?.geometry === melt.geometry) crust.geometry = crust.userData.fullCoat;
    melt.geometry?.dispose();
    Object.assign(melt, { keyId: null, geometry: null });
  }
  function shineHand(keyId) { pendingHandShine = keyId; }

  function syncKey(key) {
    geometryStatsCache?.invalidate();
    const instance = floorKeys.get(key.id);
    if (!instance) return;
    const batch = floorBatches[instance.type];
    const mesh = instance.broken ? batch.damaged : batch.healthy;
    const visible = key.status === 'floor' && !thrownKeys.has(key.id);
    syncEntranceShadow(key, visible);
    const restingY = restingKeyY(key.x, key.z) + (key.layer || 0);
    dummy.position.set(key.x, restingY, key.z);
    dummy.rotation.set(-Math.PI / 2, key.rotation, 0, 'YXZ');
    dummy.scale.setScalar(visible ? getKeyDisplayScale('floor', key.type) : .000001);
    dummy.updateMatrix();
    mesh.setMatrixAt(instance.visibleIndex, dummy.matrix);
    mesh.instanceMatrix.needsUpdate = true;
    setKeyInstanceFinish(mesh, instance.visibleIndex, key, getKeyRustStrength(key.type));
    const floorScale = getKeyDisplayScale('floor', key.type);
    if (batch.mudCrust && instance.mudIndex >= 0) {
      dummy.position.set(key.x, restingY, key.z);
      dummy.rotation.set(-Math.PI / 2, key.rotation, 0, 'YXZ');
      dummy.scale.setScalar(visible && key.mud && !key.wax ? floorScale : .000001);
      dummy.updateMatrix();
      batch.mudCrust.setMatrixAt(instance.mudIndex, dummy.matrix);
      batch.mudCrust.instanceMatrix.needsUpdate = true;
    }
    if (batch.waxCrust && instance.waxIndex >= 0) {
      dummy.scale.setScalar(visible && key.wax ? floorScale : .000001);
      dummy.updateMatrix();
      batch.waxCrust.setMatrixAt(instance.waxIndex, dummy.matrix);
      batch.waxCrust.instanceMatrix.needsUpdate = true;
    }
  }

  function refreshCabinet(type) {
    geometryStatsCache?.invalidate();
    const keys = state.keys.filter(key => key.type === type && key.status === 'sorted');
    const hiding = new Set([...placingKeys.values()].map(motion => motion.key.id));
    cabinets[type].refresh(keys, hiding, getProgress(state).required[type]);
  }
  cabinets.forEach((_, type) => refreshCabinet(type));
  candleSet.update(0, cabinets);
  for (const key of state.keys) syncKey(key);

  let hoverAnchor = null;
  let outlinedKeyId = null;
  function highlight(target) {
    hovered = target;
    hoverAnchor = null;
    const interactive = target?.kind === 'cabinet' || target?.kind === 'bath' || target?.kind === 'forge' || target?.kind === 'ledger';
    objectHoverTarget = interactive ? (target.kind === 'cabinet' ? .74 : 1) : 0;
    cellHighlight.visible = false;
    if (interactive) {
      if (target.kind === 'cabinet') {
        const cabinet = cabinets[target.type];
        cabinet.group.updateWorldMatrix(true, false);
        // Match the plane of the shelf fronts so the frame stays on the grid.
        objectMask.matrix.copy(cabinet.group.matrixWorld)
          .multiply(new THREE.Matrix4().makeTranslation(0, cabinetGridCenterY, cabinetGridFrontZ));
        objectMask.geometry = cabinetMaskGeometry;
        if (Number.isInteger(target.slot)) {
          const peg = pegForSlot(target.slot);
          cellHighlight.matrix.copy(cabinet.group.matrixWorld)
            .multiply(new THREE.Matrix4().makeTranslation(peg.x, peg.y, CABINET_CELL_BACK_Z + .002));
          cellHighlight.matrixWorldNeedsUpdate = true;
          cellHighlight.visible = true;
        }
      } else if (target.kind === 'ledger') {
        ledger.collider.updateWorldMatrix(true, false);
        objectMask.matrix.copy(ledger.collider.matrixWorld);
        objectMask.matrixWorldNeedsUpdate = true;
        objectMask.geometry = ledger.collider.geometry;
      } else {
        const surface = workstations.getHoverSurface(target);
        if (!surface) { objectHoverTarget = 0; return; }
        surface.anchor.updateWorldMatrix(true, false);
        objectMask.matrix.copy(surface.anchor.matrixWorld);
        objectMask.geometry = surface.geometry;
        // A key in a bath bobs and dips: its outline follows it every frame.
        hoverAnchor = target.keyId ? surface.anchor : null;
      }
    }
    keyHoverTarget = target?.kind === 'key' ? 1 : 0;
    outlinedKeyId = keyHoverTarget ? target.id : outlinedKeyId;
    if (keyHoverTarget) {
      const key = keysById.get(target.id);
      if (key) {
        const shape = `${key.type}:${key.broken}`;
        if (shape !== highlightedShape) {
          highlightedShape = shape;
          // The outline borrows the factory geometry shared by the floor batches.
          keyOutline.geometry = createCombinedKeyGeometry(key.type, key.broken);
        }
        // Exact geometry mask: its screen-space outer edge also traces holes.
        keyOutline.position.set(key.x, restingKeyY(key.x, key.z) + (key.layer || 0), key.z);
        keyOutline.rotation.set(-Math.PI / 2, key.rotation, 0, 'YXZ');
        keyOutline.scale.setScalar(getKeyDisplayScale('floor', key.type));
      } else {
        keyHoverTarget = 0;
      }
    }
  }

  let lastHatchPatch = 0;
  function update(now, moving, playing, playSound) {
    // Newly created objects may bring new materials: give them the hatching too.
    if (now - lastHatchPatch > 1500) { lastHatchPatch = now; patchSceneShadowHatch(scene); }
    const elapsed = Math.max(0, Math.min(.1, (now - lastHoverFrame) / 1000));
    lastHoverFrame = now;
    const hoverFactor = 1 - Math.exp(-elapsed / .15);
    keyHoverOpacity += (keyHoverTarget - keyHoverOpacity) * hoverFactor;
    objectHoverOpacity += (objectHoverTarget - objectHoverOpacity) * hoverFactor;
    // A picked-up key leaves the floor at once: drop its outline without the fade.
    if (outlinedKeyId && keysById.get(outlinedKeyId)?.status !== 'floor') {
      keyHoverOpacity = 0;
      outlinedKeyId = null;
    }
    keyOutline.visible = keyHoverOpacity > .005;
    objectMask.visible = objectHoverOpacity > .005;
    if (hoverAnchor?.parent) {
      hoverAnchor.updateWorldMatrix(true, false);
      objectMask.matrix.copy(hoverAnchor.matrixWorld);
      objectMask.matrixWorldNeedsUpdate = true;
    }
    dust.update(now);
    sky.update(now);
    windowBird.update(now, playing);
    workstations.update(now, playSound);
    keyAnimations.update(now, playSound);
    cabinets.forEach(cabinet => cabinet.update(now));
    candleSet.update(now, cabinets);
    if (elapsed > 0) cleaningEffects.update(elapsed, now);
    if (pendingHandShine !== displayedHandId) pendingHandShine = null;
    if (playing && pendingHandShine !== null && handModel && hand.visible && !handFlight) {
      pendingHandShine = null;
      cleaningEffects.shine(handModel, 5, { attachTo: hand });
      playSound?.('keyShine', camera.position);
    }
    if (handModel) {
      hand.visible = !workstations.isLifting(displayedHandId);
      // Blend walk sway in over several frames: an instant amplitude change
      // on the first step looked like a one-frame key flicker.
      handMotion = nextHandMotionWeight(handMotion, moving, elapsed);
      hand.rotation.z = Math.sin(now * .0031) * (.012 + handMotion * .033);
      const pickupOffset = .12 * samplePickupLift((now - pickupAt) / 1000);
      hand.position.set(RIGHT_HAND_RELEASE.x,
        RIGHT_HAND_RELEASE.y + Math.sin(now * .0029) * (.012 + handMotion * .023) - pickupOffset,
        RIGHT_HAND_RELEASE.z);
      hand.scale.setScalar(1);
      if (!handFlight && !meltPose.candleId && meltPose.blend === 0) {
        hand.updateWorldMatrix(true, false);
        carryEye.setFromMatrixPosition(camera.matrixWorld);
        carryWorldBounds.copy(carryBounds).applyMatrix4(hand.matrixWorld);
        const safeReach = limitHandReach(carryEye, carryWorldBounds);
        handReach = Math.min(safeReach, handReach + elapsed * 4.5);
        hand.position.multiplyScalar(handReach);
        hand.scale.setScalar(handReach);
      } else handReach = 1;
      handLight.position.set(.3 * handReach, -.3 * handReach, -.5 * handReach);
      handLight.intensity = .85 * handReach * handReach;
      heldKeyDaylight.value += (lightAtHand() - heldKeyDaylight.value) * (1 - Math.exp(-elapsed / .065));
      placeHeldKey(elapsed);
    } else {
      handMotion = 0;
      handReach = 1;
      handLight.position.set(.3, -.3, -.5);
      handLight.intensity = .85;
      // Nothing held any more: a flame left mid-melt calms down.
      if (meltPose.lastCandleId) candleSet.candles.find(item => item.id === meltPose.lastCandleId)?.disturb?.(0);
    }
  }

  function resize() {
    const width = Math.max(1, canvas.clientWidth);
    const height = Math.max(1, canvas.clientHeight);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    painted.resize();
  }
  resize();
  geometryStatsCache = createSceneGeometryStatsCache(scene);
  window.addEventListener('resize', resize);

  let thumbnailRenderer;
  function captureKeyThumbnail(key) {
    thumbnailRenderer ||= createKeyThumbnailRenderer(renderer);
    return thumbnailRenderer.capture(key);
  }
  function getGeometryStats() {
    return geometryStatsCache.get();
  }

  return {
    THREE, scene, camera, renderer: { render() {
      painted.render();
      const dustCoverage = painted.getDustCoverage();
      try { hoverOutline.render(keyHoverOpacity, dustCoverage); }
      catch (error) { console.warn('KEYNLOCK: hover silhouette unavailable', error); }
      // A key in a bath is outlined whole, even the part under the liquid.
      try { objectOutline.render(objectHoverOpacity, hoverAnchor ? null : dustCoverage, painted.getSceneDepth()); }
      catch (error) { console.warn('KEYNLOCK: object silhouette unavailable', error); }
    } }, interactables, cabinets, workstations, floorKeys, candles: candleSet.candles,
    getThrowRelease() { return hand.getWorldPosition(new THREE.Vector3()); },
    animatePickup() { pickupAt = sceneNow(); }, refreshHand, syncKey, refreshCabinet, highlight, update, resize, meltHeldWax, shineHand,
    setLedgerVisible(visible) {
      ledger.book.visible = visible;
      if (!visible) objectHoverOpacity = 0;
    },
    captureKeyThumbnail, getGeometryStats,
    getVisualStatus: painted.getStatus,
    getRenderStats: () => ({ drawCalls: renderer.info.render.calls,
      renderedTriangles: renderer.info.render.triangles,
      passes: painted.getPassCount() + hoverOutline.getPassCount() + objectOutline.getPassCount() }),
    setVisualSettings(settings) {
      applyWindowDaylight(settings);
      patchSceneShadowHatch(scene);
      setShadowHatch(settings.hatchShadows);
      painted.setSettings(settings);
      cabinets.forEach(cabinet => cabinet.setContour(settings));
    },
    animateThrow, animatePlace, animateDiscard, isThrowing, cancelPlace,
    throwingCount: () => thrownKeys.size,
    progress: () => getProgress(state),
    bounds: { x: ROOM.halfWidth - .88, z: ROOM.halfLength - .87 },
  };
}
