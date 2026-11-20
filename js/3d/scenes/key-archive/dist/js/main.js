import { t, applyTranslations, LANGUAGES, getLanguage, setLanguage } from './i18n.js';
// Static texts of the page follow the chosen language before anything shows.
applyTranslations(document);
import { TOTAL_KEYS, getProgress, smeltingState } from './rules.js';
import { STATIONS, bathId } from './station-layout.js';
import { createWorld } from './world.js';
import { installKeyAssetProvider } from './key-factory.js';
import { createArchiveHud } from './archive-hud.js';
import { openArchiveSave, loadVisualSettings, clearArchiveState } from './archive-save-state-with-route.js';
import { createVisualPanel } from './visual-panel.js';
import externalKeyProvider from './key-provider-entry.js';
import { createFallbackWorld } from './fallback-world.js';
import { createPlayerMovement } from './player-movement.js';
import { createPerformanceHud } from './performance-hud.js';
import { createInventoryWheel, logicalKey } from './controls.js';
import { edgeLookRate } from './mouse-look.js';
import { createKeyIndex } from './key-index.js';
import { createArchiveTargeting } from './archive-surface-aim.js';
import { createArchivePrompts } from './archive-interaction-prompts.js';
import { createArchiveActions } from './archive-actions.js';
import { FIRST_ROUTE_KEY_ID, createFirstRouteGuide } from './archive-first-route-guide.js';
import { createBathProgress } from './archive-bath-progress.js';
import { createArchiveKeyCatalog } from './archive-key-catalog.js';
import { createArchiveStatistics, createStatisticsPanel } from './archive-statistics.js';
import { createArchiveMusic } from './archive-music.js';
import { createArchiveAudio } from './archive-audio.js';
import { floorSurfaceY, RUG_TOP } from './floor-contact.js';
import { createStationClock } from './archive-station-clock.js';

const $ = id => document.getElementById(id);
if (externalKeyProvider) installKeyAssetProvider(externalKeyProvider);
const canvas = $('world');
const storage = (() => {
  try { return window.localStorage; } catch { return null; }
})();
const visualSettings = loadVisualSettings(storage);
const archiveSave = openArchiveSave(storage);
const { state } = archiveSave;
const stationClock = createStationClock(state.stationTime);
const stationNow = stationClock.now;
const sceneClock = createStationClock(performance.now());
const sceneNow = sceneClock.now;
const statistics = createArchiveStatistics(state);
const statisticsPanel = createStatisticsPanel(document, statistics);
const keyIndex = createKeyIndex(state.keys);
let world;
try {
  world = createWorld(canvas, state, visualSettings, keyIndex, stationNow, sceneNow);
} catch (error) {
  console.warn('WebGL недоступен. Используется графический резервный режим.', error.message);
  world = createFallbackWorld(canvas, state, visualSettings, keyIndex, stationNow, sceneNow);
}
const camera = world.camera;
const movement = createPlayerMovement(camera, world.bounds);
const clamp = (number, a, b) => Math.max(a, Math.min(b, number));
const hud = createArchiveHud(document, world, state, keyIndex);
const catalog = createArchiveKeyCatalog(document, world, canvas, hud.keyThumbnail, () => play({ lockMouse: false }));
const bathProgress = createBathProgress(document, world, keyIndex, state, stationNow);
const routeGuide = createFirstRouteGuide(document, state, keyIndex, world);
const performanceHud = createPerformanceHud(document, world);
const visualPanel = createVisualPanel(document, world, storage, visualSettings);

let mode = 'intro';
const isPlaying = () => mode === 'play' && !document.hidden;
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
  newer: t('save.newer'),
  conflict: t('save.conflict'),
  'write-error': t('save.writeError'),
  'backup-error': t('save.backupError'),
};
const heldMovement = new Set();
const COVERED_SCENE_MODES = new Set(['intro', 'ledger']);
const COVERED_FRAME_INTERVAL = 1000 / 30;
let lastRender = -Infinity;
let lastTick = performance.now();
const audio = createArchiveAudio(window);
const music = createArchiveMusic(window, storage);
const { tone } = audio;
const { targetInView, clearAim } = createArchiveTargeting({ camera, world, state, keyIndex });
const { interact, drop, updateWax, updateSmelting, isMelting } = createArchiveActions({
  state, keyIndex, world, camera, targetInView,
  getYaw: () => yaw, isPlaying, stationNow,
  save, updateHud, tone, toast, showVictory, statistics, openCatalog,
  invalidateHover: () => { lastHoverKey = '!'; },
});

function saveSnapshot() {
  state.stationTime = stationNow();
  return archiveSave.save();
}

function syncActivity(active = isPlaying()) {
  stationClock.setActive(active);
  sceneClock.setActive(active);
  music.setPaused(!active);
  audio.setPlaying(active);
  if (statistics.setActive(active)) saveSnapshot();
}

function save({ initial = false } = {}) {
  if (!initial) {
    announceRecovery = false;
    statistics.checkpoint();
  }
  if (state.firstRoute && keyIndex.get(FIRST_ROUTE_KEY_ID)?.status === 'sorted') state.firstRoute = false;
  keyIndex.rebuild();
  const result = saveSnapshot();
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

const promptFor = createArchivePrompts(state, keyIndex, isMelting, stationNow);
const litCabinets = world.cabinets.map(cabinet => cabinet.completion.isComplete());
const startedRows = world.cabinets.map(cabinet => cabinet.completion.rowsStarted());
const soundForward = new world.THREE.Vector3();
const soundUp = new world.THREE.Vector3();

function playAt(kind, position) {
  const distance = Math.hypot(camera.position.x - position.x, camera.position.z - position.z);
  const level = Math.max(0, 1 - Math.max(0, distance - 2) / 8);
  tone(kind, level, kind === 'dropRug' || kind === 'dropWood' ? position : null);
}

// A bath finished a key. Nearby it is just the chime at the bath; from across
// the hall the chime stays audible and a toast says which bath to visit.
function announceBathReady(kind, position) {
  const distance = Math.hypot(camera.position.x - position.x, camera.position.z - position.z);
  const level = Math.max(0, 1 - Math.max(0, distance - 2) / 8);
  tone('ready', Math.max(.35, level));
  if (distance > 4) toast(t(`toast.bathReady.${kind}`));
}

// Statistics: the player stands by the workbench while a key there still
// soaks or smelts (checked twice a second; the bath index makes it cheap).
let workbenchBusyAt = -Infinity, workbenchBusy = false;
function waitingAtWorkbench(now, time) {
  const near = STATIONS.some(station => Math.abs(camera.position.x - station.x) < 3.6 &&
    Math.abs(camera.position.z - station.z) < 2.6);
  if (!near) return false;
  if (now - workbenchBusyAt >= 500) {
    workbenchBusyAt = now;
    workbenchBusy = Boolean(smeltingState(state, time)) || STATIONS.some(station => ['mud', 'rust'].some(kind =>
      keyIndex.bathKeys(bathId(station.id, kind)).some(key => key.bathUntil > time)));
  }
  return workbenchBusy;
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
  syncActivity();
  document.body.classList.toggle('playing', next === 'play');
  $('intro').classList.toggle('is-hidden', next !== 'intro');
  $('pause').classList.toggle('is-hidden', next !== 'pause');
  $('visual').classList.toggle('is-hidden', next !== 'visual');
  $('statistics').classList.toggle('is-hidden', next !== 'statistics');
  $('victory').classList.toggle('is-hidden', next !== 'victory');
  $('hud').classList.toggle('is-hidden', next === 'intro');
  $('fps-panel').hidden = COVERED_SCENE_MODES.has(next);
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
document.addEventListener('visibilitychange', () => syncActivity());
window.addEventListener('pagehide', () => syncActivity(false));
window.addEventListener('pageshow', () => syncActivity());
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

const musicSpatial = $('music-spatial');
musicSpatial.checked = music.getSpatial();
musicSpatial.addEventListener('change', () => music.setSpatial(musicSpatial.checked));

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
const inventoryWheelStep = createInventoryWheel();
canvas.addEventListener('wheel', event => {
  if (mode !== 'play' || state.held.length < 2) return;
  event.preventDefault();
  const step = inventoryWheelStep(event);
  if (step) selectSlot((state.selected + step + state.held.length) % state.held.length);
}, { passive: false });

function tick(now) {
  requestAnimationFrame(tick);
  if (COVERED_SCENE_MODES.has(mode) && now - lastRender < COVERED_FRAME_INTERVAL - 1) return;
  lastRender = now;
  const cpuStart = performance.now();
  const playing = isPlaying();
  const frameMs = now - lastTick;
  const delta = Math.min(frameMs / 1000, .04);
  lastTick = now;
  let moving = false;
  let distance = 0;
  if (playing) {
    const { x, z } = camera.position;
    moving = movement.move(heldMovement, yaw, delta);
    distance = Math.hypot(camera.position.x - x, camera.position.z - z);
    audio.walk(distance, floorSurfaceY(camera.position.x, camera.position.z) === RUG_TOP, heldMovement.has('shift'));
  }
  if (playing) hud.walk(distance, delta);
  if (playing && document.pointerLockElement !== canvas && now < edgeLook.until) {
    yaw -= edgeLook.x * 1.6 * delta;
    pitch = clamp(pitch - edgeLook.y * 1.3 * delta, -1.31, 1.27);
  }
  camera.rotation.set(pitch, yaw, 0, 'YXZ');
  const target = playing ? targetInView() : null;
  const time = stationNow();
  if (playing) statistics.frame(Math.min(frameMs, 250),
    { walked: distance, waitingAtStation: waitingAtWorkbench(now, time) });
  if (playing) updateWax(time, target);
  if (statistics.shouldCheckpoint()) {
    statistics.checkpoint();
    saveSnapshot();
  }
  if (playing && now - lastSmeltCheck > 250) { lastSmeltCheck = now; updateSmelting(time); }
  audio.setWaxMelting(playing && isMelting());
  if (playing) setHovered(target);
  if (playing && hovered?.kind === 'bath') {
    const currentPrompt = promptFor(hovered);
    if ($('interaction-prompt').innerHTML !== currentPrompt) $('interaction-prompt').innerHTML = currentPrompt;
  }
  bathProgress.update(playing, playAt, announceBathReady);
  routeGuide.update(playing);
  world.update(sceneNow(), moving, playing, playing ? playAt : null);
  const loweredTo = world.adaptQuality?.(now, frameMs, playing && document.visibilityState === 'visible');
  if (loweredTo) toast(t('toast.qualityLowered', { ratio: loweredTo }));
  if (audio.hasSpatialVoices() || music.getSpatial()) {
    soundForward.set(0, 0, -1).applyQuaternion(camera.quaternion);
    soundUp.set(0, 1, 0).applyQuaternion(camera.quaternion);
    audio.setListener(camera.position, soundForward, soundUp);
    music.setListener(camera.position, soundForward, soundUp);
  }
  for (const cabinet of world.cabinets) {
    const lit = cabinet.completion.isComplete();
    // The row chime starts together with the shimmer, not after it settles.
    const started = cabinet.completion.rowsStarted();
    if (started > startedRows[cabinet.type]) playAt('row', cabinet.group.position);
    if (lit && !litCabinets[cabinet.type]) playAt('finish', cabinet.group.position);
    for (let row = startedRows[cabinet.type]; row < started; row++) statistics.event('rowTimes');
    if (lit && !litCabinets[cabinet.type]) statistics.event('cabinetTimes');
    startedRows[cabinet.type] = started;
    litCabinets[cabinet.type] = lit;
  }
  const rendered = world.renderer.render(world.scene, camera) !== false;
  performanceHud.sample(now, performance.now() - cpuStart, rendered);
}

updateHud();
save({ initial: true });
requestAnimationFrame(tick);
