import { TOTAL_KEYS, STORAGE_KEY, getProgress } from './rules.js?v=24';
import { createWorld } from './world.js?v=55';
import { installKeyAssetProvider } from './key-factory.js?v=3';
import { createArchiveHud } from './archive-hud.js';
import { loadArchiveState, loadVisualSettings, saveArchiveState } from './archive-persistence.js?v=3';
import { createVisualPanel } from './visual-panel.js';
import externalKeyProvider from './key-provider-entry.js?v=4';
import { createFallbackWorld } from './fallback-world.js?v=41';
import { createPlayerMovement } from './player-movement.js?v=4';
import { createPerformanceHud } from './performance-hud.js';
import { logicalKey } from './controls.js';
import { edgeLookRate } from './mouse-look.js';
import { createKeyIndex } from './key-index.js';
import { createArchiveTargeting } from './archive-targeting.js?v=2';
import { createArchivePrompts } from './archive-interaction-prompts.js?v=2';
import { createArchiveActions } from './archive-actions.js?v=2';
import { createArchiveAudio } from './archive-audio.js';

const $ = id => document.getElementById(id);
if (externalKeyProvider) installKeyAssetProvider(externalKeyProvider);
const canvas = $('world');
const visualSettings = loadVisualSettings(localStorage);
const state = loadArchiveState(localStorage);
const keyIndex = createKeyIndex(state.keys);
let world;
try {
  world = createWorld(canvas, state, visualSettings);
} catch (error) {
  console.warn('WebGL недоступен. Используется графический резервный режим.', error.message);
  world = createFallbackWorld(canvas, state, visualSettings);
}
const camera = world.camera;
const movement = createPlayerMovement(camera, world.bounds);
const clamp = (number, a, b) => Math.max(a, Math.min(b, number));
const hud = createArchiveHud(document, world, state, keyIndex);
const performanceHud = createPerformanceHud(document, world);
const visualPanel = createVisualPanel(document, world, localStorage, visualSettings);

let mode = 'intro';
let yaw = 0;
let pitch = -.17;
let sensitivity = 14;
let pointerEverLocked = false;
let lockRequestPending = false;
let lockUnavailable = false;
let shownPickupHint = false;
let lastPointer = null;
let edgeLook = { x: 0, y: 0, until: 0 };
let hovered = null;
let lastHoverKey = '';
let toastTimeout = 0;
const heldMovement = new Set();
let lastTick = performance.now();
const audio = createArchiveAudio(window);
const { tone } = audio;
const { targetInView } = createArchiveTargeting({ camera, world, state, keyIndex });
const promptFor = createArchivePrompts(state, keyIndex);
const { interact, drop } = createArchiveActions({
  state, keyIndex, world, camera, targetInView,
  getYaw: () => yaw, isPlaying: () => mode === 'play',
  save, updateHud, tone, toast, showVictory,
  invalidateHover: () => { lastHoverKey = '!'; },
});

function save() {
  keyIndex.rebuild();
  saveArchiveState(localStorage, state);
}

function toast(message, error = false) {
  const element = $('toast');
  element.textContent = message;
  element.style.color = error ? '#e9a7a0' : '#f5d69b';
  element.classList.add('visible');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => element.classList.remove('visible'), 2100);
}

function updateHud() { hud.update(); }

function setHovered(target) {
  const identity = target ? `${target.kind}-${target.id ?? target.stationId ?? target.type}` +
    (target.kind === 'cabinet' ? `:${target.slot ?? '-'}` : '') : '';
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
  document.body.classList.toggle('playing', next === 'play');
  $('intro').classList.toggle('is-hidden', next !== 'intro');
  $('pause').classList.toggle('is-hidden', next !== 'pause');
  $('visual').classList.toggle('is-hidden', next !== 'visual');
  $('victory').classList.toggle('is-hidden', next !== 'victory');
  $('hud').classList.toggle('is-hidden', next === 'intro');
  $('interaction-prompt').classList.toggle('is-hidden', next !== 'play' || !hovered);
  heldMovement.clear();
  lastPointer = null;
  edgeLook = { x: 0, y: 0, until: 0 };
  setHovered(null);
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

function play() {
  setMode('play');
  lockUnavailable = false;
  requestMouseLock();
  if (!shownPickupHint && getProgress(state).processed === 0 && !state.held.length) {
    shownPickupHint = true;
    toast('Посмотри на ключ на полу · E / У или ЛКМ — подобрать');
  }
  if (getProgress(state).processed === TOTAL_KEYS) toast('Архив уже разобран');
}

function pause() {
  if (mode !== 'play') return;
  setMode('pause');
  if (document.pointerLockElement === canvas) document.exitPointerLock();
}

function openVisual() {
  if (mode !== 'play' && mode !== 'pause') return;
  setMode('visual');
  if (document.pointerLockElement === canvas) document.exitPointerLock();
}

function showVictory() {
  if (getProgress(state).processed !== TOTAL_KEYS || mode !== 'play') return;
  setMode('victory');
  if (document.pointerLockElement === canvas) document.exitPointerLock();
}

function resetGame() {
  if (!window.confirm('Сбросить прогресс и снова разложить все 1000 ключей?')) return;
  try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  window.location.reload();
}

$('start-btn').addEventListener('click', play);
$('resume-btn').addEventListener('click', play);
$('victory-explore').addEventListener('click', play);
$('visual-open').addEventListener('click', openVisual);
$('visual-resume').addEventListener('click', play);
$('visual-back').addEventListener('click', () => setMode('pause'));
visualPanel.bind();
$('reset-btn').addEventListener('click', resetGame);
$('victory-reset').addEventListener('click', resetGame);
$('sensitivity').addEventListener('input', event => { sensitivity = Number(event.target.value); });
$('sound').addEventListener('change', event => { audio.setMuted(!event.target.checked); });

document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement === canvas) {
    lockRequestPending = false;
    lockUnavailable = false;
    pointerEverLocked = true;
    lastPointer = null;
    edgeLook = { x: 0, y: 0, until: 0 };
  } else if (pointerEverLocked && mode === 'play') {
    lockRequestPending = false;
    pause();
  }
});
document.addEventListener('pointerlockerror', onMouseLockUnavailable);

document.addEventListener('mousemove', event => {
  if (mode !== 'play') return;
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
  const key = logicalKey(event);
  if (['w', 'a', 's', 'd', ' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) event.preventDefault();
  if (key === 'escape') {
    if (mode === 'visual') setMode('pause');
    if (mode === 'play' && document.pointerLockElement !== canvas) pause();
    return;
  }
  if (mode === 'visual' && key === 'v') { setMode('pause'); return; }
  if (mode !== 'play') return;
  if (['w', 'a', 's', 'd', 'shift', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) heldMovement.add(key);
  if (event.repeat) return;
  if (key === 'e' || key === 'enter') interact();
  if (key === 'v') { openVisual(); return; }
  if (key === 'r') drop();
  if (key === ' ' || key === 'p') pause();
  if ('1234'.includes(key)) selectSlot(Number(key) - 1);
  if (key === 'h') {
    const footer = document.querySelector('.hud-footer');
    footer.style.opacity = footer.style.opacity === '0' ? '' : '0';
  }
  if (key === 'm') {
    const muted = audio.toggleMuted();
    $('sound').checked = !muted;
    toast(muted ? 'Звук выключен' : 'Звук включён');
  }
});
window.addEventListener('keyup', event => heldMovement.delete(logicalKey(event)));
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
  const cpuStart = performance.now();
  const delta = Math.min((now - lastTick) / 1000, .04);
  lastTick = now;
  let moving = false;
  if (mode === 'play') moving = movement.move(heldMovement, yaw, delta);
  if (mode === 'play' && document.pointerLockElement !== canvas && now < edgeLook.until) {
    yaw -= edgeLook.x * 1.6 * delta;
    pitch = clamp(pitch - edgeLook.y * 1.3 * delta, -1.31, 1.27);
  }
  camera.rotation.set(pitch, yaw, 0, 'YXZ');
  if (mode === 'play') setHovered(targetInView());
  if (mode === 'play' && hovered?.kind === 'bath') {
    const currentPrompt = promptFor(hovered);
    if ($('interaction-prompt').innerHTML !== currentPrompt) $('interaction-prompt').innerHTML = currentPrompt;
  }
  world.update(now, moving);
  const rendered = world.renderer.render(world.scene, camera) !== false;
  performanceHud.sample(now, performance.now() - cpuStart, rendered);
}

updateHud();
save();
requestAnimationFrame(tick);
