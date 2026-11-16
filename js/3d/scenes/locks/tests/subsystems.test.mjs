import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../src/vendor/three-core.js';
import { createHousingGeometries } from '../src/js/geometry/housing.js';
import { createOilCanPreview } from '../src/js/geometry/oil-can.js';
import { createOilTool } from '../src/js/tools/oil-tool.js';
import { createScenePointerInteractions } from '../src/js/ui/scene-pointer.js';
import { createBallLatch } from '../src/js/mechanisms/ball-latch.js';
import { createShacklePhysics } from '../src/js/physics/shackle.js';
import { createSymmetricShackleCurve, SHACKLE_RADIUS } from '../src/js/geometry/shackle.js';
import { attachLockControls } from '../src/js/ui/controls.js';
import { attachSettingsTabs } from '../src/js/ui/settings-tabs.js';
import { createWrenchPickerPreview } from '../src/js/ui/wrench-picker-preview.js';

const context = {
  save() {}, restore() {}, translate() {}, rotate() {}, scale() {},
  fillRect() {}, fill() {}, stroke() {}, beginPath() {}, closePath() {},
  moveTo() {}, lineTo() {}, bezierCurveTo() {}, quadraticCurveTo() {},
  ellipse() {},
  createRadialGradient: () => ({ addColorStop() {} }),
  createLinearGradient: () => ({ addColorStop() {} }),
};
const fakeDocument = {
  createElement: () => ({ width: 0, height: 0, getContext: () => context }),
  addEventListener() {},
};
globalThis.document = fakeDocument; // Texture factories use browser document.

function mesh(parent, geometry, material, position = [0, 0, 0]) {
  const object = new THREE.Mesh(geometry, material);
  object.position.set(...position);
  parent.add(object);
  return object;
}
function material(color = 0x777777, metalness = .7, roughness = .4) {
  return new THREE.MeshStandardMaterial({ color, metalness, roughness });
}
function cylinder(parent, radius, height, x, y, z, mat, axis = 'y', segments = 24) {
  const object = mesh(parent, new THREE.CylinderGeometry(radius, radius, height, segments), mat, [x, y, z]);
  if (axis === 'x') object.rotation.z = Math.PI / 2;
  if (axis === 'z') object.rotation.x = Math.PI / 2;
  return object;
}
function box(parent, width, height, depth, x, y, z, mat) {
  return mesh(parent, new THREE.BoxGeometry(width, height, depth), mat, [x, y, z]);
}
function seededRandom() {
  let seed = 97461;
  return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
}
function fakeEventTarget(bounds = { left: 0, top: 0, width: 800, height: 800, right: 800, bottom: 800 }) {
  const listeners = new Map();
  const target = {
    listeners,
    style: {},
    classList: { toggle() {} },
    getBoundingClientRect: () => bounds,
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(listener);
    },
    removeEventListener(type, listener) {
      const items = listeners.get(type);
      if (!items) return;
      const index = items.indexOf(listener);
      if (index >= 0) items.splice(index, 1);
    },
    emit(type, event = {}) {
      for (const listener of listeners.get(type) ?? []) listener(event);
    },
    click() { this.emit('click'); },
    setAttribute() {}, setPointerCapture() {}, hasPointerCapture: () => false,
  };
  return target;
}

test('extracted housing retains the bore openings and real threaded geometry', () => {
  const housing = createHousingGeometries({ THREE, depthRatio: .7 });
  const shell = housing.createSideShell();
  assert.deepEqual(shell.userData.bores.right, 2);
  assert.deepEqual(shell.userData.bores.left, 1);
  assert.ok(shell.userData.bores.removedFaces > 0);
  for (const geometry of [housing.createFrontBezel(), housing.createRearCover(),
    housing.createAnnularAxialGeometry(.3, .2, .1),
    housing.createKeywayPlugGeometry(.25, 1),
    housing.createScrewThreadGeometry(-1.39, .017, 12)]) {
    assert.ok(geometry.getAttribute('position').count > 100);
    for (const vertex of geometry.getAttribute('position').array) {
      assert.ok(Number.isFinite(vertex));
    }
    geometry.dispose();
  }
  shell.dispose();
});

test('rear cover has smooth matching corners with no lobes outside the housing shell', () => {
  const rear=createHousingGeometries({THREE,depthRatio:.70}).createRearCover();
  const vertices=rear.getAttribute('position');
  const halfW=3.72/2,halfH=2.86/2,cornerRadius=.175;
  const cornerStartX=halfW-cornerRadius,cornerStartY=halfH-cornerRadius;
  for(let i=0;i<vertices.count;i++){
    const x=Math.abs(vertices.getX(i)),y=Math.abs(vertices.getY(i));
    assert.ok(x<=halfW-.003 && y<=halfH-.003,
      'the rear plate remains inside the straight housing edges');
    // roundedRectPath uses a quadratic Bézier curve, whose corner is slightly
    // fuller than a circular arc. Compare against its *actual* XY boundary.
    const t=Math.sqrt(Math.max(0,Math.min(1,(halfW-x)/cornerRadius)));
    const shellY=halfH-cornerRadius*(1-t)**2;
    assert.ok(x<=cornerStartX || y<=cornerStartY || y<shellY-.002,
      `rear corner (${x.toFixed(3)}, ${y.toFixed(3)}) protrudes outside side shell`);
  }
  rear.computeBoundingBox();
  const {min,max}=rear.boundingBox;
  assert.ok(max.x-min.x>3.69 && max.y-min.y>2.83,
    'the cover retains the full rectangular shape and subtle bevel');
  assert.ok(Math.abs(min.z+.01)<1e-5 && Math.abs(max.z-.13)<1e-5,
    'the 0.14-deep cover meets the original back surface after positioning');
  assert.ok(vertices.count>300,'rounded XY corners have enough segments for a smooth silhouette');
  rear.dispose();
});

test('oil can builder creates a separate real Three.js preview scene', () => {
  const preview = createOilCanPreview({
    THREE, document: fakeDocument, rand: seededRandom(), material,
    addMesh: mesh, cyl: cylinder, box,
  });
  assert.equal(preview.oilPreviewScene.isScene, true);
  assert.equal(preview.oilPreviewCamera.isPerspectiveCamera, true);
  const panel=preview.oilPreviewScene.getObjectByName('oil-preview-panel');
  assert.ok(panel?.isMesh && panel.geometry.type==='ShapeGeometry',
    'oil can sits over one rounded panel in its own WebGL preview');
  assert.ok(panel.renderOrder<0 && panel.material.depthWrite===false,
    'the oil panel is always rendered behind the flask');
  let parts = 0;
  preview.oilPreviewCan.traverse(object => { if (object.isMesh) parts++; });
  assert.ok(parts > 40, `expected full flask geometry, got ${parts} meshes`);
  const leatherProfile=[[0,0],[.27,.02],[.39,.09],[.43,.21],[.445,.39],[.416,.57],
    [.374,.74],[.319,.94],[.265,1.095],[.231,1.19],[.215,1.27],[0,1.29]];
  const surfaceAt=y=>{
    const next=leatherProfile.findIndex(([r,height])=>height>=y);
    const [r0,y0]=leatherProfile[next-1],[r1,y1]=leatherProfile[next];
    return r0+(r1-r0)*(y-y0)/(y1-y0);
  };
  const hoops=[];
  preview.oilPreviewCan.traverse(object=>{
    if(object.name==='oil-leather-hoop')hoops.push(object);
  });
  assert.equal(hoops.length,4,'all leather reinforcing bands are distinct smooth hoops');
  for(const hoop of hoops){
    assert.ok(hoop.geometry.parameters.tubularSegments>=64,'metal bands need smooth circular edges');
    assert.ok(hoop.geometry.parameters.radius-hoop.geometry.parameters.tube>=surfaceAt(hoop.position.y),
      'metal ring inner edge must not disappear inside the leather');
  }
});

test('wrench picker reuses five original 3D geometries through one renderer viewport',()=>{
  const models=Array.from({length:5},(_,i)=>{
    const group=new THREE.Group();
    const shaft=mesh(group,new THREE.CylinderGeometry(.04,.03,2.7,12),material(0xa8a198));
    shaft.rotation.z=Math.PI/2;
    group.visible=i===2;
    return group;
  });
  const buttons=[4,2,0,3,1].map((index,i)=>{
    const button=fakeEventTarget({left:30+i*100,top:600,width:94,height:140,
      right:124+i*100,bottom:740});
    button.dataset={wrench:String(index)};
    button.classList={contains:name=>name==='active'&&index===2};
    return button;
  });
  const picker={querySelectorAll:()=>buttons,
    getBoundingClientRect:()=>({left:24,top:594,right:530,bottom:746,width:506,height:152})};
  const canvas={getBoundingClientRect:()=>({left:0,top:0,right:1440,bottom:900})};
  let renderCount=0,scissorCount=0,depthClearCount=0,colorClearCount=0,lastScissor;
  const renderer={autoClear:true,info:{render:{calls:5,triangles:321}},
    setClearColor(){colorClearCount++;},setScissor(...rect){scissorCount++;lastScissor=rect;},setViewport(){},
    setScissorTest(){},clear(){colorClearCount++;},clearDepth(){depthClearCount++;},
    render(){renderCount++;}};
  const tensionSpecs=Array.from({length:5},()=>({path:[[-3,-.7],[.1,0]]}));
  const previewWindow=fakeEventTarget();
  const liveGeometry=models[0].children[0].geometry;
  let liveGeometryDisposals=0;
  liveGeometry.addEventListener('dispose',()=>liveGeometryDisposals++);
  const preview=createWrenchPickerPreview({THREE,renderer,canvas,picker,
    tensionModels:models,tensionSpecs,window:previewWindow});
  assert.equal(preview.previewEntries.length,5);
  assert.equal(preview.previewScene.isScene,true);
  for(const {model} of preview.previewEntries){
    assert.equal(model.visible,true,'hidden live wrenches must remain visible in previews');
    const metal=model.children[0];
    assert.ok(models.some(source=>source.children[0].geometry===metal.geometry),
      'preview must share real mechanism geometry');
    assert.ok(models.every(source=>source.children[0].material!==metal.material),
      'hover finish must not tint actual lock tools');
  }
  preview.setRenderSize(1440,900);
  preview.updateWrenchPickerViewport();
  const panel=preview.previewScene.getObjectByName('wrench-picker-panel');
  assert.ok(panel?.isMesh,'one common rounded backdrop sits in the same WebGL preview');
  assert.equal(panel.geometry.type,'ShapeGeometry');
  assert.ok(panel.renderOrder<0,'the backdrop draws behind all five tools');
  assert.ok(panel.geometry.attributes.position.count>24,'the shared panel has rounded corners');
  panel.geometry.computeBoundingBox();
  assert.ok(Math.abs(panel.geometry.boundingBox.min.y+1.55)<1e-6 &&
    Math.abs(panel.geometry.boundingBox.max.y-1.55)<1e-6,
  'the rounded backdrop stays at the original button height while handles extend above it');
  for(const entry of preview.previewEntries){
    assert.equal(entry.tilt.rotation.y,0,'the preview must stay vertically upright');
    assert.ok(entry.tilt.rotation.z<-Math.PI/2,'each wrench is flipped upside-down');
    const span=new THREE.Vector3(3.1,.7+.085,0).applyEuler(entry.tilt.rotation);
    assert.ok(Math.abs(span.x)<1e-5,'the original shaft endpoints align vertically');
    const box=new THREE.Box3().setFromObject(entry.tilt);
    assert.ok(Math.abs((box.min.y+box.max.y)*.5+1.55-.38)<1e-5,
      'each resting wrench is raised within its button while its shaft stays mostly below the edge');
  }
  assert.deepEqual(preview.renderWrenchPickerPreview(),{calls:5,triangles:321},
    'one preview render reports all five tool draw calls');
  assert.equal(renderCount,1,'five tools use one shared WebGL preview render');
  assert.equal(depthClearCount,1,'the tool overlay clears only depth');
  assert.equal(colorClearCount,0,'the tool overlay preserves the background game scene');
  assert.ok(scissorCount>0);
  assert.ok(lastScissor[3]>152,'the scissor extends above the buttons for raised handles');
  assert.ok(preview.previewEntries[1].tilt.position.y-preview.previewEntries[1].baseY>
    preview.previewEntries[0].tilt.position.y-preview.previewEntries[0].baseY,
    'the selected wrench protrudes above an unselected one');
  buttons[0].emit('pointerenter');
  preview.renderWrenchPickerPreview();
  assert.ok(preview.previewEntries[0].tilt.position.y>preview.previewEntries[0].baseY,
    'hovering raises its 3D wrench independently of selection');
  preview.dispose();
  preview.dispose();
  assert.equal(liveGeometryDisposals,0,'removing thumbnails must not dispose live wrench geometry');
  assert.equal(previewWindow.listeners.get('resize')?.length,0);
  assert.ok(buttons.every(button=>['pointerenter','pointerleave','focus','blur']
    .every(type=>button.listeners.get(type)?.length===0)));
});

test('right panel switches Lock, Visual and Story settings without losing tab focus',()=>{
  const labels=['lock','visual','story'];
  const tabs=labels.map(name=>{
    const tab=fakeEventTarget();
    tab.dataset={settingsTab:name};
    tab.classList={selected:false,toggle(_class,selected){this.selected=selected;}};
    tab.focus=()=>{tab.focused=true;};
    tab.blur=()=>{tab.focused=false;tab.blurred=true;};
    return tab;
  });
  const pages=new Map([['settingsLock',{hidden:false}],['settingsVisual',{hidden:true}],
    ['settingsStory',{hidden:true}]]);
  const rail={scrollTop:450};
  const userActivations=[];
  const panel=attachSettingsTabs({document:{
    querySelectorAll:()=>tabs,getElementById:id=>pages.get(id),
  },rail,onUserActivate:name=>userActivations.push(name)});
  assert.equal(pages.get('settingsLock').hidden,false);
  tabs[1].emit('click',{detail:1});
  assert.equal(pages.get('settingsLock').hidden,true);
  assert.equal(pages.get('settingsVisual').hidden,false);
  assert.equal(tabs[1].classList.selected,true);
  assert.equal(rail.scrollTop,0);
  assert.equal(tabs[1].blurred,true,'mouse-selected tab releases arrow keys to the lock');
  tabs[1].emit('keydown',{code:'ArrowRight',preventDefault(){},stopPropagation(){}});
  assert.equal(pages.get('settingsStory').hidden,false);
  assert.equal(tabs[2].focused,true);
  tabs[1].click();
  tabs[1].emit('keydown',{code:'ArrowLeft',preventDefault(){},stopPropagation(){}});
  assert.equal(pages.get('settingsLock').hidden,false);
  assert.equal(tabs[0].focused,true);
  assert.deepEqual(userActivations,['visual','story','visual','lock']);
  panel.activate('visual');
  assert.equal(pages.get('settingsVisual').hidden,false);
  assert.equal(userActivations.length,4,
    'restoring a tab from game state must not trigger another user navigation');
});

test('scene pointer controller preserves pick clicks and drag cancellation', () => {
  const canvas = fakeEventTarget(), camera = new THREE.PerspectiveCamera(40, 1, .1, 20);
  camera.position.z = 5; camera.updateMatrixWorld();
  const pivot = new THREE.Group();
  const shackle = mesh(pivot, new THREE.BoxGeometry(1, 1, 1), material());
  shackle.userData.partName = 'Дужка';
  const actions = [];
  const tooltip = { style: {}, textContent: '' };
  const controller = createScenePointerInteractions({
    THREE, $: () => tooltip, canvas, camera, raycastables: [shackle],
    inspectionWindow: null, mat: { glass: { opacity: 1 } },
    plugSurface: null, plugSideReveal: { value: 0 },
    plugCutStart: { value: 0 }, plugCutEnd: { value: 0 },
    getPinPuzzle: () => null, getPinXs: () => [], pinStacks: [],
    state: { mode: 'pin' }, shacklePivot: pivot,
    dispatch: (command, meta) => actions.push({ command, meta }), status() {},
    window: { innerWidth: 1440, innerHeight: 900 },
  });
  const down = { clientX: 400, clientY: 400 };
  canvas.emit('pointerdown', down);
  canvas.emit('pointerup', down);
  assert.deepEqual(actions, [{ command: { type: 'open' }, meta: { source: 'scene' } }]);
  canvas.emit('pointerdown', down);
  controller.cancelPointerClick();
  canvas.emit('pointerup', down);
  assert.equal(actions.length, 1);
});

test('oil controller creates drops through one instanced GPU mesh and renders preview', () => {
  const scene = new THREE.Scene(), root = new THREE.Group();
  scene.add(root);
  const oilTarget = mesh(root, new THREE.BoxGeometry(1.6, 1.6, 1.6), material());
  const camera = new THREE.PerspectiveCamera(40, 1, .1, 20);
  camera.position.z = 5; camera.updateMatrixWorld();
  const canvas = fakeEventTarget();
  const oilButton = fakeEventTarget({ left: 24, top: 24, width: 80, height: 80,
    right: 104, bottom: 104 });
  const preview = createOilCanPreview({
    THREE, document: fakeDocument, rand: seededRandom(), material,
    addMesh: mesh, cyl: cylinder, box,
  });
  let previewRenderCount = 0;
  const renderer = {
    setScissor() {}, setViewport() {}, setScissorTest() {}, clearDepth() {},
    render() { previewRenderCount++; },
  };
  const tooltip = { style: {} };
  const tool = createOilTool({
    THREE, scene, root, canvas, camera, renderer, document: fakeDocument,
    window: { addEventListener() {} },
    $: () => oilButton, mat: { glass: { opacity: 1 } },
    pointer: new THREE.Vector2(), raycaster: new THREE.Raycaster(),
    isVisibleTree: () => true, inspectionWindow: null, plugSurface: null,
    plugSideReveal: { value: 0 }, plugCutStart: { value: 0 }, plugCutEnd: { value: 0 },
    rand: seededRandom(), updateRustMaterial() {}, status() {},
    tooltip, cancelPointerClick() {},
    oilPreviewScene: preview.oilPreviewScene,
    oilPreviewCamera: preview.oilPreviewCamera,
    oilPreviewCan: preview.oilPreviewCan,
  });
  tool.setRenderSize(800, 800);
  tool.updateOilPreviewViewport();
  tool.renderOilToolPreview(1234);
  assert.equal(previewRenderCount, 1);
  oilButton.emit('click');
  canvas.emit('pointerdown', {
    clientX: 400, clientY: 400, button: 0, metaKey: false, pointerId: 1,
    preventDefault() {}, stopImmediatePropagation() {},
  });
  tool.tickOil(.20);
  const drops = scene.children.filter(object => object.isInstancedMesh && object.userData.oilVisual);
  assert.equal(drops.length, 1);
  assert.ok(drops[0].count >= 1);
  assert.ok(oilTarget.children.some(object => object.userData.oilVisual));
  const oilCanMesh=preview.oilPreviewCan.children.find(object=>object.isMesh);
  let previewGeometryDisposals=0;
  oilCanMesh.geometry.addEventListener('dispose',()=>previewGeometryDisposals++);
  tool.dispose();
  tool.dispose();
  assert.equal(scene.children.some(object=>object.isInstancedMesh&&object.userData.oilVisual),false,
    'disposing the tool removes its drop batch');
  assert.equal(oilTarget.children.some(object=>object.userData.oilVisual),false,
    'old wet spots and oil runs detach from lock parts');
  assert.equal(previewGeometryDisposals,1,'preview-only oil can geometry is disposed once');
  assert.equal(oilButton.listeners.get('click')?.length,0,'oil button listeners are removed');
});

test('ball latch retains captive motion without floating half-cylinder frames', () => {
  const root = new THREE.Group(), parts = [];
  const latch = createBallLatch({
    THREE, depthRatio: .70, root,
    addMesh: mesh,
    mat: { inner: material(), chromed: material() },
    tag(object) { return object; },
    part(object) { parts.push(object); return object; },
    parts,
    setDynamicBase(object, x, y, z) {
      object.userData.dynamicBase ??= new THREE.Vector3();
      object.userData.dynamicBase.set(x, y, z);
    },
  });
  const balls = root.children.filter(group => group.children.some(c => c.geometry?.type === 'SphereGeometry'));
  assert.equal(balls.length, 2);
  assert.equal(root.children.length, 2, 'there are no empty guide groups beside the balls');
  assert.ok(root.children.every(group => group.children.every(mesh =>
    mesh.geometry?.type !== 'CylinderGeometry')), 'the misleading half-bore is removed');
  latch.updateLockingBalls(1);
  assert.ok(balls.every(group => Math.abs(group.userData.dynamicBase.y) > .75));
  latch.restoreLockingBalls();
  assert.ok(balls.every(group => Math.abs(Math.abs(group.position.y) - .64) < 1e-8));
});

test('released shackle falls with substeps and can be restored', () => {
  const pivot = new THREE.Group();
  const curve = createSymmetricShackleCurve(THREE);
  let ballsRestored = 0;
  const physics = createShacklePhysics({
    THREE, shackleCurve: curve, shacklePivot: pivot,
    restoreLockingBalls: () => ballsRestored++,
  });
  physics.restoreShackle();
  assert.equal(ballsRestored, 1);
  assert.equal(physics.shackleBody.released, false);
  physics.releaseShackle(new THREE.Vector3(1.52, -.64, .025), -.15);
  const initialY = physics.shackleBody.position.y;
  assert.ok(physics.shackleBody.velocity.y < -.6, 'shackle begins a firm downward fall');
  assert.ok(Math.abs(physics.shackleBody.angularVelocity.x) > .4,
    'U-shaped steel bar tumbles out of its original vertical plane');
  let touchedTable = false, maxUpwardSpeed = 0;
  const centerOfMass = new THREE.Vector3(.50, .64, 0);
  const contacts=curve.getPoints(40).map(point => point.sub(centerOfMass));
  for (let i = 0; i < 180; i++) {
    physics.stepShacklePhysics(.016);
    if (i < 55 && !touchedTable) {
      const lowest=Math.min(...contacts.map(point =>
        point.clone().applyQuaternion(physics.shackleBody.quaternion).y+
        physics.shackleBody.position.y-SHACKLE_RADIUS));
      touchedTable = lowest < -2.115;
    }
    if (touchedTable) maxUpwardSpeed = Math.max(maxUpwardSpeed,physics.shackleBody.velocity.y);
  }
  assert.equal(touchedTable, true, 'the bar reaches the tabletop within 0.9 seconds');
  assert.ok(maxUpwardSpeed < .4, 'heavy steel has little upward rebound after impact');
  assert.equal(physics.shackleBody.sleeping, true, 'the bar settles without endless rattling');
  assert.equal(physics.shackleBody.velocity.lengthSq(), 0, 'the settled bar stays at rest');
  assert.ok(physics.shackleBody.position.y < initialY);
  for (const value of [...physics.shackleBody.position, ...physics.shackleBody.angularVelocity]) {
    assert.ok(Number.isFinite(value));
  }
  physics.restoreShackle();
  assert.equal(physics.shackleBody.released, false);
  assert.equal(physics.shackleBody.velocity.lengthSq(), 0);
  assert.equal(ballsRestored, 2);
});

test('the released shackle promptly tips over after its first tabletop impact', () => {
  for (const dt of [.016, .033, .04]) {
    const pivot = new THREE.Group();
    const physics = createShacklePhysics({
      THREE, shackleCurve: createSymmetricShackleCurve(THREE), shacklePivot: pivot,
      restoreLockingBalls() {},
    });
    physics.restoreShackle();
    // The animator releases near this world position and swing angle.
    physics.releaseShackle(new THREE.Vector3(2.38, -.72, .025), -.38);
    let timeToSide = null, timeToRest = null;
    for (let frame = 1; frame <= Math.ceil(2.5 / dt); frame++) {
      physics.stepShacklePhysics(dt);
      const elapsed = frame * dt;
      const roll = new THREE.Euler().setFromQuaternion(physics.shackleBody.quaternion).x;
      if (timeToSide === null && Math.abs(roll) > 1.35) timeToSide = elapsed;
      if (physics.shackleBody.sleeping) { timeToRest = elapsed; break; }
    }
    assert.ok(timeToSide !== null && timeToSide < 1.05,
      `the bar should lie on its side within about one second at dt=${dt}; got ${timeToSide}`);
    assert.ok(timeToRest !== null && timeToRest < 2.15,
      `the bar should settle promptly at dt=${dt}; got ${timeToRest}`);
  }
});

test('HTML controls and physical keys emit the same semantic commands', () => {
  const nodes = new Map();
  const $ = id => {
    if (!nodes.has(id)) nodes.set(id, fakeEventTarget());
    return nodes.get(id);
  };
  const modeButtons = ['pin', 'disc', 'code'].map(mode => Object.assign(fakeEventTarget(), { dataset: { mode } }));
  const levelButtons = [1, 2, 3].map(level => Object.assign(fakeEventTarget(), { dataset: { level: String(level) } }));
  const wrench = Object.assign(fakeEventTarget(), { dataset: { wrench: '1' } });
  const swatch = Object.assign(fakeEventTarget(), { dataset: { color: 'bronze' }, title: 'Бронза' });
  const finish = Object.assign(fakeEventTarget(), { dataset: { finish: '2' } });
  const groups = {
    '#modeButtons button': modeButtons,
    '#pinPuzzleLevels button': levelButtons,
    '#wrenchPicker .wrench-choice': [wrench],
    '#swatches .swatch': [swatch],
    '#pinFinishSwatches .pin-finish': [finish],
  };
  const keyHandlers = [];
  const document = {
    querySelectorAll: selector => groups[selector] ?? [],
    querySelector: () => levelButtons[0],
    addEventListener(type, callback) { if (type === 'keydown') keyHandlers.push(callback); },
  };
  const calls = [];
  const state = {
    mode: 'pin', picking: false, wrong: false, insertTarget: 0, turnTarget: 0,
    unlockTarget: 0, insertP: 0, turnP: 0, unlockP: 0, pinSetCount: 0,
    pickTargetX: -.3, pinWobble: 0, explodeTarget: 0, transparency: 1,
    autoXray: false, finish: 'titanium',
  };
  let pinPuzzle = null;
  attachLockControls({
    THREE, $, document, state,
    getPinPuzzle: () => pinPuzzle,
    dispatch: (command, meta) => calls.push({ command, meta }),
  });
  modeButtons[1].click();
  assert.deepEqual(calls.at(-1), { command: { type: 'mode', mode: 'disc' }, meta: { source: 'ui' } });
  $('pinPuzzleSelect').value = 'classic';
  let modeDropdownBlurred=false;
  $('pinPuzzleSelect').emit('change', { target: { value: 'classic',
    blur() { modeDropdownBlurred=true; } } });
  assert.deepEqual(calls.at(-1).command, { type: 'puzzle-start', puzzle: 'classic', level: 1 });
  assert.equal(modeDropdownBlurred,true,'mode selection restores gameplay keyboard focus');
  levelButtons[2].click();
  assert.deepEqual(calls.at(-1).command, { type: 'puzzle-start', puzzle: 'classic', level: 3 });
  $('pinPuzzleSelect').value = 'free';
  levelButtons[1].click();
  assert.deepEqual(calls.at(-1).command, { type: 'puzzle-start', puzzle: 'free', level: 2 });
  $('insertButton').click();
  assert.deepEqual(calls.at(-1).command, { type: 'insert-toggle' });
  $('toolButton').click();
  assert.deepEqual(calls.at(-1).command, { type: 'tool-toggle' });
  wrench.click();
  assert.deepEqual(calls.at(-1).command, { type: 'wrench', index: 1 });
  pinPuzzle = null;
  state.insertTarget = 1;
  state.picking = true;
  keyHandlers[0]({ code: 'KeyD', repeat: false, preventDefault() {} });
  assert.deepEqual(calls.at(-1), { command: { type: 'pick-step', delta: 1 },
    meta: { source: 'keyboard' } });
  const originalCallCount = calls.length;
  let prevented = false;
  keyHandlers[0]({ code:'KeyR', ctrlKey:true, preventDefault(){ prevented = true; } });
  assert.equal(prevented,false, 'Ctrl+R must reach the browser');
  keyHandlers[0]({ code:'KeyN', metaKey:true, preventDefault(){ prevented = true; } });
  assert.equal(prevented,false, 'Cmd+N must reach the browser');
  assert.equal(calls.length,originalCallCount,'system shortcuts dispatch no game commands');
  swatch.click();
  assert.deepEqual(calls.at(-1).command, { type: 'case-finish', color: 'bronze' });
  finish.click();
  assert.deepEqual(calls.at(-1).command, { type: 'pin-finish', index: 2 });
  $('oilToolButton').click();
  assert.deepEqual(calls.at(-1).command, { type: 'oil-tool-toggle' });
});
