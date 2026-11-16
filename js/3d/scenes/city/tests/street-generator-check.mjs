import assert from 'node:assert/strict';
import { DISTRICTS } from '../js/world-data.js';
import { DISTRICT_PROFILES, resolveDistrictProfile } from '../js/street/district-profiles.js';
import { createStreetBlueprint, generateStreetPlan } from '../js/street/street-generator.js';

assert.equal(Object.keys(DISTRICT_PROFILES).length,7);
const silhouettes=[];
for(const district of DISTRICTS) {
  const plan=generateStreetPlan(district.id,42);
  const same=generateStreetPlan(district.id,42);
  assert.deepEqual(plan,same,`${district.id}: non-deterministic output`);
  assert.notDeepEqual(plan,generateStreetPlan(district.id,43),`${district.id}: seed ignored`);
  assert.equal(plan.houses.length,10);
  assert(plan.lamps.length>=6);
  assert(plan.road.length>45);
  assert.equal(plan.profile.name,district.name);
  for(const house of plan.houses) {
    const {config,x,z,side,rotation}=house;
    assert(config.floors>=plan.profile.floors[0]&&config.floors<=plan.profile.floors[1]);
    assert(config.width>=plan.profile.width[0]-.01&&config.width<=plan.profile.width[1]+.01);
    assert(plan.profile.roofs.includes(config.roofType));
    assert(plan.profile.roofsPalette.includes(config.roofColor));
    assert(plan.profile.walls.includes(config.plasterColor));
    assert(side*x>0);
    assert.equal(rotation,side*-Math.PI/2);
    assert(Math.abs(z)+config.width/2<plan.road.length/2-3);
  }
  for(const side of [-1,1]) {
    const row=plan.houses.filter(h=>h.side===side).sort((a,b)=>a.z-b.z);
    for(let i=1;i<row.length;i++)assert(row[i].z-row[i-1].z>=(row[i].frontage+row[i-1].frontage)/2+.2);
  }
  silhouettes.push(JSON.stringify({floors:plan.profile.floors,roofs:plan.profile.roofs,wall:plan.profile.walls[0]}));
  const blueprint=createStreetBlueprint(plan);
  assert.equal(blueprint.buildings.length,10);
  assert.equal(blueprint.buildings[0].house.schema,'keynlock.house');
}
assert.equal(new Set(silhouettes).size,7);
const modified=generateStreetPlan('old',13,{minFloor:3,maxFloor:4,roofs:['flat'],roadWidth:12,sidewalkWidth:3.5,lampSpacing:12,roofsPalette:['#abcdef']});
assert(modified.houses.every(h=>h.config.floors>=3&&h.config.roofType==='flat'&&h.config.roofColor==='#abcdef'));
assert.equal(modified.road.width,12);
assert.equal(modified.sidewalks.width,3.5);
assert.equal(resolveDistrictProfile('old',{minFloor:4,maxFloor:1}).floors[1],4);
console.log('Street generator: seven deterministic district rules, house constraints, no collisions and export OK');
