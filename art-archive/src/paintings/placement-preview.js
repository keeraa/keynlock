import {createPaintingProps} from './props.js';
import {overviewGeometry} from './overview.js';
import {frameDimensions,frameOrientation} from '../../catalog/painting-geometry.js';
import {trolleyDimensions} from './trolley-model.js';
import {supportHeightAt} from '../architecture/support-height.js';

export function createPlacementPreview(THREE,world,display,config,motion) {
  const root=new THREE.Group(), rig=new THREE.Group(),settings=config.paintings;
  const basic=color=>new THREE.MeshBasicMaterial({color});
  const metal=basic(0x91724a), steel=basic(0x45403a);
  const unit=new THREE.BoxGeometry();
  function bar(parent,material) {
    const mesh=new THREE.Mesh(unit,material);parent.add(mesh);return mesh;
  }
  const wires=[bar(rig,steel),bar(rig,steel)],beam=bar(rig,metal);
  const props=createPaintingProps(THREE,settings);
  let cart=new THREE.Group(),seal=null,ghostSeal=null;
  const mat=new THREE.MeshBasicMaterial({map:display.texture??null});
  display.gouache?.apply(mat);
  const fast=new THREE.Mesh(new THREE.BufferGeometry(),mat);
  const tint=new THREE.MeshBasicMaterial({color:0xff2727,transparent:true,opacity:.48,depthWrite:false});
  const plane=new THREE.PlaneGeometry(1,1);
  const red=new THREE.Mesh(plane,tint);red.position.z=settings.frameDepthM*.52+.004;red.renderOrder=2;
  const ghost=new THREE.Group(), image=new THREE.Mesh(fast.geometry,mat);
  ghost.name='wall-preview';root.name='carried-painting';
  const carryInk=world.ink?.shell(fast.geometry), ghostInk=world.ink?.shell(fast.geometry);
  if(carryInk){root.add(carryInk);ghost.add(ghostInk);}
  ghost.add(image,red,rig);root.add(fast,cart);world.scene.add(root,ghost);
  const glowMat=new THREE.MeshBasicMaterial({color:0xffe5a3,transparent:true,opacity:0,depthWrite:false});
  const glowBox=new THREE.BoxGeometry(1,1,1);
  const glow=new THREE.Mesh(glowBox,glowMat);glow.name='floor-focus';world.scene.add(glow);
  root.visible=ghost.visible=glow.visible=false;
  let detailGhost=null,last=0,lift=null,hovered=null,hoverTime=0;
  let wallFlight=null;
  const smooth=t=>t*t*t*(10+t*(-15+6*t));
  const lastEyeRotation=new THREE.Quaternion(),lastEyePosition=new THREE.Vector3();
  const cameraDelta=new THREE.Quaternion(),carriedFrom=new THREE.Vector3();
  const carryRotation=new THREE.Matrix4();
  const previous={position:new THREE.Vector3(),quaternion:new THREE.Quaternion()};
  const goal={position:new THREE.Vector3(),quaternion:new THREE.Quaternion()};
  let view=null,current=null,request=0;
  function select(slot){
    if(slot===current)return;
    if(slot && slot.painting.id===current?.painting.id)return;
    wallFlight=null;lift=null;
    cart.removeFromParent();cart=new THREE.Group();
    seal?.removeFromParent();ghostSeal?.removeFromParent();seal=ghostSeal=null;
    const generation=++request;
    detailGhost?.removeFromParent();detailGhost=null;
    current=slot;view?.object.removeFromParent();view?.dispose();view=null;
    fast.geometry.dispose();root.visible=false;
    if(!slot){fast.geometry=new THREE.BufferGeometry();return;}
    cart=props.cart(slot);root.add(cart);
    if(slot.destination?.split('/')[0]==='center'){seal=props.badge(slot);ghostSeal=props.badge(slot);root.add(seal);ghost.add(ghostSeal);}
    const fallback={...slot,x:0,y:0,z:0,normal:{x:0,z:1},floorAngle:undefined};
    fast.geometry=display.atlas?overviewGeometry(THREE,[fallback],display.atlas,display.renderSettings??settings):new THREE.BufferGeometry();
    if(carryInk){carryInk.geometry=ghostInk.geometry=fast.geometry;}
    image.geometry=fast.geometry;image.visible=fast.visible=true;
    red.scale.set(slot.width,slot.height+2*settings.frameWidthM,1);
    display.detail?.(slot.painting,true,slot.destination).then(model=>{
      if(generation!==request){model.dispose();return;}
      view=model;root.add(model.object);detailGhost=model.object.clone();ghost.add(detailGhost);image.visible=fast.visible=false;
    }).catch(()=>{}); // The atlas remains visible if the detailed texture is unavailable.
  }
  function beginWall(now){
    wallFlight={position:root.position.clone(),quaternion:root.quaternion.clone(),start:now};
  }
  function wall(slot,w,along,y,valid,large,now){
    ghost.visible=true;
    const depth=settings.wallClearanceM+settings.frameDepthM/2+(valid?0:.035);
    ghost.position.set(w.a.x+(w.b.x-w.a.x)*along/w.length+w.normal.x*depth,config.building.floorElevation+y,
      w.a.z+(w.b.z-w.a.z)*along/w.length+w.normal.z*depth);
    ghost.rotation.set(0,Math.atan2(w.normal.x,w.normal.z),0);
    if(wallFlight){
      const t=Math.max(0,Math.min(1,(now-wallFlight.start)/360));
      ghost.position.lerp(wallFlight.position,1-smooth(t));
      ghost.quaternion.slerp(wallFlight.quaternion,1-smooth(t));
      if(t===1)wallFlight=null;
    }
    red.visible=!valid;rig.visible=large && !wallFlight;
    if(large){
      const top=frameDimensions(slot,settings).height/2;
      const end=Math.max(top+.09,config.building.height-.32-y);
      for(let i=0;i<2;i++){
        wires[i].position.set((i-.5)*slot.width*.72,(end+top)/2,.02);
        wires[i].scale.set(.027,end-top,.027);
      }
      beam.position.set(0,end,.02);beam.scale.set(slot.width*.78,.08,.075);
    }
  }
  function carry(slot,large,hall,origin,dir,source,raised){
    root.visible=true;cart.visible=large;
    const fy=config.building.floorElevation;
    if(!large || raised){
      const eye=world.camera;
      cart.visible=false;
      root.quaternion.copy(eye.quaternion);
      root.rotateX(raised?0:-.58);
      const tan=Math.tan(eye.fov*Math.PI/360);
      if(raised){
        const distance=Math.max(.65,(slot.height+2*settings.frameWidthM)/(1.7*tan),slot.width/(1.7*tan*eye.aspect));
        root.position.set(0,0,-distance).applyQuaternion(eye.quaternion).add(eye.position);
        return;
      }
      root.position.set(.35+slot.width*.26,-.32-slot.height*.38,-.72-slot.width*.3)
        .applyQuaternion(eye.quaternion).add(eye.position);
      return;
    }
    const layout=world.layout;
    // Park ahead, upright and facing the player even when the pickup ray points down.
    const yaw=Math.atan2(-dir.x,-dir.z);
    const turn=.93, halfWidth=slot.width/2;
    const distance=1.2+Math.sin(turn)*halfWidth;
    const side=halfWidth*Math.cos(turn)+.48;
    const cartYaw=yaw-turn;
    let x=origin.x-Math.sin(yaw)*distance+Math.cos(yaw)*side,z=origin.z-Math.cos(yaw)*distance-Math.sin(yaw)*side;
    if(hall){
      const p=layout.local(hall,x,z);
      const angle=cartYaw-hall.angle;
      const clamp=(v,lo,hi)=>lo>hi?(lo+hi)/2:Math.max(lo,Math.min(hi,v));
      const across=Math.abs(Math.cos(angle))*slot.width/2+.32;
      const along=Math.abs(Math.sin(angle))*slot.width/2+.32;
      ({x,z}=layout.world(hall,clamp(p.x,-hall.width/2+across,hall.width/2-across),
        clamp(p.z,hall.start+along,hall.start+hall.length-along)));
    }
    root.rotation.set(0,cartYaw,0);root.position.set(x,fy+trolleyDimensions(slot,settings).centerHeight,z);

  }
  function beginLift(slot,now){
    const from=motion.pose(slot);root.position.copy(from.position);root.quaternion.copy(from.quaternion);
    lift={from,start:now,duration:480+Math.min(400,slot.width*60)};last=now;
  }
  function follow(slot,large,hall,origin,dir,source,now,raised){
    previous.position.copy(root.position);previous.quaternion.copy(root.quaternion);
    carry(slot,large,hall,origin,dir,source,raised);
    const floorY=config.building.floorElevation+supportHeightAt(root.position.x,root.position.z,root.position.y-config.building.floorElevation,config);
    const size=frameDimensions(slot,settings);
    const orientation=carryRotation.makeRotationFromQuaternion(root.quaternion).elements;
    const halfY=(Math.abs(orientation[1])*size.width+Math.abs(orientation[5])*size.height+Math.abs(orientation[9])*size.depth)/2;
    root.position.y=Math.max(floorY+halfY+.04,root.position.y);
    const dt=Math.max(0,Math.min(.1,(now-last)/1000));last=now;
    if(lift){
      const t=Math.max(0,Math.min(1,(now-lift.start)/lift.duration)),k=smooth(t);
      root.position.lerp(lift.from.position,1-k);
      root.quaternion.slerp(lift.from.quaternion,1-k);
      // Clearance tracks the rotating frame, including the corners of monumental works.
      const m=carryRotation.makeRotationFromQuaternion(root.quaternion).elements;
      const extent=(Math.abs(m[1])*size.width+Math.abs(m[5])*size.height+Math.abs(m[9])*size.depth)/2;
      const arc=Math.sin(Math.PI*t)**2*Math.min(.55,.16+.1*slot.width);
      root.position.y=Math.max(root.position.y+arc,floorY+extent);
      cart.visible=large && !raised && t===1;
      if(t===1)lift=null;
    }else{
      const t=1-Math.exp(-12*dt);
      carriedFrom.copy(previous.position);
      if(!large || raised){
        const eye=world.camera;
        cameraDelta.copy(eye.quaternion).multiply(lastEyeRotation.invert());
        carriedFrom.sub(lastEyePosition).applyQuaternion(cameraDelta).add(eye.position);
        goal.quaternion.copy(previous.quaternion).premultiply(cameraDelta);
        root.quaternion.slerp(goal.quaternion,1-t);
      }else root.quaternion.slerp(previous.quaternion,1-t);
      root.position.lerpVectors(carriedFrom,root.position,t);
    }
    lastEyeRotation.copy(world.camera.quaternion);lastEyePosition.copy(world.camera.position);
    goal.position.copy(root.position);goal.quaternion.copy(root.quaternion);
    let t=motion.advance(slot,previous,goal);
    if(lift && t<.001 && dt>0){
      // Clear the stack before rotating a tall frame upright.
      goal.position.copy(previous.position);goal.position.y=Math.min(config.building.floorElevation+config.building.height-slot.height/2,goal.position.y+dt*2);
      goal.quaternion.copy(previous.quaternion);
      t=motion.advance(slot,previous,goal);
    }
    root.position.lerpVectors(previous.position,goal.position,t);
    root.quaternion.slerpQuaternions(previous.quaternion,goal.quaternion,t);
  }
  function dropPath(slot){return motion.route(slot,ghost.visible?ghost:root,motion.pose(slot));}
  function lowering(path,p){
    root.visible=true;cart.visible=false;ghost.visible=false;
    const lengths=path.slice(1).map((b,i)=>b.position.distanceTo(path[i].position)+.25*b.quaternion.angleTo(path[i].quaternion));
    let d=p*p*(3-2*p)*lengths.reduce((a,b)=>a+b,0),i=0;
    while(i<lengths.length-1 && d>lengths[i])d-=lengths[i++];
    const k=Math.min(1,d/Math.max(.000001,lengths[i]));
    root.position.lerpVectors(path[i].position,path[i+1].position,k);
    root.quaternion.slerpQuaternions(path[i].quaternion,path[i+1].quaternion,k);
  }
  function hover(slot,now){
    const dt=Math.min(.1,Math.max(0,(now-hoverTime)/1000));hoverTime=now;
    if(slot && slot.painting.id!==hovered?.painting.id){hovered=slot;glowMat.opacity=0;}
    glowMat.opacity+=((slot ? .15 : 0)-glowMat.opacity)*(1-Math.exp(-12*dt));
    glow.visible=Boolean(hovered)&&glowMat.opacity>.002;
    if(!glow.visible || !hovered)return;
    const size=frameDimensions(hovered,settings),{pitch,yaw}=frameOrientation(hovered);
    glow.scale.set(size.width+.008,size.height+.008,size.depth+.008);
    glow.rotation.set(pitch,yaw,0,'YXZ');
    glow.position.set(hovered.x,config.building.floorElevation+hovered.y,hovered.z);
  }
  return {retainWall(){ghost.visible=true;root.visible=false;red.visible=true;},parkPose(){return root.visible && cart.visible && !lift ? {position:root.position.clone(),quaternion:root.quaternion.clone()} : null;},select,beginWall,wall,follow,beginLift,lowering,dropPath,hover,hide(){root.visible=ghost.visible=false;},
    resetHover(){glow.visible=false;glowMat.opacity=0;hovered=null;},
    dispose(){select(null);root.removeFromParent();ghost.removeFromParent();glow.removeFromParent();glowMat.dispose();
    fast.geometry.dispose();plane.dispose();glowBox.dispose();unit.dispose();props.dispose();for(const m of [metal,steel,tint,mat])m.dispose();}};
}
