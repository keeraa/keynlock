import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../src/vendor/three-core.js';
import { createGeometryPrimitives } from '../src/js/geometry/primitives.js';
import { createHousingGeometries } from '../src/js/geometry/housing.js';
import {isPlugBoreOpening, PIN_BORE_RADIUS} from '../src/js/geometry/pin-bores.js';
import { buildPinMechanism } from '../src/js/mechanisms/pin-lock.js';
import { TENSION_TOOL_CLEARANCE } from '../src/js/mechanisms/pin-tools.js';
import { buildDiscMechanism } from '../src/js/mechanisms/disc-lock.js';
import { buildCodeMechanism } from '../src/js/mechanisms/code-lock.js';
import { createNotchedDisc, createSpurGear } from '../src/js/geometry/lock-profiles.js';

// Exercise real Three.js meshes and BufferGeometry without a WebGL renderer.
// DOM-only image loading and patina drawing are the only mocked boundaries.
const originalLoad = THREE.TextureLoader.prototype.load;
THREE.TextureLoader.prototype.load = () => new THREE.Texture();
globalThis.document = {
  createElement: () => ({ width: 0, height: 0, getContext: () => ({
    fillRect() {}, beginPath() {}, ellipse() {}, stroke() {},
    moveTo() {}, lineTo() {},
  }) }),
};

function stage() {
  const root = new THREE.Group(), modeGroups = {};
  const parts = [];
  const mat = Object.fromEntries(
    ['case', 'edge', 'steel', 'inner', 'dark', 'copper', 'brass', 'ghost', 'chromed',
      'spring', 'glass', 'mahogany'].map(key => [key, new THREE.MeshStandardMaterial()]),
  );
  const tag = (object, name) => { object.userData.partName = name; return object; };
  const part = (object, direction = [0, 1, 0], distance = 1, name = '') => {
    parts.push({ object, direction, distance });
    if (name) tag(object, name);
    return object;
  };
  const addMesh = (parent, geometry, material, position = [0, 0, 0]) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...position);
    mesh.castShadow = mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  };
  const setDynamicBase = (object, x, y, z) => {
    object.userData.dynamicBase ??= new THREE.Vector3();
    return object.userData.dynamicBase.set(x, y, z);
  };
  class RoundedBoxTest extends THREE.BoxGeometry {
    constructor(width, height, depth) { super(width, height, depth, 3, 3, 3); }
  }
  const shape = createGeometryPrimitives({
    THREE, RoundedBoxGeometry: RoundedBoxTest, addMesh, setDynamicBase, springMaterial: mat.spring,
  });
  const makeHousing = (parent) => {
    const group = new THREE.Group();
    parent.add(group);
    return group;
  };
  const makeKey = (parent) => {
    const rig = new THREE.Group();
    parent.add(rig);
    const blade = addMesh(rig, new THREE.BoxGeometry(.1, .1, .4), mat.steel);
    return { rig, blade };
  };
  const common = {
    THREE, document: globalThis.document, root, modeGroups, raisedMechanism: .12, depthRatio: .70,
    coreCenterY: -.43, coreCenterZ: -.05, makeHousing, makeKey, mat,
    addMesh, tag, part,
    ...shape,
    keyCutHeight: () => .01,
    createKeywayPlugGeometry: createHousingGeometries({ THREE, depthRatio: .70 }).createKeywayPlugGeometry,
    material: (color, metalness = .7, roughness = .4, extras = {}) =>
      new THREE.MeshStandardMaterial({ color, metalness, roughness, ...extras }),
    grainMap: new THREE.Texture(),
    rand: (() => { let seed = 1234; return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296); })(),
    canvas: {},
    createNotchedDisc: (...args) => createNotchedDisc(THREE, ...args),
    createSpurGear: (...args) => createSpurGear(THREE, ...args),
  };
  return { ...common, parts };
}

const setup = stage();
const pin = buildPinMechanism(setup);
const disc = buildDiscMechanism(setup);
const code = buildCodeMechanism(setup);

test('three lock modes build separate 3D assemblies', () => {
  assert.equal(setup.modeGroups.pin, pin.pinGroup);
  assert.equal(setup.modeGroups.disc, disc.discGroup);
  assert.equal(setup.modeGroups.code, code.codeGroup);
  assert.equal(setup.root.children.filter(c => c.isGroup).length, 3);
});

test('pin study contains six physical stacks and can reveal 4–6', () => {
  assert.equal(pin.pinStacks.length, 6);
  assert.equal(pin.pinXs.length, 4);
  for (const stack of pin.pinStacks) {
    for (const name of ['pin', 'driver', 'spring']) {
      assert.ok(stack[name].geometry.getAttribute('position').count > 0);
    }
    assert.equal(stack.stack.visible, stack.i < 4);
  }
  const position = pin.makePinPositions(6);
  assert.equal(position.length, 6);
  assert.equal(pin.makePinPositions(7).length, 6, 'the old seventh channel is unavailable');
  pin.updatePlugCutawaySpan(position);
  assert.ok(pin.plugCutEnd.value > pin.plugCutStart.value);
  assert.equal(pin.tensionModels.length, 5);
  assert.ok(pin.tensionModels.every(model => model.children.some(part => part.isMesh)));
  assert.equal(pin.pickTip.geometry.type, 'TubeGeometry');
  assert.ok(pin.pinGearDrive.children.includes(pin.pinDriveWheel));
  assert.ok(pin.pinGearOutput.children.includes(pin.pinOutputWheel));
  assert.equal(pin.pinDriveTeeth, 12);
  assert.equal(pin.pinOutputTeeth, 16);
  assert.ok(pin.pinGearOutput.children.some(child =>
    child.geometry?.type === 'TorusGeometry' &&
    Math.abs(child.position.x - pin.pinEccentricRadius) < 1e-7),
  'the eccentric has a separate annular bearing, not an intersecting rod end');
  assert.ok(pin.pinSlider.children.some(child => child.geometry?.type === 'TorusGeometry'),
    'the sliding connection is finished with a bearing eye');
  assert.ok(!('pinTextureLoader' in pin), 'private construction helpers stay inside their modules');
});

test('longer pin lifts reach the original shear line and compress the attached driver springs', () => {
  const shearY=pin.pinShearY;
  for(const st of pin.pinStacks){
    assert.ok(st.requiredLift > .18, 'key/driver joint has appreciably more travel');
    assert.ok(st.restBottom >= -.71, 'parked pin stays in the lower plug cavity');
    assert.ok(Math.abs(st.restBottom+st.requiredLift+st.keyLength-shearY)<1e-8,
      'the lifted key pin meets the original shear line without crossing it');
    assert.ok(Math.abs(st.restBottom+st.keyLength+st.driverLength-.22)<1e-8,
      'the resting driver top stays in contact with its spring');
  }
});

test('circular entrance has a recessed opaque face with the existing through-keyway', () => {
  const face = pin.keywayInsert;
  assert.ok(face.isMesh && face.parent === pin.pinPlug);
  assert.equal(face.material, setup.mat.inner, 'the original brass ring and its finish remain untouched');
  assert.equal(face.material.transparent, false);
  assert.equal(face.geometry.parameters.shapes.holes.length, 1, 'the face has a true through-slot');
  assert.equal(pin.plugSurface.geometry.parameters.shapes.holes.length, 1);
  assert.ok(face.position.x < pin.plugSurface.position.x, 'the slot is visible in front of the plug');
  assert.ok(face.position.x + face.geometry.parameters.options.depth > pin.plugSurface.position.x,
    'the keyway throat joins the plug without a visible gap');
});

test('the rotating plug has four to six aligned open pin sockets on its curved top', () => {
  pin.updatePlugCutawaySpan(pin.pinXs);
  assert.equal(pin.plugBores.groups.length,6);
  assert.equal(PIN_BORE_RADIUS,.109);
  const first=pin.plugBores.groups[0];
  assert.equal(first.position.x,pin.pinXs[0]);
  assert.equal(first.children.length,2,'each bore has an inner lining and a curved metal rim');
  const wall=first.children[0].geometry.getAttribute('position');
  const lip=first.children[1].geometry.getAttribute('position');
  assert.ok(wall.count>40&&lip.count>100);
  const shader={uniforms:{},vertexShader:'#include <common>\n#include <begin_vertex>',
    fragmentShader:'#include <common>\n#include <clipping_planes_fragment>\n#include <opaque_fragment>'};
  pin.plugSurface.material.onBeforeCompile(shader);
  assert.match(shader.fragmentShader,/uPlugBorePositions\[6\]/);
  assert.match(shader.fragmentShader,/discard/,'top metal fragments are truly opened');
  assert.deepEqual(Array.from(shader.uniforms.uPlugBorePositions.value.slice(0,4)),
    pin.pinXs.map(x=>Math.fround(x+1.525)));
  assert.ok(isPlugBoreOpening({x:pin.pinXs[0]+1.525,y:.286,z:0},pin.pinXs));
  assert.ok(!isPlugBoreOpening({x:pin.pinXs[0]+1.525,y:-.28,z:0},pin.pinXs));
  const expanded=pin.makePinPositions(6);
  pin.updatePlugCutawaySpan(expanded);
  assert.ok(pin.plugBores.groups.every((group,i)=>group.visible&&group.position.x===expanded[i]));
  pin.updatePlugCutawaySpan(pin.pinXs);
  assert.ok(pin.plugBores.groups.slice(4).every(group=>!group.visible));
  assert.ok(Array.from(pin.plugBorePositions.value.slice(4)).every(x=>x===100));
});

test('secondary pick sits below the main pick and has a slim passable tip', () => {
  assert.ok(TENSION_TOOL_CLEARANCE.y < -.15);
  assert.ok(pin.tensionRig.position.y < pin.pickRig.position.y - .15);
  assert.ok(Math.abs(pin.tensionRig.position.z - pin.pickRig.position.z) >= .05);
  assert.ok(pin.tensionModels.every(model => {
    const tip = model.children.at(-1);
    return tip.geometry.type === 'SphereGeometry' &&
      Math.abs(tip.geometry.parameters.radius - TENSION_TOOL_CLEARANCE.tipRadius) < 1e-8;
  }));
  const availableLower = .265 - Math.abs(TENSION_TOOL_CLEARANCE.y);
  const availableSide = .085 - Math.abs(TENSION_TOOL_CLEARANCE.z);
  assert.ok(TENSION_TOOL_CLEARANCE.tipRadius < Math.min(availableLower, availableSide),
    'the lower wrench tip can enter the original rounded keyway');
  const cornerDistance = Math.hypot(
    Math.max(0, Math.abs(TENSION_TOOL_CLEARANCE.z) - (.085 - .052)),
    Math.max(0, -TENSION_TOOL_CLEARANCE.y - (.265 - .052)));
  assert.ok(cornerDistance + TENSION_TOOL_CLEARANCE.tipRadius < .052,
    'the tip clears the rounded lower corner of the through-slot');
});

test('outer tension wrenches sit lower while the entrance tips keep their clearance', () => {
  for (let i=0;i<pin.tensionModels.length;i++) {
    const geometry=pin.tensionModels[i].children[0].geometry;
    const positions=geometry.getAttribute('position');
    const firstRing=[];
    for (let j=0;j<12;j++) firstRing.push(positions.getY(j));
    const exposedCenterY=firstRing.reduce((a,b)=>a+b,0)/firstRing.length;
    assert.ok(exposedCenterY < pin.tensionSpecs[i].path[0][1]-.07,
      `${pin.tensionSpecs[i].name}: the exposed shaft must hang slightly lower`);
    const tip=pin.tensionModels[i].children.at(-1);
    assert.ok(Math.abs(tip.position.y)<1e-7,
      `${pin.tensionSpecs[i].name}: the tip remains at the original keyway height`);
  }
});

test('left free ends of the first two wrench choices match the button glyphs', () => {
  const chevron=pin.tensionSpecs[2].path;
  assert.ok(chevron[0][0]>chevron[1][0]+.35 && chevron[2][0]>chevron[1][0]+.35,
    'first choice forms a visible left-facing chevron');
  assert.ok(chevron[0][1]>chevron[1][1]+.25 && chevron[1][1]>chevron[2][1]+.25,
    'the chevron has both upper and lower arms');
  const rightAngle=pin.tensionSpecs[0].path;
  assert.ok(rightAngle[2][0]>rightAngle[0][0]+.3,
    'second choice has a horizontal upper arm');
  assert.ok(Math.abs(rightAngle[2][1]-rightAngle[0][1])<1e-8,
    'the right-angle upper arm is level');
  assert.ok(Math.abs(rightAngle[4][0]-rightAngle[5][0])<1e-8 &&
    rightAngle[4][1]>rightAngle[5][1]+.18,
  'the second choice bends downward at its right corner');
});

test('Japanese handle has exactly two undistorted sides, fully coated ends and a ferrule', () => {
  const children=pin.handleRig.children;
  const painted=children.find(child=>child.userData.partName==='Роспись на рукоятке');
  const endFace=children.find(child=>child.userData.partName==='Лакированный передний торец');
  const ferrule=children.find(child=>child.userData.partName==='Металлическое кольцо рукоятки');
  assert.ok(painted && endFace && ferrule);
  assert.equal(painted.geometry.type,'LatheGeometry');
  assert.equal(endFace.geometry.type,'RingGeometry');
  assert.equal(ferrule.geometry.type,'TorusGeometry');
  const uv=painted.geometry.getAttribute('uv');
  const vertices=painted.geometry.getAttribute('position');
  const ringStride=painted.geometry.parameters.points.length;
  assert.ok(Math.abs(uv.getX(0)-uv.getX((uv.count/ringStride-1)*ringStride)-2)<1e-7,
    'the lacquer painting repeats only twice, once on each face');
  assert.ok(Math.abs(uv.getX(32*ringStride)-1.5)<1e-7,
    'the front portrait is centered on the visible face');
  assert.ok(Math.abs(vertices.getY(0)+.669)<1e-7,
    'the lacquer reaches the rounded wooden butt');
  assert.ok(Math.abs(vertices.getY(vertices.count-1)-.568)<1e-7,
    'the painted neck is shortened and finishes at the relocated collar');
  const profile=painted.geometry.parameters.points;
  const neck=profile.filter(point=>point.y>=.2-1e-7);
  for(let i=1;i<neck.length;i++) {
    assert.ok(neck[i].y>neck[i-1].y,
      'the red neck has increasing axial coordinates with no overlapping bands');
    assert.ok(neck[i].x<neck[i-1].x,
      'the red neck narrows continuously from the body to the ferrule');
  }
  const start=profile.findIndex(point=>point.y>=.2-1e-7);
  const slopeBefore=(profile[start].x-profile[start-1].x)/
    (profile[start].y-profile[start-1].y);
  const slopeAfter=(profile[start+1].x-profile[start].x)/
    (profile[start+1].y-profile[start].y);
  assert.ok(Math.abs(slopeBefore-slopeAfter)<.08,
    'the red neck joins the rounded body without a visible tangent break');
  assert.equal(children.filter(child=>child.geometry?.type==='LatheGeometry').length,1,
    'there is one continuous painted handle, without an exposed wood disk');
  assert.ok(!children.some(child=>child.userData.partName==='Деревянная рукоятка отмычки'),
    'no offset wooden overlay is left to intersect the lacquer at the butt');
  assert.equal(endFace.material,painted.material,
    'the circular front face shares the painting rather than bare wood');
  assert.ok(Math.abs(ferrule.position.x-.568)<1e-7 && endFace.position.x>ferrule.position.x,
    'the brass collar was moved left with the newly shortened red neck');
  const shaftPositions=pin.pickTip.geometry.getAttribute('position');
  let shaftStart=Infinity;
  for(let i=0;i<shaftPositions.count;i++)shaftStart=Math.min(shaftStart,shaftPositions.getX(i));
  const neckEndInPick=pin.handleRig.position.x+pin.handleRig.scale.x*ferrule.position.x;
  assert.ok(shaftStart<neckEndInPick-.10,
    'the original one-piece steel shaft extends inside the moved collar');
  assert.equal(painted.material.transparent,false,
    'the lacquer is opaque so underlying wood cannot show through');
});

test('all five secondary shafts clear the pick shaft throughout the inserted positions', () => {
  const samples = geometry => {
    const points = [], vertices = geometry.getAttribute('position'), radial = 12;
    for (let i = 0; i <= 112; i++) {
      const center = new THREE.Vector3();
      for (let j = 0; j < radial; j++) {
        const index = i * (radial + 1) + j;
        center.add(new THREE.Vector3(vertices.getX(index), vertices.getY(index), vertices.getZ(index)));
      }
      center.divideScalar(radial);
      const first = i * (radial + 1);
      const radius = center.distanceTo(new THREE.Vector3(vertices.getX(first),
        vertices.getY(first), vertices.getZ(first)));
      points.push({ center, radius });
    }
    return points;
  };
  const main = samples(pin.pickTip.geometry);
  for (const model of pin.tensionModels) {
    const second = samples(model.children[0].geometry);
    for (const selected of pin.pinXs) {
      const mainX = selected - .12;
      let clearance = Infinity;
      for (const a of main) for (const b of second) {
        const dx = a.center.x + mainX - (b.center.x - 1.52);
        const dy = a.center.y - b.center.y - TENSION_TOOL_CLEARANCE.y;
        const dz = a.center.z - (b.center.z + TENSION_TOOL_CLEARANCE.z);
        clearance = Math.min(clearance, Math.hypot(dx, dy, dz) - a.radius - b.radius);
      }
      assert.ok(clearance > .004,
        `secondary shaft must clear main shaft (pin ${selected}, gap ${clearance.toFixed(3)})`);
    }
  }
});

test('spring housing stops before the gear tooth envelope with six pins', () => {
  const sixBores = pin.makePinPositions(6);
  const geometry = pin.makeManifoldGeometry(sixBores);
  geometry.computeBoundingBox();
  const localRight = geometry.boundingBox.max.x;
  const housingRight = pin.manifoldWalls.parent.position.x + localRight;
  const gearLeft = pin.pinGearDrive.position.x - (.23 + .018);
  assert.ok(gearLeft - housingRight > .015,
    'the housing does not intersect rotating spur gear teeth');
  assert.ok(localRight - (sixBores.at(-1) + .44 + .123) > .03,
    'the final spring bore remains enclosed by a metal wall');
  geometry.dispose();
});

test('disc and combination mechanisms preserve part counts and gear ratio', () => {
  assert.equal(disc.detainerDiscs.length, 6);
  assert.equal(code.codeDiscs.length, 3);
  assert.ok(code.gearA.children.some(c => c.isMesh));
  assert.ok(code.gearB.children.some(c => c.isMesh));
  assert.ok(Math.abs(code.gearB.position.x - code.gearA.position.x - code.gearDistance) < 1e-8);
  assert.equal(code.teethA, 12);
  assert.equal(code.teethB, 16);
});

test('all geometries are finite and nonempty', () => {
  let count = 0;
  setup.root.traverse(object => {
    if (!object.isMesh) return;
    const pos = object.geometry.getAttribute('position');
    assert.ok(pos?.count > 0, `empty geometry for ${object.userData.partName ?? object.type}`);
    for (const value of pos.array) assert.ok(Number.isFinite(value), 'nonfinite mesh vertex');
    count++;
  });
  assert.ok(count > 70, `expected detailed geometry, got ${count} meshes`);
});

test.after(() => { THREE.TextureLoader.prototype.load = originalLoad; });
