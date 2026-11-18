// A self-contained, five-wheel transmission inside the same SIKISI lock body.
// The gears have real involute-like teeth, touching pitch circles and exact
// alternating angular ratios; one input drives the cam, bolt and shackle.
export const GEAR_TRAIN_SPECS=Object.freeze([
  {x:-1.135,y:.11,r:.30,teeth:16},
  {x:-.574,y:-.10,r:.30,teeth:16},
  {x:-.032,y:.11,r:.28,teeth:14},
  {x:.510,y:-.10,r:.30,teeth:16},
  {x:1.065,y:.11,r:.29,teeth:14}
].map(spec=>Object.freeze(spec)));

export function createGearLockMode({THREE,root,lockMount,hardware,fastenerFixtures,
  mat,hitObjects,createSpurGear}){
  const assembly=new THREE.Group();
  assembly.name='Шестерёнчатый замок';
  assembly.position.copy(lockMount.position);
  assembly.scale.copy(lockMount.scale);
  root.add(assembly);
  // Reuse the actual case geometry and painted materials. It is a separate
  // instance, so swapping modes never changes the player's disassembled lock.
  for(const part of [hardware.rearCover,hardware.sideShell,hardware.frontBezel,
    ...fastenerFixtures,...hardware.shackleCollars]){
    const clone=part.clone(true);assembly.add(clone);
  }
  const shackle=hardware.shacklePivot.clone(true);
  const shackleRest=shackle.position.clone();assembly.add(shackle);
  const specs=GEAR_TRAIN_SPECS;
  const shaftMaterial=mat.steel.clone();
  const edgeMaterial=mat.brass.clone();
  const wheels=specs.map((spec,i)=>{
    const pivot=new THREE.Group();pivot.position.set(spec.x,spec.y,.37);
    assembly.add(pivot);
    const metal=(i%2?mat.steel:mat.brass).clone();
    const toothed=createSpurGear(spec.teeth,spec.r,.15,metal);
    toothed.position.z=-.075;pivot.add(toothed);
    const shaft=new THREE.Mesh(new THREE.CylinderGeometry(.078,.078,.22,32),shaftMaterial);
    shaft.rotation.x=Math.PI/2;pivot.add(shaft);
    const head=new THREE.Mesh(new THREE.CylinderGeometry(.108,.108,.03,32),edgeMaterial);
    head.rotation.x=Math.PI/2;head.position.z=.117;pivot.add(head);
    const stripe=new THREE.Mesh(new THREE.BoxGeometry(spec.r*.76,.028,.03),shaftMaterial);
    stripe.position.set(spec.r*.39,0,.14);pivot.add(stripe);
    if(i===0){
      const handle=new THREE.Mesh(new THREE.CylinderGeometry(.066,.066,.12,22),shaftMaterial);
      handle.rotation.x=Math.PI/2;handle.position.set(spec.r*.67,0,.19);
      pivot.add(handle);
      const knob=new THREE.Mesh(new THREE.SphereGeometry(.079,18,12),mat.brass);
      knob.position.set(spec.r*.67,0,.25);pivot.add(knob);
    }
    const edge=new THREE.Mesh(new THREE.TorusGeometry(spec.r+.025,.027,7,64),
      new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0,
        depthWrite:false,depthTest:false}));
    edge.position.set(0,0,.17);edge.renderOrder=22;edge.raycast=()=>{};
    pivot.add(edge);
    // Forgiving contact disks are separate from the actual gear geometry.
    const hit=new THREE.Mesh(new THREE.CircleGeometry(spec.r+.075,48),
      new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false,
        side:THREE.DoubleSide}));
    hit.position.set(spec.x,spec.y,.58);
    hit.userData={kind:'gearWheel',index:i};assembly.add(hit);hitObjects.push(hit);
    return {pivot,toothed,metal,edge,hit,spec,hover:0,targetHover:0};
  });
  // The last wheel operates a visible eccentric and connecting rod, which
  // pulls a sliding bolt out of the shackle's path.
  const output=specs.at(-1);
  const eccentric=new THREE.Group();eccentric.position.set(output.x,output.y,.59);
  assembly.add(eccentric);
  const peg=new THREE.Mesh(new THREE.CylinderGeometry(.058,.058,.045,20),edgeMaterial);
  peg.rotation.x=Math.PI/2;peg.position.x=.17;eccentric.add(peg);
  const bolt=new THREE.Group();bolt.position.set(1.36,-.59,.37);assembly.add(bolt);
  const boltBody=new THREE.Mesh(new THREE.BoxGeometry(.39,.17,.19),shaftMaterial);
  bolt.add(boltBody);
  const catchTip=new THREE.Mesh(new THREE.BoxGeometry(.20,.09,.13),edgeMaterial);
  catchTip.position.set(.21,0,0);bolt.add(catchTip);
  const link=new THREE.Mesh(new THREE.CylinderGeometry(.030,.030,1,12),edgeMaterial);
  assembly.add(link);
  const linkStart=new THREE.Vector3(),linkEnd=new THREE.Vector3(),linkAxis=new THREE.Vector3(0,1,0);
  const linkVector=new THREE.Vector3();
  let progress=0,desiredProgress=0,highlight=-1;
  const oil=new Set();
  function updateMechanism(){
    const driveAngle=progress*Math.PI*4.4;
    for(let i=0;i<wheels.length;i++){
      const gear=wheels[i];
      gear.pivot.rotation.z=(i%2?-1:1)*driveAngle*specs[0].teeth/gear.spec.teeth+
        (i%2?Math.PI/gear.spec.teeth:0);
    }
    const lastAngle=wheels.at(-1).pivot.rotation.z;
    eccentric.rotation.z=lastAngle;
    bolt.position.x=1.36-.33*progress;
    linkStart.set(output.x+.17*Math.cos(lastAngle),output.y+.17*Math.sin(lastAngle),.61);
    linkEnd.set(bolt.position.x-.16,bolt.position.y,.60);
    linkVector.subVectors(linkEnd,linkStart);
    link.position.copy(linkStart).add(linkEnd).multiplyScalar(.5);
    link.scale.y=linkVector.length();
    link.quaternion.setFromUnitVectors(linkAxis,linkVector.normalize());
    const release=THREE.MathUtils.smoothstep(progress,.82,1);
    shackle.position.copy(shackleRest);
    shackle.position.x+=.48*release;
    shackle.rotation.z=release*.085;
  }
  function turn(amount){
    const gain=.75+oil.size*.14;
    desiredProgress=THREE.MathUtils.clamp(desiredProgress+amount*gain,0,1);
    return state();
  }
  function lubricate(index){
    if(!Number.isInteger(index)||index<0||index>=wheels.length)return false;
    if(oil.has(index))return false;
    oil.add(index);
    const wheel=wheels[index];
    wheel.metal.roughness=.23;
    wheel.metal.metalness=.75;
    wheel.metal.color.multiplyScalar(.83);
    const film=new THREE.Mesh(new THREE.RingGeometry(.14,wheel.spec.r*.77,48),
      new THREE.MeshBasicMaterial({color:0xa37b43,transparent:true,opacity:.25,
        depthWrite:false,side:THREE.DoubleSide}));
    film.position.z=.172;film.userData.oilVisual=true;
    wheel.pivot.add(film);wheel.film=film;
    return true;
  }
  function reset(){
    progress=0;desiredProgress=0;oil.clear();
    for(const wheel of wheels){
      wheel.metal.roughness=(wheels.indexOf(wheel)%2?mat.steel:mat.brass).roughness;
      wheel.metal.metalness=(wheels.indexOf(wheel)%2?mat.steel:mat.brass).metalness;
      wheel.metal.color.copy((wheels.indexOf(wheel)%2?mat.steel:mat.brass).color);
      if(wheel.film){wheel.pivot.remove(wheel.film);wheel.film.geometry.dispose();
        wheel.film.material.dispose();wheel.film=null;}
    }
    updateMechanism();
  }
  function state(){return {progress:Math.round(progress*100),open:progress>=.9999,
    lubricated:oil.size,total:wheels.length,teeth:specs.map(s=>s.teeth),
    status:progress>=.9999?'Дужка освобождена':
      progress>.78?'Ригель почти вышел':
      progress>.30?'Вращение дошло до кулачка':'Передайте вращение от первой шестерни'};}
  function setHover(index){highlight=Number.isInteger(index)?index:-1;
    wheels.forEach((wheel,i)=>{wheel.targetHover=i===highlight?1:0;});}
  function tick(dt){
    if(Math.abs(desiredProgress-progress)>.00001){
      progress+=(desiredProgress-progress)*(1-Math.exp(-12*dt));
      if(Math.abs(desiredProgress-progress)<.0007)progress=desiredProgress;
      updateMechanism();
    }
    for(const wheel of wheels){
      wheel.hover+=(wheel.targetHover-wheel.hover)*(1-Math.exp(-16*dt));
      wheel.edge.material.opacity=wheel.hover*.93;
    }
  }
  function wheelCenter(index){
    const spec=specs[index];if(!spec)return null;
    const point=new THREE.Vector3(spec.x,spec.y,.60);
    assembly.localToWorld(point);return root.worldToLocal(point);
  }
  updateMechanism();assembly.visible=false;
  return {group:assembly,wheels,setVisible:value=>{assembly.visible=Boolean(value);},
    setHover,tick,turn,lubricate,reset,state,wheelCenter};
}
