import * as THREE from 'three';
import {OrbitControls} from '../../vendor/OrbitControls.js';
import {createLandmarkModel,LANDMARK_CATALOG,LANDMARK_CHIMNEY_DEFAULTS} from './landmark-model.js';
import {createLandmarkAtmosphere} from './landmark-atmosphere.js';
import {loadBuildingAtmosphereSettings,saveBuildingAtmosphereSettings} from '../buildings/house-atmosphere.js';
import {mountEditorVisual} from '../effects/editor-visual.js';

const $=id=>document.getElementById(id);
const names={high:'Высокая',medium:'Средняя',low:'Низкая'};
const symbols={church:'✝',theater:'♜',museum:'◈',townhall:'◷',palace:'♛',tower:'♙'};
const chimneyStorageKey='keynlock-landmark-chimneys-v1';
function loadChimneyChoices(){
  try{
    const saved=JSON.parse(localStorage.getItem(chimneyStorageKey)||'{}');
    return Object.fromEntries(Object.entries(LANDMARK_CHIMNEY_DEFAULTS).map(([id,enabled])=>
      [id,typeof saved[id]==='boolean'?saved[id]:enabled]));
  }catch{return {...LANDMARK_CHIMNEY_DEFAULTS};}
}
const state={id:'church',lod:'high',view:'three-quarter',model:null,atmosphere:null,
  settings:loadBuildingAtmosphereSettings(),chimneys:loadChimneyChoices()};
const nf=new Intl.NumberFormat('ru-RU');
const visual=mountEditorVisual();
const catalogue=$('buildingList');
for(const [index,entry] of LANDMARK_CATALOG.entries()){
  const button=document.createElement('button');button.type='button';button.className='building-option';
  button.dataset.landmark=entry.id;button.setAttribute('aria-pressed',index===0?'true':'false');
  button.innerHTML=`<span class="building-symbol" aria-hidden="true">${symbols[entry.id]}</span><span class="building-info"><b>${entry.short}</b><small>${entry.role}</small></span><span class="building-count">${String(index+1).padStart(2,'0')}</span>`;
  button.addEventListener('click',()=>{state.id=entry.id;state.view='three-quarter';rebuild();});
  catalogue.append(button);
}

let renderer,scene,camera,controls,ground,plinth,glassEnvironment;
const lights={};
const views={
  'three-quarter':[.95,.68,1.12],
  front:[0,.36,1.36],
  side:[1.4,.4,0],
  top:[.18,1.55,.22],
};
function aimView(animate=false){
  if(!controls||!state.model)return;
  const bbox=new THREE.Box3().setFromObject(state.model.group);
  const size=bbox.getSize(new THREE.Vector3());
  const longest=Math.max(size.x,size.z);
  const offset=Math.max(longest*1.8,size.y*1.6,30);
  const v=views[state.view]??views['three-quarter'];
  const target=new THREE.Vector3(0,size.y*.37,-.3);
  const position=target.clone().add(new THREE.Vector3(v[0]*offset,v[1]*offset,v[2]*offset));
  controls.target.copy(target);
  camera.position.copy(position);
  camera.near=.1;camera.far=600;camera.updateProjectionMatrix();
  controls.update();
  document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===state.view));
}

function updateInterface(){
  const i=LANDMARK_CATALOG.findIndex(item=>item.id===state.id),entry=LANDMARK_CATALOG[i];
  catalogue.querySelectorAll('button').forEach(button=>{
    const active=button.dataset.landmark===state.id;
    button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));
  });
  document.querySelectorAll('[data-lod]').forEach(button=>{
    const active=button.dataset.lod===state.lod;
    button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));
  });
  $('modelIndex').textContent=`${String(i+1).padStart(2,'0')} / ${String(LANDMARK_CATALOG.length).padStart(2,'0')}`;
  $('modelTitle').textContent=entry.name;$('modelSubtitle').textContent=entry.subtitle;
  $('modelDistrict').textContent=entry.district.toUpperCase();
  $('passportTitle').textContent=entry.short;$('passportDescription').textContent=entry.description;
  $('passportDistrict').textContent=entry.district;$('passportRole').textContent=entry.role;
  $('passportFootprint').textContent=entry.footprint;$('passportLOD').textContent=names[state.lod];
  if(!state.model)return;
  const bounds=new THREE.Box3().setFromObject(state.model.group);
  $('buildingHeight').textContent=bounds.max.y.toFixed(1).replace('.',',');
  $('passportTriangles').textContent=nf.format(state.model.stats.triangles);
  $('passportMeshes').textContent=nf.format(state.model.stats.meshes);
  $('passportEntrance').textContent=state.model.entranceCount>0?'Предусмотрен':'Нет';
  const chimneyToggle=$('landmarkChimneys');
  chimneyToggle.disabled=state.id==='tower';
  chimneyToggle.checked=Boolean(state.chimneys[state.id]);
  $('chimneyNote').textContent=state.id==='tower'?'Для башни дымоход не предусмотрен':
    chimneyToggle.checked?'Дымоходы присутствуют на модели':'Дымоходы убраны с модели';
}

function rebuild(){
  try{
    // Acquire the next model before releasing the previous one, so changing
    // buildings/LOD never evicts and reloads the shared painted GPU maps.
    const previous=state.model,previousAtmosphere=state.atmosphere;
    const next=createLandmarkModel(THREE,state.id,{detail:state.lod,chimneys:state.chimneys[state.id]});
    const atmosphere=createLandmarkAtmosphere(THREE,next,{
      settings:state.settings,mossMap:next.textureMaps.moss,
    });
    state.model=next;
    state.atmosphere=atmosphere;
    scene.add(next.group,atmosphere.group);
    if(previous){
      scene.remove(previous.group,previousAtmosphere.group);
      previousAtmosphere.dispose();previous.dispose();
    }
    applyAtmosphereSettings();
    if(renderer?.shadowMap)renderer.shadowMap.needsUpdate=true;
    updateInterface();aimView();
  }catch(error){console.error('Ошибка сборки здания',error);$('webglError').hidden=false;}
}

function makeGlassEnvironment(){
  // A small hand-painted-looking panorama gives varnished glass something to
  // reflect even when the editor uses a plain studio-colored background.
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=256;
  const c=canvas.getContext('2d');
  const sky=c.createLinearGradient(0,0,0,256);
  sky.addColorStop(0,'#899faa');sky.addColorStop(.45,'#dbe3d7');
  sky.addColorStop(.53,'#e8d2ae');sky.addColorStop(1,'#6f7e78');
  c.fillStyle=sky;c.fillRect(0,0,512,256);
  for(const [x,width,alpha] of [[82,56,.45],[212,23,.34],[357,76,.45]]){
    const shine=c.createLinearGradient(x,0,x+width,0);
    shine.addColorStop(0,'rgba(255,247,216,0)');
    shine.addColorStop(.5,'rgba(255,247,216,'+alpha+')');
    shine.addColorStop(1,'rgba(255,247,216,0)');
    c.fillStyle=shine;c.fillRect(x,15,width,230);
  }
  const source=new THREE.CanvasTexture(canvas);
  source.mapping=THREE.EquirectangularReflectionMapping;
  source.colorSpace=THREE.SRGBColorSpace;
  try{
    const pmrem=new THREE.PMREMGenerator(renderer);
    const target=pmrem.fromEquirectangular(source);
    pmrem.dispose();source.dispose();return target;
  }catch(error){
    console.warn('Отражения стекла без окружения',error);
    source.dispose();return null;
  }
}

function applyAtmosphereSettings(){
  if(!renderer||!scene)return;
  const options=state.settings,night=Boolean(options.night);
  state.model?.setWindowAppearance({
    gloss:options.glassGloss,reflection:options.glassReflection,
    night,glow:options.windowGlow,envMap:glassEnvironment?.texture??null,
  });
  state.atmosphere?.setSettings(options);
  scene.background.set(night?'#172431':'#e8e1ce');
  scene.fog?.color.set(night?'#172431':'#e8e1ce');
  lights.hemi.color.set(night?'#9cb4d1':'#fff7e6');
  lights.hemi.groundColor.set(night?'#2b3543':'#aca48a');
  lights.hemi.intensity=night?.72:2.5;
  lights.sun.color.set(night?'#91b6d5':'#ffead1');
  lights.sun.intensity=night?.63:3.1;
  lights.bounce.color.set(night?'#a5b4d6':'#bfd5db');
  lights.bounce.intensity=night?.25:.64;
  ground.material.color.set(night?'#687483':'#f4ebda');
  plinth.material.color.set(night?'#68707d':'#d4c5a8');
  visual.setExposureScale(night?.92/1.31:1);
  document.body.classList.toggle('night-mode',night);
  if(renderer.shadowMap)renderer.shadowMap.needsUpdate=true;
}

function syncAtmosphereControls(){
  document.querySelectorAll('[data-atmo]').forEach(input=>{
    const key=input.dataset.atmo;
    if(input.type==='checkbox')input.checked=Boolean(state.settings[key]);
    else input.value=state.settings[key];
    const label=document.querySelector('[data-atmo-value="'+key+'"]');
    if(label)label.textContent=state.settings[key]+(key==='mossHeight'?' см':'%');
  });
}

function makePaving(){
  // One lightweight, reproducible texture yields cobbled plaza scale cues.
  const canvas=document.createElement('canvas');canvas.width=canvas.height=512;
  const c=canvas.getContext('2d');
  c.fillStyle='#e1d5bf';c.fillRect(0,0,512,512);
  let seed=1997;const rand=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
  for(let row=0;row<16;row++)for(let col=0;col<16;col++){
    const x=col*32+(row%2?16:0),y=row*32;
    c.fillStyle=`rgba(114,92,68,${(.045+rand()*.067).toFixed(3)})`;c.fillRect(x+1,y+1,30,30);
    c.strokeStyle=`rgba(112,94,73,${(.09+rand()*.07).toFixed(3)})`;c.lineWidth=1;
    c.strokeRect(x+1.5,y+1.5,29,29);
  }
  const tex=new THREE.CanvasTexture(canvas);tex.wrapS=tex.wrapT=THREE.RepeatWrapping;
  tex.repeat.set(7,7);tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=4;
  return tex;
}

function initialize(){
  const canvas=$('landmarkCanvas');
  renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.6));
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled=true;
  renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate=false;
  scene=new THREE.Scene();scene.background=new THREE.Color('#e8e1ce');scene.fog=new THREE.Fog('#e8e1ce',160,310);
  camera=new THREE.PerspectiveCamera(39,1,.1,600);
  controls=new OrbitControls(camera,canvas);controls.enableDamping=true;controls.dampingFactor=.075;
  controls.minDistance=8;controls.maxDistance=180;controls.maxPolarAngle=Math.PI*.48;
  controls.enablePan=true;
  lights.hemi=new THREE.HemisphereLight('#fff7e6','#aca48a',2.5);scene.add(lights.hemi);
  const sun=new THREE.DirectionalLight('#ffead1',3.1);sun.position.set(-38,83,64);sun.castShadow=true;
  sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-65;sun.shadow.camera.right=65;
  sun.shadow.camera.top=65;sun.shadow.camera.bottom=-65;sun.shadow.camera.near=5;sun.shadow.camera.far=180;
  sun.shadow.bias=-.00011;scene.add(sun);lights.sun=sun;
  const bounce=new THREE.DirectionalLight('#bfd5db',.64);bounce.position.set(35,27,-32);scene.add(bounce);lights.bounce=bounce;
  const tiles=makePaving();
  ground=new THREE.Mesh(new THREE.PlaneGeometry(180,180),new THREE.MeshStandardMaterial({color:'#f4ebda',map:tiles,roughness:1}));
  ground.rotation.x=-Math.PI/2;ground.position.y=-.07;ground.receiveShadow=true;scene.add(ground);
  plinth=new THREE.Mesh(new THREE.BoxGeometry(64,.35,53),new THREE.MeshStandardMaterial({color:'#d4c5a8',roughness:1}));
  plinth.position.set(0,-.26,0);plinth.receiveShadow=true;scene.add(plinth);
  glassEnvironment=makeGlassEnvironment();
  visual.connect({THREE,renderer,scene,camera});
  let sceneTriangleCount=0;
  const clock=new THREE.Clock();
  const frame=()=>{
    if(!renderer)return;
    const w=canvas.clientWidth||1,h=canvas.clientHeight||1;
    if(canvas.width!==Math.round(w*renderer.getPixelRatio())||canvas.height!==Math.round(h*renderer.getPixelRatio())){
      renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();visual.resize(w,h,renderer.getPixelRatio());
    }
    controls.update();clock.getDelta();state.atmosphere?.update(clock.elapsedTime);
    const stats=visual.render();sceneTriangleCount=stats.sceneTriangles??stats.triangles;
    window.requestAnimationFrame(frame);
  };
  let measured=performance.now(),frames=0;
  renderer.setAnimationLoop(null);
  window.requestAnimationFrame(function loop(now){
    frames++;if(now-measured>=800){
      $('fpsValue').textContent=String(Math.round(frames*1000/(now-measured)));
      $('sceneTriangles').textContent=nf.format(sceneTriangleCount);
      frames=0;measured=now;
    }
    window.requestAnimationFrame(loop);
  });
  frame();rebuild();
}

document.querySelectorAll('[data-lod]').forEach(button=>button.addEventListener('click',()=>{
  if(state.lod===button.dataset.lod)return;
  state.lod=button.dataset.lod;rebuild();
}));
document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>{
  state.view=button.dataset.view;aimView();
}));
// Per-building chimney choice is independent of the shared smoke style.
$('landmarkChimneys').addEventListener('change',event=>{
  state.chimneys[state.id]=event.target.checked;
  try{localStorage.setItem(chimneyStorageKey,JSON.stringify(state.chimneys));}catch{}
  rebuild();
});
syncAtmosphereControls();
document.querySelectorAll('[data-atmo]').forEach(input=>input.addEventListener(
  input.type==='range'?'input':'change',()=>{
    state.settings[input.dataset.atmo]=input.type==='checkbox'?input.checked:Number(input.value);
    saveBuildingAtmosphereSettings(state.settings);
    syncAtmosphereControls();applyAtmosphereSettings();
  },
));
try{initialize();}catch(error){console.error('Ошибка WebGL в мастерской',error);$('webglError').hidden=false;}
