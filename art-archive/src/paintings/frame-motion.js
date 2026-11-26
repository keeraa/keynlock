// Collision volumes use the outer wooden frame. Coordinates here are world metres.
import {frameDimensions,frameOrientation} from '../../catalog/painting-geometry.js';
import {furnitureBounds} from '../architecture/furniture-bounds.js';
import {supportHeightAt} from '../architecture/support-height.js';
import {LOWER_WALL_RADIUS,TOP_RAIL_GAP,stairTreads,guardSegments,topGuardPaths} from '../architecture/stair-profile.js';
export function createFrameMotion(THREE,config,layout){
  const {frameWidthM,frameDepthM}=config.paintings,fy=config.building.floorElevation;
  const v=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
  const basis=[v(1,0,0),v(0,1,0),v(0,0,1)];
  const delta=v(),cross=v(),p=v(),q=new THREE.Quaternion();
  let obstacles=[];
  const boxes=new WeakMap();
  function pose(slot){
    const {pitch,yaw}=frameOrientation(slot),rotation=new THREE.Euler(pitch,yaw,0,'YXZ');
    return {position:v(slot.x,fy+slot.y,slot.z),quaternion:new THREE.Quaternion().setFromEuler(rotation)};
  }
  function box(slot,position,rotation){
    const axes=basis.map(a=>a.clone().applyQuaternion(rotation));
    const size=frameDimensions(slot,config.paintings),half=[size.width/2,size.height/2,size.depth/2];
    return {position,axes,half,radius:Math.hypot(...half)};
  }
  function radiusOn(b,n){
    return b.half[0]*Math.abs(b.axes[0].dot(n))+b.half[1]*Math.abs(b.axes[1].dot(n))+b.half[2]*Math.abs(b.axes[2].dot(n));
  }
  function intersects(a,b){
    delta.subVectors(a.position,b.position);
    if(delta.lengthSq()>=(a.radius+b.radius)**2)return false;
    const separate=n=>Math.abs(delta.dot(n))>=radiusOn(a,n)+radiusOn(b,n)-.00005;
    if(a.axes.some(separate)||b.axes.some(separate))return false;
    for(const x of a.axes)for(const y of b.axes){
      cross.crossVectors(x,y);
      if(cross.lengthSq()>1e-9 && separate(cross.normalize()))return false;
    }
    return true;
  }
  const walls=(layout?.hangingWalls??[]).map(w=>({
    position:v((w.a.x+w.b.x)/2-w.normal.x*.2,fy+config.building.height/2,(w.a.z+w.b.z)/2-w.normal.z*.2),
    axes:[v((w.b.x-w.a.x)/w.length,0,(w.b.z-w.a.z)/w.length),v(0,1,0),v(w.normal.x,0,w.normal.z)],
    half:[w.length/2,config.building.height/2,.2],radius:Math.hypot(w.length/2,config.building.height/2,.2)
  }));
  const furniture=furnitureBounds(layout,config.paintings).map(slot=>{const p=pose(slot);return box(slot,p.position,p.quaternion);});
  const rail=[];
  if(layout && config.building.stair){
    for(const [a,b] of guardSegments(Object.values(topGuardPaths(config.building.stair)))){
      const dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz);
      const bottom=Math.min(a.y,b.y)-.99,top=Math.max(a.y,b.y)+.055,halfHeight=(top-bottom)/2;
      rail.push({position:v((a.x+b.x)/2,fy+(top+bottom)/2,(a.z+b.z)/2),
        axes:[v(dx/length,0,dz/length),v(0,1,0),v(-dz/length,0,dx/length)],
        half:[length/2+.025,halfHeight,.069],radius:Math.hypot(length/2+.025,halfHeight,.069)});
    }
  }
  // Convex pieces of the rendered stairwell. Checking the whole frame against
  // these volumes also catches a corner crossing a riser or the floor slab.
  const structure=[];
  function prism(points,bottom,top){
    const center=v(points.reduce((n,p)=>n+p.x,0)/points.length,fy+(bottom+top)/2,points.reduce((n,p)=>n+p.z,0)/points.length);
    const vertices=points.flatMap(p=>[v(p.x,fy+bottom,p.z),v(p.x,fy+top,p.z)]);
    const edges=points.map((p,i)=>v(points[(i+1)%points.length].x-p.x,0,points[(i+1)%points.length].z-p.z).normalize());
    const normals=[basis[1],...edges.map(e=>v(-e.z,0,e.x))];
    structure.push({position:center,radius:Math.max(...vertices.map(p=>p.distanceTo(center))),vertices,normals,edges:[basis[1],...edges]});
  }
  function sector(a,b,inner,outer,bottom,top,segments=4){
    for(let i=0;i<segments;i++){
      const left=a+(b-a)*i/segments,right=a+(b-a)*(i+1)/segments;
      prism([[inner,left],[outer,left],[outer,right],[inner,right]].map(([r,t])=>({x:r*Math.sin(t),z:r*Math.cos(t)})),bottom,top);
    }
  }
  if(layout&&config.building.stair){
    const s=config.building.stair;
    for(const t of stairTreads(s).slice(0,-1))sector(t.a,t.b,s.innerRadius,s.outerRadius,t.y-.15,t.y);
    sector(-TOP_RAIL_GAP,s.topLandingAngle,s.innerRadius,s.openingRadius+.4,-.22,0,12);
    sector(0,Math.PI*2,s.openingRadius,config.building.radius,-.22,0,64);
    sector(0,Math.PI*2,.001,s.innerRadius*.9,-s.depth-.15,.15,12);
    const receiver=layout.disposalStation,door=layout.lowerDoor,r=LOWER_WALL_RADIUS;
    if(receiver&&door){
      const halfArc=Math.asin(1.4/r),entry=receiver.bearing-receiver.arc,end=entry+2*receiver.arc;
      const offset=((door.angle-entry)%(Math.PI*2)+Math.PI*2)%(Math.PI*2),start=entry+offset-halfArc,finish=start+2*halfArc;
      const wall=(a,b,low,high)=>sector(a,b,r-.015,r+.08,-s.depth+low,-s.depth+high,Math.ceil((b-a)*12));
      wall(end,start,0,3.9);wall(finish,entry+Math.PI*2,0,3.9);
      wall(entry,end,0,receiver.bottom);wall(entry,end,receiver.bottom+receiver.height,3.9);wall(start,finish,3,3.9);
      // The painted door closes its opening, with the same recessed chord.
      const chord=r*Math.cos(halfArc)+.055,sin=Math.sin(door.angle),cos=Math.cos(door.angle);
      prism([[-1.4,chord-.015],[1.4,chord-.015],[1.4,chord+.08],[-1.4,chord+.08]].map(([x,z])=>({x:x*cos+z*sin,z:z*cos-x*sin})),-s.depth,-s.depth+3);
    }
  }
  function intersectsPrism(b,solid){
    if(b.position.distanceToSquared(solid.position)>=(b.radius+solid.radius)**2)return false;
    const separate=n=>{
      let lo=Infinity,hi=-Infinity;
      for(const p of solid.vertices){const t=p.dot(n);lo=Math.min(lo,t);hi=Math.max(hi,t);}
      const center=b.position.dot(n),radius=radiusOn(b,n);
      return center+radius<=lo+.00005||center-radius>=hi-.00005;
    };
    if(b.axes.some(separate)||solid.normals.some(separate))return false;
    for(const a of b.axes)for(const edge of solid.edges){
      cross.crossVectors(a,edge);
      if(cross.lengthSq()>1e-9&&separate(cross.normalize()))return false;
    }
    return true;
  }
  function blocked(slot,position,rotation){
    const b=box(slot,position,rotation);
    const floor=fy+supportHeightAt(position.x,position.z,position.y-fy,config);
    return position.y-radiusOn(b,basis[1])<floor-.00005 || furniture.some(w=>intersects(b,w)) || rail.some(w=>intersects(b,w)) || walls.some(w=>intersects(b,w)) || obstacles.some(o=>intersects(b,o)) || structure.some(w=>intersectsPrism(b,w));
  }
  function copy(a){return {position:a.position.clone(),quaternion:a.quaternion.clone()};}
  function advance(slot,from,to){
    const size=frameDimensions(slot,config.paintings),reach=Math.hypot(size.width/2,size.height/2);
    const distance=from.position.distanceTo(to.position)+reach*from.quaternion.angleTo(to.quaternion);
    const count=Math.max(1,Math.ceil(distance/(frameDepthM*.7)));
    for(let i=1;i<=count;i++){
      p.lerpVectors(from.position,to.position,i/count);q.slerpQuaternions(from.quaternion,to.quaternion,i/count);
      if(blocked(slot,p,q))return (i-1)/count;
    }
    return 1;
  }
  function route(slot,from,to,{lowArc=false,wallNormal=null,pickup=false}={}){
    const start=copy(from),finish=copy(to);
    const clear=points=>points.slice(1).every((b,i)=>advance(slot,points[i],b)===1);
    if(wallNormal){
      // Move the flat frame away from the wall before turning a long edge into the room.
      const size=frameDimensions(slot,config.paintings);
      const turnRoom=Math.hypot(size.width,size.depth)/2+.09;
      const retreat=Math.max(0,(finish.position.x-start.position.x)*wallNormal.x+
        (finish.position.z-start.position.z)*wallNormal.z);
      for(const distance of [...new Set([.24,.52,.92,retreat,turnRoom])].filter(d=>d>=.12).sort((a,b)=>a-b)){
        const released=copy(start);
        released.position.x+=wallNormal.x*distance;
        released.position.z+=wallNormal.z*distance;
        const path=[start,released,finish];
        if(clear(path))return path;
        const turned=copy(released);turned.quaternion.copy(finish.quaternion);
        if(clear([start,released,turned,finish]))return [start,released,turned,finish];
      }
      return null;
    }
    if(clear([start,finish]))return [start,finish];
    if(pickup){
      // Tilt a floor frame while lifting its actual lower edge. A wide canvas
      // does not need its full diagonal radius of clearance above the floor.
      for(const extra of [.025,.12,.3]){
        const path=[start];
        const count=Math.max(24,Math.ceil(start.position.distanceTo(finish.position)/.06));
        let valid=true;
        for(let i=1;i<=count;i++){
          const t=i/count,point=copy(finish);
          point.position.lerpVectors(start.position,finish.position,t);
          point.quaternion.slerpQuaternions(start.quaternion,finish.quaternion,t);
          const volume=box(slot,point.position,point.quaternion),halfY=radiusOn(volume,basis[1]);
          const floor=fy+supportHeightAt(point.position.x,point.position.z,point.position.y-fy,config);
          point.position.y=Math.max(point.position.y,floor+halfY+extra*Math.sin(Math.PI*t));
          if(point.position.y+halfY>fy+config.building.height||advance(slot,path.at(-1),point)!==1){valid=false;break;}
          path.push(point);
        }
        if(valid&&clear([path.at(-1),finish]))return [...path,finish];
      }
    }
    if(pickup){
      // First stand a room-wide floor canvas up at its own centre. Turning it
      // while still flat sweeps its diagonal into both side walls.
      const widthAxis=basis[0].clone().applyQuaternion(start.quaternion);
      const upright=new THREE.Quaternion().setFromAxisAngle(basis[1],Math.atan2(-widthAxis.z,widthAxis.x));
      const path=[start];let clearTilt=true;
      for(let i=1;i<=32;i++){
        const point=copy(start);point.quaternion.slerpQuaternions(start.quaternion,upright,i/32);
        const volume=box(slot,point.position,point.quaternion),halfY=radiusOn(volume,basis[1]);
        const floor=fy+supportHeightAt(point.position.x,point.position.z,point.position.y-fy,config);
        point.position.y=Math.max(start.position.y,floor+halfY+.012*Math.sin(Math.PI*i/64));
        if(point.position.y+halfY>fy+config.building.height||advance(slot,path.at(-1),point)!==1){clearTilt=false;break;}
        path.push(point);
      }
      if(clearTilt){const rest=route(slot,path.at(-1),finish);if(rest)return [...path,...rest.slice(1)];}
    }
    // Rotate clear of the floor and stacks, then lower the frame flat onto its support.
    const size=frameDimensions(slot,config.paintings),radius=Math.hypot(size.width/2,size.height/2,size.depth/2);
    if(lowArc){
      // Turn flat beside the player, slide just above the tabletop, then settle.
      // Once flat, clearance is the frame depth, not its diagonal radius.
      const floor=fy+supportHeightAt(start.position.x,start.position.z,start.position.y-fy,config);
      for(const extra of [.025,.08,.16]){
        const raised=copy(start),turned=copy(finish),above=copy(finish);
        raised.position.y=Math.max(start.position.y,floor+radius+.015,finish.position.y+extra);
        turned.position.copy(raised.position);above.position.y=Math.max(finish.position.y+extra,raised.position.y);
        const path=[start,raised,turned,above,finish];if(clear(path))return path;
      }
    }
    for(const extra of [.06,.5,1.2]){
      const floor=fy+Math.max(supportHeightAt(start.position.x,start.position.z,start.position.y-fy,config),supportHeightAt(finish.position.x,finish.position.z,finish.position.y-fy,config));
      const y=Math.max(start.position.y,floor+radius,finish.position.y+radius)+extra;
      if(y+radius>fy+config.building.height)continue;
      const raised=copy(start),above=copy(finish);
      raised.position.y=y;above.position.y=y;
      const path=[start,raised,above,finish];if(clear(path))return path;
      // A held painting can follow the player around an obstacle rather than
      // repeatedly trying the same straight segment through a corner.
      for(const acrossX of [true,false]){
        const corner=copy(above);corner.position.x=acrossX?finish.position.x:start.position.x;
        corner.position.z=acrossX?start.position.z:finish.position.z;
        const detour=[start,raised,corner,above,finish];if(clear(detour))return detour;
      }
    }
    return null;
  }
  function throwRoute(slot,from,to){
    const start=copy(from),finish=copy(to),distance=start.position.distanceTo(finish.position);
    const size=frameDimensions(slot,config.paintings),radius=Math.hypot(size.width,size.height)/2;
    // A short ballistic arc starts at the actual held pose and settles face-up.
    for(const seconds of [Math.min(1.1,.42+distance*.09),Math.min(.8,.30+distance*.06)]){
      const gravity=9.81,vy=(finish.position.y-start.position.y+.5*gravity*seconds*seconds)/seconds;
      const count=Math.max(12,Math.ceil((distance+radius*start.quaternion.angleTo(finish.quaternion))/.08));
      const path=[start];let clear=true;
      for(let i=1;i<=count;i++){
        const t=i/count,point=copy(finish);
        point.position.lerpVectors(start.position,finish.position,t);
        point.position.y=start.position.y+vy*seconds*t-.5*gravity*(seconds*t)**2;
        point.quaternion.slerpQuaternions(start.quaternion,finish.quaternion,t*t*(3-2*t));
        if(point.position.y+radiusOn(box(slot,point.position,point.quaternion),basis[1])>fy+config.building.height || advance(slot,path.at(-1),point)!==1){clear=false;break;}
        path.push(point);
      }
      if(clear)return {path,duration:seconds*1000};
    }
    return null;
  }
  return {pose,blocked,advance,route,throwRoute,setObstacles(slots){
    obstacles=slots.map(s=>{if(!boxes.has(s)){const {position,quaternion}=pose(s);boxes.set(s,box(s,position,quaternion));}return boxes.get(s);});
  }};
}
