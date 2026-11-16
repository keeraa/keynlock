import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.js';
import {generateQuarterPlan} from '../js/street/quarter-generator.js';
import {createHouseModel,housePolygonCount} from '../js/buildings/house-model.js';
import {batchHouseGeometry} from '../js/buildings/house-batch.js';
import {buildQuarterPaving} from '../js/street/quarter-paving.js';
import {chooseQuarterHouseLOD,houseLODWeights,HOUSE_LOD_BLEND} from '../js/street/street-house-lod.js';

const districts=['old','port','bohemian','arts','industrial','upper','palace'];
const camera={x:125,y:113,z:137};
const totals=[];
for(const district of districts){
  const plan=generateQuarterPlan(district,1129);
  const paving=new THREE.Group();
  buildQuarterPaving(THREE,paving,plan);
  let roadTriangles=0,legacyRoadTriangles=0,stones=0;
  paving.traverse(object=>{
    if(!object.isMesh)return;
    const per=(object.geometry.index?.count??object.geometry.getAttribute('position').count)/3;
    roadTriangles+=per*(object.isInstancedMesh?object.count:1);
    legacyRoadTriangles+=object.isInstancedMesh?12*object.count:per;
    if(object.isInstancedMesh){
      stones+=object.count;
      assert(per===2||per===6,'Stone instancing should use compact geometry');
    }
  });
  assert(stones>2500,`${district}: missing historic stone paving`);
  let oldHouses=0,lodHouses=0;
  for(const house of plan.houses){
    const full=createHouseModel(THREE,house.config);
    const lod=chooseQuarterHouseLOD(camera,house);
    const optimized=createHouseModel(THREE,house.config,{detail:lod});
    const original=housePolygonCount(full.group);
    const reduced=housePolygonCount(optimized.group);
    assert(reduced<original*.55,`${district}: ${lod} house must have fewer triangles`);
    if(lod==='low')assert(reduced<original*.4,`${district}: low LOD is too detailed`);
    const beforeBox=new THREE.Box3().setFromObject(full.group);
    const afterBox=new THREE.Box3().setFromObject(optimized.group);
    assert(afterBox.max.y>=beforeBox.max.y-.7,`${district}: LOD changed roof silhouette`);
    oldHouses+=original;lodHouses+=reduced;
    const baked=batchHouseGeometry(THREE,optimized.group);
    assert.equal(baked.triangles,reduced,'Batching must preserve LOD triangle counts');
    full.dispose();optimized.dispose();
  }
  const before=oldHouses+legacyRoadTriangles;
  const after=lodHouses+roadTriangles;
  assert(after<before*.45,`${district}: total LOD improvement must exceed 55%`);
  totals.push({district,old:before,optimized:after,saved:Math.round((1-after/before)*100)});
  paving.traverse(object=>{if(object.isMesh)object.geometry.dispose();});
}

const specimen={x:0,z:0,config:{floors:3,floorHeight:2.85,roofHeight:2}};
const dist=(distance)=>({x:distance,y:5,z:0});
assert.equal(chooseQuarterHouseLOD(dist(24),specimen),'high');
assert.equal(chooseQuarterHouseLOD(dist(37),specimen,'high'),'high');
assert.equal(chooseQuarterHouseLOD(dist(46),specimen,'high'),'medium');
assert.equal(chooseQuarterHouseLOD(dist(90),specimen,'medium'),'medium');
assert.equal(chooseQuarterHouseLOD(dist(105),specimen,'medium'),'low');
assert.equal(chooseQuarterHouseLOD(dist(90),specimen,'low'),'low');
const blend=HOUSE_LOD_BLEND;
assert.deepEqual(houseLODWeights(blend.highFull),{low:0,medium:0,high:1});
assert.deepEqual(houseLODWeights(blend.mediumGone),{low:1,medium:0,high:0});
assert.deepEqual(houseLODWeights(999,true),{low:0,medium:0,high:1});
assert(blend.preloadHigh>blend.highGone);
assert(blend.preloadMedium>blend.mediumGone);
for(let d=0;d<=180;d+=.05){
  const a=houseLODWeights(d),b=houseLODWeights(d+.05);
  assert(Math.abs(a.low+a.medium+a.high-1)<1e-9,'All LOD weights must total 1');
  for(const level of ['low','medium','high']){
    assert(a[level]>=0&&a[level]<=1);
    assert(Math.abs(a[level]-b[level])<.01,`LOD ${level} must transition continuously at ${d}`);
  }
}
console.table(totals);
