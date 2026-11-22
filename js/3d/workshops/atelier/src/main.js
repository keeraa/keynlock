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
import { getWorkshopHost, publishWorkshopApi } from '../../../core/host/workshop-host.js';
import { t, translator } from './i18n.js';
// The embedding entry mounts the interface before starting the workshop.
// A standalone visit supplies its own renderer and stylesheet.
const lair = getWorkshopHost();
const directRoot = lair?.atelier.root || null;
if (!directRoot) void import('./style.css');
// The standalone page translates itself; in the Lair the embedding has already
// translated the Atelier's markup.
if (!directRoot) {
  document.documentElement.lang = translator.language;
  translator.translateTree(document);
}
const $ = (id) => {
  if (!directRoot) return document.getElementById(id);
  const selector = `#${CSS.escape(id)}`;
  return directRoot.querySelector(selector) || lair.atelier.feedback?.querySelector(selector);
};
const rendererHost = directRoot ? lair.renderer : null;
const embedded = Boolean(rendererHost);
let inRoomActive = false;
const isRestorationActive = () => !embedded || inRoomActive;
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
  button.setAttribute('aria-label', t('Выбрать картину: {title}', { title: art.title }));
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
rendererHost?.registerWorldScene('atelier', {scene, camera});
const renderer = embedded
  ? rendererHost.createRenderer('atelier', document.createElement('canvas'))
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
const galleryWall = embedded && rendererHost.getUnifiedScene()?.getObjectByName('atelier-side-wall');
const galleryWallCenter = galleryWall && scene.worldToLocal(galleryWall.getWorldPosition(new THREE.Vector3()));
const wallZ = galleryWallCenter ? galleryWallCenter.z : -4.6;
const { dust, makeEasel, wallpaperMaterial, floorWoodMaterials } = createWorkshopRoom({
  THREE, scene, mats, includeWallTrim: !embedded, includeShelf: !embedded, wallZ, floorY: embedded ? .0385 : -.0285,
});
if (embedded) {
  // The standalone Atelier's angled sun is useful for its own room, but in
  // the shared Lair its shadow map throws giant diagonal stripes across the
  // salon. The Lair's overhead light supplies short contact shadows instead.
  scene.traverse(object => {
    if (object.isDirectionalLight) object.castShadow = false;
  });
  // The shared room supplies the Atelier's floor and wall surfaces.
  for (const object of scene.children) {
    if (object.name.startsWith('atelier-original-floor-')) object.visible = false;
    if (object.name === 'atelier-original-wallpaper') object.visible = false;
  }
}
const textureLoader = new THREE.TextureLoader();
const woodStyle = createWoodStyle({ THREE, renderer, loader: textureLoader, mats, wallpaperMaterial,
  floorWoodMaterials, variants: woodVariants });
const wallGallery = createWallGallery({
  THREE, scene, camera, renderer, frameWood: mats.frameWood, wallZ: galleryWall ? wallZ : undefined,
  wallLayout: galleryWall ? { width: galleryWall.geometry.parameters.width - 2, centerX: galleryWallCenter.x } : undefined,
  pointerElement: embedded ? lair?.interactionElement : renderer.domElement,
  onLayout: (layout) => navigation.updateWallLayout(layout),
});
const easelX = 1.28;
const leftEasel = makeEasel(-easelX, .045);
const rightEasel = makeEasel(easelX, -.045);
if (embedded) {
  leftEasel.root.name = 'restoration-left-easel';
  rightEasel.root.name = 'restoration-right-easel';
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
  lair?.atelier.focusArtwork?.({
    side, position: worldPosition.toArray(), target: worldTarget.toArray(),
    fov: camera.fov,
  });
}
function leaveLairArtworkFocus() {
  navigation.leaveFocus();
  lair?.atelier.focusEasels?.();
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
      showToast(t('Браузер не сохранил реставрацию — хранилище недоступно'));
    }
  },
});
const restorationSessions = createRestorationSessions({ THREE, store: restorationStore });
let exhibition;
const collectionUI = createPaintingCollectionUI({
  paintings, $, root: directRoot || document,
  onOpenChange: open => directRoot?.classList.toggle('collection-expanded', open),
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
let displayedPaintingRequest = 0;
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

async function flushAtelier() {
  restorationInput.finishStroke();
  flushSurfaceSave();
  await restorationStore.flush();
}

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
  stage: embedded ? lair?.interactionElement : stage,
  leftEasel, rightEasel, navigation,
  // The Lair canvas owns camera movement and restoration brush input. The
  // source iframe is only a retained model/state controller, never a viewport.
  inputElement: embedded ? lair?.interactionElement : renderer.domElement,
  interactionCamera: embedded ? lair?.camera : camera,
  setStrokeInputBlocked: lair?.atelier.setStrokeInputBlocked,
  onPaintingFocus: embedded ? focusLairArtwork : (side) => navigation.focusOn(side),
  uiRoot: directRoot || document,
  isInteractive: isRestorationActive,
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
      lair?.atelier.hoverGalleryArtwork?.(
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
  bindKeyboard: !embedded,
  isEnabled: () => isRestorationActive()
    && (!embedded || !lair?.atelier.galleryActive),
  focusEasel: embedded ? focusLairArtwork : side => navigation.focusOn(side),
  leaveEaselFocus: embedded ? leaveLairArtworkFocus : () => navigation.leaveFocus() });
if (embedded) publishWorkshopApi('atelier', { input: { handleKey: workshopUI.handleKey },
  // Wood, metal, floor and wall finishes, never the paintings: the Lair applies
  // its own gouache settings to these.
  look: { paintedMaterials: () => [...Object.values(mats), ...floorWoodMaterials, wallpaperMaterial].filter(Boolean),
    // Every painting frame, on the easels and on the wall, uses this material.
    frameMaterial: mats.frameWood } });
exhibition = createWallExhibitionController({ paintings, playerProgress, wallGallery, collectionUI,
  getNavigation: () => navigation, getWorkshopUI: () => workshopUI, showToast, $ });
exhibition.bind();
// The Lair's single renderer follows the original gallery camera. These
// controls retain the Atelier's 30-frame layout, movements and artwork focus.
if (directRoot) publishWorkshopApi('atelier', { gallery: {
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
  getState: () => ({
    active: navigation.isWallGallery(),
    mode: navigation.mode(),
    collectionOpen: collectionUI.isOpen(),
    displaySwitchLabel: exhibition.displaySwitchLabel(),
    canShuffle: exhibition.canShuffle(),
  }),
  openCollection: () => collectionUI.open('wall'),
  closeCollection: () => { if (collectionUI.isOpen()) collectionUI.close(); },
  switchDisplay: exhibition.switchDisplay,
  shuffle: exhibition.shuffle,
} });
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
if (embedded) publishWorkshopApi('atelier', { bridge: {
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
} });

async function showPainting(index) {
  restorationInput.hide();
  const next = (index + paintings.length) % paintings.length;
  const art = paintings[next];
  const request = ++paintingRequest;
  if (next !== selected || !activeTexture) {
    $('art-title').textContent = t('Загружаем репродукцию…');
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
      ? t('Загрузка затянулась. Пока покажем картину из локальной коллекции.')
      : t('Изображение недоступно. Выберите другую картину.'));
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
      if (embedded) lair?.atelier.focusEasels?.();
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
    showToast(t('Не удалось подготовить полотно для реставрации'));
    return;
  }
  // A pending image selection must not invalidate the surface of the painting still on display.
  displayedPaintingRequest = request;
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
    if (request !== displayedPaintingRequest) return;
    activeSurface = surface;
    surface.mount(rightEasel.artwork);
    activeSurface.setUVPointer(null);
    restorationInput.setSurface(activeSurface);
    restorationSessions.trim(art.id);
    restorationFeedback.updateRestorationStatus();
  } catch (error) {
    if (request !== displayedPaintingRequest) return;
    console.error('Ошибка слоя реставрации:', art.id, error);
    showToast(t('Не удалось восстановить слой повреждений картины'));
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
function updateAtelier(now) {
  const cameraMoved = navigation.animate(now);
  exhibition.updateViewedArtwork(now);
  activeSurface?.update(now * .001);
  return cameraMoved;
}

function animate(now) {
  const dt = Math.min(0.05, (now - previousTime) / 1000);
  previousTime = now;
  if (embedded) {
    // Texture restoration, exhibition and camera-local animation continue.
    // The parent always renders their geometry with its freely orbiting camera.
    updateAtelier(now);
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
  if (directRoot) {
    rendererHost.registerWorldWorkshop('atelier', {
      enter() { inRoomActive = true; },
      exit() {
        inRoomActive = false;
        restorationInput.finishStroke();
        restorationInput.hide();
        restorationInput.clearUV();
        void flushAtelier();
      },
      update: updateAtelier,
    });
  } else requestAnimationFrame(animate);
  lair.atelier.reportStatus?.({ ready: true });
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
        lair.atelier.reportStatus?.({ galleryProgress: { loaded, total } }) });
      if (!galleryReady) throw new Error(t('Не удалось подготовить настенную галерею'));
      lair.atelier.reportStatus?.({ galleryReady: true });
    } else {
      void exhibition.refresh();
      await materialsReady;
      navigation.resize();
      requestAnimationFrame(animate);
      setTimeout(() => $('loading').classList.add('hide'), 420);
    }
  } catch (error) {
    console.error('Ошибка загрузки репродукций:', error);
    if (!embedded) $('loading').querySelector('small').textContent = t('НЕ УДАЛОСЬ ЗАГРУЗИТЬ КАРТИНЫ');
    lair?.atelier.reportStatus?.({ error: error?.message || t('Не удалось загрузить картину') });
  }
}
// The source Three.js meshes are already attached to the Lair scene here;
// artwork textures continue loading asynchronously in this same application.
if (embedded) lair.atelier.reportStatus?.({ modelsReady: true });
init();
