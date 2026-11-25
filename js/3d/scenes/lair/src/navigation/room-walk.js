// @ts-check
import * as THREE from 'three';
import { createFootsteps } from '../../../../core/audio/footsteps.js';
import { t } from '../i18n.js';
import { ROOM_END, ROOM_FLOOR_Y, ROOM_LENGTH } from '../room-layout.js';

const eyeHeight = 1.70;
// Match the Key Archive's player-movement.js in world units per second.
const walkSpeed = 4.4;
const runSpeed = 7.4;
const bodyRadius = .32;
const lookSpeed = .0027;
const movementKeys = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight']);
const sprintKeys = new Set(['ShiftLeft', 'ShiftRight']);
const furniture = new Set([
  'main-arched-window-sill',
  'planning-main-table', 'planning-chair', 'planning-sofa', 'gramophone-table', 'workbench-right-of-alchemy',
  'planning-chair-right', 'planning-sofa-left', 'planning-armchair', 'planning-side-table', 'planning-bookcase',
  'restoration-left-easel', 'restoration-right-easel',
  'alchemy-main-tabletop', 'alchemy-lower-tabletop',
]);

/** @param {THREE.Scene} scene */
function measureRoom(scene) {
  const bounds = name => new THREE.Box3().setFromObject(scene.getObjectByName(name));
  const obstacles = [];
  scene.traverseVisible(object => {
    if (furniture.has(object.name) || object.name.startsWith('planning-side-table-') ||
      object.name.startsWith('leaning-canvas-back-')) {
      obstacles.push(new THREE.Box3().setFromObject(object));
    }
  });
  return {
    minX: bounds('lair-wainscot-left-cap').max.x + bodyRadius,
    maxX: bounds('lair-wainscot-right-cap').min.x - bodyRadius,
    minZ: bounds('lair-wainscot-back-cap').max.z + bodyRadius,
    maxZ: ROOM_END - bodyRadius,
    rug: bounds('planning-rug'),
    obstacles,
  };
}

function moveWithCollisions(position, dx, dz, area) {
  // Sweep one axis at a time so the player slides along a surface and stops
  // at the same point regardless of frame rate.
  function sweep(axis, across, distance, min, max) {
    const start = position[axis];
    let end = THREE.MathUtils.clamp(start + distance, min, max);
    for (const box of area.obstacles) {
      const offset = position[across];
      const gap = offset - THREE.MathUtils.clamp(offset, box.min[across], box.max[across]);
      if (Math.abs(gap) >= bodyRadius) continue;
      const padding = Math.sqrt(bodyRadius * bodyRadius - gap * gap);
      const near = box.min[axis] - padding, far = box.max[axis] + padding;
      if (distance > 0 && start <= near && end > near) end = near;
      if (distance < 0 && start >= far && end < far) end = far;
    }
    position[axis] = end;
  }
  sweep('x', 'z', dx, area.minX, area.maxX);
  sweep('z', 'x', dz, area.minZ, area.maxZ);
}

/**
 * @param {{scene: THREE.Scene, camera: THREE.PerspectiveCamera,
 *   interaction: HTMLElement, onMenu: (open: boolean) => void, onInteract: () => void}} options
 */
export function createRoomWalk({ scene, camera, interaction, onMenu, onInteract }) {
  const app = document.querySelector('#app');
  const toggle = document.querySelector('#room-walk-toggle');
  const hud = document.getElementById('room-walk-hud');
  const instructions = document.getElementById('room-walk-instructions');
  const lookHint = document.getElementById('room-walk-look');
  const targetHint = document.getElementById('room-walk-target');
  const keys = new Set();
  const footsteps = createFootsteps(window);
  const rotation = new THREE.Euler(0, 0, 0, 'YXZ');
  const hasLock = () => document.pointerLockElement === interaction;
  const mouseAvailable = window.matchMedia('(any-pointer: fine)');
  let active = false;
  let hadLock = false;
  let menuOpen = false;
  let browserEscape = -Infinity;
  // The mouse is locked on the click that starts a walk (the browser allows
  // it only then); the walk itself begins after the camera's descent.
  let lockPending = false;
  let lockTimer = 0;
  let drag = null;
  let mouse = null;
  let area;

  function updateInterface() {
    toggle.setAttribute('aria-pressed', String(active));
    app.classList.toggle('room-walking', active);
    app.classList.toggle('room-walk-paused', active && menuOpen);
    hud.hidden = instructions.hidden = !active || menuOpen;
    lookHint.textContent = hasLock() || mouseAvailable.matches ? t('Мышь — обзор') : t('Перетаскивай для обзора');
  }
  mouseAvailable.addEventListener('change', updateInterface);

  function resize() {
    if (active) camera.fov = 56;
  }

  function refreshObstacles() {
    if (active) area = measureRoom(scene);
  }

  /** Where the walker stands and looks, to come back to after a workshop. */
  function getPose() {
    return { position: camera.position.clone(), pitch: rotation.x, yaw: rotation.y };
  }

  /**
   * Where a walk begins: near the entrance, turned a little
   * left and up, so the easels, the window, the planning table and a
   * chandelier are in one view. The game starts here.
   */
  function startPose() {
    return { position: new THREE.Vector3(-.3, ROOM_FLOOR_Y + eyeHeight, ROOM_END - ROOM_LENGTH * .23), pitch: .13, yaw: .25 };
  }

  /** Start at the door, or at a pose from getPose() (back from a workshop). */
  function start(pose = null) {
    active = true;
    footsteps.setPlaying(!menuOpen);
    lockPending = false;
    clearTimeout(lockTimer);
    refreshObstacles();
    const { position, pitch, yaw } = pose || startPose();
    camera.position.copy(position);
    rotation.set(pitch, yaw, 0);
    camera.quaternion.setFromEuler(rotation);
    resize();
    camera.updateProjectionMatrix();
    updateInterface();
  }

  function requestLock() {
    if (menuOpen) return;
    if (interaction.requestPointerLock && !hasLock()) {
      try {
        // Unlocked look is available immediately, including in browsers
        // that reject pointer lock or report its failure only as an event.
        interaction.requestPointerLock()?.catch(() => {});
      } catch {
        // Continue with unlocked look.
      }
    }
  }

  /** On the click that starts a walk: lock the mouse now, walk after the descent. */
  function prepare() {
    footsteps.unlock();
    lockPending = true;
    clearTimeout(lockTimer);
    lockTimer = setTimeout(() => {
      lockPending = false;
      if (!active && hasLock()) document.exitPointerLock();
    }, 6000);
    requestLock();
  }

  function clearInput() {
    keys.clear();
    footsteps.reset();
    mouse = null;
    if (drag && interaction.hasPointerCapture(drag.id)) interaction.releasePointerCapture(drag.id);
    drag = null;
  }

  function setMenuOpen(open) {
    if (menuOpen === open) return;
    menuOpen = open;
    footsteps.setPlaying(active && !open);
    clearInput();
    if (open && hasLock()) document.exitPointerLock();
    updateInterface();
  }

  function setTarget(title) {
    const text = title ? `E · ${title}` : '';
    if (text === targetHint.textContent) return;
    targetHint.textContent = text;
    targetHint.hidden = !title;
    hud.classList.toggle('has-target', Boolean(title));
  }

  function stop() {
    if (!active) return;
    active = false;
    footsteps.setPlaying(false);
    clearInput();
    setTarget(null);
    if (hasLock()) document.exitPointerLock();
    updateInterface();
  }

  function look(dx, dy) {
    rotation.y -= dx * lookSpeed;
    rotation.x = THREE.MathUtils.clamp(rotation.x - dy * lookSpeed, -1.52, 1.52);
    camera.quaternion.setFromEuler(rotation);
  }

  document.addEventListener('pointerlockchange', () => {
    mouse = null;
    const locked = hasLock();
    const releasedByBrowser = hadLock && !locked;
    hadLock = locked;
    if (!active) {
      if (locked && !lockPending) document.exitPointerLock();
      return;
    }
    if (menuOpen && locked) document.exitPointerLock();
    if (releasedByBrowser && !menuOpen) {
      browserEscape = performance.now();
      onMenu(true);
    } else updateInterface();
  });
  document.addEventListener('mousemove', event => {
    if (active && !menuOpen && hasLock()) look(event.movementX, event.movementY);
  });
  interaction.addEventListener('pointerdown', event => {
    if (!active || menuOpen || hasLock() || event.pointerType === 'mouse' || event.button !== 0) return;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
    interaction.setPointerCapture(event.pointerId);
  });
  interaction.addEventListener('pointermove', event => {
    if (!active || menuOpen || hasLock()) return;
    if (event.pointerType === 'mouse') {
      if (mouse) look(event.clientX - mouse.x, event.clientY - mouse.y);
      mouse = { x: event.clientX, y: event.clientY };
    } else if (drag?.id === event.pointerId) {
      look(event.clientX - drag.x, event.clientY - drag.y);
      drag.x = event.clientX;
      drag.y = event.clientY;
    }
  });
  interaction.addEventListener('pointerleave', () => { mouse = null; });
  interaction.addEventListener('lostpointercapture', event => {
    if (drag?.id === event.pointerId) drag = null;
  });
  window.addEventListener('blur', clearInput);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) clearInput();
  });
  function handleKey(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      // Some browsers report the unlock before delivering the same Escape.
      if (!event.repeat && performance.now() - browserEscape > 180) onMenu(!menuOpen);
      return true;
    }
    if (menuOpen) return true;
    if (event.altKey || event.ctrlKey || event.metaKey) return false;
    if (movementKeys.has(event.code) || sprintKeys.has(event.code)) {
      event.preventDefault();
      if (!event.repeat && movementKeys.has(event.code)) footsteps.unlock();
      keys.add(event.code);
    } else if (event.code === 'KeyE') {
      event.preventDefault();
      if (!event.repeat) onInteract();
    } else return false;
    return true;
  }

  function update(delta) {
    if (menuOpen) return;
    const forward = Number(keys.has('KeyW') || keys.has('ArrowUp')) - Number(keys.has('KeyS') || keys.has('ArrowDown'));
    const right = Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft'));
    if (!forward && !right) { footsteps.reset(); return; }
    const sprint = keys.has('ShiftLeft') || keys.has('ShiftRight');
    const step = (sprint ? runSpeed : walkSpeed) * delta / Math.hypot(forward, right);
    const yaw = rotation.y;
    const { x, z } = camera.position;
    moveWithCollisions(camera.position,
      (right * Math.cos(yaw) - forward * Math.sin(yaw)) * step,
      (-right * Math.sin(yaw) - forward * Math.cos(yaw)) * step, area);
    const { x: nextX, z: nextZ } = camera.position;
    const { min, max } = area.rug;
    const surface = nextX >= min.x && nextX <= max.x && nextZ >= min.z && nextZ <= max.z ? 'rug' : 'wood';
    footsteps.update(Math.hypot(nextX - x, nextZ - z), surface, sprint);
  }

  /** Turn the walker to a heading (tests and scripted views). */
  function face(yaw = 0, pitch = 0) { rotation.set(pitch, yaw, 0); }

  return { start, stop, getPose, face, resize, update, refreshObstacles, setTarget, handleKey,
    releaseKey: code => keys.delete(code), startPose, prepare, captureMouse: requestLock,
    setMenuOpen, isMenuOpen: () => menuOpen };
}
