import test from 'node:test';
import assert from 'node:assert/strict';
import {TARGET_CUTS,CUT_LEVELS,PIN_ORDER,SLOT_TYPES,ASSEMBLY_STEPS,applyFilingStroke,
  assistedFilingStroke,inspectKey,checkSocket,inspectAssembly,stepComplete,
  firstIncompleteStep,detachPart,MAX_CUT,BREAK_CUT,DIFFICULTIES,
  cameraPointerAction,generateBlueprint,cutLayout,keyProfileSegments,KEY_BOTTOM_Y,KEY_TOP_Y,
  keyTopOutline,targetGuideSegments,keyHighlightPolygon,filingContactAt,keyTopAtX,
  cutIndexAtX,keyPickIndexAt,KEY_PICK_MIN_Y,KEY_PICK_MAX_Y,showKeyTargetGuide,
  BLADE_LEFT,BLADE_RIGHT,TIP_START_X,TIP_TOP_Y,TIP_BOTTOM_Y,
  CUT_TOLERANCE,cutTolerance} from '../public/js/logic.js';
import * as THREE from '../public/vendor/three-core.js';
import {createMetalShavings,FILE_BODY_SCALE,FILE_STEEL_CENTER_X,FILE_STEEL_LENGTH,
  FILE_STEEL_HEEL_X,FILE_STEEL_HEIGHT,FILE_STEEL_WIDTH,
  FILE_MAX_STROKE,FILE_CONTACT_CLEARANCE,fileWorkingAnchor,
  FILE_KEYROOT_Z,
  FILE_CONTACT_DEPTH_FRONT,FILE_CONTACT_DEPTH_BACK,
  fileStoppedAtContour,fileTouchesContour,fileAxialStrokePixels,
  createFileSteelGeometry,createFileHandleGeometry,
  FILE_CAMERA_POSITION,FILE_CAMERA_TARGET} from '../public/js/filing-effects.js';
import {createKeyBladeGeometry,keyBladeGrooveRidges,keyBladeFaceZ,
  keyBladeRecessAt,keyBladeBottomAt,KEY_BLADE_DEPTH,KEY_BLADE_OFFSET_Z} from '../public/js/key-blade.js';
import {zoneSurfaceSamples,createZoneFaceGeometry,
  createZoneRimGeometry,createZoneOutlineGeometry,
  zoneHighlightOpacity,dirtyCutZoneIndices} from '../public/js/key-zone-highlight.js';
import {createKeyBowShape} from '../public/js/key-bow.js';
import {keyImprintContours,createKeyImprintBoard,paintKeyBlueprint} from '../public/js/key-imprint-board.js';
import {createSoapImpression,soapImprintContours} from '../public/js/soap-imprint.js';
import {manualIllustration} from '../public/js/manual.js';
import {emptyWearProfile,applyWearToOutline,machinedTopAtX,
  inspectMachinedKey,splitMachinedOutlineAt,
  WEAR_STEP} from '../public/js/key-wear.js';
import {describeKeyInspection} from '../public/js/key-inspection.js';

function coversFacePoint(geometry,x,y,z=.085){
  const g=geometry.index?geometry.toNonIndexed():geometry;
  const p=g.getAttribute('position');
  const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  for(let i=0;i<p.count;i+=3){
    if(z!==null&&[0,1,2].some(j=>Math.abs(p.getZ(i+j)-z)>1e-5))continue;
    const triangle=[0,1,2].map(j=>[p.getX(i+j),p.getY(i+j)]);
    const weights=[0,1,2].map(j=>cross(triangle[j],triangle[(j+1)%3],[x,y]));
    if(weights.every(v=>v>=-1e-7)||weights.every(v=>v<=1e-7))return true;
  }
  return false;
}

test('plain left drag orbits, Shift pans, and tool targets keep their click', () => {
  assert.equal(cameraPointerAction(), 'orbit');
  assert.equal(cameraPointerAction({toolTarget:true}), 'tool');
  assert.equal(cameraPointerAction({toolTarget:true,shiftKey:true}), 'pan');
  assert.equal(cameraPointerAction({toolTarget:true,metaKey:true}), 'orbit');
  assert.equal(cameraPointerAction({toolTarget:true,ctrlKey:true,shiftKey:true}), 'pan');
});

test('middle of the steel files while the forward half extends behind the key',()=>{
  const contactX=fileWorkingAnchor()+FILE_STEEL_CENTER_X*FILE_BODY_SCALE;
  assert.ok(Math.abs(contactX)<1e-12,'the middle of the abrasive steel meets the cursor');
  const nose=fileWorkingAnchor()+(FILE_STEEL_CENTER_X+FILE_STEEL_LENGTH/2)*FILE_BODY_SCALE;
  const ferruleEnd=fileWorkingAnchor()+(FILE_STEEL_CENTER_X-FILE_STEEL_LENGTH/2)*FILE_BODY_SCALE;
  assert.ok(nose>.65&&ferruleEnd<-.65,'the working point is well inside the metal shaft');
  const filePose=new THREE.Euler(.06,1.35,.20);
  const noseZ=new THREE.Vector3(nose,0,0).applyEuler(filePose).z;
  const ferruleZ=new THREE.Vector3(ferruleEnd,0,0).applyEuler(filePose).z;
  assert.ok(noseZ<-.6&&ferruleZ>.6,
    'the front half recedes behind the key and the handle stays near the viewer');
  assert.ok(FILE_CONTACT_DEPTH_FRONT<0&&FILE_CONTACT_DEPTH_BACK>.10,
    'contact is behind the visible face from either camera side');
  const angle=1.2;
  const x=contactX*Math.cos(angle),z=-contactX*Math.sin(angle);
  assert.ok(Math.hypot(x,z)<1e-12,'turning the handle must not move the contact');
  assert.ok(FILE_MAX_STROKE<cutLayout(8)[0].hitWidth,
    'a file stroke stays within a single narrow-tooth working zone');
  assert.ok(FILE_STEEL_LENGTH<2.1,'the steel file has a visibly shorter blade');
  assert.ok(Math.abs(FILE_STEEL_CENTER_X-FILE_STEEL_LENGTH/2-FILE_STEEL_HEEL_X)<1e-12);
});

test('metal file physically stops on the actual machined edge from below',()=>{
  const layout=cutLayout(6),cuts=[0,.10,.22,.04,0,0],wear=emptyWearProfile();
  const x=layout[2].center,edge=machinedTopAtX(cuts,layout,wear,x);
  const pressedPosition=edge-.2,freePosition=edge+.5;
  assert.equal(fileStoppedAtContour(pressedPosition,edge),edge+FILE_CONTACT_CLEARANCE);
  assert.equal(fileStoppedAtContour(freePosition,edge),freePosition);
  assert.ok(fileTouchesContour(pressedPosition,edge));
  assert.equal(fileTouchesContour(freePosition,edge),false,
    'pulling the file away from the brass immediately stops cutting');
  assert.equal(fileStoppedAtContour(.5,null),.5);
  assert.equal(fileTouchesContour(.5,null),false);
  // The contact must follow the CURRENT cut, not its original guide.
  cuts[2]=.35;
  const deeper=machinedTopAtX(cuts,layout,wear,x);
  assert.ok(deeper<edge);
  assert.equal(fileStoppedAtContour(deeper-.1,deeper),deeper+FILE_CONTACT_CLEARANCE);
});

test('mouse movement files only along the projected shaft, and reverses naturally',()=>{
  assert.ok(Math.abs(fileAxialStrokePixels(12,16,3,4)-20)<1e-10);
  assert.ok(Math.abs(fileAxialStrokePixels(16,-12,3,4))<1e-10,
    'sideways pointer motion repositions the tool without filing');
  assert.ok(Math.abs(fileAxialStrokePixels(-12,-16,3,4)+20)<1e-10,
    'the return stroke works in the opposite direction');
  assert.equal(fileAxialStrokePixels(8,12,0,0),0);
  assert.ok(FILE_MAX_STROKE<.25,'filing stays localized to the selected notch');
});

test('steel file tapers and the smooth wooden handle is one connected solid',()=>{
  const steel=createFileSteelGeometry(THREE);
  steel.computeBoundingBox();
  assert.ok(FILE_STEEL_HEIGHT*FILE_BODY_SCALE<cutLayout(8)[0].flat*2*.5,
    'metal face is narrower than the tightest 8-tooth cutting channel');
  assert.ok(FILE_STEEL_WIDTH*FILE_BODY_SCALE<cutLayout(8)[0].flat*2*.5);
  assert.ok(steel.boundingBox.max.y-steel.boundingBox.min.y<=FILE_STEEL_HEIGHT+.00001);
  assert.ok(steel.boundingBox.max.z-steel.boundingBox.min.z<=FILE_STEEL_WIDTH+.00001);
  const positions=steel.getAttribute('position');
  function thicknessAt(x){
    let thickness=0;
    for(let i=0;i<positions.count;i++)
      if(Math.abs(positions.getX(i)-x)<.001)
        thickness=Math.max(thickness,Math.abs(positions.getY(i))*2);
    return thickness;
  }
  assert.ok(thicknessAt(FILE_STEEL_LENGTH/2)<thicknessAt(0),
    'the nose narrows rather than ending in an oversized rectangular block');
  assert.ok(thicknessAt(-FILE_STEEL_LENGTH/2)>0,'steel extends into the handle ferrule');
  assert.ok(FILE_STEEL_HEEL_X<-2.69&&FILE_STEEL_HEEL_X>-2.87,
    'the shortened blade overlaps the existing ferrule without a gap');
  assert.ok(Array.from(positions.array).every(Number.isFinite));
  const handle=createFileHandleGeometry(THREE);
  handle.computeBoundingBox();
  assert.ok(handle.getAttribute('position').count>100,
    'a turned wooden handle must have a smooth curved profile');
  assert.ok(handle.boundingBox.max.x<.18&&handle.boundingBox.min.x>-.18,
    'grip must be naturally slender, not a giant wooden box');
  assert.ok(Math.abs(handle.boundingBox.min.y+.54)<.001);
  assert.ok(Math.abs(handle.boundingBox.max.y-.51)<.001);
  assert.ok(Array.from(handle.getAttribute('position').array).every(Number.isFinite));
  steel.dispose();handle.dispose();
});

test('key camera opens in the requested close three-quarter perspective',()=>{
  const camera=new THREE.PerspectiveCamera(40,1900/1358,.04,100);
  camera.position.set(...FILE_CAMERA_POSITION);
  camera.lookAt(...FILE_CAMERA_TARGET);
  camera.updateMatrixWorld();camera.updateProjectionMatrix();
  const screen=(x)=>{
    const point=new THREE.Vector3(-.856+.35*x,.409,FILE_CAMERA_TARGET[2]).project(camera);
    return {x:(point.x+1)*950,y:(1-point.y)*679};
  };
  const bow=screen(-2.2),tip=screen(2.2);
  assert.ok(bow.x>200&&bow.x<480&&bow.y>610&&bow.y<760);
  assert.ok(tip.x>1120&&tip.x<1360&&tip.y>410&&tip.y<560);
  assert.ok(tip.x-bow.x>750&&bow.y-tip.y>150,
    'the blade rises diagonally toward the right as in the reference');
});

test('vise and blueprint board almost touch the workshop wall without clipping',()=>{
  const wallFront=-3.60;
  const viseRearLocal=-.23-1.42/2;
  const viseRear=FILE_KEYROOT_Z+.70*viseRearLocal;
  assert.ok(viseRear-wallFront>.04,
    'the vise must not intersect the back wall');
  assert.ok(viseRear-wallFront<.20,
    'the vise must sit almost against the wall');
  assert.ok(Math.abs(FILE_CAMERA_POSITION[2]-FILE_CAMERA_TARGET[2]-2.30)<1e-10,
    'the shift preserves the working distance of the camera');
});

test('inverted blank fixes the smooth side in the jaws and exposes teeth below',()=>{
  const blankHomeY=1.355,scale=.5;
  const originalJawLevel=blankHomeY+KEY_BOTTOM_Y*scale;
  const invertedHomeY=blankHomeY+KEY_BOTTOM_Y;
  const invertedJawLevel=invertedHomeY-KEY_BOTTOM_Y*scale;
  const invertedToothLevel=invertedHomeY-KEY_TOP_Y*scale;
  assert.ok(Math.abs(originalJawLevel-invertedJawLevel)<1e-10,
    'the uncut smooth edge must remain held at the original vise height');
  assert.ok(invertedToothLevel<invertedJawLevel-.2,
    'the cutting edge hangs visibly below the vise');
  const contactY=invertedHomeY-(KEY_TOP_Y+.07)*scale;
  assert.ok(contactY<invertedToothLevel,
    'the metal file approaches the newly exposed edge from below');
});

test('selected teeth highlight both broad faces and upper and lower thin edges',()=>{
  for(const count of [4,6,8]){
    const cuts=Array(count).fill(0),layout=cutLayout(count),index=1;
    const samples=zoneSurfaceSamples(cuts,layout,index);
    assert.ok(samples.length>=13);
    assert.ok(samples[0].x<samples.at(-1).x);
    assert.ok(samples.every(p=>p.top>=p.bottom));
    const face=createZoneFaceGeometry(THREE,cuts,layout,index);
    const rim=createZoneRimGeometry(THREE,cuts,layout,index);
    const outline=createZoneOutlineGeometry(THREE,cuts,layout,index);
    const positions=rim.getAttribute('position');
    const z=Array.from({length:positions.count},(_,i)=>positions.getZ(i));
    const y=Array.from({length:positions.count},(_,i)=>positions.getY(i));
    assert.ok(face.getAttribute('position').count>0);
    assert.ok(z.some(v=>v<KEY_BLADE_OFFSET_Z));
    assert.ok(z.some(v=>v>KEY_BLADE_OFFSET_Z+KEY_BLADE_DEPTH),
      'the selected band crosses the complete 3D key thickness');
    assert.ok(y.some(v=>Math.abs(v-KEY_BOTTOM_Y)<1e-6));
    assert.ok(y.some(v=>Math.abs(v-(KEY_TOP_Y+.006))<1e-6),
      'top cap clears the brass surface to avoid z-fighting artifacts');
    const outlinePositions=outline.getAttribute('position');
    assert.ok(outlinePositions.count>=samples.length*8,
      'the outline runs along both long edges on both sides of the blade');
    assert.ok(Array.from({length:outlinePositions.count},(_,i)=>
      outlinePositions.getZ(i)).some(v=>v<KEY_BLADE_OFFSET_Z),
      'the boundaries are also visible from the back');
    for(const geometry of [face,rim,outline]){
      assert.ok(Array.from(geometry.getAttribute('position').array).every(Number.isFinite));
      geometry.dispose();
    }
  }
});

test('only the active tooth is highlighted and its top cap matches every corner',()=>{
  for(const count of [4,6,8]){
    const active=2;
    const highlighted=Array.from({length:count},(_,index)=>
      zoneHighlightOpacity(index,active,true));
    assert.equal(highlighted.filter(value=>value>0).length,1);
    assert.equal(highlighted[active],.43);
    assert.equal(zoneHighlightOpacity(active,active,false),.27);
    assert.equal(zoneHighlightOpacity(active,active,true,false),0);
    const cuts=Array(count).fill(0);cuts[active]=.17;
    const layout=cutLayout(count),zone=layout[active];
    const samples=zoneSurfaceSamples(cuts,layout,active);
    const original=keyTopOutline(cuts,layout);
    const corners=original.map(pair=>pair[0]).filter(x=>
      x>samples[0].x+1e-7&&x<samples.at(-1).x-1e-7);
    assert.ok(corners.length>=3);
    for(const x of corners)
      assert.ok(samples.some(sample=>Math.abs(sample.x-x)<1e-7),
        `highlight must pass exactly through the real tooth corner ${x}`);
  }
});

test('geometry rebuilding is limited to changed tooth zones',()=>{
  assert.deepEqual(dirtyCutZoneIndices([],['0.000','0.000','0.000']),[0,1,2]);
  assert.deepEqual(dirtyCutZoneIndices(['0.000','0.000','0.000'],
    ['0.000','0.120','0.000']),[1]);
  assert.deepEqual(dirtyCutZoneIndices(['0.000','0.120','0.000'],
    ['0.000','0.120','0.000']),[]);
  assert.deepEqual(dirtyCutZoneIndices(['0.000','0.120'],
    ['0.000','0.120'],true),[0,1]);
});

test('highlight edge follows the actual cut and saved wear contour',()=>{
  const layout=cutLayout(6),cuts=Array(6).fill(0);
  const index=2,center=layout[index].center;
  const before=zoneSurfaceSamples(cuts,layout,index);
  const wear=emptyWearProfile();
  wear[Math.round((center-BLADE_LEFT)/WEAR_STEP)]=.12;
  const after=zoneSurfaceSamples(cuts,layout,index,wear);
  const closest=(arr)=>arr.reduce((best,p)=>
    Math.abs(p.x-center)<Math.abs(best.x-center)?p:best);
  assert.ok(closest(after).top<closest(before).top-.02,
    'the rim tracks an irregular saved contour instead of floating over it');
});

test('existing saved wear remains visible and can still split a damaged key',()=>{
  const layout=cutLayout(4),cuts=Array(4).fill(0),wear=emptyWearProfile();
  wear[Math.round(.15/WEAR_STEP)]=.56;
  const inspected=inspectMachinedKey(cuts,Array(4).fill(0),layout,wear);
  assert.ok(inspected.fractureX!==null);
  assert.equal(inspected.accurate,false);
  const outline=applyWearToOutline(keyProfileSegments(cuts,layout)[0],wear);
  const [left,right]=splitMachinedOutlineAt(outline,inspected.fractureX);
  assert.ok(left.at(-1)[0]<right[0][0]);
  for(const segment of [left,right]){
    const geometry=createKeyBladeGeometry(THREE,segment);
    assert.ok(geometry.getAttribute('position').count>0);
    geometry.dispose();
  }
});

test('filing removes metal, is deterministic and cannot exceed the blank', () => {
  assert.equal(applyFilingStroke(0, 0), 0);
  assert.ok(applyFilingStroke(0, 100) > 0);
  assert.equal(applyFilingStroke(0.3, 1000), MAX_CUT);
  assert.equal(applyFilingStroke(0.1, -10), 0.1);
});

test('key inspection distinguishes shallow, correct and overcut teeth', () => {
  assert.equal(inspectKey([0,0,0,0]).accurate, false);
  assert.equal(inspectKey(TARGET_CUTS).accurate, true);
  const wrong=[...TARGET_CUTS];wrong[1]+=.06;
  assert.equal(inspectKey(wrong).overshot, true);
  assert.equal(inspectKey(wrong).accurate, false);
});

test('each tooth uses the same strict six-percent tolerance in every key check',()=>{
  assert.equal(CUT_TOLERANCE,.06);
  for(const target of CUT_LEVELS){
    assert.ok(Math.abs(cutTolerance(target)/target-.06)<1e-10);
    assert.equal(inspectKey([target*1.05],[target]).accurate,true);
    assert.equal(inspectKey([target*.95],[target]).accurate,true);
    assert.equal(inspectKey([target*1.07],[target]).accurate,false);
    assert.equal(inspectKey([target*1.07],[target]).overshot,true);
    assert.equal(inspectKey([target*.93],[target]).accurate,false);
  }
});

test('manual key inspection always explains whether the imprint matches',()=>{
  const good=describeKeyInspection(inspectKey(TARGET_CUTS),TARGET_CUTS,'soap');
  assert.equal(good.ok,true);
  assert.match(good.message,/слепку.*ключ подходит/i);

  const blank=describeKeyInspection(inspectKey(TARGET_CUTS.map(()=>0)),TARGET_CUTS,'soap');
  assert.equal(blank.ok,false);
  assert.ok(blank.tooth>=0);
  assert.match(blank.message,/недостаточно глубокий/i);

  // A small undercut is now outside the stricter six-percent limit.
  const shallow=[...TARGET_CUTS];shallow[1]-=.025;
  assert.equal(inspectKey(shallow).overshot,false);
  const shallowVerdict=describeKeyInspection(inspectKey(shallow),TARGET_CUTS,'soap');
  assert.equal(shallowVerdict.tooth,1);
  assert.match(shallowVerdict.message,/зубец 2 ещё недостаточно глубокий/i);

  // A shallow tooth has the same percentage tolerance as a deep one.
  const deep=[...TARGET_CUTS];deep[1]+=.025;
  assert.equal(inspectKey(deep).overshot,true);
  const deepVerdict=describeKeyInspection(inspectKey(deep),TARGET_CUTS,'imprint');
  assert.equal(deepVerdict.tooth,1);
  assert.match(deepVerdict.message,/по схеме.*зубец 2 пропилен слишком глубоко/i);

  const gouge=describeKeyInspection({
    ...inspectKey(TARGET_CUTS),accurate:false,extraOvercut:true
  },TARGET_CUTS,'soap');
  assert.match(gouge.message,/за пределами профиля/i);
});

test('95% files precisely to the line but further sawing can cut all the way through', () => {
  assert.equal(assistedFilingStroke(.18,50,.19),.19);
  assert.equal(assistedFilingStroke(.19,1000,.19),MAX_CUT);
  const broken=[...TARGET_CUTS];broken[2]=BREAK_CUT;
  assert.equal(inspectKey(broken).brokenAt,2);
  assert.equal(inspectKey(broken).accurate,false);
  assert.equal(inspectKey(TARGET_CUTS.map(v=>v-.01)).score,100);
  assert.equal(inspectKey(TARGET_CUTS.map(v=>v-.005)).accurate,false);
});

test('4, 6 and 8 cuts fit the same blade and use progressively narrower hit zones',()=>{
  assert.deepEqual(DIFFICULTIES,[4,6,8]);
  const widths=DIFFICULTIES.map(n=>{
    const layout=cutLayout(n);
    assert.equal(layout.length,n);
    assert.ok(layout[0].center-layout[0].ramp>-1.4);
    assert.ok(layout.at(-1).center+layout.at(-1).ramp<2.18);
    return layout[0].hitWidth;
  });
  assert.ok(widths[0]>widths[1]&&widths[1]>widths[2]);
});

test('a through-cut splits the blade into two separately meshed valid pieces',()=>{
  for(const count of DIFFICULTIES){
    const cuts=Array(count).fill(.1);cuts[Math.floor(count/2)]=BREAK_CUT;
    const segments=keyProfileSegments(cuts,cutLayout(count),Math.floor(count/2));
    assert.equal(segments.length,2);
    assert.ok(segments[0].at(-1)[0]<segments[1][0][0]);
    for(const points of segments){
      const geometry=createKeyBladeGeometry(THREE,points);
      const positions=geometry.getAttribute('position');
      assert.ok(positions.count>0);
      assert.ok(Array.from(positions.array).every(Number.isFinite));
      geometry.dispose();
    }
  }
});

test('deep filing never restores the removed brass surface',()=>{
  for(const count of DIFFICULTIES){
    const layout=cutLayout(count),index=Math.floor(count/2);
    const center=layout[index].center;
    for(const cutDepth of [0,.35,.48,.50,.54,.549,BREAK_CUT]){
      const cuts=Array(count).fill(0);cuts[index]=cutDepth;
      const broken=cutDepth>=BREAK_CUT?index:-1;
      const sections=keyProfileSegments(cuts,layout,broken);
      const retained=createKeyBladeGeometry(THREE,sections[0]);
      const coordinates=retained.getAttribute('position').array;
      assert.ok(coordinates.length>0&&Array.from(coordinates).every(Number.isFinite));
      assert.ok(Array.from(retained.getAttribute('normal').array).every(Number.isFinite));
      assert.equal(coversFacePoint(retained,center,KEY_BOTTOM_Y+.31),
        cutDepth===0,`depth ${cutDepth} must not fill the cut at its old height`);
      if(cutDepth<.51)
        assert.ok(coversFacePoint(retained,center,KEY_BOTTOM_Y+.03),
          `depth ${cutDepth} should preserve the metal below the cut`);
      retained.dispose();
      if(broken>=0){
        assert.equal(sections.length,2);
        const fragment=createKeyBladeGeometry(THREE,sections[1],
          layout[index].center+layout[index].flat);
        assert.ok(fragment.getAttribute('position').count>0);
        assert.ok(Array.from(fragment.getAttribute('position').array).every(Number.isFinite));
        fragment.dispose();
      }
    }
  }
});

test('machined blade stays watertight with several near-through notches',()=>{
  for(const count of DIFFICULTIES){
    const layout=cutLayout(count),cuts=layout.map((_,i)=>[.12,.50,.26,.54][i%4]);
    const mesh=new THREE.Mesh(createKeyBladeGeometry(THREE,
      keyProfileSegments(cuts,layout)[0]),
      new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
    const ray=new THREE.Raycaster();
    for(const cut of layout){
      const x=cut.center,top=keyTopAtX(cuts,layout,x),bottom=keyBladeBottomAt(x);
      for(const [y,expected] of [[top+.018,false],[(top+bottom)*.5,true],[bottom-.018,false]]){
        ray.set(new THREE.Vector3(x,y,1),new THREE.Vector3(0,0,-1));
        assert.equal(ray.intersectObject(mesh).length>=2,expected,
          `wrong metal occupancy: ${count} slots, x=${x}, y=${y}`);
      }
    }
    mesh.geometry.dispose();mesh.material.dispose();
  }
});

test('the round key bow and its opening are concentric and symmetric',()=>{
  const shape=createKeyBowShape(THREE);
  const geometry=new THREE.ShapeGeometry(shape);
  assert.equal(shape.holes.length,1);
  const centerX=-2.12,centerY=(.17+KEY_BOTTOM_Y)/2;
  assert.equal(coversFacePoint(geometry,centerX,centerY,null),false);
  for(const [dx,dy] of [[.29,0],[-.29,0],[0,.29],[0,-.29]])
    assert.ok(coversFacePoint(geometry,centerX+dx,centerY+dy,null));
  assert.equal(coversFacePoint(geometry,centerX-.51,centerY,null),false);
  assert.ok(coversFacePoint(geometry,BLADE_LEFT-.01,.01,null));
  geometry.dispose();
});

test('the blank has a short pointed nose after the last cutting zone',()=>{
  for(const count of DIFFICULTIES){
    const outline=keyTopOutline(Array(count).fill(0),cutLayout(count));
    assert.deepEqual(outline.at(-2),[TIP_START_X,.17]);
    assert.deepEqual(outline.at(-1),[BLADE_RIGHT,TIP_TOP_Y]);
    assert.ok(TIP_BOTTOM_Y<TIP_TOP_Y);
    assert.ok(outline.at(-3)[0]<TIP_START_X);
  }
});

test('the cursor maps precisely to the nearest of 4, 6 or 8 teeth',()=>{
  for(const count of DIFFICULTIES){
    const layout=cutLayout(count);
    for(let i=0;i<count;i++)assert.equal(cutIndexAtX(layout[i].center,layout),i);
    for(let i=0;i<count-1;i++){
      const boundary=(layout[i].center+layout[i+1].center)*.5;
      assert.equal(cutIndexAtX(boundary-.001,layout),i);
      assert.equal(cutIndexAtX(boundary+.001,layout),i+1);
    }
    assert.equal(cutIndexAtX(BLADE_LEFT-.2,layout),-1);
  }
});

test('hover targeting reaches above and below the key without crossing tooth boundaries',()=>{
  assert.ok(KEY_PICK_MIN_Y<KEY_BOTTOM_Y-.5);
  assert.ok(KEY_PICK_MAX_Y>KEY_TOP_Y+.9);
  for(const count of DIFFICULTIES){
    const layout=cutLayout(count);
    for(let i=0;i<count;i++){
      const x=layout[i].center;
      for(const y of [KEY_PICK_MIN_Y,KEY_BOTTOM_Y,KEY_TOP_Y,KEY_PICK_MAX_Y]){
        assert.equal(keyPickIndexAt(x,y,layout),i,`tooth ${i+1} at y=${y}`);
      }
      assert.equal(keyPickIndexAt(x,KEY_PICK_MIN_Y-.001,layout),-1);
      assert.equal(keyPickIndexAt(x,KEY_PICK_MAX_Y+.001,layout),-1);
    }
    for(let i=0;i<count-1;i++){
      const boundary=(layout[i].center+layout[i+1].center)*.5;
      assert.equal(keyPickIndexAt(boundary-.001,KEY_PICK_MAX_Y,layout),i);
      assert.equal(keyPickIndexAt(boundary+.001,KEY_PICK_MIN_Y,layout),i+1);
    }
    assert.equal(keyPickIndexAt(BLADE_LEFT-.2,0,layout),-1);
    assert.equal(keyPickIndexAt(layout[0].center,Number.NaN,layout),-1);
  }
});

test('free filing contacts the tooth under the file only near its cutting edge',()=>{
  for(const count of DIFFICULTIES){
    const layout=cutLayout(count),cuts=Array(count).fill(.11);
    for(let i=0;i<count;i++){
      const x=layout[i].center,y=keyTopAtX(cuts,layout,x);
      assert.equal(filingContactAt(x,y+.1,cuts,layout),i);
      assert.equal(filingContactAt(x,y-.26,cuts,layout),-1);
      assert.equal(filingContactAt(x,y+.30,cuts,layout),-1);
    }
    assert.equal(filingContactAt(BLADE_RIGHT+.3,0,cuts,layout),-1);
  }
});

test('two 3D-milled channels recess both faces all the way to the key tip',()=>{
  const mesh=new THREE.Mesh(createKeyBladeGeometry(THREE,
    keyProfileSegments(Array(4).fill(0),cutLayout(4))[0]),
    new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
  const ray=new THREE.Raycaster();
  for(const x of [0,TIP_START_X+.12,BLADE_RIGHT-.01]){
    const ridges=keyBladeGrooveRidges(x);
    assert.equal(ridges.length,8);
    for(const pair of [0,4]){
      const y=(ridges[pair+1][0]+ridges[pair+2][0])*.5;
      assert.ok(y<keyTopAtX(Array(4).fill(0),cutLayout(4),x));
      assert.ok(y>keyBladeBottomAt(x));
      assert.ok(keyBladeRecessAt(x,y)>0);
      ray.set(new THREE.Vector3(x,y,.5),new THREE.Vector3(0,0,-1));
      const hits=ray.intersectObject(mesh);
      assert.ok(hits.length>=2,`both 3D faces must exist at x=${x},y=${y}`);
      assert.ok(Math.abs(hits[0].point.z-(keyBladeFaceZ(x,y)-KEY_BLADE_OFFSET_Z))<.002);
      assert.ok(Math.abs(hits[1].point.z-(keyBladeFaceZ(x,y,'back')-KEY_BLADE_OFFSET_Z))<.002);
      assert.ok(hits[0].point.z<KEY_BLADE_DEPTH-.006);
      assert.ok(hits[1].point.z>.006);
    }
  }
  const tipRidges=keyBladeGrooveRidges(BLADE_RIGHT);
  assert.deepEqual(keyBladeGrooveRidges(TIP_START_X),tipRidges,
    'grooves remain perfectly straight rather than bending toward the tip');
  assert.ok(tipRidges[0][0]>TIP_BOTTOM_Y);
  assert.ok(tipRidges.at(-1)[0]<TIP_TOP_Y);
  mesh.geometry.dispose();mesh.material.dispose();
});

test('the target guide stays on the brass and disappears across overfiled gaps',()=>{
  const layout=cutLayout(4),targets=[...TARGET_CUTS];
  const untouched=targetGuideSegments([0,0,0,0],targets,layout);
  assert.equal(untouched.length,keyTopOutline(targets,layout).length-1);
  const cuts=[0,targets[1]+.18,0,0];
  const clipped=targetGuideSegments(cuts,targets,layout);
  assert.ok(clipped.length<untouched.length);
  const actual=keyTopOutline(cuts,layout);
  function metalTopAt(x){
    for(let i=1;i<actual.length;i++){
      const [x0,y0]=actual[i-1],[x1,y1]=actual[i];
      if(x>=x0-1e-8&&x<=x1+1e-8)return y0+(y1-y0)*((x-x0)/(x1-x0));
    }
    throw new Error(`Guide point outside key at x=${x}`);
  }
  for(const [start,end] of clipped)for(const [x,y] of [start,end])
    assert.ok(y<=metalTopAt(x)+1e-6,`Guide floats above metal at x=${x}`);
});

test('the hovered cutting zone matches the remaining key silhouette',()=>{
  for(const count of DIFFICULTIES){
    const layout=cutLayout(count),cuts=Array(count).fill(0);
    cuts[1]=.40;
    const outline=keyHighlightPolygon(cuts,layout,1);
    assert.ok(outline.length>=6);
    const min=layout[1].center-layout[1].hitWidth*.5;
    const max=layout[1].center+layout[1].hitWidth*.5;
    for(const [x,y] of outline){
      assert.ok(x>=min-1e-8&&x<=max+1e-8);
      assert.ok(y>=KEY_BOTTOM_Y-1e-8&&y<=.17+1e-8);
    }
  }
});

test('filings settle on the tabletop and remain visible after further strokes',()=>{
  const tableY=-1.25;
  const root=new THREE.Group(),filings=createMetalShavings(THREE,root,{tableY});
  assert.equal(root.children.length,1);
  const mesh=root.children[0];
  assert.ok(mesh.isInstancedMesh);
  assert.equal(mesh.count,0);
  for(let i=0;i<40;i++)filings.emit(new THREE.Vector3(0,.5,.2),.8,.5);
  assert.ok(mesh.count>0);
  for(let i=0;i<120;i++)filings.update(.05);
  const before=new THREE.Matrix4(),after=new THREE.Matrix4();
  mesh.getMatrixAt(0,before);
  const settledY=new THREE.Vector3().setFromMatrixPosition(before).y;
  assert.ok(Math.abs(settledY-(tableY+.005))<1e-5,
    'the first flake rests exactly above the bench surface');
  for(let i=0;i<180;i++)filings.update(.05);
  filings.emit(new THREE.Vector3(.3,.45,.25),.7,.4);
  mesh.getMatrixAt(0,after);
  assert.deepEqual(Array.from(after.elements),Array.from(before.elements),
    'old flakes do not fade away or move when the player keeps filing');
  filings.clear();assert.equal(mesh.count,0);
  filings.dispose();assert.equal(root.children.length,0);
});

test('each new blank changes its profile and keeps a four-pin training code',()=>{
  for(const difficulty of DIFFICULTIES){
    const first=generateBlueprint(difficulty,'',()=>0);
    const second=generateBlueprint(difficulty,first.signature,()=>0);
    assert.equal(first.targets.length,difficulty);
    assert.equal(first.pinOrder.length,4);
    assert.notEqual(first.signature,second.signature);
    const installed={};
    for(let i=0;i<4;i++){
      installed[`pin-${i}`]=`pin-${first.pinOrder[i]}`;
      installed[`spring-${i}`]=`spring-${i}`;
    }
    for(const id of ['core-0','gear-0','gear-1','cam-0','cover-0'])installed[id]=id;
    assert.equal(inspectAssembly(installed,first.targets,first.targets,first.pinOrder).success,true);
  }
});

test('only matching socket families are accepted', () => {
  assert.equal(checkSocket('pin-3','pin-0'), true);
  assert.equal(checkSocket('pin-3','spring-0'), false);
  assert.equal(checkSocket('gear-0','gear-1'), false);
  assert.equal(checkSocket('cam-0','cam-0'), true);
  assert.equal(checkSocket('core-0','cover-0'), false);
});

test('assembly requires every part, correct pin order, and filed key', () => {
  const placed={};
  for (let i=0;i<4;i++) {placed[`pin-${i}`]=`pin-${PIN_ORDER[i]}`;placed[`spring-${i}`]=`spring-${i}`;}
  for(const id of ['core-0','gear-0','gear-1','cam-0','cover-0'])placed[id]=id;
  assert.equal(SLOT_TYPES.length,13);
  assert.equal(ASSEMBLY_STEPS.length,5);
  assert.equal(inspectAssembly(placed,TARGET_CUTS).success,true);
  const swapped={...placed,'pin-0':'pin-0'};
  assert.deepEqual(inspectAssembly(swapped,TARGET_CUTS).wrongPins,[0]);
  assert.equal(inspectAssembly(placed,[0,0,0,0]).success,false);
  delete placed['gear-0'];
  assert.equal(inspectAssembly(placed,TARGET_CUTS).complete,false);
  assert.equal(stepComplete(0,placed),true);
  assert.equal(firstIncompleteStep(placed),3);
});

test('removing an installed piece leaves the rest of the build intact', () => {
  const placed={'core-0':'core-0','pin-0':'pin-3','spring-0':'spring-1'};
  const next=detachPart(placed,'spring-1');
  assert.equal(next['spring-0'],undefined);
  assert.equal(next['pin-0'],'pin-3');
  assert.equal(next['core-0'],'core-0');
  assert.equal(placed['spring-0'],'spring-1');
  assert.equal(firstIncompleteStep(next),1);
});

test('imprint mode draws a complete independent key silhouette on its board',()=>{
  const targets=[.05,.12,.19,.26];
  const contours=keyImprintContours(THREE,targets);
  assert.equal(contours.length,2,'one continuous outside edge and one keyring hole');
  assert.ok(contours[0].length>60);
  assert.deepEqual(contours[0].at(0),contours[0].at(-1),'the silhouette is closed');
  assert.ok(contours[0].some(([x,y])=>x===TIP_START_X&&y===KEY_BOTTOM_Y),
    'the bottom stays horizontal until the taper at the end');
  assert.ok(contours[0].some(([x,y])=>x===BLADE_RIGHT&&y===TIP_BOTTOM_Y),
    'the key tip retains its full bottom edge');
  assert.equal(contours[1].length,65);
  const parent=new THREE.Group(),board=createKeyImprintBoard(THREE,parent);
  assert.equal(board.group.visible,false);
  board.setBlueprint(targets);
  assert.equal(board.group.children.length,7);
  assert.ok(board.group.position.z<-.7,'the imprint is farther behind the vise');
  const clearance=FILE_KEYROOT_Z+.7*(board.group.position.z-.03)-(-3.6);
  assert.ok(clearance>0&&clearance<.05,
    'the drawing backplate must be fixed almost flush to the rear wall');
  let soap=board.group.getObjectByName('soap-key-impression');
  board.setDisplayMode('imprint');
  assert.equal(board.group.visible,true);
  assert.equal(board.group.children[1].visible,true,'the blueprint sheet is visible');
  assert.equal(soap.visible,false);
  board.setDisplayMode('soap');
  assert.equal(board.group.children[1].visible,false);
  assert.equal(soap.visible,true,'soap replaces the printed reference');
  board.setOrientation('bottom');
  assert.ok(board.group.children[1].scale.y<0);
  assert.ok(soap.scale.y<0);
  board.setBlueprint([.12,.19,.05,.26]);
  soap=board.group.getObjectByName('soap-key-impression');
  assert.ok(soap.scale.y<0,
    'a fresh blank preserves the orientation of its reference sample');
  board.setOrientation('top');
  assert.ok(board.group.children[1].scale.y>0);
  assert.ok(soap.scale.y>0);
  board.setDisplayMode('guided');
  assert.equal(board.group.visible,false);
  board.dispose();
  assert.equal(parent.children.length,0);
});

test('soap has a physical recessed key-shaped cavity, with a raised ring-hole island',()=>{
  const targets=[.05,.12,.19,.26];
  const soap=createSoapImpression(THREE,targets);
  soap.group.updateMatrixWorld(true);
  const ray=new THREE.Raycaster();
  function topAt(x,y){
    ray.set(new THREE.Vector3(x,y,1),new THREE.Vector3(0,0,-1));
    return ray.intersectObject(soap.group,true).find(hit=>hit.object.isMesh)?.point.z;
  }
  assert.ok(Math.abs(topAt(0,.36)-soap.topZ)<1e-5,'unpressed soap is full height');
  assert.ok(Math.abs(topAt(0,0)-soap.floorZ)<1e-5,
    'the key blade reaches the bottom of the cavity, not a painted decal');
  const hole=soapImprintContours(THREE,targets)[1];
  const hx=(Math.min(...hole.map(p=>p[0]))+Math.max(...hole.map(p=>p[0])))/2;
  const hy=(Math.min(...hole.map(p=>p[1]))+Math.max(...hole.map(p=>p[1])))/2;
  assert.ok(Math.abs(topAt(hx,hy)-soap.topZ)<1e-5,
    'the circular hole in the key leaves a raised pillar of soap');
  soap.dispose();
  for(const count of [4,6,8]){
    const impression=soapImprintContours(THREE,Array(count).fill(.12));
    assert.equal(impression.length,2);
    assert.ok(impression[0].length>60);
  }
});

test('imprint uses soft pencil strokes on a navy blueprint, fully inside its page',()=>{
  const strokes=[];let fillCount=0;
  const context={canvas:{width:2048,height:704},
    createLinearGradient:()=>({addColorStop:()=>{}}),
    fillRect:()=>{fillCount++;},beginPath:()=>{},moveTo:(x,y)=>{strokes.push([x,y]);},
    lineTo:(x,y)=>{strokes.push([x,y]);},stroke:()=>{}};
  paintKeyBlueprint(context,THREE,[.05,.12,.19,.26]);
  assert.ok(fillCount>3500,'blue paper carries fixed drawing grain');
  assert.ok(strokes.length>1000,'pencil linework samples the curve closely');
  const contour=keyImprintContours(THREE,[.05,.12,.19,.26]).flat();
  const xs=contour.map(p=>p[0]),ys=contour.map(p=>p[1]);
  const scale=Math.min((2048-260)/(Math.max(...xs)-Math.min(...xs)),
    (704-225)/(Math.max(...ys)-Math.min(...ys)));
  const projected=contour.map(([x,y])=>[
    (x-(Math.max(...xs)+Math.min(...xs))/2)*scale+1024,
    ((Math.max(...ys)+Math.min(...ys))/2-y)*scale+352]);
  assert.ok(projected.every(([x,y])=>x>120&&x<1928&&y>105&&y<599),
    'the full bottom and top of the key have comfortable page margins');
});

test('imprint never reveals target guides after a filing stroke or mode change',()=>{
  assert.equal(showKeyTargetGuide('imprint',true),false);
  assert.equal(showKeyTargetGuide('imprint',false),false);
  assert.equal(showKeyTargetGuide('soap',true),false);
  assert.equal(showKeyTargetGuide('soap',false),false);
  assert.equal(showKeyTargetGuide('guided',true),true);
  assert.equal(showKeyTargetGuide('guided',false),false);
});

test('one white assembly sheet projects all mechanical contours from 3D',()=>{
  const svg=manualIllustration([2,0,3,1]);
  assert.ok(svg.includes('viewBox="0 0 560 310"'));
  assert.ok(svg.includes('01 / 01'));
  assert.ok(svg.includes('13 ДЕТАЛЕЙ'));
  assert.ok((svg.match(/M\d/g)||[]).length>150);
  for(const roman of ['I','II','III','IV'])assert.ok(svg.includes(`>${roman}</text>`));
  assert.ok(!svg.includes('NaN'));
  assert.notEqual(svg,manualIllustration([0,1,2,3]));
});
