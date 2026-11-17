import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {defs,createHandles} from './geometry.js';
import {createPaintingSystem} from './painting.js';
const scene=new THREE.Scene();scene.background=new THREE.Color('#202725');const camera=new THREE.PerspectiveCamera(35,1,.1,100);camera.position.set(0,3.5,17);const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.shadowMap.enabled=true;document.getElementById('stage').prepend(renderer.domElement);const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.08;controls.target.set(0,2.6,0);controls.minDistance=5;controls.maxDistance=35;controls.maxPolarAngle=Math.PI*.72;
let framePending=false,wasMoving=false,quietTimer=null;
scene.add(new THREE.HemisphereLight(0xffffff,0x39433d,2.4));const light=new THREE.DirectionalLight(0xfff5dc,3);light.position.set(-5,9,8);light.castShadow=true;light.shadow.mapSize.set(2048,2048);scene.add(light);const fill=new THREE.DirectionalLight(0xa9c9d0,1.5);fill.position.set(7,5,-5);scene.add(fill);
const clay=new THREE.MeshStandardMaterial({color:0xc3b9a5,roughness:.82,metalness:0});const edge=new THREE.MeshStandardMaterial({color:0xa29a8b,roughness:.75});const base=new THREE.MeshStandardMaterial({color:0x323b36,roughness:1});
let groups=createHandles({clay,edge,base});groups.forEach(g=>scene.add(g));const grid=new THREE.GridHelper(30,30,0x48574b,0x344039);grid.position.y=-.28;scene.add(grid);const floor=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.ShadowMaterial({opacity:.16}));floor.rotation.x=-Math.PI/2;floor.position.y=-.215;floor.receiveShadow=true;scene.add(floor);
const artworkList=[['none','Без рисунка',''],['geisha','Гейша','geisha-red-fan.webp'],['dragon','Дракон','dragon.webp'],['sakura','Сакура','sakura.webp'],['fuji','Фудзи','fuji.webp'],['bamboo','Бамбук','bamboo.webp'],['koi','Карп кои','koi.webp'],...Array.from({length:8},(_,i)=>{const n=String(i+1).padStart(2,'0');return ['decodance'+n,'Decodance Black · '+n,'decodance_black_'+n+'.webp']}),...Array.from({length:16},(_,i)=>{const n=String(i+1).padStart(2,'0');return ['arabic'+n,'Arabic · '+n,'arabic_'+n+'.webp']})];
const artSelector=document.createElement('select');artSelector.id='artSelector';artSelector.style.cssText='width:100%;background:#38433b;color:#e9ece5;border:1px solid #586658;padding:10px;border-radius:8px;cursor:pointer;margin:7px 0';const opts={};artworkList.forEach(([id,label])=>{const category=id.startsWith('arabic')?'Arabic':id.startsWith('decodance')?'Decodance Black':'Япония';if(!opts[category]){opts[category]=document.createElement('optgroup');opts[category].label=category;artSelector.appendChild(opts[category])}const opt=document.createElement('option');opt.value=id;opt.textContent=label;opts[category].appendChild(opt)});document.querySelector('aside h2:last-of-type').after(artSelector);
const {setArtwork}=createPaintingSystem({renderer,groups,defs,clay,artSelector,artworkList,onChange:invalidate});
artSelector.onchange=()=>setArtwork(artSelector.value);setArtwork('none');
function countTriangles(){let total=0;groups.forEach(g=>{if(!g.visible)return;g.traverse(o=>{if(!o.isMesh||!o.visible)return;const geom=o.geometry;total+=geom.index?geom.index.count/3:geom.attributes.position.count/3})});document.getElementById('polycount').textContent=Math.round(total).toLocaleString('ru-RU')}
let selected=-1;function layout(){groups.forEach((g,i)=>{g.visible=selected<0||i===selected;g.position.x=selected<0?(i-(groups.length-1)/2)*2.15:0;g.position.y=0;g.rotation.y=0});document.querySelectorAll('.item').forEach((e,i)=>e.classList.toggle('active',selected===i));document.getElementById('detail').innerHTML=selected<0?`<b>Коллекция рукоятей</b>${defs.length} отдельных 3D-моделей · разные сечения`:`<b>${defs[selected][0]}</b>${defs[selected][1]}`;document.getElementById('hint').textContent=selected<0?`${defs.length} рукоятей · выберите форму слева`:`Форма ${selected+1} / ${defs.length} · вращайте мышью`;camera.position.set(0,3.5,selected<0?27:11);controls.target.set(0,2.6,0);controls.update();countTriangles();invalidate()}
const list=document.getElementById('items');defs.forEach((d,i)=>{const b=document.createElement('button');b.className='item';b.innerHTML=`<span class="num">${String(i+1).padStart(2,'0')}</span><span>${d[0]}</span>`;b.onclick=()=>{selected=i;layout()};list.appendChild(b)});document.getElementById('all').textContent=`Все ${defs.length}`;document.getElementById('all').onclick=()=>{selected=-1;layout()};document.getElementById('front').onclick=()=>{camera.position.set(0,2.7,selected<0?25:11);controls.update()};document.getElementById('side').onclick=()=>{camera.position.set(selected<0?25:11,2.7,0);controls.update()};document.getElementById('reset').onclick=layout;layout();function resize(){let el=document.getElementById('stage');let w=el.clientWidth,h=el.clientHeight;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h)}new ResizeObserver(resize).observe(document.getElementById('stage'));
const performanceTag=document.createElement('small');document.querySelector('.stats').append(performanceTag);
let frames=0,lastSample=performance.now(),maxCalls=0;
function invalidate(){
 if(document.hidden||framePending)return;
 framePending=true;
 requestAnimationFrame(renderFrame);
}
function renderFrame(){
 framePending=false;
 if(document.hidden)return;
 const moving=controls.update();
 renderer.render(scene,camera);
 frames++;maxCalls=Math.max(maxCalls,renderer.info.render.calls);
 const now=performance.now();
 if(now-lastSample>=250){
   performanceTag.textContent=`${Math.round(frames*1000/(now-lastSample))} FPS · ${maxCalls} выз. · ${renderer.info.memory.textures} текстур GPU`;
   frames=0;maxCalls=0;lastSample=now;
 }
 if(moving){clearTimeout(quietTimer);wasMoving=true;invalidate();}
 else if(wasMoving){
   wasMoving=false;clearTimeout(quietTimer);
   quietTimer=setTimeout(()=>{
     frames=0;lastSample=performance.now();
     performanceTag.textContent=`Покой · ${renderer.info.render.calls} выз. · ${renderer.info.memory.textures} текстур GPU`;
   },500);
 }
 else performanceTag.textContent=`Покой · ${renderer.info.render.calls} выз. · ${renderer.info.memory.textures} текстур GPU`;
}
controls.addEventListener('change',invalidate);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)invalidate()});
new ResizeObserver(invalidate).observe(document.getElementById('stage'));
invalidate();
