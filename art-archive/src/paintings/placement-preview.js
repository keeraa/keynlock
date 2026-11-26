import {createPaintingProps} from './props.js';
import {overviewGeometry} from './overview.js';
import {frameDimensions,frameOrientation,mountedFrame,frameCornerCut,clippedFrameCorners} from '../../catalog/painting-geometry.js';
import {trolleyDimensions} from './trolley-model.js';
import {TOP_RAIL_GAP} from '../architecture/stair-profile.js';
import {supportHeightAt} from '../architecture/support-height.js';

export function createPlacementPreview(THREE,world,display,config,motion) {
  const root=new THREE.Group(),settings=config.paintings;
  const props=createPaintingProps(THREE,settings);
  let cart=new THREE.Group(),seal=null;
  const mat=new THREE.MeshBasicMaterial({map:display.texture??null});
  display.gouache?.apply(mat);
  const fast=new THREE.Mesh(new THREE.BufferGeometry(),mat);
  const ghost=new THREE.Group();ghost.name='wall-preview';root.name='carried-painting';
  const carryInk=world.ink?.shell(fast.geometry);
  if(carryInk)root.add(carryInk);
  root.add(fast,cart);world.scene.add(root,ghost);
  // Share the carried atlas geometry and texture; the hint owns only its materials and outline.
  const tableGhost=new THREE.Group();tableGhost.name='table-placement-preview';
  const tableMat=new THREE.MeshBasicMaterial({map:display.texture??null,transparent:true,opacity:.55,depthWrite:false});
  display.gouache?.apply(tableMat);
  const tableImage=new THREE.Mesh(fast.geometry,tableMat);
  const tableInvalidColor=new THREE.Color(0xff3939);
  const dashMat=new THREE.MeshBasicMaterial({color:0xffe5a3,transparent:true,opacity:.9,depthWrite:false,side:THREE.DoubleSide});
  const tableOutline=new THREE.Mesh(new THREE.BufferGeometry(),dashMat);tableOutline.name='table-placement-outline';
  tableGhost.add(tableImage,tableOutline);tableGhost.visible=false;world.scene.add(tableGhost);
  const glowMat=new THREE.MeshBasicMaterial({color:0xffe5a3,transparent:true,opacity:0,depthWrite:false});
  const glowBox=new THREE.BoxGeometry(1,1,1);
  const glow=new THREE.Mesh(glowBox,glowMat);glow.name='floor-focus';world.scene.add(glow);
  root.visible=ghost.visible=glow.visible=false;
  let tableDetail=null,tablePairs=[],tableTime=-Infinity;
  function clearTableDetail(){tableDetail?.removeFromParent();tableDetail=null;for(const pair of tablePairs)pair.material.dispose();tablePairs=[];}
  let last=0,lift=null,hovered=null,hoverTime=0;
  let wallFlight=null,returnFlight=null,liftFailure=false,stuckSince=null,parkingPose=null,avoidance=null,preferredClearSince=null;
  const parked={position:new THREE.Vector3(),quaternion:new THREE.Quaternion()};
  const smooth=t=>t*t*t*(10+t*(-15+6*t));
  const lastEyeRotation=new THREE.Quaternion(),lastEyePosition=new THREE.Vector3();
  const cameraDelta=new THREE.Quaternion(),carriedFrom=new THREE.Vector3();
  const carryRotation=new THREE.Matrix4();
  const previous={position:new THREE.Vector3(),quaternion:new THREE.Quaternion()};
  const goal={position:new THREE.Vector3(),quaternion:new THREE.Quaternion()};
  let view=null,current=null,request=0,stairCarry=false;
  function select(slot){
    if(slot===current)return;
    if(slot && slot.painting.id===current?.painting.id)return;
    wallFlight=returnFlight=null;lift=null;liftFailure=false;stuckSince=null;parkingPose=null;avoidance=null;preferredClearSince=null;
    cart.removeFromParent();cart=new THREE.Group();
    seal?.removeFromParent();seal=null;
    const generation=++request;
    tableGhost.visible=false;tableTime=-Infinity;clearTableDetail();
    current=slot;view?.object.removeFromParent();view?.dispose();view=null;
    fast.geometry.dispose();root.visible=false;
    if(!slot){fast.geometry=new THREE.BufferGeometry();return;}
    cart=props.cart(slot);root.add(cart);
    if(slot.destination?.split('/')[0]==='center'){seal=props.badge(slot);root.add(seal);}
    const fallback={...slot,x:0,y:0,z:0,normal:{x:0,z:1},floorAngle:undefined};
    fast.geometry=display.atlas?overviewGeometry(THREE,[fallback],display.atlas,display.renderSettings??settings):new THREE.BufferGeometry();
    if(carryInk){carryInk.geometry=fast.geometry;}
    tableImage.geometry=fast.geometry;tableImage.visible=fast.visible=true;
    const size=frameDimensions(slot,settings),x=size.width/2,y=size.height/2,z=size.depth*.55;
    tableOutline.geometry.dispose();
    const points=clippedFrameCorners(x,y,frameCornerCut(size.width,size.height,settings.frameWidthM)),vertices=[];
    // Actual 12mm ribbons: WebGL lineWidth is limited to one pixel on many GPUs.
    for(let edge=0;edge<points.length;edge++){
      const [ax,ay]=points[edge],[bx,by]=points[(edge+1)%points.length],length=Math.hypot(bx-ax,by-ay);
      const dx=(bx-ax)/length,dy=(by-ay)/length,nx=-dy*.006,ny=dx*.006;
      for(let d=0;d<length;d+=.075){
        const e=Math.min(length,d+.05),sx=ax+dx*d,sy=ay+dy*d,ex=ax+dx*e,ey=ay+dy*e;
        vertices.push(sx+nx,sy+ny,z,ex+nx,ey+ny,z,ex-nx,ey-ny,z,sx+nx,sy+ny,z,ex-nx,ey-ny,z,sx-nx,sy-ny,z);
      }
    }
    tableOutline.geometry=new THREE.BufferGeometry();tableOutline.geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
    display.detail?.(slot.painting,true,slot.destination).then(model=>{
      if(generation!==request){model.dispose();return;}
      view=model;root.add(model.object);fast.visible=false;
      tableDetail=model.object.clone();
      tableDetail.traverse(node=>{
        if(!node.isMesh)return;
        const source=model.object.getObjectByName(node.name).material,material=source.clone();
        material.transparent=true;material.depthWrite=false;material.opacity=.55;
        material.onBeforeCompile=source.onBeforeCompile;material.customProgramCacheKey=source.customProgramCacheKey;
        node.material=material;tablePairs.push({source,material});
      });
      tableGhost.add(tableDetail);tableImage.visible=false;
    }).catch(()=>{}); // The atlas remains visible if the detailed texture is unavailable.
  }
  function pulseGhost(now,valid=true){
    const pulse=.5+.5*Math.sin(now*Math.PI*2/3200);
    tableMat.opacity=.48+.14*pulse;dashMat.opacity=.78+.20*pulse;
    tableMat.color.set(valid?0xffffff:0xff3939);dashMat.color.set(valid?0xffe5a3:0xff3939);
    for(const {source,material} of tablePairs){material.map=source.map;material.opacity=tableMat.opacity;material.color.copy(source.color);if(!valid)material.color.multiply(tableInvalidColor);}
  }
  function beginWall(now){
    const from=returnFlight?tableGhost:root;
    wallFlight={position:from.position.clone(),quaternion:from.quaternion.clone(),start:now};returnFlight=null;
  }
  function beginReturn(now){
    returnFlight={position:ghost.position.clone(),quaternion:ghost.quaternion.clone(),start:now};wallFlight=null;
  }
  function returnToCarry(now,cancel=false){
    if(cancel){returnFlight=null;return;}
    if(!returnFlight)return;
    const t=Math.max(0,Math.min(1,(now-returnFlight.start)/150));
    ghost.visible=false;root.visible=t===1;
    tableGhost.visible=t<1;
    tableGhost.position.lerpVectors(returnFlight.position,root.position,smooth(t));
    tableGhost.quaternion.slerpQuaternions(returnFlight.quaternion,root.quaternion,smooth(t));
    pulseGhost(now);
    if(t===1)returnFlight=null;
  }
  function wall(slot,w,along,y,valid,large,now,hintOnly=false){
    ghost.visible=!hintOnly;if(!hintOnly)root.visible=false;
    const depth=settings.wallClearanceM+settings.frameDepthM/2+(valid?0:.035);
    ghost.position.set(w.a.x+(w.b.x-w.a.x)*along/w.length+w.normal.x*depth,config.building.floorElevation+y,
      w.a.z+(w.b.z-w.a.z)*along/w.length+w.normal.z*depth);
    ghost.rotation.set(0,Math.atan2(w.normal.x,w.normal.z),0);
    if(wallFlight&&!hintOnly){
      const t=Math.max(0,Math.min(1,(now-wallFlight.start)/150));
      ghost.position.lerp(wallFlight.position,1-smooth(t));
      ghost.quaternion.slerp(wallFlight.quaternion,1-smooth(t));
      if(t===1)wallFlight=null;
    }
    // Use exactly the same framed, pulsing dashed ghost as the table preview.
    tableGhost.visible=true;tableGhost.position.copy(ghost.position);tableGhost.quaternion.copy(ghost.quaternion);
    pulseGhost(now,valid);
  }

  function table(slot,now,valid=true){
    const pose=motion.pose(slot);
    pose.position.y+=.008;
    const delta=Math.max(0,now-tableTime),k=delta>180?1:1-Math.exp(-24*delta/1000);
    tableGhost.visible=true;tableGhost.position.lerp(pose.position,k);tableGhost.quaternion.slerp(pose.quaternion,k);tableTime=now;
    pulseGhost(now,valid);
  }

  function carry(slot,large,hall,origin,dir,source,raised){
    root.visible=true;cart.visible=large;
    const fy=config.building.floorElevation;
    const eye=world.camera,stair=config.building.stair,radius=Math.hypot(eye.position.x,eye.position.z);
    // Keep the long edge along the flight, independent of where the player looks.
    // The usual low, sideways hand pose cannot fit between the curved railings.
    const angle=Math.atan2(eye.position.x,eye.position.z);
    const entrance=stair&&angle>-TOP_RAIL_GAP&&angle<stair.topLandingAngle+.3;
    stairCarry=!large&&!raised&&stair&&(radius<stair.openingRadius+.45||entrance&&radius<stair.openingRadius+1.6);
    if(stairCarry){
      // At the mouth the path runs radially; turn progressively with the bend.
      const bend=angle < -TOP_RAIL_GAP?angle+Math.PI*2:angle;
      const progress=Math.max(0,Math.min(1,bend/.9));
      const turn=(1-progress)*Math.PI/2;
      root.rotation.set(0,angle+turn,0,'YXZ');
      root.position.copy(eye.position);root.position.y-=.12;
      const outward=.2*(1-progress);
      root.position.x+=Math.sin(angle)*outward+Math.sin(angle+turn)*.28;
      root.position.z+=Math.cos(angle)*outward+Math.cos(angle+turn)*.28;
      cart.visible=false;return;
    }
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
    const yaw=world.carryYaw?.()??Math.atan2(-dir.x,-dir.z);
    const turn=1.28, halfWidth=slot.width/2;
    // Anchor the near end beside the player; the long edge extends forward.
    const distance=.62+Math.sin(turn)*halfWidth;
    const side=.68+halfWidth*Math.cos(turn);
    const cartYaw=yaw+turn+Math.PI;
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
    lift={from,start:now,duration:240+Math.min(160,slot.width*35),path:null,leg:0,wallNormal:mountedFrame(slot)?slot.normal:null};last=now;
  }
  function trolleyIsOnFloor(slot){
    const fy=config.building.floorElevation;
    const support=supportHeightAt(root.position.x,root.position.z,root.position.y-fy,config);
    return Math.abs(root.position.y-fy-support-trolleyDimensions(slot,settings).centerHeight)<.06;
  }
  function rememberTrolley(){
    parked.position.copy(root.position);parked.quaternion.copy(root.quaternion);parkingPose=parked;
  }
  function resumeAfterPause(elapsed){
    last+=elapsed;
    if(stuckSince!==null)stuckSince+=elapsed;
    if(wallFlight)wallFlight.start+=elapsed;
    if(returnFlight)returnFlight.start+=elapsed;
    if(lift){
      lift.start+=elapsed;
      if(lift.legStart!==undefined)lift.legStart+=elapsed;
      if(lift.lastAttempt!==undefined)lift.lastAttempt+=elapsed;
    }
    tableTime+=elapsed;
  }
  function follow(slot,large,hall,origin,dir,source,now,raised){
    previous.position.copy(root.position);previous.quaternion.copy(root.quaternion);
    carry(slot,large,hall,origin,dir,source,raised);
    const floorY=config.building.floorElevation+supportHeightAt(root.position.x,root.position.z,root.position.y-config.building.floorElevation,config);
    const size=frameDimensions(slot,settings);
    const orientation=carryRotation.makeRotationFromQuaternion(root.quaternion).elements;
    const halfY=(Math.abs(orientation[1])*size.width+Math.abs(orientation[5])*size.height+Math.abs(orientation[9])*size.depth)/2;
    root.position.y=Math.max(floorY+halfY+.04,root.position.y);
    if(!large || raised){
      const desiredPosition=root.position.clone(),desiredRotation=root.quaternion.clone();
      const apply=choice=>{
        root.position.lerpVectors(desiredPosition,world.camera.position,choice.pull);
        root.position.y+=choice.rise;
        root.quaternion.copy(desiredRotation);root.rotateY(choice.turn);
      };
      const preferredBlocked=motion.blocked(slot,root.position,root.quaternion);
      if(!preferredBlocked){
        preferredClearSince??=now;
        if(now-preferredClearSince>180)avoidance=null;
      }else preferredClearSince=null;
      if(avoidance){apply(avoidance);if(motion.blocked(slot,root.position,root.quaternion))avoidance=null;}
      if(!avoidance&&preferredBlocked){
        let best=null,score=Infinity;
        for(const pull of [.25,.5,.7,.9])for(const turn of [0,.4,-.4])for(const rise of [0,.3,.6]){
          const choice={pull,turn,rise};apply(choice);
          if(motion.blocked(slot,root.position,root.quaternion))continue;
          const cost=root.position.distanceTo(previous.position)+.3*root.quaternion.angleTo(previous.quaternion)+pull*.03+rise*.02;
          if(cost<score){score=cost;best=choice;}
        }
        avoidance=best;
      }
      if(avoidance)apply(avoidance);
      else {root.position.copy(desiredPosition);root.quaternion.copy(desiredRotation);}
    }
    const dt=Math.max(0,Math.min(.1,(now-last)/1000));last=now;
    if(lift){
      // Clear the source stack before rotating; simultaneous lift/rotation can
      // sweep a lower corner into a neighbouring frame and strand the pickup.
      if(!lift.path && (lift.lastAttempt===undefined || now-lift.lastAttempt>=120)){
        lift.lastAttempt=now;
        const desired={position:root.position.clone(),quaternion:root.quaternion.clone()};
        const eye=world.camera.position;
        for(const position of [root.position, lift.from.position]){
          for(const rise of [0,.12,.3,.6,1]){
            desired.position.set(position.x,lift.wallNormal?root.position.y+rise:
              Math.max(root.position.y+rise,lift.from.position.y+.22),position.z);
            if(position===lift.from.position && (position.distanceTo(eye)>2.7||lift.recovery))break;
            const path=motion.route(slot,lift.from,desired,{wallNormal:lift.wallNormal,pickup:!lift.recovery&&!lift.wallNormal});
            if(!path)continue;
            lift.path=path;lift.legStart=now;
            lift.lengths=path.slice(1).map((b,i)=>b.position.distanceTo(path[i].position)+.25*b.quaternion.angleTo(path[i].quaternion));
            lift.total=lift.lengths.reduce((a,b)=>a+b,0);break;
          }
          if(lift.path)break;
        }
        if(!lift.path && lift.wallNormal){
          // If the preferred hand/cart position is occupied, first hold the work
          // parallel to the wall at a clear pose so the player can step back.
          const normal=lift.wallNormal,from=lift.from;
          for(const distance of [.55,.32,.15]){
            desired.position.copy(from.position);
            desired.position.x+=normal.x*distance;desired.position.z+=normal.z*distance;
            desired.quaternion.copy(from.quaternion);
            if(motion.advance(slot,from,desired)!==1)continue;
            lift.path=[from,desired];lift.legStart=now;lift.lengths=[distance];lift.total=distance;break;
          }
        }
      }
      if(!lift.path){
        root.position.copy(previous.position);root.quaternion.copy(previous.quaternion);
        if(!lift.recovery && !lift.warned && now-lift.start>500){lift.warned=true;liftFailure=true;}
      }else{
        while(lift){
          const i=lift.leg,seconds=Math.max(1,lift.duration*lift.lengths[i]/Math.max(.0001,lift.total));
          const elapsed=Math.max(0,now-lift.legStart),t=Math.min(1,elapsed/seconds),k=smooth(t);
          root.position.lerpVectors(lift.path[i].position,lift.path[i+1].position,k);
          root.quaternion.slerpQuaternions(lift.path[i].quaternion,lift.path[i+1].quaternion,k);
          if(t<1)break;
          lift.leg++;lift.legStart+=seconds;
          if(lift.leg===lift.lengths.length){lift=null;stuckSince=null;}
        }
      }
      cart.visible=large && !raised && !lift && trolleyIsOnFloor(slot);
      if(cart.visible)rememberTrolley();
      lastEyeRotation.copy(world.camera.quaternion);lastEyePosition.copy(world.camera.position);return;
    }else{
      const t=1-Math.exp(-12*dt);
      carriedFrom.copy(previous.position);
      if(!large || raised){
        const eye=world.camera;
        cameraDelta.copy(eye.quaternion).multiply(lastEyeRotation.invert());
        if(stairCarry)cameraDelta.identity();
        carriedFrom.sub(lastEyePosition).applyQuaternion(cameraDelta).add(eye.position);
        goal.quaternion.copy(previous.quaternion).premultiply(cameraDelta);
        root.quaternion.slerp(goal.quaternion,1-t);
      }else root.quaternion.slerp(previous.quaternion,1-t);
      root.position.lerpVectors(carriedFrom,root.position,t);
    }
    lastEyeRotation.copy(world.camera.quaternion);lastEyePosition.copy(world.camera.position);
    goal.position.copy(root.position);goal.quaternion.copy(root.quaternion);
    let t=motion.advance(slot,previous,goal);
    root.position.lerpVectors(previous.position,goal.position,t);
    root.quaternion.slerpQuaternions(previous.quaternion,goal.quaternion,t);
    if(large && !raised){cart.visible=trolleyIsOnFloor(slot);if(cart.visible && t===1)rememberTrolley();}
    // A blocked follow pose stays stable. Do not restart a lift animation on
    // every wall contact; movement is constrained by the same swept volume.
    stuckSince=t<1?(stuckSince??now):null;
  }
  function dropPath(slot){return motion.route(slot,ghost.visible?ghost:root,motion.pose(slot),{lowArc:slot.supportId?.startsWith('table-')});}
  function lowering(path,p,ballistic=false,trolley=false){
    if(ballistic){
      root.visible=true;cart.visible=ghost.visible=false;
      const progress=p*(path.length-1),i=Math.min(path.length-2,Math.floor(progress)),k=progress-i;
      root.position.lerpVectors(path[i].position,path[i+1].position,k);
      root.quaternion.slerpQuaternions(path[i].quaternion,path[i+1].quaternion,k);return;
    }
    root.visible=true;cart.visible=trolley;ghost.visible=false;
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
  function constrainMovement(from,to){
    if(!current||(!root.visible&&!returnFlight))return 1;
    const reach=Math.max(2.8,current.width/2+1.5);
    let allowed=1;
    if(to.distanceTo(root.position)>reach&&to.distanceToSquared(root.position)>from.distanceToSquared(root.position)){
      let low=0,high=1;const point=new THREE.Vector3();
      for(let i=0;i<16;i++){
        const middle=(low+high)/2;point.lerpVectors(from,to,middle);
        if(point.distanceTo(root.position)<=reach)low=middle;else high=middle;
      }
      allowed=low;
    }
    if(lift||motion.blocked(current,root.position,root.quaternion))return allowed;
    const desired={position:root.position.clone().add(to.clone().sub(from)),quaternion:root.quaternion};
    return Math.min(allowed,motion.advance(current,root,desired));
  }
  return {constrainMovement,takeLiftFailure(){const value=liftFailure;liftFailure=false;return value;},
    carriedPose(){return root.visible||returnFlight?{position:root.position,quaternion:root.quaternion}:null;},
    parkPose(){return parkingPose && parkingPose.position.distanceTo(world.camera.position)<=Math.max(3,(current?.width??0)+1)?parkingPose:null;},
    select,beginWall,beginReturn,returnToCarry,wall,table,follow,beginLift,resumeAfterPause,lowering,dropPath,throwPath(slot){return motion.throwRoute(slot,ghost.visible?ghost:root,motion.pose(slot));},hover,hide(){root.visible=ghost.visible=tableGhost.visible=false;},
    resetHover(){glow.visible=false;glowMat.opacity=0;hovered=null;},
    dispose(){select(null);root.removeFromParent();ghost.removeFromParent();glow.removeFromParent();tableGhost.removeFromParent();tableOutline.geometry.dispose();tableMat.dispose();dashMat.dispose();glowMat.dispose();
    fast.geometry.dispose();glowBox.dispose();props.dispose();mat.dispose();}};
}
