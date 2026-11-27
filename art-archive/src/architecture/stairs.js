import {stairTreads} from './stair-profile.js';
export function buildStairs(context){
 const {THREE, m, root, upper, stair, disposable, mesh, box, cylinder, tube, shapeMesh, sector, sign}=context;
 // One continuous stair flight to the second floor, wrapped around a centre pier.
 const {innerRadius:inner,outerRadius:outer,depth,steps}=stair;
 cylinder(0,-depth/2,0,inner*.8,inner*.9,depth+.3,m.stone);
 // The upper landing overlaps the floor slab; the first tread is exactly at y=0.
 const landing=shapeMesh(sector(-.28,stair.topLandingAngle,inner,stair.openingRadius+.4,12),[],-.22,.22,m.stone);landing.name='stair-top-landing';
 for(const {index:i,a,b,y}of stairTreads(stair)){
  shapeMesh(sector(a,b,inner,outer),[],y-.15,.15,m.stone);
  const pos=(radius,t,dy)=>new THREE.Vector3(Math.sin(t)*radius,y+dy,Math.cos(t)*radius);
  for(const radius of [inner+.08,outer-.05]){
   if(radius>outer-.1&&i<2)continue;
   const p=pos(radius,a,.42);cylinder(p.x,p.y,p.z,.022,.022,.84,m.darkWood);
   tube([pos(radius,a,.88),pos(radius,b,.88-depth/steps)],.038,m.wood);
  }
 }
 // Guardrail around the opening, leaving only the staircase entrance open.
 const railR=stair.openingRadius+.02;
 const railPoints=[];
 const posts=42;
 for(let i=0;i<=posts;i++){
  const angle=.34+i/posts*(Math.PI*2-.68);
  const x=Math.sin(angle)*railR,z=Math.cos(angle)*railR;
  railPoints.push(new THREE.Vector3(x,.98,z));
  const terminal=i===0||i===posts;
  const radius=terminal ? .05 : .024;
  cylinder(x,.49,z,radius,radius,.98,m.darkWood,root,8);
  if(terminal){
   cylinder(x,.065,z,.097,.12,.13,m.gold);
   cylinder(x,1.005,z,.075,.085,.075,m.gold);
  }
 }
 tube(railPoints,.05,m.wood);
 // Small landing at floor two; the future lair doorway is the sole connection.
 cylinder(0,-depth-.15,0,5.5,5.5,.3,m.stone,root,48);
 const lowerMat=m.plaster.clone();lowerMat.side=THREE.BackSide;disposable.add(lowerMat);
 const drum=mesh(new THREE.CylinderGeometry(5.5,5.5,3.9,48,1,true),lowerMat);drum.position.y=-depth/2-.2;
 box(0,-depth+1.35,-5.2,2.4,2.7,.18,m.darkWood);
 for(const x of [-1.3,1.3])box(x,-depth+1.4,-5.05,.18,2.9,.25,m.ivory);
 box(0,-depth+2.9,-5.05,2.8,.18,.25,m.ivory);
 sign('Второй этаж · логово',0,-depth+3.1,-4.98,0,.8);

}
