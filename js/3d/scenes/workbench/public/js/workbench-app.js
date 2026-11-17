import {createWorkshopScene} from './scene.js';
import {loadWorkbenchState,saveWorkbenchState} from './workbench-state.js';
import {installWorkbenchInput} from './workbench-input.js';
import {createKeyMode} from './modes/key-mode.js';
import {createAssemblyMode} from './modes/assembly-mode.js';
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
let scene;
let hasWebGL=true;
try{scene=createWorkshopScene(canvas);}catch(error){
  console.error(error);
  hasWebGL=false;
  // The free-form lock is another WebGL scene. Show a clear diagnostic if the
  // device cannot create either renderer.
  const noop=()=>{};
  scene=new Proxy({}, {get:(_target,key)=>key==='getFps'||key==='getPolygons'?()=>0:
    key==='filingContact'?()=>-1:key==='hitTest'?()=>null:noop});
  $('sceneDescription').textContent='Для трёхмерной мастерской и механизмов требуется WebGL.';
  $('keyFeedback').textContent='Браузер не поддерживает запуск этой 3D-сцены.';
  query('[data-mode="key"],[data-mode="assembly"]').forEach(button=>{
    button.disabled=true;button.title='Для 3D-сцен требуется WebGL2';});
}
scene.setBlueprint(state.targets);scene.setCuts(state.cuts);
scene.setWear(state.wear);
scene.setKeyMethod(state.keyMethod);
scene.setAssemblyDesign(state.assemblyVariant,state.freeDesign);
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
assemblyMode=createAssemblyMode({state,scene,keyMode,$,query,listen,save,toast,feedback,
  onCutDesignKey:()=>keyMode.prepareDesignKey()});
const {measuredCuts,inspectCurrentKey,selectCut,renderCuts}=keyMode;
const {renderAssembly,renderSelection,removePart,placement,testMechanism}=assemblyMode;

const modes={
  key:{index:'01 / 04',title:'Изготовление ключа',description:keyMode.getDescription,
    enter(){},leave(){}},
  assembly:{index:'02 / 04',title:'Сборка штифтового механизма',
    description:assemblyMode.getDescription,enter(){},leave(){}},
  mechanism:{index:'03 / 04',title:'Песочница механизмов',
    description:()=>
      'Трёхмерный разрез замка: взаимосвязанные механизмы, ключ, стопоры и проверка взлома.',
    enter:()=>sandbox.open(),leave:()=>sandbox.close()},
  code:{index:'04 / 04',title:'Кодовая шкатулка',
    description:()=>
      'Сверьтесь с шестизначным кодом в меню. Нажимайте стрелки на шкатулке и откройте крышку.',
    enter:()=>codeBox.open(),leave:()=>codeBox.close()}
};

function setMode(mode){
  const next=modes[mode];
  if(!next)throw new RangeError(`Unknown KEYNLOCK workbench mode: ${mode}`);
  if(state.filing||state.spaceFiling){state.filing=false;state.spaceFiling=false;
    scene.setFiling(false);save();try{canvas.releasePointerCapture(state.filingPointer);}catch{}}
  if(state.drag){state.drag=null;scene.updateInstalled(state.installed);}
  modes[state.mode]?.leave();
  state.mode=mode;state.selectedPart=null;state.cameraDragging=false;
  scene.setMode(mode==='mechanism'||mode==='code'?'assembly':mode);
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
  inspectCurrentKey,selectCut,renderCuts,renderSelection,removePart,placement,
  testMechanism,releaseCapture,inspectKeyButton:$('inspectKey'),isActive:isKeyboardActive});
setMode(hasWebGL?'key':'mechanism');
const fpsTimer=setInterval(()=>{
  $('fps').textContent=String(scene.getFps()||'—');
  $('polygons').textContent=scene.getPolygons().toLocaleString('ru-RU');
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
