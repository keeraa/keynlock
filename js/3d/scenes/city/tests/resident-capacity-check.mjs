import assert from 'node:assert/strict';
import { estimateResidentCapacity } from '../js/street/resident-capacity.js';
import { generateQuarterPlan } from '../js/street/quarter-generator.js';
import { generateStreetPlan,createStreetBlueprint } from '../js/street/street-generator.js';

for(const district of ['old','port','bohemian','arts','industrial','upper','palace']){
  const quarter=generateQuarterPlan(district,1130);
  const street=generateStreetPlan(district,1130);
  for(const plan of [quarter,street]){
    const {estimate,min,max}=plan.stats.residents;
    assert(estimate>10&&estimate<1200,`Implausible housing capacity in ${district}`);
    assert(min<=estimate&&estimate<=max,'The range must contain its estimate');
    assert.deepEqual(plan.stats.residents,estimateResidentCapacity(plan.houses,district));
  }
  assert.deepEqual(createStreetBlueprint(quarter).residents,quarter.stats.residents,
    'Export must include estimated residents');
}
const small=[{config:{width:6,depth:6,floors:1}}];
const larger=[{config:{width:9,depth:8,floors:3}}];
assert(estimateResidentCapacity(larger,'old').estimate>estimateResidentCapacity(small,'old').estimate);
assert(estimateResidentCapacity(larger,'old').estimate>estimateResidentCapacity(larger,'palace').estimate);
console.log('Capacity: 7 district policies, area and storeys scaling, street/quarter/export consistency OK');
