import * as THREE from '../vendor/three.js';
import {OrbitControls} from '../vendor/OrbitControls.js';
import {RoundedBoxGeometry} from '../vendor/RoundedBoxGeometry.js';
import {createGeometryPrimitives} from './primitives.js';
import {createWorkshopMaterials,populateWorkshopRoom} from './workshop-room.js';
import {disposeSceneResources} from './scene-disposal.js';

const FRONT=1.175;
const HINGE_Y=-.40;
const LID_OPEN_ANGLE=-1.94;

function dialLabel(){
  const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;
  const ctx=canvas.getContext('2d');
  const texture=new THREE.CanvasTexture(canvas);
  texture.colorSpace=THREE.SRGBColorSpace;
  return {ctx,texture};
}

function drawDial({ctx,texture},digit){
  ctx.clearRect(0,0,128,128);
  ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.shadowColor='rgba(0,0,0,.85)';ctx.shadowBlur=10;
  ctx.fillStyle='#f0d6a4';ctx.font='bold 100px Georgia, serif';
  ctx.fillText(String(digit),64,66);
  texture.needsUpdate=true;
}

function arrowShape(direction){
  const triangle=new THREE.Shape();
  triangle.moveTo(0,.041*direction);
  triangle.lineTo(-.043*direction,-.028*direction);
  triangle.lineTo(.043*direction,-.028*direction);
  triangle.closePath();
  return new THREE.ShapeGeometry(triangle);
}

export function createCodeBoxScene(canvas,{onWheel}={}){
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.7));
  renderer.setClearColor(0x101f25,1);
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.26;
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;

  const scene=new THREE.Scene();scene.fog=new THREE.FogExp2(0x14242b,.023);
  const camera=new THREE.PerspectiveCamera(37,1,.05,60);
  camera.position.set(2.35,1.70,6.6);
  const controls=new OrbitControls(camera,canvas);
  controls.target.set(-.50,-.72,0);
  controls.enableDamping=true;controls.dampingFactor=.075;
  controls.enablePan=false;controls.minDistance=4.0;controls.maxDistance=10;
  controls.minPolarAngle=.46;controls.maxPolarAngle=1.46;
  controls.update();

  const mat=createWorkshopMaterials(THREE);
  // Use the workshop's original gouache steel/gear maps on the casket itself.
  const paintedIron=new THREE.MeshStandardMaterial({color:0x8aa3a6,map:mat.dark2.map,
    roughness:.84,metalness:.47});
  const embossedSteel=new THREE.MeshStandardMaterial({color:0x9eb7bc,map:mat.steel.map,
    roughness:.79,metalness:.47});
  const gouacheBrass=new THREE.MeshStandardMaterial({color:0xe4c79e,map:mat.copper.map,
    roughness:.79,metalness:.42});
  const lining=new THREE.MeshStandardMaterial({color:0x21383b,roughness:.95});
  const enamel=new THREE.MeshStandardMaterial({color:0x1a252a,metalness:.4,roughness:.6});
  const pale=new THREE.MeshStandardMaterial({color:0xe3d4ad,roughness:.88,metalness:0});
  const digitMaterial=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,depthWrite:false});
  const addMesh=(parent,geometry,material,position=[0,0,0])=>{
    const mesh=new THREE.Mesh(geometry,material);
    mesh.position.set(...position);mesh.castShadow=!material.transparent;
    mesh.receiveShadow=!material.transparent;parent.add(mesh);return mesh;
  };
  const shapes=createGeometryPrimitives({THREE,RoundedBoxGeometry,addMesh,
    setDynamicBase:(g,x,y,z)=>g.position.set(x,y,z),springMaterial:mat.spring});
  populateWorkshopRoom(THREE,scene,shapes,mat);

  const boxRoot=new THREE.Group();boxRoot.position.x=-.65;scene.add(boxRoot);
  const w=3.72,d=2.35;
  // An actual open-topped container: four distinct walls and a velvet-lined floor.
  shapes.box(boxRoot,w,.23,d,0,-1.54,0,paintedIron,.065);
  shapes.box(boxRoot,w-.28,.023,d-.28,0,-1.410,0,lining,.012);
  shapes.box(boxRoot,w,1.04,.16,0,-.93,d/2-.08,paintedIron,.035);
  shapes.box(boxRoot,w,1.04,.16,0,-.93,-d/2+.08,paintedIron,.035);
  for(const x of [-w/2+.08,w/2-.08]){
    shapes.box(boxRoot,.16,1.04,d-.12,x,-.93,0,paintedIron,.035);
    for(const z of [-d/2+.10,d/2-.10])
      shapes.box(boxRoot,.055,1.09,.08,x,-.93,z,embossedSteel,.012);
  }
  // Painted metal maps continue across all bands, strips and circular trim.
  for(const y of [-1.44,-.43]){
    shapes.box(boxRoot,w+.055,.042,.065,0,y,d/2+.018,gouacheBrass,.012);
    shapes.box(boxRoot,w+.055,.042,.065,0,y,-d/2-.018,gouacheBrass,.012);
  }
  shapes.box(boxRoot,3.30,.96,.045,0,-.94,FRONT+.015,embossedSteel,.035);
  shapes.box(boxRoot,3.17,.85,.052,0,-.94,FRONT+.053,enamel,.035);
  for(const x of [-1.50,1.50])for(const y of [-1.32,-.56])
    shapes.cyl(boxRoot,.034,.018,x,y,FRONT+.091,gouacheBrass,'z',16);
  // Recessed sockets surround the smaller dials and their paired arrow buttons.
  const dialDisplays=[],hitTargets=[];
  const dialGeometry=new THREE.CylinderGeometry(.18,.18,.06,28,1);
  const labelGeometry=new THREE.PlaneGeometry(.215,.25);
  for(let i=0;i<6;i++){
    const x=(i-2.5)*.515;
    shapes.cyl(boxRoot,.204,.012,x,-.94,FRONT+.083,enamel,'z',30);
    shapes.ring(boxRoot,.203,.011,x,-.94,FRONT+.091,gouacheBrass,'z');
    const rotor=new THREE.Group();rotor.position.set(x,-.94,FRONT+.088);boxRoot.add(rotor);
    const disc=addMesh(rotor,dialGeometry,gouacheBrass);
    disc.rotation.x=Math.PI/2;
    shapes.ring(rotor,.176,.012,0,0,.039,embossedSteel,'z');
    shapes.cyl(rotor,.139,.018,0,0,.051,enamel,'z',24);
    for(let mark=0;mark<10;mark++){
      const angle=mark*Math.PI/5;
      const piece=shapes.box(rotor,.012,.026,.006,
        Math.sin(angle)*.157,Math.cos(angle)*.157,.050,embossedSteel,.002);
      piece.rotation.z=-angle;
    }
    const label=dialLabel();
    const material=digitMaterial.clone();material.map=label.texture;
    const face=addMesh(rotor,labelGeometry,material,[0,0,.065]);
    face.renderOrder=2;
    dialDisplays.push(label);
    const hit=addMesh(rotor,new THREE.CircleGeometry(.198,30),
      new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false}),[0,0,.083]);
    hit.userData.codeWheel=i;hit.userData.delta=1;hitTargets.push(hit);
    for(const direction of [1,-1]){
      const key=new THREE.Group();
      key.position.set(x,-.94+direction*.335,FRONT+.101);
      boxRoot.add(key);
      shapes.cyl(boxRoot,.108,.009,x,-.94+direction*.335,FRONT+.084,enamel,'z',24);
      shapes.ring(boxRoot,.107,.008,x,-.94+direction*.335,FRONT+.092,embossedSteel,'z');
      shapes.cyl(key,.095,.031,0,0,0,gouacheBrass,'z',24);
      shapes.ring(key,.084,.008,0,0,.018,embossedSteel,'z');
      shapes.cyl(key,.067,.010,0,0,.018,enamel,'z',24);
      addMesh(key,arrowShape(direction),mat.pin,[0,0,.027]);
      const keyHit=addMesh(key,new THREE.CircleGeometry(.108,24),
        new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false}),[0,0,.048]);
      keyHit.userData.codeWheel=i;keyHit.userData.delta=direction;
      hitTargets.push(keyHit);
    }
  }

  // A functional hinge; the entire lid rotates around its rear edge.
  for(const x of [-1.28,1.28]){
    shapes.cyl(boxRoot,.112,.30,x,HINGE_Y,-d/2-.04,gouacheBrass,'x',24);
    shapes.cyl(boxRoot,.056,.33,x,HINGE_Y,-d/2-.04,mat.dark,'x',16);
  }
  const lid=new THREE.Group();lid.position.set(0,HINGE_Y,-d/2);boxRoot.add(lid);
  shapes.box(lid,w+.09,.22,d+.10,0,.10,d/2,paintedIron,.082);
  shapes.box(lid,w-.24,.034,d-.25,0,.228,d/2,embossedSteel,.055);
  shapes.box(lid,w-.38,.043,d-.40,0,.252,d/2,paintedIron,.042);
  for(const z of [.23,d-.23])shapes.box(lid,w-.53,.028,.043,0,.290,z,gouacheBrass,.012);
  for(const x of [-w/2+.28,w/2-.28])shapes.box(lid,.043,.028,d-.5,x,.290,d/2,gouacheBrass,.012);
  for(const x of [-1.47,1.47])for(const z of [.28,d-.28])
    shapes.cyl(lid,.051,.022,x,.30,z,gouacheBrass,'y',18);
  shapes.ring(lid,.47,.025,0,.294,d/2,gouacheBrass,'y');
  shapes.ring(lid,.31,.011,0,.298,d/2,embossedSteel,'y');
  shapes.box(lid,.18,.018,.18,0,.308,d/2,gouacheBrass,.015).rotation.y=Math.PI/4;
  // The reward is deliberately just a clean, unmarked rectangular solid.
  const reward=shapes.box(boxRoot,1.36,.09,.80,0,-1.305,-.06,pale,.008);
  reward.castShadow=true;
  const highlight=new THREE.PointLight(0xffe0a5,10,3);highlight.position.set(0,-.75,0);
  boxRoot.add(highlight);highlight.visible=false;

  let targetAngle=0,active=false,frame=0,lastTime=0;
  function resize(){
    const width=Math.max(1,canvas.clientWidth),height=Math.max(1,canvas.clientHeight);
    camera.aspect=width/height;camera.updateProjectionMatrix();
    renderer.setSize(width,height,false);
  }
  const observer=new ResizeObserver(resize);
  observer.observe(canvas);
  resize();
  function tick(time){
    if(!active)return;
    const dt=Math.min(.05,(time-lastTime)/1000||.016);lastTime=time;
    if(Math.abs(lid.rotation.x-targetAngle)>.0005)
      lid.rotation.x+=(targetAngle-lid.rotation.x)*Math.min(1,dt*3.5);
    else lid.rotation.x=targetAngle;
    highlight.visible=targetAngle<-.5;
    controls.update();renderer.render(scene,camera);
    frame=requestAnimationFrame(tick);
  }
  const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
  let down=null;
  const listeners=new AbortController();
  canvas.addEventListener('pointerdown',event=>{down={x:event.clientX,y:event.clientY};},
    {signal:listeners.signal});
  canvas.addEventListener('pointerup',event=>{
    if(!down||Math.hypot(event.clientX-down.x,event.clientY-down.y)>6){down=null;return;}
    down=null;
    const bounds=canvas.getBoundingClientRect();
    pointer.set(((event.clientX-bounds.left)/bounds.width)*2-1,
      -((event.clientY-bounds.top)/bounds.height)*2+1);
    raycaster.setFromCamera(pointer,camera);
    const hit=raycaster.intersectObjects(hitTargets,false)[0];
    if(hit)onWheel?.(hit.object.userData.codeWheel,hit.object.userData.delta);
  },{signal:listeners.signal});
  canvas.addEventListener('pointercancel',()=>{down=null;},{signal:listeners.signal});

  return {
    open(){if(active)return;active=true;lastTime=0;resize();frame=requestAnimationFrame(tick);},
    close(){active=false;cancelAnimationFrame(frame);},
    setDigits(digits){digits.forEach((digit,index)=>drawDial(dialDisplays[index],digit));},
    setOpened(opened,{instant=false}={}){
      targetAngle=opened?LID_OPEN_ANGLE:0;
      if(instant)lid.rotation.x=targetAngle;
    },
    dispose(){
      active=false;cancelAnimationFrame(frame);listeners.abort();observer.disconnect();
      controls.dispose();disposeSceneResources(scene);renderer.dispose();
    }
  };
}
