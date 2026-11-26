import {LOWER_WALL_RADIUS,TOP_RAIL_GAP,stairTreads,topGuardPaths} from './stair-profile.js';
export function buildStairs(context){
 const {THREE, m, root, layout, stair, disposable, mesh, cylinder, shapeMesh, sector, sign}=context;
 // One continuous stair flight to the second floor, wrapped around a centre pier.
 const {innerRadius:inner,outerRadius:outer,depth}=stair;
 cylinder(0,-depth/2,0,inner*.8,inner*.9,depth+.3,m.stone);
 // The upper landing overlaps the floor slab; the first tread is exactly at y=0.
 const landing=shapeMesh(sector(-TOP_RAIL_GAP,stair.topLandingAngle,inner,stair.openingRadius+.4,12),[],-.22,.22,m.stone);landing.name='stair-top-landing';
 // The final tread is the lower landing itself: no duplicate coplanar top face.
 for(const {a,b,y}of stairTreads(stair).slice(0,-1)){
  shapeMesh(sector(a,b,inner,outer),[],y-.15,.15,m.stone);
 }
 // Guardrail around the opening, leaving only the staircase entrance open.
 const paths=topGuardPaths(stair);
 for(const [i,{x,z}] of paths.ring.entries()){
  const terminal=i===0||i===paths.ring.length-1;
  const radius=terminal ? .05 : .024;
  cylinder(x,.49,z,radius,radius,.98,m.darkWood,root,8);
  if(terminal){
   cylinder(x,.065,z,.097,.12,.13,m.gold);
   cylinder(x,1.005,z,.075,.085,.075,m.gold);
  }
 }
 const points=[...paths.outerFlight.toReversed(),...paths.outerJoin.toReversed().slice(1,-1),
  ...paths.ring,...paths.landing.slice(1),...paths.innerBridge.slice(1),...paths.innerFlight.slice(1)];
 const curve=new THREE.CatmullRomCurve3(points.map(({x,y,z})=>new THREE.Vector3(x,y,z)));
 mesh(new THREE.TubeGeometry(curve,points.length*3,.048,10,false),m.wood).name='stair-continuous-handrail';
 for(const {x,z} of paths.landing.slice(1))cylinder(x,.49,z,.026,.026,.98,m.darkWood,root,8);
 for(const path of [paths.innerFlight,paths.outerFlight]){
  for(const {x,y,z} of path)cylinder(x,y-.49,z,.026,.026,.98,m.darkWood,root,8);
  const {x,y,z}=path.at(-1);
  mesh(new THREE.SphereGeometry(.048,10,6),m.wood).position.set(x,y,z);
 }
 // Small landing at floor two; the future lair doorway is the sole connection.
 const radius=LOWER_WALL_RADIUS;
 cylinder(0,-depth-.15,0,radius,radius,.3,m.stone,root,48);
 const lowerMat=m.plaster.clone();lowerMat.side=THREE.BackSide;disposable.add(lowerMat);
 m.addWallPlaster?.(lowerMat);
 const receiver=layout.disposalStation,door=layout.lowerDoor,wallHeight=3.9;
 const width=2.8,height=3,halfWidth=width/2,halfArc=Math.asin(halfWidth/radius);
 const entry=receiver.bearing-receiver.arc,receiverEnd=entry+2*receiver.arc;
 const sweep=Math.PI*2,doorOffset=((door.angle-entry)%sweep+sweep)%sweep;
 const doorStart=entry+doorOffset-halfArc,doorEnd=entry+doorOffset+halfArc;
 const drum=(start,end,from,to)=>{
  const arc=end-start;
  const wall=mesh(new THREE.CylinderGeometry(radius,radius,to-from,Math.ceil(arc*12),1,true,start,arc),lowerMat);
  wall.position.y=-depth+(from+to)/2;
 };
 drum(receiverEnd,doorStart,0,wallHeight);
 drum(doorEnd,entry+sweep,0,wallHeight);
 drum(entry,receiverEnd,0,receiver.bottom);
 drum(entry,receiverEnd,receiver.bottom+receiver.height,wallHeight);
 drum(doorStart,doorEnd,height,wallHeight);

 const chord=radius*Math.cos(halfArc),recess=.055;
 const entrance=new THREE.Group();entrance.name='lair-door';root.add(entrance);
 entrance.position.set(Math.sin(door.angle)*chord,door.y,Math.cos(door.angle)*chord);
 entrance.rotation.y=door.angle+Math.PI;
 const material=m.make(0xffffff,'gouache-lair-door.webp');
 const facade=mesh(new THREE.PlaneGeometry(width,height),material,entrance);
 facade.name='lair-door-painted-face';facade.position.set(0,height/2,-recess);facade.castShadow=false;

 // Close the thin return between the curved wall and the recessed plane.
 // The returning surfaces sample the painted stone at the edges of the same texture.
 const pos=[],uv=[];
 const quad=(points,coords)=>{
  for(const i of [0,1,2,0,2,3]){pos.push(...points[i]);uv.push(...coords[i]);}
 };
 const strip=.018;
 quad([[-halfWidth,0,0],[-halfWidth,0,-recess],[-halfWidth,height,-recess],[-halfWidth,height,0]],
   [[strip,0],[0,0],[0,1],[strip,1]]);
 quad([[halfWidth,0,-recess],[halfWidth,0,0],[halfWidth,height,0],[halfWidth,height,-recess]],
   [[1,0],[1-strip,0],[1-strip,1],[1,1]]);
 const segments=Math.ceil(2*halfArc*12);
 for(let i=0;i<segments;i++){
  const a=-halfArc+2*halfArc*i/segments,b=-halfArc+2*halfArc*(i+1)/segments;
  const x=radius*Math.sin(a),nextX=radius*Math.sin(b),u=.5+x/width,nextU=.5+nextX/width;
  quad([[x,height,-recess],[nextX,height,-recess],[nextX,height,chord-radius*Math.cos(b)],[x,height,chord-radius*Math.cos(a)]],
    [[u,1],[nextU,1],[nextU,1-strip],[u,1-strip]]);
 }
 const reveal=new THREE.BufferGeometry();
 reveal.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));reveal.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
 reveal.computeVertexNormals();
 const returnMaterial=material.clone();returnMaterial.side=THREE.DoubleSide;disposable.add(returnMaterial);
 mesh(reveal,returnMaterial,entrance).castShadow=false;

 for(const x of [-.16,.16]){
  const points=[[1.25,-recess],[1.26,.018],[1.42,.042],[1.55,.018],[1.56,-recess]];
  const path=new THREE.CatmullRomCurve3(points.map(([y,z])=>new THREE.Vector3(x,y,z)));
  mesh(new THREE.TubeGeometry(path,20,.017,8,false),m.gold,entrance).name='lair-door-handle';
 }
 sign('Второй этаж · логово',0,3.27,chord-radius+.012,0,.8,entrance,radius-.012);
}
