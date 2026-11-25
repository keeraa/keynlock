import {entranceJunction,entrancePaintColor,rotundaPlasterU} from './entrance-junction.js';
// The drum follows the vault mouths and continues the flat painting walls.
export function createDrumGeometry(THREE,config,layout){
 const {radius,height,vaultRise,domeBaseHeight,wingWidth}=config.building;
 const inner=radius-.08,outer=radius+.24,segments=192,positions=[],uv=[],indices=[],reveals=[];
 const turn=Math.PI*2;
 const angleOf=p=>(Math.atan2(p.z,p.x)+turn)%turn;
 const panels=layout.walls.filter(w=>w.hall==='center').map(wall=>{
  const [right,left]=wall.entrances.map(id=>layout.halls.find(h=>h.id===id));
  const a=entranceJunction(layout,right,1).inside,b=entranceJunction(layout,left,-1).inside;
  const start=angleOf(layout.world(left,b.x,b.z)),end=angleOf(layout.world(right,a.x,a.z));
  const arc=(end-start+turn)%turn, middle=(start+arc/2)%turn;
  const phase=2*Math.round((middle*radius/4-wall.length/8)/2);
  return {wall,start,end,arc,middle,phase};
 });
 // End the flat panel before following the vault on the opening side.
 // A separate sample keeps the lower edge from cutting across the junction.
 const returns=new Map();
 for(const panel of panels){
  returns.set((panel.start-1e-5+turn)%turn,panel);
  returns.set((panel.end+1e-5)%turn,panel);
 }
 const angles=[...new Set([
  ...Array.from({length:segments+1},(_,i)=>i/segments*turn),
  ...panels.flatMap(({start,end})=>[start,end]),...returns.keys(),
 ])].sort((a,b)=>a-b);
 const hallAt=(x,z)=>layout.halls.find(h=>{
  const p=layout.local(h,x,z);return p.z>=h.start-.5&&Math.abs(p.x)<=wingWidth/2+.2;
 });
 function bottom(x,z){
  const hall=hallAt(x,z);
  if(!hall)return height-.08;
  const t=Math.min(1,Math.abs(layout.local(hall,x,z).x)/(wingWidth/2));
  return height-vaultRise+vaultRise*Math.sqrt(1-t*t)-.025;
 }
 // Keep the painting face flush at the joint, then ease its footprint out to
 // the circular ring. At the dome all inner vertices have the same radius.
 const blendStart=height,blendEnd=height+(domeBaseHeight-height)*.88;
 const levels=[0,blendStart+.03,...Array.from({length:16},(_,i)=>blendStart+(blendEnd-blendStart)*(i+1)/16),domeBaseHeight];
 const levelsCount=levels.length, stride=levelsCount+6;
 for(const a of angles){
  const panel=panels.find(p=>(a-p.start+turn+1e-10)%turn<=p.arc+1e-9);
  const shoulder=returns.get(a),transition=panel??shoulder,flat=transition?.wall;
  const xDir=Math.cos(a),zDir=Math.sin(a);
  const face=flat?(flat.a.x*flat.normal.x+flat.a.z*flat.normal.z)/(xDir*flat.normal.x+zDir*flat.normal.z):inner;
  const base=panel?height:bottom(xDir*face,zDir*face);
  const roundU=a*radius/4;
  const flatU=flat?rotundaPlasterU(flat,xDir*face,zDir*face)+transition.phase:roundU;
  for(const y of [base,...levels.slice(1)]){
   const t=Math.max(0,Math.min(1,(y-blendStart)/(blendEnd-blendStart)));
   const ease=t*t*t*(10+t*(-15+6*t)),r=face+(inner-face)*ease;
   positions.push(xDir*r,y,zDir*r);
   uv.push(flatU+(roundU-flatU)*ease,y/4);
  }
  const outsideBase=panel?height:shoulder?base:bottom(xDir*outer,zDir*outer);
  positions.push(xDir*outer,outsideBase,zDir*outer,xDir*outer,domeBaseHeight,zDir*outer);
  uv.push(roundU,outsideBase/4,roundU,domeBaseHeight/4);
  // Give the caps separate vertices so their normals do not shade the walls.
  const first=positions.length/3-levelsCount-2;
  for(const v of [first,first+levelsCount-1,first+levelsCount,first+levelsCount+1]){
   positions.push(positions[v*3],positions[v*3+1],positions[v*3+2]);
   uv.push(uv[v*2],uv[v*2+1]);
  }
 }
 const colors=new Float32Array(positions.length).fill(1);
 const paints=new Map(layout.halls.map(hall=>[hall,entrancePaintColor(THREE,hall.color)]));
 for(let i=0;i<angles.length-1;i++){
  const a=i*stride,b=a+stride;
  for(let row=0;row<levelsCount-1;row++)indices.push(a+row,b+row,a+row+1,a+row+1,b+row,b+row+1);
  const aTop=a+levelsCount-1,bTop=b+levelsCount-1;
  indices.push(aTop+1,aTop+2,bTop+1,aTop+2,bTop+2,bTop+1,
   aTop+4,bTop+4,aTop+6,aTop+6,bTop+4,bTop+6);
  const angle=(angles[i]+angles[i+1])/2;
  const inPanel=panels.some(p=>(angle-p.start+turn)%turn<=p.arc);
  const paint=!inPanel&&paints.get(hallAt(inner*Math.cos(angle),inner*Math.sin(angle)));
  const cap=[aTop+3,aTop+5,bTop+3,aTop+5,bTop+5,bTop+3];
  if(paint){
   for(const index of cap)paint.toArray(colors,index*3);
   reveals.push(...cap);
  }else indices.push(...cap);
 }
 const geometry=new THREE.BufferGeometry();
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
 geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
 geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
 geometry.addGroup(0,indices.length,0);
 geometry.addGroup(indices.length,reveals.length,1);
 geometry.setIndex(indices.concat(reveals));
 geometry.computeVertexNormals();
 return geometry;
}
