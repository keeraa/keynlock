import * as THREE from 'three';
import { OrbitControls } from '../vendor/OrbitControls.js';
import { createCartoonFilter } from './effects/cartoon-filter.js';
import { CityMaterials } from './materials.js';
import { createCity } from './city.js';
import {loadBuildingAtmosphereSettings,makePaintedGlassEnvironment} from './buildings/house-atmosphere.js';
import { createSky } from './sky.js';
import { DISTRICTS } from './world-data.js';
import { createDistrictLabels } from './district-labels.js';

const DEFAULTS=Object.freeze({
  toon:true,toonStrength:80,bands:4,outline:true,outlineStrength:70,outlineWidth:1,
  paint:true,paintStrength:95,paintMaterial:90,paintDetail:2,
  roof:'slate',wall:'warm',time:'day',water:true,
});
const SAVE_KEY='keynlock.world.visual.v1';
const qs=id=>document.getElementById(id);
let saved={};try{saved=JSON.parse(localStorage.getItem(SAVE_KEY)||'{}')||{};}catch{}
const state={...DEFAULTS,...Object.fromEntries(Object.entries(saved).filter(([key])=>key in DEFAULTS))};
const canvas=qs('world'),status=qs('status');
let renderer,scene,camera,controls,city,materials,filter,sun,fill,ambient,skyVisual,buildingGlassEnvironment;
let selectedDistrict=null,focusAnimation=null,cleanMode=false;
let districtLabels=null;
let previousMaterialSignature='';
let previousShadowTime=null;
let nextNightLightUpdate=0;
let lastRenderStats={calls:0,triangles:0,sceneTriangles:0,fps:0};
let frameWindowStart=0,frameCount=0,fps=0;
const pressedKeys=new Set();
const MOVE_KEYS=new Set(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight']);
const DEFAULT_TARGET=new THREE.Vector3(0,0,-12);
const defaultZoom=aspect=>Math.min(1.96,Math.max(.85,aspect*1.04));

function init() {
  renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.25;
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  // Town geometry and its shadow-casting lights are static between lighting changes.
  // Keep the 2048px shadow quality without re-rendering the entire shadow pass each frame.
  renderer.shadowMap.autoUpdate=false;
  renderer.shadowMap.needsUpdate=true;
  scene=new THREE.Scene();
  scene.background=new THREE.Color('#d9c9aa');
  scene.fog=new THREE.Fog('#d9c9aa',300,520);
  camera=new THREE.OrthographicCamera(-70,70,45,-45,.1,1200);
  camera.position.set(31,91,107);
  camera.lookAt(DEFAULT_TARGET);
  skyVisual=createSky(THREE,scene,camera);
  controls=new OrbitControls(camera,canvas);
  controls.target.copy(DEFAULT_TARGET);
  controls.enableDamping=true;
  controls.dampingFactor=.085;
  controls.enablePan=true;
  controls.panSpeed=.72;
  controls.enableRotate=true;
  controls.rotateSpeed=.45;
  controls.minPolarAngle=.45;
  controls.maxPolarAngle=1.23;
  controls.minAzimuthAngle=-.62;
  controls.maxAzimuthAngle=.62;
  controls.minZoom=.68;
  controls.maxZoom=3.1;
  controls.mouseButtons.LEFT=THREE.MOUSE.ROTATE;
  controls.mouseButtons.RIGHT=THREE.MOUSE.PAN;
  ambient=new THREE.HemisphereLight('#e4e7ce','#617b7b',2.5);
  scene.add(ambient);
  sun=new THREE.DirectionalLight('#ffe0a9',3.5);
  sun.position.set(-37,92,46);sun.castShadow=true;
  sun.shadow.mapSize.set(2048,2048);
  Object.assign(sun.shadow.camera,{left:-80,right:80,top:80,bottom:-80,near:1,far:320});
  sun.shadow.bias=-.00028;sun.shadow.normalBias=.025;scene.add(sun);
  fill=new THREE.DirectionalLight('#8db8c8',1.0);fill.position.set(55,26,-45);scene.add(fill);
  materials=new CityMaterials();
  city=createCity({THREE,scene,materials});
  buildingGlassEnvironment=makePaintedGlassEnvironment(THREE,renderer);
  city.setBuildingAtmosphereSettings(loadBuildingAtmosphereSettings(),buildingGlassEnvironment);
  const windowMat=materials.get('litWindow');windowMat.emissive.set('#e8b878');windowMat.emissiveIntensity=.48;
  filter=createCartoonFilter({THREE,renderer,scene,camera});
  updateVisuals();
  wireControls();
  resize();window.addEventListener('resize',resize,{passive:true});
  animate(0);
  setTimeout(()=>status.classList.add('ready'),450);
  window.__keynlockWorld={districts:DISTRICTS,locations:city.locations,focus:focusDistrict,reset:resetView,
    getVisual:()=>({...state}),getStats:()=>({...lastRenderStats,surfaceBatches:city.surfaceStats})};
  const requestedDistrict=new URLSearchParams(location.search).get('district');
  if(DISTRICTS.some(d=>d.id===requestedDistrict))focusDistrict(requestedDistrict);
}

function resize() {
  const width=Math.max(1,window.innerWidth),height=Math.max(1,window.innerHeight),aspect=width/height;
  const halfHeight=48;
  camera.left=-halfHeight*aspect;camera.right=halfHeight*aspect;
  camera.top=halfHeight;camera.bottom=-halfHeight;
  camera.zoom=focusAnimation?.endingZoom||defaultZoom(aspect);
  camera.updateProjectionMatrix();
  renderer.setSize(width,height,false);
  filter.resize(width,height,renderer.getPixelRatio());
}
function updateVisuals() {
  filter.setOptions({toon:state.toon,toonStrength:state.toonStrength/100,bands:state.bands,
    outline:state.outline,outlineStrength:state.outlineStrength/100,outlineWidth:state.outlineWidth});
  const materialSignature=[state.paint,state.paintStrength,state.paintMaterial,state.paintDetail,state.roof,state.wall].join('|');
  if(materialSignature!==previousMaterialSignature){
    materials.configure({paint:state.paint,paintStrength:state.paintStrength,
      paintMaterial:state.paintMaterial,paintDetail:state.paintDetail,roof:state.roof,wall:state.wall});
    previousMaterialSignature=materialSignature;
  }
  const sky={day:'#d9c9aa',dusk:'#c1a28e',night:'#233449'}[state.time];
  scene.background.set(sky);scene.fog.color.set(sky);
  skyVisual.setTime(state.time);
  const night=state.time==='night',dusk=state.time==='dusk';
  sun.intensity=night?.43:dusk?2.45:3.5;
  sun.color.set(night?'#90b0e7':dusk?'#e49c6e':'#ffe0a9');
  if(previousShadowTime!==state.time){
    renderer.shadowMap.needsUpdate=true;
    previousShadowTime=state.time;
  }
  ambient.color.set(night?'#7797c7':dusk?'#e4d5c7':'#e4e7ce');
  ambient.groundColor.set(night?'#263c58':dusk?'#716a69':'#617b7b');
  ambient.intensity=night?.8:dusk?2.05:2.5;
  fill.color.set(night?'#587db5':'#8db8c8');
  fill.intensity=night?.68:dusk?1.2:1;
  renderer.toneMappingExposure=night?.95:dusk?1.18:1.28;
  materials.get('litWindow').emissiveIntensity=night?4.0:dusk?2.2:.48;
  city.setNightLighting(state.time);
  city.updateNightLights(controls.target);
  city.setWaterLighting(state.time);
  document.querySelectorAll('.atmosphere-buttons button').forEach(el=>el.classList.toggle('active',el.dataset.time===state.time));
}
const ticker={then:0};
function animate(time) {
  requestAnimationFrame(animate);
  const t=time*.001,dt=Math.min(.05,t-ticker.then);ticker.then=t;
  if(focusAnimation) {
    const a=focusAnimation;
    const p=Math.min(1,(time-a.start)/a.duration),e=p<.5?4*p*p*p:1-Math.pow(-2*p+2,3)/2;
    const target=a.from.clone().lerp(a.to,e),delta=target.clone().sub(controls.target);
    controls.target.copy(target);camera.position.add(delta);
    camera.zoom=a.startZoom+(a.endingZoom-a.startZoom)*e;camera.updateProjectionMatrix();
    if(p>=1)focusAnimation=null;
  }
  moveKeyboard(dt);
  controls.update();
  districtLabels?.update();
  skyVisual.update();
  city.setWaterView(camera.position);
  if(state.water)city.setWaterTime(t);
  if(t>=nextNightLightUpdate){city.updateNightLights(controls.target);nextNightLightUpdate=t+.42;}
  city.update(t);
  const result=filter.render();
  frameCount++;
  if(time-frameWindowStart>=1000){
    fps=Math.round(frameCount*1000/(time-frameWindowStart));
    frameWindowStart=time;frameCount=0;
  }
  lastRenderStats={...result,fps};
}

function moveKeyboard(dt) {
  const horizontal=Number(pressedKeys.has('KeyD')||pressedKeys.has('ArrowRight'))-
    Number(pressedKeys.has('KeyA')||pressedKeys.has('ArrowLeft'));
  const vertical=Number(pressedKeys.has('KeyW')||pressedKeys.has('ArrowUp'))-
    Number(pressedKeys.has('KeyS')||pressedKeys.has('ArrowDown'));
  if(!horizontal&&!vertical)return;
  focusAnimation=null;
  camera.updateMatrixWorld();
  const right=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,0);
  const forward=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,1);
  right.y=0;forward.y=0;
  right.normalize();forward.normalize();
  const shift=pressedKeys.has('ShiftLeft')||pressedKeys.has('ShiftRight');
  const delta=right.multiplyScalar(horizontal).add(forward.multiplyScalar(vertical)).normalize()
    .multiplyScalar(dt*29/Math.max(.65,camera.zoom)*(shift?2.2:1));
  camera.position.add(delta);controls.target.add(delta);
}

function saveState() {try{localStorage.setItem(SAVE_KEY,JSON.stringify(state));}catch{}}
function updateSetting(key,value,visual=true) {
  state[key]=value;saveState();renderVisualUI();
  if(visual)updateVisuals();
}
let visualFrame=0;
function scheduleVisualUpdate() {
  if(visualFrame)cancelAnimationFrame(visualFrame);
  visualFrame=requestAnimationFrame(()=>{visualFrame=0;updateVisuals();});
}
function toggle(key) {updateSetting(key,!state[key]);}
function bindRange(id,key,formatter) {
  const input=qs(id);
  input.addEventListener('input',()=>{
    state[key]=Number(input.value);saveState();qs(id+'Value').textContent=formatter(state[key]);
    scheduleVisualUpdate();
  });
}
function renderVisualUI() {
  for(const [id,key] of [['toonToggle','toon'],['outlineToggle','outline'],['paintToggle','paint'],['waterToggle','water']]) {
    const button=qs(id);button.classList.toggle('on',state[key]);button.setAttribute('aria-pressed',String(state[key]));
  }
  const both=state.toon&&state.outline;
  qs('cartoonToggle').classList.toggle('on',both);
  qs('cartoonToggle').setAttribute('aria-pressed',String(both));
  for(const [id,key,format] of [
    ['toonStrength','toonStrength',v=>`${v}%`],['toonBands','bands',v=>`${v} ступ.`],
    ['outlineStrength','outlineStrength',v=>`${v}%`],['outlineWidth','outlineWidth',v=>`${v} px`],
    ['paintStrength','paintStrength',v=>`${v}%`],['paintMaterial','paintMaterial',v=>`${v}%`],
    ['paintDetail','paintDetail',v=>`${v}%`],
  ]) {
    qs(id).value=state[key];qs(id+'Value').textContent=format(state[key]);
  }
  for(const id of ['toonStrength','toonBands'])qs(id).disabled=!state.toon;
  for(const id of ['outlineStrength','outlineWidth'])qs(id).disabled=!state.outline;
  for(const id of ['paintStrength','paintMaterial','paintDetail'])qs(id).disabled=!state.paint;
  document.querySelectorAll('[data-roof]').forEach(el=>{
    const on=state.roof===el.dataset.roof;el.classList.toggle('active',on);el.setAttribute('aria-pressed',String(on));
  });
  document.querySelectorAll('[data-wall]').forEach(el=>{
    const on=state.wall===el.dataset.wall;el.classList.toggle('active',on);el.setAttribute('aria-pressed',String(on));
  });
}
function wireControls() {
  for(const [id,key] of [['toonToggle','toon'],['outlineToggle','outline'],['paintToggle','paint'],['waterToggle','water']])
    qs(id).addEventListener('click',()=>toggle(key));
  qs('cartoonToggle').addEventListener('click',()=>{
    const next=!(state.toon&&state.outline);state.toon=next;state.outline=next;saveState();renderVisualUI();updateVisuals();
  });
  for(const [id,key,format] of [
    ['toonStrength','toonStrength',v=>`${v}%`],['toonBands','bands',v=>`${v} ступ.`],
    ['outlineStrength','outlineStrength',v=>`${v}%`],['outlineWidth','outlineWidth',v=>`${v} px`],
    ['paintStrength','paintStrength',v=>`${v}%`],['paintMaterial','paintMaterial',v=>`${v}%`],
    ['paintDetail','paintDetail',v=>`${v}%`],
  ])bindRange(id,key,format);
  document.querySelectorAll('[data-roof]').forEach(el=>el.addEventListener('click',()=>updateSetting('roof',el.dataset.roof)));
  document.querySelectorAll('[data-wall]').forEach(el=>el.addEventListener('click',()=>updateSetting('wall',el.dataset.wall)));
  document.querySelectorAll('[data-time]').forEach(el=>el.addEventListener('click',()=>updateSetting('time',el.dataset.time)));
  qs('resetVisual').addEventListener('click',()=>{Object.assign(state,DEFAULTS);saveState();renderVisualUI();updateVisuals();});
  renderVisualUI();

  for(const [id,drawerId,otherId] of [['visualButton','visualDrawer','districtDrawer'],['districtsButton','districtDrawer','visualDrawer']]) {
    qs(id).addEventListener('click',()=>{
      const drawer=qs(drawerId),other=qs(otherId);
      const open=drawer.hidden;drawer.hidden=!open;other.hidden=true;
      qs(id).setAttribute('aria-expanded',String(open));
      qs(id==='visualButton'?'districtsButton':'visualButton').setAttribute('aria-expanded','false');
    });
  }
  document.querySelectorAll('[data-close]').forEach(button=>button.addEventListener('click',()=>closeDrawers()));
  qs('selectionClose').addEventListener('click',()=>qs('selection').hidden=true);
  qs('focusDistrict').addEventListener('click',()=>{if(selectedDistrict)focusDistrict(selectedDistrict.id);});
  qs('fullMap').addEventListener('click',resetView);
  qs('hideButton').addEventListener('click',()=>setCleanMode(true));
  qs('showInterface').addEventListener('click',()=>setCleanMode(false));
  document.addEventListener('keydown',event=>{
    const editing=/INPUT|TEXTAREA|SELECT/i.test(document.activeElement?.tagName||'')||document.activeElement?.isContentEditable;
    if(!editing && (MOVE_KEYS.has(event.code)||event.code==='ShiftLeft'||event.code==='ShiftRight')){
      pressedKeys.add(event.code);
      if(MOVE_KEYS.has(event.code))event.preventDefault();
    }
    if(event.code==='KeyH'&&!editing)setCleanMode(!cleanMode);
    if(event.code==='Escape'){closeDrawers();qs('selection').hidden=true;}
  });
  document.addEventListener('keyup',event=>pressedKeys.delete(event.code));
  window.addEventListener('blur',()=>pressedKeys.clear());
  qs('districtList').innerHTML=DISTRICTS.map(d=>`<button type="button" class="district-item" data-district="${d.id}"><span class="district-number">${d.index}</span><span class="district-color" style="background:${d.color}"></span><span><span class="district-name">${d.name}</span><span class="district-type">${d.kind}</span></span></button>`).join('');
  document.querySelectorAll('[data-district]').forEach(button=>button.addEventListener('click',()=>{
    focusDistrict(button.dataset.district);closeDrawers();
  }));
  districtLabels=createDistrictLabels({
    districts:DISTRICTS,city,camera,canvas,
    onFocus:focusDistrict,getSelectedId:()=>selectedDistrict?.id,
  });
  wirePicking();
}
function closeDrawers() {qs('visualDrawer').hidden=true;qs('districtDrawer').hidden=true;qs('visualButton').setAttribute('aria-expanded','false');qs('districtsButton').setAttribute('aria-expanded','false');}
function setCleanMode(clean) {
  cleanMode=clean;closeDrawers();
  document.querySelectorAll('.interface').forEach(el=>el.style.display=clean?'none':'');
  qs('showInterface').hidden=!clean;
}
function selectDistrict(id) {
  const district=DISTRICTS.find(d=>d.id===id);if(!district)return;
  selectedDistrict=district;qs('selection').hidden=false;
  qs('selectionIndex').textContent=`РАЙОН ${district.index} / 07`;
  qs('selectionName').textContent=district.name;
  qs('selectionText').textContent=district.description;
  window.dispatchEvent(new CustomEvent('keynlock-world-district-selected',{detail:{id:district.id}}));
}
function focusDistrict(id) {
  const district=DISTRICTS.find(d=>d.id===id);if(!district)return;
  selectDistrict(id);
  const zoom=Math.min(2.65,Math.max(1.7,camera.zoom*1.25));
  const anchor=district.anchor;
  focusAnimation={start:performance.now(),duration:800,from:controls.target.clone(),to:new THREE.Vector3(anchor[0],city.heightAt(anchor[0],anchor[2]),anchor[2]),startZoom:camera.zoom,endingZoom:zoom};
}
function resetView() {
  qs('selection').hidden=true;
  focusAnimation={start:performance.now(),duration:850,from:controls.target.clone(),to:DEFAULT_TARGET.clone(),startZoom:camera.zoom,endingZoom:defaultZoom(canvas.clientWidth/canvas.clientHeight)};
  closeDrawers();
}
function wirePicking() {
  const raycaster=new THREE.Raycaster();
  let down=null;
  canvas.addEventListener('pointerdown',event=>{down={x:event.clientX,y:event.clientY,t:performance.now()};});
  canvas.addEventListener('pointerup',event=>{
    if(!down||Math.hypot(event.clientX-down.x,event.clientY-down.y)>5||performance.now()-down.t>500)return;
    const rect=canvas.getBoundingClientRect();const mouse=new THREE.Vector2(((event.clientX-rect.left)/rect.width)*2-1,-((event.clientY-rect.top)/rect.height)*2+1);
    raycaster.setFromCamera(mouse,camera);
    const point=raycaster.intersectObject(city.terrain,false)[0]?.point;
    if(!point)return;
    if(point.x<-57||point.x>57||point.z<-71||point.z>city.coast(point.x)+1)return;
    selectDistrict(city.districtAt(point.x,point.z));
  });
}
try {init();}catch(error) {console.error(error);status.textContent='Не удалось запустить 3D-карту: '+error.message;}
