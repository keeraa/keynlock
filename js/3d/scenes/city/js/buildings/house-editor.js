import { createHouseEditorUI, syncPolygonCount } from './editor/ui.js';
import { loadHouseEditorConfig, saveHouseEditorConfig, downloadHouseBlueprint } from './editor/persistence.js';
import { createHouseCameraController } from './editor/camera.js';
import * as THREE from 'three';
import { OrbitControls } from '../../vendor/OrbitControls.js';
import { createHouseModel } from './house-model.js';
import { batchHouseGeometry } from './house-batch.js';
import { createHouseFallback } from './house-fallback.js';
import { HOUSE_DEFAULTS, createHouseBlueprint, getHouseDimensions, normalizeHouseConfig } from './house-config.js';
import {createHouseGlass} from './house-materials.js';
import {createHouseAtmosphere,loadBuildingAtmosphereSettings,saveBuildingAtmosphereSettings,makePaintedGlassEnvironment} from './house-atmosphere.js';
import { mountEditorVisual } from '../effects/editor-visual.js';

const $ = id => document.getElementById(id);
const embeddedCity=new URLSearchParams(window.location.search).get('embedded')==='city';
if(embeddedCity)document.body.classList.add('embedded-city');
let config=loadHouseEditorConfig();
let atmosphereSettings=loadBuildingAtmosphereSettings();
let stageActive=true;

let renderer, scene, camera, controls, house, stage;
let atmosphere,houseGlass,glassEnvironment,lighting;
let fallback, fallbackModel;
const visual=mountEditorVisual({standalone:document.documentElement.hasAttribute('data-standalone-house')});
let pendingRender=false;
let pendingGeometryChange=false;
let batchTimer=null;

function syncAtmosphereControls(){
  document.querySelectorAll('[data-atmo]').forEach(input=>{
    const key=input.dataset.atmo;
    if(input.type==='checkbox')input.checked=Boolean(atmosphereSettings[key]);
    else input.value=atmosphereSettings[key];
    const output=document.querySelector(`[data-atmo-value="${key}"]`);
    if(output)output.textContent=atmosphereSettings[key]+(key==='mossHeight'?' см':'%');
  });
}
function applyAtmosphere(){
  const s=atmosphereSettings,night=Boolean(s.night);
  atmosphere?.setSettings(s);
  houseGlass?.setAppearance({gloss:s.glassGloss,reflection:s.glassReflection,
    night,glow:s.windowGlow,envMap:glassEnvironment?.texture??null});
  document.querySelector('.viewer').classList.toggle('is-night',night);
  if(!renderer||!lighting)return;
  scene.background.set(night?'#263a4b':'#e6d7be');
  scene.fog.color.set(night?'#263a4b':'#e6d7be');
  lighting.hemi.intensity=night?.73:2.5;
  lighting.sun.intensity=night?.51:3.5;
  lighting.fill.intensity=night?.27:.85;
  lighting.floor.material.color.set(night?'#586575':'#d9c9ad');
  lighting.platform.material.color.set(night?'#64717b':'#c4b89e');
  visual.setExposureScale(night?.93/1.28:1);
  renderer.shadowMap.needsUpdate=true;
}
function rebuildAtmosphere(){
  if(!scene||!house)return;
  const next=createHouseAtmosphere(THREE,config,{settings:atmosphereSettings,editorLight:true});
  scene.add(next.group);
  if(atmosphere){scene.remove(atmosphere.group);atmosphere.dispose();}
  atmosphere=next;
  applyAtmosphere();
}

function scheduleHouseBatch() {
  clearTimeout(batchTimer);
  // Merge after the current drag: batching a large house on every slider
  // frame would introduce worse latency than drawing its unmerged preview.
  batchTimer=setTimeout(()=>{
    batchTimer=null;
    if(house)batchHouseGeometry(THREE,house.group);
  },160);
}

const {buildPalettes,syncControls,syncSummary,rangeIds,toggleIds,colorGroups} = createHouseEditorUI({getConfig:()=>config,onChange:change});
const persist = () => saveHouseEditorConfig(config);
const cameraController = createHouseCameraController({
  THREE,getConfig:()=>config,getStage:()=>stage,getRenderer:()=>renderer,
  getCamera:()=>camera,getControls:()=>controls,getFallback:()=>fallback,
  onResize:(width,height)=>visual.resize(width,height,renderer.getPixelRatio()),
});
const {setView,fitView} = cameraController;

function change(property,value) {
  config=normalizeHouseConfig({...config,[property]:value});
  if(!['roofColor','plasterColor','woodColor'].includes(property))pendingGeometryChange=true;
  persist();
  syncControls();
  syncSummary();
  // Rebuild at most once per animation frame during continuous slider drags.
  if(!pendingRender) {
    pendingRender=true;
    requestAnimationFrame(()=>{
      pendingRender=false;
      if(house) {
        syncPolygonCount(house.update(config));
        if(pendingGeometryChange)rebuildAtmosphere();
        if(pendingGeometryChange)scheduleHouseBatch();
        fitView(false);
      }
      pendingGeometryChange=false;
      if(fallback) fallback.update(config);
      if(fallbackModel) syncPolygonCount(fallbackModel.update(config));
    });
  }
}

function initInputs() {
  buildPalettes();
  rangeIds.forEach(key=>{$(key).addEventListener('input',e=>change(key,Number(e.target.value)));});
  toggleIds.forEach(key=>{$(key).addEventListener('change',e=>change(key,e.target.checked));});
  colorGroups.forEach(({property})=>{$(property).addEventListener('input',e=>change(property,e.target.value));});
  document.querySelectorAll('[data-roof-type]').forEach(button=>{
    button.addEventListener('click',()=>change('roofType',button.dataset.roofType));
  });
  document.querySelectorAll('[data-floors]').forEach(button=>{
    button.addEventListener('click',()=>change('floors',Number(button.dataset.floors)));
  });
  document.querySelectorAll('[data-house-option]').forEach(button=>{
    button.addEventListener('click',()=>change(button.dataset.houseOption,button.dataset.value));
  });
  document.querySelectorAll('[data-view]').forEach(button=>{
    button.addEventListener('click',()=>setView(button.dataset.view));
  });
  $('houseForm').addEventListener('submit',e=>e.preventDefault());
  document.querySelectorAll('[data-atmo]').forEach(input=>input.addEventListener(
    input.type==='range'?'input':'change',()=>{
      atmosphereSettings[input.dataset.atmo]=input.type==='checkbox'?input.checked:Number(input.value);
      saveBuildingAtmosphereSettings(atmosphereSettings);
      syncAtmosphereControls();applyAtmosphere();
    }));
  $('resetHouse').addEventListener('click',()=>{
    config=normalizeHouseConfig(HOUSE_DEFAULTS);
    persist();syncControls();syncSummary();
    if(house) {syncPolygonCount(house.update(config));scheduleHouseBatch();rebuildAtmosphere();fitView(true);}
    if(fallback) fallback.update(config);
    if(fallbackModel) syncPolygonCount(fallbackModel.update(config));
    setView('three-quarter');
  });
  $('exportHouse').addEventListener('click',()=>{
    downloadHouseBlueprint(config);
  });
  $('copyHouse').addEventListener('click',async()=>{
    const button=$('copyHouse');
    const payload=JSON.stringify(createHouseBlueprint(config),null,2);
    try {
      await navigator.clipboard.writeText(payload);
      button.textContent='✓  Параметры скопированы';
      setTimeout(()=>button.textContent='⧉  Копировать параметры',2200);
    } catch {
      button.textContent='Не удалось скопировать · скачай JSON';
      setTimeout(()=>button.textContent='⧉  Копировать параметры',3200);
    }
  });
  syncControls();
  syncSummary();
  syncAtmosphereControls();
}

function makeEnvironment() {
  const hemi=new THREE.HemisphereLight('#fff7db','#778b84',2.5);scene.add(hemi);
  const sun=new THREE.DirectionalLight('#fff0c7',3.5);sun.position.set(-20,32,28);sun.castShadow=true;
  sun.shadow.mapSize.set(2048,2048);
  Object.assign(sun.shadow.camera,{left:-28,right:28,top:28,bottom:-28,near:2,far:88});
  sun.shadow.bias=-.00017;sun.shadow.normalBias=.018;sun.shadow.radius=3;scene.add(sun);
  const fill=new THREE.DirectionalLight('#92b7ba',.85);fill.position.set(17,13,-24);scene.add(fill);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(240,240),new THREE.MeshStandardMaterial({color:'#d9c9ad',roughness:1}));
  floor.rotation.x=-Math.PI/2;floor.position.y=-.22;floor.receiveShadow=true;scene.add(floor);
  const platform=new THREE.Mesh(new THREE.CylinderGeometry(10.5,10.6,.22,96),new THREE.MeshStandardMaterial({color:'#c4b89e',roughness:1}));
  platform.position.y=-.09;platform.receiveShadow=true;scene.add(platform);
  const border=new THREE.Mesh(new THREE.TorusGeometry(10.18,.045,6,100),new THREE.MeshStandardMaterial({color:'#ada085',roughness:1}));
  border.rotation.x=Math.PI/2;border.position.y=.035;scene.add(border);
  const steps=new THREE.Group();
  for(let i=0;i<6;i++){
    const stone=new THREE.Mesh(new THREE.BoxGeometry(1.4,.045,.72),new THREE.MeshStandardMaterial({color:i%2?'#bdad92':'#cab79a',roughness:1}));
    stone.position.set((i%2-.5)*.14,-.005,4.8+i*.82);
    stone.rotation.y=(i%2?.03:-.03);stone.receiveShadow=true;steps.add(stone);
  }
  scene.add(steps);
  return {hemi,sun,fill,floor,platform};
}

function initStage() {
  stage=$('houseCanvas');
  try {
    renderer=new THREE.WebGLRenderer({canvas:stage,antialias:true,alpha:false,powerPreference:'high-performance'});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.7));
    renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.toneMapping=THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled=true;
    renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  } catch(error) {
    fallback=createHouseFallback(stage,config);
    fallbackModel=createHouseModel(THREE,config);
    syncPolygonCount(fallbackModel.group.userData.metrics);
    document.querySelector('.live-indicator').innerHTML='<i></i> УПРОЩЁННЫЙ ПРОСМОТР';
    if(!stage.getContext('2d')) $('stageError').hidden=false;
    console.warn('KEYNLOCK WebGL unavailable, using canvas preview',error);
    return;
  }
  scene=new THREE.Scene();scene.background=new THREE.Color('#e6d7be');
  scene.fog=new THREE.Fog('#e6d7be',65,120);
  camera=new THREE.OrthographicCamera(-11,11,11,-11,.1,200);
  camera.position.set(17,14,21);
  controls=new OrbitControls(camera,stage);
  controls.enableDamping=true;
  controls.dampingFactor=.075;
  // OrbitControls maps Cmd/Meta + left-drag to pan when enabled.
  controls.enablePan=true;
  controls.panSpeed=.8;
  controls.rotateSpeed=.62;
  controls.zoomSpeed=.85;
  controls.minPolarAngle=.19;
  controls.maxPolarAngle=1.52;
  controls.minZoom=.55;
  controls.maxZoom=2.6;
  controls.target.set(0,4.2,0);
  controls.addEventListener('start',()=>{cameraController.cancelAnimation();document.querySelectorAll('[data-view]').forEach(b=>b.classList.remove('active'));});
  lighting=makeEnvironment();
  visual.connect({THREE,renderer,scene,camera});
  houseGlass=createHouseGlass(THREE);
  house=createHouseModel(THREE,config,{glass:houseGlass});scene.add(house.group);
  batchHouseGeometry(THREE,house.group);
  glassEnvironment=makePaintedGlassEnvironment(THREE,renderer);
  rebuildAtmosphere();
  syncPolygonCount(house.group.userData.metrics);
  fitView(true);
  const observer=new ResizeObserver(()=>fitView(false));
  window.addEventListener('pagehide',event=>{
    if(event.persisted)return;
    observer.disconnect();
    house.dispose();
    houseGlass.dispose();
    glassEnvironment?.dispose();
  });
  observer.observe(stage.parentElement);
  stage.addEventListener('webglcontextlost',e=>{e.preventDefault();$('stageError').hidden=false;});
  let previous=performance.now();
  let frames=0, fpsStart=previous;
  function frame(now) {
    requestAnimationFrame(frame);
    const dt=Math.min(.1,(now-previous)/1000);previous=now;
    if(!stageActive)return;
    frames++;
    if(now-fpsStart>=750) {
      $('fpsValue').textContent=String(Math.round(frames*1000/(now-fpsStart)));
      frames=0;fpsStart=now;
    }
    cameraController.animate(dt);
    controls.update();
    atmosphere?.update(now*.001);
    visual.render();
  }
  requestAnimationFrame(frame);
}

initInputs();
initStage();
if(embeddedCity){
  window.addEventListener('message',event=>{
    if(event.origin!==location.origin||event.source!==window.parent)return;
    if(event.data?.type==='keynlock:request-house'){
      window.parent.postMessage({type:'keynlock:house-blueprint',
        blueprint:createHouseBlueprint(config),atmosphere:{...atmosphereSettings}},location.origin);
    }else if(event.data?.type==='keynlock:house-active'){
      stageActive=Boolean(event.data.active);
      if(stageActive)requestAnimationFrame(()=>fitView(false));
    }
  });
}
