import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createMaterials } from './room/materials.js';
import { buildLair } from './room/build.js';
import { createRoomOutlines, mountVisualSettings } from './ui/visual-settings.js';
import { mountWorkshopOverlay } from './workshops/workshop-overlay.js';
import { mountAtelierInRoom } from './workshops/atelier-in-room.js';
import { mountAlchemyInRoom } from './workshops/alchemy-in-room.js';
import { createSharedRendererHost } from './rendering/shared-renderer-host.js';
import { createCartoonFilter } from '@keynlock/atelier/src/effects/cartoon-filter.js';
import { addRoomLighting } from './room/lighting.js';
import { createDayNight } from './room/day-night.js';
import { mountPerformancePanel } from './ui/performance-panel.js';
import './ui/performance.css';
import { createZoneTransitions, ATELIER_EASELS } from './navigation/zone-transitions.js';
import { createAtelierView } from './workshops/atelier-view.js';
import { createInitialLoadingGate } from './ui/initial-loading.js';
import { getWorkshopApi, setWorkshopHost } from '../../../core/host/workshop-host.js';
import { bindLanguageSelect, t, translator } from './i18n.js';
import './style.css';
import './ui/initial-loading.css';
import './ui/visual.css';
import './workshops/workshop-overlay.css';

// The page is written in Russian; translate the Lair's own markup before the
// workshops mount theirs (their interfaces are not translated yet).
document.documentElement.lang = translator.language;
translator.translateTree(document);
bindLanguageSelect(document.querySelector('#lair-language'));

// What the Lair offers the workshops it mounts (see core/host/workshop-host.js).
const host = setWorkshopHost({ atelier: {}, alchemy: {} });
// Read-only handles for browser tests and debugging in the console.
window.__keynlockDebug = { host, workshop: getWorkshopApi };

const canvas = document.querySelector('#scene');
const interaction = document.querySelector('#scene-interaction');
const loading = document.querySelector('#loading');
const fallback = document.querySelector('#fallback');
const panel = document.querySelector('#zone-panel');
let renderer, scene, camera, controls, room, rendererHost, atelierFilter;
let visualUI, workshopOverlay, zoneTransitions, atelierView, dayNight;
let lastFrameTriangles = 0;
let lastDrawCalls = 0;
let performancePanel = null;
let startPointer = null;
let hoveredZone = null;
const homePosition = new THREE.Vector3(.25, 8.35, 31.2);
const homeTarget = new THREE.Vector3(0, 4.70, 9.60);
const roomMinDistance = 3;
const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

function setup() {
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  } catch (error) {
    console.error('KEYNLOCK WebGL unavailable', error);
    fallback.hidden = false;
    loading.classList.add('done');
    return;
  }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.10;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const loadingBar = loading.querySelector('.loading-line i');
  const loadingStatus = loading.querySelector('small');
  let galleryLoaded = false;
  let alchemyLoaded = false;
  const completeInitialLoad = () => {
    if (galleryLoaded && alchemyLoaded) {
      // Compile the shaders for the workshops' lighting before the veil lifts,
      // so the first visit to the lab or the Atelier does not freeze.
      void Promise.resolve(zoneTransitions?.precompileWorkshopLighting())
        .catch(error => console.warn('Shader warm-up failed:', error))
        .finally(() => initialLoading.finish());
    }
    else if (galleryLoaded) {
      loadingStatus.textContent = t('ПОДГОТАВЛИВАЕМ АЛХИМИЧЕСКУЮ ЛАБОРАТОРИЮ');
      loadingBar.style.width = '94%';
    }
  };
  const initialLoading = createInitialLoadingGate({
    onProgress: ({ loaded, total }) => {
      loading.classList.add('is-tracking');
      loadingStatus.textContent = t('ЗАГРУЖАЕМ КАРТИНЫ · {loaded} / {total}', { loaded, total });
      loadingBar.style.width = `${total ? loaded / total * 100 : 100}%`;
    },
    onDone: (reason) => {
      if (reason !== 'ready') console.warn('Начальная загрузка мастерских завершилась по таймауту или с ошибкой:', reason);
      loading.setAttribute('aria-busy', 'false');
      loading.classList.add('done');
    },
  });
  window.addEventListener('keynlock:atelier', (event) => {
    const { type, loaded, total } = event.detail || {};
    if (type === 'initial-gallery-progress') initialLoading.progress(loaded, total);
    if (type === 'initial-gallery-ready') {galleryLoaded = true;completeInitialLoad();}
    if (type === 'error') initialLoading.finish('error');
  });
  window.addEventListener('keynlock:alchemy:v1',event => {
    if (event.detail?.type === 'ready') {alchemyLoaded = true;completeInitialLoad();}
    if (event.detail?.type === 'error') initialLoading.finish('error');
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(47, 1, .06, 115);
  camera.position.copy(homePosition);
  host.camera = camera;
  host.interactionElement = interaction;
  controls = new OrbitControls(camera, interaction);
  host.controls = controls;
  controls.target.copy(homeTarget);
  controls.enabled = true;
  controls.enableRotate = true;
  controls.enableDamping = true;
  controls.dampingFactor = .075;
  // OrbitControls maps Command + left drag to pan when panning is enabled.
  controls.enablePan = true;
  controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
  controls.mouseButtons.RIGHT = THREE.MOUSE.ROTATE;
  controls.panSpeed = .72;
  controls.minDistance = roomMinDistance;
  controls.maxDistance = 44;
  controls.minPolarAngle = .15;
  controls.maxPolarAngle = Math.PI - .15;
  controls.minAzimuthAngle = -Infinity;
  controls.maxAzimuthAngle = Infinity;
  controls.rotateSpeed = .55;
  controls.zoomSpeed = .70;


  const lighting = addRoomLighting({ THREE, scene });
  // Keep the source laboratory's original lighting legible in this shared room.
  // The source rig is registered separately and activated only at its workshop.
  const roomLights = scene.children.filter(child => child.isLight);
  const { materials, visual } = createMaterials();
  room = buildLair(scene, materials);
  // Render the preserved Atelier shader against the room's real canvas and
  // camera. The embedded source renderer is a proxy and cannot post-process
  // what the visitor sees through this common viewport.
  atelierFilter = createCartoonFilter({ THREE, renderer, scene, camera });
  rendererHost = createSharedRendererHost({renderer,canvas,worldScene:scene});
  host.renderer = rendererHost;
  // The workbench runs in an iframe (it is developed separately) and finds the
  // shared renderer here; the Atelier and the lab use the host module instead.
  window.__keynlockRendererHost = rendererHost;
  workshopOverlay = mountWorkshopOverlay({
    rendererHost,
    onExit: () => zoneTransitions.reset(),
    onReady: id => zoneTransitions.onWorkshopReady(id),
  });
  const outlines = createRoomOutlines(scene);
  // The window, the city, the room light and the lamps change together, gradually.
  performancePanel = mountPerformancePanel({ document, renderer, scene, canvas });
  dayNight = createDayNight(night => { room.setNight(night); lighting.setNight(night); });
  visualUI = mountVisualSettings({ visual, room, setNight: night => dayNight.set(night), outlines, atelierFilter,
    grain: document.querySelector('.grain'), onOpen: () => { panel.hidden = true; } });
  atelierView = createAtelierView({
    camera, controls, canvas, interaction, rendererHost, atelierFilter, host,
    easelPose: ATELIER_EASELS, roomMinDistance,
    navigation: {
      isInAtelier: () => zoneTransitions.current() === 'atelier',
      roomFov: () => zoneTransitions.roomFov(),
      stopApproach: () => zoneTransitions.stopApproach(),
      openAtelier: () => zoneTransitions.open('atelier'),
    },
  });
  zoneTransitions = createZoneTransitions({
    scene, camera, controls, canvas, interaction, renderer, rendererHost, atelierFilter,
    workshopOverlay, atelierView, visualUI, homePosition, homeTarget, roomMinDistance,
    roomLights,
  });
  host.alchemy.manipulate = zoneTransitions.manipulateAlchemy;
  host.alchemy.resetCamera = zoneTransitions.resetAlchemyCamera;

  window.addEventListener('resize', resize);
  interaction.addEventListener('pointerdown', e => { startPointer = [e.clientX, e.clientY]; });
  atelierView.bind();
  const atelierElement = mountAtelierInRoom(host);
  const alchemyElement = mountAlchemyInRoom(host);
  alchemyElement.querySelector('.lair-alchemy-exit')?.addEventListener('click', zoneTransitions.reset);
  const observeAtelierMenu = () => document.querySelector('#app').style.setProperty(
    '--atelier-panel-height', `${Math.round(atelierElement.getBoundingClientRect().height)}px`);
  new ResizeObserver(observeAtelierMenu).observe(atelierElement);
  observeAtelierMenu();
  interaction.addEventListener('pointermove', hover3D);
  interaction.addEventListener('click', click3D);
  window.addEventListener('keydown', e => { if (e.key === 'Meta') interaction.classList.add('command-pan'); });
  window.addEventListener('keyup', e => { if (e.key === 'Meta') interaction.classList.remove('command-pan'); });
  window.addEventListener('blur', () => interaction.classList.remove('command-pan'));
  resize();
  animate();
}

function resize() {
  if (!renderer || !camera) return;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  camera.aspect = w / Math.max(h, 1);
  zoneTransitions.resizeCamera(w);
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
  atelierFilter?.resize(w,h,renderer.getPixelRatio());
  atelierView.resize();
}

function hitZone(e) {
  const bounds = canvas.getBoundingClientRect();
  pointer.x = ((e.clientX - bounds.left) / bounds.width) * 2 - 1;
  pointer.y = -((e.clientY - bounds.top) / bounds.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects(room.hitTargets, false)[0];
  return hit?.object?.userData?.zone || null;
}

function hover3D(e) {
  if (workshopOverlay?.isOpen()) return;
  if (zoneTransitions.current() === 'atelier') return;
  if (e.buttons) return;
  const id = hitZone(e);
  if (id !== hoveredZone) {
    hoveredZone = id;
    interaction.style.cursor = id ? 'pointer' : 'grab';
  }
}

function click3D(e) {
  if (workshopOverlay?.isOpen()) return;
  if (zoneTransitions.current() === 'atelier') return;
  if (e.metaKey) return;
  if (startPointer && Math.hypot(e.clientX - startPointer[0], e.clientY - startPointer[1]) > 7) return;
  const id = hitZone(e);
  if (id) zoneTransitions.open(id);
}

function updateHotspots(currentZone) {
  const width = canvas.clientWidth, height = canvas.clientHeight;
  for (const button of document.querySelectorAll('.hotspot')) {
    // Loading the Atelier's 3D models must never remove its entrance button.
    if (button.dataset.zone === currentZone) {
      button.classList.add('offscreen');
      continue;
    }
    const anchor = room.anchors[button.dataset.zone];
    const point = anchor.clone();
    // Position scene labels above the object surface, never at floor level.
    if (button.dataset.zone === 'atelier') point.y += 1.35;
    if (button.dataset.zone === 'planning') point.y += .55;
    if (button.dataset.zone === 'workbench') point.y += .54;
    if (button.dataset.zone === 'alchemy') point.y += .42;
    if (button.dataset.zone === 'gramophone') point.y += .34;
    point.project(camera);
    const offscreen = point.z < -1 || point.z > 1 || Math.abs(point.x) > 1.05 || Math.abs(point.y) > 1.05;
    button.classList.toggle('offscreen', offscreen);
    if (!offscreen) {
      button.style.left = `${(point.x * .5 + .5) * width}px`;
      button.style.top = `${(-point.y * .5 + .5) * height}px`;
    }
  }
}

function animate() {
  requestAnimationFrame(animate);
  const now = performance.now();
  const frameDelta = clock.getDelta();
  dayNight?.update(frameDelta);
  const delta = Math.min(frameDelta, .05);
  const time = clock.elapsedTime;
  zoneTransitions.updateApproach(delta);
  if (!atelierView.updateFlight(now) && zoneTransitions.current() !== 'alchemy') controls.update();
  rendererHost.stepWorldRuntime(now);
  atelierView.updateGalleryCamera();

  for (const update of room.animated) update(time);
  const currentZone = zoneTransitions.current();
  const overlayOpen = workshopOverlay.isOpen();
  updateHotspots(currentZone);
  atelierView.updateInterface({ zone: currentZone, visualOpen: visualUI.isOpen(), overlayOpen });
  rendererHost.updateWorld();
  // Embedded modules may disable WebGLRenderer.info.autoReset for multi-pass
  // rendering. Our counter is per frame, never a lifetime accumulation.
  renderer.info.reset();
  // Restoring paintings uses this canvas, camera and renderer continuously.
  if (!overlayOpen || zoneTransitions.isTransitioning()) {
    rendererHost.prepareWorldLightsForRender();
    try {
      if (currentZone === 'atelier') {
        atelierFilter.setFocus(camera.position.distanceTo(controls.target));
        const frame = atelierFilter.render();
        lastFrameTriangles = frame.triangles ?? renderer.info.render.triangles;
        lastDrawCalls = frame.calls ?? renderer.info.render.calls;
      } else {
        renderer.render(scene, camera);
        lastFrameTriangles = renderer.info.render.triangles;
        lastDrawCalls = renderer.info.render.calls;
      }
    } finally {
      rendererHost.restoreWorldLightsAfterRender();
    }
  }
  performancePanel?.frame(frameDelta, performance.now() - now,
    { triangles: lastFrameTriangles, calls: lastDrawCalls });
}

// Gentle room ambience is original procedural sound. The selected Chopin recordings are not embedded here.
let ambientContext = null;
async function toggleAmbience() {
  const button = document.querySelector('#sound-toggle');
  const enable = button.getAttribute('aria-pressed') !== 'true';
  button.setAttribute('aria-pressed', String(enable));
  button.title = enable ? t('Выключить звуковое окружение') : t('Включить звуковое окружение');
  if (!ambientContext) {
    ambientContext = new AudioContext();
    const length = ambientContext.sampleRate * 3;
    const buffer = ambientContext.createBuffer(1, length, ambientContext.sampleRate);
    const samples = buffer.getChannelData(0);
    let seed = 98;
    for (let i = 0; i < length; i++) {
      seed = (1103515245 * seed + 12345) & 0x7fffffff;
      samples[i] = (seed / 0x7fffffff * 2 - 1) * .22;
    }
    const source = ambientContext.createBufferSource(); source.buffer = buffer; source.loop = true;
    const filter = ambientContext.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 340;
    const gain = ambientContext.createGain(); gain.gain.value = .028;
    source.connect(filter).connect(gain).connect(ambientContext.destination);
    source.start();
  }
  if (enable && !document.hidden) await ambientContext.resume(); else await ambientContext.suspend();
}

document.querySelector('#sound-toggle').addEventListener('click', toggleAmbience);
document.addEventListener('visibilitychange', () => {
  if (!ambientContext) return;
  if (document.hidden) ambientContext.suspend();
  else if (document.querySelector('#sound-toggle').getAttribute('aria-pressed') === 'true') ambientContext.resume();
});

setup();
