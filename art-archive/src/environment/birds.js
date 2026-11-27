import {smoothWingBeat} from './bird-animation.js';
import {createBirdRoute} from './bird-route.js';
import {createBirdFlight} from './bird-flight.js';
import {GLTFLoader} from '../../vendor/loaders/GLTFLoader.js';
import {KTX2Loader} from '../../vendor/loaders/KTX2Loader.js';
import {MeshoptDecoder} from '../../vendor/libs/meshopt_decoder.module.js';
import {clone} from '../../vendor/utils/SkeletonUtils.js';

export function createArchiveBirds({THREE,scene,renderer,config}){
  const root=new THREE.Group();root.name='dome-birds';scene.add(root);
  const ktx=new KTX2Loader().setTranscoderPath(new URL('../../vendor/libs/basis/',import.meta.url).href).detectSupport(renderer);
  const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).setKTX2Loader(ktx);
  const sources=new Map(),actors=[];
  let generation=0,disposed=false,time=0,mode='both';
  const domeBase=config.building.floorElevation+config.building.domeBaseHeight;
  const domeTop=domeBase+config.building.radius*.45;
  const footBounds=new THREE.Box3();
  const definitions={crow:{file:'hooded-crow.glb',clip:'fly'},afk:{file:'afk-bird.glb',clip:'Flap'}};
  async function load(key){
    if(!sources.has(key))sources.set(key,loader.loadAsync(new URL('../../assets/birds/'+definitions[key].file,import.meta.url).href));
    return sources.get(key);
  }
  function clear(){
    for(const a of actors){a.mixer.stopAllAction();a.mixer.uncacheRoot(a.model);a.model.traverse(o=>o.skeleton?.dispose());}
    actors.length=0;root.clear();
  }
  async function configure(value){
    mode=value;const token=++generation;clear();
    if(value==='off')return;
    const keys=value==='both'?['crow','afk']:[value];
    const loaded=await Promise.all(keys.map(load));
    if(disposed||token!==generation)return;
    for(let i=0;i<6;i++){
      const key=keys[i%keys.length],gltf=loaded[i%keys.length],model=clone(gltf.scene);
      const box=new THREE.Box3().setFromObject(model),size=box.getSize(new THREE.Vector3());
      // Compare at the same wingspan and flight path.
      model.scale.setScalar(1.2/size.x);
      const pivot=new THREE.Group();pivot.add(model);root.add(pivot);
      model.position.sub(box.getCenter(new THREE.Vector3()).multiplyScalar(model.scale.x));
      const mixer=new THREE.AnimationMixer(model);
      const clip=THREE.AnimationClip.findByName(gltf.animations,definitions[key].clip);
      if(!clip)throw Error('Missing flight animation: '+key);
      const flap=mixer.clipAction(key==='afk'?smoothWingBeat(THREE,clip):clip);
      flap.timeScale=(key==='afk'?1.55:1.05)*(1+(i%3-1)*.07);
      let glideClip=THREE.AnimationClip.findByName(gltf.animations,'Glide');
      if(!glideClip){
        // The crow asset has only one airborne clip. Hold its broad-wing pose for gliding.
        const tracks=clip.tracks.map(track=>{
          const pose=track.createInterpolant().evaluate(clip.duration*.25);
          const frozen=track.clone();frozen.times=new Float32Array([0,1]);
          frozen.values=new Float32Array([...pose,...pose]);return frozen;
        });
        glideClip=new THREE.AnimationClip('Archive Glide',1,tracks);
      }
      const glide=mixer.clipAction(glideClip);
      flap.play();flap.time=i*.137%clip.duration;
      model.traverse(o=>{if(o.isMesh){o.castShadow=false;o.receiveShadow=false;}});
      const restNames=key==='afk'?['Idle','Look Around','Preen']:['idle'];
      const rests=restNames.map(name=>mixer.clipAction(THREE.AnimationClip.findByName(gltf.animations,name)));
      // Measure the feet in the quiet pose once. Flapping wings must not lift the body off the rail.
      flap.stop();rests[0].play();mixer.update(0);
      pivot.updateMatrixWorld(true);model.traverse(o=>o.skeleton?.update());
      footBounds.setFromObject(model,true);
      const restOffset=pivot.position.y-footBounds.min.y;
      rests[0].stop();flap.play();mixer.update(0);
      actors.push({pivot,model,mixer,key,index:i,flap,glide,gliding:false,
        nextChange:time+1.2+i*.83,rests,action:flap,state:'flying',
        nextRest:time+8+i*13,restIndex:0,restOffset,restPoseY:model.position.y,
        flight:createBirdFlight(THREE,i,config.building.floorElevation+config.building.domeBaseHeight+config.building.radius*.45)});
      pivot.userData.species=key;
    }
    update(0);
  }
  function play(a,action){
    if(a.action===action)return;
    action.reset().setEffectiveWeight(1).play();
    a.action.stopFading();action.crossFadeFrom(a.action,.45,false);a.action=action;
  }
  function beginRest(a){
    const angle=a.index*Math.PI/4;
    const height=4.6;
    const radius=config.building.radius*Math.sqrt(1-(height/(config.building.radius*.45))**2);
    // Intersections of a brass ring and a meridian are fixed, sturdy perches.
    const perch=new THREE.Vector3(Math.sin(angle)*radius,domeBase+height+.045,Math.cos(angle)*radius);
    const from=a.pivot.position.clone();
    a.perchYaw=angle;
    const tangent=new THREE.Vector3(Math.sin(a.perchYaw),0,Math.cos(a.perchYaw));
    const above=perch.clone().addScaledVector(tangent,-7);above.y=domeTop+2.5;
    const incoming=new THREE.Vector3(Math.sin(a.pivot.rotation.y)*3,0,Math.cos(a.pivot.rotation.y)*3);
    const approach=tangent.clone().multiplyScalar(2.3);approach.y=-.6;
    const cruise=Math.max(3,from.distanceTo(above)/3);
    a.route=createBirdRoute(THREE,[from,above,perch],[incoming,approach,new THREE.Vector3()],[cruise,4]);
    a.routeStart=time;a.perch=perch;a.state='landing';
    play(a,a.flap);
  }
  function route(a,dt){
    const result=a.route.sample(time-a.routeStart,a.pivot.position);
    const d=result.direction;
    const yaw=Math.atan2(d.x,d.z);
    const turn=Math.atan2(Math.sin(yaw-a.pivot.rotation.y),Math.cos(yaw-a.pivot.rotation.y));
    const change=Math.max(-1.1*dt,Math.min(1.1*dt,turn));
    a.pivot.rotation.y+=change;
    const pitch=-Math.atan2(d.y,Math.hypot(d.x,d.z));
    const blend=1-Math.exp(-4*dt);
    a.pivot.rotation.x+=(pitch-a.pivot.rotation.x)*blend;
    a.pivot.rotation.z+=(-change/Math.max(dt,.0001)*.25-a.pivot.rotation.z)*blend;
    return result.finished;
  }
  function update(dt){
    time+=dt;
    for(const a of actors){
      if(a.state==='flying' && time>=a.nextRest && actors.filter(b=>b.state!=='flying').length<2)beginRest(a);
      if(a.state==='landing'){
        const finished=route(a,dt);
        // Fold the wings during the final descent.
        if(time-a.routeStart>a.route.duration-.8)play(a,a.rests[0]);
        if(finished){a.state='resting';a.until=time+12+a.index*1.5;a.nextGesture=time+3;}
      }else if(a.state==='resting'){
        a.pivot.position.copy(a.perch);
        const settle=1-Math.exp(-4*dt);
        a.pivot.rotation.x*=1-settle;a.pivot.rotation.z*=1-settle;
        if(time>=a.nextGesture){a.restIndex=(a.restIndex+1)%a.rests.length;play(a,a.rests[a.restIndex]);a.nextGesture=time+3.5;}
        if(time>=a.until){
          const tangent=new THREE.Vector3(Math.sin(a.pivot.rotation.y),0,Math.cos(a.pivot.rotation.y));
          const forward=a.perch.clone().addScaledVector(tangent,11);forward.y=domeTop+3.5;
          const initial=tangent.clone().multiplyScalar(2.4);initial.y=1.1;
          const outgoing=tangent.clone().multiplyScalar(3);outgoing.y=.7;
          a.route=createBirdRoute(THREE,[a.perch,forward],[initial,outgoing],[5]);
          a.routeStart=time;a.state='taking-off';play(a,a.flap);
        }
      }else if(a.state==='taking-off' && route(a,dt)){
        a.state='flying';a.flight.resume(a.pivot.position,a.pivot.rotation.y,-a.pivot.rotation.x,a.pivot.rotation.z);
        a.nextRest=time+35+a.index*4;a.nextChange=time+2;a.gliding=false;
      }
      if(a.state!=='flying'){
        a.mixer.update(dt);
        // Pin the resting pose to the rail while the flight pose blends away.
        const rest=a.state==='resting'?1:a.state==='landing'?Math.max(0,Math.min(1,(time-a.routeStart-a.route.duration+.8)/.8)):
          Math.max(0,1-(time-a.routeStart)/.8);
        const contact=rest*rest*(3-2*rest);
        a.model.position.y=a.restPoseY+a.restOffset*contact;
        a.pivot.updateMatrixWorld(true);a.model.traverse(o=>o.skeleton?.update());
        if(a.state==='resting'){
          footBounds.setFromObject(a.model,true);
          a.model.position.y+=(a.pivot.position.y-footBounds.min.y)/Math.max(.2,a.pivot.matrixWorld.elements[5]);
          a.pivot.updateMatrixWorld(true);a.model.traverse(o=>o.skeleton?.update());
        }
        a.pivot.userData.flight=a.state;
        continue;
      }
      a.model.position.y=a.restPoseY;
      if(time>=a.nextChange){
        a.gliding=!a.gliding;
        const next=a.gliding?a.glide:a.flap;
        play(a,next);
        a.nextChange=time+(a.gliding?1.6+(a.index%3)*.5:2.8+(a.index%3)*.7);
      }
      const flight=a.flight.update(dt,a.gliding);
      a.pivot.position.copy(flight.position);
      a.pivot.rotation.set(-flight.pitch,flight.heading,flight.bank,'YXZ');
      a.pivot.userData.flight=a.gliding?'glide':'flap';
      a.mixer.update(dt);
    }
  }
  return {configure,update,setVisible(value){root.visible=value;},get mode(){return mode;},
    dispose(){disposed=true;generation++;clear();root.removeFromParent();ktx.dispose();
      for(const promise of sources.values())promise.then(gltf=>{
        const geometries=new Set(),materials=new Set(),textures=new Set();
        gltf.scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const m of o.material?(Array.isArray(o.material)?o.material:[o.material]):[]){materials.add(m);for(const v of Object.values(m))if(v?.isTexture)textures.add(v);}});
        for(const g of geometries)g.dispose();for(const m of materials)m.dispose();for(const t of textures)t.dispose();
      }).catch(()=>{});}};
}
