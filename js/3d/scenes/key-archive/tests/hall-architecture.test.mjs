import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import * as THREE from '../dist/vendor/three.js';
import {
  WINDOW_CENTERS, PILASTER_CENTERS, WINDOW_CROWN_Y, WINDOW_SCALE, WINDOW_CENTER_Y,
  PERIMETER_BAND_Y, createWindowedWallGeometry, createWindowPaneGeometry,
  createVaultGeometry, vaultHeight, archedOpening,
} from '../dist/js/hall-architecture.js';
import { PLAYER_EYE_HEIGHT } from '../dist/js/player-config.js';

test('solid side walls have five real arched openings for daylight', () => {
  const mesh = new THREE.Mesh(createWindowedWallGeometry(),
    new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  mesh.updateMatrixWorld(true);
  const ray = new THREE.Raycaster();
  const hits = (x, y) => {
    ray.set(new THREE.Vector3(x, y, -1), new THREE.Vector3(0, 0, 1));
    return ray.intersectObject(mesh).length;
  };
  assert.equal(WINDOW_CENTERS.length, 5);
  assert.ok(WINDOW_CENTERS.every(x => hits(x, 7.2) === 0));
  assert.equal(WINDOW_SCALE, .8);
  assert.ok(WINDOW_CENTERS.every(x => hits(x + .92, 7.2) > 0),
    'smaller aperture must close the former outer 20 percent of the window');
  assert.equal(WINDOW_CENTER_Y, (5.86 + WINDOW_CROWN_Y) / 2);
  assert.equal(hits(0, 11), 0); // above the wall entirely
  assert.ok(WINDOW_CENTERS.every(x => hits(x, 10.5) > 0));
  assert.ok(PILASTER_CENTERS.every(x => hits(x, 7.2) > 0));
  assert.ok(PILASTER_CENTERS.every(z => WINDOW_CENTERS.every(x => Math.abs(z - x) > 1.2)));
  mesh.geometry.dispose();
  mesh.material.dispose();
});

test('sunlight reaches the floor through window openings without crossing the ceiling', () => {
  const wall = new THREE.Mesh(createWindowedWallGeometry(),
    new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  wall.position.x = -12.3;
  wall.rotation.y = Math.PI / 2;
  wall.updateMatrixWorld(true);
  const roof = new THREE.Mesh(createVaultGeometry(),
    new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  roof.updateMatrixWorld(true);
  const ray = new THREE.Raycaster();
  const direction = new THREE.Vector3(-19, 17, -6).normalize();
  ray.set(new THREE.Vector3(-4, .02, 2.5), direction);
  assert.equal(ray.intersectObject(wall).length, 0);
  assert.equal(ray.intersectObject(roof).length, 0);
  ray.set(new THREE.Vector3(-4, .02, 0), direction);
  assert.ok(ray.intersectObject(wall).length > 0);
  wall.geometry.dispose();
  wall.material.dispose();
  roof.geometry.dispose();
  roof.material.dispose();
});

test('window frames form one continuous arch with glass cut to its opening', () => {
  const outer = archedOpening(0, 1.19, 5.74);
  outer.holes.push(archedOpening());
  const mesh = new THREE.Mesh(new THREE.ExtrudeGeometry(outer, {
    depth: .13, bevelEnabled: false, curveSegments: 22,
  }), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  mesh.updateMatrixWorld(true);
  const ray = new THREE.Raycaster();
  const hits = (x, y) => {
    ray.set(new THREE.Vector3(x, y, -1), new THREE.Vector3(0, 0, 1));
    return ray.intersectObject(mesh).length;
  };
  assert.equal(hits(0, 7), 0);
  assert.ok(hits(1.14, 7) > 0);
  assert.ok(hits(0, 10.31) > 0);
  assert.ok(hits(0, 5.8) > 0);
  const pane = createWindowPaneGeometry();
  const uv = pane.getAttribute('uv');
  assert.ok(Array.from(uv.array).every(value => value > -1e-5 && value < 1.00001));
  mesh.geometry.dispose();
  mesh.material.dispose();
  pane.dispose();
});

test('the continuous vaulted ceiling clears all windows and meets the dark beams', () => {
  assert.ok(vaultHeight(-12) > WINDOW_CROWN_Y + .2);
  assert.equal(vaultHeight(-12), vaultHeight(12));
  assert.ok(vaultHeight(0) > vaultHeight(12));
  assert.equal(PERIMETER_BAND_Y, 5.2);
  const geometry = createVaultGeometry();
  const positions = geometry.getAttribute('position');
  assert.ok(positions.count > 1000);
  for (let i = 0; i < positions.count; i++)
    assert.ok(Math.abs(positions.getY(i) - vaultHeight(positions.getX(i))) < 1e-5);
  geometry.dispose();
});

test('FPS remains visible in its own overlay and the camera is taller', () => {
  const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../dist/styles.css', import.meta.url), 'utf8');
  assert.equal((html.match(/id="fps"/g) || []).length, 1);
  assert.match(html, /class="fps-counter"/);
  assert.match(css, /\.fps-counter\{[^}]*position:absolute;right:/);
  assert.equal(PLAYER_EYE_HEIGHT, 1.78);
});
