import * as THREE from 'three';
import { OrbitControls } from '../../vendor/OrbitControls.js';
import { createHouseModel } from './house-model.js';
import { createHouseFallback } from './house-fallback.js';
import { HOUSE_DEFAULTS, HOUSE_PALETTES, createHouseBlueprint, getHouseDimensions, maxFrontWindows, maxSideWindows, normalizeHouseConfig } from './house-config.js';
import { windowLayout } from './house-layout.js';

const STORAGE_KEY = 'keynlock.house.builder.v1';
const $ = id => document.getElementById(id);
const roofLabels = {gable:'Двускатная',hip:'Вальмовая',flat:'Плоская'};
const roofSubtitles = {gable:'двускатная',hip:'вальмовая',flat:'плоская'};
const colorGroups = [
  {property:'roofColor',palette:'roof',container:'roofPalette'},
  {property:'plasterColor',palette:'plaster',container:'plasterPalette'},
  {property:'woodColor',palette:'wood',container:'woodPalette'},
];
const rangeIds=['floors','width','depth','roofHeight','frontWindows','sideWindows','damageAmount','damageScale'];
const selectIds=['windowStyle','doorStyle'];
const toggleIds=['shutters','chimney','balcony','timberFrame','plasterDamage'];

let saved={};
try {saved=JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}')?.params||{};} catch {}
let config=normalizeHouseConfig({...HOUSE_DEFAULTS,...saved});

let renderer, scene, camera, controls, house, stage;
let fallback, fallbackModel;
let requestedView='three-quarter';
let cameraAnimation=null;
let pendingRender=false;

function decimal(value) {return String(value).replace('.',',');}
function persist() {try {localStorage.setItem(STORAGE_KEY,JSON.stringify(createHouseBlueprint(config)));}catch {}}
function formatFloors(value) {return `${value} ${value===1?'этаж':value<5?'этажа':'этажей'}`;}
function syncPolygonCount(metrics) {$('polygonValue').textContent=Number(metrics?.polygons??0).toLocaleString('ru-RU');}

function buildPalettes() {
  colorGroups.forEach(({property,palette,container})=>{
    const parent=$(container);
    HOUSE_PALETTES[palette].forEach(color=>{
      const button=document.createElement('button');
      button.type='button';
      button.className='palette-swatch';
      button.style.setProperty('--swatch',color);
      button.dataset.color=color;
      button.setAttribute('aria-label',`Выбрать цвет ${color}`);
      button.addEventListener('click',()=>change(property,color));
      parent.append(button);
    });
  });
}

function syncControls() {
  $('frontWindows').max=maxFrontWindows(config.width,config.shutters);
  $('sideWindows').max=maxSideWindows(config.depth,config.shutters);
  [...rangeIds,...selectIds].forEach(key=>{$(key).value=config[key];});
  toggleIds.forEach(key=>{$(key).checked=config[key];});
  colorGroups.forEach(({property,container})=>{
    $(property).value=config[property];
    $(`${property}Value`).textContent=config[property].toUpperCase();
    $(container).querySelectorAll('[data-color]').forEach(button=>{
      const selected=button.dataset.color.toLowerCase()===config[property];
      button.classList.toggle('active',selected);
      button.setAttribute('aria-pressed',String(selected));
    });
  });
  $('floorsValue').textContent=formatFloors(config.floors);
  $('widthValue').textContent=`${decimal(config.width)} м`;
  $('depthValue').textContent=`${decimal(config.depth)} м`;
  $('roofHeightValue').textContent=`${decimal(config.roofHeight)} м`;
  $('damageAmountValue').textContent=`${config.damageAmount}%`;
  $('damageScaleValue').textContent=`×${decimal(config.damageScale)}`;
  $('frontWindowsValue').textContent=`${config.frontWindows} / ряд`;
  $('sideWindowsValue').textContent=`${config.sideWindows} / этаж`;
  const flat=config.roofType==='flat';
  $('roofHeight').disabled=flat;
  $('roofHeightField').classList.toggle('disabled',flat);
  $('roofHeightValue').textContent=flat?'—':`${decimal(config.roofHeight)} м`;
  $('balcony').disabled=config.floors===1;
  $('balconyRow').classList.toggle('is-disabled',config.floors===1);
  $('damageOptions').classList.toggle('is-disabled',!config.plasterDamage);
  $('damageAmount').disabled=!config.plasterDamage;
  $('damageScale').disabled=!config.plasterDamage;
  document.querySelectorAll('[data-roof-type]').forEach(button=>{
    const selected=button.dataset.roofType===config.roofType;
    button.classList.toggle('selected',selected);
    button.setAttribute('aria-pressed',String(selected));
  });
  rangeIds.forEach(key=>{
    const slider=$(key);
    const percent=(+slider.value - +slider.min)/(+slider.max - +slider.min)*100;
    slider.style.backgroundSize=`${percent}% 100%`;
  });
}

function syncSummary() {
  const dims=getHouseDimensions(config);
  const layout=windowLayout(config);
  $('summaryFloors').textContent=String(config.floors).padStart(2,'0');
  $('summaryWindows').textContent=String(layout.totalWindows).padStart(2,'0');
  $('summaryHeight').textContent=decimal(dims.totalHeight.toFixed(1));
  $('summaryArea').textContent=`${decimal((config.width*config.depth).toFixed(1))} м²`;
  $('summaryRoof').textContent=roofLabels[config.roofType];
  $('modelSubtitle').textContent=`${roofSubtitles[config.roofType][0].toUpperCase()+roofSubtitles[config.roofType].slice(1)} крыша · ${formatFloors(config.floors)}`;
}

function change(property,value) {
  config=normalizeHouseConfig({...config,[property]:value});
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
        fitView(false);
      }
      if(fallback) fallback.update(config);
      if(fallbackModel) syncPolygonCount(fallbackModel.update(config));
    });
  }
}

function initInputs() {
  buildPalettes();
  rangeIds.forEach(key=>{$(key).addEventListener('input',e=>change(key,Number(e.target.value)));});
  selectIds.forEach(key=>{$(key).addEventListener('change',e=>change(key,e.target.value));});
  toggleIds.forEach(key=>{$(key).addEventListener('change',e=>change(key,e.target.checked));});
  colorGroups.forEach(({property})=>{$(property).addEventListener('input',e=>change(property,e.target.value));});
  document.querySelectorAll('[data-roof-type]').forEach(button=>{
    button.addEventListener('click',()=>change('roofType',button.dataset.roofType));
  });
  document.querySelectorAll('[data-view]').forEach(button=>{
    button.addEventListener('click',()=>setView(button.dataset.view));
  });
  $('houseForm').addEventListener('submit',e=>e.preventDefault());
  $('resetHouse').addEventListener('click',()=>{
    config=normalizeHouseConfig(HOUSE_DEFAULTS);
    persist();syncControls();syncSummary();
    if(house) {syncPolygonCount(house.update(config));fitView(true);}
    if(fallback) fallback.update(config);
    if(fallbackModel) syncPolygonCount(fallbackModel.update(config));
    setView('three-quarter');
  });
  $('exportHouse').addEventListener('click',()=>{
    const file=new Blob([JSON.stringify(createHouseBlueprint(config),null,2)+'\n'],{type:'application/json'});
    const url=URL.createObjectURL(file);
    const link=document.createElement('a');
    link.href=url;link.download='keynlock-house-001.json';document.body.append(link);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
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
}

function initStage() {
  stage=$('houseCanvas');
  try {
    renderer=new THREE.WebGLRenderer({canvas:stage,antialias:true,alpha:false,powerPreference:'high-performance'});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.7));
    renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.toneMapping=THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure=1.28;
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
  controls.enablePan=false;
  controls.rotateSpeed=.62;
  controls.zoomSpeed=.85;
  controls.minPolarAngle=.19;
  controls.maxPolarAngle=1.52;
  controls.minZoom=.55;
  controls.maxZoom=2.6;
  controls.target.set(0,4.2,0);
  controls.addEventListener('start',()=>{cameraAnimation=null;document.querySelectorAll('[data-view]').forEach(b=>b.classList.remove('active'));});
  makeEnvironment();
  house=createHouseModel(THREE,config);scene.add(house.group);
  syncPolygonCount(house.group.userData.metrics);
  fitView(true);
  const observer=new ResizeObserver(()=>fitView(false));
  observer.observe(stage.parentElement);
  stage.addEventListener('webglcontextlost',e=>{e.preventDefault();$('stageError').hidden=false;});
  let previous=performance.now();
  let frames=0, fpsStart=previous;
  function frame(now) {
    requestAnimationFrame(frame);
    const dt=Math.min(.1,(now-previous)/1000);previous=now;
    frames++;
    if(now-fpsStart>=750) {
      $('fpsValue').textContent=String(Math.round(frames*1000/(now-fpsStart)));
      frames=0;fpsStart=now;
    }
    if(cameraAnimation) {
      const speed=1-Math.exp(-dt*7.5);
      camera.position.lerp(cameraAnimation.position,speed);
      controls.target.lerp(cameraAnimation.target,speed);
      if(camera.position.distanceTo(cameraAnimation.position)<.016 && controls.target.distanceTo(cameraAnimation.target)<.016) {
        camera.position.copy(cameraAnimation.position);controls.target.copy(cameraAnimation.target);
        cameraAnimation=null;
      }
    }
    controls.update();
    renderer.render(scene,camera);
  }
  requestAnimationFrame(frame);
}

function directionForView(view) {
  if(view==='front')return new THREE.Vector3(0,7,28);
  if(view==='side')return new THREE.Vector3(29,7,0);
  if(view==='top')return new THREE.Vector3(.01,34,6);
  return new THREE.Vector3(18,14,22);
}

function setView(view) {
  requestedView=view;
  document.querySelectorAll('[data-view]').forEach(button=>button.classList.toggle('active',button.dataset.view===view));
  if(fallback)fallback.setView(view);
  if(!camera)return;
  const dims=getHouseDimensions(config);
  const target=new THREE.Vector3(0,dims.totalHeight*.46,0);
  cameraAnimation={target,position:directionForView(view).normalize().multiplyScalar(27).add(target)};
}

function fitView(reset) {
  if(!renderer || !camera || !stage)return;
  const width=stage.clientWidth,height=stage.clientHeight;
  if(!width||!height)return;
  const aspect=width/height;
  const dims=getHouseDimensions(config);
  const vertical=Math.max(11.4,dims.totalHeight*1.50,(dims.width + dims.depth*.58)*.87);
  camera.top=vertical/2;camera.bottom=-vertical/2;
  camera.left=-vertical*aspect/2;camera.right=vertical*aspect/2;
  camera.updateProjectionMatrix();
  renderer.setSize(width,height,false);
  if(reset){
    controls.target.set(0,dims.totalHeight*.46,0);
    camera.position.copy(directionForView(requestedView).normalize().multiplyScalar(27).add(controls.target));
    camera.zoom=1;camera.updateProjectionMatrix();controls.update();
  } else if(!cameraAnimation){
    const next=new THREE.Vector3(0,dims.totalHeight*.46,0);
    camera.position.add(next.clone().sub(controls.target));
    controls.target.copy(next);
  }
}

initInputs();
initStage();
