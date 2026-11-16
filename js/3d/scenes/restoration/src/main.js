import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createCartoonFilter } from './effects/cartoon-filter.js';
import { createWallGallery } from './wall-gallery.js';
import { createWallExhibitionController } from './wall-exhibition-controller.js';
import { createWorkshopRoom } from './workshop-room.js';
import { createArtworkRenderer } from './artwork-renderer.js';
import { createPaintingTextureCache } from './painting-texture-cache.js';
import { createPlayerProgress } from './player-progress.js';
import { createRestorationStore } from './restoration-store.js';
import { createRestorationSessions } from './restoration-sessions.js';
import { createSceneNavigation } from './scene-navigation.js';
import { createRestorationInput } from './restoration-input.js';
import { wireWorkshopUI } from './workshop-ui.js';
import { featuredPaintings, paintings, woodVariants } from './atelier-config.js';
import { createWoodStyle } from './wood-style.js';
import { createPaintingCollectionUI } from './painting-collection-ui.js';
import { createPerformanceHUD } from './performance-hud.js';
import { createRestorationFeedback } from './restoration-feedback.js';
import { getPaintingLore, getPaintingLoreLabels } from './lore/painting-lore.js';
import './style.css';

const $ = (id) => document.getElementById(id);
const stage = $('scene');
const performanceHUD = createPerformanceHUD({ fpsElement: $('fps-value'), polygonsElement: $('poly-value') });
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
  frameWood: new THREE.MeshStandardMaterial({ color: '#b7b3ab', roughness: 1 }),
  linen: new THREE.MeshStandardMaterial({ color: '#c6ae89', roughness: 1 }),
  metal: new THREE.MeshStandardMaterial({ color: '#8c7957', metalness: 0.76, roughness: 0.34 }),
};
const framedArtwork = createArtworkRenderer({ THREE, frameWood: mats.frameWood });
const { dust, makeEasel, wallpaperMaterial, floorWoodMaterials } = createWorkshopRoom({ THREE, scene, mats });
const textureLoader = new THREE.TextureLoader();
const woodStyle = createWoodStyle({ THREE, renderer, loader: textureLoader, mats, wallpaperMaterial,
  floorWoodMaterials, variants: woodVariants });
const wallGallery = createWallGallery({
  THREE, scene, camera, renderer, frameWood: mats.frameWood,
  onLayout: (layout) => navigation.updateWallLayout(layout),
});
const easelX = 1.28;
const leftEasel = makeEasel(-easelX, .045);
const rightEasel = makeEasel(easelX, -.045);

// Shared Keynlock post-processing: depth/normal outlines and softly stepped light.
const cartoonFilter = createCartoonFilter({ THREE, renderer, scene, camera });

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
let exhibition;
const collectionUI = createPaintingCollectionUI({
  paintings,
  isRestored: (id) => playerProgress.isRestored(id),
  getWallIds: () => playerProgress.getWallIds(),
  onToggleWall: (id) => exhibition.toggleWall(id),
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
let restorationFeedback;
const navigation = createSceneNavigation({
  THREE, camera, controls, renderer, stage, easelX, cartoonFilter, labelLayer,
  getTexture: () => activeTexture,
  getTool: () => restorationInput?.currentTool(),
  clearUV: () => restorationInput?.clearUV(),
  onWallChange: (event) => exhibition?.handleModeChange(event),
  damageHint: $('damage-hint'), $,
});
restorationInput = createRestorationInput({
  THREE, renderer, camera, controls, scene, stage, leftEasel, rightEasel, navigation,
  getTexture: () => activeTexture, getSurface: () => activeSurface,
  onStrokeFinished: () => { restorationFeedback.updateRestorationStatus(true); scheduleSurfaceSave(); },
  onStrokeProgress: () => restorationFeedback.updateRestorationStatus(),
  onToolChanged: () => restorationFeedback.updateRestorationStatus(),
  getWallArtworkHit: (event) => wallGallery.hitTest(event),
  onWallArtworkClick: (art) => navigation.focusWallArt(art),
  onWallArtworkHover: (art, event) => {
    const element = $('wall-art-hover');
    if (!art || !navigation.isWallGallery() || navigation.focusedWallId()) {
      element.hidden = true;
      return;
    }
    element.textContent = `${art.columnLabel} · ${art.title}`;
    element.hidden = false;
    const bounds = stage.getBoundingClientRect();
    element.style.left = `${Math.min(bounds.width - 180, Math.max(16, event.clientX - bounds.left + 17))}px`;
    element.style.top = `${Math.max(15, event.clientY - bounds.top - 42)}px`;
  },
  $,
});
workshopUI = wireWorkshopUI({ cartoonFilter, navigation, restorationInput, collectionUI, $ });
exhibition = createWallExhibitionController({ paintings, playerProgress, wallGallery, collectionUI,
  getNavigation: () => navigation, getWorkshopUI: () => workshopUI, showToast, $ });
exhibition.bind();
restorationFeedback = createRestorationFeedback({ paintings, getSelectedIndex: () => selected,
  getSurface: () => activeSurface, getCopyMaterial: () => copyMaterial,
  getCurrentTool: () => restorationInput.currentTool(), playerProgress,
  onRestorationComplete: (id) => exhibition.onNewRestoration(id), showToast, $ });
restorationFeedback.bindControls();
window.addEventListener('pagehide', flushSurfaceSave);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') flushSurfaceSave();
});
function showToast(message) {
  clearTimeout(toastTimeout);
  $('toast-text').textContent = message;
  $('toast').classList.add('show');
  toastTimeout = setTimeout(() => $('toast').classList.remove('show'), 3400);
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
    const lore = getPaintingLore(art.id);
    const loreLabels = getPaintingLoreLabels();
    $('art-description').textContent = lore?.description || '';
    $('art-ban-label').textContent = loreLabels.banned;
    $('art-ban-reason').textContent = lore?.banReason || '';
    $('art-policy').textContent = loreLabels.policy;
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
    restorationFeedback.updateUI();
    restorationFeedback.updateRestorationStatus();
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

$('reset-button').addEventListener('click', () => {
  const removedFromWall = playerProgress.removeFromWall(paintings[selected].id);
  Object.assign(state[selected], { hue: 0, saturation: 100, brightness: 100, completed: false,
    surfaceComplete: false, dustMilestone: false, varnishMilestone: false, retouchMilestone: false });
  activeSurface?.reset();
  restorationFeedback.updateUI();
  restorationFeedback.updateRestorationStatus();
  playerProgress.save();
  if (removedFromWall) exhibition.refreshAfterWallChange();
  collectionUI.refresh();
  scheduleSurfaceSave();
});

let previousTime = performance.now();
let dustTime = 0;
function animate(now) {
  const dt = Math.min(0.05, (now - previousTime) / 1000);
  previousTime = now;
  const cameraMoved = navigation.animate(now);
  exhibition.updateViewedArtwork(now);
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
    await woodStyle.initialize();
    // Gallery previews stream independently; the easels need not wait for 30 images.
    void exhibition.refresh();
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
