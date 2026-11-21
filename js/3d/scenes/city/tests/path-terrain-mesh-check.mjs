import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.js';
import {LANDSCAPE_BOUNDS,createLandscapeSampler,exampleLandscape,normalizeLandscape} from '../js/path-builder/landscape-model.js';
import {terrainSubdivisionStats,createTerrainMeshGeometry,updateTerrainMeshGeometry,
  createTerrainMeshUpdater} from '../js/path-builder/terrain-mesh.js';

const empty=terrainSubdivisionStats();
assert.ok(empty.triangles>110*75*2,
  'The permanent island shoreline receives local subdivisions');
assert.ok([...empty.levels].some(level=>level===4),
  'Permanent coastlines use 6-metre terrain cells to smooth deep riverbanks');
assert.ok(empty.triangles<=68000,
  'Compact terrain stays within the bounded coastal geometry budget');
assert.ok(empty.triangles*3<210000,'Water islands remain cheaper than a dense full-map grid');

const landscape=exampleLandscape();
const dense=terrainSubdivisionStats(landscape);
assert.ok(dense.triangles>empty.triangles,'Riverbanks and hills receive extra tessellation');
assert.ok(dense.triangles*3<210000,'Ordinary hand-painted terrain stays within the light mesh budget');
const geometry=createTerrainMeshGeometry(THREE,landscape);
assert.equal(geometry.index.count/3,dense.triangles);
const positions=geometry.getAttribute('position'),uvs=geometry.getAttribute('uv');
const sampler=createLandscapeSampler(landscape);
updateTerrainMeshGeometry(geometry,sampler.heightAt);
const normals=geometry.getAttribute('normal');
const stitches=new Map(geometry.userData.terrainStitches.map(item=>[item.vertex,item]));
assert.ok(stitches.size>0,'Mixed terrain LODs contain crack-free border stitching');
let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;
let nearestHill=Infinity,nearestRiver=Infinity,smallestHillStep=Infinity;
const hill=landscape.hills[0];
for(let i=0;i<positions.count;i++){
  const x=positions.getX(i),z=-positions.getY(i),height=positions.getZ(i);
  minX=Math.min(minX,x);maxX=Math.max(maxX,x);
  minZ=Math.min(minZ,z);maxZ=Math.max(maxZ,z);
  const stitch=stitches.get(i);
  const expected=stitch?
    sampler.heightAt(stitch.a[0],-stitch.a[1])*(1-stitch.t)+
      sampler.heightAt(stitch.b[0],-stitch.b[1])*stitch.t:
    sampler.heightAt(x,z);
  assert.ok(Math.abs(height-expected)<.0002,
    'Terrain edge vertices align with the neighboring coarse tile; interior follows foundations');
  const length=Math.hypot(normals.getX(i),normals.getY(i),normals.getZ(i));
  assert.ok(Math.abs(length-1)<.0001,'Every mesh normal is unit length');
  const uvX=uvs.getX(i),uvZ=uvs.getY(i);
  assert.ok(Math.abs(uvX-(x+LANDSCAPE_BOUNDS.width/2)/LANDSCAPE_BOUNDS.width)<.0001);
  assert.ok(Math.abs(uvZ-(-z+LANDSCAPE_BOUNDS.depth/2)/LANDSCAPE_BOUNDS.depth)<.0001);
  const hd=Math.hypot(x-hill.x,z-hill.z);
  if(hd<nearestHill)nearestHill=hd;
  if(hd<8)smallestHillStep=Math.min(smallestHillStep,hd);
  const rd=Math.abs(x-landscape.rivers[0].points[0][0]);
  if(rd<nearestRiver)nearestRiver=rd;
}
assert.equal(minX,-LANDSCAPE_BOUNDS.width/2);
assert.equal(maxX,LANDSCAPE_BOUNDS.width/2);
assert.equal(minZ,-LANDSCAPE_BOUNDS.depth/2);
assert.equal(maxZ,LANDSCAPE_BOUNDS.depth/2);
assert.ok(nearestHill<5&&smallestHillStep<8,'Hills retain local 6-metre samples');
assert.ok(nearestRiver<5,'Rivers retain local waterbed samples');
geometry.dispose();

const updater=createTerrainMeshUpdater(THREE);
const first=updater.update(landscape,()=>0);
const reused=updater.update(landscape,()=>1.25);
assert.equal(reused,first,'Moving a building updates existing terrain buffers');
assert.equal(reused.getAttribute('position').getZ(0),1.25,
  'Reused terrain geometry receives the current foundation heights');
const redrawn=updater.update(normalizeLandscape({...landscape,hills:[]}),()=>0);
assert.notEqual(redrawn,first,'Changing the landscape rebuilds adaptive terrain topology');
updater.dispose();

// A house drop updates only the few shoreline/hill vertices under its old
// and new foundations. The rest of the two-kilometre map is untouched.
const localLandscape=normalizeLandscape({hills:[{id:'pad-hill',x:-480,z:-468,radius:40,height:5}]});
const pad={id:'moving-house',x:-480,z:-468,width:26,depth:26,rotation:0};
const moved={...pad,x:-450};
const localUpdater=createTerrainMeshUpdater(THREE);
const localGeometry=localUpdater.update(localLandscape,
  createLandscapeSampler(localLandscape,[pad]).heightAt,[pad]);
const localPosition=localGeometry.getAttribute('position');
let nearest=0,distance=Infinity;
for(let i=0;i<localPosition.count;i++){
  const d=Math.hypot(localPosition.getX(i)-(pad.x+24),-localPosition.getY(i)-pad.z);
  if(d<distance){nearest=i;distance=d;}
}
const oldHeight=localPosition.getZ(nearest);
assert.equal(localUpdater.update(localLandscape,
  createLandscapeSampler(localLandscape,[moved]).heightAt,[moved]),localGeometry);
assert.ok(localGeometry.userData.lastUpdatedVertices>0&&
  localGeometry.userData.lastUpdatedVertices<localPosition.count/8,
  'Dropping the house repaints less than one eighth of terrain vertices');
const expected=createLandscapeSampler(localLandscape,[moved]).heightAt(
  localPosition.getX(nearest),-localPosition.getY(nearest));
assert.ok(Math.abs(localPosition.getZ(nearest)-expected)<.0001,
  'The moved foundation receives the correct local height');
assert.ok(Math.abs(localPosition.getZ(nearest)-oldHeight)>.001,
  'Moving a foundation really changes its local vertices');
localUpdater.update(localLandscape,createLandscapeSampler(localLandscape,[moved]).heightAt,[moved]);
assert.equal(localGeometry.userData.lastUpdatedVertices,0,
  'Unchanged houses do not trigger more terrain sampling');
localUpdater.dispose();

const crowded=normalizeLandscape({
  rivers:[{id:'long',width:32,depth:6,points:[[-1000,0],[1000,0]]}],
  hills:Array.from({length:400},(_,i)=>({id:`h${i}`,
    x:-960+i%25*78,z:-640+Math.floor(i/25)*82,radius:35,height:4})),
});
const busy=terrainSubdivisionStats(crowded);
assert.ok(busy.triangles<=68000,'Even hundreds of hills must respect the polygon budget');
assert.ok(busy.triangles*3<=204000,'The combined terrain stays bounded in busy scenes');
console.log(`Adaptive terrain: ${empty.triangles} coastal → ${dense.triangles} edited triangles, budget OK`);
