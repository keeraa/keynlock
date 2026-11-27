// A vertical player capsule against cached oriented frame footprints. This index
// includes off-screen paintings; rendering and physical presence are independent.
import {frameDimensions,frameOrientation} from '../../catalog/painting-geometry.js';
export function createPaintingCollisions(settings,eyeHeight){
 const cells=new Map(),cellSize=4,radius=.28;
 function setSlots(slots){
  cells.clear();
  for(const s of slots){
   const {floor,c,s:t}=frameOrientation(s);
   // Flat works are walkable at every support height, including saved stacks
   // and treads. Tables themselves remain separate solid obstacles.
   if(floor)continue;
   const size=frameDimensions(s,settings);
   const halfW=size.width/2,halfD=(floor?size.height:size.depth)/2;
   const halfY=(floor?size.depth:size.height)/2;
   const xExtent=Math.abs(c)*halfW+Math.abs(t)*halfD+radius;
   const zExtent=Math.abs(t)*halfW+Math.abs(c)*halfD+radius;
   const box={x:s.x,z:s.z,c,t,halfW,halfD,minY:s.y-halfY,maxY:s.y+halfY};
   for(let x=Math.floor((s.x-xExtent)/cellSize);x<=Math.floor((s.x+xExtent)/cellSize);x++)
    for(let z=Math.floor((s.z-zExtent)/cellSize);z<=Math.floor((s.z+zExtent)/cellSize);z++){
     const key=x+','+z;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(box);
    }
  }
 }
 function blocked(x,z,floorY){
  const nearby=cells.get(Math.floor(x/cellSize)+','+Math.floor(z/cellSize));
  if(!nearby)return false;
  for(const b of nearby){
   // Paintings lying flat at shoe level can be stepped over, tall piles cannot.
   if(b.maxY<=floorY+.08 || b.minY>=floorY+eyeHeight+.15)continue;
   const dx=x-b.x,dz=z-b.z;
   const across=Math.max(0,Math.abs(dx*b.c-dz*b.t)-b.halfW);
   const depth=Math.max(0,Math.abs(dx*b.t+dz*b.c)-b.halfD);
   if(across*across+depth*depth<radius*radius-1e-9)return true;
  }
  return false;
 }
 return {setSlots,blocked};
}
