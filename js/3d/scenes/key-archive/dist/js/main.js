import * as THREE from '../vendor/three.js';
import {
  KEY_TYPES, KEYS_PER_TYPE, TOTAL_KEYS, MAX_HELD, STORAGE_KEY, LEGACY_STORAGE_KEY,
  createInitialState, validateState, migrateLegacyState, pickupKey, selectedKey,
  putKeyInCabinet, trashSelectedKey, dropSelectedKey, getProgress, upgradeKeyConditions,
  upgradeFloorDistribution, startSoak, collectSoakedKey, bathContents, keyCondition,
} from './rules.js?v=21';
import { createWorld } from './world.js?v=23';
import { createFallbackWorld } from './fallback-world.js?v=23';
import { VISUAL_STORAGE_KEY, DEFAULT_VISUAL_SETTINGS, normalizeVisualSettings } from './visual-settings.js?v=21';
import { PLAYER_EYE_HEIGHT } from './player-config.js';
import { logicalKey } from './controls.js';
import { edgeLookRate } from './mouse-look.js';
import { findFloorKeyAtReticle } from './key-picking.js';
import { separateFloorKeys, findFreeFloorSpot } from './key-spacing.js?v=17';
import { inStationFootprint } from './station-layout.js';

const $ = id => document.getElementById(id);
const canvas = $('world');
let visualSettings;
try {
  visualSettings = normalizeVisualSettings(JSON.parse(localStorage.getItem(VISUAL_STORAGE_KEY) || 'null'));
} catch {
  visualSettings = normalizeVisualSettings(null);
}
let state;
try {
  const snapshot = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
  const previous = JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY) || 'null');
  state = validateState(snapshot) ? snapshot : migrateLegacyState(previous) || createInitialState();
} catch {
  state = createInitialState();
}
upgradeKeyConditions(state);
upgradeFloorDistribution(state);
separateFloorKeys(state.keys);
let world;
try {
  world = createWorld(canvas, state, visualSettings);
} catch (error) {
  console.warn('WebGL недоступен. Используется графический резервный режим.', error.message);
  world = createFallbackWorld(canvas, state, visualSettings);
}
const camera = world.camera;
const raycaster = new THREE.Raycaster();
const center = new THREE.Vector2(0, 0);
const clamp = (number, a, b) => Math.max(a, Math.min(b, number));
const symbols = ['◯', '△', '□', '◇', '⬟', '⬡', '★', '✿', '⬭', '♛'];

let mode = 'intro';
let yaw = 0;
let pitch = -.17;
let sensitivity = 14;
let muted = false;
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
let lastFpsAt = lastTick;
let framesRendered = 0;
let stepPhase = 0;
let soundContext;

function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* private windows */ }
}

function saveVisual() {
  try { localStorage.setItem(VISUAL_STORAGE_KEY, JSON.stringify(visualSettings)); } catch { /* private windows */ }
}

function updateVisualControls() {
  for (const [key, value] of Object.entries(visualSettings)) {
    const control = $(key);
    if (!control) continue;
    if (control.type === 'checkbox') control.checked = value;
    else control.value = value;
    const output = document.querySelector(`output[for="${key}"]`);
    if (output) output.textContent = key === 'toonSteps' ? String(value) :
      key === 'outlineWidth' ? `${value} px` : `${value}%`;
  }
}

function setVisualSettings(values) {
  visualSettings = normalizeVisualSettings(values);
  world.setVisualSettings(visualSettings);
  updateVisualControls();
  saveVisual();
}

function tone(kind = 'take') {
  if (muted) return;
  try {
    soundContext ||= new (window.AudioContext || window.webkitAudioContext)();
    if (soundContext.state === 'suspended') soundContext.resume();
    const now = soundContext.currentTime;
    const notes = kind === 'trash' ? [[330, .07], [220, .16]] :
      kind === 'place' ? [[440, .09], [660, .12]] :
      kind === 'finish' ? [[440, .11], [554, .14], [659, .20]] :
      kind === 'wrong' ? [[220, .11]] : [[680, .06], [910, .05]];
    let offset = 0;
    for (const [frequency, duration] of notes) {
      const oscillator = soundContext.createOscillator();
      const gain = soundContext.createGain();
      oscillator.type = kind === 'wrong' ? 'triangle' : 'sine';
      oscillator.frequency.setValueAtTime(frequency, now + offset);
      oscillator.frequency.exponentialRampToValueAtTime(frequency * .75, now + offset + duration);
      gain.gain.setValueAtTime(.0001, now + offset);
      gain.gain.exponentialRampToValueAtTime(kind === 'wrong' ? .028 : .056, now + offset + .009);
      gain.gain.exponentialRampToValueAtTime(.0001, now + offset + duration);
      oscillator.connect(gain).connect(soundContext.destination);
      oscillator.start(now + offset);
      oscillator.stop(now + offset + duration + .02);
      offset += kind === 'finish' ? .10 : .045;
    }
  } catch { /* audio is a nonessential enhancement */ }
}

function toast(message, error = false) {
  const element = $('toast');
  element.textContent = message;
  element.style.color = error ? '#e9a7a0' : '#f5d69b';
  element.classList.add('visible');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => element.classList.remove('visible'), 2100);
}

function updateHud() {
  const progress = getProgress(state);
  $('floor-count').textContent = Math.max(0, progress.floorCount - (world.throwingCount?.() || 0));
  $('trash-count').textContent = `${progress.trashed} / ${progress.broken}`;
  $('metal-count').textContent = String(state.metal || 0);
  $('soak-count').textContent = String(progress.soaking);
  $('hand-count').textContent = `${state.held.length} / ${MAX_HELD}`;

  const inventory = $('inventory');
  inventory.replaceChildren();
  for (let slot = 0; slot < MAX_HELD; slot++) {
    const key = state.keys.find(item => item.id === state.held[slot]);
    const element = document.createElement('div');
    element.className = `inventory-slot${key && slot === state.selected ? ' selected' : ''}${key?.broken ? ' broken' : ''}${key?.mud ? ' muddy' : ''}${key?.rust ? ' rusty' : ''}`;
    element.innerHTML = `<span class="slot-num">${slot + 1}</span>`;
    if (key) {
      const mark = document.createElement('span');
      mark.className = 'slot-mark';
      mark.textContent = symbols[key.type];
      const name = document.createElement('span');
      name.className = 'slot-name';
      name.textContent = key.broken ? 'СЛОМАН · ПЛАВКА' : key.mud && key.rust ? 'ГРЯЗЬ + РЖАВЧИНА' :
        key.mud ? 'В ГРЯЗИ · ВОДА' : key.rust ? 'РЖАВЧИНА · РАСТВОР' : KEY_TYPES[key.type].name;
      element.append(mark, name);
    }
    inventory.append(element);
  }
  world.refreshHand(selectedKey(state));
}

function promptFor(target) {
  if (!target) return '';
  if (target.kind === 'key') {
    const key = state.keys.find(item => item.id === target.id);
    if (!key || key.status !== 'floor') return '';
    const condition = keyCondition(key);
    const conditionNote = condition === 'broken' ? ' · СЛОМАН' :
      condition === 'both' ? ' · ГРЯЗЬ + РЖАВЧИНА' : condition === 'mud' ? ' · ГРЯЗЬ' :
      condition === 'rust' ? ' · РЖАВЧИНА' : '';
    return state.held.length >= MAX_HELD
      ? `<kbd>4/4</kbd> Руки заняты · положи ключ в шкаф или на пол`
      : `<kbd>E / У</kbd> Взять · ${KEY_TYPES[key.type].name.toLowerCase()}${conditionNote}`;
  }
  if (target.kind === 'bath') {
    const contents = bathContents(state, target.id);
    const held = selectedKey(state);
    const label = target.bathKind === 'mud' ? 'Ванна · отмачивание грязи' : 'Раствор · очистка ржавчины';
    const count = `${contents.keys.length}/4`;
    if (held && !held.broken && held[target.bathKind] && contents.space > 0)
      return `<kbd>E / У</kbd> Погрузить ключ · ${label} · ${count}`;
    if (contents.ready.length && state.held.length < MAX_HELD)
      return `<kbd>E / У</kbd> Забрать очищенный ключ · ${count}`;
    if (contents.ready.length) return `Ключ готов · освободи место в руках · ${count}`;
    if (contents.pending.length) {
      const seconds = Math.max(1, Math.ceil(Math.min(...contents.pending.map(key => key.bathUntil)) / 1000 - Date.now() / 1000));
      return `${label} · ${count} · осталось ≈${seconds} сек`;
    }
    return contents.space ? `${label} · ${count} · <kbd>E / У</kbd> опустить подходящий ключ` : `${label} · ванна заполнена`;
  }
  if (target.kind === 'forge') {
    const held = selectedKey(state);
    if (!held) return 'Урна-плавильня · сломанные ключи → металл · <kbd>E / У</kbd>';
    return held.broken
      ? '<kbd>E / У</kbd> Переплавить сломанный ключ · +1 металл'
      : 'Урна-плавильня · здесь перерабатываются только сломанные ключи';
  }
  const key = selectedKey(state);
  const progress = getProgress(state);
  const count = progress.sorted[target.type];
  const required = progress.required[target.type];
  if (!key) return `<kbd>${symbols[target.type]}</kbd> Шкаф «${KEY_TYPES[target.type].name}» · ${count}/${required}`;
  if (key.broken) return '<kbd>!</kbd> Сломанный ключ · отнеси к ближайшей плавильне';
  if (key.mud || key.rust) return '<kbd>!</kbd> Ключ нужно очистить · ванны находятся на трёх станциях зала';
  return key.type === target.type
    ? `<kbd>E / У</kbd> Повесить ключ · ${KEY_TYPES[target.type].name} · ${count}/${required}`
    : `<kbd>${symbols[target.type]}</kbd> Шкаф для ключей «${KEY_TYPES[target.type].name}»`;
}

function setHovered(target) {
  const identity = target ? `${target.kind}-${target.id ?? target.stationId ?? target.type}` : '';
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

function targetInView() {
  if (world.pickTarget) return world.pickTarget();
  camera.updateMatrixWorld();
  raycaster.setFromCamera(center, camera);
  const intersections = raycaster.intersectObjects(world.interactables, false);
  for (const hit of intersections) {
    const data = hit.object.userData;
    if (!data?.kind || hit.distance > (data.kind === 'cabinet' ? 6.5 :
      data.kind === 'bath' || data.kind === 'forge' ? 4.7 : 4)) continue;
    if (data.kind === 'key-batch') {
      const id = world.keyIdFromHit(data.type, hit.instanceId);
      if (!id || world.isThrowing(id) || state.keys.find(item => item.id === id)?.status !== 'floor') continue;
      return { kind: 'key', id };
    }
    if (data.kind === 'key' && (world.isThrowing(data.id) || state.keys.find(item => item.id === data.id)?.status !== 'floor')) continue;
    return data;
  }
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  const nearKey = findFloorKeyAtReticle(camera.position, forward, state.keys, world.isThrowing);
  if (nearKey) return { kind: 'key', id: nearKey.id };
  // Cabinet fronts are generous interaction targets, including from an angle.
  const targetCenter = new THREE.Vector3();
  let closest = null;
  let bestScore = Infinity;
  for (const cabinet of world.cabinets) {
    cabinet.collider.getWorldPosition(targetCenter);
    const direction = targetCenter.clone().sub(camera.position);
    const distance = direction.length();
    const alignment = forward.dot(direction.normalize());
    if (distance < 6.5 && alignment > .81 && distance < bestScore) {
      bestScore = distance;
      closest = { kind: 'cabinet', type: cabinet.type };
    }
  }
  if (closest) return closest;
  return null;
}

function interact() {
  if (mode !== 'play') return;
  const target = targetInView();
  if (!target) return;
  if (target.kind === 'key') {
    if (!pickupKey(state, target.id)) {
      toast('В руках помещается четыре ключа', true);
      tone('wrong');
      return;
    }
    world.syncKey(state.keys.find(key => key.id === target.id));
    updateHud();
    save();
    tone('take');
    const picked = selectedKey(state);
    toast(picked.broken ? 'Сломанный ключ · отнеси к плавильне' :
      picked.mud && picked.rust ? 'Ключ в грязи и ржавчине · потребуется обе ванны' :
      picked.mud ? 'Грязный ключ · отмочи в воде' : picked.rust ? 'Ржавый ключ · погрузи в раствор' :
        `Ключ взят · ${KEY_TYPES[picked.type].name}`);
    lastHoverKey = '!';
    return;
  }
  if (target.kind === 'bath') {
    const key = selectedKey(state);
    if (key && startSoak(state, target.id, target.bathKind)) {
      world.workstations?.refreshBaths?.();
      updateHud();
      save();
      tone('take');
      toast(target.bathKind === 'mud' ? 'Ключ отмокает в воде · 5 секунд' : 'Ключ в очищающем растворе · 7 секунд');
    } else {
      const collected = collectSoakedKey(state, target.id);
      if (collected) {
        world.workstations?.refreshBaths?.();
        world.syncKey(collected);
        updateHud();
        save();
        tone('place');
        toast(collected.mud || collected.rust ? 'Один слой очищен · нужна вторая ванна' : 'Ключ очищен · можно нести к шкафу');
      } else {
        const contents = bathContents(state, target.id);
        toast(contents.ready.length && state.held.length >= MAX_HELD ? 'Освободи место для чистого ключа' :
          contents.space === 0 ? 'Ванна заполнена · четыре ключа' :
            contents.pending.length ? 'Подожди, пока ключи отмокнут' :
              target.bathKind === 'mud' ? 'Здесь очищают ключи от грязи' : 'Здесь удаляют ржавчину', true);
        tone('wrong');
      }
    }
    lastHoverKey = '!';
    return;
  }
  if (target.kind === 'forge') {
    if (!selectedKey(state)?.broken) {
      toast('Плавильня принимает только сломанные ключи', true);
      tone('wrong');
      return;
    }
    world.animateDiscard(selectedKey(state), target.stationId);
    trashSelectedKey(state);
    updateHud();
    save();
    tone('trash');
    toast('Сломанный ключ переплавлен · +1 металл');
    lastHoverKey = '!';
    if (getProgress(state).processed === TOTAL_KEYS) setTimeout(showVictory, 1100);
    return;
  }
  const key = selectedKey(state);
  if (!key) {
    toast('Сначала возьми ключ с пола');
    return;
  }
  if (key.broken) {
    toast('Сломанный ключ · отнеси к плавильне', true);
    tone('wrong');
    return;
  }
  if (key.mud || key.rust) {
    toast('Сперва очисти ключ · используй ванны на ближайшей станции', true);
    tone('wrong');
    return;
  }
  if (key.type !== target.type) {
    toast('Это шкаф для ключей «' + KEY_TYPES[target.type].name + '»', true);
    tone('wrong');
    return;
  }
  const keyType = key.type;
  if (!putKeyInCabinet(state, target.type)) return;
  world.animatePlace(key, getProgress(state).sorted[keyType] - 1);
  world.refreshCabinet(keyType);
  updateHud();
  save();
  const progress = getProgress(state);
  if (progress.sorted[keyType] === progress.required[keyType]) {
    tone('finish');
    toast('Шкаф «' + KEY_TYPES[keyType].name + '» заполнен');
  } else {
    tone('place');
    toast('Ключ на своём месте');
  }
  lastHoverKey = '!';
  if (progress.processed === TOTAL_KEYS) setTimeout(showVictory, 1900);
}

function drop() {
  if (mode !== 'play') return;
  const key = selectedKey(state);
  if (!key) return;
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  forward.y = 0;
  forward.normalize();
  const landing = findFreeFloorSpot(state.keys,
    camera.position.x + forward.x * 2.8, camera.position.z + forward.z * 2.8);
  const { x, z } = landing;
  const start = { x: camera.position.x + forward.x * .42, y: camera.position.y - .27,
    z: camera.position.z + forward.z * .42 };
  const end = { x, y: .085, z };
  dropSelectedKey(state, x, z, -yaw + .6);
  world.animateThrow(key, start, end);
  updateHud();
  save();
  tone('take');
  toast('Ключ брошен');
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
  $('capture-hint').classList.add('is-hidden');
  setHovered(null);
}

function onMouseLockUnavailable() {
  lockRequestPending = false;
  lockUnavailable = true;
  if (mode === 'play' && document.pointerLockElement !== canvas) {
    $('capture-hint').classList.remove('is-hidden');
  }
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
$('visual-reset').addEventListener('click', () => setVisualSettings(DEFAULT_VISUAL_SETTINGS));
$('visual-natural').addEventListener('click', () => setVisualSettings({ ...visualSettings,
  toonEnabled: false, outlineEnabled: false, brushExpression: 0 }));
for (const key of Object.keys(DEFAULT_VISUAL_SETTINGS)) {
  const control = $(key);
  control.addEventListener(control.type === 'checkbox' ? 'change' : 'input', event => {
    setVisualSettings({ ...visualSettings, [key]: control.type === 'checkbox' ? event.target.checked : Number(event.target.value) });
  });
}
updateVisualControls();
$('capture-retry').addEventListener('click', () => {
  lockUnavailable = false;
  requestMouseLock();
});
$('reset-btn').addEventListener('click', resetGame);
$('victory-reset').addEventListener('click', resetGame);
$('sensitivity').addEventListener('input', event => { sensitivity = Number(event.target.value); });
$('sound').addEventListener('change', event => { muted = !event.target.checked; });

document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement === canvas) {
    lockRequestPending = false;
    lockUnavailable = false;
    pointerEverLocked = true;
    lastPointer = null;
    edgeLook = { x: 0, y: 0, until: 0 };
    $('capture-hint').classList.add('is-hidden');
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
    muted = !muted;
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

function positionBlocked(x, z) {
  if (Math.abs(x) > world.bounds.x || Math.abs(z) > world.bounds.z) return true;
  for (const tx of [-9.3, 9.3]) for (const tz of [-20.7, 20.7]) {
    if (Math.abs(x - tx) < 1.15 && Math.abs(z - tz) < 1.34) return true;
  }
  if (inStationFootprint(x, z, .22)) return true;
  return false;
}

function movePlayer(delta) {
  const forward = Number(heldMovement.has('w') || heldMovement.has('arrowup')) - Number(heldMovement.has('s') || heldMovement.has('arrowdown'));
  const right = Number(heldMovement.has('d') || heldMovement.has('arrowright')) - Number(heldMovement.has('a') || heldMovement.has('arrowleft'));
  const length = Math.hypot(forward, right);
  if (!length) {
    camera.position.y += (PLAYER_EYE_HEIGHT - camera.position.y) * Math.min(1, delta * 8);
    return false;
  }
  const speed = (heldMovement.has('shift') ? 7.4 : 4.4) * delta / length;
  const dx = (-Math.sin(yaw) * forward + Math.cos(yaw) * right) * speed;
  const dz = (-Math.cos(yaw) * forward - Math.sin(yaw) * right) * speed;
  if (!positionBlocked(camera.position.x + dx, camera.position.z)) camera.position.x += dx;
  if (!positionBlocked(camera.position.x, camera.position.z + dz)) camera.position.z += dz;
  stepPhase += delta * (heldMovement.has('shift') ? 15 : 10);
  camera.position.y = PLAYER_EYE_HEIGHT + Math.sin(stepPhase) * .025;
  return true;
}

function tick(now) {
  requestAnimationFrame(tick);
  const delta = Math.min((now - lastTick) / 1000, .04);
  lastTick = now;
  let moving = false;
  if (mode === 'play') moving = movePlayer(delta);
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
  if (world.renderer.render(world.scene, camera) !== false) framesRendered++;
  if (now - lastFpsAt >= 800) {
    $('fps').textContent = Math.round(framesRendered * 1000 / (now - lastFpsAt));
    $('floor-count').textContent = Math.max(0, getProgress(state).floorCount - (world.throwingCount?.() || 0));
    framesRendered = 0;
    lastFpsAt = now;
  }
}

updateHud();
save();
requestAnimationFrame(tick);
