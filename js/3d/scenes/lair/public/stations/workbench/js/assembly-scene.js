import * as THREE from 'three';
import {createSpurGear} from './lock-profiles.js';
import {checkSocket} from './logic.js';
import {assemblyStepsFor,hasExtraHardware} from './assembly-design.js';

const PIN_X=[-1.72,-1.11,-.50,.11];
const PIN_BOTTOM=-.88;
const PIN_LENGTHS=[.52,.59,.66,.73];
const DRIVER_LENGTH=.31;
const CAP_Y=.86;

export function createAssemblyMechanism({scene,shapes,mat,addMesh,hitObjects,makeTextLabel}){
  // The pin assembly uses the source laboratory's capsule pins, driver pins,
  // genuine normalized helices, and the exact 12/16-tooth spur gear generator.
  const assemblyRoot=new THREE.Group();assemblyRoot.position.set(.03,.06,.17);assemblyRoot.visible=false;scene.add(assemblyRoot);
  shapes.box(assemblyRoot,5.55,2.25,.34,.08,.12,-.45,mat.dark,.14);
  shapes.box(assemblyRoot,5.38,2.09,.085,.08,.12,-.23,mat.dark2,.09);
  shapes.box(assemblyRoot,3.06,.56,.58,-.81,.90,-.10,mat.dark,.05);
  // Empty outer housing; the player must install the rotating inner plug.
  shapes.cyl(assemblyRoot,.355,2.92,-.81,-.51,-.28,mat.glass,'x',52);
  // Front inspection window opens the visual path to the inner pin stacks.
  shapes.box(assemblyRoot,3.08,.67,.09,-.81,-.56,-.13,mat.glass,.025);
  const shear=addMesh(assemblyRoot,new THREE.BoxGeometry(3.05,.013,.014),
    new THREE.MeshBasicMaterial({color:0xe7bc7b,transparent:true,opacity:.47}),[-.81,-.10,.27]);
  shear.castShadow=false;
  const axleBridge=shapes.cyl(assemblyRoot,.075,.65,.83,-.49,-.16,mat.steel,'x',28);
  const latch=shapes.box(assemblyRoot,.57,.17,.21,2.38,-.46,-.09,mat.copper,.03);
  shapes.box(assemblyRoot,2.05,1.43,.15,1.43,.04,-.42,mat.dark,.08);
  const slots={};const installedParts=new Map(),parts=new Map();
  const springDrivers=[];
  const socketMarkers=[];
  function addSocket(id,position,radius=.17){
    const marker=addMesh(assemblyRoot,new THREE.TorusGeometry(radius,.012,8,40),
      new THREE.MeshBasicMaterial({color:0xcda971,transparent:true,opacity:.78}),position);
    marker.castShadow=false;socketMarkers.push(marker);
    const hit=addMesh(assemblyRoot,new THREE.SphereGeometry(radius*1.35,12,10),mat.hit,position);
    hit.userData={kind:'slot',id};hitObjects.push(hit);
    slots[id]={position:new THREE.Vector3(...position),marker,hit};
  }
  addSocket('core-0',[-.81,-.51,.34],.32);
  addSocket('cover-0',[-.81,1.11,.40],.28);
  PIN_X.forEach((x,i)=>{
    const well=shapes.cyl(assemblyRoot,.147,.90,x,.34,-.20,mat.glass,'y',28);
    well.castShadow=false;
    const ring=addMesh(assemblyRoot,new THREE.TorusGeometry(.132,.017,8,32),mat.copper,[x,.66,-.13]);
    ring.rotation.x=Math.PI/2;
    const driver=shapes.driverPin(assemblyRoot,DRIVER_LENGTH,.087,x,-.10,.27,mat.pin,i);
    springDrivers.push({driver});
    addSocket(`pin-${i}`,[x,-.47,.36],.19);
    addSocket(`spring-${i}`,[x,.65,.37],.16);
    const label=makeTextLabel(THREE,String(i+1));label.position.set(x,-1.04,.24);assemblyRoot.add(label);
  });
  let teethA=12,teethB=16;
  const pitchA=.28,pitchB=pitchA*16/12;
  const gearCenters=[new THREE.Vector3(1.18,-.13,.21),new THREE.Vector3(1.18+pitchA+pitchB,-.13,.21)];
  gearCenters.forEach((v,i)=>{
    shapes.cyl(assemblyRoot,.075,.50,v.x,v.y,-.23,mat.spring,'z',24);
    const collar=addMesh(assemblyRoot,new THREE.TorusGeometry(.115,.017,8,32),mat.copper,[v.x,v.y,-.16]);
    collar.castShadow=false;
    addSocket(`gear-${i}`,[v.x,v.y,.41],i===0?.28:.36);
  });
  addSocket('cam-0',[gearCenters[1].x,gearCenters[1].y,.68],.20);
  const outputBar=shapes.box(assemblyRoot,.42,.12,.11,2.47,-.12,-.10,mat.spring,.025);
  outputBar.position.x=2.48;
  addSocket('washer-0',[gearCenters[0].x,gearCenters[0].y,.51],.19);
  addSocket('washer-1',[gearCenters[1].x,gearCenters[1].y,.51],.19);
  addSocket('clip-0',[gearCenters[1].x,gearCenters[1].y,.83],.14);
  addSocket('rod-0',[2.10,-.30,.48],.17);
  addSocket('bolt-0',[2.40,-.49,.46],.19);

  function addPart(id,home,buildHit){
    const group=new THREE.Group();group.position.set(...home);assemblyRoot.add(group);
    const hit=buildHit(group);hit.userData={kind:'part',id};hitObjects.push(hit);
    const obj={id,group,home:new THREE.Vector3(...home),hit};parts.set(id,obj);return obj;
  }
  // A translucent plug exposes the 3D stacks while retaining the shape of a
  // real horizontal core and its circular keyway entrance.
  addPart('core-0',[-.83,-1.33,.73],group=>{
    const transparentBrass=new THREE.MeshStandardMaterial({color:0xc9ac78,
      metalness:.52,roughness:.46,transparent:true,opacity:.84,depthWrite:false});
    group.userData.coreBody=shapes.cyl(group,.296,2.84,0,0,0,transparentBrass,'x',52);
    const front=addMesh(group,new THREE.TorusGeometry(.274,.032,10,48),mat.copper,[-1.42,0,0]);
    front.rotation.y=Math.PI/2;
    return addMesh(group,new THREE.BoxGeometry(2.91,.70,.68),mat.hit);
  });
  for(let code=0;code<4;code++){
    const len=PIN_LENGTHS[code];
    const obj=addPart(`pin-${code}`,[-2.33+code*.52,-1.27,.70],group=>{
      shapes.capsulePin(group,len,.087,0,0,0,mat.pin,code);
      return addMesh(group,new THREE.CylinderGeometry(.16,.16,len+.09,12),mat.hit);
    });
    const label=makeTextLabel(THREE,['I','II','III','IV'][code]);label.position.set(0,-.45,.16);obj.group.add(label);
  }
  for(let i=0;i<4;i++) addPart(`spring-${i}`,[-.24+i*.32,-1.62,.70],group=>{
    const spring=shapes.makeSpring(group,.069,8);spring.scale.y=.44;
    const hit=addMesh(group,new THREE.CylinderGeometry(.16,.16,.48,12),mat.hit,[0,.22,0]);
    group.userData.springMesh=spring;return hit;
  });
  const gears=[],gearLabels=[];
  for(let i=0;i<2;i++){
    const teeth=i===0?teethA:teethB,pitch=i===0?pitchA:pitchB;
    const obj=addPart(`gear-${i}`,[1.47+i*.96,-1.28,.71],group=>{
      const gear=createSpurGear(THREE,teeth,pitch,.12,i===0?mat.brass:mat.steel);
      group.add(gear);gears[i]=gear;
      shapes.cyl(group,.071,.24,0,0,.06,mat.spring,'z',20);
      const hit=addMesh(group,new THREE.CylinderGeometry(pitch+.05,pitch+.05,.28,32),mat.hit,[0,0,.07]);
      hit.rotation.x=Math.PI/2;return hit;
    });
    obj.group.rotation.z=0;
    const labels=[12,16].map(value=>{
      const label=makeTextLabel(THREE,String(value));
      label.position.set(0,-.55,.13);obj.group.add(label);return label;
    });
    gearLabels[i]=labels;
  }
  addPart('cam-0',[.49,-1.28,.75],group=>{
    shapes.cyl(group,.195,.16,0,0,0,mat.copper,'z',32);
    shapes.cyl(group,.053,.19,.125,0,.11,mat.steel,'z',20);
    const collar=addMesh(group,new THREE.TorusGeometry(.115,.018,8,32),mat.spring,[0,0,.11]);
    collar.castShadow=false;
    const hit=addMesh(group,new THREE.CylinderGeometry(.24,.24,.24,32),mat.hit,[0,0,.08]);
    hit.rotation.x=Math.PI/2;return hit;
  });
  addPart('cover-0',[-.76,-1.30,.75],group=>{
    shapes.box(group,3.02,.105,.55,0,0,0,mat.copper,.026);
    for(let x of [-1.25,1.25]){
      shapes.cyl(group,.041,.59,x,0,0,mat.spring,'z',20);
      shapes.cyl(group,.072,.070,x,0,.315,mat.steel,'z',24);
    }
    return addMesh(group,new THREE.BoxGeometry(3.15,.25,.70),mat.hit);
  });
  // Retaining washers and the split snap ring are separate selectable meshes.
  for(let i=0;i<2;i++)addPart(`washer-${i}`,[-1.25+i*.70,-1.42,.76],group=>{
    const disc=addMesh(group,new THREE.RingGeometry(.082,.22,44),mat.steel);
    disc.castShadow=true;
    const rim=addMesh(group,new THREE.TorusGeometry(.20,.018,8,40),mat.copper,[0,0,.01]);
    rim.castShadow=true;
    return addMesh(group,new THREE.CylinderGeometry(.26,.26,.14,28),mat.hit);
  });
  addPart('clip-0',[.12,-1.42,.76],group=>{
    const ring=addMesh(group,new THREE.TorusGeometry(.17,.034,10,36,Math.PI*1.74),mat.steel);
    ring.rotation.z=.41;
    for(const x of [-.156,.156])shapes.cyl(group,.035,.044,x,-.01,0,mat.copper,'z',16);
    return addMesh(group,new THREE.CylinderGeometry(.25,.25,.12,32),mat.hit);
  });
  addPart('rod-0',[1.23,-1.42,.76],group=>{
    shapes.cyl(group,.057,.64,0,0,0,mat.steel,'x',22);
    for(const x of [-.31,.31]){
      shapes.cyl(group,.092,.08,x,0,.02,mat.copper,'z',24);
      shapes.cyl(group,.043,.085,x,0,.075,mat.dark2,'z',18);
    }
    return addMesh(group,new THREE.BoxGeometry(.78,.22,.20),mat.hit);
  });
  addPart('bolt-0',[2.26,-1.42,.76],group=>{
    shapes.box(group,.69,.17,.24,0,0,0,mat.steel,.045);
    shapes.box(group,.16,.23,.26,.16,0,0,mat.copper,.028);
    return addMesh(group,new THREE.BoxGeometry(.79,.28,.30),mat.hit);
  });
  const selectionHalo=addMesh(assemblyRoot,new THREE.TorusGeometry(.22,.017,8,48),
    new THREE.MeshBasicMaterial({color:0xffe0a0,transparent:true,opacity:.90,depthTest:false}),[0,0,.87]);
  selectionHalo.visible=false;selectionHalo.renderOrder=12;
  let partGroup=0,variant='classic',design={order:[2,0,3,1],ratio:'12:16',reinforced:true};
  let currentInstalled={};
  function setPartGroup(index){
    partGroup=THREE.MathUtils.clamp(index,0,assemblyStepsFor(variant,design).length-1);
    refreshPartVisibility();
  }
  function setAssemblyDesign(nextVariant,nextDesign){
    variant=nextVariant;design=nextDesign;
    const nextTeeth=variant==='free'&&design.ratio==='16:12'?[16,12]:[12,16];
    if(nextTeeth[0]!==teethA||nextTeeth[1]!==teethB){
      [teethA,teethB]=nextTeeth;
      for(let i=0;i<2;i++){
        const pitch=i===0?(teethA===12?pitchA:pitchB):(teethB===12?pitchA:pitchB);
        const geometry=createSpurGear(THREE,nextTeeth[i],pitch,.12,
          i===0?mat.brass:mat.steel).geometry;
        gears[i].geometry.dispose();gears[i].geometry=geometry;
      }
    }
    for(let i=0;i<2;i++)gearLabels[i].forEach((label,j)=>{
      label.visible=(j===0?12:16)===(i===0?teethA:teethB);
    });
    setPartGroup(partGroup);
    updateInstalled(currentInstalled);
  }
  function refreshPartVisibility(){
    const steps=assemblyStepsFor(variant,design);
    const active=new Set(steps[partGroup]?.slots||[]);
    const available=new Set(steps.flatMap(step=>step.slots));
    for(const [id,obj] of parts){
      const installed=[...installedParts.values()].includes(id);
      obj.group.visible=available.has(id)&&(installed||active.has(id));
      obj.hit.visible=obj.group.visible;
    }
    for(const [id,slot] of Object.entries(slots)){
      slot.marker.visible=active.has(id)&&!installedParts.has(id);
      slot.hit.visible=active.has(id);
    }
    selectionHalo.visible=selectionHalo.visible&&parts.get(selectionHalo.userData.selected)?.group.visible===true;
  }

  function updateInstalled(installed){
    currentInstalled={...installed};
    latch.position.x=2.38;outputBar.position.x=2.48;
    installedParts.clear();
    for(const [slot,id] of Object.entries(installed))if(id)installedParts.set(slot,id);
    for(const [id,obj] of parts){
      const slot=[...installedParts.entries()].find(([,value])=>value===id)?.[0];
      if(id==='core-0')obj.group.userData.coreBody.material.opacity=slot ? 0.28 : 0.84;
      if(!slot){obj.group.position.copy(obj.home);obj.group.rotation.z=0;
        if(id.startsWith('spring-'))obj.group.userData.springMesh.scale.y=.44;
        continue;}
      const slotNumber=Number(slot.split('-')[1]);
      if(id==='core-0'){
        obj.group.position.set(-.81,-.51,-.29);
      }else if(id==='cover-0'){
        obj.group.position.set(-.81,1.12,-.10);
      }else if(id==='cam-0'){
        obj.group.position.set(gearCenters[1].x,gearCenters[1].y,.48);
        obj.group.rotation.z=0;
      }else if(id.startsWith('washer-')){
        obj.group.position.set(gearCenters[slotNumber].x,gearCenters[slotNumber].y,.40);
      }else if(id==='clip-0'){
        obj.group.position.set(gearCenters[1].x,gearCenters[1].y,.77);
      }else if(id==='rod-0'){
        obj.group.position.set(2.10,-.30,.43);
        obj.group.rotation.z=-.53;
      }else if(id==='bolt-0'){
        obj.group.position.set(2.40,-.49,.39);
      }else if(id.startsWith('pin-')){
        const code=Number(id.split('-')[1]);
        obj.group.position.set(PIN_X[slotNumber],PIN_BOTTOM+PIN_LENGTHS[code]/2,.35);
      }else if(id.startsWith('spring-')){
        obj.group.position.set(PIN_X[slotNumber],.15,.35);
      }else if(id.startsWith('gear-')){
        obj.group.position.copy(gearCenters[slotNumber]);
        obj.group.position.z=.25;
        obj.group.rotation.z=slotNumber===0?0:Math.PI/teethB;
      }
    }
    for(let i=0;i<4;i++){
      const id=installedParts.get(`pin-${i}`),code=id?Number(id.split('-')[1]):1;
      const base=PIN_BOTTOM+PIN_LENGTHS[code];
      const {driver}=springDrivers[i];
      driver.position.y=base+DRIVER_LENGTH/2;
      const bottom=base+DRIVER_LENGTH;
      const springId=installedParts.get(`spring-${i}`);
      if(springId){
        const obj=parts.get(springId);
        obj.group.position.y=bottom;
        obj.group.userData.springMesh.scale.y=CAP_Y-bottom;
      }
    }
    for(const [id,slot] of Object.entries(slots))slot.marker.material.opacity=installedParts.has(id)?.15:.78;
    refreshPartVisibility();
  }
  updateInstalled({});
  function setSelectedPart(id){
    const obj=parts.get(id);selectionHalo.visible=Boolean(obj);
    selectionHalo.userData.selected=id;
    if(obj){selectionHalo.position.copy(obj.group.position);selectionHalo.position.z+=.24;
      selectionHalo.scale.setScalar(id.startsWith('gear-')?1.75:
        (id==='core-0'||id==='cover-0'?2.15:1));}
    for(const [socket,entry] of Object.entries(slots)){
      const suggested=Boolean(id&&checkSocket(id,socket));
      entry.marker.material.color.setHex(suggested?0xb2e7b4:0xcda971);
      if(entry.marker.visible)entry.marker.material.opacity=suggested?.99:.78;
    }
  }
  function movePart(id,point){const obj=parts.get(id);if(!obj)return;
    obj.group.position.set(point.x,point.y,.77);
    if(id.startsWith('spring-'))obj.group.userData.springMesh.scale.y=.44;
    setSelectedPart(id);
  }
  function findNearestSocket(id,point,maxDistance=.62){
    let best=null,bestDistance=maxDistance;
    for(const [slot,{position}] of Object.entries(slots)){
      if(!checkSocket(id,slot)||!assemblyStepsFor(variant,design)
        .some(step=>step.slots.includes(slot)))continue;
      const d=Math.hypot(point.x-position.x,point.y-position.y);
      if(d<bestDistance){bestDistance=d;best=slot;}
    }return best;
  }


  let test=null;
  function startTest(correct,cuts,installed,onDone){
    if(test)return false;
    test={start:performance.now(),correct,cuts:[...cuts],installed:{...installed},onDone,
      hardware:hasExtraHardware(variant,design)};
    return true;
  }
  function updateTest(now){
    if(!test)return;
    const elapsed=now-test.start;
    const up=THREE.MathUtils.smoothstep(elapsed,0,950);
    const down=1-THREE.MathUtils.smoothstep(elapsed,1500,2200);
    const factor=up*down;
    for(let i=0;i<4;i++){
      const id=test.installed[`pin-${i}`];if(!id)continue;
      const code=Number(id.split('-')[1]);const lift=Math.max(0,.3-test.cuts[i]);
      parts.get(id).group.position.y=PIN_BOTTOM+PIN_LENGTHS[code]/2+lift*factor;
      const {driver}=springDrivers[i];
      const base=PIN_BOTTOM+PIN_LENGTHS[code]+lift*factor;
      driver.position.y=base+DRIVER_LENGTH/2;
      const bottom=base+DRIVER_LENGTH;
      const idSpring=test.installed[`spring-${i}`];
      if(idSpring){const obj=parts.get(idSpring);
        obj.group.position.y=bottom;obj.group.userData.springMesh.scale.y=CAP_Y-bottom;}
    }
    const turnProgress=THREE.MathUtils.smoothstep(elapsed,550,1750);
    const gearAngle=test.correct?1.35*turnProgress:.11*factor;
    if(test.installed['gear-0'])parts.get(test.installed['gear-0']).group.rotation.z=gearAngle;
    if(test.installed['gear-1'])parts.get(test.installed['gear-1']).group.rotation.z=-gearAngle*(teethA/teethB)+Math.PI/teethB;
    if(test.installed['cam-0'])parts.get(test.installed['cam-0']).group.rotation.z=-gearAngle*(teethA/teethB)+Math.PI/teethB;
    if(test.hardware){
      for(let i=0;i<2;i++)if(test.installed[`washer-${i}`])
        parts.get(test.installed[`washer-${i}`]).group.rotation.z=i===0?gearAngle:
          -gearAngle*(teethA/teethB)+Math.PI/teethB;
      if(test.installed['clip-0'])parts.get(test.installed['clip-0']).group.rotation.z=
        -gearAngle*(teethA/teethB);
      if(test.installed['rod-0']){
        const rod=parts.get(test.installed['rod-0']).group;
        rod.position.x=2.10+(test.correct?.12:0)*turnProgress;
        rod.rotation.z=-.53+(test.correct?.13:0)*turnProgress;
      }
      if(test.installed['bolt-0'])parts.get(test.installed['bolt-0']).group.position.x=
        2.40+(test.correct?.24:0)*turnProgress;
    }
    latch.position.x=2.38+(test.correct?.24:0)*turnProgress;
    outputBar.position.x=2.48+(test.correct?.24:0)*turnProgress;
    if(elapsed>2300){
      const cb=test.onDone,wasCorrect=test.correct,wasHardware=test.hardware;
      test=null;updateInstalled(Object.fromEntries(installedParts));
      if(wasCorrect){
        parts.get('gear-0').group.rotation.z=1.35;
        parts.get('gear-1').group.rotation.z=-1.35*(teethA/teethB)+Math.PI/teethB;
        parts.get('cam-0').group.rotation.z=-1.35*(teethA/teethB)+Math.PI/teethB;
        if(wasHardware){
          for(let i=0;i<2;i++)if(installedParts.get(`washer-${i}`))
            parts.get(installedParts.get(`washer-${i}`)).group.rotation.z=i===0?1.35:
              -1.35*(teethA/teethB)+Math.PI/teethB;
          if(installedParts.get('clip-0'))parts.get(installedParts.get('clip-0')).group.rotation.z=
            -1.35*(teethA/teethB);
          if(installedParts.get('rod-0')){
            const rod=parts.get(installedParts.get('rod-0')).group;
            rod.position.x+=.12;rod.rotation.z+=.13;
          }
          if(installedParts.get('bolt-0'))parts.get(installedParts.get('bolt-0')).group.position.x+=.24;
        }
        latch.position.x=2.62;outputBar.position.x=2.72;
      }
      cb?.();
    }
  }


  return {root:assemblyRoot,setPartGroup,setAssemblyDesign,updateInstalled,setSelectedPart,movePart,
    findNearestSocket,startTest,updateTest};
}
