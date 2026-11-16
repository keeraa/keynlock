import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../src/vendor/three-core.js';
import { createLockState } from '../src/js/state/lock-state.js';
import { createLockAnimator, EXPLODE_DISTANCE_MULTIPLIER } from '../src/js/runtime/lock-animator.js';
import { createPinMotion, createDiscMotion, createCodeMotion } from '../src/js/runtime/motions.js';
import { createMechanismHandle, createMechanismRegistry } from '../src/js/mechanisms/registry.js';

function fixture({ oilStats = null, wrenchStats = null, renderSceneStats = null } = {}) {
  const group = () => new THREE.Group();
  const metal = () => new THREE.MeshStandardMaterial({ color: 0xbaa078 });
  const cylinder = () => new THREE.Mesh(new THREE.CylinderGeometry(.1, .1, .2), metal());
  const pinStacks = Array.from({ length: 6 }, (_, i) => ({
    i, lift: 0, restBottom: -.55, keyLength: .18, driverLength: .14,
    requiredLift: .19, pin: cylinder(), driver: cylinder(), spring: group(),
  }));
  let pinXs = [-.9, -.5, -.1, .3];
  let puzzle = null;
  let selectedTension = 1;
  let now = 0;
  const state = createLockState(pinXs);
  state.pinSet = Array(6).fill(false);
  state.pinLifts = Array(6).fill(0);
  const counters = { frames: 0, telemetry: 0, physics: 0, oil: 0, atmosphere: 0, preview: 0,
    checks: 0, puzzleFrames: 0, released: 0, links: 0, rigidPose: 0 };
  const telemetry = [];
  const display = new Map();
  const $ = id => {
    if (!display.has(id)) display.set(id, { textContent: '' });
    return display.get(id);
  };
  const shackleBody = { released: false, shaking: 0 };
  const shacklePivot = group();
  const lockCam = group();
  const camEccentric = group();
  lockCam.add(camEccentric);
  const pinGroup = group();
  const pinGearDrive = group(), pinGearOutput = group();
  pinGearOutput.position.set(.73, -.42, 0);
  const symbolBeam = group(), symbolGrooves = Array.from({ length: 6 }, group);
  const pinKey = { rig: group() }, discKey = { rig: group() };
  const pinPlug = group(), pickRig = group(), pickTip = group(), handleRig = group();
  const tensionRig = group(), driveShaft = group();
  const detainerDiscs = Array.from({ length: 6 }, group);
  const codeDiscs = Array.from({ length: 3 }, group);
  const gearA = group(), gearB = group(), drive = group(), dialRig = group();
  const explodePart = group();
  const parts = [{ obj: explodePart, base: explodePart.position.clone(),
    dir: new THREE.Vector3(1, 0, 0), distance: .5 }];
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera();
  const renderer = {
    info: { render: { triangles: 123 }, memory: { geometries: 1 } },
    render() { counters.frames++; },
  };
  const setDynamicBase = (obj, x, y, z) => {
    if (!obj.userData.dynamicBase) obj.userData.dynamicBase = new THREE.Vector3();
    obj.userData.dynamicBase.set(x, y, z);
  };
  const sidebar=group(), fence=group(), pinSlider=group();
  const pinGearConnectingRod=group(), pinCamConnectingRod=group();
  const moveArticulatedRod=()=>{counters.links++;};
  const moveTelescopicRod=()=>{counters.links++;};
  const registry=createMechanismRegistry({
    pin:createMechanismHandle({name:'pin',group:group(),model:{},
      update:createPinMotion({THREE,state,pinPlug,pinKey,pickRig,pickTip,handleRig,
        tensionRig,discKey,setDynamicBase,coreCenterY:-.43,coreCenterZ:-.05,
        symbolBeam,symbolGrooves,pinStacks,keySurfaceAt:()=>-.03,
        puzzlePinLift:()=>.11,pinStackRise:0,pinGearDrive,pinGearOutput,
        pinDriveTeeth:12,pinOutputTeeth:20,pinEccentricRadius:.1,pinSlider,
        moveArticulatedRod,pinGearConnectingRod,camEccentric,pinGroup,
        moveTelescopicRod,pinCamConnectingRod})}),
    disc:createMechanismHandle({name:'disc',group:group(),model:{},
      update:createDiscMotion({state,discKey,detainerDiscs,sidebar,setDynamicBase})}),
    code:createMechanismHandle({name:'code',group:group(),model:{},
      update:createCodeMotion({state,codeDiscs,drive,dialRig,fence,gearA,gearB,
        teethA:12,teethB:20,setDynamicBase})}),
  });
  registry.activate('pin');
  const { animate } = createLockAnimator({
    THREE, performance: { now: () => (now += 16.67) }, state,
    tickPinPuzzle() { counters.puzzleFrames++; },
    pinsAtShear: () => true,
    mechanismRegistry:registry,driveShaft,
    getPinXs: () => pinXs, getPinPuzzle: () => puzzle,
    getSelectedTension: () => selectedTension,
    lockCam,
    updateLockingBalls() {},
    shackleBody, shacklePivot,
    releaseShackle() { counters.released++; shackleBody.released = true; },
    stepShacklePhysics() { counters.physics++; },
    applyRigidShackleTransform() { counters.rigidPose++; },
    parts,
    tickOil() { counters.oil++; },
    tickAtmosphere() { counters.atmosphere++; },
    plugSideReveal: { value: 0 },
    controls: { getAzimuthalAngle: () => .9, update() {} },
    mat: { glass: { opacity: 1 } }, $,
    updateButtons() { counters.checks++; },
    renderPinPuzzleUI() {},
    renderer, scene, camera,
    performanceMonitor: { record(now,stats) { counters.telemetry++; telemetry.push(stats); } },
    renderOilToolPreview() { counters.preview++; return oilStats; },
    renderWrenchPickerPreview() { return wrenchStats; },
    renderScene: renderSceneStats ? () => renderSceneStats : undefined,
    status() {},
  });
  return {
    animate, state, pinStacks, pinPlug, pinKey, pinGearDrive, pinGearOutput,
    symbolBeam, symbolGrooves, detainerDiscs, codeDiscs, gearA, gearB,
    shackleBody, shacklePivot, explodePart, $, counters, telemetry,
    setXs: xs => { pinXs = xs; },
    setPuzzle: game => { puzzle = game; },
    setTension: index => { selectedTension = index; },
    activate: mode => registry.activate(mode),
  };
}

test('animator moves key pins and springs, gearing and scene on each frame', () => {
  const f = fixture();
  f.state.insertTarget = 1;
  f.state.explodeTarget = 1;
  for (let i = 0; i < 15; i++) f.animate();
  assert.ok(f.state.insertP > 0);
  assert.ok(f.state.explodeP > 0);
  assert.ok(Number.isFinite(f.pinStacks[0].pin.position.y));
  assert.ok(f.pinStacks[0].spring.scale.y > 0);
  assert.ok(f.pinGearDrive.rotation.z > 0);
  assert.ok(Number.isFinite(f.pinGearOutput.rotation.z));
  assert.ok(f.explodePart.position.x > 0);
  assert.equal(f.counters.frames, 15);
  assert.equal(f.counters.telemetry, 15);
  assert.equal(f.counters.physics, 15);
  assert.equal(f.counters.rigidPose, 15);
  assert.equal(f.counters.oil, 15);
  assert.equal(f.counters.atmosphere, 15);
  assert.equal(f.counters.preview, 15);
  assert.equal(f.counters.puzzleFrames, 15);
  assert.ok(f.counters.links >= 30);
});

test('animator reports draw calls from scene, oil can and tension-wrench previews', () => {
  const f = fixture({renderSceneStats:{calls:12,triangles:1000,sceneTriangles:600},
    oilStats:{calls:4,triangles:33},wrenchStats:{calls:5,triangles:55}});
  for(let i=0;i<36;i++)f.animate();
  assert.equal(f.telemetry.at(-1).calls,21);
  assert.equal(f.telemetry.at(-1).triangles,1088);
  assert.equal(f.$('polygonCount').textContent,'600',
    'on-screen polygon count still refers to the actual lock');
});

test('200% disassembly spreads parts farther and still restores their exact seats', () => {
  const f = fixture();
  f.state.explodeTarget = 1;
  for (let i = 0; i < 140; i++) f.animate();
  assert.ok(f.state.explodeP > .99);
  assert.ok(EXPLODE_DISTANCE_MULTIPLIER > 2.1);
  assert.ok(f.explodePart.position.x > 1.4, '200% separates a half-unit part by over 1.4 units');
  f.state.explodeTarget = 0;
  for (let i = 0; i < 140; i++) f.animate();
  assert.ok(f.explodePart.position.x < .01, 'all parts return cleanly to assembly coordinates');
});

test('animator sees changing pin counts and puzzles without recreating the frame callback', () => {
  const f = fixture();
  f.setXs([-.9, -.5, -.1, .3, .7]);
  f.setPuzzle({ type: 'symbolpins', fixed: Array(5).fill(false) });
  f.animate();
  assert.equal(f.symbolBeam.visible, true);
  assert.equal(f.symbolGrooves.filter(g => g.visible).length, 5);
  assert.ok(Number.isFinite(f.pinStacks[4].pin.position.y));
  f.setPuzzle(null);
  f.animate();
  assert.equal(f.symbolBeam.visible, false);
});

test('disc and code rotation share animator and unlock releases a whole shackle', () => {
  const f = fixture();
  f.state.mode = 'disc';
  f.activate('disc');
  f.state.insertTarget = 1;
  for (let i = 0; i < 10; i++) f.animate();
  assert.notEqual(f.detainerDiscs[0].rotation.x, 0);
  f.state.mode = 'code';
  f.activate('code');
  for (let i = 0; i < 10; i++) f.animate();
  assert.notEqual(f.codeDiscs[0].rotation.x, 0);
  assert.notEqual(f.gearA.rotation.z, 0);
  assert.notEqual(f.gearB.rotation.z, 0);
  f.state.unlockTarget = 1;
  f.state.turnTarget = 1;
  for (let i = 0; i < 190; i++) f.animate();
  assert.equal(f.counters.released, 1);
  assert.equal(f.shackleBody.released, true);
  assert.equal(f.$('polygonCount').textContent, '123');
  assert.ok(Number(f.$('fpsCount').textContent) > 0);
});

test('a fully disengaged shackle releases promptly and a locked shackle shakes slowly', () => {
  const quick = fixture();
  quick.state.turnTarget = 1;
  quick.state.unlockTarget = 1;
  for (let i = 0; i < 37; i++) quick.animate();
  assert.equal(quick.counters.released, 1, 'steel U-bar detaches within about six tenths of a second');

  const locked = fixture();
  locked.shackleBody.shaking = 1;
  const offsets = [];
  for (let i = 0; i < 3; i++) {
    locked.animate();
    offsets.push(locked.shacklePivot.userData.dynamicBase.x-1.52);
  }
  assert.ok(offsets[0] > 0 && offsets[1] > offsets[0] && offsets[2] > offsets[1],
    'locked-bar shake swings gradually rather than rapidly reversing every frame');
});
