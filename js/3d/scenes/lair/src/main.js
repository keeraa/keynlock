import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createMaterials } from './materials.js';
import { buildLair } from './room.js';
import './style.css';

const canvas = document.querySelector('#scene');
const loading = document.querySelector('#loading');
const fallback = document.querySelector('#fallback');
const fpsLabel = document.querySelector('#fps');
const triangleLabel = document.querySelector('#triangles');
const panel = document.querySelector('#zone-panel');
const zones = {
  restoration: {
    number: '01', kicker: 'АТЕЛЬЕ САЙ', title: 'Реставрация',
    description: 'У охристой левой стены стоят два мольберта — эталон и ваша реставрация «Звёздной ночи». Рядом краски, кисти, палитра и коллекция спасённых полотен.',
    status: '3D-мастерская уже существует как отдельная сцена.',
    link: 'https://atelier-restoration-1115.k1r11111.chatgpt.site/',
    camera: [1.56, 3.22, -1.08], target: [-7.05, 2.48, -1.08],
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
    status: 'Выпиливание ключа предварительно готово; остальные режимы развиваются.',
    link: 'https://keynlock-workbench-1116.k1r11111.chatgpt.site/',
    camera: [1.22, 3.15, 4.27], target: [7.40, 1.68, 4.27],
  },
  alchemy: {
    number: '04', kicker: 'СОСТАВЫ И РЕАГЕНТЫ', title: 'Алхимия',
    description: 'Вся правая стена от пола до потолка покрыта зелёной гуашевой плиткой. У стены стоит алхимический стол с двумя ярусами, семью реагентами, пигментами, стеклом и свечами; над ним рецепт и часы.',
    status: 'Модульная 3D-лаборатория сохранена отдельно.',
    link: 'https://keynlock-alchemy-lab-1115.k1r11111.chatgpt.site/',
    camera: [1.12, 4.16, -1.24], target: [7.10, 2.54, -2.10],
  },
  gramophone: {
    number: '05', kicker: 'СКРЫТАЯ КОЛЛЕКЦИЯ', title: 'Музыка в Логове',
    description: 'Старый граммофон хранит запрещённые иностранные пластинки. Для будущего саундтрека отобраны три исполнения ноктюрнов Шопена: Op. 9 № 2 и два варианта Op. 9 № 1.',
    status: 'Фонотека задумана; сами записи пока не включены в опубликованную сцену.',
    link: null, camera: [1.95, 3.38, 3.60], target: [1.96, 2.26, -3.71],
  },
};

let renderer, scene, camera, controls, room;
let transitioning = false;
let desiredPosition = new THREE.Vector3();
let desiredTarget = new THREE.Vector3();
let currentZone = null;
let startPointer = null;
let hoveredZone = null;
const homePosition = new THREE.Vector3(.25, 6.48, 16.2);
const homeTarget = new THREE.Vector3(0, 4.12, -1.60);
const clock = new THREE.Clock();
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
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
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(47, 1, .06, 80);
  camera.position.copy(homePosition);
  controls = new OrbitControls(camera, canvas);
  controls.target.copy(homeTarget);
  controls.enableDamping = true;
  controls.dampingFactor = .075;
  // OrbitControls maps Command + left drag to pan when panning is enabled.
  controls.enablePan = true;
  controls.mouseButtons.RIGHT = THREE.MOUSE.ROTATE;
  controls.panSpeed = .72;
  controls.minDistance = 3.0;
  controls.maxDistance = 21;
  controls.minPolarAngle = .72;
  controls.maxPolarAngle = 1.65;
  controls.minAzimuthAngle = -1.7;
  controls.maxAzimuthAngle = 1.7;
  controls.rotateSpeed = .55;
  controls.zoomSpeed = .70;
  controls.addEventListener('start', () => { transitioning = false; });

  scene.add(new THREE.HemisphereLight('#ffe5bb', '#36453f', 2.0));
  scene.add(new THREE.AmbientLight('#d4bb9b', .36));
  const sun = new THREE.DirectionalLight('#ffdbac', 3.2);
  sun.position.set(-3.5, 15.7, 6.4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = .4; sun.shadow.camera.far = 35;
  sun.shadow.camera.left = -13; sun.shadow.camera.right = 13;
  sun.shadow.camera.top = 17; sun.shadow.camera.bottom = -12;
  sun.shadow.bias = -.00022; sun.shadow.normalBias = .02;
  scene.add(sun);
  const windowLight = new THREE.PointLight('#e9c090', 25, 11, 2);
  windowLight.position.set(-.3, 4.55, -4.8); scene.add(windowLight);
  const leftLight = new THREE.PointLight('#ffd5aa', 12, 8, 2);
  leftLight.position.set(-5.8, 3.65, .3); scene.add(leftLight);
  const { materials } = createMaterials();
  room = buildLair(scene, materials);

  window.addEventListener('resize', resize);
  canvas.addEventListener('pointerdown', e => { startPointer = [e.clientX, e.clientY]; });
  canvas.addEventListener('pointermove', hover3D);
  canvas.addEventListener('click', click3D);
  window.addEventListener('keydown', e => { if (e.key === 'Meta') canvas.classList.add('command-pan'); });
  window.addEventListener('keyup', e => { if (e.key === 'Meta') canvas.classList.remove('command-pan'); });
  window.addEventListener('blur', () => canvas.classList.remove('command-pan'));
  document.querySelectorAll('[data-zone]').forEach(button => {
    button.addEventListener('click', event => {
      event.stopPropagation();
      openZone(button.dataset.zone);
    });
  });
  document.querySelector('#close-panel').addEventListener('click', () => closePanel());
  document.querySelector('#reset-camera').addEventListener('click', resetView);
  document.addEventListener('keydown', handleKey);
  resize();
  window.setTimeout(() => loading.classList.add('done'), 900);
  animate();
}

function resize() {
  if (!renderer || !camera) return;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  camera.aspect = w / Math.max(h, 1);
  camera.fov = w < 720 ? 59 : w < 1050 ? 52 : 47;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
}

function focus(position, target) {
  desiredPosition.set(...position);
  desiredTarget.set(...target);
  transitioning = true;
  controls.minAzimuthAngle = -1.7;
  controls.maxAzimuthAngle = 1.7;
}

function openZone(id) {
  if (!zones[id]) return;
  currentZone = id;
  const zone = zones[id];
  focus(zone.camera, zone.target);
  document.querySelector('#panel-kicker').textContent = `${zone.number} / ${zone.kicker}`;
  document.querySelector('#panel-title').textContent = zone.title;
  document.querySelector('#panel-description').textContent = zone.description;
  document.querySelector('#panel-status').textContent = zone.status;
  const link = document.querySelector('#panel-link');
  link.hidden = !zone.link;
  if (zone.link) link.href = zone.link;
  panel.hidden = false;
  document.querySelectorAll('[data-zone]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.zone === id);
    if (btn.closest('.zone-nav')) btn.setAttribute('aria-pressed', String(btn.dataset.zone === id));
  });
}

function closePanel() {
  panel.hidden = true;
  currentZone = null;
  document.querySelectorAll('[data-zone]').forEach(button => {
    button.classList.remove('active');
    if (button.closest('.zone-nav')) button.setAttribute('aria-pressed', 'false');
  });
}

function resetView() {
  closePanel();
  focus(homePosition.toArray(), homeTarget.toArray());
}

function handleKey(e) {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
  if (e.key === 'Escape') { resetView(); return; }
  if (e.key === '0') { resetView(); return; }
  const names = ['restoration','planning','workbench','alchemy','gramophone'];
  const number = Number(e.key);
  if (number >= 1 && number <= 5 && String(number) === e.key) openZone(names[number - 1]);
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
  if (e.buttons) return;
  const id = hitZone(e);
  if (id !== hoveredZone) {
    hoveredZone = id;
    canvas.style.cursor = id ? 'pointer' : 'grab';
  }
}

function click3D(e) {
  if (e.metaKey) return;
  if (startPointer && Math.hypot(e.clientX - startPointer[0], e.clientY - startPointer[1]) > 7) return;
  const id = hitZone(e);
  if (id) openZone(id);
}

function updateHotspots() {
  const width = canvas.clientWidth, height = canvas.clientHeight;
  for (const button of document.querySelectorAll('.hotspot')) {
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
}

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), .05);
  const time = clock.elapsedTime;
  if (transitioning) {
    const factor = 1 - Math.exp(-4.8 * delta);
    camera.position.lerp(desiredPosition, factor);
    controls.target.lerp(desiredTarget, factor);
    if (camera.position.distanceTo(desiredPosition) < .014 && controls.target.distanceTo(desiredTarget) < .014) transitioning = false;
  }
  controls.update();
  for (const update of room.animated) update(time);
  updateHotspots();
  renderer.render(scene, camera);
  frames++; fpsTime += delta;
  if (fpsTime >= .65) {
    fpsLabel.textContent = Math.round(frames / fpsTime).toString();
    triangleLabel.textContent = new Intl.NumberFormat('ru-RU').format(renderer.info.render.triangles);
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
