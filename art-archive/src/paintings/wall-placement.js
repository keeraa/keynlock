import {acceptsHall,placedSlot} from './hanging.js';

// One policy for wall previews and the placement committed by a click. Storage
// remains responsible for serialization, while this module checks game rules.
export function createWallPlacement(config,motion,{isFree=()=>false,occupied=()=>[]}={}){
 const settings=config.paintings;
 function limits(wall){
  return {...settings,edgeMarginM:0,horizontalGapM:0,verticalGapM:0,minBottomM:isFree() ? .02 : .84,
   maxTopM:config.building.height-(wall.hall==='center' ? .13 : config.building.vaultRise+.03)};
 }
 function accepts(slot,wall){return isFree()||acceptsHall(slot,wall);}
 function surface(slot,wall,along,y){return placedSlot(slot,wall,along,y,limits(wall),[]);}
 function evaluate(slot,wall,along,y){
  if(!accepts(slot,wall))return {slot:null,reason:'wrong_hall'};
  const placed=placedSlot(slot,wall,along,y,limits(wall),occupied());
  if(!placed)return {slot:null,reason:'occupied_or_too_large'};
  const pose=motion.pose(placed);
  if(motion.blocked(placed,pose.position,pose.quaternion))return {slot:null,reason:'collision'};
  return {slot:placed,reason:null};
 }
 return {limits,accepts,surface,evaluate};
}
