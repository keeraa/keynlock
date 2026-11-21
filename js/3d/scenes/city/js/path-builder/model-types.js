import {HOUSE_DEFAULTS,normalizeHouseConfig} from '../../modules/house-builder/index.js';

// The currently approved 3D scene is the source of truth for all model
// scales. Other renderers and tooling import this catalog unchanged.
export const MODEL_TYPES=Object.freeze({
  house:{label:'Городской дом',kind:'house',scale:.88,config:{...HOUSE_DEFAULTS}},
  'custom-house':{label:'Дом из конструктора',kind:'house',scale:.88,config:{...HOUSE_DEFAULTS}},
  townhouse:{label:'Высокий дом',kind:'house',scale:.88,config:{...HOUSE_DEFAULTS,floors:3,width:6.5,depth:6.5,roofType:'hip',roofColor:'#596f73',plasterColor:'#b7c4b4',shutters:false}},
  workshop:{label:'Мастерская',kind:'house',scale:.88,config:{...HOUSE_DEFAULTS,floors:1,width:11,depth:8.5,roofHeight:1.6,roofColor:'#a78c67',plasterColor:'#d1b89c',timberFrame:true,frontWindows:2}},
  church:{label:'Церковь',kind:'landmark',scale:.52},
  theater:{label:'Театр',kind:'landmark',scale:.784},
  museum:{label:'Музей',kind:'landmark',scale:.784},
  townhall:{label:'Ратуша',kind:'landmark',scale:.47},
  palace:{label:'Дворец',kind:'landmark',scale:.768},
  tower:{label:'Башня',kind:'landmark',scale:.736},
});

// Measured from the approved low-LOD geometry via Box3, including steps,
// eaves and wings. These are the UNSCALED dimensions; MODEL_TYPES controls
// the exact sizes in both 3D and the hardware-independent plan view.
// tests/path-footprint-check.mjs fails if the 3D geometry ever drifts.
const MODEL_SHAPES=Object.freeze({
  house:[9.02,9.03,4.52],
  townhouse:[7.46,9.03,4.52],
  workshop:[12.02,11.03,5.52],
  church:[16.70,27.76,14.20],
  theater:[21.20,30.55,13.29],
  museum:[24.90,22.42,11.35],
  townhall:[19.70,17.36,9.00],
  palace:[44.00,31.66,16.15],
  tower:[13.30,16.16,8.40],
});

export function referenceFootprint(type,customConfig=null){
  const definition=MODEL_TYPES[type],shape=MODEL_SHAPES[type];
  if(type==='custom-house'){
    const c=normalizeHouseConfig(customConfig||HOUSE_DEFAULTS),scale=definition.scale;
    // A conservative envelope: the front balcony may project 6 cm beyond
    // the normal staircase, and flat roofs need less eave space.
    return {kind:'house',width:(c.width+1.02)*scale,
      depth:(c.depth+(c.balcony&&c.floors>1?2.59:2.53))*scale,
      pathAccess:{x:0,z:(c.depth/2+1.27)*scale}};
  }
  if(!definition||!shape)throw new Error(`Неизвестное здание: ${type}`);
  return {kind:definition.kind,width:shape[0]*definition.scale,depth:shape[1]*definition.scale,
    pathAccess:{x:0,z:shape[2]*definition.scale}};
}
