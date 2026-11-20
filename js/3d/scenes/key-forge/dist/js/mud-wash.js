import * as THREE from '../vendor/three.js';
import { KEY_TEMPLATES } from './key-data.js';
import { keyBounds } from './key-shapes.js';
import { MUD_COLORS, mudBlobLayout, washMudBlobs, mudGeometry, getMudMaterial } from './key-mud.js';
import { createShine, SHINE_SECONDS } from './key-shine.js';
import { createTrough, WATER_COLOR } from './bath-trough.js';

// Washing mud off with two dips in a water trough.
//   1. The key rises a little, a shallow trough appears below it and fills.
//   2. First dip: the mud soaks and clouds the water. Coming out of the water,
//      the loosened clods break off and fall back in with a splash.
//   3. Second dip in the same water: the rest dissolves.
//   4. The key comes out clean and glints; the water drains, the trough goes.
// The trough lives in a rig that copies the key's tilt, so its water surface
// stays parallel to the key; the key itself moves along its own normal.

const STEPS=[
  ['lift',.5],['fill',.6],
  ['down1',.45],['soak1',1.1],['up1',.5],['pause',.3],
  ['down2',.45],['soak2',1.2],['up2',.5],
  ['shine',SHINE_SECONDS],['drain',.5],['away',.45],
];
export const WASH_SECONDS=STEPS.reduce((sum,[,d])=>sum+d,0);
const ABOVE=.6;              // key height above the water between dips
const GRAVITY=4.5;

function easeInOut(x){x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);}

export function createMudWash({scene,keyGroup,design}) {
  const template=KEY_TEMPLATES[design.template];
  const depth=design.thickness/100;
  const blobs=mudBlobLayout(template,design);
  // Loose crumbs, the clods on the teeth and every other small clod come off
  // on the first dip; the rest needs the second one.
  const loose=new Set(blobs.filter((b,i)=>b.kind==='crumb'||b.kind==='bit'||i%3===1));
  let remaining=blobs;
  const mudMaterial=getMudMaterial();
  let mudMesh=null;
  keyGroup.traverse(mesh=>{if(mesh.isMesh&&mesh.material===mudMaterial)mudMesh=mesh;});

  const rig=new THREE.Group();
  rig.position.copy(keyGroup.position);
  scene.add(rig);
  const trough=createTrough(keyBounds(template,design),depth);
  const {water,wood,bottom,surface}=trough.userData;
  rig.add(trough);
  const home=keyGroup.position.clone();
  const normal=new THREE.Vector3();

  const clouds=[],bubbles=[],chunks=[],ripples=[];
  const cloudGeometry=new THREE.CircleGeometry(1,20);
  const bubbleGeometry=new THREE.SphereGeometry(.028,8,6);
  const bubbleMaterial=new THREE.MeshStandardMaterial({color:'#e8f4f1',transparent:true,opacity:.85,roughness:.1});
  const chunkGeometry=new THREE.IcosahedronGeometry(1,0);
  const chunkMaterial=new THREE.MeshStandardMaterial({color:MUD_COLORS.base,roughness:1,metalness:0,flatShading:true});
  const rippleGeometry=new THREE.RingGeometry(.82,1,28);
  let elapsed=0,washed=false,lastBubble=0,lastCloud=0,dropped1=false,shine=null,level=bottom;

  function stage(time) {
    let t=time;
    for(const [name,duration] of STEPS) {
      if(t<duration)return {name,k:t/duration};
      t-=duration;
    }
    return {name:'end',k:1};
  }

  function setMud(list,heightScale=1) {
    if(!mudMesh)return;
    mudMesh.geometry.dispose();
    mudMesh.geometry=mudGeometry(template,design,{blobs:list,heightScale});
  }

  // Key-frame point -> rig frame (the key only moves along its normal).
  function toRig(x,y,z){return new THREE.Vector3(x,y,z+keyOffset);}
  let keyOffset=0;

  function spawnCloud(blob) {
    const material=new THREE.MeshBasicMaterial({color:MUD_COLORS.light,transparent:true,opacity:.5,depthWrite:false});
    const cloud=new THREE.Mesh(cloudGeometry,material);
    cloud.position.copy(toRig(blob.x+(Math.random()-.5)*blob.rx,blob.y+(Math.random()-.5)*blob.ry,depth+.03+Math.random()*.04));
    cloud.userData={age:0,life:1.4+Math.random()*.6,size:Math.max(blob.rx,blob.ry)*(1+Math.random()),
      drift:new THREE.Vector2((Math.random()-.5)*.25,(Math.random()-.5)*.15),exportable:false};
    rig.add(cloud);clouds.push(cloud);
  }

  function spawnBubble(blob) {
    const bubble=new THREE.Mesh(bubbleGeometry,bubbleMaterial);
    bubble.position.copy(toRig(blob.x+(Math.random()-.5)*blob.rx*1.2,blob.y+(Math.random()-.5)*blob.ry,depth+.02));
    bubble.scale.setScalar(.6+Math.random()*.9);
    bubble.userData={speed:.25+Math.random()*.25,wobble:Math.random()*6,exportable:false};
    rig.add(bubble);bubbles.push(bubble);
  }

  // Loosened clods break off the underside and fall into the water.
  function dropChunks(list) {
    keyGroup.updateMatrixWorld(true);
    for(const blob of list) {
      const pieces=blob.kind==='crumb'?1:2+Math.floor(Math.random()*2);
      for(let i=0;i<pieces;i++) {
        const chunk=new THREE.Mesh(chunkGeometry,chunkMaterial);
        const local=new THREE.Vector3(blob.x+(Math.random()-.5)*blob.rx,blob.y+(Math.random()-.5)*blob.ry,-.02);
        chunk.position.copy(keyGroup.localToWorld(local));
        const size=Math.max(.03,Math.min(blob.rx,blob.ry)*(pieces>1?.45:.7));
        chunk.scale.set(size,size*.75,size);
        chunk.rotation.set(Math.random()*3,Math.random()*3,Math.random()*3);
        chunk.userData={velocity:-.2*Math.random(),spin:(Math.random()-.5)*8,delay:Math.random()*.18,exportable:false};
        chunk.userData.outlineable=true;
        scene.add(chunk);chunks.push(chunk);
      }
    }
  }

  function splash(worldPosition) {
    const local=rig.worldToLocal(worldPosition.clone());
    const material=new THREE.MeshBasicMaterial({color:'#eef7f4',transparent:true,opacity:.8,depthWrite:false,side:THREE.DoubleSide});
    const ripple=new THREE.Mesh(rippleGeometry,material);
    ripple.position.set(local.x,local.y,level+.004);
    ripple.userData={age:0,exportable:false};
    ripple.scale.setScalar(.02);
    rig.add(ripple);ripples.push(ripple);
  }

  function update(dt,settle=.55) {
    elapsed+=dt;
    const time=Math.max(0,elapsed-settle);
    const {name,k}=stage(time);
    rig.quaternion.copy(keyGroup.quaternion);
    normal.set(0,0,1).applyQuaternion(keyGroup.quaternion);

    // Key height above its resting place, along its own normal.
    const heights={lift:ABOVE*easeInOut(k),fill:ABOVE,down1:ABOVE*(1-easeInOut(k)),soak1:0,
      up1:ABOVE*easeInOut(k),pause:ABOVE,down2:ABOVE*(1-easeInOut(k)),soak2:0,up2:ABOVE*easeInOut(k),
      shine:ABOVE,drain:ABOVE,away:ABOVE*(1-easeInOut(k)),end:0};
    keyOffset=heights[name];
    keyGroup.position.copy(home).addScaledVector(normal,keyOffset);

    // Trough fades in, water fills once, drains at the end.
    wood.opacity=name==='lift'?easeInOut(k):name==='away'?1-easeInOut(k):name==='end'?0:1;
    const full=surface;
    level=name==='lift'?bottom:name==='fill'?bottom+(full-bottom)*easeInOut(k):
      name==='drain'?full-(full-bottom)*easeInOut(k):name==='away'||name==='end'?bottom:full;
    water.position.z=level;
    water.material.opacity=name==='lift'?0:name==='fill'?.55*Math.min(1,k*3):
      name==='drain'?.55*(1-.6*k):name==='away'?.22*(1-k):name==='end'?0:.55;

    // Soaking: the first dip softens everything a little; the loose clods
    // fall off on the way out; the second dip dissolves the rest.
    if(name==='soak1') {
      setMud(washMudBlobs(remaining,()=>.18*k),1-.12*k);
    } else if(name==='up1'&&!dropped1&&k>.6) {
      dropped1=true;
      const falling=remaining.filter(b=>loose.has(b));
      remaining=washMudBlobs(remaining.filter(b=>!loose.has(b)),()=>.18);
      setMud(remaining,.88);
      dropChunks(falling.map(b=>({...b,rx:b.rx*.82,ry:b.ry*.82})));
    } else if(name==='soak2') {
      setMud(washMudBlobs(remaining,()=>k*1.05),.88-.4*k);
      if(k>=1)remaining=[];
    } else if((name==='up2'||name==='shine')&&!washed) {
      remaining=[];setMud([]);washed=true;
    }
    const soaking=name==='soak1'||name==='soak2';
    const muddy=name==='soak1'?remaining:washMudBlobs(remaining,()=>name==='soak2'?k:0);
    if(soaking&&muddy.length) {
      if(elapsed-lastCloud>.12){spawnCloud(muddy[Math.floor(Math.random()*muddy.length)]);lastCloud=elapsed;}
      if(elapsed-lastBubble>.07){spawnBubble(muddy[Math.floor(Math.random()*muddy.length)]);lastBubble=elapsed;}
    }
    // Murk peaks during each soak and settles between them.
    const murk=name==='soak1'?Math.sin(Math.PI*k)*.35:name==='soak2'?Math.sin(Math.PI*k)*.25:0;
    water.material.color.set(WATER_COLOR).lerp(new THREE.Color('#8a7a55'),murk);

    if(name==='shine'&&!shine)shine=createShine({keyGroup,design});
    const shineDone=shine?shine.update(dt):false;

    for(let i=clouds.length-1;i>=0;i--) {
      const cloud=clouds[i],data=cloud.userData;
      data.age+=dt;
      const life=data.age/data.life;
      cloud.scale.setScalar(data.size*(.4+1.1*(1-Math.pow(1-Math.min(1,life),3))));
      cloud.position.x+=data.drift.x*dt;cloud.position.y+=data.drift.y*dt;
      cloud.position.z=Math.min(cloud.position.z,level-.005);
      cloud.material.opacity=.5*(1-life);
      if(life>=1){rig.remove(cloud);cloud.material.dispose();clouds.splice(i,1);}
    }
    for(let i=bubbles.length-1;i>=0;i--) {
      const bubble=bubbles[i];
      bubble.position.z+=bubble.userData.speed*dt;
      bubble.position.x+=Math.sin(elapsed*7+bubble.userData.wobble)*.04*dt;
      if(bubble.position.z>=level-.01){rig.remove(bubble);bubbles.splice(i,1);}
    }
    for(let i=chunks.length-1;i>=0;i--) {
      const chunk=chunks[i],data=chunk.userData;
      if((data.delay-=dt)>0)continue;
      data.velocity+=GRAVITY*dt;
      chunk.position.y-=data.velocity*dt;
      chunk.rotation.x+=data.spin*dt;chunk.rotation.z+=data.spin*.6*dt;
      // In the rig frame the water is a plane at z = level.
      if(rig.worldToLocal(chunk.position.clone()).z<=level) {
        splash(chunk.position);
        scene.remove(chunk);chunks.splice(i,1);
      }
    }
    for(let i=ripples.length-1;i>=0;i--) {
      const ripple=ripples[i];
      ripple.userData.age+=dt;
      const life=ripple.userData.age/.6;
      ripple.scale.setScalar(.04+.2*life);
      ripple.material.opacity=.8*(1-life);
      if(life>=1){rig.remove(ripple);ripple.material.dispose();ripples.splice(i,1);}
    }
    return name==='end'&&washed&&(shineDone||!shine)&&!clouds.length&&!bubbles.length&&!chunks.length&&!ripples.length;
  }

  function dispose() {
    for(const item of [...clouds,...ripples])item.material.dispose();
    for(const chunk of chunks)scene.remove(chunk);
    clouds.length=bubbles.length=chunks.length=ripples.length=0;
    shine?.dispose();
    keyGroup.position.copy(home);
    scene.remove(rig);
    rig.traverse(object=>{object.geometry?.dispose();if(object.material&&object.material!==bubbleMaterial)object.material.dispose();});
    for(const resource of [cloudGeometry,bubbleGeometry,bubbleMaterial,chunkGeometry,chunkMaterial,rippleGeometry])resource.dispose();
  }

  return {update,dispose,get done(){return washed;}};
}
