import { t, applyTranslations, LANGUAGES, getLanguage, setLanguage } from './i18n.js';
// Static texts of the page follow the chosen language before anything shows.
applyTranslations(document);
import { TOTAL_KEYS, getProgress } from './rules.js?v=key-ring';
import { createWorld } from './world.js?v=key-catalog';
import { installKeyAssetProvider } from './key-factory.js?v=key-ring';
import { createArchiveHud } from './archive-hud.js?v=hud-polish';
import { openArchiveSave, loadVisualSettings, clearArchiveState } from './archive-save-state-with-route.js?v=key-ring';
import { createVisualPanel } from './visual-panel.js?v=key-ring';
import externalKeyProvider from './key-provider-entry.js?v=wax-and-bundles';
import { createFallbackWorld } from './fallback-world.js?v=key-catalog';
import { createPlayerMovement } from './player-movement.js?v=ledger-candle';
import { createPerformanceHud } from './performance-hud.js';
import { logicalKey } from './controls.js';
import { edgeLookRate } from './mouse-look.js';
import { createKeyIndex } from './key-index.js?v=key-ring';
import { createArchiveTargeting } from './archive-surface-aim.js?v=key-ring';
import { createArchivePrompts } from './archive-interaction-prompts.js?v=key-catalog';
import { createArchiveActions } from './archive-actions.js?v=key-catalog';
import { FIRST_ROUTE_KEY_ID, createFirstRouteGuide } from './archive-first-route-guide.js?v=key-ring';
import { createBathProgress } from './archive-bath-progress.js?v=cleaning-cues';
import { createArchiveKeyCatalog } from './archive-key-catalog.js?v=catalog-pages';
import { createArchiveStatistics, createStatisticsPanel } from './archive-statistics.js?v=processed-count';
import { createArchiveMusic } from './archive-music.js?v=music-resume-seek';
import { createArchiveAudio } from './archive-audio.js?v=key-shine';
import { floorSurfaceY, RUG_TOP } from './floor-contact.js';

const $ = id => document.getElementById(id);
if (externalKeyProvider) installKeyAssetProvider(externalKeyProvider);
const canvas = $('world');
const storage = (() => {
  try { return window.localStorage; } catch { return null; }
})();
const visualSettings = loadVisualSettings(storage);
const archiveSave = openArchiveSave(storage);
const { state } = archiveSave;
const statistics = createArchiveStatistics(state);
const statisticsPanel = createStatisticsPanel(document, statistics);
const keyIndex = createKeyIndex(state.keys);
let world;
try {
  world = createWorld(canvas, state, visualSettings, keyIndex);
} catch (error) {
  console.warn('WebGL недоступен. Используется графический резервный режим.', error.message);
  world = createFallbackWorld(canvas, state, visualSettings, keyIndex);
}
const camera = world.camera;
const catalog = createArchiveKeyCatalog(document, world, canvas, () => play({ lockMouse: false }));
const movement = createPlayerMovement(camera, world.bounds);
const clamp = (number, a, b) => Math.max(a, Math.min(b, number));
const hud = createArchiveHud(document, world, state, keyIndex);
const bathProgress = createBathProgress(document, world, keyIndex, state);
const routeGuide = createFirstRouteGuide(document, state, keyIndex, world);
const performanceHud = createPerformanceHud(document, world);
const visualPanel = createVisualPanel(document, world, storage, visualSettings);

let mode = 'intro';
let lastSmeltCheck = 0;
let yaw = 0;
let pitch = state.firstRoute && keyIndex.get(FIRST_ROUTE_KEY_ID)?.status === 'floor' ? -.30 : -.17;
let sensitivity = 14;
let mouseWasLocked = false;
let requestedMouseRelease = false;
let nativePauseAt = -Infinity;
let lockRequestPending = false;
let lockUnavailable = false;
let lastPointer = null;
let edgeLook = { x: 0, y: 0, until: 0 };
let hovered = null;
let lastHoverKey = '';
let toastTimeout = 0;
let announceRecovery = archiveSave.recovered;
const saveMessages = {
  unavailable: t('save.unavailable'),
  damaged: t('save.damaged'),
  conflict: t('save.conflict'),
  'write-error': t('save.writeError'),
  'backup-error': t('save.backupError'),
};
const heldMovement = new Set();
const MENU_FRAME_INTERVAL = 1000 / 30;
let lastRender = -Infinity;
let lastTick = performance.now();
const audio = createArchiveAudio(window);
const music = createArchiveMusic(window, storage);
const { tone } = audio;
const { targetInView, clearAim } = createArchiveTargeting({ camera, world, state, keyIndex });
const { interact, drop, updateWax, updateSmelting, isMelting } = createArchiveActions({
  state, keyIndex, world, camera, targetInView,
  getYaw: () => yaw, isPlaying: () => mode === 'play',
  save, updateHud, tone, toast, showVictory, statistics, openCatalog,
  invalidateHover: () => { lastHoverKey = '!'; },
});

function save({ initial = false } = {}) {
  if (!initial) {
    announceRecovery = false;
    statistics.checkpoint();
  }
  if (state.firstRoute && keyIndex.get(FIRST_ROUTE_KEY_ID)?.status === 'sorted') state.firstRoute = false;
  keyIndex.rebuild();
  const result = archiveSave.save();
  const status = $('save-status');
  const message = saveMessages[result] || (announceRecovery ? t('save.recovered') : '');
  if (status.textContent !== message) status.textContent = message;
  status.hidden = !message;
  $('save-intro').hidden = result !== 'saved';
  $('save-pause').hidden = result !== 'saved';
}

function toast(message, error = false) {
  const element = $('toast');
  element.textContent = message;
  element.style.color = error ? '#e9a7a0' : '#f5d69b';
  element.classList.add('visible');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => element.classList.remove('visible'), 2100);
}

const promptFor = createArchivePrompts(state, keyIndex, isMelting);
const litCabinets = world.cabinets.map(cabinet => cabinet.completion.isComplete());
const startedRows = world.cabinets.map(cabinet => cabinet.completion.rowsStarted());
const soundForward = new world.THREE.Vector3();
const soundUp = new world.THREE.Vector3();

function playAt(kind, position) {
  const distance = Math.hypot(camera.position.x - position.x, camera.position.z - position.z);
  const level = Math.max(0, 1 - Math.max(0, distance - 2) / 8);
  tone(kind, level, kind === 'dropRug' || kind === 'dropWood' ? position : null);
}

function updateHud() { hud.update(); }

function setHovered(target) {
  const identity = target ? `${target.kind}-${target.id ?? target.stationId ?? target.type}` +
    (target.kind === 'cabinet' ? `:${target.slot ?? '-'}:${target.assisted ? 'assisted' : 'direct'}:${Boolean(target.full)}` :
      target.kind === 'candle' ? `:${target.lit}` : target.kind === 'bath' ? `:${target.keyId ?? '-'}` :
      target.kind === 'forge' ? `:${state.metal}:${state.bundles}` : '') : '';
  if (identity === lastHoverKey) return;
  hovered = target;
  lastHoverKey = identity;
  world.highlight(target);
  const prompt = $('interaction-prompt');
  const content = promptFor(target);
  prompt.innerHTML = content;
  prompt.classList.toggle('is-hidden', !content);
  $('crosshair').classList.toggle('target', Boolean(content));
}

function selectSlot(slot) {
  if (slot < 0 || slot >= state.held.length) return;
  state.selected = slot;
  updateHud();
  save();
  lastHoverKey = '!';
}

function turn(dx, dy) {
  const speed = sensitivity * .000145;
  yaw -= dx * speed;
  pitch = clamp(pitch - dy * speed, -1.31, 1.27);
}

function setMode(next) {
  mode = next;
  if (statistics.setActive(next === 'play' && !document.hidden)) archiveSave.save();
  audio.setPlaying(mode === 'play');
  document.body.classList.toggle('playing', next === 'play');
  $('intro').classList.toggle('is-hidden', next !== 'intro');
  $('pause').classList.toggle('is-hidden', next !== 'pause');
  $('visual').classList.toggle('is-hidden', next !== 'visual');
  $('statistics').classList.toggle('is-hidden', next !== 'statistics');
  $('victory').classList.toggle('is-hidden', next !== 'victory');
  $('hud').classList.toggle('is-hidden', next === 'intro');
  $('fps-panel').hidden = next === 'intro' || next === 'ledger';
  $('interaction-prompt').classList.toggle('is-hidden', next !== 'play' || !hovered);
  heldMovement.clear();
  lastPointer = null;
  edgeLook = { x: 0, y: 0, until: 0 };
  clearAim();
  setHovered(null);
  if (next === 'pause') $('resume-btn').focus({ preventScroll: true });
  if (next === 'statistics') {
    statisticsPanel.render();
    $('statistics-back').focus({ preventScroll: true });
  }
}

function onMouseLockUnavailable() {
  lockRequestPending = false;
  lockUnavailable = true;
}

function requestMouseLock() {
  if (mode !== 'play' || document.pointerLockElement === canvas || lockRequestPending || lockUnavailable) return;
  if (!canvas.requestPointerLock) {
    onMouseLockUnavailable();
    return;
  }
  lockRequestPending = true;
  try {
    const promise = canvas.requestPointerLock();
    if (promise?.then) {
      promise.then(() => { lockRequestPending = false; }, onMouseLockUnavailable);
    } else {
      // Older implementations use only pointerlockchange / pointerlockerror events.
      setTimeout(() => {
        if (lockRequestPending && document.pointerLockElement !== canvas) onMouseLockUnavailable();
      }, 650);
    }
  } catch { onMouseLockUnavailable(); }
}

function play({ lockMouse = true } = {}) {
  setMode('play');
  audio.unlock();
  music.start();
  lockUnavailable = false;
  if (lockMouse) requestMouseLock();
  if (getProgress(state).processed === TOTAL_KEYS) toast(t('toast.archiveDone'));
}

function releaseMouseLock() {
  const locked = document.pointerLockElement === canvas;
  if (!locked && !mouseWasLocked) return;
  requestedMouseRelease = true;
  if (locked) document.exitPointerLock();
}

function openCatalog() {
  if (mode !== 'play') return;
  setMode('ledger');
  releaseMouseLock();
  catalog.open();
}

function pause() {
  if (mode !== 'play') return;
  setMode('pause');
  releaseMouseLock();
}

function openVisual() {
  if (mode !== 'play' && mode !== 'pause') return;
  setMode('visual');
  releaseMouseLock();
}

function showVictory() {
  if (getProgress(state).processed !== TOTAL_KEYS || mode !== 'play') return;
  setMode('victory');
  releaseMouseLock();
}

function resetGame() {
  if (!window.confirm(t('confirm.reset'))) return;
  try {
    clearArchiveState(storage);
  } catch {
    toast(t('toast.resetFailed'), true);
    return;
  }
  window.location.reload();
}

$('start-btn').addEventListener('click', play);
$('start-btn').disabled = false;
$('resume-btn').addEventListener('click', play);
$('victory-explore').addEventListener('click', play);
$('visual-open').addEventListener('click', openVisual);
let statisticsReturn = 'pause';
function openStatistics() {
  statisticsReturn = mode;
  setMode('statistics');
}
$('statistics-open').addEventListener('click', openStatistics);
$('victory-statistics').addEventListener('click', openStatistics);
$('statistics-back').addEventListener('click', () => setMode(statisticsReturn));
document.addEventListener('visibilitychange', () => {
  if (statistics.setActive(mode === 'play' && !document.hidden)) archiveSave.save();
});
window.addEventListener('pagehide', () => {
  if (statistics.setActive(false)) archiveSave.save();
});
window.addEventListener('pageshow', () => statistics.setActive(mode === 'play' && !document.hidden));
$('visual-resume').addEventListener('click', play);
$('visual-back').addEventListener('click', () => setMode('pause'));
visualPanel.bind();
$('reset-btn').addEventListener('click', resetGame);
$('victory-reset').addEventListener('click', resetGame);
$('sensitivity').addEventListener('input', event => { sensitivity = Number(event.target.value); });
// Language: the page reloads in the chosen language (progress is already saved).
const languageSelect = $('language');
if (languageSelect) {
  for (const [code, name] of Object.entries(LANGUAGES)) languageSelect.add(new Option(name, code, false, code === getLanguage()));
  languageSelect.addEventListener('change', event => { save(); setLanguage(event.target.value); });
}
$('sound').checked = !audio.isMuted();
$('sound').addEventListener('change', event => { audio.setMuted(!event.target.checked); });

const musicVolume = $('music-volume');
const musicVolumeValue = $('music-volume-value');
if (musicVolume && musicVolumeValue) {
  musicVolume.value = music.getVolume();
  musicVolumeValue.value = `${music.getVolume()}%`;
  musicVolume.addEventListener('input', () => {
    music.setVolume(musicVolume.value);
    musicVolumeValue.value = `${music.getVolume()}%`;
  });
}

document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement === canvas) {
    lockRequestPending = false;
    lockUnavailable = false;
    mouseWasLocked = true;
    lastPointer = null;
    edgeLook = { x: 0, y: 0, until: 0 };
    if (mode !== 'play') releaseMouseLock();
    return;
  }
  const unlockedByBrowser = mouseWasLocked && !requestedMouseRelease;
  mouseWasLocked = false;
  requestedMouseRelease = false;
  lockRequestPending = false;
  if (unlockedByBrowser && mode === 'play') {
    nativePauseAt = performance.now();
    pause();
  }
});
document.addEventListener('pointerlockerror', onMouseLockUnavailable);

document.addEventListener('mousemove', event => {
  if (mode !== 'play') return;
  if ($('fps-panel').contains(event.target)) {
    lastPointer = null;
    edgeLook.until = 0;
    return;
  }
  if (document.pointerLockElement === canvas) {
    turn(event.movementX, event.movementY);
  } else {
    if (lastPointer) turn(event.clientX - lastPointer.x, event.clientY - lastPointer.y);
    lastPointer = { x: event.clientX, y: event.clientY };
    const x = edgeLookRate(event.clientX, window.innerWidth);
    const y = edgeLookRate(event.clientY, window.innerHeight);
    edgeLook = { x, y, until: performance.now() + (x || y ? 1100 : 0) };
  }
});
document.addEventListener('mouseleave', () => { lastPointer = null; });

canvas.addEventListener('pointerdown', event => {
  if (mode !== 'play' || event.button !== 0) return;
  // A direct click is another browser user gesture that can grant Pointer Lock.
  if (document.pointerLockElement !== canvas) requestMouseLock();
  interact();
});
canvas.addEventListener('contextmenu', event => event.preventDefault());

window.addEventListener('keydown', event => {
  if (mode === 'ledger') return;
  const key = logicalKey(event);
  if ((key === 'enter' || key === ' ') && event.target instanceof Element && $('fps-panel').contains(event.target)) return;
  if (key === 'escape') {
    if (event.repeat) return;
    if (mode === 'statistics') setMode(statisticsReturn);
    else if (mode === 'visual') setMode('pause');
    else if (mode === 'play') pause();
    else if (mode === 'pause' && performance.now() - nativePauseAt > 100) {
      // One browser Escape can both release pointer lock and reach this handler.
      // Keyboard resume uses free mouse look until the next click can relock.
      play({ lockMouse: false });
    }
    return;
  }
  if (mode === 'visual' && key === 'v') { setMode('pause'); return; }
  if (mode !== 'play') return;
  if (['w', 'a', 's', 'd', ' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) event.preventDefault();
  if (['w', 'a', 's', 'd', 'shift', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) heldMovement.add(key);
  if (event.repeat) return;
  if (key === 'e' || key === 'enter') interact({ buyRingWithHeldKey: true });
  if (key === 'v') { openVisual(); return; }
  if (key === 'r') drop();
  if (key === ' ' || key === 'p') pause();
  if ('1234'.includes(key)) selectSlot(Number(key) - 1);
  if (key === 'h') {
    const footer = document.querySelector('.hud-footer');
    footer.style.opacity = footer.style.opacity === '0' ? '' : '0';
  }
});
window.addEventListener('keyup', event => {
  const key = logicalKey(event);
  if (key === 'escape') nativePauseAt = -Infinity;
  heldMovement.delete(key);
});
window.addEventListener('blur', () => {
  heldMovement.clear();
  if (mode === 'play') pause();
});
canvas.addEventListener('wheel', event => {
  if (mode !== 'play' || !state.held.length) return;
  event.preventDefault();
  const delta = event.deltaY > 0 ? 1 : -1;
  selectSlot((state.selected + delta + state.held.length) % state.held.length);
}, { passive: false });

function tick(now) {
  requestAnimationFrame(tick);
  if (mode !== 'play' && now - lastRender < MENU_FRAME_INTERVAL - 1) return;
  lastRender = now;
  const cpuStart = performance.now();
  const delta = Math.min((now - lastTick) / 1000, .04);
  lastTick = now;
  let moving = false;
  let distance = 0;
  if (mode === 'play') {
    const { x, z } = camera.position;
    moving = movement.move(heldMovement, yaw, delta);
    distance = Math.hypot(camera.position.x - x, camera.position.z - z);
    audio.walk(distance, floorSurfaceY(camera.position.x, camera.position.z) === RUG_TOP, heldMovement.has('shift'));
  }
  hud.walk(distance, delta);
  if (mode === 'play' && document.pointerLockElement !== canvas && now < edgeLook.until) {
    yaw -= edgeLook.x * 1.6 * delta;
    pitch = clamp(pitch - edgeLook.y * 1.3 * delta, -1.31, 1.27);
  }
  camera.rotation.set(pitch, yaw, 0, 'YXZ');
  const target = mode === 'play' ? targetInView() : null;
  updateWax(now, target);
  if (statistics.shouldCheckpoint()) {
    statistics.checkpoint();
    archiveSave.save();
  }
  if (now - lastSmeltCheck > 250) { lastSmeltCheck = now; updateSmelting(); }
  audio.setWaxMelting(isMelting());
  if (mode === 'play') setHovered(target);
  if (mode === 'play' && hovered?.kind === 'bath') {
    const currentPrompt = promptFor(hovered);
    if ($('interaction-prompt').innerHTML !== currentPrompt) $('interaction-prompt').innerHTML = currentPrompt;
  }
  bathProgress.update(mode === 'play', playAt);
  routeGuide.update(mode === 'play');
  world.update(now, moving, mode === 'play', playAt);
  if (audio.hasSpatialVoices()) {
    soundForward.set(0, 0, -1).applyQuaternion(camera.quaternion);
    soundUp.set(0, 1, 0).applyQuaternion(camera.quaternion);
    audio.setListener(camera.position, soundForward, soundUp);
  }
  for (const cabinet of world.cabinets) {
    const lit = cabinet.completion.isComplete();
    // The row chime starts together with the shimmer, not after it settles.
    const started = cabinet.completion.rowsStarted();
    if (started > startedRows[cabinet.type]) playAt('row', cabinet.group.position);
    if (lit && !litCabinets[cabinet.type]) playAt('finish', cabinet.group.position);
    startedRows[cabinet.type] = started;
    litCabinets[cabinet.type] = lit;
  }
  const rendered = world.renderer.render(world.scene, camera) !== false;
  performanceHud.sample(now, performance.now() - cpuStart, rendered);
}

updateHud();
save({ initial: true });
requestAnimationFrame(tick);
