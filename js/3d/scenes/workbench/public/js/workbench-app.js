import {createWorkshopScene} from './scene.js';
import {loadWorkbenchState,saveWorkbenchState} from './workbench-state.js';
import {installWorkbenchInput} from './workbench-input.js';
import {createKeyMode} from './modes/key-mode.js';
import {createAssemblyMode} from './modes/assembly-mode.js';
import {createGearsMode} from './modes/gears-mode.js';
import {createMechanismMode} from './modes/mechanism-mode.js';
import {createCodeMode} from './modes/code-mode.js';

let keyboardOwner=null;

// Scoped controller; mounting does not modify the surrounding scene.
export function createWorkbenchApp({root=document.querySelector('main.app')}={}){
  if(!root)throw new Error('KEYNLOCK: missing workbench root');
  const $=id=>root.querySelector(`#${id}`);
  const query=selector=>root.querySelectorAll(selector);
  const hostListeners=[];
  const listen=(node,event,handler)=>{node.addEventListener(event,handler);
    hostListeners.push([node,event,handler]);};
  let disposed=false,foreground=true;
  const embedded=Boolean(root.getRootNode?.()?.host);
  const isKeyboardActive=()=>foreground&&(!embedded||keyboardOwner===root);
  if(embedded){
    keyboardOwner=root;
    listen(root,'pointerdown',()=>{keyboardOwner=root;});
    listen(root,'focusin',()=>{keyboardOwner=root;});
    listen(document,'pointerdown',event=>{
      if(keyboardOwner===root&&!event.composedPath?.().includes(root))keyboardOwner=null;
    });
  }
const canvas=$('scene');
const state=loadWorkbenchState();
state.assemblyVariant='extended';
let scene;
let hasWebGL=true;
try{scene=createWorkshopScene(canvas);}catch(error){
  console.error(error);
  hasWebGL=false;
  // A construction error is different from missing WebGL support.
  const unsupported=/(WebGL|WebGL2|webgl context|Failed to create renderer)/i.test(String(error?.message||error));
  const diagnostic=unsupported?'Для 3D-сцен требуется поддержка WebGL.':
    'Ошибка запуска 3D-мастерской. Мы уже фиксируем проблему.';
  const noop=()=>{};
  scene=new Proxy({}, {get:(_target,key)=>key==='getFps'||key==='getPolygons'?()=>0:
    key==='filingContact'?()=>-1:key==='hitTest'?()=>null:noop});
  $('sceneDescription').textContent=diagnostic;
  $('keyFeedback').textContent=diagnostic;
  query('[data-mode="key"],[data-mode="assembly"]').forEach(button=>{
    button.disabled=true;button.title=diagnostic;});
}
function updateVisualOptions(){
  scene.setVisualOptions?.({outline:$('visualOutline').checked,
    outlineStrength:Number($('visualOutlineStrength').value),
    outlineWidth:Number($('visualOutlineWidth').value),
    toon:$('visualToon').checked,toonStrength:.55});
}
for(const id of ['visualOutline','visualOutlineStrength','visualOutlineWidth','visualToon']){
  listen($(id),'input',updateVisualOptions);
}
updateVisualOptions();
const assemblyCameraFixed=$('assemblyCameraFixed');
assemblyCameraFixed.checked=state.assemblyCameraLocked;
scene.setAssemblyCameraLocked?.(state.assemblyCameraLocked);
listen(assemblyCameraFixed,'change',()=>{
  state.assemblyCameraLocked=assemblyCameraFixed.checked;
  scene.setAssemblyCameraLocked?.(state.assemblyCameraLocked);
  save();
});
scene.setBlueprint(state.targets);scene.setCuts(state.cuts);
scene.setWear(state.wear);
scene.setKeyMethod(state.keyMethod);
scene.setAssemblyDesign(state.assemblyVariant,state.freeDesign,state.pinOrder);
scene.updateInstalled(state.installed);
const sandbox=createMechanismMode({root,isKeyboardActive});
const codeBox=createCodeMode({canvas:$('codeCanvas'),$,toast,
  isKeyboardActive:()=>isKeyboardActive()&&state.mode==='code'});

let toastTimer;
function toast(message){
  const node=$('toast');node.textContent=message;node.classList.add('show');
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>node.classList.remove('show'),3100);
}
function save(){
  saveWorkbenchState(state);
}
function feedback(id,message,tone=''){
  const el=$(id);el.textContent=message;el.classList.toggle('good',tone==='good');
  el.classList.toggle('bad',tone==='bad');
}

let assemblyMode;
const keyMode=createKeyMode({state,scene,$,query,listen,save,toast,feedback,
  releaseCapture,onAssemblyChange:()=>assemblyMode?.renderAssembly(),onNavigate:setMode});
assemblyMode=createAssemblyMode({scene,$,listen,toast});
const gearsMode=createGearsMode({state,scene,$,listen,toast});
const {measuredCuts,inspectCurrentKey,selectCut,renderCuts}=keyMode;
const {renderAssembly}=assemblyMode;

const modes={
  key:{index:'01 / 05',title:'Изготовление ключа',description:keyMode.getDescription,
    enter(){},leave(){}},
  assembly:{index:'02 / 05',title:'Сборка штифтового механизма',
    description:assemblyMode.getDescription,enter(){},leave(){}},
  gears:{index:'03 / 05',title:'Шестерёнчатый замок',
    description:gearsMode.getDescription,enter:gearsMode.enter,leave:gearsMode.leave},
  mechanism:{index:'04 / 05',title:'Песочница механизмов',
    description:()=>
      'Трёхмерный разрез замка: взаимосвязанные механизмы, ключ, стопоры и проверка взлома.',
    enter:()=>sandbox.open(),leave:()=>sandbox.close()},
  code:{index:'05 / 05',title:'Кодовая шкатулка',
    description:()=>
      'Сверьтесь с шестизначным кодом в меню. Нажимайте стрелки на шкатулке и откройте крышку.',
    enter:()=>codeBox.open(),leave:()=>codeBox.close()}
};

function setMode(mode){
  const next=modes[mode];
  if(!next)throw new RangeError(`Unknown KEYNLOCK workbench mode: ${mode}`);
  if(mode!=='assembly'&&state.heldTool){
    scene.setRagContact?.(false);scene.setWiping?.(false);
    scene.setScrewdriverHeld?.(false);scene.setToolHeld?.(false);
    scene.setOilerHeld?.(false);
    state.heldTool=null;state.wiping=false;
  }
  if(state.filing||state.spaceFiling){state.filing=false;state.spaceFiling=false;
    scene.setFiling(false);save();try{canvas.releasePointerCapture(state.filingPointer);}catch{}}
  modes[state.mode]?.leave();
  state.mode=mode;state.selectedPart=null;state.cameraDragging=false;
  canvas.style.cursor='grab';
  scene.setMode(mode==='mechanism'||mode==='code'||mode==='gears'?'assembly':mode);
  scene.setGearMode?.(mode==='gears');
  scene.setSuspended(!foreground||mode==='mechanism'||mode==='code');
  root.classList.toggle('mechanism-active',mode==='mechanism');
  root.classList.toggle('code-active',mode==='code');
  $('codeWorkspace').hidden=mode!=='code';
  if(foreground)next.enter();
  query('.workspace-tab').forEach(button=>{
    const active=button.dataset.mode===mode;button.classList.toggle('active',active);
    button.setAttribute('aria-pressed',String(active));
  });
  $('keyPanel').hidden=mode!=='key';$('assemblyPanel').hidden=mode!=='assembly';
  $('gearsPanel').hidden=mode!=='gears';
  $('assemblyGuide').hidden=mode!=='assembly';
  $('codePanel').hidden=mode!=='code';
  $('workbenchHint').hidden=mode!=='key';
  $('sceneIndex').textContent=next.index;
  $('sceneTitle').textContent=next.title;
  $('sceneDescription').textContent=next.description();
  if(mode==='assembly')renderAssembly();
}
query('.workspace-tab').forEach(button=>listen(button,'click',()=>setMode(button.dataset.mode)));

function releaseCapture(pointerId){
  try{if(canvas.hasPointerCapture(pointerId))canvas.releasePointerCapture(pointerId);}catch{}
}
const detachControls=installWorkbenchInput({canvas,state,scene,save,toast,measuredCuts,
  inspectCurrentKey,selectCut,renderCuts,releaseCapture,inspectKeyButton:$('inspectKey'),
  onAssemblySelect:hit=>assemblyMode.selectPart(hit),
  onGearChange:gearsMode.render,
  onCameraUnlocked:()=>{
    if(!state.assemblyCameraLocked)return;
    state.assemblyCameraLocked=false;assemblyCameraFixed.checked=false;save();
  },
  isActive:isKeyboardActive});
setMode(hasWebGL?'assembly':'mechanism');
const fpsTimer=setInterval(()=>{
  $('fps').textContent=String(scene.getFps()||'—');
  $('polygons').textContent=scene.getPolygons().toLocaleString('ru-RU');
  if(state.mode==='assembly')renderAssembly();
  if(state.mode==='gears')gearsMode.render();
  const dustiness=scene.getDustiness?.();
  if(Number.isFinite(dustiness)){
    $('dustinessValue').textContent=`${dustiness}%`;
    $('dustinessFill').style.width=`${dustiness}%`;
  }
},850);
function dispose(){
  if(disposed)return;
  disposed=true;
  for(const [node,event,handler] of hostListeners)node.removeEventListener(event,handler);
  clearTimeout(toastTimer);clearInterval(fpsTimer);detachControls();sandbox.dispose();
  codeBox.dispose();scene.dispose();
  if(keyboardOwner===root)keyboardOwner=null;
}
return {root,getMode:()=>state.mode,getState:()=>structuredClone(state),setMode,
  setActive(value){foreground=Boolean(value);
    if(!foreground){state.filing=false;state.spaceFiling=false;scene.setFiling(false);}
    scene.setSuspended(!foreground||state.mode==='mechanism'||state.mode==='code');
    if(!foreground){modes[state.mode].leave();if(keyboardOwner===root)keyboardOwner=null;}
    else {if(embedded)keyboardOwner=root;modes[state.mode].enter();}
  },dispose};
}
