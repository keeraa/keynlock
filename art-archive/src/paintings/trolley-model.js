import {frameDimensions} from '../../catalog/painting-geometry.js';
export const TROLLEY=Object.freeze({depth:.6,wheelRadius:.12,wheelThickness:.07,wheelDrop:.17,
 baseDrop:.035,baseThickness:.085,spanRatio:.86,baseOverhang:.14,wheelSpread:.85,wheelZ:.25});
export function trolleyDimensions(slot,settings){
 const frame=frameDimensions(slot,settings),bottom=-frame.height/2,span=frame.width*TROLLEY.spanRatio;
 return {...TROLLEY,bottom,span,width:Math.max(frame.width,span+TROLLEY.baseOverhang),
  centerHeight:frame.height/2+TROLLEY.wheelDrop+TROLLEY.wheelRadius};
}
