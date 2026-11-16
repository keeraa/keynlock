import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from '../src/vendor/three-core.js';
import { createSeededRandom } from '../src/js/runtime/scenario-model.js';
import { createPlatePuzzle, PLATE_COUNT, PLATE_MIN_COUNT, PLATE_MAX_COUNT,
  PLATE_POSITIONS, PLATE_TARGET } from
  '../src/js/gameplay/plate-rules.js';
import { PLATE_SYMBOLS, plateSymbolSvg, PLATE_SYMBOL_TO_WRENCH,
  WRENCH_TO_PLATE_SYMBOL, WRENCH_PICKER_ORDER } from '../src/js/mechanisms/plate-symbols.js';
import { buildPlateMechanism, createPlateBodyGeometry, PLATE_FRONT_OFFSET_Z,
  plateRowY, plateFrameScale, PLATE_HOLE_STEP, PLATE_ROW_STEP } from '../src/js/mechanisms/plate-lock.js';
import { createPlateMotion } from '../src/js/runtime/motions.js';
import { applyPlateCoupling, plateCoupling } from '../src/js/gameplay/plate-links.js';

const seededPuzzle = seed => {
  const rng = createSeededRandom(seed);
  const puzzle = createPlatePuzzle(() => rng.next());
  puzzle.reset();
  return puzzle;
};
const solveScramble = puzzle => {
  const moves = [...puzzle.model.scrambleMoves].reverse();
  for (const {index,delta} of moves) {
    puzzle.selectPlate(index);
    assert.equal(puzzle.shift(-delta),true);
  }
};

test('plate coupling is atomic, reversible and respects both travel limits', () => {
  assert.deepEqual(plateCoupling(0,4,1),
    [{index:0,delta:1},{index:1,delta:1}]);
  assert.deepEqual(plateCoupling(1,4,1),
    [{index:1,delta:1},{index:2,delta:-1}]);
  assert.deepEqual(plateCoupling(3,4,-1),
    [{index:3,delta:-1},{index:2,delta:1}]);
  const positions = [4,4,4,4];
  assert.equal(applyPlateCoupling(positions,1,1),true);
  assert.deepEqual(positions,[4,5,3,4]);
  assert.equal(applyPlateCoupling(positions,1,-1),true);
  assert.deepEqual(positions,[4,4,4,4]);
  const blocked = [4,7,4,4];
  assert.equal(applyPlateCoupling(blocked,0,1),false);
  assert.deepEqual(blocked,[4,7,4,4]);
});

test('classic plate lock draws one of five shared motifs for four deterministic pegs', () => {
  const puzzle = seededPuzzle(97461), copy = seededPuzzle(97461);
  assert.equal(PLATE_COUNT, 4);
  assert.equal(PLATE_MIN_COUNT, 4);
  assert.equal(PLATE_MAX_COUNT, 6);
  assert.equal(PLATE_POSITIONS, 7);
  assert.equal(PLATE_SYMBOLS.length, 5);
  assert.deepEqual(puzzle.model.plates, copy.model.plates);
  assert.equal(puzzle.model.plates.length, 4);
  assert.ok(puzzle.model.plates.every(plate => plate.position !== PLATE_TARGET));
  assert.ok(puzzle.model.symbol >= 0 && puzzle.model.symbol < 5);
  assert.ok(puzzle.model.plates.every(plate => plate.symbol === puzzle.model.symbol));
  assert.equal(puzzle.isSolved(), false);
  const first = puzzle.model.plates[0];
  const mismatched = (first.symbol + 1) % 5;
  assert.equal(puzzle.selectTool(mismatched), false);
  assert.equal(puzzle.shift(1), false, 'incorrect motif cannot slide the plate');
  assert.equal(first.engaged, false);
  assert.equal(puzzle.selectTool(first.symbol), true);
  solveScramble(puzzle);
  assert.equal(puzzle.isSolved(), true, 'all four plates align only after matching tools');
  puzzle.reset();
  assert.equal(puzzle.isSolved(), false, 'reset relocks the newly randomized mechanism');
});

test('plate count supports five and six without a new mechanic or extra symbols', () => {
  const puzzle = seededPuzzle(301);
  for (const count of [5,6]) {
    assert.equal(puzzle.setCount(count), true);
    puzzle.reset();
    assert.equal(puzzle.model.plates.length, count);
    assert.ok(puzzle.model.plates.every(plate => plate.symbol === puzzle.model.symbol));
    assert.equal(puzzle.selectPlate(count - 1), true);
    assert.equal(puzzle.selectPlate(count), false);
    puzzle.selectTool(puzzle.model.symbol);
    solveScramble(puzzle);
    assert.equal(puzzle.isSolved(), true);
  }
  assert.equal(puzzle.setCount(3), false);
  assert.equal(puzzle.setCount(7), false);
  assert.equal(puzzle.model.plateCount,6);
});

test('each solid plate has seven isolated circular holes with steel between them', () => {
  const geometry = createPlateBodyGeometry(THREE);
  const shape = geometry.parameters.shapes;
  assert.equal(shape.holes.length, 7, 'all drilled holes are independent');
  assert.ok(geometry.getAttribute('position').count > 100);
  for (let i = 0; i < PLATE_POSITIONS; i++) {
    const circle = shape.holes[i].curves[0];
    assert.ok(Math.abs(circle.aX-(i-3)*PLATE_HOLE_STEP) < 1e-8);
    assert.ok(Math.abs(circle.aY) < 1e-8);
    assert.ok(Math.abs(circle.xRadius - .085) < 1e-8);
    assert.ok(PLATE_HOLE_STEP > circle.xRadius * 2 + .10,
      'the round hole leaves a solid web to its neighbor');
  }
  geometry.dispose();
});

test('all five etched symbols can be rendered identically on plates and tools', () => {
  assert.deepEqual(PLATE_SYMBOLS.map(symbol=>symbol.name),
    ['Угол','Колено','Крючок','Черта','Волна'],
    'the original five tool marks are the only valid plate motifs');
  for (let i = 0; i < PLATE_SYMBOLS.length; i++) {
    assert.ok(PLATE_SYMBOLS[i].strokes.length > 0);
    assert.match(plateSymbolSvg(i), /<svg/);
    assert.match(plateSymbolSvg(i), /<polyline/);
  }
  assert.deepEqual(PLATE_SYMBOL_TO_WRENCH,[2,0,3,4,1]);
  assert.deepEqual(WRENCH_TO_PLATE_SYMBOL,[1,4,0,2,3]);
  assert.deepEqual(WRENCH_PICKER_ORDER,[4,2,0,3,1]);
  const html=readFileSync(new URL('../src/index.html',import.meta.url),'utf8');
  const pickerMarkup=html.match(/<section class="wrench-picker[\s\S]*?<\/section>/)?.[0]||'';
  const visibleOrder=[...pickerMarkup.matchAll(/data-wrench="(\d+)"/g)].map(match=>Number(match[1]));
  assert.deepEqual(visibleOrder,WRENCH_PICKER_ORDER,
    'the keyboard ordering must follow the actual five 3D buttons');
  for (let i = 0; i < 5; i++)
    assert.equal(WRENCH_TO_PLATE_SYMBOL[PLATE_SYMBOL_TO_WRENCH[i]],i);
});

test('plate assembly keeps six solid rows ready and clears the shackle balls in depth', () => {
  const root = new THREE.Group(), modeGroups = {}, puzzle = seededPuzzle(1548);
  const materials = Object.fromEntries(['dark','inner','edge','steel','brass','copper','chromed']
    .map(name => [name, new THREE.MeshStandardMaterial()]));
  const addMesh = (parent, geometry, material, position = [0,0,0]) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...position);parent.add(mesh);return mesh;
  };
  const registeredParts = [];
  const part = object => {registeredParts.push(object);return object;};
  const tag = (object, name) => {object.userData.partName=name;return object;};
  const box = (parent,w,h,d,x,y,z,material) =>
    addMesh(parent,new THREE.BoxGeometry(w,h,d),material,[x,y,z]);
  const cyl = (parent,r,h,x,y,z,material,axis='y',segments=24) => {
    const mesh=addMesh(parent,new THREE.CylinderGeometry(r,r,h,segments),material,[x,y,z]);
    if(axis==='x')mesh.rotation.z=Math.PI/2;
    if(axis==='z')mesh.rotation.x=Math.PI/2;
    return mesh;
  };
  const ring = (parent,r,tube,x,y,z,material) =>
    addMesh(parent,new THREE.TorusGeometry(r,tube,8,32),material,[x,y,z]);
  const pickRigTemplate = new THREE.Group();
  const pickMesh = addMesh(pickRigTemplate,new THREE.BoxGeometry(.8,.035,.035),materials.steel);
  const tensionModelsTemplate = Array.from({length:5}, (_,index) => {
    const rig = new THREE.Group();
    const wrenchMesh = addMesh(rig,new THREE.CylinderGeometry(.018,.018,.4,12),materials.steel);
    wrenchMesh.userData.wrenchIndex = index;
    return rig;
  });
  const pinHousingTemplate = new THREE.Group();
  pinHousingTemplate.scale.z = 1 / .7;
  const cylinderMesh = addMesh(pinHousingTemplate,
    new THREE.CylinderGeometry(.375,.375,2.23,32),materials.inner);
  const parentKeyway = new THREE.Group();
  parentKeyway.scale.z = 1 / .7;
  const keywayInsertTemplate = addMesh(parentKeyway,
    new THREE.CylinderGeometry(.284,.284,.335,48),materials.inner);
  const mechanism = buildPlateMechanism({THREE,root,modeGroups,
    raisedMechanism:.12,mat:materials,addMesh,part,tag,box,ring,model:puzzle.model,
    pickRigTemplate,tensionModelsTemplate,pinHousingTemplate,keywayInsertTemplate,
    coreCenterY:-.43,coreCenterZ:-.05});
  assert.equal(modeGroups.plate, mechanism.plateGroup);
  assert.equal(mechanism.plates.length, 6);
  assert.equal(mechanism.pins.length, 6);
  assert.equal(mechanism.symbolGroups.length, 6);
  assert.equal(mechanism.plateTensionModels.length, 5);
  assert.notEqual(mechanism.platePickRig,pickRigTemplate);
  assert.equal(mechanism.platePickRig.scale.x,pickRigTemplate.scale.x,
    'the pick keeps exactly the original pin-lock size');
  assert.equal(mechanism.plateTensionRig.scale.x,1,
    'all five original wrenches keep their full size');
  assert.ok(registeredParts.includes(mechanism.platePickRig) &&
    registeredParts.includes(mechanism.plateTensionRig),
  'both tools participate independently in the actual motion loop');
  assert.equal(mechanism.toolRig.position.z,-PLATE_FRONT_OFFSET_Z,
    'tool shafts are placed at the real side keyway, behind the front plates');
  assert.equal(mechanism.platePickRig.children[0].geometry,pickMesh.geometry,
    'the plate pick reuses the exact mesh of the pin pick');
  mechanism.plateTensionModels.forEach((rig,index) => {
    assert.notEqual(rig,tensionModelsTemplate[index]);
    assert.equal(rig.children[0].geometry,tensionModelsTemplate[index].children[0].geometry,
      'tension wrenches share the actual geometry and material between lock types');
  });
  assert.equal(mechanism.plateHousing.children[0].geometry,cylinderMesh.geometry,
    'the original pin cylinder housing is reused without any new custom detail');
  assert.equal(mechanism.plateKeywayInsert.geometry,keywayInsertTemplate.geometry,
    'the same pin-lock keyhole insert is used in the plate lock');
  assert.equal(mechanism.plateHousing.position.z,-PLATE_FRONT_OFFSET_Z);
  assert.equal(mechanism.plateKeywayRig.position.z,-.05-PLATE_FRONT_OFFSET_Z);
  assert.ok(mechanism.plates.every((plate,index) =>
    plate.plateMesh.geometry.type === 'ExtrudeGeometry' &&
    (plate.row.visible === (index < 4))));
  assert.ok(mechanism.plates.slice(0,4).every((plate,index) =>
    Math.abs(plate.row.position.y-plateRowY(index,4)) < 1e-8));
  assert.ok(PLATE_ROW_STEP > .37 && PLATE_ROW_STEP < .40,
    'the strips have a narrow positive vertical gap');
  assert.equal(mechanism.frame.scale.y,plateFrameScale(4));
  assert.ok(mechanism.symbolGroups.every(edges => edges.length === 2 &&
    edges.every(variants => variants.length === 5)));
  for (const [left,right] of mechanism.symbolGroups) {
    assert.ok(left.every((mark,index) => Math.abs(mark.scale.x+right[index].scale.x)<1e-8),
      'the right motif is an exact horizontal reflection of the left motif');
    assert.ok(left.every(mark => Math.abs(mark.scale.x)<.08),
      'each engraving is narrower than the original motif');
    assert.ok(left.every((mark,index) => mark.position.x===-right[index].position.x));
  }
  assert.ok(mechanism.pins.every(pin => pin.children.some(child =>
    child.geometry?.type === 'LatheGeometry')));
  assert.ok(mechanism.pins.every(pin => !pin.children.some(child =>
    child.geometry?.type === 'ConeGeometry' || child.geometry?.type === 'CylinderGeometry')),
  'the pegs are one continuous straight mesh, without any elbow');
  mechanism.plates.forEach(({row,pinMount},index) => {
    const shaft = mechanism.pins[index].userData.shaft;
    assert.equal(pinMount.parent,row, 'the rear carriage moves with its own plate row');
    assert.ok(pinMount.children.some(child => child.position.z < .13),
      'the mounting layer is recessed behind the drilled steel strip');
    assert.equal(pinMount.position.x,mechanism.pins[index].position.x);
    assert.equal(shaft.geometry.type,'LatheGeometry');
    shaft.geometry.computeBoundingBox();
    const size=new THREE.Vector3();
    shaft.geometry.boundingBox.getSize(size);
    assert.ok(size.z>.2 && size.x<.15 && Math.abs(size.x-size.y)<1e-6,
      'the peg is axial to the hole, presenting a circular face from the front');
    assert.equal(shaft.position.z,.043);
    assert.equal(shaft.scale.z,1);
  });
  const ballsFrontInRootZ = .355 + .137 / .70;
  const stripBackInRootZ = PLATE_FRONT_OFFSET_Z + .17;
  const stripFrontInRootZ = stripBackInRootZ + .09;
  const inspectionFaceInnerZ = .685 - .045 / 2;
  assert.ok(stripBackInRootZ > ballsFrontInRootZ + .01,
    'the plates sit just ahead of the shackle ball detents');
  assert.ok(stripFrontInRootZ < inspectionFaceInnerZ - .006,
    'all plate bodies fit inside the front inspection window');
  const rightPost = mechanism.frame.children.find(child => child.position.x > 1.5);
  assert.ok(rightPost.position.x - rightPost.geometry.parameters.width / 2 >
    1.395 + .137 + .04, 'the recessed support post clears the balls sideways');
  const lathe = mechanism.pins[0].children.find(child => child.geometry?.type === 'LatheGeometry');
  const pinFrontInRootZ = PLATE_FRONT_OFFSET_Z + lathe.position.z +
    lathe.geometry.boundingBox.max.z;
  assert.ok(pinFrontInRootZ > stripFrontInRootZ,
    'the circular peg cap sits just beyond the steel strip surface');
  assert.ok(pinFrontInRootZ < .685 + .045 / 2,
    'the rounded pin tip is held within the outer inspection face');
  assert.ok(lathe.geometry.parameters.points.at(-1).y -
    lathe.geometry.parameters.points.at(-3).y < .02,
  'the pin head ends in a shallow rounded cap, not a pointed spike');

  const bases = new Map();
  const setDynamicBase = (object,x,y,z) => {
    object.userData.dynamicBase = new THREE.Vector3(x,y,z);
    bases.set(object,object.userData.dynamicBase);
  };
  const update = createPlateMotion({...mechanism,setDynamicBase});
  puzzle.selectPlate(2);
  puzzle.selectTool(puzzle.model.symbol);
  update({D:(from,to)=>to});
  mechanism.pins.slice(0,4).forEach((pin,index) => assert.equal(pin.position.x,
    (puzzle.model.plates[index].position - 4) * PLATE_HOLE_STEP));
  assert.equal(mechanism.toolRig.visible,true);
  assert.equal(mechanism.plateTensionModels.filter(rig=>rig.visible).length,1);
  assert.equal(mechanism.plateTensionModels[PLATE_SYMBOL_TO_WRENCH[puzzle.model.symbol]].visible,true);
  assert.equal(bases.get(mechanism.platePickRig).x,
    -.53+(puzzle.model.plates[2].position-4)*PLATE_HOLE_STEP-.12,
    'matching pick travels through the real side keyway');
  assert.equal(bases.get(mechanism.platePickRig).y,-.43,
    'pick follows the cylinder axis, not the selected plate row');
  assert.equal(bases.get(mechanism.platePickRig).z,-.05);
  assert.equal(bases.get(mechanism.plateTensionRig).x,-1.52,
    'the full-size wrench remains seated near the keyway entrance');
  assert.equal(bases.get(mechanism.plateTensionRig).y,-.43-.235);
  assert.equal(mechanism.plates[2].indicator.visible,true);
  assert.equal(mechanism.plates[0].indicator.visible,false);

  const chosen = puzzle.model.plates[2];
  while(chosen.position !== PLATE_TARGET)
    puzzle.shift(Math.sign(PLATE_TARGET-chosen.position));
  update({D:(from,to)=>to});
  assert.equal(mechanism.pins[2].position.z,-.19,'peg retracts before shifting sideways');
  assert.equal(mechanism.plates[2].pinMount.position.z,0,
    'its rear supporting carriage stays behind the strip while the peg retracts');
  update({D:(from,to)=>to});
  assert.equal(mechanism.pins[2].position.x,0,'peg reaches the new isolated opening while hidden');
  assert.equal(mechanism.plates[2].pinMount.position.x,0,
    'the recessed carriage follows the selected opening');
  update({D:(from,to)=>to});
  assert.equal(mechanism.pins[2].position.z,0,'peg reappears through the correct hole');
  assert.equal(mechanism.pins[2].userData.solvedMark.visible,true);
  assert.equal(mechanism.pins[2].userData.shaft.scale.z,1.24,
    'a correctly aligned peg protrudes higher than before');
  const solvedFrontInRootZ=PLATE_FRONT_OFFSET_Z + lathe.position.z +
    lathe.geometry.boundingBox.max.z*mechanism.pins[2].userData.shaft.scale.z;
  assert.ok(solvedFrontInRootZ>pinFrontInRootZ);
  assert.ok(solvedFrontInRootZ<.74,
    'the raised circular head projects visibly beyond the inspection face');

  puzzle.selectTool((puzzle.model.symbol+1)%5);
  update({D:(from,to)=>to});
  assert.equal(bases.get(mechanism.platePickRig).x,-2.45,
    'mismatched pick returns outside the side keyway');
  assert.equal(bases.get(mechanism.plateTensionRig).x,-3.75,
    'mismatched tension wrench retracts along the same cylinder axis');
  assert.equal(mechanism.plateTensionModels[PLATE_SYMBOL_TO_WRENCH[puzzle.model.selectedTool]].visible,true);

  for (const count of [5,6]) {
    puzzle.setCount(count);puzzle.reset();
    update({D:(from,to)=>to});
    assert.equal(mechanism.plates.filter(plate=>plate.row.visible).length,count);
    assert.equal(bases.get(mechanism.plates[count-1].row).y,plateRowY(count-1,count));
    assert.equal(mechanism.frame.scale.y,plateFrameScale(count));
  }
});
