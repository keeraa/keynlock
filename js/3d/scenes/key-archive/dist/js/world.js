import * as THREE from '../vendor/three.js';
import { createArchiveCandles } from './archive-candles.js';
import { createCleaningEffects } from './cleaning-effects.js';
import { KEY_TYPES, getProgress } from './rules.js';
import { getKeyMaterial } from './key-factory.js';
import { createKeyThumbnailRenderer } from './key-thumbnails.js';
import { createWorldKeyAnimations } from './world-key-animations.js';
import { createWorkstations } from './wash-forge-stations.js';
import { createPaintedRenderer } from './painted-renderer.js';
import { patchSceneShadowHatch, patchShadowHatch, setShadowHatch } from './shadow-hatch.js';
import { createSceneGeometryStatsCache } from './geometry-stats.js';
import { createWindowSky } from './archive-sky.js';
import { windowLightPalette } from './window-light-palette.js';
import { PLAYER_EYE_HEIGHT } from './player-config.js';
import { batchStaticHallMeshes } from './static-mesh-batches.js';
import { createMaterials } from './world-materials.js';
import { addArchiveLedger } from './archive-ledger.js';
import { addArchiveDeskProps } from './archive-desk-props.js';
import { addArchiveRoomProps } from './archive-room-props.js';
import { makeHall } from './world-architecture.js';
import { makeChandeliers } from './world-lighting.js';
import { createCabinet } from './world-cabinet.js';
import { addEntranceLighting, createEntranceContactShadows, createEntranceKeyMaterial, patchArchivePropWindowLight } from './archive-entrance-light.js';
import { WINDOW_LIGHT_POSITION, addWindowAirLight } from './archive-window-rays.js';
import { addWindowBird } from './archive-window-bird.js';
import { addDust } from './world-particles.js';
import { createHeldKeyClearance } from './held-key-clearance.js';
import { createFloorKeys } from './world-floor-keys.js';
import { createWorldHover } from './world-hover.js';
import { createHeldKey } from './held-key.js';
import { createAutoQuality } from './auto-quality.js';
import { createThrowScene } from './throw-scene.js';

const ROOM = { halfWidth: 12, halfLength: 23.4, height: 13.5 };

export function createWorld(canvas, state, visualSettings, keyIndex, stationNow = Date.now, sceneNow = () => performance.now()) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  // Keep counts from every scene/postprocess pass within a single frame.
  renderer.info.autoReset = false;
  // Preserve native Retina detail: the old 1.35 cap enlarged thin key silhouettes.
  const autoQuality = createAutoQuality({ devicePixelRatio: window.devicePixelRatio || 1 });
  let autoQualityEnabled = visualSettings.autoQuality !== false;
  renderer.setPixelRatio(autoQuality.pixelRatio);
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
  const hallParts = makeHall(hall, mat);
  const handObstacles = [];
  const stoolObstacles = [];
  function cacheHandObstacle(mesh) {
    mesh.updateWorldMatrix(true, false);
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    const bounds = mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld);
    if (bounds.min.y > PLAYER_EYE_HEIGHT + 1.6 || bounds.max.y < -.08) return;
    handObstacles.push(bounds.expandByScalar(.018));
  }
  // Solid hall parts as boxes, before static batching merges them: they stop
  // the held key and, above the floor, thrown keys too (columns, trims, doors).
  const hallThrowBoxes = [];
  hall.traverse(object => {
    if (!object.isMesh || object.isInstancedMesh || !object.material?.isMeshStandardMaterial ||
        object.material.transparent) return;
    cacheHandObstacle(object);
    const { min, max } = object.geometry.boundingBox.clone().applyMatrix4(object.matrixWorld);
    if (max.y > .15 && min.y < 4) hallThrowBoxes.push({ min: { x: min.x, y: min.y, z: min.z }, max: { x: max.x, y: max.y, z: max.z } });
  });
  const limitHandReach = createHeldKeyClearance(handObstacles);
  const chandeliers = makeChandeliers(scene, mat);
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
  const workstations = createWorkstations(scene, mat, keyIndex, {
    effects: cleaningEffects,
    stationNow, sceneNow,
    // The key leaves the bath for the hand: glint once it is fully clean.
    onLiftDone: (key, from) => {
      heldKey.startHandFlight(key, from);
      if (!key.mud && !key.rust && !key.wax) heldKey.shineHand(key.id);
    },
  });
  for (const cabinet of cabinets) cacheHandObstacle(cabinet.collider);
  // The held key also pulls back from the candle sconces beside the cabinets.
  for (const collider of candleSet.colliders) cacheHandObstacle(collider);
  for (const occluder of workstations.occluders) cacheHandObstacle(occluder);
  const syncEntranceShadow = createEntranceContactShadows(scene, state.keys);
  const keysById = new Map(state.keys.map(key => [key.id, key]));
  const interactables = [...cabinets.map(cabinet => cabinet.collider), ...workstations.interactables, ...candleSet.colliders, ledger.collider];
  let geometryStatsCache;
  const invalidate = () => geometryStatsCache?.invalidate();
  const floor = createFloorKeys(scene, state.keys, {
    materialFor: type => createEntranceKeyMaterial(getKeyMaterial(type), windowDaylight, windowWarmth, windowBird.shadowUniforms),
    isHidden: id => thrownKeys.has(id),
    onSync: syncEntranceShadow,
  });
  const hover = createWorldHover({ renderer, camera, scene, painted, cabinets, ledger, workstations, keysById });
  const keyAnimations = createWorldKeyAnimations({ scene, camera, cabinets, workstations, sceneNow,
    invalidate, syncKey, refreshCabinet });
  const { thrownKeys, placingKeys, animateThrow, animatePlace, animateDiscard,
    isThrowing, cancelPlace } = keyAnimations;
  const heldKey = createHeldKey({ camera, windowDaylight, windowWarmth, limitHandReach,
    candles: candleSet.candles, cleaningEffects, keyIndex, workstations, sceneNow, invalidate });

  function syncKey(key) {
    invalidate();
    floor.syncKey(key);
  }

  function refreshCabinet(type) {
    invalidate();
    const keys = state.keys.filter(key => key.type === type && key.status === 'sorted');
    const hiding = new Set([...placingKeys.values()].map(motion => motion.key.id));
    cabinets[type].refresh(keys, hiding, getProgress(state).required[type]);
  }
  cabinets.forEach((_, type) => refreshCabinet(type));
  candleSet.update(0, cabinets);
  for (const key of state.keys) syncKey(key);

  // Finished cabinet: a shower of gold stars over its face.
  function celebrateCabinet(type) {
    const cabinet = cabinets[type];
    if (cabinet) cleaningEffects.shine(cabinet.group, 36, { size: .34 });
  }

  // The whole archive is done: the hall warms up and the sealed door to the
  // Hall of Forgotten Doors swings open with light behind it. `instant` is for
  // reopening a finished save (no show, just the open door).
  const baseExposure = renderer.toneMappingExposure;
  let finaleStartedAt = null;
  function startFinale({ instant = false } = {}) {
    if (finaleStartedAt !== null) return;
    finaleStartedAt = instant ? -Infinity : sceneNow();
    if (!instant) cabinets.forEach((_, type) => setTimeout(() => celebrateCabinet(type), 300 + type * 160));
  }
  function updateFinale(now) {
    if (finaleStartedAt === null) return;
    const seconds = (now - finaleStartedAt) / 1000;
    hallParts?.forgottenDoor?.setOpen((seconds - 1.2) / 3.2);
    renderer.toneMappingExposure = baseExposure + .2 * Math.min(1, Math.max(0, seconds / 3));
  }
  if (getProgress(state).processed === state.keys.length) startFinale({ instant: true });

  // What a thrown key can hit: the layout's furniture and vessels, plus the
  // cabinets and candle sconces as boxes (built once, the hall does not move).
  let throwScene = null;
  const throwPropBoxes = [];
  function getThrowScene() {
    if (throwScene) return throwScene;
    const boxOf = mesh => {
      mesh.updateWorldMatrix(true, false);
      if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
      const { min, max } = mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld);
      return { min: { x: min.x, y: min.y, z: min.z }, max: { x: max.x, y: max.y, z: max.z } };
    };
    throwScene = createThrowScene({ hallBoxes: hallThrowBoxes, boxes: [
      ...throwPropBoxes,
      ...cabinets.map(cabinet => boxOf(cabinet.collider)),
      ...candleSet.colliders.filter(collider => collider.userData.id !== 'entrance-candle').map(boxOf),
    ] });
    return throwScene;
  }

  let lastHatchPatch = 0;
  let lastFrame = sceneNow();
  function update(now, moving, playing, playSound) {
    // Newly created objects may bring new materials: give them the hatching too.
    if (now - lastHatchPatch > 1500) { lastHatchPatch = now; patchSceneShadowHatch(scene); }
    const elapsed = Math.max(0, Math.min(.1, (now - lastFrame) / 1000));
    lastFrame = now;
    hover.update(elapsed);
    dust.update(now);
    sky.update(now);
    windowBird.update(now, playing);
    workstations.update(now, playSound);
    keyAnimations.update(now, playSound);
    cabinets.forEach(cabinet => cabinet.update(now));
    candleSet.update(now, cabinets);
    if (elapsed > 0) cleaningEffects.update(elapsed, now);
    updateFinale(now);
    heldKey.update(now, elapsed, moving, playing, playSound);
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
  const birdShadow = windowBird.shadowUniforms;
  function refreshProps(model, bounds, blocksPlayer, { surface = false } = {}) {
    model.traverse(object => {
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        patchArchivePropWindowLight(material, windowDaylight, windowWarmth, birdShadow);
        patchShadowHatch(material);
      }
    });
    if (bounds) handObstacles.push(bounds.clone().expandByScalar(.018));
    if (blocksPlayer) stoolObstacles.push(bounds);
    // Loaded furniture stops thrown keys too: a stool's seat can hold one,
    // books and bottles on a table knock it aside.
    if (bounds) {
      throwPropBoxes.push({ min: { x: bounds.min.x, y: bounds.min.y, z: bounds.min.z },
        max: { x: bounds.max.x, y: bounds.max.y, z: bounds.max.z }, surface: Boolean(blocksPlayer) || surface });
      throwScene = null;
    }
    renderer.shadowMap.needsUpdate = true;
    invalidate();
  }
  void addArchiveDeskProps(scene, refreshProps);
  void addArchiveRoomProps(scene, {
    candles: candleSet.candles, chandeliers, workstations, materials: mat, onPlaced: refreshProps,
    cornerTables: hallParts.cornerTables,
  });

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
      hover.render();
    } }, interactables, cabinets, workstations, floorKeys: floor.floorKeys, candles: candleSet.candles,
    getThrowRelease: heldKey.getThrowRelease, animatePickup: heldKey.animatePickup,
    refreshHand: heldKey.refreshHand, meltHeldWax: heldKey.meltHeldWax, shineHand: heldKey.shineHand,
    syncKey, refreshCabinet, highlight: hover.highlight, update, resize,
    setLedgerVisible(visible) {
      ledger.book.visible = visible;
      if (!visible) hover.hideObject();
    },
    captureKeyThumbnail, getGeometryStats,
    getVisualStatus: painted.getStatus,
    getRenderStats: () => ({ drawCalls: renderer.info.render.calls,
      renderedTriangles: renderer.info.render.triangles,
      passes: painted.getPassCount() + hover.getPassCount() }),
    // Called every rendered frame; returns the new pixel ratio when it drops.
    adaptQuality(now, frameMs, active) {
      if (!autoQualityEnabled) return null;
      const ratio = autoQuality.sample(now, frameMs, active);
      if (ratio) { renderer.setPixelRatio(ratio); resize(); }
      return ratio;
    },
    getPixelRatio: () => renderer.getPixelRatio(),
    setVisualSettings(settings) {
      const enabled = settings.autoQuality !== false;
      if (enabled !== autoQualityEnabled || (!enabled && autoQuality.lowered)) {
        autoQualityEnabled = enabled;
        renderer.setPixelRatio(autoQuality.reset(performance.now()));
        resize();
      }
      applyWindowDaylight(settings);
      patchSceneShadowHatch(scene);
      setShadowHatch(settings.hatchShadows);
      painted.setSettings(settings);
      cabinets.forEach(cabinet => cabinet.setContour(settings));
    },
    animateThrow, animatePlace, animateDiscard, isThrowing, cancelPlace, celebrateCabinet, startFinale, getThrowScene,
    throwingCount: () => thrownKeys.size,
    progress: () => getProgress(state),
    bounds: { x: ROOM.halfWidth - .88, z: ROOM.halfLength - .87, stoolObstacles },
  };
}
