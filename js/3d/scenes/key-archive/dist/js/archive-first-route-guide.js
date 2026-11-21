// @ts-check
import { t, familyName } from './i18n.js';
import { CABINET_HEADER_Y } from './cabinet-layout.js';
import * as THREE from '../vendor/three.js';
import { restingKeyY } from './floor-contact.js';

export const FIRST_ROUTE_KEY_ID = '9-0';
const entranceSpot = { x: 0, z: 18.27, rotation: .22, layer: 0 };

export function prepareFirstRoute(state) {
  const key = state.keys.find(item => item.id === FIRST_ROUTE_KEY_ID);
  if (state.firstRoute === undefined) {
    state.firstRoute = Boolean(key && !key.broken && !key.mud && !key.rust &&
      !state.metal && state.keys.every(item => item.status === 'floor'));
    if (state.firstRoute) Object.assign(key, entranceSpot);
  }
  return state.firstRoute === true && key?.status === 'floor' ? key : null;
}

export function createFirstRouteGuide(document, state, keyIndex, world) {
  // The hosting cache can combine an older HTML page with this script.
  document.getElementById('first-route-goal')?.remove();
  document.getElementById('first-route-marker')?.remove();
  const goal = document.createElement('div');
  goal.id = 'first-route-goal';
  goal.className = 'first-route-goal is-hidden';
  goal.setAttribute('role', 'status');
  const marker = document.createElement('div');
  marker.id = 'first-route-marker';
  marker.className = 'first-route-marker is-hidden';
  marker.setAttribute('aria-hidden', 'true');
  document.getElementById('hud').append(goal, marker);
  const style = document.createElement('link');
  style.rel = 'stylesheet';
  style.href = new URL('../first-route-guide.css', import.meta.url).href;
  document.head.append(style);
  const camera = world.camera;
  const point = new THREE.Vector3();
  const local = new THREE.Vector3();

  function update(playing) {
    const key = state.firstRoute === true ? keyIndex.get(FIRST_ROUTE_KEY_ID) : null;
    const active = playing && key && (key.status === 'held' || key.status === 'bundled' || key.status === 'floor');
    goal.classList.toggle('is-hidden', !active);
    if (!active) {
      marker.classList.add('is-hidden');
      return;
    }

    const carrying = key.status !== 'floor';
    const cabinetName = familyName(key.type);
    if (carrying) {
      point.setFromMatrixPosition(world.cabinets[key.type].group.matrixWorld);
      point.y += CABINET_HEADER_Y;
    } else {
      point.set(key.x, restingKeyY(key.x, key.z) + .18, key.z);
    }
    local.copy(point).applyMatrix4(camera.matrixWorldInverse);
    point.project(camera);
    const inView = local.z < 0 && Math.abs(point.x) < .88 && Math.abs(point.y) < .80;
    marker.classList.toggle('is-hidden', !inView);
    if (inView) {
      marker.style.left = `${(point.x + 1) * 50}%`;
      marker.style.top = `${(1 - point.y) * 50}%`;
    }

    let direction = '';
    if (!inView) {
      if (local.z >= 0 && Math.abs(local.x) < .3) direction = t('route.turnAround');
      else if (local.z >= 0 || Math.abs(point.x) >= .88) direction = t(local.x < 0 ? 'route.left' : 'route.right');
      else direction = t(local.y < 0 ? 'route.lookDown' : 'route.lookUp');
    }
    const selected = state.held[state.selected] === key.id;
    const instruction = key.status === 'bundled' ? t('route.bundle', { name: cabinetName }) : carrying
      ? t('route.carry', { name: cabinetName, choose: selected ? '' : t('route.choose') })
      : t('route.pick');
    const text = instruction + direction;
    if (goal.textContent !== text) goal.textContent = text;
  }
  return { update };
}
