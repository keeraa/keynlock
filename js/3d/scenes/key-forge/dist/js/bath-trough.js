import * as THREE from '../vendor/three.js';

// A shallow wooden trough with a liquid surface, shared by the mud wash and
// the rust soak. Built in the key's frame: z is the key's normal, the liquid
// surface `surface` lies just above the key's top face.

export const WATER_COLOR='#7fb3ad';

export function createTrough(bounds,depth,{water:liquid=WATER_COLOR}={}) {
  const trough=new THREE.Group();
  const wood=new THREE.MeshStandardMaterial({color:'#8a6843',roughness:.9,metalness:0,transparent:true,opacity:0});
  // A wide, shallow trough: low walls keep the key in plain view.
  const pad=.42,wall=.06,bottom=-.14,top=depth+.12;
  const x0=bounds.minX-pad,x1=bounds.maxX+pad,y0=bounds.minY-pad,y1=bounds.maxY+pad;
  const w=x1-x0,h=y1-y0,height=top-bottom;
  const piece=(sx,sy,sz,x,y,z)=>{
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),wood);
    mesh.position.set(x,y,z);
    mesh.userData.exportable=false;mesh.userData.outlineable=true;
    trough.add(mesh);
  };
  piece(w+2*wall,h+2*wall,wall,(x0+x1)/2,(y0+y1)/2,bottom-wall/2);
  piece(w+2*wall,wall,height,(x0+x1)/2,y0-wall/2,(bottom+top)/2);
  piece(w+2*wall,wall,height,(x0+x1)/2,y1+wall/2,(bottom+top)/2);
  piece(wall,h,height,x0-wall/2,(y0+y1)/2,(bottom+top)/2);
  piece(wall,h,height,x1+wall/2,(y0+y1)/2,(bottom+top)/2);
  const water=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshStandardMaterial({
    color:liquid,transparent:true,opacity:0,roughness:.15,metalness:0,depthWrite:false}));
  water.position.set((x0+x1)/2,(y0+y1)/2,bottom);
  water.userData.exportable=false;
  trough.add(water);
  trough.userData={water,wood,bottom,surface:depth+.09,x0,x1,y0,y1};
  return trough;
}
