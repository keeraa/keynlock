import * as THREE from '../vendor/three.js';
import { KEY_TEMPLATES, METALS, brotherhoodBinding, defaultDesign, fixedMetal, keyAssetUrl,
  createKeyModel, updateKeyPaint, disposeKeyModel, keyIconSvg, keyPreviewSvg,
  bowPoints, shaftStartX, keyBounds } from './key-model.js';
import { ScreenSpaceOutlinePass } from './outline-pass.js';
import { DESIGN_PARAMETERS, loadCollection, persistCollection } from './key-storage.js';
import { modelToSTL } from './key-stl.js';
import { installKeyPreviewArt } from './key-art.js';

const $ = id => document.getElementById(id);
const parameters=DESIGN_PARAMETERS;
let saved=loadCollection(localStorage);
let drafts=KEY_TEMPLATES.map((_,i)=>saved[i]?{...saved[i]}:defaultDesign(i));
let current=0;
let design=drafts[0];
let toastTimer=0;

function persist() {
  try { persistCollection(localStorage,saved); }
  catch { showToast('Не удалось сохранить: хранилище браузера недоступно'); }
}

function showToast(message) {
  const el=$('toast');el.textContent=message;el.classList.add('is-visible');
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('is-visible'),2600);
}

function twoDigits(n) { return String(n).padStart(2,'0'); }

function renderTemplates() {
  $('templateGrid').innerHTML=KEY_TEMPLATES.map((t,i)=>{
    const binding=brotherhoodBinding(t.id);
    return `<button type="button" class="template-card ${i===current?'is-active':''} ${saved[i]?'is-saved':''} ${binding?'is-brotherhood':''}" data-template="${i}" aria-pressed="${i===current}" title="${t.description}${binding?` · ${binding.district} / ${binding.alchemicalMetal}`:''}" style="--district-accent:${binding?.accent||'#637d76'}"><span class="template-icon">${keyIconSvg(i,{collected:i===current||!!saved[i],design:drafts[i]})}</span><span class="template-name">${t.name}<span class="template-index">№ ${twoDigits(i+1)} · ${binding?'БРАТСТВО':'ГОРОД'}</span></span></button>`;
  }).join('');
}

function renderMaterials() {
  const metal=METALS.find(m=>m.id===fixedMetal(current));
  $('materials').innerHTML=`<span class="fixed-metal-swatch" aria-hidden="true" style="--texture:url('./assets/${metal.file}');--pigment:${metal.color}"></span>
    <span class="fixed-metal-text"><strong>${metal.name}</strong><small>Закреплён за этой формой ключа</small></span><span class="fixed-metal-symbol" aria-hidden="true">◆</span>`;
  $('materialDescription').textContent=metal.description;
}

function renderBinding() {
  const binding=brotherhoodBinding(KEY_TEMPLATES[current].id);
  const panel=$('brotherhoodBinding');
  if(!binding) {
    panel.classList.add('is-unbound');
    const metal=METALS.find(m=>m.id===fixedMetal(current));
    panel.innerHTML=`<div class="binding-kicker">ГОРОДСКАЯ ЗАГОТОВКА</div><div class="binding-caption">Вне семи шкатулок Братства · металл ключа: ${metal.name}</div>`;
    $('viewerStory').textContent='ГОРОДСКАЯ ЗАГОТОВКА · ВНЕ БРАТСТВА';
    return;
  }
  panel.classList.remove('is-unbound');
  panel.style.setProperty('--district-accent',binding.accent);
  panel.innerHTML=`<div class="binding-kicker"><span class="binding-dot"></span> VII ШКАТУЛОК · БОГЕМСКОЕ БРАТСТВО</div><div class="binding-region">${binding.district}</div><div class="binding-caption">${binding.planet} · ${binding.alchemicalMetal} · ${binding.meaning}</div><div class="binding-foot"><span class="binding-current">✓ Металл района закреплён</span></div>`;
  $('viewerStory').textContent=`БОГЕМСКОЕ БРАТСТВО · ${binding.district.toUpperCase()} · ${binding.alchemicalMetal.toUpperCase()}`;
}

const valueFormat={
  shaftLength:v=>`${Number(v).toFixed(2)} ед.`,headSize:v=>`${v}%`,teeth:v=>v,
  cutDepth:v=>`${v}%`,thickness:v=>`${v} мм`,rustAmount:v=>`${v}%`,breakAngle:v=>`${v}°`,
};

function renderControls() {
  for(const key of parameters) {
    const input=$(key);input.value=design[key];
    $(''+key+'Value').textContent=valueFormat[key](design[key]);
    const min=Number(input.min),max=Number(input.max);
    input.style.setProperty('--value',`${(Number(input.value)-min)/(max-min)*100}%`);
  }
  $('doubleSided').checked=!!design.doubleSided;
  $('broken').checked=!!design.broken;
  $('dirtEnabled').checked=design.dirtAmount>0;
  $('breakAngleRow').hidden=!design.broken;
}

function renderCollection() {
  $('collectionCount').textContent=`${twoDigits(saved.filter(Boolean).length)} / 10`;
  $('collectionTrack').innerHTML=KEY_TEMPLATES.map((t,i)=>{
    const binding=brotherhoodBinding(t.id);
    return `<button class="collection-item ${i===current?'is-current':''} ${saved[i]?'is-collected':''} ${binding?'is-brotherhood':''}" type="button" data-collection="${i}" title="${t.name}${binding?` · ${binding.district} / ${binding.alchemicalMetal}`:''}${saved[i]?' — сохранён':''}" aria-label="Открыть чертёж: ${t.name}"><span class="collection-index">${twoDigits(i+1)}</span><span class="collection-check">${saved[i]?'✓':'◇'}</span><span class="collection-icon">${keyIconSvg(i,{collected:!!saved[i]||i===current,design:saved[i]||drafts[i]})}</span><span class="collection-name">${t.name}</span></button>`;
  }).join('');
  $('saveButtonText').textContent=saved[current]?'Обновить в коллекции':'Добавить в коллекцию';
}

function renderHeader() {
  $('viewerNumber').textContent=twoDigits(current+1);
  $('blueprintId').textContent=twoDigits(current+1);
  $('viewerName').textContent=KEY_TEMPLATES[current].name;
}

function renderUI() {
  renderTemplates();renderMaterials();renderBinding();renderControls();renderCollection();renderHeader();
}

function selectTemplate(index) {
  if(index===current) return;
  if(!KEY_TEMPLATES[index]) return;
  drafts[current]={...design};
  current=index; design=drafts[index];
  renderUI();scheduleModelUpdate();
}

function updateParameter(key,value) {
  const n=Number(value);
  design[key]=n;
  $(key+'Value').textContent=valueFormat[key](n);
  const input=$(key), min=Number(input.min), max=Number(input.max);
  input.style.setProperty('--value',`${(n-min)/(max-min)*100}%`);
  scheduleModelUpdate(key!=='rustAmount');
}

function initializeInput() {
  $('templateGrid').addEventListener('click',ev=>{
    const button=ev.target.closest('[data-template]'); if(button) selectTemplate(Number(button.dataset.template));
  });
  $('collectionTrack').addEventListener('click',ev=>{
    const button=ev.target.closest('[data-collection]'); if(button) selectTemplate(Number(button.dataset.collection));
  });
  for(const key of parameters) $(key).addEventListener('input',ev=>updateParameter(key,ev.target.value));
  for(const key of ['doubleSided']) $(key).addEventListener('change',ev=>{
    design[key]=ev.target.checked;scheduleModelUpdate();
  });
  $('broken').addEventListener('change',ev=>{
    design.broken=ev.target.checked;
    $('breakAngleRow').hidden=!design.broken;
    scheduleModelUpdate();
  });
  $('dirtEnabled').addEventListener('change',ev=>{
    design.dirtAmount=ev.target.checked?100:0;
    scheduleModelUpdate();
  });
  $('resetButton').addEventListener('click',()=>{
    design=defaultDesign(current);drafts[current]=design;renderUI();scheduleModelUpdate();showToast('Заготовка восстановлена');
  });
  $('saveButton').addEventListener('click',()=>{
    saved[current]={...design};drafts[current]={...design};persist();renderTemplates();renderCollection();
    showToast(`«${KEY_TEMPLATES[current].name}» сохранён · ${saved.filter(Boolean).length} из 10`);
  });
  $('pngButton').addEventListener('click',exportPNG);
  $('stlButton').addEventListener('click',exportSTL);
  $('zoomInButton').addEventListener('click',()=>zoomBy(1.15));
  $('zoomOutButton').addEventListener('click',()=>zoomBy(1/1.15));
  $('frontButton').addEventListener('click',()=>{targetX=0;targetY=0;targetZ=0;zoomTarget=1;if(flatPreview)updateFlatZoom();});
}

// Three.js scene: real extruded key geometry and reusable painted-material textures.
let renderer,scene,camera,keyGroup,shadowPlane,outlinePass;
let ready=false;
let flatPreview=false;
let targetX=-.13,targetY=.17,targetZ=-.06,zoomTarget=1;
let actualX=targetX,actualY=targetY,actualZ=targetZ,actualZoom=1;
let updateScheduled=false;
let pendingGeometryRebuild=false;
let flatRenderFrame=0;
let flatCountFrame=0;
let frameCount=0,lastFpsSample=0;
let lastCanvasWidth=0,lastCanvasHeight=0;
const polygonFormat=new Intl.NumberFormat('ru-RU');
const polygonCountCache=new Map();
const outlineDrawingSize=new THREE.Vector2();
const canvas=$('threeCanvas');

function countKeyPolygons(root) {
  let triangles=0;
  root.traverse(obj=>{
    if(!obj.isMesh)return;
    const geometry=obj.geometry;
    const count=geometry.index?.count ?? geometry.getAttribute('position')?.count ?? 0;
    triangles+=Math.floor(count/3);
  });
  return triangles;
}

function keyGeometrySignature(d) {
  return [d.template,d.shaftLength,d.headSize,d.teeth,d.cutDepth,d.thickness,
    Number(!!d.doubleSided),d.dirtAmount??0,
    Number(!!d.broken),d.broken?(d.breakAngle??70):0].join(':');
}

function rememberPolygonCount(signature,count) {
  if(polygonCountCache.has(signature))polygonCountCache.delete(signature);
  polygonCountCache.set(signature,count);
  if(polygonCountCache.size>64)polygonCountCache.delete(polygonCountCache.keys().next().value);
}

function updatePolygonCounter(model) {
  const count=countKeyPolygons(model);
  rememberPolygonCount(keyGeometrySignature(design),count);
  $('polygonValue').textContent=polygonFormat.format(count);
}

function disposeModelGeometry(model) {
  disposeKeyModel(model);
}

function activateFlatPreview(error) {
  console.warn('3D-просмотр не запустился; включён рисованный 2D-просмотр.',error);
  ready=false;flatPreview=true;
  if(outlinePass){outlinePass.dispose();outlinePass=null;}
  if(renderer){renderer.dispose();renderer=null;}
  renderFlatPreview();
  document.querySelector('.preview-mode').innerHTML='<span class="pulse-dot"></span> РИСОВАННЫЙ ПРОСМОТР';
  document.querySelector('.drag-hint span:last-child').textContent='2D-РЕЖИМ · МАСШТАБ КНОПКАМИ';
  $('fpsValue').textContent='—';
  showToast('Включён 2D-просмотр · STL доступен');
}

function initializeThree() {
  try { setupThreeScene(); }
  catch(err) { activateFlatPreview(err); }
}

function setupThreeScene() {
  renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true,preserveDrawingBuffer:true,powerPreference:'high-performance'});
  scene=new THREE.Scene();
  camera=new THREE.OrthographicCamera(-2.5,2.5,2,-2,.1,100);
  camera.position.set(0,0,7);camera.lookAt(0,0,0);
  shadowPlane=installKeyPreviewArt(renderer,scene);
  keyGroup=createKeyModel(design);scene.add(keyGroup);
  outlinePass=new ScreenSpaceOutlinePass(renderer);
  updatePolygonCounter(keyGroup);
  resizeScene();
  new ResizeObserver(resizeScene).observe($('sceneContainer'));
  initializeOrbit();
  ready=true;
  lastFpsSample=performance.now();
  requestAnimationFrame(animate);
}

function resizeScene() {
  if(!renderer)return;
  const rect=$('sceneContainer').getBoundingClientRect();
  const w=Math.max(1,Math.floor(rect.width)),h=Math.max(1,Math.floor(rect.height));
  if(w!==lastCanvasWidth||h!==lastCanvasHeight) {
    renderer.setSize(w,h,false);
    lastCanvasWidth=w;lastCanvasHeight=h;
    if(outlinePass) {
      renderer.getDrawingBufferSize(outlineDrawingSize);
      outlinePass.setSize(outlineDrawingSize.x,outlineDrawingSize.y,renderer.getPixelRatio());
    }
  }
  const aspect=w/h;
  const template=KEY_TEMPLATES[design.template];
  if(design.broken) {
    const b=keyBounds(template,design);
    const centerX=(b.minX+b.maxX)/2,centerY=(b.minY+b.maxY)/2;
    const worldWidth=Math.max(4.15,b.maxX-b.minX+.9,(b.maxY-b.minY+1.0)*aspect);
    const worldHeight=worldWidth/aspect;
    camera.left=centerX-worldWidth/2;camera.right=centerX+worldWidth/2;
    camera.top=centerY+worldHeight/2;camera.bottom=centerY-worldHeight/2;
    camera.updateProjectionMatrix();
    return;
  }
  const headLeft=-1.21+Math.min(...bowPoints(template.bow).map(p=>p[0]))*design.headSize/100;
  const keyRight=shaftStartX(template,design)+design.shaftLength;
  const worldWidth=Math.max(4.15,2*(Math.max(Math.abs(headLeft),Math.abs(keyRight))+.38),2.7*aspect);
  const worldHeight=worldWidth/aspect;
  camera.left=-worldWidth/2;camera.right=worldWidth/2;
  camera.top=worldHeight/2;camera.bottom=-worldHeight/2;
  camera.updateProjectionMatrix();
}

function scheduleModelUpdate(geometryChanged=true) {
  if(flatPreview) {
    if(!flatRenderFrame)flatRenderFrame=requestAnimationFrame(()=>{
      flatRenderFrame=0;renderFlatPreview();
    });
    return;
  }
  if(!ready)return;
  if(geometryChanged)pendingGeometryRebuild=true;
  if(updateScheduled)return;
  updateScheduled=true;
  requestAnimationFrame(()=>{
    updateScheduled=false;
    try {
      if(pendingGeometryRebuild) {
        const replacement=createKeyModel(design);
        scene.remove(keyGroup);
        disposeModelGeometry(keyGroup);
        keyGroup=replacement;scene.add(keyGroup);
        updatePolygonCounter(keyGroup);
        resizeScene();
        renderer.shadowMap.needsUpdate=true;
      } else updateKeyPaint(keyGroup,design);
      pendingGeometryRebuild=false;
    } catch(err) { activateFlatPreview(err); }
  });
}

function renderFlatPreview() {
  $('sceneContainer').innerHTML=`<div class="flat-preview" id="flatPreview">${keyPreviewSvg(design)}</div>`;
  updateFlatZoom();
  cancelAnimationFrame(flatCountFrame);
  const signature=keyGeometrySignature(design);
  const cached=polygonCountCache.get(signature);
  if(cached!==undefined) {
    $('polygonValue').textContent=polygonFormat.format(cached);
    return;
  }
  const snapshot={...design};
  flatCountFrame=requestAnimationFrame(()=>{
    try {
      const key=createKeyModel(snapshot);
      const count=countKeyPolygons(key);
      rememberPolygonCount(signature,count);
      if(keyGeometrySignature(design)===signature)
        $('polygonValue').textContent=polygonFormat.format(count);
      disposeModelGeometry(key);
    } catch(err) {
      console.error('Не удалось посчитать полигоны ключа',err);
      $('polygonValue').textContent='—';
    }
  });
}

function updateFlatZoom() {
  const element=$('flatPreview');
  if(element)element.style.transform=`scale(${zoomTarget})`;
}

function initializeOrbit() {
  let pointer=null;
  canvas.addEventListener('pointerdown',ev=>{
    if(ev.button!==0)return;
    pointer={id:ev.pointerId,x:ev.clientX,y:ev.clientY};canvas.setPointerCapture(ev.pointerId);
  });
  canvas.addEventListener('pointermove',ev=>{
    if(!pointer||ev.pointerId!==pointer.id)return;
    const dx=ev.clientX-pointer.x,dy=ev.clientY-pointer.y;
    targetY+=dx*.009;targetX=Math.max(-1.35,Math.min(1.35,targetX+dy*.009));
    pointer.x=ev.clientX;pointer.y=ev.clientY;
  });
  function endPointer(ev){if(pointer?.id===ev.pointerId)pointer=null;}
  canvas.addEventListener('pointerup',endPointer);canvas.addEventListener('pointercancel',endPointer);
  canvas.addEventListener('lostpointercapture',()=>pointer=null);
  canvas.addEventListener('wheel',ev=>{ev.preventDefault();zoomBy(ev.deltaY>0?.915:1.095);},{passive:false});
  canvas.addEventListener('dblclick',()=>{targetX=0;targetY=0;targetZ=0;zoomTarget=1;});
}

function zoomBy(factor) { zoomTarget=Math.min(2.1,Math.max(.65,zoomTarget*factor));if(flatPreview)updateFlatZoom(); }

function renderKeyFrame() {
  if(outlinePass) {
    try { outlinePass.render(scene,camera,shadowPlane);return; }
    catch(err) {
      console.warn('Контурный проход недоступен; используется обычный 3D-просмотр.',err);
      outlinePass.dispose();outlinePass=null;
    }
  }
  renderer.render(scene,camera);
}

function animate(now) {
  if(!ready)return;
  frameCount++;
  if(now-lastFpsSample>=750) {
    $('fpsValue').textContent=String(Math.round(frameCount*1000/(now-lastFpsSample)));
    lastFpsSample=now;frameCount=0;
  }
  const lastX=actualX,lastY=actualY,lastZ=actualZ;
  actualX+=(targetX-actualX)*.12;
  actualY+=(targetY-actualY)*.12;
  actualZ+=(targetZ-actualZ)*.12;
  if(Math.abs(actualX-lastX)+Math.abs(actualY-lastY)+Math.abs(actualZ-lastZ)>1e-7)
    renderer.shadowMap.needsUpdate=true;
  actualZoom+=(zoomTarget-actualZoom)*.13;
  keyGroup.rotation.set(actualX,actualY,actualZ);
  camera.zoom=actualZoom;camera.updateProjectionMatrix();
  try { renderKeyFrame(); }
  catch(err) { activateFlatPreview(err);return; }
  requestAnimationFrame(animate);
}

function download(blob,file) {
  const url=URL.createObjectURL(blob);const anchor=document.createElement('a');
  anchor.href=url;anchor.download=file;document.body.appendChild(anchor);anchor.click();anchor.remove();
  setTimeout(()=>URL.revokeObjectURL(url),15000);
}

function fileBase() {return `keynlock-${KEY_TEMPLATES[current].id}-${twoDigits(current+1)}`;}

async function exportPNG() {
  if(flatPreview) {
    const svg=$('flatPreview')?.querySelector('svg');
    if(!svg)return;
    const cleanSvg=svg.cloneNode(true);
    cleanSvg.querySelector('g[filter]')?.removeAttribute('filter');
    cleanSvg.querySelector('filter')?.remove();
    const embeddedImages=new Map();
    const assetRoot=keyAssetUrl('');
    for(const imageElement of cleanSvg.querySelectorAll('image')) {
      const source=imageElement.getAttribute('href');
      if(!source||!new URL(source,document.baseURI).href.startsWith(assetRoot))continue;
      try {
        if(!embeddedImages.has(source)) {
          const textureBlob=await (await fetch(source)).blob();
          const textureData=await new Promise((resolve,reject)=>{
            const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(textureBlob);
          });
          embeddedImages.set(source,textureData);
        }
        imageElement.setAttribute('href',embeddedImages.get(source));
      } catch(err) {console.warn('Гуашевую текстуру PNG встроить не удалось',source,err);}
    }
    const source=new XMLSerializer().serializeToString(cleanSvg);
    const blob=new Blob([source],{type:'image/svg+xml;charset=utf-8'});
    const url=URL.createObjectURL(blob);
    const img=new Image();
    try {
      await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=url;});
      const output=document.createElement('canvas');output.width=1400;output.height=760;
      const ctx=output.getContext('2d');ctx.drawImage(img,0,0,1400,760);
      const png=await new Promise(resolve=>output.toBlob(resolve,'image/png'));
      if(png){download(png,`${fileBase()}.png`);showToast('PNG ключа сохранён');}
    } catch { showToast('Не удалось создать PNG'); }
    finally {URL.revokeObjectURL(url);}
    return;
  }
  if(!ready){showToast('3D-просмотр пока недоступен');return;}
  renderKeyFrame();
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
  if(!blob){showToast('Не удалось создать PNG');return;}
  download(blob,`${fileBase()}.png`);showToast('Изображение ключа сохранено');
}

function exportSTL() {
  const model=ready?keyGroup:createKeyModel(design);
  download(modelToSTL(model),`${fileBase()}.stl`);
  if(!ready)disposeModelGeometry(model);
  showToast('3D-модель STL сохранена');
}

initializeInput();renderUI();initializeThree();

