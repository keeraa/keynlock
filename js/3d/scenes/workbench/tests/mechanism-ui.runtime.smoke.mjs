// Run the real UI initializer against a minimal DOM. Static code checks alone
// missed a forEach callback accidentally passing an array index as a parent.
import assert from 'node:assert/strict';
import {createMechanismUI} from '../public/js/mechanism-ui.js';

function element(tag='div'){
  const children=[];
  const callbacks=new Map();
  const node={tagName:tag.toUpperCase(),children,dataset:{},style:{},hidden:false,
    classList:{add(){},remove(){},toggle(){}},
    addEventListener(name,fn){callbacks.set(name,[...(callbacks.get(name)||[]),fn]);},
    removeEventListener(name,fn){callbacks.set(name,(callbacks.get(name)||[]).filter(item=>item!==fn));},
    click(){for(const fn of callbacks.get('click')||[])fn({target:node});},
    setAttribute(){},removeAttribute(){},
    appendChild(child){if(!child||typeof child!=='object')throw new Error('Invalid parent for UI control');
      children.push(child);child.parentElement=node;return child;},
    append(...items){for(const item of items)node.appendChild(item);},
    replaceChildren(...items){children.length=0;node.append(...items);},
    remove(){},getBoundingClientRect(){return {left:0,top:0,right:300,bottom:700,width:300,height:700};},
    querySelectorAll(selector){
      const all=[];const visit=current=>{for(const child of current.children){all.push(child);visit(child);}};
      visit(node);
      if(selector==='[data-mech-preset]')return all.filter(child=>child.dataset.mechPreset);
      return [];
    },querySelector(){return null},getContext(){return null},
    textContent:'',innerHTML:''};
  return node;
}
const elements=new Map();
const get=id=>{if(!elements.has(id))elements.set(id,element());return elements.get(id);};
const catalog=element('aside');catalog.appendChild(get('mechPalette'));
const buildMode=element('button'),attackMode=element('button');
buildMode.dataset.mechMode='build';attackMode.dataset.mechMode='attack';
globalThis.document={getElementById:get,createElement:element,
  querySelectorAll:selector=>selector==='[data-mech-mode]'?[buildMode,attackMode]:[]};
globalThis.window={devicePixelRatio:1,addEventListener(){},removeEventListener(){}};
globalThis.localStorage={getItem:()=>null,setItem(){}};
globalThis.requestAnimationFrame=()=>1;
globalThis.cancelAnimationFrame=()=>{};
const previousError=console.error;let threeError=false;
console.error=(heading)=>{if(String(heading).includes('3D mechanism scene'))threeError=true;};
try{
  const ui=createMechanismUI();
  const palette=get('mechPalette');
  assert.equal(get('mechPresetList').children.length,4,'all four examples should initialize');
  assert.equal(palette.children.filter(child=>child.dataset.partType).length,3,
    'three core thumbnail buttons must attach to the actual DOM parent');
  const more=palette.children.find(child=>child.className==='mech-advanced');
  assert.ok(more,'advanced controls are optional');
  assert.equal(more.children[1].children.length,6,'six optional parts can be revealed');
  ui.open();assert.equal(get('mechanismWorkspace').hidden,false,'sandbox can open');
  attackMode.click();
  assert.equal(get('mechAttackControls').hidden,false,'attack mode appears without runtime exceptions');
  assert.equal(get('mechPinChoices').children.length,5,'all five shifters are selectable at once');
  assert.equal(get('mechWrenchChoices').children.length,5,'the five original tension tools are available');
  assert.match(get('mechWrenchLabel').textContent,/не выбрана/,'wrench choice is an explicit stage');
  get('mechWrenchChoices').children[4].click();
  assert.equal(get('mechWrenchLabel').textContent,'Прямой тонкий','tool selection updates immediately');
  get('mechTension').click();
  assert.match(get('mechFitStatus').textContent,/Не входит/,'mismatched curve hits the guide');
  assert.doesNotMatch(get('mechTensionLabel').textContent,/вставлен/,'wrong tool cannot engage');
  get('mechPickStroke').click();
  assert.doesNotMatch(get('mechPinChoices').children[0].className,/set/,
    'a rejected wrench cannot hold a picked pin');
  get('mechWrenchChoices').children[2].click();
  get('mechTension').click();
  assert.match(get('mechTensionLabel').textContent,/вставлен/);
  get('mechPickStroke').click();get('mechPickStroke').click();
  assert.match(get('mechPinChoices').children[0].className,/set/,
    'two deliberate strokes set the first pin through the real simulation');
  get('mechResetAttack').click();
  assert.doesNotMatch(get('mechPinChoices').children[0].className,/set/,
    'reset physically releases the pinned state');
  ui.close();ui.dispose();
  assert.equal(threeError,true,'only WebGL should fail in this no-renderer harness');
}finally{console.error=previousError;}
console.log('Sandbox UI initializes all controls and opens: OK');
