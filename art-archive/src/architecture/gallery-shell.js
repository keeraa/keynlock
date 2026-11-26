import {entranceFront,entrancePaintColor} from './entrance-junction.js';
export function buildGalleryShell(context, {h,g,roof,start,end,junctions}){
 const {THREE, layout, m, w, len, vaultRise, height, mesh, box, tube, shapeMesh}=context;
  box(0,-.12,start+len/2,w,.24,len,m.floor,g).name='gallery-floor';
  const rugLength=h.rug.end-h.rug.start,rugCenter=(h.rug.start+h.rug.end)/2;
  box(0,.015,rugCenter,h.rug.width,.035,rugLength,m.rug,g);
  for(const x of [-1.09,1.09])box(x,.04,rugCenter+.09,.035,.014,rugLength-.18,m.gold,g);
  for(const {inside,outside} of junctions){
   const wall=shapeMesh([inside,outside,{x:outside.x,z:end},{x:inside.x,z:end}],[],0,height+.25,m.plaster,g);
   wall.name='gallery-wall';
   const uv=wall.geometry.attributes.uv;
   for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)/3.5,uv.getY(i)/3.5);
  }
  // One continuous arched end wall. No detached cap or raised floor strip.
  const endShape=new THREE.Shape();endShape.moveTo(-w/2,0);endShape.lineTo(w/2,0);endShape.lineTo(w/2,height);
  for(let j=0;j<=24;j++){const a=j/24*Math.PI;endShape.lineTo(Math.cos(a)*w/2,height+Math.sin(a)*vaultRise);}endShape.closePath();
  const endGeometry=new THREE.ExtrudeGeometry(endShape,{depth:.3,bevelEnabled:false});
  const endUV=endGeometry.attributes.uv;for(let i=0;i<endUV.count;i++)endUV.setXY(i,endUV.getX(i)/3.5,endUV.getY(i)/3.5);
  const endWall=mesh(endGeometry,m.plaster,g);endWall.name='gallery-end-wall';endWall.position.z=end-.15;
  // Cove moulding follows the actual ceiling intersection, around both end corners.
  const trim=new THREE.MeshBasicMaterial({color:entrancePaintColor(THREE,h.color)});
  context.disposable.add(trim);
  const tx=w/2-.18,ty=height+vaultRise*Math.sqrt(1-(tx/(w/2))**2)-.06;
  for(const side of [-1,1])tube([new THREE.Vector3(side*tx,ty,entranceFront(layout,h,side*tx,junctions)+.025),new THREE.Vector3(side*tx,ty,end-.23)],.065,trim,roof).name='gallery-cove-trim';
  const arch=Array.from({length:49},(_,i)=>{const x=-tx+2*tx*i/48;return new THREE.Vector3(x,height+vaultRise*Math.sqrt(1-(x/(w/2))**2)-.06,end-.23);});tube(arch,.065,trim,roof).name='gallery-cove-trim';

}
