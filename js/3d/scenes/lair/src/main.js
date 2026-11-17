import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createMaterials } from './materials.js';
import { buildLair } from './room.js';
import { createRoomOutlines, mountVisualSettings } from './visual-settings.js';
import { mountOriginalStations, ORIGINAL_STATIONS } from './original-stations.js';
import { mountAtelierInRoom } from './atelier-in-room.js';
import { mountAlchemyInRoom } from './alchemy-in-room.js';
import { createSharedRendererHost } from './shared-renderer-host.js';
import { createCartoonFilter } from '../integrations/atelier/src/effects/cartoon-filter.js';
import { createCameraTransition } from '../integrations/atelier/src/navigation/camera-transition.js';
import { addRoomLighting } from './room-lighting.js';
import { ALCHEMY_LOOK } from '../integrations/alchemy/src/look/alchemy-look.js';
import { createInitialLoadingGate } from './initial-loading.js';
import './style.css';
import './initial-loading.css';
import './visual.css';
import './original-stations.css';

const canvas = document.querySelector('#scene');
const interaction = document.querySelector('#scene-interaction');
const loading = document.querySelector('#loading');
const fallback = document.querySelector('#fallback');
const fpsLabel = document.querySelector('#fps');
const triangleLabel = document.querySelector('#triangles');
const panel = document.querySelector('#zone-panel');
const galleryEntry = document.querySelector('#wall-collection-entry');
const galleryControls = document.querySelector('#lair-gallery-controls');
const artworkInfoPanel = document.querySelector('#restoration-art-info');
const easelLabels = document.querySelector('#lair-easel-labels');
const easelCameraControls = document.querySelector('#lair-easel-camera-controls');
const galleryHover = document.querySelector('#lair-wall-art-hover');
const zones = {
  restoration: {
    number: '01', kicker: 'АТЕЛЬЕ САЙ', title: 'Реставрация',
    description: 'Оригинальное Ателье цвета размещено вдоль левой стены логова: 12 художественных направлений, 30 рам, действующие инструменты реставрации.',
    status: 'Мольберты и картины находятся в общей 3D-сцене логова.',
    link: ORIGINAL_STATIONS.restoration.sourceUrl,
    camera: [1.56, 3.22, 10.35], target: [-7.05, 2.48, 10.35],
  },
  planning: {
    number: '02', kicker: 'БАЗА КОМАНДЫ', title: 'Карта и дела',
    description: 'Карта каналов и кварталов Киенлока, заметки о заказах и стол, за которым Кай, Сай и Тик готовят очередную вылазку. Сюда команда возвращается с добычей.',
    status: 'Штаб связывает мастерские, коллекцию и будущие сюжетные задания.',
    link: null, camera: [.15, 3.80, 7.75], target: [0, 1.75, -.7],
  },
  workbench: {
    number: '03', kicker: 'МАСТЕРСКАЯ ТИКА', title: 'Верстак',
    description: 'Справа от алхимического стола, вдоль зелёной стены, стоит отдельный верстак с тисками, заготовками, замочными цилиндрами и инструментальной доской.',
    status: 'Полная исходная мастерская: опиловка, сборка замка, песочница механизмов.',
    link: ORIGINAL_STATIONS.workbench.sourceUrl,
    camera: [1.22, 3.15, 20.07], target: [7.40, 1.68, 20.07],
  },
  alchemy: {
    number: '04', kicker: 'СОСТАВЫ И РЕАГЕНТЫ', title: 'Алхимия',
    description: 'Вся правая стена от пола до потолка покрыта зелёной гуашевой плиткой. У стены стоит алхимический стол с двумя ярусами, семью реагентами, пигментами, стеклом и свечами; над ним рецепт и часы.',
    status: 'Исходная лаборатория: переливание, физика жидкостей, рецепты и все настройки.',
    link: ORIGINAL_STATIONS.alchemy.sourceUrl,
    // Fallback only. The loaded source laboratory supplies its actual orbit
    // position, pivot and 37° field of view when entering this station.
    camera: [3.08, 4.18, 10.10], target: [6.99, 3.18, 10.10],
  },
  gramophone: {
    number: '05', kicker: 'СКРЫТАЯ КОЛЛЕКЦИЯ', title: 'Музыка в Логове',
    description: 'Старый граммофон хранит запрещённые иностранные пластинки. Для будущего саундтрека отобраны три исполнения ноктюрнов Шопена: Op. 9 № 2 и два варианта Op. 9 № 1.',
    status: 'Фонотека задумана; сами записи пока не включены в опубликованную сцену.',
    link: null, camera: [1.95, 3.38, 3.60], target: [1.96, 2.26, -3.71],
  },
};

let renderer, scene, camera, controls, room, rendererHost, atelierFilter, atelierFlight;
let visualUI = null;
let originalStations = null;
let transitioning = false;
let queuedGallery = false;
let desiredPosition = new THREE.Vector3();
let desiredTarget = new THREE.Vector3();
let desiredFov = 47;
let roomFov = 47;
let currentZone = null;
let roomLightDefaults = [];
let originalRoomRenderLook = null;
let galleryActive = false;
let galleryDrag = null;
let artworkInfoKey = null;
let easelFocusSide = null;
let savedEaselView = null;
let atelierFovTravel = null;
let lastSceneTriangles = 0;
let startPointer = null;
let hoveredZone = null;
let pendingStationOpen = null;
let alchemyApproachDistance = 0;
const homePosition = new THREE.Vector3(.25, 8.35, 31.2);
const homeTarget = new THREE.Vector3(0, 4.70, 9.60);
const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
// Below the original salon's thirty frames, fixed to the left wall of the Lair.
const galleryWallAnchor = new THREE.Vector3(-8.10, 3.35, 15.90);
let frames = 0, fpsTime = 0;

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
    if (galleryLoaded && alchemyLoaded) initialLoading.finish();
    else if (galleryLoaded) {
      loadingStatus.textContent = 'ПОДГОТАВЛИВАЕМ АЛХИМИЧЕСКУЮ ЛАБОРАТОРИЮ';
      loadingBar.style.width = '94%';
    }
  };
  const initialLoading = createInitialLoadingGate({
    onProgress: ({ loaded, total }) => {
      loading.classList.add('is-tracking');
      loadingStatus.textContent = `ЗАГРУЖАЕМ КАРТИНЫ · ${loaded} / ${total}`;
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
  window.__keynlockLairCamera = camera;
  window.__keynlockLairInteractionElement = interaction;
  window.__keynlockRestorationActive = false;
  controls = new OrbitControls(camera, interaction);
  window.__keynlockLairControls = controls;
  window.__keynlockLairManipulateAlchemy = ({rotateX = 0,rotateY = 0,panX = 0,panY = 0,zoom = 1} = {}) => {
    if (currentZone !== 'alchemy' || transitioning) return;
    const offset = camera.position.clone().sub(controls.target);
    const spherical = new THREE.Spherical().setFromVector3(offset);
    spherical.theta -= rotateX * .0055;
    spherical.phi = THREE.MathUtils.clamp(spherical.phi + rotateY * .0045,.13,Math.PI - .13);
    spherical.radius = THREE.MathUtils.clamp(spherical.radius * zoom,2,28);
    if (panX || panY) {
      const units = 2 * spherical.radius * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / Math.max(1,canvas.clientHeight);
      const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,0);
      const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,1);
      controls.target.addScaledVector(right,-panX * units).addScaledVector(up,panY * units);
    }
    camera.position.copy(controls.target).add(offset.setFromSpherical(spherical));
    camera.lookAt(controls.target);
    controls.update();
  };
  window.__keynlockLairResetAlchemyCamera = () => {
    if (currentZone !== 'alchemy') return;
    const pose = rendererHost?.getWorldPose('alchemy');
    if (!pose) return;
    atelierFlight?.cancel();
    transitioning = false;
    camera.position.copy(pose.position);
    controls.target.copy(pose.target);
    camera.fov = pose.fov;
    camera.updateProjectionMatrix();
    camera.lookAt(controls.target);
  };
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
  controls.minDistance = 3.0;
  controls.maxDistance = 44;
  controls.minPolarAngle = .15;
  controls.maxPolarAngle = Math.PI - .15;
  controls.minAzimuthAngle = -Infinity;
  controls.maxAzimuthAngle = Infinity;
  controls.rotateSpeed = .55;
  controls.zoomSpeed = .70;
  controls.addEventListener('start', () => {
    transitioning = false;
    if(currentZone!=='restoration' && currentZone!=='alchemy')rendererHost?.setWorldLighting(null);
  });
  atelierFlight = createCameraTransition({ camera, controls });

  addRoomLighting({ THREE, scene });
  // Keep the source laboratory's original lighting legible in this shared room.
  // The source rig is registered separately and activated only at its station.
  roomLightDefaults = scene.children.filter(child=>child.isLight)
    .map(light=>({light,intensity:light.intensity,visible:light.visible}));
  originalRoomRenderLook = {
    outputColorSpace:renderer.outputColorSpace,toneMapping:renderer.toneMapping,
    toneMappingExposure:renderer.toneMappingExposure,
    shadowEnabled:renderer.shadowMap.enabled,shadowType:renderer.shadowMap.type,
    shadowAutoUpdate:renderer.shadowMap.autoUpdate,
  };
  const { materials, visual } = createMaterials();
  room = buildLair(scene, materials, {useOriginalRestoration:true});
  // Render the preserved Atelier shader against the room's real canvas and
  // camera. The embedded source renderer is a proxy and cannot post-process
  // what the visitor sees through this common viewport.
  atelierFilter = createCartoonFilter({ THREE, renderer, scene, camera });
  rendererHost = createSharedRendererHost({renderer,canvas,worldScene:scene});
  window.__keynlockRendererHost = rendererHost;
  window.__keynlockLairFocusArtwork = ({side, position, target, fov}) => {
    if (currentZone !== 'restoration' || galleryActive) return;
    const destination = { position: new THREE.Vector3(...position), target: new THREE.Vector3(...target) };
    if (!easelFocusSide) {
      savedEaselView = { position: camera.position.clone(), target: controls.target.clone(), fov: camera.fov };
    } else {
      // A/D and the arrow buttons preserve the visitor's zoom when switching
      // between original and restoration, like the original Atelier framing.
      destination.position.copy(destination.target).add(camera.position.clone().sub(controls.target));
    }
    easelFocusSide = side;
    controls.minDistance = 1.12;
    startAtelierFlight(destination, fov, 780);
  };
  window.__keynlockLairFocusEasels = () => {
    if (currentZone !== 'restoration' || galleryActive) return;
    const destination = savedEaselView || {
      position: new THREE.Vector3(...zones.restoration.camera),
      target: new THREE.Vector3(...zones.restoration.target), fov: roomFov,
    };
    easelFocusSide = null;
    savedEaselView = null;
    controls.minDistance = 3;
    startAtelierFlight(destination, destination.fov, 780);
  };
  window.__keynlockLairHoverGalleryArtwork = art => {
    if (!galleryActive || !art) { galleryHover.hidden = true; return; }
    galleryHover.hidden = false;
    galleryHover.textContent = art.label;
    const bounds = interaction.getBoundingClientRect();
    galleryHover.style.left = `${Math.max(8, Math.min(bounds.width - 270, art.x - bounds.left + 17))}px`;
    galleryHover.style.top = `${Math.max(8, art.y - bounds.top - 47)}px`;
  };
  originalStations = mountOriginalStations({onExit: resetView,onReady: onStationReady,rendererHost});
  const atelierElement = mountAtelierInRoom();
  const alchemyElement = mountAlchemyInRoom();
  alchemyElement.querySelector('.lair-alchemy-exit')?.addEventListener('click', resetView);
  const alchemyInput = alchemyElement.querySelector('#scene');
  const observeAtelierMenu = () => document.querySelector('#app').style.setProperty(
    '--atelier-panel-height',`${Math.round(atelierElement.getBoundingClientRect().height)}px`);
  new ResizeObserver(observeAtelierMenu).observe(atelierElement);
  observeAtelierMenu();
  const outlines = createRoomOutlines(scene);
  visualUI = mountVisualSettings({ visual, room, outlines, atelierFilter,
    grain: document.querySelector('.grain'), onOpen: () => { panel.hidden = true; } });

  window.addEventListener('resize', resize);
  interaction.addEventListener('pointerdown', e => { startPointer = [e.clientX, e.clientY]; });
  interaction.addEventListener('pointerdown', e => {
    if (galleryActive && e.button === 0) galleryDrag = { pointerId: e.pointerId, x: e.clientX };
  });
  interaction.addEventListener('pointermove', e => {
    if (!galleryActive || !galleryDrag || galleryDrag.pointerId !== e.pointerId || !(e.buttons & 1)) return;
    const delta = e.clientX - galleryDrag.x;
    galleryDrag.x = e.clientX;
    window.__keynlockAtelierGallery?.pan(-delta / Math.max(1, canvas.clientWidth));
  });
  for (const eventName of ['pointerup','pointercancel','lostpointercapture']) {
    interaction.addEventListener(eventName, () => { galleryDrag = null; });
  }
  interaction.addEventListener('wheel', e => {
    if (!galleryActive) return;
    e.preventDefault();
    window.__keynlockAtelierGallery?.zoom(e.deltaY);
  }, { passive: false });
  interaction.addEventListener('pointermove', hover3D);
  interaction.addEventListener('click', click3D);
  window.addEventListener('keydown', e => { if (e.key === 'Meta') interaction.classList.add('command-pan'); });
  window.addEventListener('keyup', e => { if (e.key === 'Meta') interaction.classList.remove('command-pan'); });
  window.addEventListener('blur', () => interaction.classList.remove('command-pan'));
  document.querySelectorAll('[data-zone]').forEach(button => {
    button.addEventListener('click', event => {
      event.stopPropagation();
      openZone(button.dataset.zone);
    });
  });
  document.querySelector('#close-panel').addEventListener('click', () => closePanel());
  document.querySelector('#reset-camera').addEventListener('click', resetView);
  galleryEntry.addEventListener('click', openWallGallery);
  document.querySelector('#gallery-easels').addEventListener('click', returnToEasels);
  document.querySelector('#gallery-prev').addEventListener('click', () => window.__keynlockAtelierGallery?.step(-1));
  document.querySelector('#gallery-next').addEventListener('click', () => window.__keynlockAtelierGallery?.step(1));
  document.querySelector('#gallery-art-back').addEventListener('click', () => window.__keynlockAtelierGallery?.backFromArt());
  document.querySelector('#gallery-switch').addEventListener('click', () => window.__keynlockAtelierGallery?.switchDisplay());
  document.querySelector('#gallery-shuffle').addEventListener('click', () => window.__keynlockAtelierGallery?.shuffle());
  document.querySelector('#gallery-select').addEventListener('click', () => window.__keynlockAtelierGallery?.select());
  document.querySelector('#lair-focus-original').addEventListener('click', () =>
    window.__keynlockRestorationBridge?.focusEasel?.('original'));
  document.querySelector('#lair-focus-copy').addEventListener('click', () =>
    window.__keynlockRestorationBridge?.focusEasel?.('copy'));
  document.querySelector('#lair-focus-exit').addEventListener('click', () =>
    window.__keynlockRestorationBridge?.returnToEasels?.());
  document.querySelector('#restoration-info-toggle').addEventListener('click', e => {
    const body = document.querySelector('#restoration-info-body');
    body.hidden = !body.hidden;
    e.currentTarget.textContent = body.hidden ? '+' : '−';
    e.currentTarget.setAttribute('aria-expanded', String(!body.hidden));
    e.currentTarget.setAttribute('aria-label', body.hidden ? 'Развернуть описание картины' : 'Свернуть описание картины');
  });
  document.addEventListener('keydown', handleKey);
  resize();
  animate();
}

function resize() {
  if (!renderer || !camera) return;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  camera.aspect = w / Math.max(h, 1);
  roomFov = w < 720 ? 59 : w < 1050 ? 52 : 47;
  const sourceFov = currentZone === 'alchemy'
    ? rendererHost?.getWorldPose('alchemy')?.fov ?? 37
    : roomFov;
  desiredFov = sourceFov;
  camera.fov = sourceFov;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
  atelierFilter?.resize(w,h,renderer.getPixelRatio());
  window.__keynlockRestorationBridge?.setViewportAspect?.(w / Math.max(h, 1));
  if (galleryActive) {
    // The source gallery camera's projection is already synchronized with the
    // Lair's screen; its perspective is also used for artwork picking.
    window.__keynlockAtelierGallery?.setAspect(w / Math.max(h, 1));
  }
}

function startAtelierFlight(destination, fov, duration = 780) {
  transitioning = false;
  atelierFovTravel = { from: camera.fov, to: Number.isFinite(fov) ? fov : 39,
    started: performance.now(), duration };
  atelierFlight.start(destination, duration);
}

function focus(position, target, fov = roomFov) {
  atelierFlight?.cancel();
  atelierFovTravel = null;
  desiredPosition.set(...position);
  desiredTarget.set(...target);
  desiredFov = fov;
  transitioning = true;
  controls.minAzimuthAngle = -Infinity;
  controls.maxAzimuthAngle = Infinity;
}

function onStationReady(id) {
  if (id === 'alchemy') {
    zones.alchemy.status = 'Алхимическая лаборатория работает внутри общей сцены логова.';
    if (currentZone === 'alchemy' && pendingStationOpen === 'alchemy') {
      const pose = rendererHost?.getWorldPose('alchemy');
      if (pose) {
        alchemyApproachDistance = camera.position.distanceTo(pose.position);
        focus(pose.position.toArray(), pose.target.toArray(), pose.fov);
      }
    }
    return;
  }
  if (id !== 'restoration') return;
  window.__keynlockRestorationBridge?.setViewportAspect?.(
    canvas.clientWidth / Math.max(1,canvas.clientHeight));
  zones.restoration.status = 'Исходная реставрация встроена в логово. Картины и инструменты доступны здесь.';
  // The original painting room is rotated along the Lair's left wall. Both
  // finishes contain the same gouache image, but the Lair wall retains its
  // own independently loaded material so a slow Atelier import cannot turn
  // the visible wallpaper into a flat beige placeholder.
  const atelierWall = scene.getObjectByName('atelier-original-wallpaper');
  if (atelierWall) {
    atelierWall.visible = false;
  }
  if (currentZone === 'restoration') rendererHost.setWorldLighting('restoration');
  if (queuedGallery) enterGalleryCamera();
}

function applyWorldAlchemyLook(enabled) {
  if (!renderer || !originalRoomRenderLook) return;
  for (const {light,intensity,visible} of roomLightDefaults) {
    light.intensity = intensity;
    // The laboratory has its own complete lighting rig. Leaving the Lair's
    // six ambient, directional and point lights active doubles the brightness
    // and makes every lit material evaluate unnecessary light sources.
    light.visible = !enabled && visible;
  }
  // The original lab is much closer to the camera than the full Lair. Keep
  // its pixel cost bounded on retina screens, without lowering other rooms.
  const pixelRatio = Math.min(window.devicePixelRatio || 1, enabled ? 1.35 : 1.75);
  if (Math.abs(renderer.getPixelRatio() - pixelRatio) > .001) {
    renderer.setPixelRatio(pixelRatio);
    atelierFilter?.resize(canvas.clientWidth,canvas.clientHeight,pixelRatio);
  }
  if (enabled) {
    // Both scenes already use ACES/sRGB. Changing the global shadow-map type
    // here would invalidate every material program in the large shared scene
    // and produce a multi-second shader compilation stall on station entry.
    renderer.toneMappingExposure = ALCHEMY_LOOK.renderer.exposure;
    // The original laboratory caches its mostly static 2048px shadow atlas.
    // Avoid re-rendering all workshop shadows during every Lair frame.
    renderer.shadowMap.autoUpdate = false;
  } else {
    renderer.outputColorSpace = originalRoomRenderLook.outputColorSpace;
    renderer.toneMapping = originalRoomRenderLook.toneMapping;
    renderer.toneMappingExposure = originalRoomRenderLook.toneMappingExposure;
    renderer.shadowMap.enabled = originalRoomRenderLook.shadowEnabled;
    renderer.shadowMap.type = originalRoomRenderLook.shadowType;
    renderer.shadowMap.autoUpdate = originalRoomRenderLook.shadowAutoUpdate;
  }
  renderer.shadowMap.needsUpdate = true;
  rendererHost?.setWorldLighting(enabled ? 'alchemy' : null);
}

function leaveGalleryCamera() {
  queuedGallery = false;
  if (!galleryActive) return;
  galleryActive = false;
  atelierFilter?.setBlurSuspended(false);
  galleryDrag = null;
  galleryHover.hidden = true;
  window.__keynlockLairGalleryActive = false;
  window.__keynlockAtelierGallery?.leave();
  controls.enabled = true;
  interaction.style.cursor = 'grab';
  galleryControls.hidden = true;
}

function enterGalleryCamera() {
  const gallery = window.__keynlockAtelierGallery;
  if (!gallery || !rendererHost?.getWorldPose('restoration')) {
    queuedGallery = true;
    return;
  }
  queuedGallery = false;
  atelierFlight?.cancel();
  atelierFovTravel = null;
  easelFocusSide = null;
  savedEaselView = null;
  galleryActive = true;
  atelierFilter?.setBlurSuspended(true);
  transitioning = false;
  window.__keynlockLairGalleryActive = true;
  controls.enabled = false;
  gallery.open(canvas.clientWidth / Math.max(1, canvas.clientHeight));
  galleryControls.hidden = false;
  galleryEntry.hidden = true;
  interaction.style.cursor = 'grab';
}

function openWallGallery() {
  if (currentZone !== 'restoration') openZone('restoration');
  enterGalleryCamera();
}

function returnToEasels() {
  leaveGalleryCamera();
  openZone('restoration');
}

function openZone(id) {
  if (!zones[id]) return;
  pendingStationOpen = null;
  leaveGalleryCamera();
  if(visualUI?.isOpen())visualUI.close();
  currentZone = id;
  // The standalone laboratory owns its own visual pipeline. Keep the Lair
  // renderer responsive during the approach camera animation.
  applyWorldAlchemyLook(false);
  const zone = zones[id];
  const hasOriginal = Boolean(ORIGINAL_STATIONS[id]);
  const restoring = id === 'restoration';
  window.__keynlockRestorationBridge?.resetEaselFocus?.();
  easelFocusSide = null;
  savedEaselView = null;
  window.__keynlockRestorationActive = restoring;
  document.querySelector('#app').classList.toggle('restoration-mode',restoring);
  if (!restoring) originalStations?.hideRestorationInRoom();
  if (id !== 'alchemy') originalStations?.hideAlchemyInRoom();
  // Avoid switching every source light off and immediately on again when
  // entering alchemy: that doubles expensive WebGL shader transitions.
  if (id !== 'alchemy') rendererHost?.setWorldLighting(null);
  // Restoration always starts at the two easels, regardless of the source
  // Atelier's last camera pose (which could be up at the salon gallery).
  const sourcePose = id === 'alchemy' ? rendererHost?.getWorldPose('alchemy') : null;
  const stationPosition = sourcePose?.position.toArray() || zone.camera;
  const stationTarget = sourcePose?.target.toArray() || zone.target;
  if (id === 'alchemy') alchemyApproachDistance = camera.position.distanceTo(new THREE.Vector3(...stationPosition));
  focus(stationPosition, stationTarget, sourcePose?.fov ?? (id === 'alchemy' ? 37 : roomFov));
  document.querySelector('#panel-kicker').textContent = `${zone.number} / ${zone.kicker}`;
  document.querySelector('#panel-title').textContent = zone.title;
  document.querySelector('#panel-description').textContent = zone.description;
  document.querySelector('#panel-status').textContent = zone.status;
  const link = document.querySelector('#panel-link');
  link.hidden = !zone.link;
  if (zone.link) link.href = zone.link;
  // Source geometry remains visible in the Lair during this camera flight.
  // The existing Atelier UI takes over only after the original has initialized.
  panel.hidden = hasOriginal;
  document.querySelectorAll('[data-zone]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.zone === id);
    if (btn.closest('.zone-nav')) btn.setAttribute('aria-pressed', String(btn.dataset.zone === id));
  });
  if (hasOriginal) {
    originalStations.preload(id);
    if (restoring) {
      // Source Atelier controls are the same DOM and state that operate its
      // original artwork meshes, which the Lair camera renders in this room.
      originalStations.showRestorationInRoom();
      if (originalStations.isReady(id)) rendererHost.setWorldLighting(id);
    } else if (id === 'alchemy') {
      // Keep the room visible while the camera approaches the laboratory.
      // Its standalone controls take over after the camera has arrived.
      pendingStationOpen = id;
    } else originalStations.open(id);
  }
}

function closePanel() {
  pendingStationOpen = null;
  leaveGalleryCamera();
  window.__keynlockRestorationActive = false;
  document.querySelector('#app').classList.remove('restoration-mode');
  originalStations?.hideRestorationInRoom();
  originalStations?.hideAlchemyInRoom();
  applyWorldAlchemyLook(false);
  interaction.style.cursor = 'grab';
  panel.hidden = true;
  currentZone = null;
  document.querySelectorAll('[data-zone]').forEach(button => {
    button.classList.remove('active');
    if (button.closest('.zone-nav')) button.setAttribute('aria-pressed', 'false');
  });
}

function resetView() {
  if (originalStations?.isOpen()) { originalStations.close(); return; }
  closePanel();
  rendererHost?.setWorldLighting(null);
  focus(homePosition.toArray(), homeTarget.toArray());
}

function handleKey(e) {
  if (e.defaultPrevented) return;
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
  if (originalStations?.isOpen()) {
    if(e.key === 'Escape')originalStations.close();
    return;
  }
  if (galleryActive) {
    const collectionOpen = document.querySelector('#atelier-embedded-app #collection-modal')?.hidden === false;
    if (collectionOpen) return;
    if (e.code === 'Escape') {
      e.preventDefault();
      returnToEasels();
      return;
    }
    if (['ArrowLeft','KeyA','ArrowRight','KeyD'].includes(e.code)) {
      e.preventDefault();
      window.__keynlockAtelierGallery?.step(['ArrowRight','KeyD'].includes(e.code) ? 1 : -1);
      return;
    }
  }
  // The original Atelier owns number keys 4–8 in restoration mode.
  if (currentZone === 'restoration' && /^Digit[4-8]$/.test(e.code)) return;
  if (currentZone === 'alchemy' && e.key === 'Escape' &&
      !document.querySelector('#alchemy-embedded-app #recipe-overlay')?.hidden) return;
  if (e.key === 'Escape') { if (visualUI?.isOpen()) visualUI.close(); else resetView(); return; }
  if (e.key === '0') { resetView(); return; }
  const names = ['restoration','planning','workbench','alchemy','gramophone'];
  const number = Number(e.key);
  if (number >= 1 && number <= 5 && String(number) === e.key) openZone(names[number - 1]);
}

function updateRestorationArtInfo() {
  const bridge = window.__keynlockRestorationBridge;
  const info = currentZone === 'restoration'
    ? (galleryActive ? bridge?.wallArtworkInfo?.() : bridge?.artworkInfo?.()) : null;
  const collectionOpen = document.querySelector('#atelier-embedded-app #collection-modal')?.hidden === false;
  if (!info || collectionOpen || visualUI?.isOpen() || originalStations?.isOpen()) {
    artworkInfoPanel.hidden = true;
    return;
  }
  artworkInfoPanel.hidden = false;
  const key = `${galleryActive ? 'gallery' : 'easel'}:${info.id}`;
  if (key === artworkInfoKey) return;
  artworkInfoKey = key;
  document.querySelector('#restoration-info-index').textContent = galleryActive
    ? 'КОЛЛЕКЦИЯ КАРТИН' : `ЭКСПОНАТ № ${String(info.index).padStart(2, '0')} / ${info.total}`;
  document.querySelector('#restoration-info-title').textContent = info.title;
  document.querySelector('#restoration-info-author').textContent = `${info.artist} · ${info.year}`;
  document.querySelector('#restoration-info-description').textContent = info.description;
  document.querySelector('#restoration-info-ban-label').textContent = info.banLabel;
  document.querySelector('#restoration-info-ban-reason').textContent = info.banReason;
  document.querySelector('#restoration-info-policy').textContent = info.policy;
}

function updateRestorationEaselHUD() {
  const bridge = window.__keynlockRestorationBridge;
  const collectionOpen = document.querySelector('#atelier-embedded-app #collection-modal')?.hidden === false;
  const showing = currentZone === 'restoration' && !galleryActive && Boolean(bridge)
    && !collectionOpen && !originalStations?.isOpen();
  easelCameraControls.hidden = !showing;
  const focusedSide = showing ? bridge.focusedSide?.() : null;
  easelLabels.hidden = !showing || Boolean(focusedSide);
  if (!showing) return;
  document.querySelector('#lair-easel-camera-state').textContent = focusedSide === 'original'
    ? 'ОРИГИНАЛ' : focusedSide === 'copy' ? 'КОПИЯ' : 'СРАВНЕНИЕ';
  document.querySelector('#lair-focus-original').disabled = focusedSide === 'original';
  document.querySelector('#lair-focus-copy').disabled = focusedSide === 'copy';
  document.querySelector('#lair-focus-exit').hidden = !focusedSide;
  if (focusedSide) return;
  const width = canvas.clientWidth, height = canvas.clientHeight;
  for (const entry of bridge.easelLabelPoints?.() || []) {
    const element = easelLabels.querySelector(`[data-easel-label="${entry.side}"]`);
    if (!element) continue;
    const point = new THREE.Vector3(...entry.point).project(camera);
    const visible = point.z >= -1 && point.z <= 1 && Math.abs(point.x) < .93 && Math.abs(point.y) < .85;
    element.classList.toggle('is-offscreen', !visible);
    if (visible) {
      element.style.left = `${(point.x * .5 + .5) * width}px`;
      element.style.top = `${(-point.y * .5 + .5) * height}px`;
    }
  }
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
  if (originalStations?.isOpen()) return;
  if (currentZone === 'restoration') return;
  if (e.buttons) return;
  const id = hitZone(e);
  if (id !== hoveredZone) {
    hoveredZone = id;
    interaction.style.cursor = id ? 'pointer' : 'grab';
  }
}

function click3D(e) {
  if (originalStations?.isOpen()) return;
  if (currentZone === 'restoration') return;
  if (e.metaKey) return;
  if (startPointer && Math.hypot(e.clientX - startPointer[0], e.clientY - startPointer[1]) > 7) return;
  const id = hitZone(e);
  if (id) openZone(id);
}

function updateHotspots() {
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
    if (button.dataset.zone === 'restoration') point.y += 1.35;
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
  const showEntry = !galleryActive && (currentZone === null || currentZone === 'restoration');
  if (!showEntry) { galleryEntry.hidden = true; return; }
  const point = galleryWallAnchor.clone().project(camera);
  const onScreen = point.z >= -1 && point.z <= 1 && Math.abs(point.x) < .91 && Math.abs(point.y) < .86;
  const pinned = !onScreen && currentZone === 'restoration';
  galleryEntry.hidden = !onScreen && !pinned;
  galleryEntry.classList.toggle('pinned', pinned);
  if (onScreen) {
    galleryEntry.style.left = `${(point.x * .5 + .5) * width}px`;
    galleryEntry.style.top = `${(-point.y * .5 + .5) * height}px`;
  } else if (pinned) {
    galleryEntry.style.left = '16px';
    galleryEntry.style.top = width < 730 ? '78px' : '106px';
  }
}

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), .05);
  const time = clock.elapsedTime;
  if (transitioning && !galleryActive) {
    const factor = 1 - Math.exp(-4.8 * delta);
    camera.position.lerp(desiredPosition, factor);
    controls.target.lerp(desiredTarget, factor);
    if (Math.abs(camera.fov-desiredFov)>.001) {
      camera.fov += (desiredFov-camera.fov)*factor;
      camera.updateProjectionMatrix();
    }
    // Alchemy uses an independent input runtime, so OrbitControls.update()
    // is intentionally paused. Aim the Lair camera explicitly during flight.
    if (currentZone === 'alchemy') camera.lookAt(controls.target);
    if (camera.position.distanceTo(desiredPosition) < .014 && controls.target.distanceTo(desiredTarget) < .014 && Math.abs(camera.fov-desiredFov)<.06) {
      transitioning = false;
    }
  }
  // Reveal the loaded laboratory while the camera is still moving towards it.
  // During the overlay fade the room keeps rendering underneath.
  const approachingAlchemy = pendingStationOpen === 'alchemy' &&
    currentZone === 'alchemy' && originalStations.isReady('alchemy') &&
    camera.position.distanceTo(desiredPosition) < alchemyApproachDistance * .55;
  if (pendingStationOpen && (!transitioning || approachingAlchemy) && currentZone === pendingStationOpen) {
    const id = pendingStationOpen;
    pendingStationOpen = null;
    originalStations.open(id);
    if (id === 'alchemy') applyWorldAlchemyLook(true);
  }
  if (atelierFlight?.isTraveling()) atelierFlight.update(performance.now());
  else if (currentZone !== 'alchemy') controls.update();
  if (atelierFovTravel) {
    const t = Math.min(1, (performance.now() - atelierFovTravel.started) / atelierFovTravel.duration);
    const eased = t ** 3 * (t * (t * 6 - 15) + 10);
    camera.fov = atelierFovTravel.from + (atelierFovTravel.to - atelierFovTravel.from) * eased;
    camera.updateProjectionMatrix();
    if (t === 1) atelierFovTravel = null;
  }
  // Choosing a work in the full catalogue closes the source gallery.
  // Resume the two-easel view and its restoration controls immediately.
  if (galleryActive && window.__keynlockAtelierGallery && !window.__keynlockAtelierGallery.isActive())
    returnToEasels();
  if (galleryActive) {
    const pose = rendererHost.getWorldPose('restoration');
    if (pose) {
      camera.position.copy(pose.position);
      controls.target.copy(pose.target);
      camera.lookAt(controls.target);
      if (Math.abs(camera.fov - pose.fov) > .001) {
        camera.fov = pose.fov;
        camera.updateProjectionMatrix();
      }
    }
    const gallery = window.__keynlockAtelierGallery;
    const focusedArt = gallery?.mode() === 'art';
    document.querySelector('#gallery-art-back').hidden = !focusedArt;
    document.querySelector('.lair-gallery-panner').hidden = focusedArt;
    const sourceSwitch = document.querySelector('#atelier-embedded-app #wall-gallery-demo');
    if (sourceSwitch) document.querySelector('#gallery-switch').textContent = sourceSwitch.textContent;
    const sourceShuffle = document.querySelector('#atelier-embedded-app #wall-gallery-shuffle');
    if (sourceShuffle) document.querySelector('#gallery-shuffle').hidden = sourceShuffle.hidden;
  }
  for (const update of room.animated) update(time);
  updateHotspots();
  updateRestorationArtInfo();
  updateRestorationEaselHUD();
  rendererHost.stepWorldRuntime(time * 1000);
  rendererHost.updateWorld();
  // Embedded modules may disable WebGLRenderer.info.autoReset for multi-pass
  // rendering. Our counter is per frame, never a lifetime accumulation.
  renderer.info.reset();
  // Restoring paintings uses this canvas, camera and renderer continuously.
  if (!originalStations?.isOpen() || transitioning) {
    rendererHost.prepareWorldLightsForRender();
    try {
      if (currentZone === 'restoration') {
        atelierFilter.setFocus(camera.position.distanceTo(controls.target));
        const frame = atelierFilter.render();
        lastSceneTriangles = frame.sceneTriangles ?? frame.triangles ?? 0;
      } else {
        renderer.render(scene, camera);
        lastSceneTriangles = renderer.info.render.triangles;
      }
    } finally {
      rendererHost.restoreWorldLightsAfterRender();
    }
  }
  frames++; fpsTime += delta;
  if (fpsTime >= .65) {
    fpsLabel.textContent = Math.round(frames / fpsTime).toString();
    triangleLabel.textContent = new Intl.NumberFormat('ru-RU').format(lastSceneTriangles);
    frames = 0; fpsTime = 0;
  }
}

// Gentle room ambience is original procedural sound. The selected Chopin recordings are not embedded here.
let ambientContext = null;
let ambientSource = null;
async function toggleAmbience() {
  const button = document.querySelector('#sound-toggle');
  const enable = button.getAttribute('aria-pressed') !== 'true';
  button.setAttribute('aria-pressed', String(enable));
  button.title = enable ? 'Выключить звуковое окружение' : 'Включить звуковое окружение';
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
    source.start(); ambientSource = source;
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
