import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import * as THREE from '../vendor/three.js';
import { HOUSE_DEFAULTS, HOUSE_SCHEMA_VERSION, normalizeHouseConfig, getHouseDimensions, createHouseBlueprint, maxFrontWindows, maxSideWindows } from '../js/buildings/house-config.js';
import { windowLayout } from '../js/buildings/house-layout.js';
import { createHouseModel, gableRoofProfile, housePolygonCount, roofSurfaceUV } from '../js/buildings/house-model.js';

const defaults=normalizeHouseConfig({});
assert.deepEqual(defaults, HOUSE_DEFAULTS,'Defaults must be usable as-is');
assert.deepEqual(normalizeHouseConfig({floors:99,width:2,roofType:'unknown',roofColor:'green'}),{
  ...HOUSE_DEFAULTS,floors:4,width:6,
});
assert.equal(normalizeHouseConfig({frontWindows:'3'}).frontWindows,3);
assert.equal(normalizeHouseConfig({frontWindows:-100}).frontWindows,1);
assert.equal(normalizeHouseConfig({plasterColor:'#ABCDEF'}).plasterColor,'#abcdef');
assert.equal(normalizeHouseConfig({floors:'invalid'}).floors,HOUSE_DEFAULTS.floors);
assert.equal(normalizeHouseConfig({damageAmount:150}).damageAmount,100);
assert.equal(normalizeHouseConfig({damageAmount:-10}).damageAmount,0);
assert.equal(normalizeHouseConfig({damageScale:9}).damageScale,5);
assert.equal(normalizeHouseConfig({damageScale:4.9}).damageScale,4.9);
assert.equal(normalizeHouseConfig({plasterDamage:true}).plasterDamage,true);

assert.equal(maxFrontWindows(6,true),3);
assert.equal(maxFrontWindows(8,true),3);
assert.equal(maxFrontWindows(10,true),5);
assert.equal(maxSideWindows(5,true),2);

for(const width of [6,8,10,12]) {
  for(const depth of [5,6.5,10]) {
    for(const shutters of [true,false]) {
      for(const floors of [1,2,4]) {
        for(const balcony of [true,false]) {
          const c=normalizeHouseConfig({width,depth,shutters,floors,balcony,frontWindows:5,sideWindows:4});
          const layout=windowLayout(c);
          assert.ok(c.frontWindows<=maxFrontWindows(width,shutters));
          assert.ok(c.sideWindows<=maxSideWindows(depth,shutters));
          for(let floor=0;floor<floors;floor++) {
            const windows=layout.front.filter(w=>w.floor===floor).sort((a,b)=>a.x-b.x);
            const centerOccupied=floor===0||(floor===1&&balcony);
            const expected=c.frontWindows - (centerOccupied && c.frontWindows%2===1 ? 1 : 0);
            assert.equal(windows.length,expected,'Entrance/balcony must replace their bay');
            for(let i=0;i<windows.length;i++) {
              const w=windows[i];
              const envelope=shutters?w.width*.89:w.width/2+.17;
              assert.ok(Math.abs(w.x)+envelope<c.width/2-.15,'Window and shutters must fit inside facade');
              if(centerOccupied)assert.ok(Math.abs(w.x)-envelope>.91,'Windows must clear the entrance and balcony doors');
              if(i>0){
                const previous=windows[i-1];
                const previousEnvelope=shutters?previous.width*.89:previous.width/2+.17;
                assert.ok(w.x-envelope-(previous.x+previousEnvelope)>.12,'Neighbor windows must not crowd');
              }
            }
          }
          assert.equal(layout.sides.length,c.sideWindows*floors);
          assert.equal(layout.totalWindows,layout.front.length+2*layout.sides.length);
          for(const w of layout.sides) assert.ok(Math.abs(w.z)+w.width/2<=c.depth/2,'Window must fit inside side wall');
          const firstSideRow=layout.sides.filter(w=>w.floor===0).sort((a,b)=>a.z-b.z);
          for(let i=1;i<firstSideRow.length;i++){
            const a=firstSideRow[i-1], b=firstSideRow[i];
            const envelopeA=shutters?a.width*.89:a.width/2+.17;
            const envelopeB=shutters?b.width*.89:b.width/2+.17;
            assert.ok(b.z-a.z-envelopeA-envelopeB>.13,'Side windows must keep visible spacing');
          }
        }
      }
    }
  }
}

for(const width of [6,8,12]) for(const roofHeight of [.7,2.4,4]) {
  const top=7.37;
  const {span,ridgeY,edgeY}=gableRoofProfile({width,roofHeight},top);
  const wallX=width/2;
  const roofAtWall=ridgeY + (edgeY-ridgeY)*wallX/span;
  assert.ok(Math.abs(roofAtWall-top)<1e-9,'Sloping roof must touch the wall at the eave');
  assert.equal(ridgeY,top+roofHeight);
}

const html=await readFile(new URL('../house-builder/index.html',import.meta.url),'utf8');
assert.ok(html.indexOf('aria-labelledby="roof-title"')<html.indexOf('aria-labelledby="dimensions-title"'),'Roof settings should come first');
for(const id of ['fpsValue','polygonValue','plasterDamage','damageAmount','damageScale']) {
  assert.ok(html.includes(`id="${id}"`),`House builder must expose ${id}`);
}
assert.ok(html.includes('name="damageScale" type="range" min=".6" max="5"'), 'Damage scaling slider must reach five times');
for(const file of ['gouache-plaster.webp','gouache-roof-tiles.webp','gouache-plaster-chipped.webp']) {
  const texture=await stat(new URL(`../assets/house-textures/${file}`,import.meta.url));
  assert.ok(texture.size>3000,'Painted textures should be saved with the builder');
}

assert.ok(getHouseDimensions({floors:4}).totalHeight>getHouseDimensions({floors:1}).totalHeight);
assert.equal(getHouseDimensions({roofType:'flat'}).roof,.3);
const payload=createHouseBlueprint({floors:3,chimney:false});
assert.equal(payload.schema,'keynlock.house');
assert.equal(payload.version,HOUSE_SCHEMA_VERSION);
assert.equal(payload.params.floors,3);
assert.equal(payload.params.chimney,false);
assert.equal(roofSurfaceUV([4,7,2],'side',3,.5)[0],.52);
assert.equal(roofSurfaceUV([4,7,2],'end',3,.5)[0],1.04);
assert.equal(roofSurfaceUV([4,7,2],'end',3,.5)[1],2);

// Model generation smoke tests don't need WebGL. All 3 roof types and option
// combinations must produce valid triangle geometry that can be rebuilt.
const model=createHouseModel(THREE,HOUSE_DEFAULTS);
assert.ok(model.group.children.length>20);
for(const roofType of ['gable','hip','flat']) {
  for(const floors of [1,4]) {
    const config={...HOUSE_DEFAULTS,roofType,floors,frontWindows:5,sideWindows:4,balcony:true,timberFrame:true};
    const metrics=model.update(config);
    assert.equal(metrics.windows,windowLayout(config).totalWindows);
    let triangles=0,meshes=0;
    model.group.traverse(child=>{
      if(!child.isMesh)return;
      meshes++;
      const geometry=child.geometry;
      const positions=geometry.getAttribute('position');
      assert.ok(positions?.count>0,'Every mesh has geometry');
      assert.ok(geometry.boundingSphere===null||Number.isFinite(geometry.boundingSphere.radius));
      triangles+=(geometry.index ? geometry.index.count : positions.count)/3;
      if(child.userData.roofSurface){
        const normals=geometry.getAttribute('normal');
        const uv=geometry.getAttribute('uv');
        for(let i=0;i<normals.count;i++) assert.ok(normals.getY(i)>.55,'All pitched roof faces must point outward and upward');
        for(let i=0;i<positions.count;i+=3){
          const u0=uv.getX(i),v0=uv.getY(i),u1=uv.getX(i+1),v1=uv.getY(i+1),u2=uv.getX(i+2),v2=uv.getY(i+2);
          assert.ok(Math.abs((u1-u0)*(v2-v0)-(u2-u0)*(v1-v0))>.001,'Roof UV cannot collapse or stretch into a point');
        }
      }
    });
    assert.ok(meshes>80,`Generated house needs actual components (${roofType}, ${floors})`);
    assert.ok(Number.isFinite(triangles)&&triangles>0);
    assert.equal(metrics.polygons,Math.round(triangles));
    assert.equal(metrics.polygons,housePolygonCount(model.group));
  }
}
const clean=model.update({...HOUSE_DEFAULTS,plasterDamage:false});
assert.equal(model.group.children.filter(child=>child.userData.plasterDamage).length,0);
const worn=model.update({...HOUSE_DEFAULTS,plasterDamage:true,damageAmount:100,damageScale:1.8});
const damageMeshes=model.group.children.filter(child=>child.userData.plasterDamage);
assert.ok(damageMeshes.length>=16);
for(const decal of damageMeshes) {
  assert.equal(decal.material.transparent,false,'Plaster cutouts must not switch transparent draw order on rotation');
  assert.equal(decal.material.depthWrite,true,'Damage patches must use the depth buffer');
  assert.ok(decal.material.alphaTest>0,'Empty decal pixels must be discarded');
  assert.equal(decal.material.side,THREE.FrontSide,'Plaster decals only face outward');
}
assert.ok(worn.polygons>clean.polygons,'Damaged plaster must contribute actual decal geometry');
const normalPatch=model.group.children.find(child=>child.userData.plasterDamage);
const normalWidth=normalPatch.geometry.parameters.width;
model.update({...HOUSE_DEFAULTS,plasterDamage:true,damageAmount:100,damageScale:5});
const giantPatch=model.group.children.find(child=>child.userData.plasterDamage);
assert.ok(giantPatch.geometry.parameters.width>normalWidth,'×5 creates larger damage patches');
model.update({...HOUSE_DEFAULTS,plasterDamage:true,damageAmount:0});
assert.equal(model.group.children.filter(child=>child.userData.plasterDamage).length,0);

// Close-range regressions: inset arched window, complete balcony rails,
// continuous door arch and timber framing hidden below the eaves.
const inspected=createHouseModel(THREE,{floors:4,width:10,depth:8,roofType:'gable',
  balcony:true,timberFrame:true,windowStyle:'arched',doorStyle:'arched',shutters:false});
const archedWindow=inspected.group.children.find(o=>o.userData.windowStyle==='arched');
assert(archedWindow,'Arched windows must remain individually inspectable before batching');
const windowFrame=archedWindow.children.find(o=>o.userData.windowFrame);
const horizontalBar=archedWindow.children.find(o=>o.userData.windowMullion==='horizontal');
const verticalBar=archedWindow.children.find(o=>o.userData.windowMullion==='vertical');
assert(windowFrame&&horizontalBar&&verticalBar,'Arched window needs frame and both mullions');
windowFrame.geometry.computeBoundingBox();
assert(windowFrame.geometry.boundingBox.max.z<.18,'Window frame should be recessed toward the wall');
assert(horizontalBar.geometry.parameters.width>=archedWindow.userData.windowWidth,
  'Crossbar must meet both window borders');
const innerApex=1.33/2-.025-.012+archedWindow.userData.windowWidth*.35-.035;
const mullionTop=verticalBar.position.y+verticalBar.geometry.parameters.height/2;
assert(mullionTop>=innerApex-.025,'Vertical mullion must reach the glazed arch apex');
const balcony=inspected.group.children.filter(o=>o.userData.balconyPart);
const sides=balcony.filter(o=>o.userData.balconyPart==='side-rail');
const balusters=balcony.filter(o=>o.userData.balconyPart?.endsWith('baluster'));
assert.equal(sides.length,2,'Balcony must have both side handrails');
assert.equal(balcony.filter(o=>o.userData.balconyPart==='post').length,4);
assert.equal(balusters.length,11,'Balcony must have front and side balusters');
const balconyDeckY=.32+inspected.group.userData.config.floorHeight+.23+.09;
for(const bar of balusters){
  const bottom=bar.position.y-bar.geometry.parameters.height/2;
  assert(bottom<=balconyDeckY+.025,'Balusters must touch the balcony floor');
}
const frontDoor=inspected.group.children.find(o=>o.userData.doorStyle==='arched');
const fullDoorFrame=frontDoor.children.find(o=>o.userData.continuousDoorFrame);
const doorStile=frontDoor.children.find(o=>o.userData.doorStile);
assert(fullDoorFrame&&doorStile,'Door arch and its vertical stile must be connected');
fullDoorFrame.geometry.computeBoundingBox();
const stileTop=doorStile.position.y+doorStile.geometry.parameters.height/2;
assert(Math.abs(fullDoorFrame.geometry.boundingBox.max.y-stileTop)<.13,
  'Door centre stile must meet the curved arch');
const roofLineTop=.32+inspected.group.userData.config.floors*inspected.group.userData.config.floorHeight;
const topBand=inspected.group.children.find(o=>o.isMesh&&
  Math.abs(o.geometry.parameters?.width-(inspected.group.userData.config.width+.16))<.0001&&
  o.position.y>roofLineTop-.20);
assert.equal(topBand,undefined,'Timber frame must not protrude through the roof slope');
inspected.dispose();
model.dispose();
assert.equal(model.group.children.length,0);
console.log('House builder config, facade layout and Three.js geometry: passed');
