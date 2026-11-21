import {SPB_MAP_BOUNDS} from './spb-water-layout.js';
import {WATER_MASK_WIDTH,WATER_MASK_HEIGHT} from './spb-water-data.js';
import {bridgeLocal,bridgeWaterOpening} from './bridge-frame.js';

// The five narrow paper-colored cuts through the wide rivers are bridge
// crossings on the approved reference, not natural isthmuses. Coordinates are
// retained in source-map pixels so shrinking the game world keeps their exact
// relationship with the islands and shoreline. These bridges are immutable.
const CROSSINGS=[
  {id:'keynlock-west-bridge',from:[548,423],to:[544,521],deckWidth:17,cutWidth:27},
  {id:'keynlock-southwest-bridge',from:[244,895],to:[296,1012],deckWidth:18,cutWidth:29},
  {id:'keynlock-middle-bridge',from:[617,632],to:[679,721],deckWidth:17,cutWidth:27},
  {id:'keynlock-grand-bridge',from:[990,270],to:[1082,458],deckWidth:19,cutWidth:30},
  {id:'keynlock-east-bridge',from:[1481,157],to:[1469,294],deckWidth:18,cutWidth:28},
];

const toWorld=([px,py])=>[(px/WATER_MASK_WIDTH-.5)*SPB_MAP_BOUNDS.width,
  (py/WATER_MASK_HEIGHT-.5)*SPB_MAP_BOUNDS.depth];

export const KEYNLOCK_FIXED_BRIDGES=Object.freeze(CROSSINGS.map(crossing=>{
  const [ax,az]=toWorld(crossing.from),[bx,bz]=toWorld(crossing.to);
  const dx=bx-ax,dz=bz-az,span=Math.hypot(dx,dz);
  return Object.freeze({
    id:crossing.id,fixed:true,x:(ax+bx)/2,z:(az+bz)/2,
    dirX:dx/span,dirZ:dz/span,span,
    deckWidth:crossing.deckWidth,cutWidth:crossing.cutWidth,
    // Leave real grassy ground under both bridgeheads. The original paper
    // cutouts were dry approach roads, not water to be excavated end-to-end.
    landApproachLength:Math.min(13,span*.095),
    bankA:.22,bankB:.22,rise:span>220?3.25:2.55,
    depth:3.1,width:crossing.cutWidth,
  });
}));

export function fixedBridgeWaterAt(x,z){
  for(const bridge of KEYNLOCK_FIXED_BRIDGES){
    const {along,across}=bridgeLocal(bridge,x,z);
    const {halfLength,halfWidth}=bridgeWaterOpening(bridge);
    if(Math.abs(along)<=halfLength&&Math.abs(across)<=halfWidth)return true;
  }
  return false;
}

// Draw only on the *shared* water mask. Shore pigment is later subtracted from
// the union so a former sandy dam cannot show as a dark strip under the deck.
export function paintFixedBridgeWater(ctx,{worldWidth,worldDepth,ppm}){
  ctx.save();ctx.fillStyle='#ffffff';
  for(const bridge of KEYNLOCK_FIXED_BRIDGES){
    ctx.save();
    ctx.translate((bridge.x+worldWidth/2)*ppm,(bridge.z+worldDepth/2)*ppm);
    ctx.rotate(Math.atan2(bridge.dirZ,bridge.dirX));
    const {halfLength,halfWidth}=bridgeWaterOpening(bridge);
    ctx.fillRect(-halfLength*ppm,-halfWidth*ppm,
      2*halfLength*ppm,2*halfWidth*ppm);
    ctx.restore();
  }
  ctx.restore();
}
