// One continuous mitered band around the complete floor outline. Independent
// rectangles at the wing mouths left overlapping caps and diagonal end faces.
export function buildWainscot({layout,len,m,shapeMesh}){
 const outline=layout.halls.flatMap(h=>[
  layout.world(h,-h.width/2,h.start),layout.world(h,-h.width/2,h.start+len),
  layout.world(h,h.width/2,h.start+len),layout.world(h,h.width/2,h.start),
 ]);
 const area=outline.reduce((sum,a,i)=>{const b=outline[(i+1)%outline.length];return sum+a.x*b.z-b.x*a.z;},0);
 const sign=Math.sign(area);
 function offset(distance){
  const edges=outline.map((a,i)=>{const b=outline[(i+1)%outline.length],dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz);
   return {a:{x:a.x-sign*dz/length*distance,z:a.z+sign*dx/length*distance},dx,dz};
  });
  return edges.map((b,i)=>{
   const a=edges[(i+edges.length-1)%edges.length],den=a.dx*b.dz-a.dz*b.dx;
   const t=((b.a.x-a.a.x)*b.dz-(b.a.z-a.a.z)*b.dx)/den;
   return {x:a.a.x+t*a.dx,z:a.a.z+t*a.dz};
  });
 }
 shapeMesh(offset(-.08),[offset(.20)],0,.76,m.wood).name='gallery-wainscot';
 shapeMesh(offset(-.10),[offset(.24)],.76,.08,m.ivory).name='gallery-wainscot-cap';
}
