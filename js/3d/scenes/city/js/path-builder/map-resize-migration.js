import {LANDSCAPE_BOUNDS} from './landscape-model.js';

// Only older localStorage entries need their outlying objects reframed.
// Objects around the starter town keep their metre coordinates and spacing;
// uniformly shrinking every house position would stack the buildings.
const PREVIOUS_BOUNDS=Object.freeze({width:4224,depth:2880});
const scale=LANDSCAPE_BOUNDS.width/PREVIOUS_BOUNDS.width;
const legacy=saved=>!saved?.mapBounds||
  (saved.mapBounds.width===PREVIOUS_BOUNDS.width&&saved.mapBounds.depth===PREVIOUS_BOUNDS.depth);
const clamp=(value,extent)=>Math.max(-extent,Math.min(extent,value));
const inside=(x,z,margin)=>Math.abs(x)<=LANDSCAPE_BOUNDS.width/2-margin&&
  Math.abs(z)<=LANDSCAPE_BOUNDS.depth/2-margin;
const reframe=(x,z,margin)=>inside(x,z,margin)?{x,z}:{
  x:clamp(x*scale,LANDSCAPE_BOUNDS.width/2-margin),
  z:clamp(z*scale,LANDSCAPE_BOUNDS.depth/2-margin),
};

export function migrateSavedBuildings(saved){
  const buildings=Array.isArray(saved?.buildings)?saved.buildings:[];
  if(!legacy(saved))return buildings;
  return buildings.map(building=>({...building,
    ...reframe(building.x,building.z,24)}));
}

export function migrateSavedLandscape(saved){
  if(!saved||!legacy(saved))return saved;
  return {...saved,
    trees:Array.isArray(saved.trees)?saved.trees.map(tree=>({...tree,
      ...reframe(tree.x,tree.z,5)})):saved.trees,
    hills:Array.isArray(saved.hills)?saved.hills.map(hill=>({...hill,
      ...reframe(hill.x,hill.z,1)})):saved.hills,
    rivers:Array.isArray(saved.rivers)?saved.rivers.map(river=>{
      if(!Array.isArray(river.points)||!river.points.some(p=>Array.isArray(p)&&
        Number.isFinite(p[0])&&Number.isFinite(p[1])&&!inside(p[0],p[1],1)))return river;
      return {...river,points:river.points.map(p=>Array.isArray(p)&&
        Number.isFinite(p[0])&&Number.isFinite(p[1])?
        [clamp(p[0]*scale,LANDSCAPE_BOUNDS.width/2-1),
          clamp(p[1]*scale,LANDSCAPE_BOUNDS.depth/2-1)]:p)};
    }):saved.rivers,
  };
}
