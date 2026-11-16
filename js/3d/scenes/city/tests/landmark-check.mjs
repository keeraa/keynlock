import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import * as T from '../vendor/three.js';
import {createLandmarkModel,landmarkTriangleCount,LANDMARK_CATALOG} from '../js/landmarks/landmark-model.js';

assert.equal(LANDMARK_CATALOG.length,5,'All five signature buildings must have a catalogue entry');
assert.deepEqual(LANDMARK_CATALOG.map(entry=>entry.id),['church','theater','museum','townhall','palace']);

for(const item of LANDMARK_CATALOG){
  const counts=[],bounds=[];
  for(const detail of ['high','medium','low']){
    const model=createLandmarkModel(T,item.id,{detail});
    assert.equal(model.group.isGroup,true);
    assert.ok(model.entranceCount>0,`${item.id}/${detail} has no front entrance`);
    const meshes=[];model.group.traverse(node=>{if(node.isMesh)meshes.push(node);});
    assert.ok(meshes.length>12,`${item.id}/${detail} is missing architectural masses`);
    const feet=meshes.filter(node=>node.userData.landmarkColumnFoot);
    const supports=meshes.filter(node=>node.userData.landmarkColumnSupport);
    if(['theater','museum','palace'].includes(item.id)){
      assert.ok(feet.length>=4,`${item.id}/${detail} has too few portico columns`);
      assert.ok(supports.length,`${item.id}/${detail} has no solid portico foundation`);
      const surfaces=supports.map(node=>new T.Box3().setFromObject(node));
      for(const foot of feet){
        const bounds=new T.Box3().setFromObject(foot);
        const center=bounds.getCenter(new T.Vector3());
        const touches=surfaces.some(b=>
          center.x>b.min.x&&center.x<b.max.x&&center.z>b.min.z&&center.z<b.max.z&&
          Math.abs(bounds.min.y-b.max.y)<.07);
        assert.ok(touches,`${item.id}/${detail} has an unsupported floating column at ${center.x}, ${center.z}`);
      }
      const openings=[];
      model.group.traverse(node=>{if(Number.isFinite(node.userData.landmarkWallFaceZ))openings.push(node);});
      assert.ok(openings.length>=3);
      for(const opening of openings)assert.ok(
        Math.abs(opening.position.z-opening.userData.landmarkWallFaceZ)<=.2,
        `${item.id}/${detail} has a facade opening floating away from its wall`);
    }
    for(const node of meshes){
      const geometry=node.geometry;
      const positions=geometry.getAttribute('position');
      assert.ok(positions?.count>=3,`Invalid vertices in ${item.id}/${detail}`);
      for(const coordinate of positions.array)assert.ok(Number.isFinite(coordinate),`NaN in ${item.id}/${detail}`);
    }
    const check=landmarkTriangleCount(model.group);
    assert.equal(check.triangles,model.stats.triangles);
    counts.push(model.stats.triangles);
    const bounds3=new T.Box3().setFromObject(model.group);
    bounds.push(bounds3.getSize(new T.Vector3()));
    assert.ok(bounds3.min.y>=-.1&&bounds3.max.y>13,`${item.id}/${detail} has bad vertical extents`);
    model.dispose();
  }
  assert.ok(counts[0]>counts[1]&&counts[1]>counts[2],`${item.id} must reduce geometry across LOD`);
  for(let n=1;n<3;n++){
    assert.ok(Math.abs(bounds[0].x-bounds[n].x)<2.5,`${item.id} LOD width must be stable`);
    assert.ok(Math.abs(bounds[0].y-bounds[n].y)<1.3,`${item.id} LOD height must be stable`);
    assert.ok(Math.abs(bounds[0].z-bounds[n].z)<2.5,`${item.id} LOD depth must be stable`);
  }
  console.log(`${item.id}: ${counts.join(' / ')} triangles (High / Medium / Low)`);
}
for(const bad of ['unknown',''])assert.throws(()=>createLandmarkModel(T,bad),/Неизвестный/);
assert.throws(()=>createLandmarkModel(T,'church',{detail:'ultra'}),/Неизвестный/);
assert.match(await readFile(new URL('../landmark-lab/index.html',import.meta.url),'utf8'),/landmark-editor/);
assert.ok((await stat(new URL('../landmark-lab/style.css',import.meta.url))).size>1000);
console.log('Landmark catalogue, entrances, geometry and LOD contracts OK');
