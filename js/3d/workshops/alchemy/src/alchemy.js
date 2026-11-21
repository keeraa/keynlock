import * as THREE from 'three';
import { REAGENTS, emptyMixture, addDose, mixtureInfo, pigmentColor } from './mixing.js';
import { pouringPose } from './pouring.js';
import { createAlchemyFilters } from './look/alchemy-filters.js';
import { createGlassContour, sideContourVisibility } from './glass-contour.js';
import { createSlosh, stepSlosh, splashSlosh, follow } from './fluid-physics.js';
import { createLiquidJet, outflowRate, emitLiquid, advanceLiquidJet } from './liquid-jet.js';
import { BOTTLE_GLASS_PROFILE, liquidRadiusAt, liquidRingAt } from './liquid-shape.js';
import { makeMetalLiquidTexture, makePigmentLiquidTexture, makeMixedLiquidTexture, makeWorkshopReflectionMap, METAL_LIQUID_FINISHES } from './metal-liquids.js';
import { makeGouacheWallTexture, WALL_TILE_PALETTES } from './wall-tiles.js';
import { WOOD_FINISHES, WOOD_FINISH_ASSETS } from './wood-textures.js';
import { ALCHEMY_LOOK, applyAlchemyRendererLook, createAlchemyLook } from './look/alchemy-look.js';
import { createVisualPanel } from './ui/visual-panel.js';
import { beginSourceDrag, positionSourceDrag } from './source-drag.js';
import { makePerforatedRackShelf } from './rack-shelf.js';
import { createGeometryCache } from './geometry-cache.js';
import { circleSamples } from './circle-samples.js';
import { createStopwatch } from './stopwatch.js';
import { createCandleFlame, createCandleFlameMaterial } from './candle-flame.js';
import { BOTTLE_STICKER_IMAGES, createBottleStickerGeometry } from './bottle-sticker.js';
import { generateRecipe, evaluateRecipe, observeRecipeStages, RECIPE_LEVELS, PIGMENT_SWATCHES, PLANETARY_METALS, METAL_REFERENCE_ORDER } from './recipes.js';
import { createRecipeSheetTexture } from './recipe-sheet.js';
import { createAlchemyRuntime } from './runtime-host.js';
import { ALCHEMY_TABLE } from './table-dimensions.js';
import { getWorkshopHost, publishWorkshopApi } from '../../../core/host/workshop-host.js';

// Inside the Lair the host mounts this markup into the room and shares its
// renderer, camera and input (core/host/workshop-host.js).
const lair = getWorkshopHost();
const alchemyRoot = lair?.alchemy.root || document;
// The Lair renames the source #experience root to avoid an ID collision.
// All original UI modules still address that root through $('experience').
const $ = id => id === 'experience' && alchemyRoot !== document
  ? alchemyRoot
  : alchemyRoot.querySelector(`#${id}`);
const queryAll = selector => alchemyRoot.querySelectorAll(selector);
const canvas = $('scene');
const runtime = createAlchemyRuntime({ THREE, canvas });
const inputSurface = runtime.embedded
  ? lair?.alchemy.inputPlane || canvas
  : canvas;
const renderer = runtime.renderer;
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, ALCHEMY_LOOK.renderer.pixelRatioCap));
renderer.setSize(innerWidth, innerHeight);
applyAlchemyRendererLook(THREE,renderer);
// The room and furniture are stationary. Rebuild the shadow atlas on demand,
// rather than on every scene capture and final glass pass.
renderer.shadowMap.autoUpdate = false;
renderer.shadowMap.needsUpdate = true;

const scene = new THREE.Scene();
const backgroundScene = new THREE.Scene();
backgroundScene.background = new THREE.Color(ALCHEMY_LOOK.scene.fogColor);
scene.fog = new THREE.FogExp2(ALCHEMY_LOOK.scene.fogColor,ALCHEMY_LOOK.scene.fogDensity);
backgroundScene.fog = new THREE.FogExp2(ALCHEMY_LOOK.scene.fogColor,ALCHEMY_LOOK.scene.fogDensity);
const camera = new THREE.PerspectiveCamera(37, innerWidth / innerHeight, .1, 100);
runtime.registerScene(scene, camera, [backgroundScene]);
camera.position.set(0, 5.2, 13.6);
camera.lookAt(0, 1.7, -.45);
const cameraTarget = new THREE.Vector3(0, 1.7, -.45);
// The Lair must aim its visible camera at the original laboratory's actual
// orbit target, not reconstruct one from a potentially stale camera quaternion.
camera.userData.keynlockLocalTarget = cameraTarget;
const orbit = { yaw: 0, pitch: .251, zoom: 1, distance: 14.05 };
const timer = new THREE.Timer();
timer.connect(document);
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const tmpVec = new THREE.Vector3();
// Raycasting happens in Lair world space; source drag constraints are local
// to the laboratory scene, which is translated, rotated and scaled in Lair.
function sourceSpaceRay(source) {
  if (!runtime.embedded) return raycaster.ray;
  source.root.parent.updateWorldMatrix(true, false);
  const worldToSource = source.root.parent.matrixWorld.clone().invert();
  return raycaster.ray.clone().applyMatrix4(worldToSource);
}
const geometryCache = createGeometryCache(THREE);
const bottleStickerGeometry = createBottleStickerGeometry(THREE, BOTTLE_GLASS_PROFILE);

const woodTextureLoader = new THREE.TextureLoader();
const woodTextureCache = new Map(WOOD_FINISHES.map(id => {
  const texture = woodTextureLoader.load(WOOD_FINISH_ASSETS[id], () => {
    // The wall shelf belongs to the separately cached room render.
    backgroundEffects.invalidateRoom();
  });
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.MirroredRepeatWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return [id, texture];
}));
const wood = new THREE.MeshStandardMaterial({ color: 0xffffff, map: woodTextureCache.get('walnut'), roughness: 1, metalness: 0 });
const darkWood = new THREE.MeshStandardMaterial({ color: 0x42302a, roughness: .91 });
const blackWood = new THREE.MeshStandardMaterial({ color: 0x201b1a, roughness: .9 });
const brass = new THREE.MeshStandardMaterial({ color: 0xaf8951, roughness: .32, metalness: .81 });
const polishedBrass = new THREE.MeshStandardMaterial({ color: 0xe2c18a, roughness: .24, metalness: .83 });
const oldBrass = new THREE.MeshStandardMaterial({ color: 0x74623e, roughness: .64, metalness: .7 });
const iron = new THREE.MeshStandardMaterial({ color: 0x343b3a, roughness: .55, metalness: .8 });
const corkTexture = new THREE.TextureLoader().load(new URL('./assets/painted-cork.webp', import.meta.url).href);
corkTexture.colorSpace = THREE.SRGBColorSpace;
corkTexture.wrapS = corkTexture.wrapT = THREE.RepeatWrapping;
corkTexture.repeat.set(.48, .48);
corkTexture.offset.set(.24, .24);
corkTexture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
const corkMat = new THREE.MeshStandardMaterial({ color: 0xd8c6ab, map: corkTexture, roughness: .99, metalness: 0 });
const CORK_SEAT_Y = 1.17;
// The 160 ml mixing vessels should read as modestly larger than the 91 ml
// reagent bottles, with their complete glass and metal cages in proportion.
const RECEIVER_SCALE = .52;
const parchment = new THREE.MeshStandardMaterial({ color: 0xb7a67d, roughness: .94, side: THREE.DoubleSide });
const glassMat = new THREE.MeshPhysicalMaterial({ color: 0xe5f8f5, transparent: true, opacity: .027, roughness: .04, metalness: .02, clearcoat: 1, clearcoatRoughness: .02, side: THREE.DoubleSide, depthWrite: false });
const glassEdgeMat = new THREE.MeshPhysicalMaterial({ color: 0xe0f1e9, transparent: true, opacity: .34, roughness: .1, metalness: .05, clearcoat: .95, depthWrite: false });
const glintMat = new THREE.MeshBasicMaterial({ color: 0xe8faf3, transparent: true, opacity: .035, depthWrite: false });
const glassPaintLarge = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: .06, roughness: .88, metalness: 0, side: THREE.DoubleSide, depthWrite: false });
const glassPaintSmall = glassPaintLarge.clone();
glassPaintSmall.opacity = .032;
const GLASS_FINISHES = {
  watercolor: { url: new URL('./assets/glass-watercolor.webp', import.meta.url).href, large: .055, small: .028, base: .025 },
  frosted: { url: new URL('./assets/glass-frosted.webp', import.meta.url).href, large: .115, small: .07, base: .045 },
  antique: { url: new URL('./assets/glass-antique.webp', import.meta.url).href, large: .08, small: .04, base: .030 }
};

if (runtime.embedded && !alchemyRoot.classList.contains('is-active')) runtime.setActive(false);
const glassTextureCache = new Map();
const metalAppearanceCache = new Map();
const pigmentAppearanceCache = new Map();
const receiverPigmentCache = new Map();
const workshopReflectionMap = makeWorkshopReflectionMap(THREE);
let mixedLiquidAppearance = null;
const WALL_SIZE = Object.freeze({ width: 48, height: 30 });
const wallTextureCache = new Map(WALL_TILE_PALETTES.map(id => [id, makeGouacheWallTexture(THREE, id, WALL_SIZE)]));
const wallMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, map: wallTextureCache.get('sage'), roughness: .99, metalness: 0 });
let currentWallFinish = 'sage';
let currentWoodFinish = 'walnut';
let currentLightDirection = 'right';
let keyLightStrength = 100;
let blurBackground = true;
const pearlUniform = { value: 0 };
const candleTimeUniform = { value: 0 };
const candleFlameMaterial = createCandleFlameMaterial(THREE, candleTimeUniform);
const candleFlameGeometry = new THREE.PlaneGeometry(.34, .68);
const liquidShadowTexture = makeLiquidShadowTexture();
const glassLoader = new THREE.TextureLoader();
const stickerLoader = new THREE.TextureLoader();
const stickerTextureCache = new Map();
let currentGlassFinish = 'watercolor';
const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false });
const particles = [];
const interactionMeshes = [];
const sourceObjects = [];
const receivers = [];
const candles = [];
const glassContours = [];
const liquidContours = [];
let burner = null;
let drainValve = null;
let stopwatch = null;
let recipeBoard = null;
const recipeBookHit = { kind: 'recipe-book' };
let recipeNumber = 0;
const recipesByLevel = new Map([1, 2, 3].map(level =>
  [level, generateRecipe(REAGENTS, Math.random, ++recipeNumber, level)]));
let recipeLevel = 1;
let currentRecipe = recipesByLevel.get(recipeLevel);
let recipeHeatSeconds = 0;
let recipeResult = null;
let recipeTimeline = [];

let selected = null;
let press = null;
let animation = null;
let hoverObject = null;
let dragHoverTarget = null;
let elapsed = 0;
let toastTimer = 0;
let fpsWindow = 0;
let fpsFrames = 0;
let particleStepAccumulated = 0;
const lastContourCameraMatrix = new THREE.Matrix4();
let contoursInitialized = false;

const look = createAlchemyLook(THREE,{scene,backgroundScene,renderer});
const {sunbeams,backgroundEffects} = look;

buildRoom();
buildTable();
stopwatch = createStopwatch(THREE, scene, { brass, darkWood }, [2.58, 3.555, -4.20]);
buildDecor();
buildRack();
buildBigVessel('left', -3.95);
buildBigVessel('right', 3.95);
buildBurner();
buildDrainValve();
for (let i = 0; i < 4; i++) buildSourceTube(REAGENTS[i], [-1.38, -.46, .46, 1.38][i]);
for (let i = 0; i < 7; i++) buildBottle(REAGENTS[i + 4], (i - 3) * 1.17);
const animatedLiquidTextures = [...pigmentAppearanceCache.values(), ...metalAppearanceCache.values()].map(appearance => appearance.texture);
buildDust();
const visuals = createAlchemyFilters({scene,renderer,
  materials:{iron,oldBrass,brass,polishedBrass,wood,darkWood,blackWood,corkMat},
  document,textureLoader:new THREE.TextureLoader(),contours:[...glassContours,...liquidContours]});
for (const id of Object.keys(GLASS_FINISHES)) $('glass-' + id).addEventListener('click', () => {
  selectGlassFinish(id);
});
const visualPanel = createVisualPanel({$,queryAll,visuals,woodAssets:WOOD_FINISH_ASSETS,
  selectWallFinish,selectWoodFinish,setLightDirection,setLightStrength,setSunbeam,setBackgroundBlur,
  isSunbeamVisible:side=>sunbeams[side].visible,isBlurred:()=>blurBackground,
  resetCamera:()=>{
    orbit.yaw=0;orbit.pitch=.251;orbit.zoom=1;
    cameraTarget.set(0,1.7,-.45);
    applyCamera();
    if (runtime.embedded) lair?.alchemy.resetCamera?.();
  },
  onResize,viewportWidth:()=>innerWidth});
visualPanel.bind();
bindRecipeBook();
selectGlassFinish('watercolor');
for (const id of Object.keys(GLASS_FINISHES)) ensureGlassTexture(id);
onResize();

window.addEventListener('resize', onResize);
inputSurface.addEventListener('pointerdown', onPointerDown);
inputSurface.addEventListener('pointermove', onPointerMove);
inputSurface.addEventListener('pointerup', onPointerUp);
inputSurface.addEventListener('pointercancel', onPointerCancel);
inputSurface.addEventListener('pointerleave', () => { if (runtime.isActive() && !press) setHover(null); });
inputSurface.addEventListener('contextmenu', e => { if (runtime.isActive()) e.preventDefault(); });
inputSurface.addEventListener('wheel', onWheel, { passive: false });
$('reset').addEventListener('click', resetAll);
function handleKey(event) {
  if (!runtime.isActive()) return false;
  if (event.key === 'Escape') {
    if (runtime.embedded && $('recipe-overlay').hidden) return false;
    closeRecipeBook();
    selected = null;
    restoreAllSources();
    setHover(null);
    updateHighlights();
    return true;
  }
  const key = event.key.toLowerCase();
  if (key !== 'r' && key !== 'к') return false;
  resetAll();
  return true;
}
if (!runtime.embedded) window.addEventListener('keydown', handleKey);

timer.reset();
runtime.start(render, {
  enter: () => timer.reset(),
  exit() {
    const pointerId = press?.id;
    onPointerCancel();
    if (pointerId !== undefined && inputSurface.hasPointerCapture(pointerId)) {
      inputSurface.releasePointerCapture(pointerId);
    }
    closeRecipeBook();
  },
});

// A small readable state API, published for the Lair and its browser tests.
const alchemyApi = {
  input: { handleKey },
  look: {profile:ALCHEMY_LOOK,getState:()=>({...look.getState(),backgroundBlur:blurBackground,
    sunbeams:sunbeams.getState(),filters:visuals.getState()}),
    setDirection:setLightDirection,setStrength:setLightStrength,
    setBackgroundBlur,setSunbeam,setFilter:visuals.set},
  lifecycle: {
    setActive: runtime.setActive,
    isActive: runtime.isActive,
    dispose() {
      timer.dispose();
      runtime.dispose();
    },
  },
  getState: () => ({
    receivers: receivers.map(r => ({ id: r.id, volume: r.state.volume, color: mixtureInfo(r.state).hex, additions: r.state.additions.length })),
    sources: sourceObjects.map(s => ({ id: s.data.id, name: s.data.name, symbol: s.data.symbol, color: s.color, volume: s.amount })),
    glassFinish: currentGlassFinish,
    wallFinish: currentWallFinish,
    woodFinish: currentWoodFinish,
    lightDirection: currentLightDirection,
    lightStrength: keyLightStrength,
    sunbeams: sunbeams.getState(),
    backgroundBlur: blurBackground,
    burnerOn: burner.active,
    stopwatch: { seconds: stopwatch.elapsed, running: stopwatch.running, duration: stopwatch.duration },
    drainActive: drainValve.draining,
    recipe: { ...currentRecipe },
    recipeLevel,
    recipePages: [1, 2, 3].map(level => ({ level, number: recipesByLevel.get(level).number })),
    recipeHeatSeconds,
    recipeResult,
    recipeTimeline: recipeTimeline.map(event => ({ ...event })),
    glassOutlineCount: glassContours.length,
    liquidOutlineCount: liquidContours.length,
    glassOutlineVisible: glassContours.every(contour => contour.group.visible),
    visuals: visuals.getState(),
    camera: { yaw: orbit.yaw, pitch: orbit.pitch, zoom: orbit.zoom, target: { x: cameraTarget.x, y: cameraTarget.y, z: cameraTarget.z } }
  }),
  setGlassFinish: selectGlassFinish,
  setWallFinish: selectWallFinish,
  setWoodFinish: selectWoodFinish,
  setLightDirection,
  setLightStrength,
  setSunbeam,
  setBackgroundBlur,
  toggleBurner,
  drainRightVessel,
  openRecipeBook,
  closeRecipeBook,
  evaluatePotion,
  nextRecipe: resetAll,
  setRecipeLevel,
  setVisual: visuals.set,
  rotateCamera: (yaw, pitch) => {
    orbit.yaw = THREE.MathUtils.clamp(yaw, -1.25, 1.25);
    orbit.pitch = THREE.MathUtils.clamp(pitch, .08, .99);
    applyCamera();
  },
  transfer: (sourceId, vesselId) => {
    const source = sourceObjects.find(s => s.data.id === sourceId);
    const target = receivers.find(r => r.id === vesselId);
    if (!source || !target || animation || drainValve.draining) return false;
    pour(source, target);
    return true;
  }
};
publishWorkshopApi('alchemy', alchemyApi);

function ensureGlassTexture(id) {
  const entry = glassTextureCache.get(id);
  if (entry) return entry.ready ? entry.texture : null;
  const next = { ready: false, texture: null };
  glassTextureCache.set(id, next);
  glassLoader.load(GLASS_FINISHES[id].url, texture => {
    texture.colorSpace = THREE.SRGBColorSpace;
    // Mirroring two full halves makes the painterly join invisible at 360°.
    texture.wrapS = THREE.MirroredRepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.repeat.set(2, 1);
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    next.texture = texture;
    next.ready = true;
    if (currentGlassFinish === id) applyGlassFinish(id, texture);
  });
  return next.ready ? next.texture : null;
}

function applyGlassFinish(id, texture) {
  const finish = GLASS_FINISHES[id];
  for (const [material, opacity] of [[glassPaintLarge, finish.large], [glassPaintSmall, finish.small]]) {
    if (material.map !== texture) {
      material.map = texture;
      material.needsUpdate = true;
    }
    material.opacity = opacity;
  }
  glassMat.opacity = finish.base;
}

function selectGlassFinish(id) {
  if (!GLASS_FINISHES[id]) return false;
  currentGlassFinish = id;
  const ready = ensureGlassTexture(id);
  // A not-yet-loaded image must never replace the last visible glass map.
  if (ready) applyGlassFinish(id, ready);
  for (const key of Object.keys(GLASS_FINISHES)) {
    const button = $('glass-' + key);
    button.classList.remove('active');
    if (key === id) button.classList.add('active');
    button.setAttribute('aria-pressed', String(key === id));
  }
  return true;
}

function selectWallFinish(id) {
  const texture = wallTextureCache.get(id);
  if (!texture) return false;
  currentWallFinish = id;
  wallMaterial.map = texture;
  wallMaterial.needsUpdate = true;
  backgroundEffects.invalidateRoom();
  for (const button of queryAll('.wall-choice')) {
    const active = button.dataset.wall === id;
    button.classList[active ? 'add' : 'remove']('active');
    button.setAttribute('aria-pressed', String(active));
  }
  return true;
}

function selectWoodFinish(id) {
  const texture = woodTextureCache.get(id);
  if (!texture) return false;
  currentWoodFinish = id;
  wood.map = texture;
  wood.needsUpdate = true;
  backgroundEffects.invalidateRoom();
  for (const button of queryAll('.wood-choice')) {
    const active = button.dataset.wood === id;
    button.classList[active ? 'add' : 'remove']('active');
    button.setAttribute('aria-pressed', String(active));
  }
  return true;
}

function setLightDirection(direction) {
  if (!look.setDirection(direction)) return false;
  currentLightDirection = direction;
  for (const button of queryAll('.light-choice')) {
    const active = button.dataset.light === direction;
    button.classList[active ? 'add' : 'remove']('active');
    button.setAttribute('aria-pressed', String(active));
  }
  return true;
}

function setLightStrength(value) {
  if (!look.setStrength(value)) return false;
  keyLightStrength = look.getState().strength;
  $('key-light-strength').value = String(keyLightStrength);
  $('key-light-strength-output').textContent = `${keyLightStrength}%`;
  $('key-light-strength').style.setProperty('--fill', `${(keyLightStrength - 20) / 140 * 100}%`);
  return true;
}

function setSunbeam(side, visible) {
  if (!sunbeams.setVisible(side, visible)) return false;
  const button = $(`sunbeam-${side}`);
  button.classList[visible ? 'add' : 'remove']('active');
  button.setAttribute('aria-checked', String(Boolean(visible)));
  return true;
}

function setBackgroundBlur(active) {
  blurBackground = Boolean(active);
  backgroundEffects.setBlur(blurBackground);
  const button = $('background-blur');
  button.classList[blurBackground ? 'add' : 'remove']('active');
  button.setAttribute('aria-checked', String(blurBackground));
}

function mesh(geometry, material, parent = scene, x = 0, y = 0, z = 0, shadow = true) {
  const object = new THREE.Mesh(geometry, material);
  object.position.set(x, y, z);
  object.castShadow = shadow;
  object.receiveShadow = shadow;
  parent.add(object);
  return object;
}
function box(w, h, d, material, parent, x, y, z) {
  return mesh(material === wood ? geometryCache.woodBox(w, h, d) : geometryCache.box(w, h, d),
    material, parent, x, y, z);
}
function cyl(top, bottom, height, material, parent, x, y, z, segments = 32) {
  return mesh(geometryCache.cylinder(top, bottom, height, segments), material, parent, x, y, z);
}
function ring(radius, tube, material, parent, x, y, z, segments = 64) {
  const object = mesh(geometryCache.torus(radius, tube, segments), material, parent, x, y, z);
  object.rotation.x = Math.PI / 2;
  return object;
}

function makeDarkDrainTexture() {
  // A softly irregular stone-dark drain opening with a lighter worn lip.
  const width = 96, height = 96;
  const pixels = new Uint8Array(width * height * 4);
  let seed = 14973;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) | 0; return (seed >>> 0) / 4294967296; };
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const u = (x / width - .5) * 2, v = (y / height - .5) * 2;
    const radius = Math.min(1, Math.hypot(u, v));
    const edge = Math.pow(radius, 3.3);
    const worn = Math.sin(Math.atan2(v, u) * 9) * 3 * edge;
    const grain = (random() - .5) * (4 + edge * 22);
    const shade = 7 + edge * 43 + worn + grain;
    const offset = (y * width + x) * 4;
    pixels[offset] = Math.round(shade);
    pixels[offset + 1] = Math.round(shade + 6);
    pixels[offset + 2] = Math.round(shade + 5);
    pixels[offset + 3] = 255;
  }
  const texture = new THREE.DataTexture(pixels, width, height, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

function buildRoom() {
  const room = new THREE.Group();
  backgroundScene.add(room);
  const tiledWall = box(WALL_SIZE.width, WALL_SIZE.height, .28, wallMaterial, room, 0, 3.2, -5.25);
  tiledWall.name = 'extended-back-wall';
  // Inside the Lair the room's own right wall is tiled from floor to ceiling;
  // a second, shorter wall here would show as a separate green panel.
  // The wall finish is then chosen in the Lair's own visual panel, so the
  // lab's tile colour buttons, which only paint this hidden wall, are hidden too.
  if (runtime.embedded) {
    tiledWall.visible = false;
    for (const choices of queryAll('.wall-choices')) {
      choices.hidden = true;
      if (choices.previousElementSibling?.tagName === 'H3') choices.previousElementSibling.hidden = true;
    }
  }
  tiledWall.castShadow = false;
  tiledWall.receiveShadow = false;
  // Full-wall painting has its own low-contrast grout and no repeating joins.
  // The shelf uses the selected tabletop wood, including its brushwork.
  box(22, .25, 1.05, wood, room, 0, 2.85, -4.33).name = 'alchemy-wall-shelf';
  const lairWall = runtime.embedded && lair?.renderer.getUnifiedScene()?.getObjectByName('alchemy-right-wall');
  const wallZ = lairWall ? room.worldToLocal(lairWall.getWorldPosition(new THREE.Vector3())).z : -5.11;
  const bracketBack = wallZ - .02, bracketFront = -4.29;
  for (const x of [-8.65, 8.65]) {
    box(.22, .35, bracketFront - bracketBack, darkWood, room,
      x, 2.56, (bracketBack + bracketFront) / 2).name = 'alchemy-shelf-bracket';
  }
  // The recipe is printed on a real piece of parchment in the room.
  const parchmentFrame = new THREE.Group();
  parchmentFrame.position.set(0, 3.915, -4.38);
  parchmentFrame.rotation.x = -.065;
  // Paintings in the foreground scene bypass the room's adjustable defocus;
  // the formula stays readable even when background blur is enabled.
  scene.add(parchmentFrame);
  box(2.89, 1.84, .085, darkWood, parchmentFrame, 0, 0, -.047);
  recipeBoard = createRecipeSheetTexture(THREE, document);
  recipeBoard.paint(currentRecipe);
  const paper = box(2.72, 1.67, .024, new THREE.MeshStandardMaterial({
    color: 0xffffff, map: recipeBoard.texture, roughness: 1, metalness: 0
  }), parchmentFrame, 0, 0, .009);
  paper.name = 'recipe-parchment';
  paper.castShadow = false;
  // Raycast against an invisible area fixed to the framed sheet itself.
  const recipeHit = mesh(new THREE.PlaneGeometry(2.72, 1.67), hitMat, parchmentFrame, 0, 0, .065, false);
  recipeHit.userData.interaction = { kind: 'recipe' };
  interactionMeshes.push(recipeHit);
  box(2.90, .065, .10, wood, parchmentFrame, 0, -.91, .02);
  for (let x of [-7.2, -5.7, -3.7, 3.8, 5.7, 7.4]) {
    cyl(.27, .31, .63, glassMat, room, x, 3.28, -4.17);
    cyl(.21, .23, .09, oldBrass, room, x, 3.62, -4.17);
    cyl(.22, .22, .34, new THREE.MeshStandardMaterial({ color: x < 0 ? 0x685a42 : 0x3e6b5e, roughness: .4, transparent: true, opacity: .65 }), room, x, 3.09, -4.17);
  }
}

function buildTable() {
  // Two physically separate tiers: the seven metal bottles stand on the
  // lowered front bench, while mixing flasks keep their original level.
  // A deeper slab, grown downwards so all flasks stay at their original height.
  const workingTop = box(ALCHEMY_TABLE.width, .72, 4.68, wood, scene, 0, ALCHEMY_TABLE.topY - .36, -1.16);
  workingTop.name = 'alchemy-main-tabletop';
  workingTop.receiveShadow = true;
  box(14.6, .13, 4.72, brass, scene, 0, -.745, -1.16);
  const lowTop = box(ALCHEMY_TABLE.width, .40, 1.82, wood, scene, 0, -.70, 2.09);
  lowTop.name = 'alchemy-lower-tabletop';
  lowTop.receiveShadow = true;
  box(14.6, .12, 1.9, brass, scene, 0, -.99, 2.09);
  box(14.2, .54, .13, darkWood, scene, 0, -1.13, 3.04);
  box(14.2, .046, .14, polishedBrass, scene, 0, -.925, 3.04);
  box(14.25, .73, .10, darkWood, scene, 0, -.325, 1.19);
  box(14.3, .035, .10, polishedBrass, scene, 0, -.68, 1.20);
  const footY = runtime.embedded ? ALCHEMY_TABLE.lairFootY : ALCHEMY_TABLE.standaloneFootY;
  const legBase = footY + ALCHEMY_TABLE.footHeight - .005;
  for (const x of [-6.2, 6.2]) {
    for (const [z, top] of [[2.1, -.60], [-3.15, -.40]]) {
      const length = top - legBase;
      const leg = box(.6, length, .65, darkWood, scene, x, (top + legBase) / 2, z);
      leg.name = 'table-leg';
      const foot = box(.66, ALCHEMY_TABLE.footHeight, .7, oldBrass, scene,
        x, footY + ALCHEMY_TABLE.footHeight / 2, z);
      foot.name = 'table-foot';
    }
  }
  // A faint alchemical engraving is cut into the tabletop.
  ring(1.72, .012, new THREE.MeshBasicMaterial({ color: 0xc8b384, transparent: true, opacity: .18, depthWrite: false }), scene, 0, .067, -.6);
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4;
    const glyph = box(.2, .015, .015, polishedBrass, scene, Math.cos(a) * 1.84, .071, -.6 + Math.sin(a) * 1.84);
    glyph.rotation.y = -a;
  }
}

function buildDecor() {
  for (let x of [-6.3, 6.3]) makeCandle(x, -.1, 1.1);
  // Mortar and a small brass spoon on the far side.
  cyl(.47, .35, .28, darkWood, scene, -3.02, .26, -2.32);
  ring(.43, .048, oldBrass, scene, -3.02, .43, -2.32);
  const pestle = cyl(.09, .16, .86, oldBrass, scene, -2.7, .6, -2.3);
  pestle.rotation.z = -.52;
  // A little cluster of leather-bound notebooks.
  const leatherColors = [0x4c2925, 0x343c35, 0x564b34];
  for (let i = 0; i < 3; i++) {
    const cover = new THREE.MeshStandardMaterial({ color: leatherColors[i], roughness: .88 });
    box(1.23, .12, .84, cover, scene, 3.05 + i * .08, .10 + i * .15, -2.36 + i * .05);
    box(.95, .07, .74, parchment, scene, 3.13 + i * .08, .17 + i * .15, -2.35 + i * .05);
  }
  // The cup is hollow with a recessed dark interior; the stirrer enters its
  // opening instead of cutting through a capped cylinder wall.
  const cup = mesh(new THREE.CylinderGeometry(.32, .26, .6, 32, 1, true),
    oldBrass.clone(), scene, 5.8, .34, -1.8);
  cup.material.side = THREE.DoubleSide;
  cyl(.26, .26, .04, oldBrass, scene, 5.8, .06, -1.8);
  cyl(.278, .278, .012, new THREE.MeshStandardMaterial({ color: 0x242a2a, roughness: .61, metalness: .26 }), scene, 5.8, .53, -1.8);
  ring(.32, .028, polishedBrass, scene, 5.8, .64, -1.8);
  const stirrer = cyl(.023, .023, 1.04, polishedBrass, scene, 5.82, .99, -1.8);
  stirrer.rotation.z = -.12;
}

function makeCandle(x, z, size) {
  cyl(.35, .43, .09, oldBrass, scene, x, .13, z);
  cyl(.055, .055, .5, brass, scene, x, .43, z);
  cyl(.24, .24, .045, polishedBrass, scene, x, .7, z);
  cyl(.18, .18, size, new THREE.MeshStandardMaterial({ color: 0xddc9a2, roughness: .97 }), scene, x, .72 + size / 2, z);
  cyl(.016, .018, .12, blackWood, scene, x, .75 + size, z);
  const flame = createCandleFlame(THREE, candleFlameMaterial, candleFlameGeometry);
  flame.position.set(x, 1.04 + size, z);
  scene.add(flame);
  const glow = new THREE.PointLight(0xffb968, 10, 4.8, 2);
  glow.position.set(x, .90 + size, z);
  scene.add(glow);
  candles.push({ flame, glow, seed: x });
}

function buildRack() {
  const rack = new THREE.Group();
  scene.add(rack);
  rack.position.set(0, 0, -1.04);
  box(4.15, .24, 1.25, wood, rack, 0, .16, 0);
  box(4.26, .055, 1.29, brass, rack, 0, .30, 0);
  box(4.10, .15, 1.2, wood, rack, 0, .39, 0);
  for (let x of [-1.88, 1.88]) {
    cyl(.075, .11, 2.1, oldBrass, rack, x, 1.35, -.09);
    cyl(.13, .13, .10, polishedBrass, rack, x, 2.44, -.09);
  }
  const tubeXs = [-1.38, -.46, .46, 1.38];
  const woodShelfGeometry = makePerforatedRackShelf(THREE, 4.03, 1.0, .15, tubeXs);
  const rackUvs = woodShelfGeometry.getAttribute('uv');
  for (let i = 0; i < rackUvs.count; i++) {
    rackUvs.setXY(i, rackUvs.getX(i) / 4.0, rackUvs.getY(i) / 4.0);
  }
  rackUvs.needsUpdate = true;
  const woodShelf = mesh(woodShelfGeometry, wood, rack, 0, 1.895, -.07);
  woodShelf.name = 'pierced-tube-shelf';
  const rimPlate = mesh(makePerforatedRackShelf(THREE, 4.14, 1.03, .045, tubeXs), brass, rack, 0, 2.0475, -.07);
  rimPlate.name = 'pierced-shelf-trim';
  for (const x of tubeXs) {
    ring(.315, .018, polishedBrass, rack, x, 2.09, 0);
    ring(.245, .015, oldBrass, rack, x, .47, 0);
  }
  for (let i = 0; i < 13; i++) {
    box(.014, .04, .014, polishedBrass, rack, -1.78 + i * .3, .325, .61);
  }
}

function glassProfile(radius, height, shape) {
  if (shape === 'bottle') return BOTTLE_GLASS_PROFILE;
  if (radius < .4) {
    // Ten angular sections create a true hemispherical test-tube bottom.
    const curve = [[0, .065]];
    for (let i = 1; i <= 12; i++) {
      const angle = i / 12 * Math.PI / 2;
      curve.push([radius * Math.sin(angle), .065 + radius * (1 - Math.cos(angle))]);
    }
    return [...curve, [radius, height - .13], [radius * 1.07, height - .055],
      [radius * 1.08, height], [radius * .91, height], [radius * .90, height - .11]];
  }
  return [
    [0, .065], [radius * .44, .09], [radius * .83, .21], [radius, .43], [radius, height - .13],
    [radius * 1.07, height - .055], [radius * 1.08, height], [radius * .91, height], [radius * .90, height - .11]
  ];
}

function makeGlassContainer(parent, radius, height, shape = 'tube', contourScale = 1) {
  const profile = glassProfile(radius, height, shape);
  const geometry = geometryCache.glass(radius, height, shape, profile);
  const outer = mesh(geometry, glassMat, parent, 0, 0, 0, false);
  outer.renderOrder = 7;
  const refracted = mesh(geometry, backgroundEffects.makeGlassMaterial(), parent, 0, 0, 0, false);
  refracted.scale.set(1.004, 1, 1.004);
  refracted.renderOrder = 7.5;
  // Dedicated second-pass lens, reading the complete image BEHIND the glass.
  refracted.layers.set(1);
  const projectedCenter = new THREE.Vector3();
  refracted.onBeforeRender = (_, __, activeCamera, ___, material) => {
    projectedCenter.set(0, height * .52, 0);
    refracted.localToWorld(projectedCenter).project(activeCamera);
    material.uniforms.uCenter.value.set(projectedCenter.x * .5 + .5, projectedCenter.y * .5 + .5);
    material.uniforms.uFluidY.value = outer.userData.fluid?.shown ?? -1;
  };
  const gouache = mesh(geometry, shape === 'bottle' || radius < .4 ? glassPaintSmall : glassPaintLarge, parent, 0, 0, 0, false);
  gouache.scale.set(1.008, 1, 1.008);
  gouache.renderOrder = 8;
  const rimY = shape === 'bottle' ? 1.205 : height;
  const rimRadius = shape === 'bottle' ? .18 : radius * 1.08;
  if (radius >= .4) {
    const lip = ring(rimRadius, shape === 'bottle' ? .018 : .034, glassEdgeMat, parent, 0, rimY, 0);
    lip.castShadow = false;
    lip.renderOrder = 9;
  }
  glassContours.push(createGlassContour(parent, profile, rimRadius, rimY,
    { thicknessScale: contourScale, drawRim: true, silhouetteGeometry: geometry }));
  const streak = mesh(geometryCache.glassStreak(shape, radius, height), glintMat, parent, 0, shape === 'bottle' ? .46 : height / 2 + .15, 0, false);
  streak.renderOrder = 10;
  outer.userData.lens = refracted;
  return outer;
}

function getMetalAppearance(data) {
  if (!data.symbol) return null;
  if (metalAppearanceCache.has(data.id)) return metalAppearanceCache.get(data.id);
  const texture = makeMetalLiquidTexture(THREE, data, metalAppearanceCache.size);
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const finish = METAL_LIQUID_FINISHES[data.id];
  if (!finish) throw new Error('Unknown liquid metal finish: ' + data.id);
  // Hg reflects distinct bright windows and dark room forms like a mirror;
  // silver and other polished metals pick up a softer version of that room.
  const appearance = { ...finish, texture, envMap: finish.reflective ? workshopReflectionMap : null,
    emissiveIntensity: finish.mirror ? 0 : .025, solid: true, opacity: 1 };
  metalAppearanceCache.set(data.id, appearance);
  return appearance;
}

function getPigmentAppearance(data) {
  if (pigmentAppearanceCache.has(data.id)) return pigmentAppearanceCache.get(data.id);
  const texture = makePigmentLiquidTexture(THREE, data, pigmentAppearanceCache.size);
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const appearance = { texture, metalness: 0, roughness: .67, opacity: .93 };
  pigmentAppearanceCache.set(data.id, appearance);
  return appearance;
}

function getReceiverAppearance(info) {
  if (info.metalId) return metalAppearanceCache.get(info.metalId);
  if (info.pigmentId) {
    if (!receiverPigmentCache.has(info.pigmentId)) {
      const pigment = REAGENTS.find(data => data.id === info.pigmentId);
      if (pigment) receiverPigmentCache.set(info.pigmentId, {
        ...getPigmentAppearance(pigment), solid: true, opacity: 1
      });
    }
    return receiverPigmentCache.get(info.pigmentId) || null;
  }
  if (!mixedLiquidAppearance) mixedLiquidAppearance = {
    texture: makeMixedLiquidTexture(THREE), metalness: .025, roughness: .61,
    solid: true, opacity: 1, tint: true
  };
  return mixedLiquidAppearance;
}

function getBottleStickerTexture(data) {
  if (stickerTextureCache.has(data.id)) return stickerTextureCache.get(data.id);
  const asset = BOTTLE_STICKER_IMAGES[data.id];
  if (!asset) throw new Error('Missing bottle sticker for ' + data.id);
  const texture = stickerLoader.load(asset);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  stickerTextureCache.set(data.id, texture);
  return texture;
}

function createHoverSheen(parent, geometry) {
  const material = new THREE.MeshBasicMaterial({
    color: 0xe1f7e9, transparent: true, opacity: 0, depthWrite: false,
    side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false
  });
  const surface = mesh(geometry, material, parent, 0, 0, 0, false);
  surface.scale.set(1.014, 1, 1.014);
  surface.renderOrder = 10;
  return { surface, material };
}

function enablePearlescentLiquid(material) {
  material.onBeforeCompile = shader => {
    shader.uniforms.uPearlTime = pearlUniform;
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>',
      '#include <common>\nuniform float uPearlTime;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `
      #include <color_fragment>
      #ifdef USE_MAP
        // Slow directional sheen rides over the painted, seamless pigment.
        float pearlWave = sin(vMapUv.y * 15.0 - uPearlTime * .42 + sin(vMapUv.x * 6.283185) * 1.4);
        float pearlVeil = sin(vMapUv.x * 12.56637 + vMapUv.y * 8.0 + uPearlTime * .22);
        float pearl = smoothstep(.4, 1.0, pearlWave * .72 + pearlVeil * .28);
        diffuseColor.rgb = clamp(diffuseColor.rgb + pearl * vec3(.034, .041, .060), 0.0, 1.0);
      #endif
    `);
  };
}

function addFluid(parent, radius, maxHeight, maxAmount, initialAmount, colorHex, bottom = .13, kind = 'large', appearance = null) {
  const fluidMaterial = new THREE.MeshPhysicalMaterial({
    color: appearance ? 0xffffff : colorHex, map: appearance?.texture || null,
    roughness: appearance?.roughness ?? .15, metalness: appearance?.metalness ?? .02,
    clearcoat: appearance?.clearcoat ?? .6, clearcoatRoughness: appearance?.clearcoatRoughness ?? .15,
    envMap: appearance?.envMap || null, envMapIntensity: appearance?.envMapIntensity ?? 1,
    transparent: !appearance?.solid, opacity: appearance?.solid ? 1 : (appearance?.opacity ?? (appearance ? .95 : .84)),
    emissive: appearance?.mirror ? 0x000000 : appearance ? 0x111313 : colorHex,
    emissiveIntensity: appearance?.emissiveIntensity ?? (appearance ? .05 : .18),
    depthWrite: Boolean(appearance?.solid), side: THREE.DoubleSide
  });
  fluidMaterial.userData.preserveLiquidFinish = true;
  enablePearlescentLiquid(fluidMaterial);
  const segments = 48, layers = 22;
  const circle = circleSamples(segments);
  const positions = new Float32Array((layers + 1) * (segments + 1) * 3);
  const uvs = new Float32Array((layers + 1) * (segments + 1) * 2);
  for (let layer = 0; layer <= layers; layer++) for (let i = 0; i <= segments; i++) {
    const offset = (layer * (segments + 1) + i) * 2;
    uvs[offset] = i / segments;
    uvs[offset + 1] = layer / layers;
  }
  const indices = [];
  for (let layer = 0; layer < layers; layer++) for (let i = 0; i < segments; i++) {
    const a = layer * (segments + 1) + i, b = a + segments + 1;
    indices.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const sideGeometry = new THREE.BufferGeometry();
  const attribute = new THREE.BufferAttribute(positions, 3);
  attribute.setUsage(THREE.DynamicDrawUsage);
  sideGeometry.setAttribute('position', attribute);
  sideGeometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  sideGeometry.setIndex(indices);
  const inner = mesh(sideGeometry, fluidMaterial, parent, 0, 0, 0, false);
  inner.renderOrder = 3;
  const surfaceGeometry = new THREE.CircleGeometry(1, segments);
  surfaceGeometry.rotateX(-Math.PI / 2);
  const surfaceOriginals = surfaceGeometry.attributes.position.array.slice();
  const topMaterial = new THREE.MeshPhysicalMaterial({
    color: appearance ? 0xffffff : colorHex, map: appearance?.texture || null,
    roughness: appearance?.roughness ?? .12, metalness: appearance?.metalness ?? .08,
    clearcoat: appearance?.clearcoat ?? .6, clearcoatRoughness: appearance?.clearcoatRoughness ?? .15,
    envMap: appearance?.envMap || null, envMapIntensity: appearance?.envMapIntensity ?? 1,
    transparent: !appearance?.solid, opacity: appearance?.solid ? 1 : .96,
    depthWrite: Boolean(appearance?.solid), side: THREE.DoubleSide
  });
  topMaterial.userData.preserveLiquidFinish = true;
  enablePearlescentLiquid(topMaterial);
  const top = mesh(surfaceGeometry, topMaterial, parent, 0, 0, 0, false);
  top.renderOrder = 4;
  // A deformable tube follows the exact same sloped perimeter as the fluid.
  // The former static torus lagged behind when the vessel moved.
  const contourSides = 10;
  const contourCircle = circleSamples(contourSides);
  const contourPositions = new Float32Array((segments + 1) * contourSides * 3);
  const contourIndices = [];
  for (let i = 0; i < segments; i++) for (let j = 0; j < contourSides; j++) {
    const a = i * contourSides + j, b = (i + 1) * contourSides + j;
    const c = i * contourSides + (j + 1) % contourSides;
    const d = (i + 1) * contourSides + (j + 1) % contourSides;
    contourIndices.push(a, b, c, b, d, c);
  }
  const contourGeometry = new THREE.BufferGeometry();
  const contourAttribute = new THREE.BufferAttribute(contourPositions, 3);
  contourAttribute.setUsage(THREE.DynamicDrawUsage);
  contourGeometry.setAttribute('position', contourAttribute);
  contourGeometry.setIndex(contourIndices);
  const meniscus = mesh(contourGeometry, new THREE.MeshBasicMaterial({
    color: 0x28393c, transparent: true, opacity: .85, depthWrite: false,
    side: THREE.DoubleSide, toneMapped: false,
    polygonOffset: true, polygonOffsetFactor: -1.2, polygonOffsetUnits: -3
  }), parent, 0, 0, 0, false);
  meniscus.renderOrder = 5;
  // Two camera-facing silhouettes use the same animated profile as the liquid.
  const sideSegments = 10;
  const sideCircle = circleSamples(sideSegments);
  const sidePositions = new Float32Array(2 * (layers + 1) * sideSegments * 3);
  const sideIndices = [];
  for (let side = 0; side < 2; side++) {
    const offset = side * (layers + 1) * sideSegments;
    for (let layer = 0; layer < layers; layer++) for (let k = 0; k < sideSegments; k++) {
      const a = offset + layer * sideSegments + k;
      const b = a + sideSegments;
      const c = offset + layer * sideSegments + (k + 1) % sideSegments;
      const d = c + sideSegments;
      sideIndices.push(a, b, c, b, d, c);
    }
  }
  const sideOutlineGeometry = new THREE.BufferGeometry();
  const sideAttribute = new THREE.BufferAttribute(sidePositions, 3);
  sideAttribute.setUsage(THREE.DynamicDrawUsage);
  sideOutlineGeometry.setAttribute('position', sideAttribute);
  sideOutlineGeometry.setIndex(sideIndices);
  const sideOutline = mesh(sideOutlineGeometry, meniscus.material.clone(), parent, 0, 0, 0, false);
  sideOutline.renderOrder = 6;
  const bottomCap = kind === 'bottle'
    ? mesh(new THREE.CircleGeometry(liquidRadiusAt(kind, bottom, radius, bottom), segments), fluidMaterial, parent, 0, bottom, 0, false)
    : null;
  if (bottomCap) { bottomCap.geometry.rotateX(Math.PI / 2); bottomCap.renderOrder = 3; }
  const state = {
    inner, top, meniscus, sideOutline, bottomCap, parent, kind, radius, maxHeight, maxAmount, bottom,
    amount: initialAmount, shown: -1, hex: colorHex, fluidMaterial, appearance,
    positions, attribute, segments, layers, circle, surfaceOriginals,
    contourPositions, contourAttribute, contourSides, contourCircle, outlineWidth: 1, outlineVisible: true,
    outlineScale: 1 / (parent.scale.x || 1),
    sidePositions, sideAttribute, sideSegments, sideCircle, eye: new THREE.Vector3(),
    slosh: createSlosh(), slopeX: 0, slopeZ: 0, shift: 0,
    lastRendered: { level: NaN, slopeX: NaN, slopeZ: NaN, shift: NaN },
    lastSide: { level: NaN, slopeX: NaN, slopeZ: NaN, shift: NaN, yaw: NaN, width: NaN }
  };
  liquidContours.push({
    setStyle(active, width, color) {
      state.outlineVisible = active;
      state.outlineWidth = width;
      state.meniscus.material.color.copy(color);
      state.sideOutline.material.color.copy(color);
      state.meniscus.visible = active && state.amount > .05;
      state.sideOutline.visible = state.meniscus.visible;
      renderFluidSurface(state, state.slopeX, state.slopeZ, true);
    }
  });
  updateFluid(state, initialAmount, colorHex);
  return state;
}

function updateFluid(state, amount, colorHex = state.hex, appearance = state.appearance) {
  if (state.appearance !== appearance) {
    state.appearance = appearance;
    for (const material of [state.fluidMaterial, state.top.material]) {
      material.map = appearance?.texture || null;
      material.metalness = appearance?.metalness ?? .04;
      material.roughness = appearance?.roughness ?? .15;
      material.clearcoat = appearance?.clearcoat ?? .6;
      material.clearcoatRoughness = appearance?.clearcoatRoughness ?? .15;
      material.envMap = appearance?.envMap || null;
      material.envMapIntensity = appearance?.envMapIntensity ?? 1;
      material.transparent = !appearance?.solid;
      material.depthWrite = Boolean(appearance?.solid);
      material.opacity = appearance?.solid ? 1 : (appearance?.opacity ?? (appearance ? .95 : .84));
      material.needsUpdate = true;
    }
  }
  state.amount = amount;
  state.shown = state.bottom + state.maxHeight * (amount / state.maxAmount);
  state.hex = colorHex;
  const shown = amount > .05;
  state.inner.visible = state.top.visible = shown;
  state.meniscus.visible = state.sideOutline.visible = shown && state.outlineVisible;
  if (state.bottomCap) state.bottomCap.visible = shown;
  if (!shown) return;
  state.fluidMaterial.color.set(appearance && !appearance.tint ? '#ffffff' : colorHex);
  state.fluidMaterial.emissive.set(appearance?.mirror ? '#000000' : appearance ? '#111313' : colorHex);
  state.fluidMaterial.emissiveIntensity = appearance?.emissiveIntensity ?? (appearance ? .05 : .18);
  state.top.material.color.set(appearance && !appearance.tint ? '#ffffff' : colorHex);
  renderFluidSurface(state, state.slopeX, state.slopeZ, true);
}

function renderFluidSurface(state, slopeX = 0, slopeZ = 0, force = false) {
  if (!state.inner.visible) return;
  const level = state.shown;
  const topY = level + state.shift;
  const rTop = liquidRadiusAt(state.kind, topY, state.radius, state.bottom);
  const roomBelow = Math.max(.03, topY - state.bottom - .02);
  const safeSlope = Math.min(1, roomBelow / Math.max(.03, rTop * 1.45));
  const sx = THREE.MathUtils.clamp(slopeX, -.65, .65) * safeSlope;
  const sz = THREE.MathUtils.clamp(slopeZ, -.55, .55) * safeSlope;
  const last = state.lastRendered;
  const threshold = state.kind === 'bottle' ? .0008 : .003;
  if (!force && Math.abs(last.level - level) < threshold && Math.abs(last.slopeX - sx) < threshold && Math.abs(last.slopeZ - sz) < threshold && Math.abs(last.shift - state.shift) < threshold) {
    renderLiquidSideContours(state, sx, sz);
    return;
  }
  last.level = level; last.slopeX = sx; last.slopeZ = sz; last.shift = state.shift;
  for (let layer = 0; layer <= state.layers; layer++) {
    const { y, radius } = liquidRingAt(state.kind, layer, state.layers, level, state.radius, state.bottom, state.shift);
    for (let i = 0; i <= state.segments; i++) {
      const x = state.circle.cos[i] * radius, z = state.circle.sin[i] * radius;
      const index = (layer * (state.segments + 1) + i) * 3;
      state.positions[index] = x;
      state.positions[index + 1] = y + (layer === state.layers ? sx * x + sz * z : 0);
      state.positions[index + 2] = z;
    }
  }
  state.attribute.needsUpdate = true;
  state.inner.geometry.computeVertexNormals();
  state.inner.geometry.computeBoundingSphere();
  const topPosition = state.top.geometry.attributes.position;
  for (let i = 0; i < topPosition.count; i++) {
    const x = state.surfaceOriginals[i * 3] * rTop, z = state.surfaceOriginals[i * 3 + 2] * rTop;
    topPosition.setXYZ(i, x, topY + .006 + sx * x + sz * z, z);
  }
  topPosition.needsUpdate = true;
  state.top.geometry.computeVertexNormals();
  state.top.geometry.computeBoundingSphere();
  const tube = .007 * state.outlineWidth * state.outlineScale;
  for (let i = 0; i <= state.segments; i++) {
    const co = state.circle.cos[i], si = state.circle.sin[i];
    const x = co * rTop, z = si * rTop;
    const tangY = -si * sx + co * sz;
    const invLength = 1 / Math.sqrt(1 + tangY * tangY);
    const normalX = tangY * si * invLength;
    const normalY = invLength;
    const normalZ = -tangY * co * invLength;
    for (let j = 0; j < state.contourSides; j++) {
      const offset = i * state.contourSides * 3 + j * 3;
      const u = state.contourCircle.cos[j] * tube, v = state.contourCircle.sin[j] * tube;
      state.contourPositions[offset] = x + co * u + normalX * v;
      state.contourPositions[offset + 1] = topY + .009 + sx * x + sz * z + normalY * v;
      state.contourPositions[offset + 2] = z + si * u + normalZ * v;
    }
  }
  state.contourAttribute.needsUpdate = true;
  state.meniscus.geometry.computeBoundingSphere();
  renderLiquidSideContours(state, sx, sz, true);
}

function renderLiquidSideContours(state, sx, sz, force = false) {
  if (!state.sideOutline.visible) return;
  state.parent.updateWorldMatrix(true, false);
  const eye = state.parent.worldToLocal(camera.getWorldPosition(state.eye));
  const yaw = Math.atan2(eye.x, eye.z);
  const elevation = Math.atan2(Math.max(0, eye.y - state.shown * .5), Math.hypot(eye.x, eye.z));
  state.sideOutline.material.opacity = .85 * sideContourVisibility(elevation);
  const previous = state.lastSide;
  if (!force && Math.abs(previous.level - state.shown) < .003 &&
    Math.abs(previous.shift - state.shift) < .003 && Math.abs(previous.slopeX - sx) < .003 &&
    Math.abs(previous.slopeZ - sz) < .003 && Math.abs(previous.yaw - yaw) < .003 &&
    Math.abs(previous.width - state.outlineWidth) < .003) return;
  previous.level = state.shown;
  previous.shift = state.shift;
  previous.slopeX = sx;
  previous.slopeZ = sz;
  previous.yaw = yaw;
  previous.width = state.outlineWidth;
  state.sideOutline.rotation.y = yaw;
  const width = .007 * state.outlineWidth * state.outlineScale;
  const cosYaw = Math.cos(yaw), sinYaw = Math.sin(yaw);
  for (let side = 0; side < 2; side++) {
    const sign = side === 0 ? -1 : 1;
    for (let layer = 0; layer <= state.layers; layer++) {
      const profile = liquidRingAt(state.kind, layer, state.layers, state.shown, state.radius, state.bottom, state.shift);
      const x = sign * profile.radius * 1.008;
      const y = profile.y + (layer === state.layers ? sx * x * cosYaw - sz * x * sinYaw : 0);
      for (let k = 0; k < state.sideSegments; k++) {
        const index = (side * (state.layers + 1) * state.sideSegments + layer * state.sideSegments + k) * 3;
        state.sidePositions[index] = x + state.sideCircle.cos[k] * width;
        state.sidePositions[index + 1] = y;
        state.sidePositions[index + 2] = state.sideCircle.sin[k] * width;
      }
    }
  }
  state.sideAttribute.needsUpdate = true;
  state.sideOutline.geometry.computeBoundingSphere();
}

function makeLiquidShadowTexture() {
  const size = 96;
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = (x + .5 - size / 2) / (size / 2);
    const v = (y + .5 - size / 2) / (size / 2);
    const alpha = Math.pow(Math.max(0, 1 - u * u - v * v), 2.3);
    const index = (y * size + x) * 4;
    pixels[index] = 38; pixels[index + 1] = 46; pixels[index + 2] = 50;
    pixels[index + 3] = Math.round(alpha * 255);
  }
  const texture = new THREE.DataTexture(pixels, size, size, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}
function makeReceiverLiquidShadow(x, z) {
  const material = new THREE.MeshBasicMaterial({
    map: liquidShadowTexture, transparent: true, opacity: 0, depthWrite: false,
    toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2
  });
  const shadowSize = 1.6 * RECEIVER_SCALE / .70;
  const shadow = mesh(new THREE.PlaneGeometry(shadowSize, shadowSize), material, scene, x, .052, z, false);
  shadow.rotation.x = -Math.PI / 2;
  shadow.renderOrder = 1;
  return shadow;
}

function buildBigVessel(id, x) {
  const root = new THREE.Group();
  root.position.set(x, id === 'right' ? .95 : .17, -.55);
  root.scale.setScalar(RECEIVER_SCALE);
  scene.add(root);
  // The right vessel is suspended over the burner; its bottom stays exposed.
  if (id === 'left') {
    cyl(1.16, 1.22, .17, blackWood, root, 0, .02, 0);
    ring(1.17, .055, polishedBrass, root, 0, .118, 0);
    cyl(.84, .98, .22, oldBrass, root, 0, .22, 0);
    ring(.89, .028, polishedBrass, root, 0, .33, 0);
  } else ring(.92, .045, polishedBrass, root, 0, .36, 0);
  for (let i = 0; i < 3; i++) {
    const a = i * Math.PI * 2 / 3;
    const px = Math.cos(a) * .94, pz = Math.sin(a) * .94;
    cyl(.058, .068, 2.72, oldBrass, root, px, 1.55, pz);
    mesh(new THREE.SphereGeometry(.095, 12, 8), polishedBrass, root, px, 2.90, pz);
  }
  ring(.94, .055, brass, root, 0, 1.16, 0);
  ring(.96, .04, brass, root, 0, 2.65, 0);
  const glassHeight = 3.74;
  const glass = makeGlassContainer(root, .79, glassHeight, 'tube', 1 / RECEIVER_SCALE);
  const hover = createHoverSheen(root, glass.geometry);
  const fluid = addFluid(root, .695, 3.22, 160, 0, '#344446');
  glass.userData.fluid = fluid;
  const glow = new THREE.PointLight(0xffffff, 0, 3, 2);
  glow.position.set(0, 1.4, 0);
  root.add(glow);
  const hit = cyl(1.13, 1.13, 4.02, hitMat, root, 0, 2.00, 0, 18);
  hit.userData.interaction = { kind: 'receiver', id };
  hit.castShadow = hit.receiveShadow = false;
  interactionMeshes.push(hit);
  const liquidShadow = makeReceiverLiquidShadow(x, root.position.z);
  receivers.push({ id, root, x, glassHeight, state: emptyMixture(), fluid, glow, hover, hit, liquidShadow, shownVolume: 0 });
}

function buildBurner() {
  const root = new THREE.Group();
  root.position.set(3.95, .065, -.55);
  root.scale.set(.78, 1.60, .78);
  scene.add(root);
  cyl(.54, .68, .13, iron, root, 0, .075, 0);
  ring(.52, .028, polishedBrass, root, 0, .15, 0);
  cyl(.34, .40, .16, oldBrass, root, 0, .19, 0);
  cyl(.27, .30, .064, iron, root, 0, .295, 0);
  ring(.282, .026, polishedBrass, root, 0, .338, 0);
  for (let i = 0; i < 12; i++) {
    const theta = i / 12 * Math.PI * 2;
    box(.025, .042, .062, blackWood, root, Math.cos(theta) * .25, .307, Math.sin(theta) * .25);
  }
  // A physically connected, right-side switch. The visible grip is clickable.
  const socket = cyl(.105, .105, .26, oldBrass, root, .46, .195, .20);
  socket.rotation.z = Math.PI / 2;
  const switchPivot = new THREE.Group();
  switchPivot.position.set(.58, .195, .20);
  root.add(switchPivot);
  const lever = cyl(.055, .055, .37, polishedBrass, switchPivot, .18, 0, 0);
  lever.rotation.z = Math.PI / 2;
  // An unmistakable round ball grip, not a thin bar handle.
  mesh(new THREE.SphereGeometry(.168, 24, 16), polishedBrass, switchPivot, .36, 0, 0);
  const handleGlow = mesh(new THREE.SphereGeometry(.19, 20, 16), new THREE.MeshBasicMaterial({
    color: 0xffe6aa, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending
  }), switchPivot, .36, 0, 0, false);
  handleGlow.renderOrder = 12;
  const leverHit = mesh(new THREE.SphereGeometry(.29, 16, 12), hitMat, switchPivot, .35, 0, 0, false);
  leverHit.userData.interaction = { kind: 'burner' };
  interactionMeshes.push(leverHit);
  const flames = new THREE.Group();
  root.add(flames);
  const tongues = [];
  // Reuse the candles' flowing additive GLSL flame, crossed planes included.
  for (let i = 0; i < 3; i++) {
    const tongue = createCandleFlame(THREE, candleFlameMaterial, candleFlameGeometry);
    const a = i * Math.PI * 2 / 3;
    tongue.position.set(Math.cos(a) * .095, .53, Math.sin(a) * .095);
    tongue.scale.set(i === 0 ? 1.05 : .78, i === 0 ? .48 : .34, i === 0 ? 1.05 : .78);
    tongue.rotation.y = a;
    flames.add(tongue);
    tongue.userData.flameScale = tongue.scale.y;
    tongues.push(tongue);
  }
  const light = new THREE.PointLight(0xffb36e, 0, 2.6, 2);
  light.position.set(0, .52, 0);
  root.add(light);
  // Tiny heated bubbles use one instanced draw call inside the right flask.
  const vessel = receivers.find(r => r.id === 'right');
  // The support cage and the burner are mechanically connected by three
  // outward-splayed iron stays. Their endpoints meet the existing burner
  // crown and receiving vessel's lower brass hoop exactly in world space.
  const support = new THREE.Group();
  support.name = 'burner-vessel-connector';
  support.position.set(root.position.x, 0, root.position.z);
  scene.add(support);
  const lowerY = root.position.y + root.scale.y * .338;
  const upperY = vessel.root.position.y + vessel.root.scale.y * .36;
  const lowerR = .52 * root.scale.x;
  const upperR = .92 * vessel.root.scale.x;
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < 3; i++) {
    const a = -Math.PI / 2 + i * Math.PI * 2 / 3;
    const from = new THREE.Vector3(Math.cos(a) * lowerR, lowerY, Math.sin(a) * lowerR);
    const to = new THREE.Vector3(Math.cos(a) * upperR, upperY, Math.sin(a) * upperR);
    const direction = new THREE.Vector3().subVectors(to, from);
    const brace = cyl(.038, .044, direction.length(), oldBrass, support,
      (from.x + to.x) / 2, (from.y + to.y) / 2, (from.z + to.z) / 2, 16);
    brace.quaternion.setFromUnitVectors(up, direction.normalize());
    brace.name = 'burner-support-stay';
    brace.userData.supportEndpoints = { lower: from.clone(), upper: to.clone() };
    mesh(new THREE.SphereGeometry(.048, 12, 10), polishedBrass, support, to.x, to.y, to.z);
  }
  const bubbleMesh = new THREE.InstancedMesh(
    new THREE.SphereGeometry(1, 10, 8),
    new THREE.MeshPhysicalMaterial({ color: 0xd7f4f0, roughness: .1, clearcoat: 1, metalness: .12,
      transparent: true, opacity: .39, depthWrite: false, depthTest: true }), 18
  );
  bubbleMesh.count = 0;
  bubbleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  bubbleMesh.frustumCulled = false;
  bubbleMesh.renderOrder = 3.5;
  bubbleMesh.castShadow = bubbleMesh.receiveShadow = false;
  vessel.root.add(bubbleMesh);
  flames.visible = false;
  switchPivot.rotation.z = -.38;
  burner = { root, support, flames, tongues, light, vessel, bubbleMesh, switchPivot, leverHit, handleGlow, active: false, kind: 'burner' };
}

function buildDrainValve() {
  const vessel = receivers.find(receiver => receiver.id === 'right');
  const root = vessel.root;
  // A short pipe exits the glass on its LEFT, then bends down over a catch dish.
  const pipe = cyl(.095, .095, .64, oldBrass, root, -1.08, .61, .31, 24);
  pipe.rotation.z = Math.PI / 2;
  pipe.castShadow = false;
  const collar = cyl(.128, .128, .085, brass, root, -.83, .61, .31, 24);
  collar.rotation.z = Math.PI / 2;
  collar.castShadow = false;
  const downpipe = cyl(.075, .087, .31, oldBrass, root, -1.40, .435, .31, 20);
  downpipe.castShadow = false;
  const outlet = ring(.086, .020, polishedBrass, root, -1.40, .28, .31, 24);
  outlet.castShadow = false;
  const pivot = new THREE.Group();
  pivot.position.set(-1.28, .79, .40);
  root.add(pivot);
  cyl(.11, .11, .13, oldBrass, pivot, 0, 0, 0).rotation.x = Math.PI / 2;
  const lever = cyl(.048, .048, .34, polishedBrass, pivot, -.17, 0, .07, 16);
  lever.rotation.z = Math.PI / 2;
  mesh(new THREE.SphereGeometry(.105, 16, 12), brass, pivot, -.34, 0, .07);
  const handleGlow = mesh(new THREE.SphereGeometry(.134, 16, 12), new THREE.MeshBasicMaterial({
    color: 0xffe8b8, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending
  }), pivot, -.34, 0, .07, false);
  handleGlow.renderOrder = 12;
  const hit = mesh(new THREE.SphereGeometry(.31, 14, 12), hitMat, pivot, -.34, 0, .07, false);
  hit.userData.interaction = { kind: 'drain' };
  interactionMeshes.push(hit);
  pivot.traverse(part => {
    if (part.isMesh) { part.castShadow = false; part.receiveShadow = false; }
  });

  const streamX = root.position.x - 1.40 * RECEIVER_SCALE;
  const streamZ = root.position.z + .31 * RECEIVER_SCALE;
  // The funnel has a dark painted interior and a pipe that continues below
  // the worktop, so drained liquid has a believable destination.
  cyl(.285, .30, .085, oldBrass, scene, streamX, .092, streamZ);
  const drainHole = cyl(.236, .236, .008, new THREE.MeshStandardMaterial({
    color: 0xffffff, map: makeDarkDrainTexture(), roughness: 1, metalness: 0
  }), scene, streamX, .141, streamZ);
  drainHole.name = 'dark-drain-hole';
  ring(.278, .036, polishedBrass, scene, streamX, .155, streamZ);
  ring(.225, .009, iron, scene, streamX, .150, streamZ);
  const catchLiquid = cyl(.116, .116, .009, new THREE.MeshStandardMaterial({
    color: 0xb3d4c2, roughness: .34, metalness: .24, transparent: true, opacity: .40, depthWrite: false
  }), scene, streamX, .154, streamZ);
  catchLiquid.visible = false;
  catchLiquid.castShadow = false;
  const path = new THREE.CatmullRomCurve3([
    new THREE.Vector3(streamX, .04, streamZ),
    new THREE.Vector3(streamX, -.39, streamZ),
    new THREE.Vector3(streamX, -.97, streamZ + .15),
    new THREE.Vector3(streamX + .09, -1.21, streamZ + .65),
    new THREE.Vector3(streamX + .22, -1.73, streamZ + 1.02),
    new THREE.Vector3(streamX + .42, -2.0, streamZ + 1.17)
  ]);
  const wasteHose = mesh(new THREE.TubeGeometry(path, 48, .088, 12, false),
    new THREE.MeshStandardMaterial({ color: 0x202c2b, roughness: .85, metalness: .15 }), scene);
  wasteHose.name = 'under-table-drain-hose';
  const hoseCollar = cyl(.14, .14, .18, oldBrass, scene, streamX, -.93, streamZ + .16);
  hoseCollar.name = 'drain-hose-collar';
  const streamMaterial = new THREE.MeshStandardMaterial({
    color: 0xb8d8d2, roughness: .25, metalness: .12, transparent: true, opacity: .84, depthWrite: false
  });
  const stream = mesh(new THREE.CylinderGeometry(.026, .042, 1, 12), streamMaterial,
    scene, streamX, .66, streamZ, false);
  stream.scale.y = .96;
  stream.visible = false;
  drainValve = {
    vessel, pivot, handleGlow, hit, stream, catchLiquid,
    draining: false, elapsed: 0, duration: 0, fromVolume: 0, basePigment: [], baseAdditions: []
  };
}

function drainRightVessel() {
  if (animation || drainValve.draining) return false;
  const vessel = drainValve.vessel;
  if (vessel.state.volume < .5) {
    showToast('Правый сосуд уже пуст');
    return false;
  }
  drainValve.fromVolume = vessel.state.volume;
  drainValve.basePigment = [...vessel.state.pigment];
  drainValve.baseAdditions = vessel.state.additions.map(addition => ({ ...addition }));
  drainValve.duration = 1.25 + vessel.state.volume / vessel.state.capacity * .85;
  drainValve.elapsed = 0;
  drainValve.draining = true;
  recipeResult = null;
  recipeHeatSeconds = 0;
  recipeTimeline = [];
  setBurner(false);
  stopwatch.reset();
  drainValve.stream.material.color.set(mixtureInfo(vessel.state).hex);
  drainValve.catchLiquid.material.color.copy(drainValve.stream.material.color);
  drainValve.stream.visible = true;
  drainValve.catchLiquid.visible = true;
  showToast('Открыт слив правого сосуда');
  return true;
}

function updateDrain(dt) {
  if (!drainValve.draining) return;
  const valve = drainValve, vessel = valve.vessel;
  valve.elapsed = Math.min(valve.duration, valve.elapsed + dt);
  const remaining = Math.pow(1 - valve.elapsed / valve.duration, 1.18);
  vessel.state.volume = valve.fromVolume * remaining;
  vessel.state.pigment = valve.basePigment.map(part => part * remaining);
  vessel.state.additions = valve.baseAdditions.map(item => ({ ...item, amount: item.amount * remaining }));
  // Gentle wobble makes the small stream read as moving liquid.
  valve.stream.position.x = valve.vessel.x - 1.40 * RECEIVER_SCALE + Math.sin(elapsed * 13) * .008;
  valve.stream.scale.x = valve.stream.scale.z = .83 + .12 * Math.sin(elapsed * 17);
  if (valve.elapsed >= valve.duration) {
    vessel.state = emptyMixture();
    vessel.shownVolume = 0;
    updateFluid(vessel.fluid, 0, '#344446');
    vessel.glow.intensity = 0;
    valve.draining = false;
    valve.stream.visible = false;
    showToast('Правый сосуд опустошён · 0 мл');
  }
}

function toggleBurner() {
  const finishedHeating = burner.active;
  setBurner(!burner.active);
  if (finishedHeating && recipeHeatSeconds > 0 && drainValve.vessel.state.volume > 0) {
    const stages = observeRecipeStages(recipeTimeline, REAGENTS);
    if (recipeLevel === 3 && stages.length < currentRecipe.stages.length) {
      showToast('Промежуточный нагрев завершён · теперь добавь ингредиенты этапа II');
    } else {
      const result = evaluatePotion();
      showToast(`Зелье сварено на ${result.score}% · ${result.grade.toLowerCase()}`);
    }
  } else showToast(burner.active ? 'Горелка зажжена' : 'Горелка погашена');
}

function setBurner(active) {
  if (active && !burner.active) stopwatch.start();
  if (!active && burner.active) stopwatch.stop();
  if (active && !burner.active) {
    recipeResult = null;
    burner.recipeHeatEvent = { kind: 'heat', seconds: 0 };
    recipeTimeline.push(burner.recipeHeatEvent);
  }
  if (!active) burner.recipeHeatEvent = null;
  burner.active = active;
  burner.flames.visible = active;
  burner.light.intensity = active ? 10 : 0;
  if (!active) burner.bubbleMesh.count = 0;
}

function bindRecipeBook() {
  const pigmentNames = { red: 'Красный', blue: 'Синий', yellow: 'Жёлтый', white: 'Белый' };
  $('recipe-key-pigments').innerHTML = REAGENTS.filter(item => item.kind === 'tube').map(item =>
    `<span><i class="recipe-key-dot" style="--pigment:${PIGMENT_SWATCHES[item.id]}"></i>${pigmentNames[item.id]}</span>`
  ).join('');
  $('recipe-metal-reference').innerHTML = METAL_REFERENCE_ORDER.map(id => {
    const metal = REAGENTS.find(item => item.id === id);
    const sign = PLANETARY_METALS[id];
    return `<tr><td><span class="recipe-key-symbol" aria-label="${sign.planet}">${sign.glyph}</span></td>` +
      `<td>${sign.planet}</td><td>${metal.name}</td><td>${sign.atomicNumber} ${metal.symbol}</td></tr>`;
  }).join('');
  $('recipe-close').addEventListener('click', closeRecipeBook);
  $('recipe-grade').addEventListener('click', evaluatePotion);
  $('recipe-next').addEventListener('click', resetAll);
  for (const level of [1, 2, 3]) {
    $('recipe-level-' + level).addEventListener('click', () => setRecipeLevel(level));
  }
  $('recipe-page-prev').addEventListener('click', () => setRecipeLevel(recipeLevel - 1));
  $('recipe-page-next').addEventListener('click', () => setRecipeLevel(recipeLevel + 1));
  $('recipe-overlay').addEventListener('click', event => {
    if (event.target === $('recipe-overlay')) closeRecipeBook();
  });
  renderRecipeBook();
}

function openRecipeBook() {
  renderRecipeBook();
  $('recipe-overlay').hidden = false;
  setHover(null);
}

function closeRecipeBook() {
  $('recipe-overlay').hidden = true;
}

function evaluatePotion() {
  recipeResult = evaluateRecipe(currentRecipe, drainValve.vessel.state, recipeHeatSeconds, REAGENTS, recipeTimeline);
  renderRecipeBook();
  return recipeResult;
}

function renderRecipeBook() {
  const byId = new Map(REAGENTS.map(item => [item.id, item]));
  const formulaItem = ingredient => {
    const reagent = byId.get(ingredient.id);
    const icon = reagent.kind === 'tube'
      ? `<i class="recipe-pigment" style="--pigment:${PIGMENT_SWATCHES[reagent.id]}"></i>`
      : `<b class="recipe-metal" aria-label="${PLANETARY_METALS[reagent.id].planet}">${PLANETARY_METALS[reagent.id].glyph}</b>`;
    return `<span class="recipe-dose"><span class="recipe-value">${ingredient.count}</span>${icon}</span>`;
  };
  const heatItem = seconds => `<span class="recipe-dose"><span class="recipe-value">${seconds}</span>` +
    '<svg class="recipe-fire" viewBox="0 0 100 100" role="img" aria-label="Огонь">' +
    '<path d="M50 8 L8 94 L92 94 Z" fill="none" stroke="currentColor" stroke-width="8" stroke-linejoin="round"/></svg></span>';
  $('recipe-number').textContent = `ОПЫТ № ${String(currentRecipe.number).padStart(2, '0')}`;
  $('recipe-level-description').textContent = RECIPE_LEVELS[recipeLevel].caption;
  for (const level of [1, 2, 3]) {
    const button = $('recipe-level-' + level);
    button.classList[level === recipeLevel ? 'add' : 'remove']('active');
    button.setAttribute('aria-pressed', String(level === recipeLevel));
  }
  $('recipe-page-prev').disabled = recipeLevel === 1;
  $('recipe-page-next').disabled = recipeLevel === 3;
  $('recipe-equation').setAttribute('data-level', String(recipeLevel));
  $('recipe-equation').innerHTML = currentRecipe.stages.map((stage, index) => {
    const terms = [...stage.ingredients.map(formulaItem), heatItem(stage.heatSeconds)];
    return `<div class="recipe-step">` +
      (recipeLevel === 3 ? `<div class="recipe-step-label">ЭТАП ${index + 1} · ${index === 0 ? 'ПРОМЕЖУТОЧНЫЙ НАГРЕВ' : 'ЗАВЕРШЕНИЕ'}</div>` : '') +
      `<div class="recipe-step-formula">${terms.join('<span class="recipe-plus" aria-hidden="true">+</span>')}</div></div>`;
  }).join('');
  $('recipe-legend').innerHTML = currentRecipe.stages.map((stage, index) => {
    const ingredients = stage.ingredients.map(item => {
      const reagent = byId.get(item.id);
      return `${reagent.name} (${item.count} × ${reagent.dose} мл)`;
    });
    return `<div>${recipeLevel === 3 ? `Этап ${index + 1} · ` : ''}${ingredients.join(' · ')} · нагрев ${stage.heatSeconds} с</div>`;
  }).join('');
  const state = drainValve.vessel.state;
  const measured = evaluateRecipe(currentRecipe, state, recipeHeatSeconds, REAGENTS, recipeTimeline);
  const format = n => Number(n.toFixed(1)).toLocaleString('ru-RU');
  $('recipe-progress').innerHTML = measured.stageDetails.map((stage, index) =>
    (recipeLevel === 3 ? `<div class="recipe-progress-heading">ЭТАП ${index + 1}</div>` : '') +
    stage.ingredients.map(item =>
      `<div><span>${byId.get(item.id).name}</span><b>${format(item.actual)} / ${item.expected}</b></div>`
    ).join('') +
    `<div><span>Нагрев</span><b>${format(stage.heatSeconds)} / ${stage.expectedHeatSeconds} с</b></div>`
  ).join('') +
    `<div><span>Лишние компоненты</span><b>${format(measured.extras)}</b></div>`;
  $('recipe-result').innerHTML = recipeResult
    ? `<strong>${recipeResult.score}%</strong><span>${recipeResult.grade}</span>`
    : '<small>Результат появится после варки или проверки состава.</small>';
}

const bubbleDummy = new THREE.Object3D();
function animateHeatedBubbles() {
  const { bubbleMesh, vessel } = burner;
  const fluid = vessel.fluid;
  if (!burner.active || vessel.state.volume < 2 || fluid.shown - fluid.bottom < .07) {
    bubbleMesh.count = 0;
    return;
  }
  const bubbles = bubbleMesh.count = 18;
  const floor = fluid.bottom + .045;
  const travel = Math.max(.04, fluid.shown - floor - .018);
  for (let i = 0; i < bubbles; i++) {
    const phase = (elapsed * (.35 + i % 4 * .067) + i * .193) % 1;
    const y = floor + phase * travel;
    const available = Math.max(.035, liquidRadiusAt('large', y, fluid.radius, fluid.bottom) - .07);
    const radius = Math.min(available * .68, .09 + (i % 5) * .053);
    const theta = i * 2.39996;
    bubbleDummy.position.set(
      Math.cos(theta) * radius + Math.sin(elapsed * 1.6 + i) * .015,
      y, Math.sin(theta) * radius + Math.cos(elapsed * 1.3 + i * 2) * .013
    );
    const size = (.017 + i % 4 * .006) * Math.min(1, (1 - phase) * 6 + .1);
    bubbleDummy.scale.set(size, size * (1.23 + .16 * Math.sin(elapsed * 3 + i)), size);
    bubbleDummy.updateMatrix();
    bubbleMesh.setMatrixAt(i, bubbleDummy.matrix);
  }
  bubbleMesh.instanceMatrix.needsUpdate = true;
}

function buildSourceTube(data, x) {
  const root = new THREE.Group();
  root.position.set(x, .22, -1.04);
  scene.add(root);
  const initial = data.amount;
  const color = pigmentColor(data.parts).hex;
  const glass = makeGlassContainer(root, .245, 2.30);
  const hover = createHoverSheen(root, glass.geometry);
  const fluid = addFluid(root, .21, 1.38, initial, initial, color, .095, 'tube', getPigmentAppearance(data));
  glass.userData.fluid = fluid;
  // The mouth is part of the glass mesh itself, without a separate neck ring.
  const halo = ring(.32, .02, new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0, depthWrite: false }), root, 0, .24, 0);
  halo.castShadow = false;
  const hit = cyl(.34, .34, 2.55, hitMat, root, 0, 1.24, 0, 12);
  hit.userData.interaction = { kind: 'source', id: data.id };
  hit.castShadow = hit.receiveShadow = false;
  interactionMeshes.push(hit);
  sourceObjects.push({ data, root, initial, amount: initial, fluid, halo, hover, hit, height: 2.3, original: root.position.clone(), color, motion: makeSourceMotion(root) });
}

function buildBottleHolder(data, x, y, z) {
  const holder = new THREE.Group();
  holder.name = `bottle-holder-${data.id}`;
  holder.position.set(x, y, z);
  scene.add(holder);
  // The stand belongs to the table, not to the movable bottle.
  const hoop = ring(.462, .024, iron, holder, 0, .30, 0);
  hoop.name = 'bottle-holding-ring';
  const post = cyl(.042, .052, .66, iron, holder, 0, .20, -.72, 16);
  post.name = 'bottle-support-post';
  const foot = cyl(.14, .14, .065, oldBrass, holder, 0, -.10, -.72);
  foot.name = 'bottle-support-foot';
  const upward = new THREE.Vector3(0, 1, 0);
  for (const side of [-1, 1]) {
    const from = new THREE.Vector3(side * .14, .30, -.72);
    const to = new THREE.Vector3(side * .17, .30, -.43);
    const displacement = to.clone().sub(from);
    const brace = cyl(.026, .028, displacement.length(), oldBrass, holder,
      (from.x + to.x) / 2, (from.y + to.y) / 2, (from.z + to.z) / 2, 12);
    brace.quaternion.setFromUnitVectors(upward, displacement.normalize());
    brace.name = 'bottle-support-brace';
  }
  // Seven circular projected shadows on the tabletop looked like dark stains.
  // The visible rods and hoops remain, but do not cast these oversized rings.
  holder.traverse(part => { if (part.isMesh) part.castShadow = false; });
  return holder;
}

function buildBottle(data, x) {
  const root = new THREE.Group();
  root.position.set(x, -.39, 2.10);
  scene.add(root);
  const holder = buildBottleHolder(data, x, root.position.y, root.position.z);
  const initial = data.amount;
  const color = data.hex;
  const glass = makeGlassContainer(root, .41, 1.21, 'bottle');
  const hover = createHoverSheen(root, glass.geometry);
  const fluid = addFluid(root, .355, .676, initial, initial, color, .12, 'bottle', getMetalAppearance(data));
  glass.userData.fluid = fluid;
  const stopper = new THREE.Group();
  stopper.position.y = CORK_SEAT_Y;
  root.add(stopper);
  // A single gouache cork material, including its wider hand-pulled crown.
  const plug = cyl(.155, .125, .21, corkMat, stopper, 0, 0, 0);
  const crown = cyl(.171, .171, .075, corkMat, stopper, 0, .126, 0);
  // Transparent glass/cork should not cast harsh black disks on the tabletop.
  plug.castShadow = crown.castShadow = false;
  // Hide the cylinder's UV join behind the bottle as the cork pores grow.
  plug.rotation.y = crown.rotation.y = Math.PI;
  // The illustrated die-cut parchment follows the curved glass and shoulder,
  // retaining its transparent outline instead of a rectangular paper band.
  const labelMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff, map: getBottleStickerTexture(data), roughness: 1, metalness: 0,
    transparent: true, alphaTest: .04, depthWrite: false, side: THREE.DoubleSide,
    polygonOffset: true, polygonOffsetFactor: -2
  });
  const label = mesh(bottleStickerGeometry, labelMaterial, root, 0, 0, 0, false);
  label.name = 'illustrated-sticker-' + data.id;
  label.renderOrder = 11;
  const halo = ring(.51, .02, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false }), root, 0, .12, 0);
  halo.castShadow = false;
  const hit = cyl(.50, .50, 1.48, hitMat, root, 0, .72, 0, 12);
  hit.userData.interaction = { kind: 'source', id: data.id };
  hit.castShadow = hit.receiveShadow = false;
  interactionMeshes.push(hit);
  sourceObjects.push({ data, root, holder, stopper, initial, amount: initial, fluid, halo, hover, hit, height: 1.20, original: root.position.clone(), color, motion: makeSourceMotion(root) });
}

function makeSourceMotion(root) {
  return { target: root.position.clone(), dragging: false, returning: false, tilt: 0 };
}

function buildDust() {
  const count = 190;
  const coords = new Float32Array(count * 3);
  const baseX = new Float32Array(count);
  let seed = 44421;
  const rand = () => { seed = (Math.imul(seed, 1103515245) + 12345) | 0; return (seed >>> 0) / 4294967296; };
  for (let i = 0; i < count; i++) {
    coords[i * 3] = baseX[i] = (rand() - .5) * 16;
    coords[i * 3 + 1] = .3 + rand() * 5;
    coords[i * 3 + 2] = (rand() - .5) * 7;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(coords, 3));
  const material = new THREE.PointsMaterial({ color: 0xf2dfb4, size: .027, transparent: true, opacity: .43, depthWrite: false, sizeAttenuation: true });
  const points = new THREE.Points(geo, material);
  points.frustumCulled = false;
  scene.add(points);
  particles.push({ coords, baseX, geo, count });
}

function project(x, y, z) {
  const displayCamera = runtime.embedded ? lair?.camera || camera : camera;
  const vec = scene.localToWorld(new THREE.Vector3(x, y, z)).project(displayCamera);
  return { x: (vec.x * .5 + .5) * canvas.clientWidth, y: (-vec.y * .5 + .5) * canvas.clientHeight };
}

function onResize() {
  const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
  if (!runtime.embedded) backgroundEffects.resize(w, h);
  visuals.resize(w, h);
  applyCamera();
}

function applyCamera() {
  // Keep both receivers visible even when the visual sidebar narrows the stage.
  const halfFov = THREE.MathUtils.degToRad(camera.fov * .5);
  const fitDistance = 10.9 / (2 * Math.tan(halfFov) * Math.max(camera.aspect, .4));
  orbit.distance = THREE.MathUtils.clamp(Math.max(14.4, fitDistance), 14.4, 34) * orbit.zoom;
  const horizontalDistance = Math.cos(orbit.pitch) * orbit.distance;
  camera.position.set(
    cameraTarget.x + Math.sin(orbit.yaw) * horizontalDistance,
    cameraTarget.y + Math.sin(orbit.pitch) * orbit.distance,
    cameraTarget.z + Math.cos(orbit.yaw) * horizontalDistance
  );
  camera.lookAt(cameraTarget);
  camera.updateMatrixWorld(true);
}

function onWheel(event) {
  if (!runtime.isActive()) return;
  event.preventDefault();
  if (runtime.embedded && lair?.alchemy.manipulate) {
    lair.alchemy.manipulate({zoom: Math.exp(event.deltaY * .001)});
    return;
  }
  orbit.zoom = THREE.MathUtils.clamp(orbit.zoom * Math.exp(event.deltaY * .001), .7, 1.75);
  applyCamera();
}

function mouseToNdc(event) {
  const rect = inputSurface.getBoundingClientRect();
  ndc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  ndc.y = 1 - ((event.clientY - rect.top) / rect.height) * 2;
  raycaster.setFromCamera(ndc, runtime.embedded ? lair?.camera || camera : camera);
}

function getHit(event, mode = 'any') {
  mouseToNdc(event);
  const hits = raycaster.intersectObjects(interactionMeshes, false);
  const hit = hits.find(h => mode === 'any' || h.object.userData.interaction.kind === mode);
  if (!hit) return null;
  const { kind, id } = hit.object.userData.interaction;
  if (kind === 'burner') return burner;
  if (kind === 'drain') return drainValve;
  if (kind === 'recipe') return recipeBookHit;
  return kind === 'source' ? sourceObjects.find(s => s.data.id === id) : receivers.find(r => r.id === id);
}

function onPointerDown(event) {
  if (!runtime.isActive()) return;
  if (event.button !== 0 && event.button !== 2) return;
  if (event.metaKey && event.button === 0) {
    press = { kind: 'pan', id: event.pointerId, x: event.clientX, y: event.clientY, target: cameraTarget.clone(), right: new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0), up: new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1) };
    inputSurface.setPointerCapture(event.pointerId);
    setHover(null);
    inputSurface.style.cursor = 'move';
    return;
  }
  const object = event.button === 2 || animation ? null : getHit(event);
  if (event.button === 2 || !object) {
    press = { kind: 'orbit', id: event.pointerId, x: event.clientX, y: event.clientY, yaw: orbit.yaw, pitch: orbit.pitch };
    inputSurface.setPointerCapture(event.pointerId);
    setHover(null);
    inputSurface.style.cursor = 'grabbing';
    return;
  }
  if (object === burner) {
    toggleBurner();
    setHover(burner, event);
    return;
  }
  if (object === recipeBookHit) {
    openRecipeBook();
    return;
  }
  if (object === drainValve) {
    drainRightVessel();
    setHover(drainValve, event);
    return;
  }
  if (object.data) {
    selected = object;
    press = { kind: 'source', id: event.pointerId, x: event.clientX, y: event.clientY, lastX: event.clientX, source: object, dragged: false,
      anchor: beginSourceDrag(THREE, object, sourceSpaceRay(object)) };
    object.motion.returning = false;
    inputSurface.setPointerCapture(event.pointerId);
    setHover(null);
    updateHighlights();
  } else if (selected) {
    pour(selected, object);
  } else {
    showToast('Выберите пигмент или металл в центре или внизу');
  }
}

function onPointerMove(event) {
  if (!runtime.isActive()) return;
  if (press?.kind === 'pan' && press.id === event.pointerId) {
    if (runtime.embedded && lair?.alchemy.manipulate) {
      lair.alchemy.manipulate({panX: event.clientX - press.x, panY: event.clientY - press.y});
      press.x = event.clientX; press.y = event.clientY;
      return;
    }
    const unitsPerPixel = 2 * orbit.distance * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / canvas.clientHeight;
    cameraTarget.copy(press.target)
      .addScaledVector(press.right, -(event.clientX - press.x) * unitsPerPixel)
      .addScaledVector(press.up, (event.clientY - press.y) * unitsPerPixel);
    cameraTarget.x = THREE.MathUtils.clamp(cameraTarget.x, -3.5, 3.5);
    cameraTarget.y = THREE.MathUtils.clamp(cameraTarget.y, .25, 4.2);
    cameraTarget.z = THREE.MathUtils.clamp(cameraTarget.z, -2.8, 1.6);
    applyCamera();
    return;
  }
  if (press && press.kind === 'orbit' && press.id === event.pointerId) {
    if (runtime.embedded && lair?.alchemy.manipulate) {
      lair.alchemy.manipulate({rotateX: event.clientX - press.x, rotateY: event.clientY - press.y});
      press.x = event.clientX; press.y = event.clientY;
      return;
    }
    orbit.yaw = THREE.MathUtils.clamp(press.yaw - (event.clientX - press.x) * .0055, -1.25, 1.25);
    orbit.pitch = THREE.MathUtils.clamp(press.pitch + (event.clientY - press.y) * .0045, .08, .99);
    applyCamera();
    return;
  }
  if (animation) return;
  if (press && press.kind === 'source' && press.id === event.pointerId) {
    const distance = Math.hypot(event.clientX - press.x, event.clientY - press.y);
    if (distance > 7) press.dragged = true;
    if (press.dragged) {
      mouseToNdc(event);
      if (positionSourceDrag(THREE, press.source, press.anchor, sourceSpaceRay(press.source), tmpVec)) {
        const source = press.source;
        source.motion.target.copy(tmpVec);
        source.motion.dragging = true;
        source.motion.returning = false;
        source.motion.tilt = THREE.MathUtils.clamp(-(event.clientX - press.lastX) * .012, -.24, .24);
        press.lastX = event.clientX;
      }
      const target = getHit(event, 'receiver') || proximityReceiver(event);
      updateHighlights(target);
      $('guide').classList.add('hidden');
    }
    return;
  }
  setHover(getHit(event), event);
}

function proximityReceiver(event) {
  const radius = Math.max(70, canvas.clientWidth * .105);
  return receivers.find(r => {
    const p = project(r.x, r.root.position.y + 1.85 * RECEIVER_SCALE, r.root.position.z);
    return Math.hypot(p.x - (event.clientX - canvas.getBoundingClientRect().left), p.y - (event.clientY - canvas.getBoundingClientRect().top)) < radius;
  }) || null;
}

function onPointerUp(event) {
  if (!runtime.isActive()) return;
  if (!press || event.pointerId !== press.id) return;
  if (press.kind === 'orbit' || press.kind === 'pan') {
    press = null;
    try { inputSurface.releasePointerCapture(event.pointerId); } catch {}
    inputSurface.style.cursor = 'grab';
    return;
  }
  const { source, dragged } = press;
  press = null;
  source.motion.dragging = false;
  try { inputSurface.releasePointerCapture(event.pointerId); } catch {}
  if (!dragged) {
    selected = source;
    showToast(`${source.data.name} · нажми на большой сосуд`);
    updateHighlights();
    return;
  }
  const target = getHit(event, 'receiver') || proximityReceiver(event);
  if (target) pour(source, target);
  else {
    restoreSource(source);
    selected = null;
    updateHighlights();
  }
}

function onPointerCancel() {
  if (!runtime.isActive()) return;
  if (press?.kind === 'source') restoreSource(press.source);
  press = null;
  selected = null;
  inputSurface.style.cursor = 'grab';
  updateHighlights();
}

function restoreSource(source, immediate = false) {
  source.motion.dragging = false;
  source.motion.returning = !immediate;
  source.motion.target.copy(source.original);
  source.motion.tilt = 0;
  if (immediate) {
    source.root.position.copy(source.original);
    source.root.rotation.set(0, 0, 0);
    positionPourLiquid(source, 0);
  }
  if (source.stopper && !animation) resetStopper(source);
}

function resetStopper(source) {
  if (!source.stopper) return;
  if (source.stopper.parent !== source.root) source.root.attach(source.stopper);
  source.stopper.position.set(0, CORK_SEAT_Y, 0);
  source.stopper.rotation.set(0, 0, 0);
  source.stopper.visible = true;
}

function positionPourLiquid(source, progress) {
  const f = source.fluid;
  // Stretch only the upper layers toward the tilted neck. Keeping the lower
  // layers in place preserves the rounded bottom and avoids a floating plug.
  const maximumShift = source.data.kind === 'tube'
    ? Math.max(0, source.height - f.shown)
    : Math.max(0, 1.17 - f.shown);
  f.shift = maximumShift * progress;
}

function restoreAllSources(immediate = false) { for (const source of sourceObjects) restoreSource(source, immediate); }

function updateHandMotion(dt) {
  for (const source of sourceObjects) {
    if (animation?.source === source) continue;
    const motion = source.motion;
    if (!motion.dragging && !motion.returning) continue;
    const response = motion.dragging ? 12 : 6.5;
    const weight = 1 - Math.exp(-response * dt);
    source.root.position.lerp(motion.target, weight);
    source.root.rotation.z = follow(source.root.rotation.z, motion.dragging ? motion.tilt : 0, dt, response);
    if (motion.returning && source.root.position.distanceToSquared(source.original) < .0005 && Math.abs(source.root.rotation.z) < .006) restoreSource(source, true);
  }
}

function setHover(object, event) {
  if (object === hoverObject) {
    if (event && object) moveTooltip(event);
    return;
  }
  hoverObject = object;
  inputSurface.style.cursor = object ? 'pointer' : 'grab';
  const tooltip = $('tooltip');
  if (object && event) {
    if (object.data) {
      tooltip.textContent = `${object.data.name} · ${Math.round(object.amount)} мл · ${object.amount ? 'перелить' : 'закончилась'}`;
    } else if (object === burner) {
      tooltip.textContent = burner.active ? 'Ручка горелки · выключить' : 'Ручка горелки · включить';
    } else if (object === drainValve) {
      tooltip.textContent = drainValve.draining ? 'Рычаг слива · сливается' : 'Рычаг слива · опустошить правый сосуд';
    } else if (object === recipeBookHit) {
      tooltip.textContent = 'Лист рецепта · открыть книгу';
    } else {
      tooltip.textContent = `${object.id === 'left' ? 'Левый' : 'Правый'} сосуд · ${Math.round(object.state.volume)} / 160 мл`;
    }
    tooltip.classList.add('visible');
    moveTooltip(event);
  } else tooltip.classList.remove('visible');
  updateHighlights();
}

function moveTooltip(event) {
  const t = $('tooltip');
  t.style.left = Math.min(canvas.clientWidth - 190, event.clientX - canvas.getBoundingClientRect().left) + 'px';
  t.style.top = Math.max(65, event.clientY - canvas.getBoundingClientRect().top) + 'px';
}

function updateHighlights(dragTarget = null) {
  dragHoverTarget = dragTarget;
  for (const s of sourceObjects) {
    // The source itself brightens gently on hover; no selected-area halo.
    s.halo.material.opacity = 0;
  }
  // The complete large vessel brightens through its glass surface in render().
  // No circular area indicators are drawn on the table.
}

function pour(source, target) {
  if (animation || drainValve.draining) return;
  if (source.amount < 1) { showToast('Реагент закончился — сброс обновит запас'); return; }
  if (target.state.volume >= target.state.capacity) { showToast('Сосуд заполнен'); restoreSource(source); return; }
  const available = Math.min(source.data.dose, source.amount, target.state.capacity - target.state.volume);
  const side = target.x < 0 ? 1 : -1;
  const pose = pouringPose({
    targetX: target.x,
    targetZ: target.root.position.z,
    targetRimY: target.root.position.y + target.glassHeight * RECEIVER_SCALE,
    targetRadius: .72 * RECEIVER_SCALE,
    sourceHeight: source.height,
    side
  });
  const to = new THREE.Vector3(pose.x, pose.y, pose.z);
  const angle = pose.angle;
  const skin = createJetSkin(source.fluid.fluidMaterial);
  source.motion.dragging = source.motion.returning = false;
  animation = {
    source, target, available, jet: createLiquidJet(available), skin,
    to, angle, phase: source.stopper ? 'uncork' : 'tilt', phaseTime: 0,
    from: source.root.position.clone(), startAngle: source.root.rotation.z,
    baseRate: available / .79, recorded: false
  };
  selected = null;
  hoverObject = null;
  $('tooltip').classList.remove('visible');
  $('guide').classList.add('hidden');
  $('experience').classList.add('pouring');
  updateHighlights(target);
}

const ease = t => t * t * (3 - 2 * t);
const JET_SIDES = 10, JET_MAX_RINGS = 180;

function createJetSkin(material) {
  const coords = new Float32Array(JET_MAX_RINGS * JET_SIDES * 3);
  const uvs = new Float32Array(JET_MAX_RINGS * JET_SIDES * 2);
  const geometry = new THREE.BufferGeometry();
  const attribute = new THREE.BufferAttribute(coords, 3);
  const uvAttribute = new THREE.BufferAttribute(uvs, 2);
  attribute.setUsage(THREE.DynamicDrawUsage);
  uvAttribute.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position', attribute);
  geometry.setAttribute('uv', uvAttribute);
  const indices = [];
  for (let ring = 0; ring < JET_MAX_RINGS - 1; ring++) for (let side = 0; side < JET_SIDES; side++) {
    const a = ring * JET_SIDES + side, b = (ring + 1) * JET_SIDES + side;
    const c = ring * JET_SIDES + (side + 1) % JET_SIDES;
    const d = (ring + 1) * JET_SIDES + (side + 1) % JET_SIDES;
    indices.push(a, b, c, b, d, c);
  }
  geometry.setIndex(indices);
  geometry.setDrawRange(0, 0);
  const stream = mesh(geometry, material, scene, 0, 0, 0, false);
  stream.renderOrder = 6;
  stream.frustumCulled = false;
  stream.visible = false;
  const tip = mesh(new THREE.SphereGeometry(1, 12, 9), material, scene, 0, 0, 0, false);
  tip.renderOrder = 6;
  tip.visible = false;
  return {
    stream, tip, coords, attribute, uvs, uvAttribute,
    side: new THREE.Vector3(), tangent: new THREE.Vector3(), forward: new THREE.Vector3()
  };
}

function updateJetSkin(a) {
  const { source, jet, skin } = a;
  const points = [];
  const mouthRadius = source.data.kind === 'tube' ? .209 : .132;
  if (jet.flowing && jet.parcels.length) {
    source.root.updateMatrix();
    const insideY = source.data.kind === 'tube'
      ? source.height - .17
      : source.height - .18;
    const liquidRadius = liquidRadiusAt(source.fluid.kind, insideY, source.fluid.radius, source.fluid.bottom);
    points.push({ point: new THREE.Vector3(0, insideY, 0).applyMatrix4(source.root.matrix), radius: Math.min(mouthRadius, liquidRadius) });
    points.push({ point: new THREE.Vector3(0, source.height + .013, 0).applyMatrix4(source.root.matrix), radius: mouthRadius });
  }
  for (let i = jet.parcels.length - 1; i >= 0; i--) {
    const p = jet.parcels[i];
    // Conservation of flux: the jet narrows naturally as its parcels accelerate.
    const launchSpeed = .82;
    const currentSpeed = Math.max(launchSpeed, Math.hypot(p.vx, p.vy, p.vz));
    const radius = Math.max(.043, mouthRadius * Math.sqrt(launchSpeed / currentSpeed));
    points.push({ point: new THREE.Vector3(p.x, p.y, p.z), radius });
  }
  // Keep the skinned column visibly connected to the actual fluid surface.
  // Its last point is the measured impact of ballistic parcels, not a floating
  // tip at the receiver's upper rim.
  if (jet.touched && jet.lastImpact && jet.parcels.length && points.length) {
    const impact = new THREE.Vector3(jet.lastImpact.x,
      a.target.root.position.y + (a.target.fluid.shown + a.target.fluid.shift) * RECEIVER_SCALE,
      jet.lastImpact.z);
    if (impact.y <= points[points.length - 1].point.y + .1) {
      points.push({ point: impact, radius: .039 });
    }
  }
  skin.tip.visible = points.length > 0 && !jet.touched;
  if (skin.tip.visible) {
    skin.tip.position.copy(points[points.length - 1].point);
    skin.tip.scale.setScalar(points[points.length - 1].radius * .85);
  }
  if (points.length < 2) { skin.stream.visible = false; return; }
  const path = [points[0]];
  for (let i = 1; i < points.length && path.length < JET_MAX_RINGS; i++) {
    const from = points[i - 1], to = points[i];
    const segments = Math.max(1, Math.min(12, Math.ceil(from.point.distanceTo(to.point) / .065)));
    for (let j = 1; j <= segments && path.length < JET_MAX_RINGS; j++) {
      const t = j / segments;
      path.push({ point: from.point.clone().lerp(to.point, t), radius: THREE.MathUtils.lerp(from.radius, to.radius, t) });
    }
  }
  const { side, tangent, forward } = skin;
  const crossSection = circleSamples(JET_SIDES);
  for (let i = 0; i < path.length; i++) {
    const previous = path[Math.max(i - 1, 0)].point, next = path[Math.min(i + 1, path.length - 1)].point;
    tangent.copy(next).sub(previous).normalize();
    side.set(tangent.y, -tangent.x, 0);
    if (side.lengthSq() < .00001) side.set(1, 0, 0);
    side.normalize();
    forward.crossVectors(tangent, side).normalize();
    const radius = path[i].radius * (1 + .018 * Math.sin(i * 1.39 + elapsed * 16));
    for (let k = 0; k < JET_SIDES; k++) {
      const index = (i * JET_SIDES + k) * 3;
      const ca = radius * crossSection.cos[k], sa = radius * crossSection.sin[k];
      skin.coords[index] = path[i].point.x + side.x * ca + forward.x * sa;
      skin.coords[index + 1] = path[i].point.y + side.y * ca + forward.y * sa;
      skin.coords[index + 2] = path[i].point.z + side.z * ca + forward.z * sa;
      skin.uvs[(i * JET_SIDES + k) * 2] = k / JET_SIDES;
      skin.uvs[(i * JET_SIDES + k) * 2 + 1] = i / Math.max(1, path.length - 1) * 1.35;
    }
  }
  skin.attribute.needsUpdate = true;
  skin.uvAttribute.needsUpdate = true;
  skin.stream.geometry.setDrawRange(0, (path.length - 1) * JET_SIDES * 6);
  skin.stream.geometry.computeVertexNormals();
  skin.stream.visible = true;
}

function cleanPour(a) {
  scene.remove(a.skin.stream, a.skin.tip);
  a.skin.stream.geometry.dispose();
  a.skin.tip.geometry.dispose();
  a.jet.parcels.length = 0;
}

function updatePour(dt) {
  if (!animation) return;
  const a = animation;
  const { source: s, target: r } = a;
  a.phaseTime += dt;
  if (a.phase === 'uncork') {
    // Physically lift the cork out of the narrow mouth before tilting.
    const p = ease(Math.min(1, a.phaseTime / .23));
    s.stopper.position.y = CORK_SEAT_Y + .47 * p;
    s.stopper.rotation.z = .12 * p;
    if (p >= 1) {
      scene.attach(s.stopper);
      a.corkFrom = s.stopper.position.clone();
      a.corkStartAngle = s.stopper.rotation.z;
      a.corkPark = new THREE.Vector3(s.original.x + .48, .20, s.original.z + .40);
      a.corkAbove = new THREE.Vector3(s.original.x, s.original.y + CORK_SEAT_Y + .47, s.original.z);
      a.corkSeated = new THREE.Vector3(s.original.x, s.original.y + CORK_SEAT_Y, s.original.z);
      a.phase = 'tilt'; a.phaseTime = 0;
    }
  } else if (a.phase === 'tilt') {
    const p = ease(Math.min(1, a.phaseTime / .43));
    s.root.position.copy(a.from).lerp(a.to, p);
    s.root.rotation.z = THREE.MathUtils.lerp(a.startAngle, a.angle, p);
    s.root.rotation.x = 0;
    positionPourLiquid(s, p);
    if (s.stopper) {
      s.stopper.position.copy(a.corkFrom).lerp(a.corkPark, p);
      s.stopper.rotation.z = THREE.MathUtils.lerp(a.corkStartAngle, .35, p);
    }
    if (p >= 1) { a.phase = 'flow'; a.phaseTime = 0; }
  } else if (a.phase === 'flow') {
    s.root.position.copy(a.to);
    s.root.rotation.z = a.angle;
    positionPourLiquid(s, 1);
    // Both the jet and the receiving vessel are expressed in laboratory coordinates.
    s.root.updateMatrix();
    const mouth = new THREE.Vector3(0, s.height + .009, 0).applyMatrix4(s.root.matrix);
    const outside = new THREE.Vector3(0, s.height + 1.009, 0).applyMatrix4(s.root.matrix);
    const direction = outside.sub(mouth).normalize();
    const head = s.amount / Math.max(1, s.initial);
    // A gentle exit speed keeps the gravity-curved stream inside the glass
    // all the way from the mouth to the receiving liquid.
    const speed = .62 + .11 * Math.sqrt(head);
    const rate = outflowRate(s.root.rotation.z, head, a.baseRate);
    const emitted = emitLiquid(a.jet, mouth, direction, speed, rate, dt);
    if (emitted > 0) {
      s.amount = Math.max(0, s.amount - emitted);
      updateFluid(s.fluid, s.amount, s.color);
      positionPourLiquid(s, 1);
    }
    if (a.jet.emitted >= a.available - 1e-5 || a.phaseTime > 2.30) {
      a.jet.flowing = false;
      a.phase = 'return';
      a.phaseTime = 0;
    }
  } else if (a.phase === 'return') {
    const p = ease(Math.min(1, a.phaseTime / .46));
    s.root.position.copy(a.to).lerp(s.original, p);
    s.root.rotation.z = a.angle * (1 - p);
    s.root.rotation.x = 0;
    positionPourLiquid(s, 1 - p);
    if (p >= 1) {
      if (s.stopper) { a.phase = 'recork'; a.phaseTime = 0; }
      else { restoreSource(s, true); a.phase = 'settle'; a.phaseTime = 0; }
    }
  } else if (a.phase === 'recork') {
    const p = Math.min(1, a.phaseTime / .50);
    if (p < .58) {
      const t = ease(p / .58);
      s.stopper.position.copy(a.corkPark).lerp(a.corkAbove, t);
      s.stopper.rotation.z = .35 * (1 - t);
    } else {
      const t = ease((p - .58) / .42);
      s.stopper.position.copy(a.corkAbove).lerp(a.corkSeated, t);
      s.stopper.rotation.z = 0;
    }
    if (p >= 1) {
      resetStopper(s);
      restoreSource(s, true);
      a.phase = 'settle'; a.phaseTime = 0;
    }
  }
  const result = advanceLiquidJet(a.jet, dt, {
    x: r.x, z: r.root.position.z,
    rimY: r.root.position.y + (r.glassHeight - .14) * RECEIVER_SCALE,
    surfaceY: r.root.position.y + (r.fluid.shown + r.fluid.shift) * RECEIVER_SCALE,
    radius: .72 * RECEIVER_SCALE, floorY: -.3
  });
  if (result.received > 0) {
    addDose(r.state, s.data, result.received, { mergeLast: a.recorded });
    if (r.id === 'right') {
      recipeResult = null;
      // A pour can last hundreds of frames; remember it as one measured
      // addition, in order, so intermediate heating can be assessed.
      if (!a.recipeEvent) {
        a.recipeEvent = { kind: 'add', id: s.data.id, amount: 0 };
        recipeTimeline.push(a.recipeEvent);
      }
      a.recipeEvent.amount += result.received;
    }
    a.recorded = true;
    splashSlosh(r.fluid.slosh, .11);
    r.glow.color.set(mixtureInfo(r.state).hex);
  }
  updateJetSkin(a);
  if (a.phase === 'settle' && a.jet.parcels.length === 0) {
    const color = mixtureInfo(r.state);
    if (a.jet.received > 0) showToast(`${s.data.name} → ${color.name.toLowerCase()} · ${Math.round(a.jet.received)} мл`);
    else showToast('Эссенция пролилась мимо сосуда');
    cleanPour(a);
    animation = null;
    $('experience').classList.remove('pouring');
    updateHighlights();
  }
}

function showToast(message) {
  const toast = $('toast');
  toast.textContent = message;
  toast.classList.add('show');
  toastTimer = 2.5;
}

function clearAlchemistTable() {
  if (animation) {
    resetStopper(animation.source);
    cleanPour(animation);
    animation = null;
  }
  $('experience').classList.remove('pouring');
  press = selected = hoverObject = null;
  restoreAllSources(true);
  for (const source of sourceObjects) {
    source.amount = source.initial;
    source.fluid.slosh = createSlosh();
    updateFluid(source.fluid, source.amount, source.color);
  }
  for (const receiver of receivers) {
    receiver.state = emptyMixture();
    receiver.shownVolume = 0;
    receiver.glow.intensity = 0;
    receiver.fluid.slosh = createSlosh();
    updateFluid(receiver.fluid, 0, '#344446');
  }
  drainValve.draining = false;
  drainValve.stream.visible = false;
  drainValve.catchLiquid.visible = false;
  drainValve.pivot.rotation.z = 0;
  setBurner(false);
  stopwatch.reset();
  recipeHeatSeconds = 0;
  recipeResult = null;
  recipeTimeline = [];
  $('guide').classList.remove('hidden');
  updateHighlights();
}

function showCurrentRecipe() {
  recipeBoard.paint(currentRecipe);
  backgroundEffects.invalidateRoom();
  renderRecipeBook();
}

function setRecipeLevel(level) {
  if (!RECIPE_LEVELS[level]) return false;
  if (level === recipeLevel) return true;
  clearAlchemistTable();
  recipeLevel = level;
  currentRecipe = recipesByLevel.get(level);
  showCurrentRecipe();
  showToast(`Страница ${level} · ${RECIPE_LEVELS[level].title.toLowerCase()}`);
  return true;
}

function resetAll() {
  clearAlchemistTable();
  const previous = currentRecipe;
  let next;
  for (let attempt = 0; attempt < 12; attempt++) {
    next = generateRecipe(REAGENTS, Math.random, ++recipeNumber, recipeLevel);
    if (JSON.stringify(next.stages) !== JSON.stringify(previous.stages)) break;
  }
  currentRecipe = next;
  recipesByLevel.set(recipeLevel, next);
  showCurrentRecipe();
  showToast(`Новый рецепт уровня ${recipeLevel} · стол подготовлен`);
}

function render() {
  if (document.hidden) return; // No GPU or particle updates behind a hidden tab.
  const frameDelta = timer.update().getDelta();
  const dt = Math.min(frameDelta, .045);
  elapsed += dt;
  // Heating uses wall-clock frame time, not the capped physics delta: at a
  // lower FPS a displayed second must still be one real second.
  if (burner.active) {
    const addedHeat = Math.max(0, Math.min(120 - recipeHeatSeconds, frameDelta, .25));
    recipeHeatSeconds += addedHeat;
    if (burner.recipeHeatEvent) burner.recipeHeatEvent.seconds += addedHeat;
  }
  if (!$('recipe-overlay').hidden && Math.floor(elapsed * 2) !== Math.floor((elapsed - dt) * 2)) renderRecipeBook();
  pearlUniform.value = elapsed;
  candleTimeUniform.value = elapsed;
  stopwatch.tick(dt);
  // Slow wash motion gives the inks a restrained mother-of-pearl shimmer.
  const textureScrollY = (elapsed * .011) % 1;
  const textureScrollX = Math.sin(elapsed * .24) * .008;
  for (const texture of animatedLiquidTextures) {
    texture.offset.set(textureScrollX, textureScrollY);
  }
  updateHandMotion(dt);
  updatePour(dt);
  updateDrain(dt);
  for (const [index, source] of sourceObjects.entries()) {
    const fluid = source.fluid;
    const hovered = source === hoverObject && !press && !animation;
    source.hover.material.opacity = follow(source.hover.material.opacity, hovered ? .115 : 0, dt, 7.8);
    stepSlosh(fluid.slosh, source.root.position, source.root.rotation.z, dt);
    const inBottle = source.data.kind === 'bottle';
    fluid.slopeX = fluid.slosh.slopeX + (inBottle ? .04 : .004) * Math.sin(elapsed * .81 + index * 1.6);
    fluid.slopeZ = fluid.slosh.slopeZ + (inBottle ? .029 : .003) * Math.sin(elapsed * .67 + index);
    if (inBottle && animation?.source !== source) fluid.shift = .006 * Math.sin(elapsed * .73 + index * .88);
    renderFluidSurface(fluid, fluid.slopeX, fluid.slopeZ);
  }
  for (const [index, receiver] of receivers.entries()) {
    const hovered = (receiver === hoverObject || receiver === dragHoverTarget) && !animation;
    receiver.hover.material.opacity = follow(receiver.hover.material.opacity, hovered ? .19 : 0, dt, 8);
    const intended = receiver.state.volume;
    if (Math.abs(receiver.shownVolume - intended) > .08) {
      receiver.shownVolume = THREE.MathUtils.lerp(receiver.shownVolume, intended, Math.min(1, dt * 6));
      const info = mixtureInfo(receiver.state);
      const appearance = getReceiverAppearance(info);
      updateFluid(receiver.fluid, receiver.shownVolume, info.hex, appearance);
    }
    receiver.glow.intensity = THREE.MathUtils.lerp(receiver.glow.intensity, intended > 0 ? 1.0 : 0, Math.min(1, dt * 1.8));
    const shadowOpacity = intended > 0 ? .09 + .14 * Math.min(1, intended / receiver.state.capacity) : 0;
    receiver.liquidShadow.material.opacity = follow(receiver.liquidShadow.material.opacity, shadowOpacity, dt, 4);
    const fluid = receiver.fluid;
    stepSlosh(fluid.slosh, receiver.root.position, 0, dt);
    fluid.slopeX = fluid.slosh.slopeX + .003 * Math.sin(elapsed * .64 + index);
    fluid.slopeZ = fluid.slosh.slopeZ + .003 * Math.sin(elapsed * .79 + index);
    renderFluidSurface(fluid, fluid.slopeX, fluid.slopeZ);
  }
  animateHeatedBubbles();
  const leverAngle = burner.switchPivot.rotation.z;
  burner.switchPivot.rotation.z = follow(leverAngle, burner.active ? .47 : -.38, dt, 9.5);
  if (Math.abs(burner.switchPivot.rotation.z - leverAngle) > .005) renderer.shadowMap.needsUpdate = true;
  burner.handleGlow.material.opacity = follow(burner.handleGlow.material.opacity,
    hoverObject === burner ? .36 : 0, dt, 11);
  drainValve.handleGlow.material.opacity = follow(drainValve.handleGlow.material.opacity,
    hoverObject === drainValve ? .38 : 0, dt, 11);
  drainValve.pivot.rotation.z = follow(drainValve.pivot.rotation.z,
    drainValve.draining ? 1.06 : 0, dt, 8);
  camera.updateMatrixWorld(true);
  const movingVessel = Boolean(animation || press || sourceObjects.some(source =>
    source.motion.dragging || source.motion.returning));
  const displayCamera = runtime.embedded ? lair?.camera || camera : camera;
  displayCamera.updateMatrixWorld(true);
  if (!contoursInitialized || movingVessel || !lastContourCameraMatrix.equals(displayCamera.matrixWorld)) {
    for (const contour of glassContours) contour.updateCamera(displayCamera);
    lastContourCameraMatrix.copy(displayCamera.matrixWorld);
    contoursInitialized = true;
  }
  if (burner.active) {
    burner.light.intensity = 9.5 + Math.sin(elapsed * 14) * 1.5;
    burner.tongues.forEach((tongue, i) => {
      tongue.scale.y = tongue.userData.flameScale * (1 + .12 * Math.sin(elapsed * 13 + i * 1.6));
      tongue.rotation.z = .07 * Math.sin(elapsed * 6.3 + i * 1.6);
    });
  }
  for (const candle of candles) {
    const fluctuation = Math.sin(elapsed * 8 + candle.seed) * .08 + Math.sin(elapsed * 12.7 + candle.seed) * .04;
    candle.flame.scale.y = .96 + fluctuation;
    candle.flame.rotation.z = Math.sin(elapsed * 3.3 + candle.seed) * .055;
    candle.glow.intensity = 9.5 + fluctuation * 8;
  }
  particleStepAccumulated += dt;
  if (particleStepAccumulated >= 1 / 30) {
  const particleDt = particleStepAccumulated;
  particleStepAccumulated = 0;
  for (const p of particles) {
    for (let i = 0; i < p.count; i++) {
      const index = i * 3;
      p.coords[index] = p.baseX[i] + Math.sin(elapsed * .19 + i) * .035;
      p.coords[index + 1] += particleDt * (.023 + (i % 9) * .006);
      if (p.coords[index + 1] > 5.45) p.coords[index + 1] = .28;
    }
    p.geo.attributes.position.needsUpdate = true;
  }
  }
  if (toastTimer > 0) {
    toastTimer -= dt;
    if (toastTimer <= 0) $('toast').classList.remove('show');
  }
  sunbeams.update(elapsed, keyLightStrength / 100, camera);
  if (!runtime.embedded) {
    backgroundEffects.render(scene, camera, elapsed);
    sunbeams.render(renderer);
  }
  fpsWindow += Math.min(frameDelta, .25);
  fpsFrames++;
  if (fpsWindow >= .55) {
    $('scene-fps').textContent = String(Math.round(fpsFrames / fpsWindow));
    const triangles = renderer.info?.render?.triangles ?? 0;
    $('scene-triangles').textContent = Math.round(triangles).toLocaleString('ru-RU');
    fpsWindow = fpsFrames = 0;
  }
}
