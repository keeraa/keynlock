import assert from 'node:assert/strict';
import { DISTRICTS } from '../js/world-data.js';
import { generateQuarterPlan } from '../js/street/quarter-generator.js';
import { createStreetBlueprint } from '../js/street/street-generator.js';
import { diffStreetPlans } from '../js/street/street-diff.js';
import { convexOverlap,pathLength,segmentCorridor } from '../js/street/road-geometry.js';

const bendCount=path=>{
  let bends=0;
  for(let i=1;i<path.length-1;i++){
    const a=path[i-1],b=path[i],c=path[i+1];
    const cross=(b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0]);
    if(Math.abs(cross)>1)bends++;
  }
  return bends;
};
for(const district of DISTRICTS)for(const seed of [5,1130,75619]){
  const plan=generateQuarterPlan(district.id,seed);
  assert.deepEqual(plan,generateQuarterPlan(district.id,seed),'Quarter must be seeded and reproducible');
  assert.equal(plan.mode,'quarter');
  assert.equal(plan.roads.lines.length,4,'Four differently angled historic streets');
  assert.equal(plan.roads.junctions.length,4,'The irregular road network has four real intersections');
  assert.equal(plan.roads.edges.length,30,'Every bend becomes a node-connected road segment');
  assert(plan.roads.lines.every(line=>bendCount(line.path)>=2),'Streets cannot revert to straight grid lines');
  assert(plan.roads.lines.some(line=>Math.abs(line.path.at(-1)[0]-line.path[0][0])>30&&
    Math.abs(line.path.at(-1)[1]-line.path[0][1])>10),'Cross streets must have oblique orientations');
  assert(plan.houses.length>=20&&plan.houses.length<=30,`${district.id}:${seed} has ${plan.houses.length} houses`);
  assert(plan.lamps.length>8);
  assert.equal(plan.walkways.length,plan.houses.length+3,'Door approaches and courtyard passage connect to streets');
  assert(plan.courtyard.polygon.length===5,'Courtyard follows irregular parcel outlines');
  const nodeIds=new Set(plan.roads.nodes.map(node=>node.id));
  for(const node of plan.roads.junctions)assert.equal(node.roads.length,2);
  for(const edge of plan.roads.edges){
    assert(nodeIds.has(edge.from)&&nodeIds.has(edge.to));
    assert(edge.width>2.5&&pathLength(edge.p)>5);
    assert(edge.surface==='cobble'||edge.surface==='paving');
  }
  const roadClearances=plan.roads.edges.map(edge=>segmentCorridor(edge.p[0],edge.p[1],edge.width/2+edge.walkWidth));
  for(let i=0;i<plan.houses.length;i++){
    const house=plan.houses[i];
    assert(plan.profile.roofs.includes(house.config.roofType));
    assert.equal(house.footprint.length,4);
    assert(!convexOverlap(house.footprint,plan.courtyard.polygon,.2));
    for(let j=0;j<i;j++)assert(!convexOverlap(house.footprint,plan.houses[j].footprint,.12),
      `House overlap: ${house.id}, ${plan.houses[j].id}`);
    for(const segment of roadClearances)assert(!convexOverlap(house.footprint,segment,.02),
      `House ${house.id} intersects a street`);
    const walk=plan.walkways.find(w=>w.id===`access-${house.id}`);
    assert(walk&&walk.p.length===2);
    assert(Math.hypot(walk.p[0][0]-house.x,walk.p[0][1]-house.z)>house.config.depth*.35);
  }
  const blueprint=createStreetBlueprint(plan);
  assert.equal(blueprint.buildings.length,plan.houses.length);
  assert.equal(blueprint.roadNetwork.junctions.length,4);
  assert.equal(blueprint.walkways.length,plan.walkways.length);
}
const initial=generateQuarterPlan('old',1130);
const lampEdit=diffStreetPlans(initial,generateQuarterPlan('old',1130,{lampStyle:'ornate'}));
assert(lampEdit.lampsChanged&&!lampEdit.roadChanged,'Lamp variants should preserve roads and houses');
assert.equal(lampEdit.unchanged.length,initial.houses.length);
const roadEdit=diffStreetPlans(initial,generateQuarterPlan('old',1130,{roadWidth:10}));
assert(roadEdit.roadChanged,'Road width must rebuild street surfaces');
assert.notDeepEqual(generateQuarterPlan('old',5).roads.lines[0].path,
  generateQuarterPlan('old',6).roads.lines[0].path,'Street silhouettes vary between seeds');
for(const district of DISTRICTS)for(let seed=1;seed<=120;seed++){
  const plan=generateQuarterPlan(district.id,seed);
  assert(plan.houses.length>=20&&plan.houses.length<=30,`Sparse layout in ${district.id}:${seed}`);
  assert.equal(plan.roads.junctions.length,4,`Disconnected road junction in ${district.id}:${seed}`);
}
console.log('Irregular quarter: 7 districts × 120 seeds, 30 curved edges, 4 intersections, 20–30 houses, footpaths and export OK');
