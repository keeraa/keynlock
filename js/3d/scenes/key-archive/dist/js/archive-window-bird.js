import * as THREE from '../vendor/three.js';
import { windowY, WINDOW_SILL_Y, WINDOW_CROWN_Y } from './hall-architecture.js?v=alchemy-candles';
import { WINDOW_BEAM_SLOPE } from './archive-window-rays.js?v=alchemy-candles';
import { RUG_TOP } from './floor-contact.js';

export const BIRD_X = -11.95;
export const BIRD_WIDTH = 1.38;
export const BIRD_HEIGHT = 1.03;
const FLIGHT_SECONDS = 8.8;
const FIRST_FLIGHT_DELAY = 6;

export function createWindowBirdFlight() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 96;
  const ink = canvas.getContext('2d');
  const pose = new THREE.Vector4(0, 0, 0, -1);
  let flyAt = FIRST_FLIGHT_DELAY;
  let direction = -1;
  let lastFrame = -1;
  let lastTime = null;
  let playTime = 0;

  function paintFlightFrame(time) {
    const frame = Math.floor(time * 18);
    if (frame === lastFrame) return;
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
  }

  function update(now, playing = true) {
    const delta = lastTime === null ? 0 : Math.max(0, (now - lastTime) / 1000);
    lastTime = now;
    if (!playing) { pose.z = 0; return false; }
    playTime += delta;
    const elapsed = playTime - flyAt;
    if (elapsed < 0 || elapsed >= FLIGHT_SECONDS) {
      pose.z = 0;
      if (elapsed >= FLIGHT_SECONDS) {
        flyAt = playTime + 30 + Math.random() * 20;
        direction *= -1;
        lastFrame = -1;
      }
      return false;
    }
    const phase = elapsed / FLIGHT_SECONDS;
    const altitude = windowY((WINDOW_SILL_Y + WINDOW_CROWN_Y) / 2) + Math.sin(elapsed * 1.9) * .15;
    const alongWall = (phase * 2 - 1) * 22 * direction;
    pose.set(altitude, alongWall, 1, direction);
    const changed = Math.floor(elapsed * 18) !== lastFrame;
    paintFlightFrame(elapsed);
    return changed;
  }
  return { canvas, pose, update };
}

export function addWindowBird(scene) {
  const flight = createWindowBirdFlight();
  const texture = new THREE.CanvasTexture(flight.canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  const material = new THREE.MeshBasicMaterial({
    map: texture, color: 0x262e34, transparent: true, opacity: .88,
    depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
  });
  const bird = new THREE.Mesh(new THREE.PlaneGeometry(BIRD_WIDTH, BIRD_HEIGHT), material);
  bird.name = 'Window bird';
  bird.rotation.y = Math.PI / 2;
  // Behind the pane, but composited after its glow so the silhouette reads.
  bird.renderOrder = 2;
  bird.visible = false;
  scene.add(bird);

  const pose = flight.pose;
  const shadowUniforms = {
    uWindowBirdMap: { value: texture },
    uWindowBirdPose: { value: pose },
    uWindowBirdProjection: { value: new THREE.Vector4(BIRD_X, WINDOW_BEAM_SLOPE.y, WINDOW_BEAM_SLOPE.z, RUG_TOP) },
    uWindowBirdSize: { value: new THREE.Vector2(BIRD_WIDTH, BIRD_HEIGHT) },
  };
  return { shadowUniforms, update(now, playing) {
    if (flight.update(now, playing)) texture.needsUpdate = true;
    bird.visible = pose.z > 0;
    if (bird.visible) {
      bird.position.set(BIRD_X, pose.x, pose.y);
      bird.scale.x = -pose.w;
    }
  } };
}
