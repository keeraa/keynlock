// The original KEYNLOCK laboratory's leather-and-iron precision oiler,
// reused at the workbench with the same hand-painted silhouette and pump.
export function createWorkbenchOiler({THREE,document,root,hitObjects,mat,
  tableSurfaceZ,lockTopZ}){
  const rest=new THREE.Vector3(3.65,1.00,tableSurfaceZ+.035);
  const positionTarget=rest.clone();
  const model=new THREE.Group();model.position.copy(rest);
  model.rotation.x=Math.PI/2;model.scale.setScalar(.47);
  root.add(model);
  const c=document.createElement('canvas');c.width=256;c.height=512;
  const ctx=c.getContext('2d');ctx.fillStyle='#a36b3e';ctx.fillRect(0,0,256,512);
  let seed=0x7349baac;
  const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  for(let i=0;i<5700;i++){
    const x=random()*256,y=random()*512,w=.5+random()*9,h=.4+random()*6;
    ctx.fillStyle=random()>.55?`rgba(56,30,16,${.02+random()*.25})`:
      `rgba(241,190,117,${.02+random()*.19})`;
    ctx.fillRect(x,y,w,h);
  }
  const leatherMap=new THREE.CanvasTexture(c);
  leatherMap.colorSpace=THREE.SRGBColorSpace;
  leatherMap.wrapS=leatherMap.wrapT=THREE.RepeatWrapping;
  const leather=new THREE.MeshStandardMaterial({color:0xb58a61,map:leatherMap,
    bumpMap:leatherMap,bumpScale:.017,roughness:.85,metalness:.03});
  const iron=mat.steel.clone(),dark=mat.dark.clone(),brass=mat.brass.clone();
  const strap=new THREE.MeshStandardMaterial({color:0x774729,roughness:.86});
  const add=(geometry,material,position=[0,0,0])=>{
    const mesh=new THREE.Mesh(geometry,material);mesh.position.set(...position);
    mesh.castShadow=true;mesh.receiveShadow=true;model.add(mesh);return mesh;};
  const silhouette=[[0,0],[.27,.02],[.39,.09],[.43,.21],[.445,.39],[.416,.57],
    [.374,.74],[.319,.94],[.265,1.095],[.231,1.19],[.215,1.27],[0,1.29]];
  add(new THREE.LatheGeometry(silhouette.map(([r,y])=>new THREE.Vector2(r,y)),48),leather);
  const radiusAt=y=>{
    for(let i=1;i<silhouette.length;i++){
      const [r0,y0]=silhouette[i-1],[r1,y1]=silhouette[i];
      if(y<=y1)return THREE.MathUtils.lerp(r0,r1,(y-y0)/(y1-y0));
    }
    return .215;
  };
  function hoop(radius,y,tube,material){
    const item=add(new THREE.TorusGeometry(radius,tube,12,64),material,[0,y,0]);
    item.rotation.x=Math.PI/2;return item;
  }
  for(const [y,tube,material] of [[.13,.022,iron],[.29,.020,dark],
    [1.05,.020,iron],[1.245,.020,dark]])hoop(radiusAt(y)+tube*1.02,y,tube,material);
  for(const angle of [-.59,.52]){
    const points=[[.407,.14],[.432,.31],[.396,.55],[.346,.79],[.289,1.02],[.23,1.23]]
      .map(([r,y])=>new THREE.Vector3(Math.sin(angle)*r,y,Math.cos(angle)*r));
    add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),48,.022,6,false),strap);
  }
  for(const y of [.13,.29])for(let i=0;i<12;i++){
    const a=i*Math.PI/6,r=radiusAt(y)+.018;
    add(new THREE.SphereGeometry(.012,9,7),brass,[Math.sin(a)*r,y,Math.cos(a)*r]);
  }
  const cylinder=(radius,height,x,y,z,material,segments=24)=>
    add(new THREE.CylinderGeometry(radius,radius,height,segments),material,[x,y,z]);
  cylinder(.222,.13,0,1.30,0,iron);
  cylinder(.152,.125,0,1.405,0,dark);
  hoop(.149,1.456,.018,brass);
  const needle=add(new THREE.CylinderGeometry(.010,.041,.81,14),iron,[0,1.93,0]);
  needle.rotation.z=-.027;
  cylinder(.019,.09,-.013,2.365,0,brass,12);
  cylinder(.039,.285,.294,1.465,0,iron,18);
  cylinder(.102,.06,.294,1.625,0,dark);
  cylinder(.075,.03,.294,1.660,0,brass);
  const thumb=add(new THREE.BoxGeometry(.115,.15,.075),iron,[.277,1.31,.105]);
  thumb.rotation.z=.04;
  const handlePath=new THREE.CatmullRomCurve3([
    new THREE.Vector3(.39,.94,.015),new THREE.Vector3(.60,.94,.015),
    new THREE.Vector3(.79,.70,.035),new THREE.Vector3(.80,.42,.035),
    new THREE.Vector3(.64,.23,.025),new THREE.Vector3(.43,.24,.020)]);
  add(new THREE.TubeGeometry(handlePath,46,.039,9,false),iron);
  for(const [x,y,z] of [[.39,.94,.015],[.43,.24,.02]])
    add(new THREE.SphereGeometry(.055,12,9),brass,[x,y,z]);
  const hit=add(new THREE.CylinderGeometry(.49,.49,2.38,16),
    new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0,
      depthWrite:false}),[0,1.19,0]);
  hit.userData={kind:'oilCan'};hit.castShadow=false;hit.receiveShadow=false;
  hitObjects.push(hit);
  const dropGeometry=new THREE.SphereGeometry(.025,12,8);
  const dropMaterial=new THREE.MeshPhysicalMaterial({color:0xac7b35,
    transparent:true,opacity:.86,roughness:.16,metalness:.1});
  const drops=[];let held=false;
  function setHeld(next){held=Boolean(next);
    hit.userData.pickable=!held;
    if(!held)positionTarget.copy(rest);return held;}
  function moveTo(point){if(!held||!point)return;
    positionTarget.set(THREE.MathUtils.clamp(point.x,-5,5),
      THREE.MathUtils.clamp(point.y,-3,3),
      Math.max(lockTopZ+.12,tableSurfaceZ+.25));
  }
  function tipPosition(){model.updateWorldMatrix(true,false);
    const point=model.localToWorld(new THREE.Vector3(0,2.365,0));
    return root.worldToLocal(point);}
  function pourAt(target){
    if(!target)return false;
    const start=tipPosition();
    for(let i=0;i<3;i++){
      const mesh=new THREE.Mesh(dropGeometry,dropMaterial);
      mesh.userData.oilVisual=true;mesh.position.copy(start);
      root.add(mesh);
      drops.push({mesh,start:start.clone(),end:target.clone(),age:-i*.065});
    }
    return true;
  }
  function tick(dt){
    model.position.lerp(positionTarget,1-Math.exp(-15*dt));
    model.rotation.z+=((held?-.26:0)-model.rotation.z)*(1-Math.exp(-9*dt));
    for(let i=drops.length-1;i>=0;i--){
      const drop=drops[i];drop.age+=dt;
      const t=THREE.MathUtils.clamp(drop.age/.42,0,1);
      drop.mesh.position.copy(drop.start).lerp(drop.end,t*t*(3-2*t));
      drop.mesh.position.z+=Math.sin(t*Math.PI)*.16;
      if(t>=1){root.remove(drop.mesh);drops.splice(i,1);}
    }
  }
  function dispose(){
    drops.forEach(drop=>root.remove(drop.mesh));
    leatherMap.dispose();dropGeometry.dispose();dropMaterial.dispose();
  }
  return {model,rest,setHeld,moveTo,pourAt,tick,dispose};
}
