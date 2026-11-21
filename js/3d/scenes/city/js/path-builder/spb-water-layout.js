import {WATER_MASK_WIDTH,WATER_MASK_HEIGHT,WATER_ROW_OFFSETS_BASE64,
  WATER_RUN_PAIRS_BASE64} from './spb-water-data.js';

// The approved plan stays the canonical fixed coastline. The same Neva,
// islands and canals now fit a more compact world without changing models.
export const SPB_MAP_BOUNDS=Object.freeze({width:2640,depth:1800});
export const SPB_WATER_MASK_URL=new URL('../../assets/map/spb-water-mask.png',import.meta.url).href;
export const SPB_SHORE_WASH_URL=new URL('../../assets/map/spb-shore-wash.png',import.meta.url).href;

function unpack16(value){
  const bytes=atob(value),result=new Uint16Array(bytes.length/2);
  for(let i=0;i<result.length;i++)result[i]=bytes.charCodeAt(i*2)|(bytes.charCodeAt(i*2+1)<<8);
  return result;
}
const rowOffsets=unpack16(WATER_ROW_OFFSETS_BASE64);
const rowPairs=unpack16(WATER_RUN_PAIRS_BASE64);
const METRES_PER_PIXEL_X=SPB_MAP_BOUNDS.width/WATER_MASK_WIDTH;
const METRES_PER_PIXEL_Z=SPB_MAP_BOUNDS.depth/WATER_MASK_HEIGHT;

export function spbWaterAtPixel(x,y){
  const col=Math.floor(x),row=Math.floor(y);
  if(col<0||col>=WATER_MASK_WIDTH||row<0||row>=WATER_MASK_HEIGHT)return false;
  let left=rowOffsets[row],right=rowOffsets[row+1]-1;
  while(left<=right){
    const mid=(left+right)>>1,start=rowPairs[mid*2],end=rowPairs[mid*2+1];
    if(col<start)right=mid-1;
    else if(col>=end)left=mid+1;
    else return true;
  }
  return false;
}

export function spbWaterAt(x,z){
  return spbWaterAtPixel((x+SPB_MAP_BOUNDS.width/2)/METRES_PER_PIXEL_X,
    (z+SPB_MAP_BOUNDS.depth/2)/METRES_PER_PIXEL_Z);
}

export function spbWaterNear(x,z,margin=0){
  if(spbWaterAt(x,z))return true;
  if(margin<=0)return false;
  // Wider collision clearance along the shoreline, including island tips.
  for(const [dx,dz] of [[-1,0],[1,0],[0,-1],[0,1],[-.707,-.707],
    [-.707,.707],[.707,-.707],[.707,.707]])
    if(spbWaterAt(x+dx*margin,z+dz*margin))return true;
  return false;
}

export function spbWaterChannelAt(x,z){
  if(spbWaterAt(x,z))return {bed:.22,fade:.45};
  // Shore relief remains shallow and gradual. Deep 0.74-m binary steps
  // created black, blocky silhouettes in the contour/depth post-process.
  if(spbWaterNear(x,z,4.5))return {bed:.065,fade:.15};
  if(spbWaterNear(x,z,9))return {bed:.018,fade:.04};
  return {bed:0,fade:0};
}

export function spbCoastCrossesTile(x,z,halfSize){
  const middle=spbWaterAt(x,z);
  for(const dx of [-halfSize,0,halfSize])for(const dz of [-halfSize,0,halfSize])
    if(spbWaterAt(x+dx,z+dz)!==middle)return true;
  return false;
}
