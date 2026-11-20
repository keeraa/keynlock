import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import * as THREE from '../dist/vendor/three.js';
import {
  WINDOW_CENTERS, PILASTER_CENTERS, WINDOW_CROWN_Y, WINDOW_SCALE, WINDOW_CENTER_Y,
  WINDOW_VERTICAL_SCALE, WINDOW_RAISE_Y, HALL_HEIGHT_SCALE, windowY,
  PERIMETER_BAND_Y, HALL_END_WALL_HEIGHT, createWindowedWallGeometry, createWindowPaneGeometry,
  createVaultGeometry, vaultHeight, archedOpening,
} from '../dist/js/hall-architecture.js';
import { PLAYER_EYE_HEIGHT } from '../dist/js/player-config.js';
import { pilasterFreeTrimSpans } from '../dist/js/world-architecture.js';

test('lower wood trim stops before pilaster faces, with no intersecting solids', () => {
  const sections = pilasterFreeTrimSpans();
  assert.equal(sections.length, PILASTER_CENTERS.length + 1);
  for (const center of PILASTER_CENTERS)
    assert.ok(sections.every(([from, to]) => to < center - .315 || from > center + .315));
  assert.equal(sections[0][0], -23.4);
  assert.equal(sections.at(-1)[1], 23.4);
});

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
  assert.ok(WINDOW_CENTERS.every(x => hits(x, 8.6) === 0));
  assert.equal(WINDOW_SCALE, .8);
  assert.ok(Math.abs(WINDOW_VERTICAL_SCALE - .64) < 1e-10);
  assert.equal(WINDOW_RAISE_Y, .85);
  assert.ok(WINDOW_CENTERS.every(x => hits(x + .92, 8.6) > 0),
    'smaller aperture must close the former outer 20 percent of the window');
  assert.equal(WINDOW_CENTER_Y, (5.86 + WINDOW_CROWN_Y) / 2);
  assert.equal(hits(0, 14), 0); // above the taller wall entirely
  assert.ok(WINDOW_CENTERS.every(x => hits(x, 10.5) > 0));
  assert.ok(PILASTER_CENTERS.every(x => hits(x, 8.6) > 0));
  assert.ok(windowY(5.86) > 7);
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
  const direction = new THREE.Vector3(-19, 20, -6).normalize();
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
  assert.ok(HALL_END_WALL_HEIGHT > vaultHeight(0));
  assert.equal(HALL_HEIGHT_SCALE, 1.2);
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

test('dust is illuminated through the window openings and remains dim behind the masonry', async () => {
  const { dustOriginInWindowBeam, windowBeamLightAt } = await import('../dist/js/archive-window-rays.js');
  for (let i = 0; i < 5; i++) {
    const [x, y, z] = dustOriginInWindowBeam(i, () => .65);
    assert.ok(windowBeamLightAt(x, y, z) > .85);
    assert.equal(windowBeamLightAt(x, y, z + 3), 0);
    assert.equal(windowBeamLightAt(x, y + 4, z), 0);
  }
});

test('window air light reaches the painted footprints at carpet level', async () => {
  const { addWindowAirLight } = await import('../dist/js/archive-window-rays.js');
  const { WINDOW_WASHES } = await import('../dist/js/archive-entrance-light.js');
  const { RUG_TOP } = await import('../dist/js/floor-contact.js');
  const scene = new THREE.Scene();
  const setDaylight = addWindowAirLight(scene);
  const [beam] = scene.children;
  const { position } = beam.geometry.attributes;
  const verticesPerWindow = position.count / WINDOW_WASHES.length;
  for (const [index, wash] of WINDOW_WASHES.entries()) {
    for (let i = index * verticesPerWindow; i < (index + 1) * verticesPerWindow; i += 4) {
      for (const edge of [i + 1, i + 2]) {
        assert.ok(Math.abs(position.getY(edge) - RUG_TOP) < 1e-5);
        assert.ok(Math.abs(position.getX(edge) - wash.x) < wash.width / 2);
        assert.ok(Math.abs(position.getZ(edge) - wash.z) < wash.depth / 2);
      }
    }
  }
  assert.equal(beam.material.depthWrite, false);
  setDaylight(0);
  assert.equal(beam.visible, false);
  setDaylight(.75);
  assert.equal(beam.visible, true);
  assert.ok(beam.material.uniforms.uAirStrength.value < .040 * .75);
  beam.geometry.dispose();
  beam.material.dispose();
});

test('both halves of the arched window light land on the painted carpet footprint', async () => {
  const { WINDOW_WALL_X, WINDOW_BEAM_SILL, WINDOW_BEAM_CROWN, WINDOW_BEAM_SLOPE,
    WINDOW_BEAM_HALF_WIDTH, WINDOW_WASHES, windowBeamLightAt } = await import('../dist/js/window-beam-light.js');
  const { RUG_TOP } = await import('../dist/js/floor-contact.js');
  const windowZ = WINDOW_CENTERS[2];
  const wash = WINDOW_WASHES[2];
  for (const y of [WINDOW_BEAM_SILL + .40, WINDOW_BEAM_CROWN - .44]) {
    const distance = (y - RUG_TOP) / WINDOW_BEAM_SLOPE.y;
    const x = WINDOW_WALL_X + distance;
    const z = windowZ - distance * WINDOW_BEAM_SLOPE.z;
    assert.ok(Math.abs(x - wash.x) < wash.width / 2);
    assert.ok(windowBeamLightAt(x, RUG_TOP, z + WINDOW_BEAM_HALF_WIDTH * .50) > .72);
    assert.equal(windowBeamLightAt(x, RUG_TOP, z + WINDOW_BEAM_HALF_WIDTH * 1.13), 0);
  }
});
