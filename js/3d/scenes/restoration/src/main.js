import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createCartoonFilter } from './effects/cartoon-filter.js';
import { createWallGallery } from './wall-gallery.js';
import { chooseDemoWallPaintings } from './wall-demo.js';
import { createWorkshopRoom } from './workshop-room.js';
import { createArtworkRenderer } from './artwork-renderer.js';
import { createPaintingTextureCache } from './painting-texture-cache.js';
import { createPlayerProgress } from './player-progress.js';
import { createRestorationStore } from './restoration-store.js';
import { createRestorationSessions } from './restoration-sessions.js';
import { createSceneNavigation } from './scene-navigation.js';
import { createRestorationInput } from './restoration-input.js';
import { wireWorkshopUI } from './workshop-ui.js';
import { gradeWoodTexture, applyWoodTexture } from './wood-materials.js';
import { keynlockPaintings, paintingCategory, restorationTint } from './painting-catalog.js';
import { createPaintingCollectionUI } from './painting-collection-ui.js';
import { createPerformanceHUD } from './performance-hud.js';
import './style.css';

const featuredPaintings = [
  {
    id: 'girl-pearl', category: 'baroque', title: 'Девушка с жемчужной серёжкой', short: 'Девушка с серьгой', artist: 'Ян Вермеер', year: 'около 1665',
    image: '/paintings/vermeer-girl.jpg', hue: 22, saturation: 0.73, brightness: 1.15,
  },
  {
    id: 'starry-night', category: 'impressionism', title: 'Звёздная ночь', short: 'Звёздная ночь', artist: 'Винсент ван Гог', year: '1889',
    image: '/paintings/vangogh-starry.jpg', hue: -26, saturation: 1.27, brightness: 0.78,
  },
  {
    id: 'vangogh-self', category: 'impressionism', title: 'Автопортрет', short: 'Автопортрет', artist: 'Винсент ван Гог', year: '1889',
    image: '/paintings/vangogh-self.jpg', hue: 29, saturation: 0.82, brightness: 0.84,
  },
  {
    id: 'great-wave', category: 'japan', title: 'Большая волна в Канагаве', short: 'Большая волна', artist: 'Кацусика Хокусай', year: 'около 1831',
    image: '/paintings/hokusai-wave.jpg', hue: -18, saturation: 0.68, brightness: 1.23,
  },
  {
    id: 'mona-lisa', category: 'renaissance', title: 'Мона Лиза', short: 'Мона Лиза', artist: 'Леонардо да Винчи', year: '1503–1519',
    image: '/paintings/leonardo-mona.jpg', hue: 14, saturation: 1.31, brightness: 0.79,
  },
];
const featuredIds = new Set(featuredPaintings.map((art) => art.id));
const paintings = [
  ...featuredPaintings,
  ...keynlockPaintings.filter((art) => !featuredIds.has(art.id)).map((art) => ({
    ...art, short: art.title, category: paintingCategory(art), ...restorationTint(art.id),
  })),
];
let demoWallArtworks = chooseDemoWallPaintings(paintings);
let showingDemoWall = true;

const woodVariants = [
  { name: 'Охра', image: '/textures/wood-oak-gouache-v2.webp', grade: { contrast: .94, saturation: .71, tint: [-8, -2, 14] } },
  { name: 'Орех', image: '/textures/wood-walnut-gouache-v2.webp', grade: { contrast: .72, saturation: .91, tint: [0, 2, 4] } },
  { name: 'Пепел', image: '/textures/wood-ash-gouache-v2.webp' },
];
let woodTextures = [];
const selectedWood = { easel: 1, frame: 1 };

const $ = (id) => document.getElementById(id);
const stage = $('scene');
const performanceHUD = createPerformanceHUD({ fpsElement: $('fps-value'), polygonsElement: $('poly-value') });
const inputs = { hue: $('hue'), saturation: $('saturation'), brightness: $('brightness') };
const values = { hue: $('hue-value'), saturation: $('saturation-value'), brightness: $('brightness-value') };
const playerProgress = createPlayerProgress({ paintings });
const state = playerProgress.state;
let selected = 0;
let copyMaterial;
let toastTimeout;
const labelLayer = document.querySelector('.painting-labels');

// Gallery thumbnails are the actual source reproductions.
featuredPaintings.forEach((art, i) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'art-item';
  button.setAttribute('aria-label', `Выбрать картину: ${art.title}`);
  button.innerHTML = `<img src="${art.image}" alt="" loading="eager"/><span><strong>${art.short}</strong><small>${art.artist}</small></span>`;
  button.addEventListener('click', () => showPainting(i));
  $('art-list').appendChild(button);
});

const scene = new THREE.Scene();
scene.background = new THREE.Color('#71604c');
scene.fog = new THREE.Fog('#756650', 10, 55);

const camera = new THREE.PerspectiveCamera(39, 1, 0.1, 65);
camera.position.set(0, 2.27, 7.65);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.45));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
// The sunlight and workshop geometry are static between painting switches.
// Rebuilding the map only when the artwork changes keeps shadows stable in flight.
renderer.shadowMap.autoUpdate = false;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
stage.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1.87, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.055;
controls.enablePan = false;
controls.minDistance = 5.25;
controls.maxDistance = 11.6;
controls.minPolarAngle = 1.23;
controls.maxPolarAngle = 1.67;
controls.minAzimuthAngle = -0.29;
controls.maxAzimuthAngle = 0.29;
controls.update();

const mats = {
  easel: new THREE.MeshStandardMaterial({ color: '#765138', roughness: 0.87 }),
  easelEdge: new THREE.MeshStandardMaterial({ color: '#b27d4b', roughness: 0.72 }),
  deepWood: new THREE.MeshStandardMaterial({ color: '#423021', roughness: 0.9 }),
  roomWood: new THREE.MeshStandardMaterial({ color: '#6e5540', roughness: 1 }),
  roomEdge: new THREE.MeshStandardMaterial({ color: '#9b7b5b', roughness: 1 }),
  frameWood: new THREE.MeshStandardMaterial({ color: '#765138', roughness: 1 }),
  linen: new THREE.MeshStandardMaterial({ color: '#c6ae89', roughness: 1 }),
  metal: new THREE.MeshStandardMaterial({ color: '#8c7957', metalness: 0.76, roughness: 0.34 }),
};
function applyWoodVariant(target, index) {
  if (!(target in selectedWood) || !woodVariants[index]) return;
  selectedWood[target] = index;
  document.querySelectorAll(`.wood-option[data-target="${target}"]`).forEach((button) => {
    const active = Number(button.dataset.wood) === index;
    button.classList.toggle('selected', active);
    button.setAttribute('aria-pressed', String(active));
  });
  if (!woodTextures.length) return;

  const texture = woodTextures[index];
  const woodMats = target === 'easel' ? [
    [mats.easel, '#e8dfd0'],
    [mats.easelEdge, '#fff2da'],
    [mats.deepWood, '#c7b8a3'],
  ] : [
    [mats.frameWood, '#e8dfd0'],
  ];
  applyWoodTexture(woodMats, texture);
}

document.querySelectorAll('.wood-option').forEach((button) => {
  button.addEventListener('click', () => applyWoodVariant(button.dataset.target, Number(button.dataset.wood)));
});

const framedArtwork = createArtworkRenderer({ THREE, frameWood: mats.frameWood });
const { dust, makeEasel, wallpaperMaterial, floorWoodMaterials } = createWorkshopRoom({ THREE, scene, mats });
const wallGallery = createWallGallery({
  THREE, scene, camera, renderer, frameWood: mats.frameWood,
  onLayout: (layout) => navigation.updateWallLayout(layout),
});
const easelX = 1.28;
const leftEasel = makeEasel(-easelX, .045);
const rightEasel = makeEasel(easelX, -.045);

// Shared Keynlock post-processing: depth/normal outlines and softly stepped light.
const cartoonFilter = createCartoonFilter({ THREE, renderer, scene, camera });

const textureLoader = new THREE.TextureLoader();
const paintingTextureCache = createPaintingTextureCache({ THREE, loader: textureLoader, renderer });
let persistenceWarningShown = false;
const restorationStore = createRestorationStore({
  onError(message, error) {
    console.warn(message, error);
    if (!persistenceWarningShown) {
      persistenceWarningShown = true;
      showToast('Браузер не сохранил реставрацию — хранилище недоступно');
    }
  },
});
const restorationSessions = createRestorationSessions({ THREE, store: restorationStore });
const collectionUI = createPaintingCollectionUI({
  paintings,
  isRestored: (id) => playerProgress.isRestored(id),
  getWallIds: () => playerProgress.getWallIds(),
  onToggleWall: (id) => {
    const outcome = playerProgress.toggleWall(id);
    if (!outcome.changed && outcome.reason === 'full') showToast('На стене уже 30 картин. Снимите одну, чтобы повесить другую.');
    if (outcome.changed) {
      updateWallCounters();
      if (!showingDemoWall) void refreshWallGallery();
    }
  },
  onSelect: (index) => {
    if (navigation.isWallGallery()) navigation.leaveWallGallery({ immediate: true });
    void showPainting(index);
  },
});
let activeTexture = null;
let activeSurface = null;
let paintingRequest = 0;
let surfaceSaveTimer = null;
let workshopUI;
let wasWorkbenchVisible = null;

function updateWallCounters() {
  const count = playerProgress.getWallIds().length;
  $('wall-count').textContent = showingDemoWall ? `${demoWallArtworks.length} ДЕМО` : `${count} / 30`;
  $('wall-select-count').textContent = `${count}/30`;
  $('collection-wall-count').textContent = `${count}/30`;
  $('wall-gallery-demo').textContent = showingDemoWall ? 'МОИ КАРТИНЫ' : 'ДЕМО · 30';
  $('wall-gallery-demo').setAttribute('aria-pressed', String(showingDemoWall));
  $('wall-gallery-shuffle').hidden = !showingDemoWall;
}

async function refreshWallGallery() {
  const artById = new Map(paintings.map((art) => [art.id, art]));
  const selectedArtworks = showingDemoWall ? demoWallArtworks
    : playerProgress.getWallIds().map((id) => artById.get(id)).filter(Boolean);
  try { await wallGallery.setPaintings(selectedArtworks); }
  catch (error) { console.error('Не удалось обновить стену картин:', error); }
}

function onNewRestoration(id) {
  if (playerProgress.autoPin(id)) {
    updateWallCounters();
    if (!showingDemoWall) void refreshWallGallery();
  }
  collectionUI.refresh();
}

function handleWallChange({ mode, art }) {
  const active = mode !== 'closed';
  $('wall-gallery-open').hidden = active;
  $('wall-gallery-toolbar').hidden = !active;
  $('wall-gallery-navigation').hidden = !active || mode === 'art';
  $('wall-art-back').hidden = mode !== 'art';
  $('wall-art-hover').hidden = true;
  $('wall-gallery-title').textContent = mode === 'art' ? art.title : 'Стена восстановленных картин';
  $('wall-gallery-caption').textContent = mode === 'art' ? `${art.artist} · ${art.year}${showingDemoWall ? ' · демо' : ''}`
    : showingDemoWall ? 'Демо-экспозиция: 30 случайных произведений · прогресс реставрации не меняется'
    : playerProgress.getWallIds().length ? 'Выберите картину на стене — камера приблизится к ней'
      : 'Очистите полотно и восстановите цвет — готовая работа появится здесь';
  if (mode === 'art') void wallGallery.showHighResolution(art.id);
  else wallGallery.clearFocus();
  if (active && wasWorkbenchVisible === null) {
    wasWorkbenchVisible = workshopUI?.isWorkbenchVisible() ?? true;
    workshopUI?.setWorkbenchVisible(false);
  } else if (!active && wasWorkbenchVisible !== null) {
    workshopUI?.setWorkbenchVisible(wasWorkbenchVisible);
    wasWorkbenchVisible = null;
  }
}

function scheduleSurfaceSave(delay = 250) {
  clearTimeout(surfaceSaveTimer);
  const artId = paintings[selected]?.id;
  surfaceSaveTimer = setTimeout(() => {
    surfaceSaveTimer = null;
    if (artId) void restorationSessions.save(artId);
  }, delay);
}

function flushSurfaceSave() {
  clearTimeout(surfaceSaveTimer);
  surfaceSaveTimer = null;
  const artId = paintings[selected]?.id;
  if (artId) void restorationSessions.save(artId);
}

let restorationInput;
const navigation = createSceneNavigation({
  THREE, camera, controls, renderer, stage, easelX, cartoonFilter, labelLayer,
  getTexture: () => activeTexture,
  getTool: () => restorationInput?.currentTool(),
  clearUV: () => restorationInput?.clearUV(),
  onWallChange: handleWallChange,
  damageHint: $('damage-hint'), $,
});
restorationInput = createRestorationInput({
  THREE, renderer, camera, controls, scene, stage, leftEasel, rightEasel, navigation,
  getTexture: () => activeTexture, getSurface: () => activeSurface,
  onStrokeFinished: () => { updateRestorationStatus(true); scheduleSurfaceSave(); },
  onStrokeProgress: () => updateRestorationStatus(),
  onToolChanged: () => updateRestorationStatus(),
  getWallArtworkHit: (event) => wallGallery.hitTest(event),
  onWallArtworkClick: (art) => navigation.focusWallArt(art),
  onWallArtworkHover: (art, event) => {
    const element = $('wall-art-hover');
    if (!art || !navigation.isWallGallery() || navigation.focusedWallId()) {
      element.hidden = true;
      return;
    }
    element.textContent = art.title;
    element.hidden = false;
    const bounds = stage.getBoundingClientRect();
    element.style.left = `${Math.min(bounds.width - 180, Math.max(16, event.clientX - bounds.left + 17))}px`;
    element.style.top = `${Math.max(15, event.clientY - bounds.top - 42)}px`;
  },
  $,
});
workshopUI = wireWorkshopUI({ cartoonFilter, navigation, restorationInput, collectionUI, $ });
$('wall-gallery-open').addEventListener('click', () => navigation.enterWallGallery(wallGallery.getLayout().bounds));
$('wall-gallery-back').addEventListener('click', () => navigation.leaveWallGallery());
$('wall-gallery-select').addEventListener('click', () => collectionUI.open('wall'));
$('wall-gallery-demo').addEventListener('click', () => {
  showingDemoWall = !showingDemoWall;
  if (navigation.focusedWallId()) navigation.leaveWallArt();
  updateWallCounters();
  if (navigation.isWallGallery()) handleWallChange({ mode: 'overview' });
  void refreshWallGallery();
});
$('wall-gallery-shuffle').addEventListener('click', () => {
  demoWallArtworks = chooseDemoWallPaintings(paintings);
  if (navigation.focusedWallId()) navigation.leaveWallArt();
  updateWallCounters();
  if (navigation.isWallGallery()) handleWallChange({ mode: 'overview' });
  void refreshWallGallery();
});
$('wall-art-back').addEventListener('click', () => navigation.leaveWallArt());
$('wall-gallery-up').addEventListener('click', () => navigation.moveAlongWall(1));
$('wall-gallery-down').addEventListener('click', () => navigation.moveAlongWall(-1));
updateWallCounters();
window.addEventListener('pagehide', flushSurfaceSave);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') flushSurfaceSave();
});
function playerSettings() {
  return state[selected];
}

function updateDamageShader() {
  if (!copyMaterial) return;
  const art = paintings[selected], player = playerSettings();
  copyMaterial.uniforms.uHue.value = art.hue + player.hue;
  copyMaterial.uniforms.uSaturation.value = art.saturation * player.saturation / 100;
  copyMaterial.uniforms.uBrightness.value = art.brightness * player.brightness / 100;
}

function accuracy() {
  const art = paintings[selected], player = playerSettings();
  const h = Math.abs(art.hue + player.hue) / 60;
  const s = Math.abs(Math.log(art.saturation * player.saturation / 100)) / Math.log(1.8);
  const b = Math.abs(Math.log(art.brightness * player.brightness / 100)) / Math.log(1.7);
  const error = Math.sqrt(.34 * h * h + .33 * s * s + .33 * b * b);
  const unassisted = Math.max(0, Math.min(100, 100 * (1 - error * 1.4)));
  // A 95% physical match is a perfect game score; 90% reads as 95%.
  return Math.min(100, Math.round(unassisted / .95));
}

function showToast(message) {
  clearTimeout(toastTimeout);
  $('toast-text').textContent = message;
  $('toast').classList.add('show');
  toastTimeout = setTimeout(() => $('toast').classList.remove('show'), 3400);
}

function updateRestorationStatus(checkCompletion = false) {
  if (!activeSurface) return;
  const progress = activeSurface.progress();
  $('restoration-progress').firstChild.textContent = `${progress.cleaning}% `;
  const instructions = {
    brush: `Щётка: зажмите ЛКМ и ведите по картине · стойкие пятна — тампон (7)`,
    swab: `Тампон: зажмите ЛКМ и медленно очищайте пятна круговыми движениями`,
    uv: 'УФ: наведите фонарь, затем зажмите ЛКМ и просканируйте повреждения',
    reagent: 'Реагент: зажмите ЛКМ и проведите по участкам, отмеченным УФ',
    retouch: 'Кисть: аккуратно закрашивайте светлые сколы на полотне · размер кисти маленький',
  };
  $('restoration-description').textContent = instructions[restorationInput.currentTool()] ||
    'Наведите курсор на пятно — игра подскажет подходящий инструмент';
  const player = playerSettings();
  if (checkCompletion) {
    let message = null;
    if (progress.dirt >= 91 && !player.dustMilestone) {
      player.dustMilestone = true;
      message = 'Пыль и грязь удалены — проявились детали картины';
    }
    if (progress.varnish >= 91 && !player.varnishMilestone) {
      player.varnishMilestone = true;
      message = 'Пожелтевший лак снят — цвета раскрываются';
    }
    if (progress.retouch >= 94 && !player.retouchMilestone) {
      player.retouchMilestone = true;
      message = 'Сколы восстановлены — живопись снова цельная';
    }
    if (progress.cleaning >= 96 && !player.surfaceComplete) {
      player.surfaceComplete = true;
      message = `«${paintings[selected].short}» — реставрация завершена!`;
      onNewRestoration(paintings[selected].id);
    }
    if (message) { showToast(message); playerProgress.save(); }
  }
}

function updateUI() {
  const art = paintings[selected], player = playerSettings();
  for (const key of ['hue', 'saturation', 'brightness']) inputs[key].value = player[key];
  values.hue.textContent = `${player.hue > 0 ? '+' : ''}${player.hue}°`;
  values.saturation.textContent = `${player.saturation}%`;
  values.brightness.textContent = `${player.brightness}%`;
  const score = accuracy();
  $('score-number').textContent = score;
  $('score-fill').style.width = `${score}%`;
  $('score-comment').textContent = score >= 97 ? 'Цвет почти восстановлен ✦' : score >= 83 ? 'Очень близко к эталону' : score >= 63 ? 'Уже похоже, продолжайте' : 'Нужно восстановить баланс';
  $('score-fill').style.background = score >= 97 ? '#688264' : '#a88b54';
  updateDamageShader();
  if (score >= 98 && !player.completed) {
    player.completed = true;
    playerProgress.save();
    showToast(`«${art.short}» — цвет восстановлен!`);
    onNewRestoration(art.id);
  }
}

async function showPainting(index) {
  restorationInput.hide();
  const next = (index + paintings.length) % paintings.length;
  const art = paintings[next];
  const request = ++paintingRequest;
  try {
    if (next !== selected || !activeTexture) {
      $('art-title').textContent = 'Загружаем репродукцию…';
    }
    const texture = await paintingTextureCache.load(art);
    if (request !== paintingRequest) return;
    const aspect = (texture.image.naturalWidth || texture.image.width) / (texture.image.naturalHeight || texture.image.height);
    const height = Math.min(2.28, 2.17 / aspect);
    const width = height * aspect;
    const surface = await restorationSessions.get(art, width, height);
    if (request !== paintingRequest) return;
    if (navigation.focusedSide()) navigation.leaveFocus({ immediate: true });
    restorationInput.finishStroke();
    flushSurfaceSave();
    activeSurface?.unmount();
    selected = next;
    activeTexture = texture;
    const framing = framedArtwork(leftEasel, texture, width, height);
    copyMaterial = framedArtwork(rightEasel, texture, width, height).material;
    renderer.shadowMap.needsUpdate = true;
    navigation.setPaintingCenterY(framing.centerY);

    activeSurface = surface;
    activeSurface.mount(rightEasel.artwork);
    activeSurface.setUVPointer(null);
    restorationInput.setSurface(activeSurface);
    paintingTextureCache.trim(art.image);
    restorationSessions.trim(art.id);

    $('art-title').textContent = art.title;
    $('art-author').textContent = `${art.artist} · ${art.year}`;
    $('art-index').textContent = `№ ${String(selected + 1).padStart(2, '0')}`;
    $('top-index').textContent = `${String(selected + 1).padStart(2, '0')} / ${String(paintings.length).padStart(2, '0')}`;
    navigation.updateStepper();
    document.querySelectorAll('.art-item').forEach((item, i) => {
      item.classList.toggle('active', i === selected);
      item.setAttribute('aria-pressed', String(i === selected));
    });
    document.querySelectorAll('.art-item')[selected]?.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
    collectionUI.setActive(art.id);
    playerProgress.setSelected(art.id);
    $('collection-footer').classList.toggle('active', selected >= featuredPaintings.length);
    updateUI();
    updateRestorationStatus();
    navigation.renderLabels();
    if (restorationInput.currentTool()) navigation.focusOn('copy');
  } catch (error) {
    if (request !== paintingRequest) return;
    console.error('Не удалось загрузить картину:', art.image, error);
    $('art-title').textContent = paintings[selected].title;
    showToast('Изображение недоступно. Выберите другую картину.');
    if (!activeTexture && next !== 0) await showPainting(0);
  }
}

for (const key of Object.keys(inputs)) {
  inputs[key].addEventListener('input', (event) => {
    playerSettings()[key] = Number(event.target.value);
    updateUI();
    playerProgress.save();
  });
}
$('reset-button').addEventListener('click', () => {
  const removedFromWall = playerProgress.removeFromWall(paintings[selected].id);
  Object.assign(playerSettings(), { hue: 0, saturation: 100, brightness: 100, completed: false,
    surfaceComplete: false, dustMilestone: false, varnishMilestone: false, retouchMilestone: false });
  activeSurface?.reset();
  updateUI();
  updateRestorationStatus();
  playerProgress.save();
  if (removedFromWall) { updateWallCounters(); if (!showingDemoWall) void refreshWallGallery(); }
  collectionUI.refresh();
  scheduleSurfaceSave();
});

let previousTime = performance.now();
let dustTime = 0;
function animate(now) {
  const dt = Math.min(0.05, (now - previousTime) / 1000);
  previousTime = now;
  const cameraMoved = navigation.animate(now);
  if (!collectionUI.isOpen()) {
    // Floating dust only needs 30 updates per second; this avoids uploading
    // its vertex buffer on every frame on high-refresh displays.
    dustTime += dt;
    if (dustTime >= 1 / 30) {
      dust.rotation.y += dustTime * .003;
      const positions = dust.geometry.attributes.position;
      for (let i = 0; i < positions.count; i++) {
        let y = positions.getY(i) + dustTime * (.01 + (i % 5) * .009);
        if (y > 5.4) y = .3;
        positions.setY(i, y);
      }
      positions.needsUpdate = true;
      dustTime = 0;
    }
    activeSurface?.update(now * .001);
    cartoonFilter.setFocus(camera.position.distanceTo(controls.target));
    const stats = cartoonFilter.render();
    performanceHUD.frame(now, stats.sceneTriangles ?? stats.triangles ?? 0);
    if (cameraMoved) navigation.renderLabels();
  } else performanceHUD.pause();
  requestAnimationFrame(animate);
}

async function init() {
  try {
    const [loadedWood, wallpaper] = await Promise.all([
      Promise.all(woodVariants.map(async (variant) => {
        const source = await textureLoader.loadAsync(variant.image);
        const texture = gradeWoodTexture({ THREE, texture: source, grade: variant.grade });
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(1, 1);
        texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        return texture;
      })),
      textureLoader.loadAsync('/textures/atelier-wallpaper-gouache.webp'),
    ]);
    woodTextures = loadedWood;
    wallpaper.colorSpace = THREE.SRGBColorSpace;
    wallpaper.wrapS = wallpaper.wrapT = THREE.ClampToEdgeWrapping;
    wallpaper.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    wallpaperMaterial.map = wallpaper;
    wallpaperMaterial.needsUpdate = true;
    const floorTexture = woodTextures[1].clone();
    floorTexture.center.set(.5, .5);
    floorTexture.rotation = Math.PI / 2;
    floorTexture.repeat.set(3.5, 1.25);
    floorTexture.needsUpdate = true;
    floorWoodMaterials.forEach((material) => {
      material.map = floorTexture;
      material.needsUpdate = true;
    });
    applyWoodTexture([
      [mats.roomWood, '#c7b8a3'],
      [mats.roomEdge, '#e8dfd0'],
    ], woodTextures[1]);
    // Gallery previews stream independently; the easels need not wait for 30 images.
    void refreshWallGallery();
    applyWoodVariant('easel', selectedWood.easel);
    applyWoodVariant('frame', selectedWood.frame);
    await showPainting(playerProgress.getSelectedIndex());
    navigation.resize();
    requestAnimationFrame(animate);
    setTimeout(() => $('loading').classList.add('hide'), 420);
  } catch (error) {
    console.error('Ошибка загрузки репродукций:', error);
    $('loading').querySelector('small').textContent = 'НЕ УДАЛОСЬ ЗАГРУЗИТЬ КАРТИНЫ';
  }
}
init();
