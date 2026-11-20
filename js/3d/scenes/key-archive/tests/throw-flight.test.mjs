import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../dist/vendor/three.js';
import { simulateThrow, throwVelocity, samplePath, THROW_SPEED } from '../dist/js/throw-flight.js';
import { createThrowScene, HALL_WALLS } from '../dist/js/throw-scene.js';
import { restingKeyY } from '../dist/js/floor-contact.js';
import { BENCH, WATER_BATH } from '../dist/js/wash-forge-stations.js';
import { FIXTURE_OFFSETS, FORGE_SURFACE_Y } from '../dist/js/station-layout.js';
import { createArchiveActions } from '../dist/js/archive-actions.js';
import { createKeyIndex } from '../dist/js/key-index.js';
import { createInitialState, upgradeKeyConditions, soakThrownKey, smeltThrownKey } from '../dist/js/rules.js';

const scene = createThrowScene();
const HAND = 1.33;

// A throw from (x, z) towards (tx, tz), pitched `degrees` above the horizon.
function throwAt(from, to, degrees, accepts = () => false) {
  const dx = to.x - from.x, dz = to.z - from.z, h = Math.hypot(dx, dz), a = degrees * Math.PI / 180;
  return simulateThrow({ start: { x: from.x, y: HAND, z: from.z },
    velocity: throwVelocity({ x: dx / h * Math.cos(a), y: Math.sin(a), z: dz / h * Math.cos(a) }),
    floorY: restingKeyY, ...scene.forKey(accepts) });
}
const distance = (flight, from) => Math.hypot(flight.landing.x - from.x, flight.landing.z - from.z);
const pitches = Array.from({ length: 36 }, (_, i) => -10 + i * 2);

test('aiming higher throws farther, within the hall: the reticle predicts the throw', () => {
  const from = { x: 0, z: 12 }, ahead = { x: 0, z: 0 };
  const ranges = [-30, -10, 0, 15, 30].map(deg => distance(throwAt(from, ahead, deg), from));
  for (let i = 1; i < ranges.length; i++) assert.ok(ranges[i] > ranges[i - 1], `${ranges}`);
  const longest = Math.max(...pitches.map(deg => distance(throwAt(from, ahead, deg), from)));
  assert.ok(longest > 6 && longest < 8, `longest throw ${longest.toFixed(2)} m`);
  assert.equal(THROW_SPEED, 6.5);
});

test('the same throw always lands in the same place, whatever lies on the floor', () => {
  const from = { x: 3, z: 10 }, to = { x: 1, z: 4 };
  const a = throwAt(from, to, 12), b = throwAt(from, to, 12);
  assert.deepEqual(a.landing, b.landing);
  // The landing depends only on the throw: no search for a free spot.
  assert.match(createArchiveActions.toString(), /simulateThrow\(/);
  assert.doesNotMatch(createArchiveActions.toString(), /findFreeFloorSpot/);
});

test('a key bounces off the floor, slides and comes to rest flat on it', () => {
  const flight = throwAt({ x: 0, z: 12 }, { x: 0, z: 0 }, 5);
  assert.equal(flight.landing.on, 'floor');
  assert.ok(flight.impacts.filter(hit => hit.kind === 'floor').length >= 2, 'at least one rebound');
  assert.ok(Math.abs(flight.landing.y - restingKeyY(flight.landing.x, flight.landing.z)) < 1e-9);
  const end = samplePath(flight.path, flight.duration + 1);
  assert.ok(Math.abs(end.x - flight.landing.x) < 1e-6 && Math.abs(end.z - flight.landing.z) < 1e-6);
});

test('a key can come to rest on the workbench top', () => {
  // Dropped onto the empty end of the bench from just above it.
  const flight = simulateThrow({ start: { x: 2.2, y: 1.3, z: .2 }, velocity: { x: 0, y: 0, z: .3 },
    floorY: restingKeyY, ...scene.forKey(() => false) });
  assert.equal(flight.landing.on, 'surface');
  assert.ok(Math.abs(flight.landing.y - BENCH.surfaceY) < 1e-9);
});

test('a key thrown at a wall bounces back into the hall', () => {
  const flight = throwAt({ x: 0, z: -20.5 }, { x: 0, z: -30 }, 10);
  assert.ok(flight.impacts.some(hit => hit.kind === 'wall'));
  assert.ok(flight.landing.z > -HALL_WALLS.z);
});

const water = { x: FIXTURE_OFFSETS.mud, z: WATER_BATH.z };
const forge = { x: FIXTURE_OFFSETS.forge, z: .08 };

test('a muddy key lobbed into the water is caught; a clean key bounces out', () => {
  const from = { x: water.x, z: 2.2 };
  const catching = pitches.filter(deg =>
    throwAt(from, water, deg, vessel => vessel.kind === 'mud').landing.on === 'vessel');
  assert.ok(catching.length > 0, 'some aim lands it in the water');
  assert.equal(throwAt(from, water, catching[0], vessel => vessel.kind === 'mud').landing.vessel, 'center-mud');
  const clean = pitches.map(deg => throwAt(from, water, deg));
  assert.ok(clean.every(flight => flight.landing.on !== 'vessel'));
  assert.ok(clean.some(flight => flight.bouncedOff === 'center-mud'), 'the bowl knocks it away');
});

test('a broken key can be tossed into the forge from close by; an intact one bounces off', () => {
  const from = { x: forge.x, z: 1.6 };
  const broken = pitches.map(deg => throwAt(from, forge, deg, vessel => vessel.kind === 'forge'));
  assert.ok(broken.some(flight => flight.landing.on === 'vessel' && flight.landing.kind === 'forge'));
  const intact = pitches.map(deg => throwAt(from, forge, deg));
  assert.ok(intact.every(flight => flight.landing.on !== 'vessel'));
  assert.ok(intact.some(flight => flight.bouncedOff === 'center-forge'));
  assert.ok(FORGE_SURFACE_Y > HAND, 'the hearth is above the hand: it takes a lob');
});

test('rules: a key thrown into a bath starts soaking, a broken one into the forge starts smelting', () => {
  const state = createInitialState();
  upgradeKeyConditions(state);
  const rusty = state.keys.find(key => key.status === 'floor' && key.rust && !key.mud && !key.broken && !key.wax);
  assert.equal(soakThrownKey(state, rusty, 'center-mud', 'mud', 1000), false, 'a rusty key is not washed');
  assert.equal(soakThrownKey(state, rusty, 'center-rust', 'rust', 1000), true);
  assert.equal(rusty.status, 'bath');
  assert.equal(rusty.bathId, 'center-rust');
  assert.equal(rusty.bathUntil, 1000 + 30000);
  const broken = state.keys.find(key => key.status === 'floor' && key.broken);
  assert.equal(smeltThrownKey(state, broken, 1000), true);
  assert.equal(broken.status, 'smelting');
  const clean = state.keys.find(key => key.status === 'floor' && !key.mud && !key.rust && !key.broken && !key.wax);
  assert.equal(smeltThrownKey(state, clean, 1000), false);
});

test('throwing a rusty key into the rust tray puts it in the tray when it lands', () => {
  const state = createInitialState();
  upgradeKeyConditions(state);
  const key = state.keys.find(item => item.status === 'floor' && item.rust && !item.mud && !item.broken && !item.wax);
  key.status = 'held';
  state.held = [key.id];
  const tray = { x: FIXTURE_OFFSETS.rust, z: .10 };
  const camera = new THREE.PerspectiveCamera();
  let landed = null;
  // Find an aim from in front of the bench that lands in the tray.
  for (const deg of pitches) {
    const a = deg * Math.PI / 180;
    camera.position.set(tray.x, 1.78, 2.2);
    camera.rotation.set(a, 0, 0, 'YXZ');
    camera.updateMatrixWorld(true);
    const trial = createInitialState();
    upgradeKeyConditions(trial);
    const k = trial.keys.find(item => item.id === key.id);
    k.status = 'held'; trial.held = [k.id];
    let flight = null;
    const actions = createArchiveActions({ state: trial, keyIndex: createKeyIndex(trial.keys), camera,
      world: { getThrowScene: () => scene, getThrowRelease: () => new THREE.Vector3(tray.x, HAND, 2.0),
        animateThrow(thrown, simulated, onLanded) { flight = simulated; onLanded(simulated.landing); },
        syncKey() {}, workstations: {} },
      getYaw: () => 0, isPlaying: () => true, stationNow: () => 5000,
      save() {}, updateHud() {}, tone() {}, toast() {}, showVictory() {}, invalidateHover() {} });
    actions.drop();
    if (flight?.landing.on === 'vessel') { landed = { flight, key: k }; break; }
  }
  assert.ok(landed, 'some aim lands it in the tray');
  assert.equal(landed.key.status, 'bath');
  assert.equal(landed.key.bathId, 'center-rust');
});
