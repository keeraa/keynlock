import * as THREE from 'three';
import { OrbitControls } from '../../vendor/OrbitControls.js';
import { createHouseModel } from '../buildings/house-model.js';
import {createHouseGlass} from '../buildings/house-materials.js';
import {createHouseAtmosphere,loadBuildingAtmosphereSettings,makePaintedGlassEnvironment} from '../buildings/house-atmosphere.js';
import {createBuildingSmokeBatch} from '../../modules/house-builder/core/building-smoke-batch.js';
import {buildStreetSmokeParticles} from './street-smoke.js';
import { batchHouseGeometry } from '../buildings/house-batch.js';
import { diffStreetPlans } from './street-diff.js';
import { buildQuarterPaving } from './quarter-paving.js';
import { HOUSE_LOD_BLEND,houseCameraDistance,houseLODWeights } from './street-house-lod.js';
import { HOUSE_LOD_FADE_MS,isolateHouseFade } from './street-lod-fade.js';

const geometryBox = (scene, size, position, material, cast = false) => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...position);
  mesh.castShadow = cast;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
};

function seeded(seed) {
  let value = seed >>> 0;
  return () => { value = (1664525 * value + 1013904223) >>> 0; return value / 4294967296; };
}

function stoneInstances(root, area, color, seed, type = 'paving') {
  const rand = seeded(seed);
  const tileX = type === 'cobble' ? .72 : 1.1;
  const tileZ = type === 'cobble' ? .46 : 1.18;
  const cols = Math.floor(area.w / tileX);
  const rows = Math.floor(area.l / tileZ);
  if (cols < 1 || rows < 1) return;
  const mat = new THREE.MeshStandardMaterial({color, roughness:1, metalness:0});
  const geo = new THREE.BoxGeometry(tileX * .92, type === 'cobble' ? .08 : .035, tileZ * .89);
  const instance = new THREE.InstancedMesh(geo, mat, cols * rows);
  const dummy = new THREE.Object3D();
  const base = new THREE.Color(color);
  let n = 0;
  for(let i = 0; i < rows; i++) for(let j = 0; j < cols; j++) {
    const stagger = type === 'cobble' && i % 2 ? tileX * .45 : 0;
    dummy.position.set(area.x - area.w/2 + (j+.5)*tileX + stagger - (type === 'cobble'?tileX*.2:0),
      area.y + (rand()-.5)*.017, area.z - area.l/2 + (i+.5)*tileZ);
    dummy.rotation.y=(rand()-.5)*(type==='cobble'?.08:.015);
    dummy.updateMatrix();
    instance.setMatrixAt(n,dummy.matrix);
    instance.setColorAt(n++,base.clone().multiplyScalar(.87+rand()*.25));
  }
  instance.receiveShadow = true;
  instance.frustumCulled = false;
  root.add(instance);
}

function buildRoad(root, plan) {
  const {road,sidewalks,profile} = plan;
  const l = road.length, r = road.width, s = sidewalks.width;
  const mat = (color, roughness=1) => new THREE.MeshStandardMaterial({color,roughness});
  const gravel = mat('#e3d8bc');
  const roadBase = mat(profile.surface === 'cobble' ? '#8b8070' : '#817e70');
  const paving = mat('#c1b59d');
  const kerb = mat('#e0d2b3');
  geometryBox(root,[200,.25,200],[0,-.23,0],gravel);
  geometryBox(root,[r,.08,l],[0,-.005,0],roadBase);
  stoneInstances(root,{w:r-.2,l:l-.1,x:0,y:.07,z:0},profile.surface==='cobble'?'#8e8777':'#9f9a8a',plan.seed+7,profile.surface==='cobble'?'cobble':'paving');
  for(const side of [-1,1]) {
    const x=side*(r/2+s/2);
    geometryBox(root,[s,.30,l],[x,.025,0],paving);
    stoneInstances(root,{w:s-.23,l:l-.1,x,y:.19,z:0},'#d0c3a9',plan.seed+side+19,'paving');
    geometryBox(root,[.22,.35,l],[side*(r/2+.05),.04,0],kerb);
    geometryBox(root,[.05,.02,l],[side*(r/2+.19),.23,0],mat('#fff0d1'));
    const gutter=mat('#777468');
    geometryBox(root,[.21,.045,l],[side*(r/2-.16),.044,0],gutter);
    // Iron storm drains are integrated into the gutter along both kerbs.
    const iron=mat('#474b49',.76);
    for(let z=-l/2+11;z<l/2-8;z+=21) {
      geometryBox(root,[.4,.045,.82],[side*(r/2-.23),.082,z],iron);
      for(let k=-1;k<=1;k++)geometryBox(root,[.035,.009,.62],[side*(r/2-.23)+k*.1,.109,z],mat('#79807a'));
    }
  }
  // Historic 17th–18th century setting: no asphalt, lane stripes or painted
  // zebra crossings. The paved surfaces and stone kerbs guide pedestrians.
}

function lantern(root, position, style, materialSet, glowPieces) {
  const {iron, trim, glass, bulb, cap} = materialSet;
  const [x,z,side]=position;
  const height=style==='gas'?5.35:style==='industrial'?5.7:6.05;
  const cylinder=(top,bottom,h,y,material,px=x,pz=z,edges=10)=>{
    const mesh=new THREE.Mesh(new THREE.CylinderGeometry(top,bottom,h,edges),material);
    mesh.position.set(px,y,pz);root.add(mesh);return mesh;
  };
  cylinder(.37,.52,.18,.23,iron);
  cylinder(.17,.26,.45,.56,trim);
  cylinder(.075,.14,height-.85,(height+.85)/2,iron);
  cylinder(.17,.09,.19,height-.04,trim);
  let lampX=x,lampY=height+.22;
  if(style==='industrial') {
    // A suspended wrought-iron oil lantern suits this alternate 17th–18th
    // century industrial quarter. Avoid the modern conical electric shade.
    const path=new THREE.CatmullRomCurve3([
      new THREE.Vector3(x,height-.4,z), new THREE.Vector3(x-side*.25,height+.05,z),
      new THREE.Vector3(x-side*.8,height+.45,z), new THREE.Vector3(x-side*1.25,height+.35,z),
    ]);
    root.add(new THREE.Mesh(new THREE.TubeGeometry(path,15,.068,7,false),iron));
    lampX=x-side*1.25;lampY=height+.06;
    cylinder(.05,.05,.18,lampY+.64,iron,lampX,z,8);
    const canopy=new THREE.Mesh(new THREE.ConeGeometry(.39,.34,6),cap);
    canopy.position.set(lampX,lampY+.49,z);root.add(canopy);
    cylinder(.3,.31,.075,lampY-.36,iron,lampX,z,6);
    cylinder(.235,.235,.65,lampY,glass,lampX,z,6);
    for(let corner=0;corner<6;corner++){
      const angle=corner*Math.PI/3;
      cylinder(.021,.021,.76,lampY+.015,iron,lampX+Math.cos(angle)*.23,z+Math.sin(angle)*.23,6);
    }
    const flame=new THREE.Mesh(new THREE.SphereGeometry(.115,9,7),bulb);
    flame.position.set(lampX,lampY-.16,z);root.add(flame);glowPieces.push(flame);
  } else {
    if(style==='ornate') {
      for(const d of [-1,1]) {
        const path=new THREE.CatmullRomCurve3([
          new THREE.Vector3(x,height-.38,z),new THREE.Vector3(x+d*.24,height-.16,z),
          new THREE.Vector3(x+d*.27,height+.11,z),new THREE.Vector3(x,height+.1,z),
        ]);
        root.add(new THREE.Mesh(new THREE.TubeGeometry(path,12,.038,6,false),trim));
      }
    }
    const px=lampX,py=height+.34;
    cylinder(.32,.19,.12,py-.3,trim,px,z,4);
    const glassBox=geometryBox(root,[.43,.56,.43],[px,py,z],glass);
    glassBox.rotation.y=Math.PI/4;
    geometryBox(root,[.36,.045,.36],[px,py+.3,z],cap);
    const tip=new THREE.Mesh(new THREE.ConeGeometry(.38,.3,4),cap);
    tip.position.set(px,py+.45,z);tip.rotation.y=Math.PI/4;root.add(tip);
    cylinder(.045,.045,.23,py+.68,trim,px,z,8);
    for(const dx of [-.26,.26])for(const dz of [-.26,.26]) {
      const beam=geometryBox(root,[.033,.6,.033],[px+dx*.69,py,z],iron);
      beam.rotation.y=Math.PI/4;
    }
    const sphere=new THREE.Mesh(new THREE.SphereGeometry(.13,10,8),bulb);
    sphere.position.set(px,py,z);root.add(sphere);glowPieces.push(sphere);
    lampY=py;
  }
  return {x:lampX,y:lampY,z};
}

export function createStreetScene(canvas,{onMetrics=()=>{},onPick=()=>{},visual=null}={}) {
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.55));
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  const scene=new THREE.Scene();scene.background=new THREE.Color('#e9e2cd');
  scene.fog=new THREE.Fog('#e9e2cd',105,250);
  const camera=new THREE.PerspectiveCamera(45,1,.2,390);
  camera.position.set(42,41,51);
  const houseGlass=createHouseGlass(THREE);
  const glassEnvironment=makePaintedGlassEnvironment(THREE,renderer);
  visual?.connect({THREE,renderer,scene,camera});
  const controls=new OrbitControls(camera,canvas);
  controls.enableDamping=true;controls.dampingFactor=.07;
  controls.minDistance=3;controls.maxDistance=260;
  controls.maxPolarAngle=Math.PI*.49;
  controls.target.set(0,3,0);
  const hemi=new THREE.HemisphereLight('#fff6de','#9c927c',2.25);scene.add(hemi);
  const sun=new THREE.DirectionalLight('#fff1d2',3.15);sun.position.set(-32,72,38);scene.add(sun);
  const fill=new THREE.DirectionalLight('#b8cddd',.62);fill.position.set(42,28,-30);scene.add(fill);
  const group=new THREE.Group();scene.add(group);
  const roadGroup=new THREE.Group(),houseGroup=new THREE.Group(),lampGroup=new THREE.Group(),selectionGroup=new THREE.Group();
  group.add(roadGroup,houseGroup,lampGroup,selectionGroup);
  const glowPieces=[];const pointLights=[];
  const raycaster=new THREE.Raycaster();const pointer=new THREE.Vector2();
  let models=[],selectedBox=null,selectedId=null,plan=null,night=false,disposed=false;
  let streetSmoke=null;
  const lastLODPosition=new THREE.Vector3(Infinity,Infinity,Infinity);
  let lastLODSelection=null,lodTargetsDirty=true;
  let atmosphereSettings=loadBuildingAtmosphereSettings();
  const lightMats={
    iron:new THREE.MeshStandardMaterial({color:'#363f3c',metalness:.4,roughness:.66}),
    trim:new THREE.MeshStandardMaterial({color:'#a38253',metalness:.5,roughness:.5}),
    glass:new THREE.MeshStandardMaterial({color:'#f5d69f',emissive:'#f8c36f',emissiveIntensity:.55,transparent:true,opacity:.93,roughness:.42}),
    bulb:new THREE.MeshStandardMaterial({color:'#ffe6b0',emissive:'#ffc26e',emissiveIntensity:.9}),
    cap:new THREE.MeshStandardMaterial({color:'#59615d',metalness:.4,roughness:.6}),
  };
  function clearSelection() {
    if(!selectedBox)return;
    selectionGroup.remove(selectedBox);
    selectedBox.geometry.dispose();selectedBox.material.dispose();selectedBox=null;
  }
  function clearStaticGroup(parent) {
    const geometries=new Set(),materials=new Set(),ownedTextures=new Set();
    parent.traverse(object=>{if(object.isMesh){geometries.add(object.geometry);if(Array.isArray(object.material))object.material.forEach(m=>materials.add(m));else materials.add(object.material);if(object.userData.ownedTexture)ownedTextures.add(object.userData.ownedTexture);}});
    geometries.forEach(geometry=>geometry.dispose());
    materials.forEach(material=>{if(!Object.values(lightMats).includes(material))material.dispose();});
    ownedTextures.forEach(texture=>texture.dispose());
    parent.clear();
  }
  function clearLamps(){
    glowPieces.length=0;
    for(const light of pointLights)scene.remove(light);
    pointLights.length=0;
    clearStaticGroup(lampGroup);
  }
  function removeHouseLayer(layer) {
    layer.fade.release();
    houseGroup.remove(layer.instance.group);
    layer.instance.dispose();
  }
  function removeHouse(model) {
    if(model.atmosphere){houseGroup.remove(model.atmosphere.group);model.atmosphere.dispose();model.atmosphere=null;}
    if(model.layers){
      for(const layer of model.layers.values())removeHouseLayer(layer);
      model.layers.clear();
    }else{
      houseGroup.remove(model.instance.group);
      model.instance.dispose();
    }
  }
  function clear() {
    clearSelection();selectedId=null;
    if(streetSmoke){houseGroup.remove(streetSmoke.points);streetSmoke.dispose();streetSmoke=null;}
    for(const model of models)removeHouse(model);
    models=[];
    clearStaticGroup(roadGroup);
    clearLamps();
  }
  function makeHouse(house,detail) {
    const instance=createHouseModel(THREE,house.config,{detail,glass:houseGlass});
    batchHouseGeometry(THREE,instance.group);
    instance.group.position.set(house.x,0,house.z);
    instance.group.rotation.y=house.rotation;
    houseGroup.add(instance.group);
    return {record:house,instance,detail};
  }
  function decorateHouse(model){
    const atmosphere=createHouseAtmosphere(THREE,model.record.config,{
      detail:model.detail,settings:atmosphereSettings,smokeParticles:false,
    });
    atmosphere.group.position.copy(model.instance.group.position);
    atmosphere.group.rotation.copy(model.instance.group.rotation);
    houseGroup.add(atmosphere.group);
    model.atmosphere=atmosphere;
    return model;
  }
  function makeQuarterHouse(house) {
    // Keep one opaque, texture-stable shell for the entire lifetime of a house.
    // Nearby LODs contribute only architectural details with alpha blending.
    const model=decorateHouse(makeHouse(house,'low'));
    const fade=isolateHouseFade(model.instance.group,1,10,{
      fixedMaterials:model.instance.group.userData.shellMaterials,
      showFixed:true,
    });
    model.layers=new Map([['low',{instance:model.instance,fade,opacity:1}]]);
    return model;
  }
  function addHouseLayer(model,detail) {
    const {instance}=makeHouse(model.record,detail);
    const fade=isolateHouseFade(instance.group,0,detail==='high'?12:11,{
      fixedMaterials:instance.group.userData.shellMaterials,
      showFixed:false,
    });
    model.layers.set(detail,{instance,fade,opacity:0});
  }
  function sendHouseMetrics() {
    let unbatched=0,batched=0;
    const lod={high:0,medium:0,low:0};
    for(const model of models){
      const instances=model.layers?[...model.layers.values()].map(layer=>layer.instance):[model.instance];
      for(const instance of instances){
        const stats=instance.group.userData.optimization;
        unbatched+=stats?.before||0;batched+=stats?.after||0;
      }
      lod[model.detail]++;
    }
    onMetrics({meshCount:batched,originalMeshCount:unbatched,lod});
  }
  function rebuildStreetSmoke(){
    if(streetSmoke){houseGroup.remove(streetSmoke.points);streetSmoke.dispose();streetSmoke=null;}
    const particles=buildStreetSmokeParticles(models.map(model=>model.record));
    if(!particles.length)return;
    streetSmoke=createBuildingSmokeBatch(THREE,particles,{
      settings:atmosphereSettings,pointScale:900,nearDistance:110,
      name:'street-batched-gouache-chimney-smoke',
    });
    houseGroup.add(streetSmoke.points);
  }
  // Prebuild each detail layer before its blend range. Limit expensive model
  // creation per tick; camera motion never forces an unfinished fade to end.
  function ensureHouseLayers(limit=3) {
    if(plan?.mode!=='quarter')return;
    const candidates=[];
    for(const model of models){
      const distance=houseCameraDistance(camera.position,model.record);
      const selected=model.record.id===selectedId;
      if((selected||distance<HOUSE_LOD_BLEND.preloadHigh)&&!model.layers.has('high')){
        candidates.push({model,detail:'high',distance,priority:selected?-1:0});
      }
      if(distance<HOUSE_LOD_BLEND.preloadMedium&&!model.layers.has('medium')){
        candidates.push({model,detail:'medium',distance,priority:1});
      }
    }
    candidates.sort((a,b)=>a.priority-b.priority||a.distance-b.distance);
    let changed=0;
    for(const {model,detail} of candidates.slice(0,limit)){
      addHouseLayer(model,detail);
      changed++;
    }
    if(changed)sendHouseMetrics();
  }
  let lastDetailTime=performance.now();
  function updateHouseLayers(now) {
    const dt=Math.max(0,Math.min(50,now-lastDetailTime));
    lastDetailTime=now;
    if(plan?.mode!=='quarter')return;
    const response=1-Math.exp(-dt/(HOUSE_LOD_FADE_MS*.48));
    const refreshTargets=lodTargetsDirty||lastLODPosition.distanceToSquared(camera.position)>1e-6||
      lastLODSelection!==selectedId;
    if(refreshTargets){
      lastLODPosition.copy(camera.position);
      lastLODSelection=selectedId;
      lodTargetsDirty=false;
    }
    let changed=false;
    for(const model of models){
      const distance=refreshTargets||model.lodDistance===undefined?
        houseCameraDistance(camera.position,model.record):model.lodDistance;
      const selected=model.record.id===selectedId;
      const desired=refreshTargets||!model.lodWeights?
        houseLODWeights(distance,selected):model.lodWeights;
      model.lodDistance=distance;
      model.lodWeights=desired;
      // Reassign a layer's weight to an already loaded lower level while the
      // requested detail is being built. No blank or suddenly appearing face.
      const high=model.layers.has('high')?desired.high:0;
      const medium=model.layers.has('medium')?desired.medium+(desired.high-high):0;
      const weights={low:1-high-medium,medium,high};
      for(const [detail,layer] of model.layers){
        layer.opacity+=(weights[detail]-layer.opacity)*response;
        if(Math.abs(layer.opacity-weights[detail])<.001)layer.opacity=weights[detail];
        layer.fade.setOpacity(layer.opacity);
        const canRelease=detail==='high'?distance>HOUSE_LOD_BLEND.releaseHigh&&!selected:
          detail==='medium'&&distance>HOUSE_LOD_BLEND.releaseMedium;
        if(canRelease&&layer.opacity<=.001){
          removeHouseLayer(layer);
          model.layers.delete(detail);
          changed=true;
        }
      }
      const visible=[...model.layers].sort((a,b)=>b[1].opacity-a[1].opacity)[0]?.[0]||'low';
      if(model.detail!==visible){model.detail=visible;changed=true;}
    }
    if(changed)sendHouseMetrics();
  }
  function setPlan(next) {
    const changes=diffStreetPlans(plan,next);
    const smokeChanged=!plan||plan.mode!==next.mode||
      ['removed','changed','added','moved'].some(key=>changes[key].length>0);
    if(changes.roadChanged){
      clearStaticGroup(roadGroup);
      if(next.mode==='quarter')buildQuarterPaving(THREE,roadGroup,next);
      else buildRoad(roadGroup,next);
    }
    const existing=new Map(models.map(model=>[model.record.id,model]));
    for(const id of [...changes.removed,...changes.changed]) {
      const model=existing.get(id);
      if(!model)continue;
      removeHouse(model);existing.delete(id);
    }
    const nextModels=[];
    for(const house of next.houses) {
      let model=existing.get(house.id);
      if(!model) {
        model=next.mode==='quarter'?makeQuarterHouse(house):decorateHouse(makeHouse(house,'high'));
      }
      model.record=house;
      for(const instance of model.layers?[...model.layers.values()].map(layer=>layer.instance):[model.instance]){
        instance.group.position.set(house.x,0,house.z);
        instance.group.rotation.y=house.rotation;
      }
      model.atmosphere?.group.position.set(house.x,0,house.z);
      if(model.atmosphere)model.atmosphere.group.rotation.y=house.rotation;
      nextModels.push(model);
    }
    models=nextModels;
    lodTargetsDirty=true;
    if(smokeChanged)rebuildStreetSmoke();
    if(changes.lampsChanged){
      clearLamps();
      for(const lamp of next.lamps) {
        const pos=lantern(lampGroup,[lamp.x,lamp.z,lamp.side],lamp.style,lightMats,glowPieces);
        // The nearest lanterns illuminate the street; the others use emissive glass.
        if(Math.abs(lamp.z)<15 && pointLights.length<4){
          const light=new THREE.PointLight('#ffc985',0,11,1.4);
          light.position.set(pos.x,pos.y,pos.z);scene.add(light);pointLights.push(light);
        }
      }
    }
    plan=next;
    scene.fog.near=next.mode==='quarter'?165:105;
    scene.fog.far=next.mode==='quarter'?355:250;
    if(selectedId){
      const selected=models.find(model=>model.record.id===selectedId);
      clearSelection();
      if(selected){selectedBox=new THREE.BoxHelper(selected.instance.group,'#e6be78');selectionGroup.add(selectedBox);}
      else selectedId=null;
    }
    setNight(night);
    onMetrics({houses:models.length,lamps:next.lamps.length});
    sendHouseMetrics();
    ensureHouseLayers(3);
  }
  function setNight(on) {
    night=Boolean(on);
    atmosphereSettings.night=night;
    for(const model of models)model.atmosphere?.setSettings(atmosphereSettings);
    streetSmoke?.setSettings(atmosphereSettings);
    houseGlass.setAppearance({gloss:atmosphereSettings.glassGloss,
      reflection:atmosphereSettings.glassReflection,night,glow:atmosphereSettings.windowGlow,
      envMap:glassEnvironment?.texture??null});
    scene.background.set(night?'#283a4a':'#e9e2cd');
    scene.fog.color.set(night?'#283a4a':'#e9e2cd');
    hemi.intensity=night?.64:2.25;
    sun.intensity=night?.23:3.15;
    fill.intensity=night?.32:.62;
    lightMats.glass.emissiveIntensity=night?3.6:.55;
    lightMats.bulb.emissiveIntensity=night?4:.9;
    for(const light of pointLights)light.intensity=night?9:0;
    if(visual)visual.setExposureScale(night?.96/1.31:1);
    else renderer.toneMappingExposure=night?.96:1.31;
  }
  function setAtmosphereSettings(settings={}){
    atmosphereSettings={...atmosphereSettings,...settings};
    setNight(atmosphereSettings.night);
  }
  function setView(view='three-quarter'){
    if(!plan)return;
    let pos,look;
    if(plan.mode==='quarter'){
      if(view==='aerial'){pos=[23,194,29];look=[1,1,0];}
      else if(view==='street'){pos=[-19,9,82];look=[0,4,-42];}
      else if(view==='walk'){pos=[-18,2.4,63];look=[0,2.8,-34];}
      else {pos=[125,113,137];look=[1,2,0];}
    }else{
      if(view==='aerial'){pos=[39,78,37];look=[0,1,0];}
      else if(view==='street'){pos=[plan.road.width/2+1.4,8,plan.road.length/2+10];look=[0,4,-14];}
      else if(view==='walk'){pos=[-.6,2.35,plan.road.length/2-10];look=[0,2.8,-11];}
      else {pos=[38,38,45];look=[0,3,0];}
    }
    camera.position.set(...pos);controls.target.set(...look);controls.update();
    ensureHouseLayers(3);
  }
  function onCanvasClick(event){
    if(!plan)return;
    const bounds=canvas.getBoundingClientRect();
    pointer.set((event.clientX-bounds.left)/bounds.width*2-1,-(event.clientY-bounds.top)/bounds.height*2+1);
    raycaster.setFromCamera(pointer,camera);
    const hits=raycaster.intersectObjects(models.map(m=>m.instance.group),true);
    if(!hits.length)return;
    let obj=hits[0].object;
    while(obj&&!models.some(m=>m.instance.group===obj))obj=obj.parent;
    const model=models.find(m=>m.instance.group===obj);
    if(model){
      clearSelection();selectedId=model.record.id;
      selectedBox=new THREE.BoxHelper(model.instance.group,'#e6be78');
      selectionGroup.add(selectedBox);
      onPick(model.record);
      ensureHouseLayers(3);
    }
  }
  canvas.addEventListener('click',onCanvasClick);
  const resize=()=>{const rect=canvas.getBoundingClientRect();if(!rect.width||!rect.height)return;renderer.setSize(rect.width,rect.height,false);camera.aspect=rect.width/rect.height;camera.updateProjectionMatrix();visual?.resize(rect.width,rect.height,renderer.getPixelRatio());};
  const observer=new ResizeObserver(resize);observer.observe(canvas);resize();
  let frames=0,last=performance.now(),animationId=0;
  let lastLODRefresh=0;
  function render(now){
    if(disposed)return;
    animationId=requestAnimationFrame(render);
    controls.update();
    if(now-lastLODRefresh>100){
      ensureHouseLayers(3);lastLODRefresh=now;
    }
    updateHouseLayers(now);
    for(const model of models){
      if(!model.atmosphere)continue;
      const distance=houseCameraDistance(camera.position,model.record);
      model.atmosphere.setNear(distance<110);
    }
    streetSmoke?.update(now*.001,camera.position);
    const frameStats=visual?visual.render():(renderer.render(scene,camera),{...renderer.info.render});
    if(++frames>25 && now-last>950){onMetrics({fps:Math.round(frames*1000/(now-last)),triangles:frameStats.sceneTriangles??frameStats.triangles,drawCalls:frameStats.calls});frames=0;last=now;}
  }
  animationId=requestAnimationFrame(render);
  function dispose(){disposed=true;cancelAnimationFrame(animationId);canvas.removeEventListener('click',onCanvasClick);observer.disconnect();controls.dispose();clear();houseGlass.dispose();glassEnvironment?.dispose();Object.values(lightMats).forEach(m=>m.dispose());visual?.dispose();renderer.dispose();}
  return {setPlan,setNight,setAtmosphereSettings,setView,dispose};
}
