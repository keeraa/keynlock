// Collision volumes use the outer wooden frame. Coordinates here are world metres.
import {frameDimensions,frameOrientation} from '../../catalog/painting-geometry.js';
import {furnitureBounds} from '../architecture/furniture-bounds.js';
import {supportHeightAt} from '../architecture/support-height.js';
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
    const radius=config.building.stair.openingRadius+.02;
    for(let i=0;i<42;i++){
      const a=.34+i/42*(Math.PI*2-.68),b=.34+(i+1)/42*(Math.PI*2-.68),mid=(a+b)/2;
      rail.push({position:v(Math.sin(mid)*radius,fy+.52,Math.cos(mid)*radius),
        axes:[v(Math.cos(mid),0,-Math.sin(mid)),v(0,1,0),v(Math.sin(mid),0,Math.cos(mid))],
        half:[radius*Math.sin((b-a)/2)+.025,.55,.09],radius:1});
    }
  }
  function blocked(slot,position,rotation){
    const b=box(slot,position,rotation);
    const floor=fy+supportHeightAt(position.x,position.z,position.y-fy,config);
    return position.y-radiusOn(b,basis[1])<floor-.00005 || furniture.some(w=>intersects(b,w)) || rail.some(w=>intersects(b,w)) || walls.some(w=>intersects(b,w)) || obstacles.some(o=>intersects(b,o));
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
  function route(slot,from,to){
    const start=copy(from),finish=copy(to);
    const clear=points=>points.slice(1).every((b,i)=>advance(slot,points[i],b)===1);
    if(clear([start,finish]))return [start,finish];
    // Rotate clear of the floor and stacks, then lower the frame flat onto its support.
    const size=frameDimensions(slot,config.paintings),radius=Math.hypot(size.width/2,size.height/2,size.depth/2);
    for(const extra of [.06,.5,1.2]){
      const y=Math.max(start.position.y,fy+radius,finish.position.y+radius)+extra;
      if(y+radius>fy+config.building.height)continue;
      const raised=copy(start),above=copy(finish);
      raised.position.y=y;above.position.y=y;
      const path=[start,raised,above,finish];if(clear(path))return path;
    }
    return null;
  }
  return {pose,blocked,advance,route,setObstacles(slots){
    obstacles=slots.map(s=>{if(!boxes.has(s)){const {position,quaternion}=pose(s);boxes.set(s,box(s,position,quaternion));}return boxes.get(s);});
  }};
}
