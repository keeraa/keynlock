import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.js';
import { generateQuarterPlan } from '../js/street/quarter-generator.js';
import { buildQuarterPaving } from '../js/street/quarter-paving.js';
import { junctionArms,junctionSidewalkCorners,junctionContainsStone } from '../js/street/quarter-junctions.js';

for(const district of ['old','port','arts','bohemian','industrial','upper','palace']) {
  const plan=generateQuarterPlan(district,1130);
  const scene=new THREE.Group();
  buildQuarterPaving(THREE,scene,plan);
  scene.updateMatrixWorld(true);
  let instances=0,meshes=0,batches=0;
  scene.traverse(object=>{
    if(!object.isMesh)return;
    meshes++;
    assert(object.position.toArray().every(Number.isFinite),'All paving positions must be finite');
    assert(object.geometry.attributes.position.array.every(Number.isFinite),'All street vertices must be finite');
    if(object.isInstancedMesh){
      instances+=object.count;batches++;
      assert(object.count>0,'Instanced road tiles must be nonempty');
    }
  });
  assert(instances>400,'Street geometry must include actual cobbles or paving stones');
  assert(batches<=2,'Curved streets share at most two GPU stone batches');
  assert(meshes<300,'Street geometry must be batched rather than one mesh per stone');
  const corners=scene.children.filter(object=>object.userData.junctionCorner);
  for(const junction of plan.roads.junctions){
    const arms=junctionArms(plan,junction);
    const expected=junctionSidewalkCorners(arms);
    assert.equal(corners.filter(object=>object.userData.junctionCorner.node===junction.id).length,
      expected.length,`Every branch at ${junction.id} needs a stitched corner`);
    assert(junctionContainsStone(0,0,arms),'Crossroad centre must belong to the road');
    for(const corner of expected){
      assert(corner.polygon.length>=3,'Sidewalk corner must have a valid, rounded or tapered shape');
      assert(corner.polygon.every(([x,z])=>Number.isFinite(x)&&Number.isFinite(z)),
        'Sidewalk corner coordinates must be finite');
    }
  }
  const matrix=new THREE.Matrix4();
  const instancesMeshes=scene.children.filter(object=>object.isInstancedMesh);
  for(const junction of plan.roads.junctions){
    let nearest=Infinity;
    for(const stones of instancesMeshes)for(let i=0;i<stones.count;i++){
      stones.getMatrixAt(i,matrix);
      nearest=Math.min(nearest,Math.hypot(matrix.elements[12]-junction.x,matrix.elements[14]-junction.z));
    }
    assert(nearest<.85,`Bare patch in ${district} crossing ${junction.id}: ${nearest.toFixed(2)} m`);
  }
  const footprint=new THREE.Box3().setFromObject(scene);
  assert(footprint.min.x<=-110&&footprint.max.x>=110,'Road system fits the quarter ground');
  const courtCurbs=scene.children.filter(object=>object.isMesh&&
    object.geometry.parameters?.depth>1&&Math.abs(object.position.y-.105)<.001&&
    object.position.x>12&&object.position.x<31&&object.position.z>-7&&object.position.z<14);
  assert(courtCurbs.length>=4,'The irregular courtyard must have broken-edge stone edging');
  for(const gate of plan.courtyard.entrances) {
    const blocked=courtCurbs.some(object=>{
      const local=object.worldToLocal(new THREE.Vector3(gate[0],.105,gate[1]));
      return Math.abs(local.x)<.22&&Math.abs(local.z)<object.geometry.parameters.depth/2+.2;
    });
    assert(!blocked,'The courtyard footpath cannot intersect its stone edging');
  }
}
console.log('Quarter paving: 7 districts, instanced historic streets, open courtyard gates, bounded meshes OK');
