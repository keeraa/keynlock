import {houseChimneyOutlet} from '../buildings/house-atmosphere.js';

// A stable world-space emitter list. Only rebuild when the street plan changes;
// each animation frame then updates one shared particle buffer.
export function buildStreetSmokeParticles(houses){
  const particles=[];
  for(const [index,record] of houses.entries()){
    const chimney=houseChimneyOutlet(record.config);
    if(!chimney)continue;
    const c=Math.cos(record.rotation),s=Math.sin(record.rotation);
    const x=record.x+chimney.x*c+chimney.z*s;
    const z=record.z-chimney.x*s+chimney.z*c;
    for(let i=0;i<3;i++)particles.push({x,y:chimney.y,z,
      phase:i/3+(index%7)*.031,seed:index*.71+i*1.53});
  }
  return particles;
}
