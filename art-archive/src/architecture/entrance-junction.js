// Intersect the rotunda wall faces with the inside and outside of a gallery wall.
export function entranceJunction(layout,hall,side){
 const panel=layout.centerSegments.find(s=>s.entrances[side===1?0:1]===hall.id);
 const a=layout.local(hall,panel.a.x,panel.a.z),b=layout.local(hall,panel.b.x,panel.b.z);
 const n=layout.local(hall,panel.normal.x,panel.normal.z);
 const at=(x,offset)=>{
  const z=a.z+offset*n.z+(x-a.x-offset*n.x)*(b.z-a.z)/(b.x-a.x);
  return {x,z};
 };
 return {
  inside:at(side*(hall.width/2-.14),.15),
  outside:at(side*(hall.width/2+.14),-.15),
 };
}

export function entranceFront(layout,hall,x,junctions){
 const half=hall.width/2-.14;
 const corner=junctions[x<0?0:1].inside;
 const t=Math.max(0,Math.min(1,(Math.abs(x)-half+.55)/.55));
 const blend=t*t*(3-2*t);
 const round=Math.sqrt(layout.ringRadius**2-Math.min(x*x,half*half));
 return round+(corner.z-round)*blend;
}

// The lower and upper plaster share the same texture coordinates at the seam.
export function rotundaPlasterU(panel,x,z){
 const along=((x-panel.a.x)*(panel.b.x-panel.a.x)+(z-panel.a.z)*(panel.b.z-panel.a.z))/panel.length;
 return along/4;
}
export function entrancePaintColor(THREE,color){
 return new THREE.Color(color).lerp(new THREE.Color(0x897966),.22);
}

