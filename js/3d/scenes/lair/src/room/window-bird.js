// @ts-check
import * as THREE from 'three';
import { WINDOW_OPENING } from './window.js';

// A bird that now and then flies past outside the arched window; its shadow
// crosses the window light (see birdShade in window-light.js). Adapted from the
// Key Archive's js/3d/scenes/key-archive/dist/js/archive-window-bird.js, which
// cannot be imported here: the Archive's dist/ is served on its own.

const { centerX, wallZ, sill, crown } = WINDOW_OPENING;
/** The bird's plane, just outside the glass. */
export const BIRD_Z = wallZ - .9;
export const BIRD_SIZE = Object.freeze({ width: 1.7, height: 1.27 });
const FLIGHT_SECONDS = 3.25;
const FLIGHT_LEVELS = [.56, .39, .65, .47, .62, .43];
const FIRST_FLIGHT_DELAY = 6;
const SPAN = 9.5;                      // half the path along the wall, from the window centre

/** The flapping silhouette on a small canvas, and when and where the bird is. */
function createFlight() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 96;
  const ink = canvas.getContext('2d');
  /** x: along the wall, y: altitude, z: 1 while flying, w: direction (±1). */
  const pose = new THREE.Vector4(0, 0, 0, 1);
  let flyAt = FIRST_FLIGHT_DELAY;
  let direction = 1;
  let passage = 0;
  let lastFrame = -1;

  function paint(time) {
    const frame = Math.floor(time * 18);
    if (frame === lastFrame || !ink) return false;
    lastFrame = frame;
    const wing = Math.cos(frame / 18 * Math.PI * 2 * 2.25);
    ink.clearRect(0, 0, 128, 96);
    ink.fillStyle = '#555d66';
    ink.beginPath();
    ink.moveTo(67, 48);
    ink.bezierCurveTo(63, 44, 51, 40 + wing * 16, 32, 35 + wing * 20);
    ink.bezierCurveTo(40, 45 + wing * 10, 53, 50 + wing * 4, 73, 54);
    ink.closePath();
    ink.fill();
    ink.beginPath();
    ink.moveTo(93, 45);
    ink.lineTo(101, 47);
    ink.lineTo(92, 49);
    ink.bezierCurveTo(86, 57, 67, 58, 52, 53);
    ink.lineTo(29, 57);
    ink.lineTo(40, 50);
    ink.lineTo(31, 44);
    ink.lineTo(56, 47);
    ink.bezierCurveTo(71, 44, 78, 40, 86, 41);
    ink.quadraticCurveTo(91, 41, 93, 45);
    ink.closePath();
    ink.fill();
    ink.beginPath();
    ink.moveTo(74, 51);
    ink.bezierCurveTo(69, 42, 56, 34 - wing * 14, 31, 32 - wing * 21);
    ink.bezierCurveTo(40, 44 - wing * 17, 51, 53 - wing * 8, 64, 55);
    ink.quadraticCurveTo(71, 55, 74, 51);
    ink.fill();
    return true;
  }

  /** time in seconds; true when the silhouette was redrawn. */
  function update(time) {
    const elapsed = time - flyAt;
    if (elapsed < 0 || elapsed >= FLIGHT_SECONDS) {
      pose.z = 0;
      if (elapsed >= FLIGHT_SECONDS) {
        flyAt = time + 30 + Math.random() * 20;
        direction *= -1;
        passage++;
        lastFrame = -1;
      }
      return false;
    }
    const phase = elapsed / FLIGHT_SECONDS;
    const level = FLIGHT_LEVELS[passage % FLIGHT_LEVELS.length];
    const pitch = (passage % 2 ? -.38 : .38) * (phase - .5);
    const altitude = sill + (crown - sill) * level + pitch + Math.sin(phase * Math.PI * 2) * .19;
    pose.set(centerX + (phase * 2 - 1) * SPAN * direction, altitude, 1, direction);
    return paint(elapsed);
  }
  return { canvas, pose, update };
}

/**
 * Adds the bird to `parent`. `uniforms` are shared by every shader that uses
 * the window light, so its shadow appears in the beams, on the floor and on dust.
 */
export function createWindowBird(parent) {
  const flight = createFlight();
  const texture = new THREE.CanvasTexture(flight.canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  const bird = new THREE.Mesh(new THREE.PlaneGeometry(BIRD_SIZE.width, BIRD_SIZE.height),
    new THREE.MeshBasicMaterial({ map: texture, color: 0x262e34, transparent: true, opacity: .88,
      depthWrite: false, side: THREE.DoubleSide, toneMapped: false, fog: false }));
  bird.name = 'window-bird';
  bird.userData.atmosphere = true;        // outside the glass: no ink outline
  bird.position.z = BIRD_Z;
  bird.renderOrder = 2;
  bird.visible = false;
  parent.add(bird);
  const uniforms = {
    uWindowBirdMap: { value: texture },
    uWindowBirdPose: { value: flight.pose },
  };
  return {
    bird, uniforms,
    update(/** @type {number} */ time) {
      if (flight.update(time)) texture.needsUpdate = true;
      bird.visible = flight.pose.z > 0;
      if (bird.visible) {
        bird.position.x = flight.pose.x;
        bird.position.y = flight.pose.y;
        bird.scale.x = flight.pose.w;   // the drawing faces right; mirror it for leftward flights
      }
    },
  };
}
