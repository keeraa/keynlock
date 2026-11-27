import {stairHeight} from './stair-profile.js';
// Local floor height under a transported object, including the lower storey.
export function supportHeightAt(x,z,y,config){
 const s=config.building.stair,r=Math.hypot(x,z),a=(Math.atan2(x,z)+Math.PI*2)%(Math.PI*2);
 if(!s)return 0;
 if(r>=s.openingRadius && y>=-.22)return 0;
 if(r>=s.innerRadius&&r<=s.outerRadius && a<=s.sweep){
  const height=stairHeight(s,a);if(y>=height-.18)return height;
 }
 return y<-.22 && r<5.16?-s.depth:0;
}
