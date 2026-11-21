// KEYNLOCK's fictional geography currently uses the approved Saint Petersburg
// water/island outline as its source. Game systems depend on this interface,
// so a future original KEYNLOCK map can replace that reference independently.
import {spbWaterAt} from './spb-water-layout.js';
import {fixedBridgeWaterAt} from './keynlock-fixed-bridges.js';

export {
  SPB_MAP_BOUNDS as KEYNLOCK_MAP_BOUNDS,
  SPB_WATER_MASK_URL as KEYNLOCK_WATER_MASK_URL,
  SPB_SHORE_WASH_URL as KEYNLOCK_SHORE_WASH_URL,
} from './spb-water-layout.js';

export const KEYNLOCK_WATER_LEVEL=-1.15;
export const KEYNLOCK_REFERENCE_WATER_BED=3.15;
const SHORE_DIRECTIONS=[[-1,0],[1,0],[0,-1],[0,1],[-.707,-.707],[-.707,.707],
  [.707,-.707],[.707,.707]];

export function keynlockWaterAt(x,z){
  return fixedBridgeWaterAt(x,z)||spbWaterAt(x,z);
}

export function keynlockWaterNear(x,z,margin=0){
  if(keynlockWaterAt(x,z))return true;
  if(margin<=0)return false;
  for(const [dx,dz] of SHORE_DIRECTIONS)
    if(keynlockWaterAt(x+dx*margin,z+dz*margin))return true;
  return false;
}

export function keynlockWaterChannelAt(x,z){
  // Binary shoreline pixels used to make a single vertex fall >3 m below its
  // dry neighbor. Smooth the *terrain bed* across the 5-metre shoreline band
  // while preserving the exact water mask and the deep middle of the river.
  const wet=keynlockWaterAt(x,z);
  let wetNeighbors=0;
  for(const [dx,dz] of SHORE_DIRECTIONS)
    if(keynlockWaterAt(x+dx*5,z+dz*5))wetNeighbors++;
  if(wet){
    const dryFraction=1-wetNeighbors/SHORE_DIRECTIONS.length;
    // Even a narrow canal retains at least 1.5 m of water under the surface.
    return {bed:Math.max(2.7,KEYNLOCK_REFERENCE_WATER_BED-dryFraction),fade:1};
  }
  // On dry land preserve modeled hills and building heights at the coast.
  if(wetNeighbors)return {bed:.42*Math.min(1,wetNeighbors/4),fade:.12};
  if(keynlockWaterNear(x,z,9))return {bed:.075,fade:.09};
  return {bed:0,fade:0};
}

export function keynlockCoastCrossesTile(x,z,halfSize){
  const middle=keynlockWaterAt(x,z);
  for(const dx of [-halfSize,0,halfSize])for(const dz of [-halfSize,0,halfSize])
    if(keynlockWaterAt(x+dx,z+dz)!==middle)return true;
  return false;
}
