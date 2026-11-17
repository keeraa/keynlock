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
// The standalone Atelier loads its stylesheet normally; the Lair imports the
// exact same stylesheet into a scoped root, preserving its own application CSS.
const directRoot = window.__keynlockAtelierEmbedRoot || null;
if (!directRoot) void import('./style.css');
const $ = (id) => directRoot?.querySelector(`#${CSS.escape(id)}`) || document.getElementById(id);
const lairWindow = directRoot ? window : window.parent;
let rendererHost = null;
try {rendererHost = (lairWindow !== window || directRoot) ? lairWindow.__keynlockRendererHost : null;}
catch {rendererHost = null;} // The standalone Atelier may be cross-origin framed.
const embedded = Boolean(rendererHost);
if (embedded && !directRoot) document.documentElement.classList.add('lair-embedded');
const stage = $('scene');
const performanceHUD = createPerformanceHUD({ fpsElement: $('fps-value'), polygonsElement: $('poly-value') });
const playerProgress = createPlayerProgress({ paintings });
const state = playerProgress.state;
let selected = playerProgress.getSelectedIndex();
let copyMaterial;
let toastTimeout;
const labelLayer = (directRoot || document).querySelector('.painting-labels');

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
// Keep the complete original Atelier, including its exact paintings and tools,
// in the same spatial world as KEYNLOCK's Lair.
rendererHost?.registerWorldScene('restoration', {scene, camera});
const renderer = embedded
  ? rendererHost.createRenderer('restoration', document.createElement('canvas'))
  : new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
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
if (embedded) {
  // The standalone Atelier's angled sun is useful for its own room, but in
  // the shared Lair its shadow map throws giant diagonal stripes across the
  // salon. The Lair's overhead light supplies short contact shadows instead.
  scene.traverse(object => {
    if (object.isDirectionalLight) object.castShadow = false;
  });
  // The original Atelier is mounted inside the existing Lair. Its painted
  // walls, easels, tools and art remain; the duplicate floor cannot cover the
  // Lair's continuous planks.
  for (const object of scene.children) {
    if (object.name.startsWith('atelier-original-floor-')) object.visible = false;
    if (object.name === 'atelier-original-wallpaper') object.visible = false;
  }
}
const textureLoader = new THREE.TextureLoader();
const woodStyle = createWoodStyle({ THREE, renderer, loader: textureLoader, mats, wallpaperMaterial,
  floorWoodMaterials, variants: woodVariants });
const wallGallery = createWallGallery({
  THREE, scene, camera, renderer, frameWood: mats.frameWood,
  pointerElement: embedded ? lairWindow.__keynlockLairInteractionElement : renderer.domElement,
  onLayout: (layout) => navigation.updateWallLayout(layout),
});
const easelX = 1.28;
const leftEasel = makeEasel(-easelX, .045);
const rightEasel = makeEasel(easelX, -.045);
if (embedded) {
  // Align the only live pair of Atelier easels with the Lair's left wall.
  // Their original tools and painting meshes stay in the same coordinate space.
  leftEasel.root.position.z = -3.25;
  rightEasel.root.position.z = -3.25;
  // Preserve the original Atelier's camera-to-easel distance after moving the
  // pair toward the Lair wall. Otherwise the source overview no longer frames
  // the easel construction as it does in the standalone workshop.
  camera.position.z -= 3.25;
  controls.target.z -= 3.25;
  controls.update();
}
function focusLairArtwork(side) {
  if (!embedded) return;
  const painting = side === 'original' ? leftEasel.paintingMesh : rightEasel.paintingMesh;
  if (!painting) return;
  // The Atelier's framing already knows the painting dimensions, the screen
  // aspect ratio and whether we are switching between close-ups. Transform
  // that exact camera destination into the common room's world coordinates.
  const destination = navigation.focusPose(side);
  scene.updateWorldMatrix(true, false);
  const worldPosition = scene.localToWorld(destination.position.clone());
  const worldTarget = scene.localToWorld(destination.target.clone());
  navigation.focusOn(side);
  lairWindow.__keynlockLairFocusArtwork?.({
    side, position: worldPosition.toArray(), target: worldTarget.toArray(),
    fov: camera.fov,
  });
}
function leaveLairArtworkFocus() {
  navigation.leaveFocus();
  lairWindow.__keynlockLairFocusEasels?.();
}

// Shared Keynlock post-processing: depth/normal outlines and softly stepped light.
const cartoonFilter = createCartoonFilter({ THREE, renderer, scene, camera,
  renderScene: embedded
    ? rendererHost?.getUnifiedScene() || scene
    : scene,
});

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

// When viewed from the Lair, the actual Atelier remains the editing surface.
// Only signal readiness and finish pending local saves before the Lair unloads
// the iframe; paintings and restoration state stay in this origin's storage.
const LAIR_ORIGIN = window.location.origin;
const EMBED_BRIDGE = 'keynlock:atelier-embed:v1';
function notifyLair(type, detail = {}) {
  if (directRoot) {
    window.dispatchEvent(new CustomEvent('keynlock:atelier',{detail:{type,...detail}}));
  } else if (window.parent !== window) {
    window.parent.postMessage({ bridge: EMBED_BRIDGE, type, ...detail }, LAIR_ORIGIN);
  }
}
if (embedded) {
  // The original collection modal temporarily expands its existing panel.
  // Nothing here creates a new workshop or duplicates restoration controls.
  const modal = $('collection-modal');
  const sendCollectionState = () => notifyLair('collection-open',{open: !modal.hidden});
  new MutationObserver(sendCollectionState).observe(modal,{attributes:true,attributeFilter:['hidden']});
  sendCollectionState();
}
async function flushAtelier() {
  restorationInput.finishStroke();
  flushSurfaceSave();
  await restorationStore.flush();
  notifyLair('flushed');
}
if (directRoot) window.__keynlockAtelierFlush = flushAtelier;
window.addEventListener('message', async (event) => {
  if (event.origin !== LAIR_ORIGIN || event.source !== window.parent) return;
  if (event.data?.bridge !== EMBED_BRIDGE || event.data.type !== 'flush') return;
  await flushAtelier();
});

let restorationInput;
let restorationFeedback;
const navigation = createSceneNavigation({
  THREE, camera, controls, renderer, stage, easelX, cartoonFilter, labelLayer,
  easelOffsetZ: embedded ? -3.25 : 0,
  getTexture: () => activeTexture,
  getTool: () => restorationInput?.currentTool(),
  clearUV: () => restorationInput?.clearUV(),
  onWallChange: (event) => exhibition?.handleModeChange(event),
  damageHint: $('damage-hint'), $,
});
restorationInput = createRestorationInput({
  THREE, renderer, camera, controls, scene,
  stage: embedded ? lairWindow.__keynlockLairInteractionElement : stage,
  leftEasel, rightEasel, navigation,
  // The Lair canvas owns camera movement and restoration brush input. The
  // source iframe is only a retained model/state controller, never a viewport.
  inputElement: embedded ? lairWindow.__keynlockLairInteractionElement : renderer.domElement,
  interactionCamera: embedded ? lairWindow.__keynlockLairCamera : camera,
  roomControls: embedded ? lairWindow.__keynlockLairControls : null,
  onPaintingFocus: embedded ? focusLairArtwork : (side) => navigation.focusOn(side),
  isInteractive: () => !embedded || Boolean(lairWindow.__keynlockRestorationActive),
  embeddedEditing: embedded,
  getTexture: () => activeTexture, getSurface: () => activeSurface,
  onStrokeFinished: () => { restorationFeedback.updateRestorationStatus(true); scheduleSurfaceSave(); },
  onStrokeProgress: () => restorationFeedback.updateRestorationStatus(),
  onToolChanged: () => {
    restorationFeedback.updateRestorationStatus();
    if (embedded && restorationInput.currentTool()) focusLairArtwork('copy');
  },
  getWallArtworkHit: (event) => wallGallery.hitTest(event),
  onWallArtworkClick: (art) => navigation.focusWallArt(art),
  onWallArtworkHover: (art, event) => {
    if (embedded) {
      lairWindow.__keynlockLairHoverGalleryArtwork?.(
        art && navigation.isWallGallery() && !navigation.focusedWallId()
          ? { label: `${art.columnLabel} · ${art.title}`, x: event.clientX, y: event.clientY }
          : null,
      );
      return;
    }
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
workshopUI = wireWorkshopUI({ cartoonFilter, navigation, restorationInput, collectionUI, $,
  isEnabled: () => (!embedded || Boolean(lairWindow.__keynlockRestorationActive))
    && (!embedded || !lairWindow.__keynlockLairGalleryActive),
  focusEasel: embedded ? focusLairArtwork : side => navigation.focusOn(side),
  leaveEaselFocus: embedded ? leaveLairArtworkFocus : () => navigation.leaveFocus() });
exhibition = createWallExhibitionController({ paintings, playerProgress, wallGallery, collectionUI,
  getNavigation: () => navigation, getWorkshopUI: () => workshopUI, showToast, $ });
exhibition.bind();
// The Lair's single renderer follows the original gallery camera. These
// controls retain the Atelier's 30-frame layout, movements and artwork focus.
if (directRoot) window.__keynlockAtelierGallery = {
  setAspect(aspect) {
    if (Number.isFinite(aspect) && aspect > 0) {
      camera.aspect = aspect;
      camera.fov = aspect < 1.35 ? 44 : 39;
      camera.updateProjectionMatrix();
    }
  },
  open(aspect) {
    this.setAspect(aspect);
    if (!navigation.isWallGallery()) navigation.enterWallGallery(wallGallery.getLayout().bounds);
  },
  leave() { navigation.leaveWallGallery({ immediate: true }); },
  step: (direction) => navigation.moveAlongWall(direction),
  pan: (fraction) => navigation.panAlongWall(fraction),
  zoom: (deltaY) => navigation.zoomWall(deltaY),
  backFromArt: () => navigation.leaveWallArt(),
  isActive: () => navigation.isWallGallery(),
  mode: () => navigation.mode(),
  select: () => $('wall-gallery-select').click(),
  switchDisplay: () => $('wall-gallery-demo').click(),
  shuffle: () => $('wall-gallery-shuffle').click(),
};
restorationFeedback = createRestorationFeedback({ paintings, getSelectedIndex: () => selected,
  getSurface: () => activeSurface, getCopyMaterial: () => copyMaterial,
  getCurrentTool: () => restorationInput.currentTool(), playerProgress,
  onRestorationComplete: (id) => exhibition.onNewRestoration(id), showToast, $ });
restorationFeedback.bindControls();
// Even before the first image finishes decoding, the mounted native ranges
// have a real player state and a numeric similarity score. Editing them must
// never depend on a texture or an IndexedDB restoration session.
restorationFeedback.updateUI();
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

// A small API for keyboard access to the original source controls. All UI
// buttons and the original painting tools remain owned by this Atelier.
function artworkInfo(art) {
  if (!art) return null;
  const lore = getPaintingLore(art.id);
  const labels = getPaintingLoreLabels();
  return {
    id: art.id, title: art.title, artist: art.artist, year: art.year,
    index: paintings.indexOf(art) + 1, total: paintings.length,
    description: lore?.description || '', banReason: lore?.banReason || '',
    banLabel: labels.banned, policy: labels.policy,
  };
}
if (embedded) window.__keynlockRestorationBridge = {
  isReady: () => Boolean(activeTexture && activeSurface),
  setViewportAspect: aspect => {
    if (!Number.isFinite(aspect) || aspect <= 0) return;
    camera.aspect = aspect;
    camera.fov = aspect < 1.35 ? 44 : 39;
    camera.updateProjectionMatrix();
  },
  catalog: () => paintings.map(({id,title,artist,year,image}) => ({id,title,artist,year,image})),
  artworkInfo: () => artworkInfo(paintings[selected]),
  wallArtworkInfo: () => artworkInfo(paintings.find(art =>
    art.id === (navigation.focusedWallId() || exhibition.viewedId()))),
  focusEasel: side => focusLairArtwork(side),
  returnToEasels: () => leaveLairArtworkFocus(),
  resetEaselFocus: () => navigation.leaveFocus({ immediate: true }),
  focusedSide: () => navigation.focusedSide(),
  easelLabelPoints: () => [
    { side: 'original', mesh: leftEasel.paintingMesh, offset: -.62 },
    { side: 'copy', mesh: rightEasel.paintingMesh, offset: .62 },
  ].map(({side,mesh,offset}) => {
    mesh.updateWorldMatrix(true, false);
    const height = mesh.geometry.parameters?.height || 1.8;
    return { side, point: mesh.localToWorld(new THREE.Vector3(offset, height / 2 + .19, .04)).toArray() };
  }),
  snapshot: () => ({
    selected,
    title:paintings[selected].title,
    artist:paintings[selected].artist,
    year:paintings[selected].year,
    tool:restorationInput.currentTool(),
    hue:Number($('hue').value),
    saturation:Number($('saturation').value),
    brightness:Number($('brightness').value),
    score:$('score-number').textContent.trim().replace(/%$/, ''),
    progress:$('restoration-progress').textContent.replace(/\s+/g,' ').trim(),
  }),
  showPainting:index => showPainting(index),
  selectTool:tool => restorationInput.selectTool(tool),
  setColor:(key,value) => {
    if (!['hue','saturation','brightness'].includes(key)) return;
    const input = $(key);
    input.value = String(value);
    input.dispatchEvent(new Event('input',{bubbles:true}));
  },
  reset:() => $('reset-button').click(),
};

async function showPainting(index) {
  restorationInput.hide();
  const next = (index + paintings.length) % paintings.length;
  const art = paintings[next];
  const request = ++paintingRequest;
  if (next !== selected || !activeTexture) {
    $('art-title').textContent = 'Загружаем репродукцию…';
  }
  let texture;
  // Only a failed image request warrants the "image unavailable" message.
  // UI updates and saved restoration layers are independent operations.
  try {
    texture = await paintingTextureCache.load(art);
  } catch (error) {
    if (request !== paintingRequest) return;
    console.error('Не удалось скачать репродукцию:', art.image, error);
    $('art-title').textContent = paintings[selected].title;
    showToast(error?.message?.startsWith('Timed out loading artwork:')
      ? 'Загрузка затянулась. Пока покажем картину из локальной коллекции.'
      : 'Изображение недоступно. Выберите другую картину.');
    if (!activeTexture && next !== 0) void showPainting(0);
    return;
  }
  if (request !== paintingRequest) return;
  const aspect = (texture.image.naturalWidth || texture.image.width) / (texture.image.naturalHeight || texture.image.height);
  const height = Math.min(2.28, 2.17 / aspect);
  const width = height * aspect;
  try {
    if (navigation.focusedSide()) {
      navigation.leaveFocus({ immediate: true });
      if (embedded) lairWindow.__keynlockLairFocusEasels?.();
    }
    restorationInput.finishStroke();
    flushSurfaceSave();
    activeSurface?.unmount();
    activeSurface = null;
    selected = next;
    activeTexture = texture;
    const framing = framedArtwork(leftEasel, texture, width, height);
    copyMaterial = framedArtwork(rightEasel, texture, width, height).material;
    renderer.shadowMap.needsUpdate = true;
    navigation.setPaintingCenterY(framing.centerY);
    paintingTextureCache.trim(art.image);
  } catch (error) {
    console.error('Ошибка подготовки 3D-полотна:', art.id, error);
    showToast('Не удалось подготовить полотно для реставрации');
    return;
  }
  // Color correction is available immediately; aging/saved brush layers can
  // take longer to reconstruct without holding the actual painting hostage.
  try { restorationFeedback.updateUI(); }
  catch (error) { console.error('Ошибка управления цветом картины:', art.id, error); }
  try {
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
    (directRoot || document).querySelectorAll('.art-item').forEach((item, i) => {
      item.classList.toggle('active', i === selected);
      item.setAttribute('aria-pressed', String(i === selected));
    });
    (directRoot || document).querySelectorAll('.art-item')[selected]?.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
    collectionUI.setActive(art.id);
    playerProgress.setSelected(art.id);
    $('collection-footer').classList.toggle('active', selected >= featuredPaintings.length);
    navigation.renderLabels();
    if (restorationInput.currentTool()) {
      if (embedded) focusLairArtwork('copy');
      else navigation.focusOn('copy');
    }
  } catch (error) {
    console.error('Ошибка интерфейса выбранной картины:', art.id, error);
  }
  try {
    const surface = await restorationSessions.get(art, width, height);
    if (request !== paintingRequest) return;
    activeSurface = surface;
    surface.mount(rightEasel.artwork);
    activeSurface.setUVPointer(null);
    restorationInput.setSurface(activeSurface);
    restorationSessions.trim(art.id);
    restorationFeedback.updateRestorationStatus();
  } catch (error) {
    if (request !== paintingRequest) return;
    console.error('Ошибка слоя реставрации:', art.id, error);
    showToast('Не удалось восстановить слой повреждений картины');
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
  if (embedded) {
    // Texture restoration, exhibition and camera-local animation continue.
    // The parent always renders their geometry with its freely orbiting camera.
    navigation.animate(now);
    exhibition.updateViewedArtwork(now);
    activeSurface?.update(now * .001);
    requestAnimationFrame(animate);
    return;
  }
  if (window.parent !== window && rendererHost?.current() !== 'restoration') {
    requestAnimationFrame(animate);
    return;
  }
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

// The source controls remain available while artwork loads. The Lair keeps its
// initial veil until the visible gallery previews have all been prepared.
if (embedded) {
  navigation.resize();
  requestAnimationFrame(animate);
  notifyLair('ready');
}

async function init() {
  try {
    // Start restoring the real artwork and gouache finishes independently.
    const materialsReady = woodStyle.initialize().catch(error => {
      console.warn('Не удалось загрузить материалы ателье:', error);
    });
    // Load the selected painting first, then prepare the thirty visible gallery
    // thumbnails while the Lair's initial scene veil is still displayed.
    await showPainting(playerProgress.getSelectedIndex());
    if (embedded) {
      const galleryReady = await exhibition.refresh({ onProgress: ({ loaded, total }) =>
        notifyLair('initial-gallery-progress', { loaded, total }) });
      if (!galleryReady) throw new Error('Не удалось подготовить настенную галерею');
      notifyLair('initial-gallery-ready');
    } else {
      void exhibition.refresh();
      await materialsReady;
      navigation.resize();
      requestAnimationFrame(animate);
      setTimeout(() => $('loading').classList.add('hide'), 420);
    }
  } catch (error) {
    console.error('Ошибка загрузки репродукций:', error);
    if (!embedded) $('loading').querySelector('small').textContent = 'НЕ УДАЛОСЬ ЗАГРУЗИТЬ КАРТИНЫ';
    notifyLair('error',{message:error?.message || 'Не удалось загрузить картину'});
  }
}
// The source Three.js meshes are already attached to the Lair scene here;
// artwork textures continue loading asynchronously in this same application.
if (embedded) notifyLair('models-ready');
init();
