import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createMaterials } from './room/materials.js';
import { buildLair } from './room/build.js';
import { ROOM_CENTER_Z, ROOM_END } from './room-layout.js';
import { mountVisualSettings } from './ui/visual-settings.js';
import { createSceneOutline } from './rendering/scene-outline.js';
import { createQuality } from './rendering/quality.js';
import { mountWorkshopOverlay } from './workshops/workshop-overlay.js';
import { createAtelierEmbedding } from '@keynlock/atelier/embedding';
import { createAlchemyEmbedding } from '@keynlock/alchemy/embedding';
import { createSharedRendererHost } from './rendering/shared-renderer-host.js';
import { addRoomLighting } from './room/lighting.js';
import { createDayNight } from './room/day-night.js';
import { mountPerformancePanel } from './ui/performance-panel.js';
import { mountLairMusic } from './audio/music.js';
import { startLairFrames } from './lair-frame-loop.js';
import './ui/performance.css';
import { createZoneTransitions } from './navigation/zone-transitions.js';
import { ATELIER_EASELS } from './navigation/zone-definitions.js';
import { createRoomWalk } from './navigation/room-walk.js';
import { createCameraInput } from './navigation/camera-input.js';
import { mountZoneInteraction } from './navigation/zone-interaction.js';
import { createAtelierView } from './workshops/atelier-view.js';
import { mountInitialLoading } from './ui/initial-loading.js';
import { getWorkshopApi, setWorkshopHost } from '../../../core/host/workshop-host.js';
import { bindLanguageSelect, t, translator } from './i18n.js';
import './style.css';
import './ui/initial-loading.css';
import './ui/visual.css';
import './ui/room-walk.css';
import './workshops/workshop-overlay.css';
import { createReturnButton } from './ui/return-button.js';

document.documentElement.lang = translator.language;
translator.translateTree(document);
bindLanguageSelect(document.querySelector('#lair-language'));
let musicStorage = null;
try { musicStorage = window.localStorage; } catch { /* music then forgets its place */ }
mountLairMusic({ window, storage: musicStorage, mounts: [
  { element: document.querySelector('#lair-music'), playlist: 'menu' },
  { element: document.querySelector('#panel-music'), volume: true, playlist: 'list' },     // the gramophone's panel
] });

function setup() {
  const app = document.querySelector('#app');
  const canvas = document.querySelector('#scene');
  const interaction = document.querySelector('#scene-interaction');
  const loading = document.querySelector('#loading');
  const panel = document.querySelector('#zone-panel');
  const host = setWorkshopHost({ atelier: {}, alchemy: {} });
  // Read-only handles for browser tests and debugging.
  window.__keynlockDebug = { host, workshop: getWorkshopApi };

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  } catch (error) {
    console.error('KEYNLOCK WebGL unavailable', error);
    document.querySelector('#fallback').hidden = false;
    loading.classList.add('done');
    return;
  }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.10;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  // Almost nothing in the room moves, so the shadow map is not redrawn every
  // frame; lair-frame-loop refreshes it (see refreshShadows there).
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;

  const homePosition = new THREE.Vector3(.25, 8.35, ROOM_END + 4.78);
  const homeTarget = new THREE.Vector3(0, 4.70, ROOM_CENTER_Z - .75);
  const roomMinDistance = 3;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(47, 1, .06, 115);
  camera.position.copy(homePosition);
  const controls = new OrbitControls(camera, interaction);
  Object.assign(host, { camera, controls, interactionElement: interaction });
  controls.target.copy(homeTarget);
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
  const roomLights = scene.children.filter(child => child.isLight);
  const { materials, visual } = createMaterials();
  const room = buildLair(scene, materials);
  const atelier = createAtelierEmbedding({ host: host.atelier, t,
    onPanelHeight: height => app.style.setProperty('--atelier-panel-height', `${height}px`),
  });
  const alchemy = createAlchemyEmbedding({ host: host.alchemy });
  const inRoomWorkshops = { atelier, alchemy };
  const rendererHost = createSharedRendererHost({ renderer, canvas, worldScene: scene,
    onWorkshopError: (id, error) => inRoomWorkshops[id]?.reportError(error),
  });
  host.renderer = rendererHost;
  // The separately developed workbench finds the shared renderer in its iframe.
  window.__keynlockRendererHost = rendererHost;

  const workshopOverlay = mountWorkshopOverlay({
    rendererHost, inRoomWorkshops,
    onExit: () => zoneTransitions.reset(),
    onReady: id => zoneTransitions.onWorkshopReady(id),
  });
  // One full-screen ink pass for everything on screen (the Key Archive's outline).
  const outlines = createSceneOutline({ renderer, scene, camera });
  // Pixel ratio, smoothing, the outline's normal pass and the 60 FPS cap.
  const quality = createQuality({ renderer, outline: outlines });
  quality.apply();
  const performancePanel = mountPerformancePanel({ document, renderer, scene, canvas });
  const dayNight = createDayNight(night => { room.setNight(night); lighting.setNight(night); });
  const visualUI = mountVisualSettings({ visual, room, quality, setNight: night => dayNight.set(night), outlines,
    grain: document.querySelector('.grain'), onOpen: () => { panel.hidden = true; } });
  const roomWalk = createRoomWalk({
    scene, camera, interaction,
    onExit: () => zoneTransitions.reset(),
    onInteract: () => zoneInteraction.openWalkTarget(),
  });
  window.__keynlockDebug.walk = roomWalk;
  const atelierView = createAtelierView({
    camera, controls, canvas, interaction, rendererHost, host,
    easelPose: ATELIER_EASELS, roomMinDistance,
    setFlightInputBlocked: blocked => cameraInput.setAtelierInputBlocked('flight', blocked),
    navigation: {
      isInAtelier: () => zoneTransitions.current() === 'atelier',
      roomFov: () => zoneTransitions.roomFov(),
      stopApproach: () => zoneTransitions.stopApproach(),
      openGalleryCamera() {
        zoneTransitions.stopApproach();
        cameraInput.setMode('gallery');
      },
      openAtelier: () => zoneTransitions.open('atelier'),
    },
  });
  const cameraInput = createCameraInput({
    camera, controls, roomWalk, atelierView,
    handleZoneKey: event => zoneTransitions.handleKey(event),
    handleAtelierKey: event => getWorkshopApi('atelier')?.input?.handleKey(event),
    handleAlchemyKey: event => getWorkshopApi('alchemy')?.input?.handleKey(event),
    updateApproach: delta => zoneTransitions.updateApproach(delta),
  });
  host.atelier.setStrokeInputBlocked = blocked => cameraInput.setAtelierInputBlocked('stroke', blocked);
  const zoneTransitions = createZoneTransitions({
    scene, camera, controls, canvas, interaction, renderer, rendererHost,
    workshopOverlay, atelierView, visualUI, homePosition, homeTarget, roomMinDistance,
    roomLights, cameraInput, quality,
  });
  window.__keynlockDebug.zones = zoneTransitions;
  host.alchemy.manipulate = zoneTransitions.manipulateAlchemy;
  host.alchemy.resetCamera = zoneTransitions.resetAlchemyCamera;
  // Let the overlay register workshop readiness before the loading screen
  // starts warming up their shaders.
  mountInitialLoading({
    loading,
    atelierStatus: atelier.status,
    alchemyStatus: alchemy.status,
    onAtelierModelsReady() {
      const worktable = scene.getObjectByName('restoration-worktable');
      if (worktable) room.windowLight.addFurniture(worktable);
      roomWalk.refreshObstacles();
      // One look for the whole room: the Atelier's furniture takes the room's
      // gouache settings (the paintings keep their true colours). The ink
      // outline is full-screen, so it covers the Atelier with no setup.
      const atelierLook = getWorkshopApi('atelier')?.look;
      visual.adoptPaintedMaterials(atelierLook?.paintedMaterials?.());
    },
    onAlchemyReady() {
      roomWalk.refreshObstacles();
      visual.adoptPaintedMaterials(getWorkshopApi('alchemy')?.look?.paintedMaterials?.());
    },
    precompileWorkshopLighting: zoneTransitions.precompileWorkshopLighting,
  });
  atelierView.bind();
  // The game starts on foot at the entrance; ?start=overview opens the
  // overview instead (the browser tests start there).
  if (new URLSearchParams(location.search).get('start') !== 'overview') zoneTransitions.startWalk();
  const zoneInteraction = mountZoneInteraction({
    canvas, camera, interaction, roomWalk, cameraInput, zoneTransitions, workshopOverlay,
    anchors: room.anchors, hitTargets: room.hitTargets,
  });
  atelier.mount(app);
  alchemy.mount(app);

  function resize() {
    const width = canvas.clientWidth, height = canvas.clientHeight;
    camera.aspect = width / Math.max(height, 1);
    cameraInput.resize(zoneTransitions.resizeCamera(width));
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    atelierView.resize();
  }
  window.addEventListener('resize', resize);
  resize();
  const returnButton = createReturnButton({ button: document.querySelector('#reset-camera'), t });
  startLairFrames({ scene, camera, controls, renderer, rendererHost, room, outlines, quality, dayNight,
    zoneTransitions, zoneInteraction, cameraInput, atelierView, workshopOverlay, visualUI, performancePanel,
    returnButton });
}

setup();
