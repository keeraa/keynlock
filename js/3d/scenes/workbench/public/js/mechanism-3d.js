import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {BOARD,PARTS,PIN_CODES,portsFor,canPick,makePart,keywayWrenchProfile} from './mechanism-engine.js';
import {createClassicLockHousing} from './classic-lock-housing.js';
import {createStandardPickingTools,STANDARD_TENSION_TOOLS,tensionProfileHeight,
  TENSION_GUIDE_STATIONS} from './mechanism-lockpicks.js';

// The contact solver works in drawing coordinates. Both the mechanism and its
// mounting points live on real, depth-separated surfaces inside this 3D case.
const SCALE=.012;
const AT_Z=.10;
const KEY_SIDE_X=-5.80;
const toWorld=(x,y,z=0)=>new THREE.Vector3((x-BOARD.width/2)*SCALE,
  (BOARD.height/2-y)*SCALE,z);
const fromWorld=point=>({x:Math.round(point.x/SCALE+BOARD.width/2),
  y:Math.round(BOARD.height/2-point.y/SCALE)});
const segmentCache=new Map();

function material(color,metalness=.65,roughness=.48,other={}){
  return new THREE.MeshStandardMaterial({color,metalness,roughness,...other});
}
function put(root,geometry,finish,x=0,y=0,z=0){
  const mesh=new THREE.Mesh(geometry,finish);mesh.position.set(x,y,z);
  mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);return mesh;
}
function block(root,w,h,d,finish,x=0,y=0,z=0,r=.035){
  return put(root,new RoundedBoxGeometry(w,h,d,3,Math.min(r,w*.23,h*.23,d*.32)),
    finish,x,y,z);
}
function disc(root,r,d,finish,x=0,y=0,z=0,sides=32){
  const mesh=put(root,new THREE.CylinderGeometry(r,r,d,sides),finish,x,y,z);
  mesh.rotation.x=Math.PI/2;return mesh;
}
function ring(root,r,t,finish,x=0,y=0,z=0){
  return put(root,new THREE.TorusGeometry(r,t,7,44),finish,x,y,z);
}
function rod(root,a,b,r,finish){
  const direction=new THREE.Vector3().subVectors(b,a);
  if(direction.length()<.005)return null;
  const mesh=put(root,new THREE.CylinderGeometry(r,r,direction.length(),9),finish);
  mesh.position.copy(a).add(b).multiplyScalar(.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize());
  return mesh;
}
function gearGeometry(teeth=14,radius=.3){
  const name=`${teeth}:${radius}`;
  if(segmentCache.has(name))return segmentCache.get(name);
  const shape=new THREE.Shape();
  for(let i=0;i<teeth*4;i++){
    const theta=i*Math.PI*2/(teeth*4)+Math.PI/teeth/4;
    const r=radius*(i%4===1||i%4===2?1.12:.93);
    const x=Math.cos(theta)*r,y=Math.sin(theta)*r;
    if(i===0)shape.moveTo(x,y);else shape.lineTo(x,y);
  }
  shape.closePath();
  const hole=new THREE.Path();hole.absarc(0,0,radius*.24,0,Math.PI*2,true);
  shape.holes.push(hole);
  const g=new THREE.ExtrudeGeometry(shape,{depth:.13,steps:1,bevelEnabled:true,
    bevelSegments:2,bevelSize:.012,bevelThickness:.015,curveSegments:6});
  g.translate(0,0,-.065);
  segmentCache.set(name,g);return g;
}
function camGeometry(){
  const shape=new THREE.Shape();
  for(let i=0;i<=64;i++){
    const a=i*2*Math.PI/64;
    const r=.26+.105*Math.cos(a)+.045*Math.sin(2*a);
    const x=r*Math.cos(a),y=r*Math.sin(a);
    if(i===0)shape.moveTo(x,y);else shape.lineTo(x,y);
  }
  const g=new THREE.ExtrudeGeometry(shape,{depth:.14,bevelEnabled:true,
    bevelSize:.014,bevelThickness:.012,bevelSegments:2});
  g.translate(0,0,-.07);return g;
}
function coilGeometry(){
  const p=[];
  for(let i=0;i<=120;i++){
    const t=i/120,angle=t*Math.PI*20;
    p.push(new THREE.Vector3(-.36+t*.72,Math.cos(angle)*.086,Math.sin(angle)*.086));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(p),150,.019,6,false);
}
function verticalCoilGeometry(){
  const p=[];
  for(let i=0;i<=90;i++){
    const t=i/90,a=t*Math.PI*16;
    p.push(new THREE.Vector3(Math.cos(a)*.074,t*.38,Math.sin(a)*.074));
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(p),110,.014,6,false);
}
function shackleGeometry(){
  // The finished pin-lock uses a single machined horseshoe, with two straight
  // legs seated in the RIGHT wall. The whole bow moves as one rigid part.
  const k=(Math.sqrt(2)-1)*4/3,r=.92,x0=4.98,x1=6.48;
  const p=(x,y)=>new THREE.Vector3(x,y,-.02);
  const curve=new THREE.CurvePath();
  curve.add(new THREE.LineCurve3(p(x0,r),p(x1,r)));
  curve.add(new THREE.CubicBezierCurve3(p(x1,r),p(x1+k*r,r),p(x1+r,k*r),p(x1+r,0)));
  curve.add(new THREE.CubicBezierCurve3(p(x1+r,0),p(x1+r,-k*r),p(x1+k*r,-r),p(x1,-r)));
  curve.add(new THREE.LineCurve3(p(x1,-r),p(x0,-r)));
  return new THREE.TubeGeometry(curve,120,.19,16,false);
}
function label(root,words,x,y,z,width,ink){
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=80;
  const context=canvas.getContext('2d');
  context.fillStyle=ink;context.font='bold 36px ui-monospace,monospace';
  context.textAlign='center';context.fillText(words,256,51);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const mesh=put(root,new THREE.PlaneGeometry(width,width*80/512),
    new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,side:THREE.DoubleSide}),x,y,z);
  mesh.castShadow=false;mesh.userData.labelTexture=texture;return mesh;
}

export function createMechanism3D(canvas,options={}){
  const renderer=options.rendererFactory?.(canvas)||new THREE.WebGLRenderer({
    canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.8));
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.45;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  const scene=new THREE.Scene();scene.background=new THREE.Color(0x0d181b);
  scene.fog=new THREE.Fog(0x0d181b,20,43);
  const camera=new THREE.PerspectiveCamera(36,1,.05,80);
  const controls=options.controlsFactory?.(camera,canvas)||new OrbitControls(camera,canvas);
  controls.enableDamping=true;controls.dampingFactor=.075;controls.enablePan=true;
  controls.minDistance=10;controls.maxDistance=32;
  controls.minAzimuthAngle=-1.15;controls.maxAzimuthAngle=1.15;
  controls.minPolarAngle=.43;controls.maxPolarAngle=2.55;
  controls.mouseButtons.LEFT=THREE.MOUSE.ROTATE;
  controls.mouseButtons.RIGHT=THREE.MOUSE.PAN;
  controls.mouseButtons.MIDDLE=THREE.MOUSE.DOLLY;
  const shiftPan=event=>{if(event.button===0)
    controls.mouseButtons.LEFT=event.shiftKey?THREE.MOUSE.PAN:THREE.MOUSE.ROTATE;};
  canvas.addEventListener('pointerdown',shiftPan,{capture:true});
  const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
  const plane=new THREE.Plane(new THREE.Vector3(0,0,1),-.48);
  const tmp=new THREE.Vector3();
  const sceneMaterials={
    case:material(0x75898c,.78,.49),edge:material(0x283a41,.72,.47),
    steel:material(0x8d9fa1,.79,.42),dark:material(0x1b3039,.54,.62),
    inner:material(0x43525a,.68,.51),
    iron:material(0xb5c5c7,.85,.33),brass:material(0xd9ac6b,.82,.34),
    pale:material(0xdce3df,.83,.33),bronze:material(0xb88157,.78,.4),
    inset:material(0x182629,.69,.68),green:material(0x72bba7,.34,.46,{emissive:0x13503b,emissiveIntensity:.38}),
    red:material(0x975b57,.55,.51),
    glow:material(0xdfd08c,.38,.32,{emissive:0x6f4b18,emissiveIntensity:.4})
  };
  const m=sceneMaterials;
  // Use the same gouache metal maps as the finished pin-lock/workbench scene.
  // Geometry-only tests inject a renderer and do not need DOM image loading.
  const paintedTextures=[],paintedLoads=[];
  if(!options.rendererFactory){
    const loader=new THREE.TextureLoader();
    for(const [finish,name] of [['case','painted-steel'],['edge','painted-steel'],
      ['steel','painted-steel'],['inner','painted-steel'],['iron','painted-steel'],
      ['brass','painted-brass'],['bronze','painted-brass'],['pale','painted-pin']]){
      let ready;
      paintedLoads.push(new Promise(resolve=>{ready=resolve;}));
      const map=loader.load(`./assets/${name}.webp`,ready,undefined,ready);
      map.colorSpace=THREE.SRGBColorSpace;
      map.wrapS=map.wrapT=THREE.RepeatWrapping;map.repeat.set(2,2);map.anisotropy=4;
      m[finish].map=map;m[finish].needsUpdate=true;paintedTextures.push(map);
    }
  }
  const board=new THREE.Group();scene.add(board);
  // The rounded through-bored casting, bezel and rear cover come from the
  // finished five-pin lock rather than an enlarged flat electronics panel.
  createClassicLockHousing(board,{case:m.case,edge:m.edge});
  block(board,10.28,6.30,.11,m.inner,0,0,-.54,.13).receiveShadow=true;
  for(const y of [-2.84,2.84]){
    block(board,9.62,.10,.16,m.dark,0,y,-.34,.03);
  }
  for(const [x,y] of [[-4.85,-2.87],[4.85,-2.87],[-4.85,2.87],[4.85,2.87]]){
    disc(board,.13,.10,m.iron,x,y,.81,28);
    block(board,.13,.02,.016,m.dark,x,y,.88,.007).rotation.z=.6;
  }
  label(board,'KEYNLOCK  /  001',0,-3.52,.83,2.38,'#d8c5a6');
  // Closed front plate sits in the original front bezel. In the exploded
  // cutaway it lifts away, keeping the continuous rounded frame visible.
  const coverRoot=new THREE.Group();board.add(coverRoot);
  const frontPlate=block(coverRoot,10.13,6.18,.08,m.case,0,0,.73,.15);
  frontPlate.name='classic-front-cover';frontPlate.castShadow=false;
  label(coverRoot,'KEYNLOCK  /  PRECISION LOCK WORKS',0,2.50,.79,3.44,'#ded8c8');

  // Cylindrical entry and vertical key slot on the actual left SIDE WALL.
  const keywayRoot=new THREE.Group();keywayRoot.name='keyway-left-wall';board.add(keywayRoot);
  const keyBore=put(keywayRoot,new THREE.CylinderGeometry(.44,.44,.70,40),m.inset,
    -5.48,0,.04);keyBore.rotation.z=Math.PI/2;
  const keyRim=ring(keywayRoot,.49,.055,m.brass,KEY_SIDE_X,0,.04);
  keyRim.rotation.y=Math.PI/2;
  const keyhole=block(keywayRoot,.045,.47,.10,m.inset,KEY_SIDE_X-.045,0,.04,.025);
  block(keywayRoot,.035,.11,.19,m.inset,KEY_SIDE_X-.055,-.27,.04,.02);
  // A narrow, metal-lined channel extends from the mouth to the shaft's
  // three bend-contact stations. Each saved keyway profile has a truly
  // different contour, matching the corresponding real wrench curve.
  const guideProfiles=STANDARD_TENSION_TOOLS.map((_tool,index)=>{
    const channel=new THREE.Group();channel.name='keyway-tension-guide-'+index;
    keywayRoot.add(channel);
    const worldX=x=>KEY_SIDE_X+.14+.65*x;
    const worldY=x=>-.20+.65*tensionProfileHeight(index,x);
    for(const side of [-1,1]){
      const offset=side*.050,points=[];
      for(let j=0;j<=32;j++){
        const x=-2.45+j/32*1.93;
        points.push(new THREE.Vector3(worldX(x),worldY(x)+offset,.065));
      }
      const rail=put(channel,new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(points),72,.012,7,false),m.brass);
      rail.name='bent-keyway-guide-rail';
      // The outer profile is fixed to the metal rim, not floating in space.
      rod(channel,points.at(-1),new THREE.Vector3(KEY_SIDE_X-.02,-.20+offset,.065),.017,m.brass);
    }
    for(const x of TENSION_GUIDE_STATIONS){
      const y=worldY(x);
      for(const side of [-1,1]){
        const tooth=block(channel,.050,.028,.07,m.bronze,worldX(x),y+side*.05,.065,.007);
        tooth.name='keyway-profile-contact';
      }
    }
    channel.visible=index===2;
    return channel;
  });
  label(board,'ВХОД КЛЮЧА  ←',-4.26,-1.05,.69,1.85,'#e6c58d');
  // The tools are the pin laboratory's physical hook and five tension-wrench
  // profiles, including its original red lacquer handle painting.
  let lacquer=m.bronze.clone();
  lacquer.color.setHex(0xa33e32);
  lacquer.metalness=0;lacquer.roughness=.5;
  if(!options.rendererFactory){
    let ready;
    paintedLoads.push(new Promise(resolve=>{ready=resolve;}));
    const painting=new THREE.TextureLoader().load(
      './assets/handles/japanese/geisha-red-fan.webp',ready,undefined,ready);
    painting.colorSpace=THREE.SRGBColorSpace;
    painting.wrapS=THREE.RepeatWrapping;
    painting.anisotropy=8;
    lacquer.color.setHex(0xffffff);
    lacquer.map=painting;lacquer.needsUpdate=true;paintedTextures.push(painting);
  }
  const pickingTools=createStandardPickingTools({THREE,board,
    finishes:{chrome:m.pale,steel:m.iron,brass:m.brass,lacquer},
    keySideX:KEY_SIDE_X});

  // Shackle/collar positions match the side-entry pin lock's silhouette.
  const shackleRoot=new THREE.Group();shackleRoot.name='shackle-right';board.add(shackleRoot);
  put(shackleRoot,shackleGeometry(),m.iron);
  for(const y of [-.92,.92]){
    const end=put(shackleRoot,new THREE.CylinderGeometry(.19,.19,.06,24),m.iron,4.98,y,-.02);
    end.rotation.z=Math.PI/2;
    const socket=put(board,new THREE.CylinderGeometry(.32,.32,.23,28),m.dark,5.62,y,-.02);
    socket.rotation.z=Math.PI/2;
    const collar=put(board,new THREE.TorusGeometry(.32,.042,8,32),m.brass,5.74,y,-.02);
    collar.rotation.y=Math.PI/2;
  }
  const boltGuide=new THREE.Group();boltGuide.name='bolt-to-shackle';board.add(boltGuide);
  block(boltGuide,3.65,.46,.28,m.dark,3.62,0,-.09,.055);
  block(boltGuide,3.50,.19,.16,m.iron,3.62,0,.10,.022);

  const partsRoot=new THREE.Group();board.add(partsRoot);
  const linksRoot=new THREE.Group();board.add(linksRoot);
  const accessRoot=new THREE.Group();board.add(accessRoot);
  const pickTargets=[],accessTargets=[];
  const models=new Map(),couplings=[];
  let linksSignature='',attackSignature='',cutaway=true,active=false;
  let lastFps=0,frames=0;

  const addPivot=(root,x=0,y=0,z=.29)=>{
    disc(root,.11,.14,m.dark,x,y,z,20);
    disc(root,.058,.17,m.pale,x,y,z+.08,20);
  };
  function makeModel(part){
    const group=new THREE.Group(),mount=new THREE.Group(),dynamic=new THREE.Group(),portsRoot=new THREE.Group();
    group.name=`mechanical-part-${part.type}`;
    partsRoot.add(group);group.add(mount,dynamic,portsRoot);
    const pinStacks=[];
    const def=PARTS[part.type];
    const localPorts=portsFor({...part,x:0,y:0,rot:0});
    if(part.type!=='shield'){
      for(const port of [...localPorts.inputs,...localPorts.outputs]){
        const end=new THREE.Vector3(port.x*SCALE,-port.y*SCALE,.16);
        rod(mount,new THREE.Vector3(0,0,.16),end,.046,m.steel);
        // Machined joint ends remain visible beneath the moving part.
        disc(mount,.085,.09,m.bronze,end.x,end.y,.18,18);
        const tip=disc(portsRoot,.063,.07,
          port.name.startsWith('out')?m.brass:m.green,end.x,end.y,.49,16);
        tip.userData.portName=port.name;
        ring(portsRoot,.086,.012,m.pale,end.x,end.y,.53);
      }
    }
    if(!def.fixed&&part.type!=='shield'){
      block(mount,.71,.54,.12,m.steel,0,0,-.18,.065);
      block(mount,.59,.42,.038,m.inset,0,0,-.1,.035);
      for(const x of [-.25,.25])for(const y of [-.18,.18]){
        disc(mount,.035,.08,m.bronze,x,y,.0,12);
      }
    }
    let mover=dynamic;
    switch(part.type){
      case 'key':{
        // A horizontal bored plug terminates at the left-hand key entry.
        const outerFinish=m.dark.clone();outerFinish.transparent=true;
        outerFinish.opacity=.31;outerFinish.depthWrite=false;
        const plugFinish=m.brass.clone();plugFinish.transparent=true;
        plugFinish.opacity=.38;plugFinish.depthWrite=false;
        const seat=put(mount,new THREE.CylinderGeometry(.39,.39,4.75,36),outerFinish,.69,0,.08);
        seat.rotation.z=Math.PI/2;
        const plug=put(dynamic,new THREE.CylinderGeometry(.29,.29,4.62,36),plugFinish,.65,0,.08);
        plug.rotation.z=Math.PI/2;
        const face=put(dynamic,new THREE.CylinderGeometry(.32,.32,.07,36),m.iron,-1.65,0,.08);
        face.rotation.z=Math.PI/2;
        block(dynamic,.06,.40,.085,m.inset,-1.70,0,.08,.022);
        break;
      }
      case 'pinbank':{
        // Five separate two-part pin stacks above a shared rotating barrel.
        block(mount,2.60,.22,.28,m.steel,0,.99,.16,.055);
        block(mount,2.58,.045,.055,m.glow,0,.10,.16,.012); // shear line
        block(mount,2.57,.12,.20,m.dark,0,-.47,.14,.04);
        const cutting=[.02,.095,.045,.135,.072];
        const coil=verticalCoilGeometry();
        for(let i=0;i<5;i++){
          const x=(i-2)*.47,cut=cutting[i];
          const stack=new THREE.Group();stack.position.x=x;dynamic.add(stack);
          const lower=put(stack,new THREE.CylinderGeometry(.092,.092,.33,20),m.brass,0,-.14-cut,.31);
          const upper=put(stack,new THREE.CylinderGeometry(.093,.093,.30,20),m.iron,0,.175-cut,.31);
          lower.name=`coded-pin-${i+1}`;upper.name=`driver-pin-${i+1}`;
          const spring=put(stack,coil,m.pale,0,.47-cut,.31);
          spring.name=`pin-spring-${i+1}`;
          pinStacks.push({stack,spring,cut});
        }
        break;
      }
      case 'bolt':{
        block(mount,1.10,.67,.20,m.iron,0,0,.08,.055);
        block(mount,.94,.35,.10,m.inset,0,0,.23,.028);
        block(dynamic,.96,.40,.28,m.iron,0,0,.35,.05);
        block(dynamic,.81,.14,.06,m.bronze,.16,0,.51,.018);
        block(dynamic,.61,.18,.22,m.brass,.65,0,.36,.03);
        // The end of the bar always reaches the SAME right-hand shackle socket,
        // even when a longer demonstration moves the body of the bolt inward.
        const endX=Math.max(.90,5.18-toWorld(part.x,part.y).x),shaftStart=.25;
        block(dynamic,endX-shaftStart,.24,.22,m.iron,(endX+shaftStart)/2,0,.35,.035);
        block(dynamic,.24,2.02,.40,m.iron,endX,0,.16,.035);
        for(const y of [-.92,.92])
          block(dynamic,.36,.23,.40,m.brass,endX,y,.16,.03);
        for(const y of [-.29,.29])disc(mount,.06,.19,m.brass,-.38,y,.3,14);
        break;
      }
      case 'shield':{
        block(mount,Math.max(.55,part.setting*SCALE*1.38),.92,.15,m.steel,0,0,.57,.065);
        block(mount,Math.max(.46,part.setting*SCALE*1.26),.81,.027,m.bronze,0,0,.67,.04);
        for(const x of [-.27,.27])for(const y of [-.30,.30])disc(mount,.038,.06,m.pale,x,y,.7,12);
        break;
      }
      case 'gear':{
        put(dynamic,gearGeometry(Math.round(12+part.setting*3),
          .295+(part.setting-1)*.038),m.brass,0,0,.30);
        ring(dynamic,.20,.024,m.dark,0,0,.40);
        addPivot(dynamic,0,0,.33);break;
      }
      case 'lever':{
        block(dynamic,1.02,.16,.13,m.bronze,0,0,.27,.035);
        for(const x of [-.42,.42])disc(dynamic,.067,.09,m.iron,x,0,.37,18);
        addPivot(dynamic,0,0,.39);break;
      }
      case 'pin':{
        block(mount,.92,.28,.17,m.dark,0,0,.23,.025);
        block(dynamic,.75,.17,.16,m.iron,0,0,.34,.026);
        block(dynamic,.11,.25,.16,m.brass,.17,0,.36,.014);
        disc(dynamic,.07,.20,m.pale,-.27,0,.38,12);break;
      }
      case 'spring':{
        for(const x of [-.42,.42])block(mount,.10,.47,.20,m.iron,x,0,.19,.023);
        put(dynamic,coilGeometry(),m.pale,0,0,.28);
        break;
      }
      case 'ratchet':{
        put(dynamic,gearGeometry(10,.30),m.bronze,0,0,.30);
        addPivot(dynamic,0,0,.34);
        rod(mount,new THREE.Vector3(.34,.32,.41),new THREE.Vector3(.16,.18,.41),.055,m.pale);
        disc(mount,.065,.09,m.dark,.35,.32,.44,14);break;
      }
      case 'cam':{
        put(dynamic,camGeometry(),m.brass,0,0,.31);
        addPivot(dynamic,0,0,.39);break;
      }
      case 'latch':{
        rod(dynamic,new THREE.Vector3(-.42,.07,.33),new THREE.Vector3(.06,.07,.33),.071,m.brass);
        rod(dynamic,new THREE.Vector3(.06,.07,.33),new THREE.Vector3(.22,-.17,.33),.066,m.brass);
        block(dynamic,.34,.13,.18,m.iron,.36,-.17,.35,.02);
        addPivot(mount,-.4,.07,.33);break;
      }
      case 'splitter':{
        rod(dynamic,new THREE.Vector3(-.43,0,.27),new THREE.Vector3(0,0,.27),.062,m.bronze);
        for(const y of [-.72,.72])rod(dynamic,new THREE.Vector3(0,0,.27),
          new THREE.Vector3(.49,y,.27),.055,m.brass);
        addPivot(dynamic,0,0,.32);break;
      }
      case 'interlock':{
        for(const y of [-.72,.72])rod(mount,new THREE.Vector3(-.53,y,.22),
          new THREE.Vector3(-.16,0,.22),.051,m.iron);
        block(dynamic,.52,.38,.17,m.bronze,0,0,.35,.028);
        rod(dynamic,new THREE.Vector3(.14,0,.39),new THREE.Vector3(.55,0,.39),.057,m.brass);
        for(const y of [-.11,.11])disc(dynamic,.035,.07,m.pale,-.10,y,.47,12);
        break;
      }
    }
    const radius=def.fixed?.61:part.type==='shield'?.68:Math.max(.44,def.span*SCALE*.94);
    // Pick mesh has no visible surface, but exists in the 3D raycaster.
    const picker=put(group,new THREE.BoxGeometry(radius*1.9,radius*1.55,.16),
      new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false}),0,0,.72);
    picker.userData.partId=part.id;picker.castShadow=false;picker.receiveShadow=false;
    pickTargets.push(picker);
    // Real metal surfaces illuminate only when the force reaches this part.
    // No selection rings are added to the mechanism.
    const motionMaterials=[];
    dynamic.traverse(child=>{
      if(!child.isMesh||!child.material?.isMeshStandardMaterial)return;
      const finish=child.material.clone();finish.emissive.setHex(0xd39b55);
      finish.emissiveIntensity=0;child.material=finish;motionMaterials.push(finish);
    });
    return {group,mount,dynamic,portsRoot,picker,pinStacks,motionMaterials,
      type:part.type,setting:part.setting,positionX:part.x};
  }
  function captureThumbnails(types){
    // Render the exact installed part meshes once, using the scene's WebGL
    // context and metal textures. This avoids a second context per thumbnail.
    if(!renderer.setRenderTarget||!renderer.readRenderTargetPixels)return {};
    const width=128,preview=new THREE.Scene();
    preview.add(new THREE.HemisphereLight(0xf3e6d2,0x36434a,2.7));
    const lamp=new THREE.DirectionalLight(0xffdaaa,3.4);
    lamp.position.set(-2,4,7);preview.add(lamp);
    const fill=new THREE.DirectionalLight(0xa6d6e0,1.5);
    fill.position.set(3,-1,4);preview.add(fill);
    const lens=new THREE.PerspectiveCamera(34,1,.02,40);
    const target=new THREE.WebGLRenderTarget(width,width,{depthBuffer:true,
      format:THREE.RGBAFormat,colorSpace:THREE.SRGBColorSpace});
    const previous=renderer.getRenderTarget();
    const clear=renderer.getClearColor(new THREE.Color()).clone();
    const alpha=renderer.getClearAlpha();
    const pixels=new Uint8Array(width*width*4);
    const surface=document.createElement('canvas');surface.width=surface.height=width;
    const ctx=surface.getContext('2d');
    const out={};
    try{
      renderer.setRenderTarget(target);renderer.setClearColor(0x101a1c,0);
      for(const type of types){
        if(!PARTS[type])continue;
        const part=makePart(type,`thumbnail-${type}`,0,0);
        const model=makeModel(part);
        const pickerIndex=pickTargets.indexOf(model.picker);
        if(pickerIndex>=0)pickTargets.splice(pickerIndex,1);
        model.picker.visible=false;
        model.portsRoot.visible=false;
        preview.add(model.group);
        const box=new THREE.Box3().setFromObject(model.mount)
          .union(new THREE.Box3().setFromObject(model.dynamic));
        const center=box.getCenter(new THREE.Vector3());
        const bounds=box.getSize(new THREE.Vector3());
        const extent=Math.max(bounds.x,bounds.y,bounds.z*.9,.65);
        const distance=Math.max(2.0,extent*1.92);
        lens.position.copy(center).add(new THREE.Vector3(distance*.25,distance*.18,distance));
        lens.lookAt(center);lens.updateProjectionMatrix();
        renderer.clear();renderer.render(preview,lens);
        renderer.readRenderTargetPixels(target,0,0,width,width,pixels);
        const image=ctx.createImageData(width,width);
        for(let y=0;y<width;y++){
          const start=(width-1-y)*width*4;
          image.data.set(pixels.subarray(start,start+width*4),y*width*4);
        }
        ctx.putImageData(image,0,0);
        out[type]=surface.toDataURL('image/png');
        disposeObject(model.group);
      }
    }catch(error){console.warn('3D component thumbnails:',error);}
    finally{
      renderer.setRenderTarget(previous);renderer.setClearColor(clear,alpha);
      target.dispose();
    }
    return out;
  }
  function disposeObject(object){
    object.traverse(child=>{
      if(child.geometry&&!Array.from(segmentCache.values()).includes(child.geometry))child.geometry.dispose();
      if(child.userData.labelTexture)child.userData.labelTexture.dispose();
      if(child.material){
        const list=Array.isArray(child.material)?child.material:[child.material];
        for(const mat of list)if(!Object.values(m).includes(mat))mat.dispose();
      }
    });object.parent?.remove(object);
  }
  function syncModels(parts){
    const incoming=new Set(parts.map(part=>part.id));
    for(const [id,model] of models){if(incoming.has(id))continue;
      const index=pickTargets.indexOf(model.picker);
      if(index>=0)pickTargets.splice(index,1);
      disposeObject(model.group);models.delete(id);
    }
    for(const part of parts){
      let model=models.get(part.id);
      const shapeChanged=model&&(
        ['shield','gear'].includes(part.type)&&model.setting!==part.setting||
        part.type==='bolt'&&model.positionX!==part.x);
      if(model&&(model.type!==part.type||shapeChanged)){
        const index=pickTargets.indexOf(model.picker);
        if(index>=0)pickTargets.splice(index,1);
        disposeObject(model.group);models.delete(part.id);model=null;
      }
      if(!model){model=makeModel(part);models.set(part.id,model);}
      const location=toWorld(part.x,part.y);
      model.group.position.set(location.x,location.y,0);
      model.group.rotation.z=-(part.rot||0)*Math.PI/2;
    }
  }
  function syncLinks(links,parts){
    const byId=new Map(parts.map(part=>[part.id,part]));
    const signature=links.map(link=>`${link.from}/${link.to}/${link.fromPort}/${link.x}/${link.y}`).join('|');
    if(signature===linksSignature)return;
    for(const child of [...linksRoot.children])disposeObject(child);
    linksSignature=signature;couplings.length=0;
    for(const link of links){
      const output=portsFor(byId.get(link.from)).outputs.find(port=>port.name===link.fromPort);
      if(!output)continue;
      const joint=new THREE.Group();joint.name='transmission-coupling';linksRoot.add(joint);
      const center=toWorld(link.x,link.y,.16);
      const axis=new THREE.Vector3(output.nx,-output.ny,0).normalize();
      // The two shafts meet inside a narrow sliding metal sleeve; continuous
      // geometry replaces the former floating glowing connection circles.
      const finish=m.iron.clone();finish.emissive.setHex(0xb78148);finish.emissiveIntensity=0;
      const shaft=rod(joint,center.clone().addScaledVector(axis,-.19),
        center.clone().addScaledVector(axis,.19),.074,finish);
      shaft.name='coupled-steel-shaft';
      const grip=m.bronze.clone();grip.emissive.setHex(0xe6a357);grip.emissiveIntensity=0;
      const collar=rod(joint,center.clone().addScaledVector(axis,-.06),
        center.clone().addScaledVector(axis,.06),.085,grip);
      collar.name='coupled-metal-collar';
      couplings.push({link,finish,grip});
    }
  }
  function syncAccess(parts,selected){
    const signature=parts.map(part=>`${part.id}/${part.x}/${part.y}/${part.type}/${part.setting}`)
      .join('|')+parts.filter(p=>p.type==='shield').map(p=>p.setting).join('|');
    if(signature!==attackSignature){
      for(const child of [...accessRoot.children])disposeObject(child);
      accessTargets.length=0;attackSignature=signature;
      const reachableParts=parts.filter(part=>PARTS[part.type].pickable&&canPick(part,parts));
      for(const [i,part] of reachableParts.entries()){
        // A pick can enter through the side keyway; the front cover is solid.
        // The invisible hit area stays usable without permanent metallic rings.
        const marker=new THREE.Group();marker.name='keyway-pick-target';
        marker.position.set(KEY_SIDE_X-.13,(i-(reachableParts.length-1)/2)*.16,.04);
        marker.rotation.y=Math.PI/2;accessRoot.add(marker);
        const hit=put(marker,new THREE.SphereGeometry(.31,12,8),
          new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false}),0,0,0);
        hit.userData.partId=part.id;hit.castShadow=false;accessTargets.push(hit);
      }
    }
    for(const marker of accessRoot.children){
      const id=marker.children.find(child=>child.userData.partId)?.userData.partId;
      marker.scale.setScalar(id===selected?1.23:1);
    }
  }
  function resetCamera(){camera.position.set(-8.0,2.1,20.5);controls.target.set(.55,0,0);
    controls.update();}
  function resize(){const bounds=canvas.getBoundingClientRect();
    const w=Math.max(1,Math.round(bounds.width)),h=Math.max(1,Math.round(bounds.height));
    renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
  resetCamera();
  const resizeObserver=new ResizeObserver(()=>{if(active)resize();});
  resizeObserver.observe(canvas.parentElement);
  canvas.addEventListener('contextmenu',event=>event.preventDefault());
  scene.add(new THREE.HemisphereLight(0xc6e4dd,0x2c2824,2.3));
  const keyLight=new THREE.DirectionalLight(0xffd5a1,3.4);keyLight.position.set(-4,6,10);
  keyLight.castShadow=true;keyLight.shadow.mapSize.set(1024,1024);
  Object.assign(keyLight.shadow.camera,{left:-9,right:9,top:7,bottom:-7,near:1,far:30});
  scene.add(keyLight);
  const rim=new THREE.PointLight(0x719d9e,65,20);rim.position.set(4,-2,5);scene.add(rim);
  const spot=new THREE.PointLight(0xe5b476,22,15);spot.position.set(-2,2,3);scene.add(spot);

  function ray(event){const box=canvas.getBoundingClientRect();
    pointer.set(((event.clientX-box.left)/box.width)*2-1,
      -((event.clientY-box.top)/box.height)*2+1);
    raycaster.setFromCamera(pointer,camera);return raycaster;}
  function eventToBoard(event){const cast=ray(event);
    if(!cast.ray.intersectPlane(plane,tmp))return null;
    return fromWorld(tmp);
  }
  function hitPart(event,mode){if(mode!=='attack'&&!cutaway)return null;
    const cast=ray(event),objects=mode==='attack'?accessTargets:pickTargets;
    const hit=cast.intersectObjects(objects,false)[0];return hit?.object.userData.partId||null;}
  function render(state,now){
    if(!active)return;
    const {parts,view,mode,selected,showContacts,pickId,pickUntil,tension}=state;
    syncModels(parts);syncLinks(view?.links||[],parts);
    syncAccess(parts,selected);
    const seeInside=mode!=='attack'&&cutaway;
    coverRoot.visible=!seeInside;
    partsRoot.visible=seeInside;
    linksRoot.visible=seeInside;
    accessRoot.visible=mode==='attack';
    const profile=keywayWrenchProfile(parts);
    guideProfiles.forEach((channel,index)=>{channel.visible=index===profile;});
    pickingTools.update({mode,tension,wrenchIndex:state.wrenchIndex,
      wrenchAttemptUntil:state.wrenchAttemptUntil,
      activePin:state.activePin,pickId,pickUntil},now);
    shackleRoot.position.x=THREE.MathUtils.lerp(shackleRoot.position.x,
      state.unlocked ? .79 : 0,.14);
    for(const part of parts){
      const model=models.get(part.id);if(!model)continue;
      const value=view?.values[part.id]||0;
      const input=view?.inputs[part.id]||0;
      model.portsRoot.visible=showContacts||Boolean(state.dragging);
      const isMoving=state.motionActive?.includes(part.id);
      const lighting=isMoving?.55:part.id===selected?.18:0;
      for(const finish of model.motionMaterials)finish.emissiveIntensity=THREE.MathUtils.lerp(
        finish.emissiveIntensity,lighting,.18);
      model.dynamic.rotation.z=0;model.dynamic.position.set(0,0,0);
      model.dynamic.scale.set(1,1,1);
      switch(part.type){
        case 'key':model.dynamic.rotation.x=mode==='build'?value*.31:0;break;
        case 'gear':model.dynamic.rotation.z=-value*1.5;break;
        case 'lever':model.dynamic.rotation.z=value*.29;break;
        case 'pin':model.dynamic.position.x=value*.17;break;
        case 'pinbank':for(const [i,pin] of model.pinStacks.entries()){
          const lifted=view?.runtime.pinBanks?.[part.id]?.pins?.[i]?.lift||0;
          const ratio=Math.max(value,Math.min(1,lifted/PIN_CODES[i]));
          pin.stack.position.y=ratio*(.075+pin.cut);
          pin.spring.scale.y=1-ratio*.25;
        }break;
        case 'spring':model.dynamic.scale.x=1-Math.abs(value)*.27;break;
        case 'ratchet':model.dynamic.rotation.z=value*part.setting*.58;break;
        case 'cam':model.dynamic.rotation.z=input*.85;break;
        case 'latch':model.dynamic.position.y=value*.12;model.dynamic.rotation.z=-value*.2;break;
        case 'interlock':model.dynamic.position.x=value*.12;break;
        case 'bolt':model.dynamic.position.x=-(view?.boltTravel||0)*.72;break;
      }
    }
    for(const coupling of couplings){
      const value=view?.values[coupling.link.from]||0;
      coupling.finish.emissiveIntensity=THREE.MathUtils.lerp(
        coupling.finish.emissiveIntensity,Math.abs(value)*.22,.18);
      coupling.grip.emissiveIntensity=THREE.MathUtils.lerp(
        coupling.grip.emissiveIntensity,Math.abs(value)*.18,.18);
    }
    if(mode==='attack'&&view?.open){keyhole.material=m.green;}
    else keyhole.material=m.inset;
    controls.update();renderer.render(scene,camera);
    frames++;
    if(now-lastFps>650){
      const fps=lastFps?Math.round(frames*1000/(now-lastFps)):0;
      const stats=document.getElementById('mech3dStats');
      if(stats)stats.textContent=`${fps} FPS  ·  ${renderer.info.render.triangles.toLocaleString('ru-RU')} треугольников`;
      frames=0;lastFps=now;
    }
  }
  return {
    open(){active=true;resize();},close(){active=false;},resize,resetCamera,
    setCutaway(value){cutaway=Boolean(value);},getCutaway(){return cutaway;},
    eventToBoard,hitPart,render,captureThumbnails,
    whenTexturesReady(){return Promise.all(paintedLoads);},
    dispose(){active=false;resizeObserver.disconnect();controls.dispose();
      canvas.removeEventListener('pointerdown',shiftPan,{capture:true});
      for(const model of models.values())disposeObject(model.group);
      for(const child of [...linksRoot.children,...accessRoot.children])disposeObject(child);
      disposeObject(board);for(const g of segmentCache.values())g.dispose();segmentCache.clear();
      for(const value of Object.values(m))value.dispose();
      for(const map of paintedTextures)map.dispose();renderer.dispose();}
  };
}
