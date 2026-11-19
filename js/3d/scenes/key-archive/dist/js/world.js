import * as THREE from '../vendor/three.js';
import { KEY_TYPES, KEYS_PER_TYPE, getProgress } from './rules.js?v=23';
import {
  createKeyModel, createCombinedKeyGeometry,
  getKeyMaterial, getKeyCrustGeometry, getKeyCrustMaterial, getKeyRustStrength,
  getKeyDisplayScale, disposeKeySceneModel,
} from './key-factory.js?v=3';
import { createPaintedInstanceGeometry, setKeyInstanceFinish } from './key-instance-finish.js';
import { createKeyThumbnailRenderer } from './key-thumbnails.js';
import { createWorldKeyAnimations } from './world-key-animations.js';
import { restingKeyY } from './floor-contact.js';
import { createWorkstations } from './wash-forge-stations.js?v=24';
import { createPaintedRenderer } from './painted-renderer.js?v=25';
import { createSceneGeometryStatsCache } from './geometry-stats.js';
import { createWetSnow } from './wet-snow.js?v=21';
import { PLAYER_EYE_HEIGHT } from './player-config.js';
import { createKeyHoverOutline } from './key-hover-outline.js';
import { createMaterials } from './world-materials.js';
import { makeHall } from './world-architecture.js?v=5';
import { makeChandeliers } from './world-lighting.js';
import { createCabinet } from './world-cabinet.js?v=5';
import { addDust } from './world-particles.js';
import { nextHandMotionWeight } from './held-key-motion.js';
import { KEY_PICK_HALF_LENGTH, KEY_PICK_RADIUS } from './interaction-range.js';

const ROOM = { halfWidth: 12, halfLength: 23.4, height: 11.25 };

export function createWorld(canvas, state, visualSettings) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  // Keep counts from every scene/postprocess pass within a single frame.
  renderer.info.autoReset = false;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.35));
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

  scene.add(new THREE.HemisphereLight(0xe8e9e0, 0x625c55, 2.05));
  const daylight = new THREE.DirectionalLight(0xf0e6d5, 3.5);
  daylight.position.set(-19, 17, -6);
  daylight.castShadow = true;
  daylight.shadow.mapSize.set(1536, 1536);
  Object.assign(daylight.shadow.camera, { left: -33, right: 33, top: 33, bottom: -33,
    near: 1, far: 75 });
  daylight.shadow.camera.updateProjectionMatrix();
  daylight.shadow.bias = -.0007;
  daylight.shadow.normalBias = .035;
  daylight.shadow.radius = 3;
  scene.add(daylight);
  const cool = new THREE.DirectionalLight(0xb9c4bf, .65);
  cool.position.set(9, 5, 8);
  scene.add(cool);

  const mat = createMaterials();
  const snow = createWetSnow();
  const hall = new THREE.Group();
  scene.add(hall);
  makeHall(hall, mat, snow);
  makeChandeliers(hall, mat);
  const applyWindowDaylight = settings => {
    const strength = settings.windowDaylight / 100;
    daylight.intensity = 3.9 * strength;
    mat.windowLight.opacity = .05 + .16 * strength;
  };
  applyWindowDaylight(visualSettings);
  const dust = addDust(scene);
  // Key Forge's normal/depth outline is part of this single scene-wide pass.
  // 1000 keys remain 20 geometry batches: outlines add no polygon shells.
  const painted = createPaintedRenderer(renderer, scene, camera, visualSettings);
  snow.setSettings(visualSettings);
  const cabinets = KEY_TYPES.map((_, index) => createCabinet(scene, index, mat));
  const workstations = createWorkstations(scene, mat, state);
  const floorKeys = new Map(); // key ID -> its family batch and instance index
  const keysById = new Map(state.keys.map(key => [key.id, key]));
  const keysByType = KEY_TYPES.map(() => []);
  for (const key of state.keys) keysByType[key.type].push(key);
  const interactables = [...cabinets.map(cabinet => cabinet.collider), ...workstations.interactables];
  const colliderMaterial = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
  const floorBatches = KEY_TYPES.map((family, type) => {
    // Pick against the whole physical key, including its bow and the teeth.
    const colliderGeometry = new THREE.BoxGeometry(
      KEY_PICK_RADIUS * 2, .14, KEY_PICK_HALF_LENGTH * 2 + KEY_PICK_RADIUS * 2);
    const material = getKeyMaterial(type);
    // A small depth bias keeps thin metal faces stable against the painted
    // floor during the transition from a flying model to its pooled instance.
    material.polygonOffset = true;
    material.polygonOffsetFactor = -1;
    material.polygonOffsetUnits = -1;
    const healthyKeys = keysByType[type].filter(key => !key.broken);
    const damagedKeys = keysByType[type].filter(key => key.broken);
    const muddyKeys = healthyKeys.filter(key => key.mud);
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
    const collider = new THREE.InstancedMesh(colliderGeometry, colliderMaterial, KEYS_PER_TYPE);
    for (const instance of [healthy, damaged, mudCrust, collider].filter(Boolean)) {
      instance.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      instance.frustumCulled = false;
    }
    collider.userData = { kind: 'key-batch', type };
    scene.add(healthy, damaged, ...(mudCrust ? [mudCrust] : []), collider);
    interactables.push(collider);
    keysByType[type].forEach((key, index) => {
      const list = key.broken ? damagedKeys : healthyKeys;
      const visibleIndex = list.indexOf(key);
      floorKeys.set(key.id, { type, index, broken: key.broken, visibleIndex,
        mudIndex: key.mud ? muddyKeys.indexOf(key) : -1 });
      const mesh = key.broken ? damaged : healthy;
      mesh.setColorAt(visibleIndex, new THREE.Color().setScalar([.94, 1, .83][key.variation % 3]));
      setKeyInstanceFinish(mesh, visibleIndex, key, getKeyRustStrength(type));
    });
    if (healthy.instanceColor) healthy.instanceColor.needsUpdate = true;
    if (damaged.instanceColor) damaged.instanceColor.needsUpdate = true;
    return { healthy, damaged, mudCrust, collider, material };
  });
  const keyOutline = new THREE.Mesh(createCombinedKeyGeometry(0));
  keyOutline.raycast = () => {};
  keyOutline.visible = false;
  const hoverOutline = createKeyHoverOutline(renderer, camera, keyOutline);
  // All interactable silhouettes share the same post-render pixel contour as keys.
  const objectMask = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1));
  objectMask.matrixAutoUpdate = false;
  objectMask.visible = false;
  const objectOutline = createKeyHoverOutline(renderer, camera, objectMask);
  const cabinetMaskGeometry = new THREE.BoxGeometry(3.92, 5.04, .92);
  const bathMaskGeometry = new THREE.CylinderGeometry(.53, .47, .44, 24);
  const forgeMaskGeometry = new THREE.CylinderGeometry(.54, .46, .74, 24);
  const dummy = new THREE.Object3D();
  let geometryStatsCache;
  const keyAnimations = createWorldKeyAnimations({ scene, camera, cabinets, workstations,
    invalidate: () => geometryStatsCache?.invalidate(), syncKey, refreshCabinet });
  const { thrownKeys, placingKeys, animateThrow, animatePlace, animateDiscard, isThrowing } = keyAnimations;
  const hand = new THREE.Group();
  hand.position.set(.43, -.45, -.82);
  camera.add(hand);
  const handLight = new THREE.PointLight(0xffd6a1, 1.7, 3);
  handLight.position.set(.3, -.3, -.5);
  camera.add(handLight);
  let displayedHandId = null;
  let handModel = null;
  let handMotion = 0;
  let hovered = null;
  let keyHoverOpacity = 0;
  let keyHoverTarget = 0;
  let objectHoverOpacity = 0;
  let objectHoverTarget = 0;
  let lastHoverFrame = performance.now();
  let highlightedShape = '0:false';

  function refreshHand(key) {
    if (displayedHandId === (key?.id || null)) return;
    if (handModel) {
      hand.remove(handModel);
      disposeKeySceneModel(handModel);
    }
    displayedHandId = key?.id || null;
    handModel = null;
    geometryStatsCache?.invalidate();
    if (!key) return;
    handModel = createKeyModel(key.type, { id: key.id, scale: getKeyDisplayScale('hand', key.type),
      variation: key.variation, broken: key.broken, mud: key.mud, rust: key.rust });
    handModel.rotation.set(-.12, -.34, -.53);
    hand.add(handModel);
  }

  function syncKey(key) {
    geometryStatsCache?.invalidate();
    const instance = floorKeys.get(key.id);
    if (!instance) return;
    const batch = floorBatches[instance.type];
    const mesh = instance.broken ? batch.damaged : batch.healthy;
    const visible = key.status === 'floor' && !thrownKeys.has(key.id);
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
      dummy.scale.setScalar(visible && key.mud ? floorScale : .000001);
      dummy.updateMatrix();
      batch.mudCrust.setMatrixAt(instance.mudIndex, dummy.matrix);
      batch.mudCrust.instanceMatrix.needsUpdate = true;
    }
    dummy.position.set(key.x, restingY + .055, key.z);
    dummy.rotation.set(0, key.rotation, 0);
    dummy.scale.setScalar(visible ? 1 : .000001);
    dummy.updateMatrix();
    batch.collider.setMatrixAt(instance.index, dummy.matrix);
    batch.collider.instanceMatrix.needsUpdate = true;
  }

  function keyIdFromHit(type, instanceId) {
    return keysByType[type]?.[instanceId]?.id || null;
  }

  function refreshCabinet(type) {
    geometryStatsCache?.invalidate();
    const keys = state.keys.filter(key => key.type === type && key.status === 'sorted');
    const hiding = [...placingKeys.values()].filter(motion => motion.key.type === type).length;
    cabinets[type].refresh(keys, hiding, getProgress(state).required[type]);
  }
  cabinets.forEach((_, type) => refreshCabinet(type));
  for (const key of state.keys) syncKey(key);

  function highlight(target) {
    hovered = target;
    const interactive = target?.kind === 'cabinet' || target?.kind === 'bath' || target?.kind === 'forge';
    objectHoverTarget = interactive ? 1 : 0;
    if (interactive) {
      const collider = target.kind === 'cabinet' ? cabinets[target.type]?.collider :
        workstations.getHoverCollider(target);
      if (collider) {
        collider.updateWorldMatrix(true, false);
        objectMask.matrix.copy(collider.matrixWorld);
        if (target.kind === 'cabinet') {
          objectMask.geometry = cabinetMaskGeometry;
          objectMask.matrix.multiply(new THREE.Matrix4().makeTranslation(0, -.04, -.54));
        } else {
          objectMask.geometry = target.kind === 'bath' ? bathMaskGeometry : forgeMaskGeometry;
          objectMask.matrix.multiply(new THREE.Matrix4().makeTranslation(0, -.08, 0));
        }
      } else objectHoverTarget = 0;
    }
    keyHoverTarget = target?.kind === 'key' ? 1 : 0;
    if (keyHoverTarget) {
      const key = keysById.get(target.id);
      if (key) {
        const shape = `${key.type}:${key.broken}`;
        if (shape !== highlightedShape) {
          highlightedShape = shape;
          keyOutline.geometry.dispose();
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

  function update(now, moving) {
    const elapsed = Math.max(0, Math.min(.1, (now - lastHoverFrame) / 1000));
    lastHoverFrame = now;
    const hoverFactor = 1 - Math.exp(-elapsed / .15);
    keyHoverOpacity += (keyHoverTarget - keyHoverOpacity) * hoverFactor;
    objectHoverOpacity += (objectHoverTarget - objectHoverOpacity) * hoverFactor;
    keyOutline.visible = keyHoverOpacity > .005;
    objectMask.visible = objectHoverOpacity > .005;
    dust.update(now);
    snow.update(now);
    workstations.update(now);
    keyAnimations.update(now);
    if (handModel) {
      // Blend walk sway in over several frames: an instant amplitude change
      // on the first step looked like a one-frame key flicker.
      handMotion = nextHandMotionWeight(handMotion, moving, elapsed);
      hand.rotation.z = Math.sin(now * .0031) * (.012 + handMotion * .033);
      hand.position.y = -.45 + Math.sin(now * .0029) * (.012 + handMotion * .023);
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
      try { hoverOutline.render(keyHoverOpacity); }
      catch (error) { console.warn('KEYNLOCK: hover silhouette unavailable', error); }
      try { objectOutline.render(objectHoverOpacity); }
      catch (error) { console.warn('KEYNLOCK: object silhouette unavailable', error); }
    } }, interactables, cabinets, workstations, floorKeys,
    refreshHand, syncKey, refreshCabinet, highlight, update, resize,
    captureKeyThumbnail, getGeometryStats,
    getVisualStatus: painted.getStatus,
    getRenderStats: () => ({ drawCalls: renderer.info.render.calls,
      renderedTriangles: renderer.info.render.triangles,
      passes: painted.getPassCount() + hoverOutline.getPassCount() + objectOutline.getPassCount() }),
    setVisualSettings(settings) {
      applyWindowDaylight(settings);
      painted.setSettings(settings);
      snow.setSettings(settings);
    },
    keyIdFromHit, animateThrow, animatePlace, animateDiscard, isThrowing, throwingCount: () => thrownKeys.size,
    progress: () => getProgress(state),
    bounds: { x: ROOM.halfWidth - .88, z: ROOM.halfLength - .87 },
  };
}
