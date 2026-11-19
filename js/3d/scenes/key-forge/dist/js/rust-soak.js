import * as THREE from '../vendor/three.js';
import { KEY_TEMPLATES } from './key-data.js';
import { keyBounds } from './key-shapes.js';
import { metalTest } from './key-coat.js';
import { createShine, SHINE_SECONDS } from './key-shine.js';
import { createTrough } from './bath-trough.js';

// Rust soak: the key lies in a cleaning solution for a while. The solution
// fizzes and slowly turns rusty; nothing visible happens to the key yet.
// When the key is lifted out, the softened rust flakes off in patches and the
// flakes flutter down into the trough. Then the clean metal glints.

const SOLUTION='#a8c99a',RUSTY='#b07a4a';
const STEPS=[
  ['lift',.5],['fill',.6],['down',.5],['soak',3.2],
  ['up',.9],['crumble',.7],['shine',SHINE_SECONDS],['drain',.5],['away',.45],
];
export const SOAK_SECONDS=STEPS.reduce((sum,[,d])=>sum+d,0);
const ABOVE=.6;
const FLAKE_COLORS=['#8a3f1c','#a9552a','#6b3018','#b8693a'];

function easeInOut(x){x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);}

export function createRustSoak({scene,keyGroup,design}) {
  const template=KEY_TEMPLATES[design.template];
  const depth=design.thickness/100;
  const bounds=keyBounds(template,design),onMetal=metalTest(template,design);
  const rusty=Math.max(0,Math.min(2,(design.rustAmount??0)/100));
  const erodes=[];
  keyGroup.traverse(mesh=>{
    const uniform=mesh.isMesh&&mesh.material?.userData?.rustErodeUniform;
    if(uniform&&!erodes.includes(uniform))erodes.push(uniform);
  });
  const setErode=value=>erodes.forEach(uniform=>{uniform.value=value;});
  setErode(-.1);

  const rig=new THREE.Group();
  rig.position.copy(keyGroup.position);
  scene.add(rig);
  const trough=createTrough(bounds,depth,{water:SOLUTION});
  const {water,wood,bottom,surface}=trough.userData;
  rig.add(trough);
  const home=keyGroup.position.clone();
  const normal=new THREE.Vector3();

  const fizz=[],flakes=[],ripples=[];
  const fizzGeometry=new THREE.SphereGeometry(.024,6,4);
  const fizzMaterial=new THREE.MeshStandardMaterial({color:'#f2f7e8',transparent:true,opacity:.8,roughness:.1});
  const flakeGeometry=new THREE.PlaneGeometry(1,.7);
  const flakeMaterials=FLAKE_COLORS.map(color=>new THREE.MeshStandardMaterial({color,roughness:1,metalness:0,side:THREE.DoubleSide}));
  const rippleGeometry=new THREE.RingGeometry(.82,1,28);
  let elapsed=0,done=false,lastFizz=0,shine=null,level=bottom,keyOffset=0,erode=-.1,flaked=0;

  function stage(time) {
    let t=time;
    for(const [name,duration] of STEPS) {
      if(t<duration)return {name,k:t/duration};
      t-=duration;
    }
    return {name:'end',k:1};
  }

  function metalPoint() {
    for(let attempt=0;attempt<40;attempt++) {
      const x=bounds.minX+Math.random()*(bounds.maxX-bounds.minX);
      const y=bounds.minY+Math.random()*(bounds.maxY-bounds.minY);
      if(onMetal(x,y))return [x,y];
    }
    return [(bounds.minX+bounds.maxX)/2,0];
  }

  function spawnFizz() {
    const [x,y]=metalPoint();
    const bubble=new THREE.Mesh(fizzGeometry,fizzMaterial);
    bubble.position.set(x,y,depth+.01+keyOffset);
    bubble.scale.setScalar(.6+Math.random()*.9);
    bubble.userData={speed:.35+Math.random()*.3,exportable:false};
    rig.add(bubble);fizz.push(bubble);
  }

  // A flake leaves a random point of the key and flutters down.
  function spawnFlake() {
    const [x,y]=metalPoint();
    keyGroup.updateMatrixWorld(true);
    const flake=new THREE.Mesh(flakeGeometry,flakeMaterials[Math.floor(Math.random()*flakeMaterials.length)]);
    const side=Math.random()<.5?-.01:depth+.01;
    flake.position.copy(keyGroup.localToWorld(new THREE.Vector3(x,y,side)));
    const size=.035+Math.random()*.05;
    flake.scale.set(size,size,size);
    flake.rotation.set(Math.random()*3,Math.random()*3,Math.random()*3);
    flake.userData={velocity:0,phase:Math.random()*6,sway:.25+Math.random()*.3,spin:(Math.random()-.5)*7,exportable:false};
    flake.userData.outlineable=true;
    scene.add(flake);flakes.push(flake);
  }

  function splash(worldPosition) {
    const local=rig.worldToLocal(worldPosition.clone());
    const material=new THREE.MeshBasicMaterial({color:'#f3f6e6',transparent:true,opacity:.7,depthWrite:false,side:THREE.DoubleSide});
    const ripple=new THREE.Mesh(rippleGeometry,material);
    ripple.position.set(local.x,local.y,level+.004);
    ripple.userData={age:0,exportable:false};
    ripple.scale.setScalar(.02);
    rig.add(ripple);ripples.push(ripple);
  }

  function update(dt,settle=.55) {
    elapsed+=dt;
    const {name,k}=stage(Math.max(0,elapsed-settle));
    rig.quaternion.copy(keyGroup.quaternion);
    normal.set(0,0,1).applyQuaternion(keyGroup.quaternion);
    const heights={lift:ABOVE*easeInOut(k),fill:ABOVE,down:ABOVE*(1-easeInOut(k)),soak:0,
      up:ABOVE*easeInOut(k),crumble:ABOVE,shine:ABOVE,drain:ABOVE,away:ABOVE*(1-easeInOut(k)),end:0};
    keyOffset=heights[name];
    keyGroup.position.copy(home).addScaledVector(normal,keyOffset);

    wood.opacity=name==='lift'?easeInOut(k):name==='away'?1-easeInOut(k):name==='end'?0:1;
    level=name==='lift'?bottom:name==='fill'?bottom+(surface-bottom)*easeInOut(k):
      name==='drain'?surface-(surface-bottom)*easeInOut(k):name==='away'||name==='end'?bottom:surface;
    water.position.z=level;
    water.material.opacity=name==='lift'?0:name==='fill'?.6*Math.min(1,k*3):
      name==='drain'?.6*(1-.6*k):name==='away'?.24*(1-k):name==='end'?0:.6;
    // The solution slowly takes on the colour of dissolved rust.
    const order=STEPS.findIndex(([n])=>n===name);
    const soaked=name==='soak'?k:order>STEPS.findIndex(([n])=>n==='soak')||name==='end'?1:0;
    water.material.color.set(SOLUTION).lerp(new THREE.Color(RUSTY),.45*soaked*Math.min(1,rusty));

    // Fizzing while soaking: lots of fine bubbles.
    if(name==='soak'&&elapsed-lastFizz>.035){spawnFizz();lastFizz=elapsed;}

    // Lifting out: the rust flakes off in patches, flakes fall away.
    if(name==='up'||name==='crumble') {
      // Only once the key is clear of the solution (k>.55).
      const progress=name==='up'?.75*Math.max(0,(k-.55)/.45):.75+.25*k;
      erode=-.1+1.25*progress;
      setErode(erode);
      const target=Math.round(progress*(18+22*Math.min(1,rusty)));
      while(flaked<target){spawnFlake();flaked++;}
    }
    if(name==='shine'||name==='drain'||name==='away'||name==='end') {
      if(erode<1.15){erode=1.15;setErode(erode);}
      done=true;
    }
    if(name==='shine'&&!shine)shine=createShine({keyGroup,design});
    const shineDone=shine?shine.update(dt):false;

    for(let i=fizz.length-1;i>=0;i--) {
      const bubble=fizz[i];
      bubble.position.z+=bubble.userData.speed*dt;
      if(bubble.position.z>=level-.01||name!=='soak'&&name!=='up'){rig.remove(bubble);fizz.splice(i,1);}
    }
    for(let i=flakes.length-1;i>=0;i--) {
      const flake=flakes[i],data=flake.userData;
      data.velocity=Math.min(1.1,data.velocity+2.6*dt); // air drag keeps flakes light
      flake.position.y-=data.velocity*dt;
      flake.position.x+=Math.sin(elapsed*5+data.phase)*data.sway*dt;
      flake.rotation.x+=data.spin*dt;flake.rotation.y+=data.spin*.7*dt;
      if(rig.worldToLocal(flake.position.clone()).z<=level) {
        if(Math.random()<.5)splash(flake.position);
        scene.remove(flake);flakes.splice(i,1);
      }
    }
    for(let i=ripples.length-1;i>=0;i--) {
      const ripple=ripples[i];
      ripple.userData.age+=dt;
      const life=ripple.userData.age/.55;
      ripple.scale.setScalar(.03+.16*life);
      ripple.material.opacity=.7*(1-life);
      if(life>=1){rig.remove(ripple);ripple.material.dispose();ripples.splice(i,1);}
    }
    return name==='end'&&done&&(shineDone||!shine)&&!flakes.length&&!ripples.length&&!fizz.length;
  }

  function dispose() {
    for(const ripple of ripples)ripple.material.dispose();
    for(const flake of flakes)scene.remove(flake);
    fizz.length=flakes.length=ripples.length=0;
    shine?.dispose();
    keyGroup.position.copy(home);
    scene.remove(rig);
    rig.traverse(object=>{object.geometry?.dispose();if(object.material&&object.material!==fizzMaterial)object.material.dispose();});
    for(const resource of [fizzGeometry,fizzMaterial,flakeGeometry,...flakeMaterials,rippleGeometry])resource.dispose();
  }

  return {update,dispose,get done(){return done;}};
}
