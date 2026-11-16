import assert from 'node:assert/strict';
import { generateQuarterPlan } from '../js/street/quarter-generator.js';
import { junctionArms,junctionSidewalkCorners } from '../js/street/quarter-junctions.js';

const turn=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
const intersect=(a,b,c,d)=>turn(a,b,c)*turn(a,b,d)<-1e-6&&turn(c,d,a)*turn(c,d,b)<-1e-6;
let verified=0;
for(const district of ['old','port','arts','bohemian','industrial','upper','palace']){
  for(let seed=1000;seed<1120;seed++){
    const plan=generateQuarterPlan(district,seed);
    for(const junction of plan.roads.junctions){
      const corners=junctionSidewalkCorners(junctionArms(plan,junction));
      for(const {polygon,curb} of corners){
        verified++;
        assert(polygon.length>=3,'Corner patch needs a valid outline');
        assert(polygon.every(point=>point.every(Number.isFinite)),'Corner patch contains a bad point');
        const area=Math.abs(polygon.reduce((sum,a,i)=>{
          const b=polygon[(i+1)%polygon.length];
          return sum+a[0]*b[1]-a[1]*b[0];
        },0)/2);
        assert(area>.25,`Degenerate sidewalk polygon in ${district}/${seed}/${junction.id}`);
        for(let i=0;i<polygon.length;i++)for(let j=i+2;j<polygon.length;j++){
          if(i===0&&j===polygon.length-1)continue;
          assert(!intersect(polygon[i],polygon[(i+1)%polygon.length],
            polygon[j],polygon[(j+1)%polygon.length]),
          `Self-crossing sidewalk in ${district}/${seed}/${junction.id}`);
        }
        assert(curb.length>=2,'Each sidewalk corner has a continuous kerb');
      }
    }
  }
}
assert.equal(verified,11760);
console.log(`Junction geometry: ${verified} curved corners, no folded or missing sidewalks`);
