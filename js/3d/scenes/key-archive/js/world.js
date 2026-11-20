import * as THREE from '../vendor/three.js';
import { getWaxMaterial } from './key-dirt.js?v=wax-and-bundles';
import { createArchiveCandles } from './archive-candles.js?v=candlelight';
import { KEY_TYPES, getProgress } from './rules.js?v=key-ring';
import {
  createKeyModel, createCombinedKeyGeometry,
  getKeyMaterial, getKeyCrustGeometry, getKeyCrustMaterial, getKeyRustStrength,
  getKeyDisplayScale, disposeKeySceneModel,
} from './key-factory.js?v=key-ring';
import { createPaintedInstanceGeometry, setKeyInstanceFinish } from './key-instance-finish.js?v=wax-and-bundles';
import { createKeyThumbnailRenderer } from './key-thumbnails.js?v=key-ring';
import { createWorldKeyAnimations } from './world-key-animations.js?v=key-ring';
import { restingKeyY } from './floor-contact.js';
import { createWorkstations } from './wash-forge-stations.js?v=cleaning-cues';
import { createPaintedRenderer } from './painted-renderer.js?v=cabinet-rewards';
import { createSceneGeometryStatsCache } from './geometry-stats.js';
import { windowLightPalette } from './window-light-palette.js';
import { PLAYER_EYE_HEIGHT } from './player-config.js';
import { createKeyHoverOutline } from './key-hover-outline.js?v=readable-ink';
import { batchStaticHallMeshes } from './static-mesh-batches.js';
import { createMaterials } from './world-materials.js?v=key-ring';
import { makeHall } from './world-architecture.js?v=key-ring';
import { makeChandeliers } from './world-lighting.js?v=key-ring';
import { createCabinet } from './world-cabinet.js?v=key-ring';
import { addEntranceLighting, createEntranceContactShadows, createEntranceKeyMaterial } from './archive-entrance-light.js?v=alchemy-candles';
import { WINDOW_LIGHT_POSITION, addWindowAirLight, windowBeamLightAt } from './archive-window-rays.js?v=alchemy-candles';
import { addWindowBird } from './archive-window-bird.js?v=alchemy-candles';
import { addDust } from './world-particles.js?v=alchemy-candles';
import { nextHandMotionWeight } from './held-key-motion.js';
import { addHeldKeyWindowLight } from './held-key-light.js?v=clear-day';
import { pegForSlot, CABINET_CELL_INNER_HALF_WIDTH, CABINET_CELL_INNER_HALF_HEIGHT,
  CABINET_CELL_BACK_Z, CABINET_COLUMNS, CABINET_COLUMN_WIDTH, CABINET_GRID_BOTTOM_Y,
  CABINET_GRID_TOP_Y, CABINET_SHELF_CENTER_Z, CABINET_SHELF_DEPTH } from './cabinet-layout.js?v=cabinet-cell-glow';

const ROOM = { halfWidth: 12, halfLength: 23.4, height: 13.5 };

export function createWorld(canvas, state, visualSettings, keyIndex) {
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
  const hall = new THREE.Group();
  scene.add(hall);
  makeHall(hall, mat);
  makeChandeliers(hall, mat);
  batchStaticHallMeshes(hall);
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
    mat.glass.color.setHex(palette.glass);
    mat.windowLight.color.setHex(palette.glow);
    daylight.intensity = 4.3 * strength;
    setWindowWash(strength, palette.wash);
    setWindowAirLight(strength, palette.air);
    dust.setWindowDaylight(strength, palette.dust);
    mat.windowLight.opacity = .05 + .16 * strength;
  };
  applyWindowDaylight(visualSettings);
  // Key Forge's normal/depth outline is part of this single scene-wide pass.
  // 1000 keys remain 20 geometry batches: outlines add no polygon shells.
  const painted = createPaintedRenderer(renderer, scene, camera, visualSettings);
  const cabinets = KEY_TYPES.map((_, index) => createCabinet(scene, index, mat));
  cabinets.forEach(cabinet => cabinet.setContour(visualSettings));
  cabinets[0].warmEffects(renderer, camera);
  const candleSet = createArchiveCandles(scene, { drawMeshes: true });
  const workstations = createWorkstations(scene, mat, keyIndex);
  const syncEntranceShadow = createEntranceContactShadows(scene, state.keys);
  const floorKeys = new Map(); // key ID -> its family batch and instance index
  const keysById = new Map(state.keys.map(key => [key.id, key]));
  const keysByType = KEY_TYPES.map(() => []);
  for (const key of state.keys) keysByType[key.type].push(key);
  const interactables = [...cabinets.map(cabinet => cabinet.collider), ...workstations.interactables, ...candleSet.colliders];
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
    const crustGeometry = getKeyCrustGeometry(type);
    const crustMaterial = getKeyCrustMaterial();
    const mudCrust = crustGeometry && crustMaterial ?
      new THREE.InstancedMesh(crustGeometry, crustMaterial, muddyKeys.length) : null;
    const waxCrust = crustGeometry && waxedKeys.length
      ? new THREE.InstancedMesh(crustGeometry, getWaxMaterial(), waxedKeys.length) : null;
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
  const keyAnimations = createWorldKeyAnimations({ scene, camera, cabinets, workstations,
    invalidate: () => geometryStatsCache?.invalidate(), syncKey, refreshCabinet });
  const { thrownKeys, placingKeys, animateThrow, animatePlace, animateDiscard,
    isThrowing, cancelPlace } = keyAnimations;
  const hand = new THREE.Group();
  hand.position.set(.43, -.45, -.82);
  camera.add(hand);
  const handLight = new THREE.PointLight(0xffd6a1, 1.7, 3);
  handLight.position.set(.3, -.3, -.5);
  camera.add(handLight);
  let displayedHandId = null;
  let handModel = null;
  let disposeHandLight = null;
  const heldKeyDaylight = { value: 0 };
  const handWorldPosition = new THREE.Vector3();
  let handMotion = 0;
  let hovered = null;
  let keyHoverOpacity = 0;
  let keyHoverTarget = 0;
  let objectHoverOpacity = 0;
  let objectHoverTarget = 0;
  let lastHoverFrame = performance.now();
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
    displayedHandId = key?.id || null;
    handModel = null;
    geometryStatsCache?.invalidate();
    if (!key) return;
    handModel = createKeyModel(key.type, { id: key.id, scale: getKeyDisplayScale('hand', key.type),
      variation: key.variation, broken: key.broken, mud: key.mud, rust: key.rust, wax: key.wax });
    handModel.rotation.set(-.12, -.34, -.53);
    hand.add(handModel);
    heldKeyDaylight.value = lightAtHand();
    disposeHandLight = addHeldKeyWindowLight(handModel, heldKeyDaylight, windowWarmth);
  }

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

  function highlight(target) {
    hovered = target;
    const interactive = target?.kind === 'cabinet' || target?.kind === 'bath' || target?.kind === 'forge';
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
      } else {
        const surface = workstations.getHoverSurface(target);
        if (!surface) { objectHoverTarget = 0; return; }
        surface.anchor.updateWorldMatrix(true, false);
        objectMask.matrix.copy(surface.anchor.matrixWorld);
        objectMask.geometry = surface.geometry;
      }
    }
    keyHoverTarget = target?.kind === 'key' ? 1 : 0;
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

  function update(now, moving, playing, playSound) {
    const elapsed = Math.max(0, Math.min(.1, (now - lastHoverFrame) / 1000));
    lastHoverFrame = now;
    const hoverFactor = 1 - Math.exp(-elapsed / .15);
    keyHoverOpacity += (keyHoverTarget - keyHoverOpacity) * hoverFactor;
    objectHoverOpacity += (objectHoverTarget - objectHoverOpacity) * hoverFactor;
    keyOutline.visible = keyHoverOpacity > .005;
    objectMask.visible = objectHoverOpacity > .005;
    dust.update(now);
    windowBird.update(now, playing);
    workstations.update(now);
    keyAnimations.update(now, playSound);
    cabinets.forEach(cabinet => cabinet.update(now));
    candleSet.update(now, cabinets);
    if (handModel) {
      hand.visible = !workstations.isLifting(displayedHandId);
      // Blend walk sway in over several frames: an instant amplitude change
      // on the first step looked like a one-frame key flicker.
      handMotion = nextHandMotionWeight(handMotion, moving, elapsed);
      hand.rotation.z = Math.sin(now * .0031) * (.012 + handMotion * .033);
      hand.position.y = -.45 + Math.sin(now * .0029) * (.012 + handMotion * .023);
      heldKeyDaylight.value += (lightAtHand() - heldKeyDaylight.value) * (1 - Math.exp(-elapsed / .065));
    } else {
      handMotion = 0;
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
      try { objectOutline.render(objectHoverOpacity, dustCoverage, painted.getSceneDepth()); }
      catch (error) { console.warn('KEYNLOCK: object silhouette unavailable', error); }
    } }, interactables, cabinets, workstations, floorKeys, candles: candleSet.candles,
    refreshHand, syncKey, refreshCabinet, highlight, update, resize,
    captureKeyThumbnail, getGeometryStats,
    getVisualStatus: painted.getStatus,
    getRenderStats: () => ({ drawCalls: renderer.info.render.calls,
      renderedTriangles: renderer.info.render.triangles,
      passes: painted.getPassCount() + hoverOutline.getPassCount() + objectOutline.getPassCount() }),
    setVisualSettings(settings) {
      applyWindowDaylight(settings);
      painted.setSettings(settings);
      cabinets.forEach(cabinet => cabinet.setContour(settings));
    },
    animateThrow, animatePlace, animateDiscard, isThrowing, cancelPlace,
    throwingCount: () => thrownKeys.size,
    progress: () => getProgress(state),
    bounds: { x: ROOM.halfWidth - .88, z: ROOM.halfLength - .87 },
  };
}
