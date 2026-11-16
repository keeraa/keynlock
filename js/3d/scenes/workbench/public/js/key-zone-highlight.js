import {KEY_BOTTOM_Y,KEY_TOP_Y,keyTopOutline} from './logic.js';
import {KEY_BLADE_DEPTH,KEY_BLADE_OFFSET_Z,keyBladeBottomAt} from './key-blade.js';
import {machinedTopAtX,applyWearToOutline} from './key-wear.js';

// The selected zone is the only marked area, even when the pointer crosses
// another tooth. Hover remains available to change the cursor/target.
export function zoneHighlightOpacity(index,activeCut,isFiling,intact=true){
  return intact&&index===activeCut?(isFiling?.43:.27):0;
}

// Each zone occupies its own section of the blade. A filing stroke changes
// one zone's mesh; old saves with surface wear invalidate all zones.
export function dirtyCutZoneIndices(previous,current,wearChanged=false){
  return current.flatMap((value,i)=>wearChanged||previous[i]!==value?[i]:[]);
}

// A tooth's selected band wraps around the brass: both broad faces, the
// toothed edge, the flat edge and the seams at the ends of the band.
export function zoneSurfaceSamples(cuts,layout,index,wear=[]){
  const zone=layout[index];if(!zone)return [];
  const left=zone.center-zone.hitWidth*.5;
  const right=zone.center+zone.hitWidth*.5;
  const count=Math.max(12,Math.ceil((right-left)/.024));
  // Include every genuine top-profile corner. Uniform-only sampling missed
  // sharp corners and made the translucent cap clip through the brass.
  const positions=Array.from({length:count+1},(_,i)=>left+(right-left)*i/count);
  for(const [x] of applyWearToOutline(keyTopOutline(cuts,layout),wear))
    if(x>left+1e-7&&x<right-1e-7)positions.push(x);
  positions.sort((a,b)=>a-b);
  const unique=positions.filter((x,i)=>i===0||x-positions[i-1]>1e-7);
  return unique.map(x=>{
    const top=machinedTopAtX(cuts,layout,wear,x);
    return {x,top:Math.max(KEY_BOTTOM_Y,Math.min(KEY_TOP_Y,top)),bottom:keyBladeBottomAt(x)};
  });
}

export function createZoneFaceGeometry(THREE,cuts,layout,index,wear=[],
  samples=zoneSurfaceSamples(cuts,layout,index,wear)){
  if(!samples.length)return new THREE.BufferGeometry();
  const shape=new THREE.Shape();
  shape.moveTo(samples[0].x,samples[0].bottom);
  for(let i=1;i<samples.length;i++)shape.lineTo(samples[i].x,samples[i].bottom);
  for(let i=samples.length-1;i>=0;i--)shape.lineTo(samples[i].x,samples[i].top);
  shape.closePath();return new THREE.ShapeGeometry(shape);
}

export function createZoneRimGeometry(THREE,cuts,layout,index,wear=[],
  samples=zoneSurfaceSamples(cuts,layout,index,wear)){
  if(!samples.length)return new THREE.BufferGeometry();
  const front=KEY_BLADE_OFFSET_Z+KEY_BLADE_DEPTH+.004;
  const back=KEY_BLADE_OFFSET_Z-.004;
  const surfaceClearance=.006;
  const positions=[];
  function tri(a,b,c){positions.push(...a,...b,...c);}
  function quad(a,b,c,d){tri(a,b,c);tri(a,c,d);}
  for(let i=1;i<samples.length;i++){
    const a=samples[i-1],b=samples[i];
    if(a.top>a.bottom&&b.top>b.bottom)
      quad([a.x,a.top+surfaceClearance,front],[b.x,b.top+surfaceClearance,front],
        [b.x,b.top+surfaceClearance,back],[a.x,a.top+surfaceClearance,back]);
    quad([a.x,a.bottom,back],[b.x,b.bottom,back],
      [b.x,b.bottom,front],[a.x,a.bottom,front]);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.computeVertexNormals();return geometry;
}

export function createZoneOutlineGeometry(THREE,cuts,layout,index,wear=[],
  samples=zoneSurfaceSamples(cuts,layout,index,wear)){
  if(!samples.length)return new THREE.BufferGeometry();
  const front=KEY_BLADE_OFFSET_Z+KEY_BLADE_DEPTH+.018;
  const back=KEY_BLADE_OFFSET_Z-.018;
  const positions=[];
  const segment=(a,b)=>positions.push(...a,...b);
  for(let i=1;i<samples.length;i++){
    const a=samples[i-1],b=samples[i];
    for(const z of [front,back]){
      segment([a.x,a.top,z],[b.x,b.top,z]);
      segment([a.x,a.bottom,z],[b.x,b.bottom,z]);
    }
  }
  for(const a of [samples[0],samples.at(-1)]){
    for(const z of [front,back])
      segment([a.x,a.bottom,z],[a.x,a.top,z]);
    for(const y of [a.top,a.bottom])
      segment([a.x,y,front],[a.x,y,back]);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  return geometry;
}
