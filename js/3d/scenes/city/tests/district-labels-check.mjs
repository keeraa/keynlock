import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

// Exercise the DOM-only map UI without requiring Chromium or a WebGL context.
class Vector3 {
  constructor(x=0,y=0,z=0){Object.assign(this,{x,y,z});}
  copy(v){Object.assign(this,{x:v.x,y:v.y,z:v.z});return this;}
  project(){this.x/=100;this.y/=100;this.z=0;return this;}
}
globalThis.TestVector3=Vector3;
const source=readFileSync(resolve('js/district-labels.js'),'utf8')
  .replace("import * as THREE from 'three';","const THREE={Vector3:globalThis.TestVector3};");
const {createDistrictLabels}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));

function element(){
  const handlers=new Map(),attributes=new Map(),classes=new Set();
  return {
    handlers,attributes,classes,style:{},hidden:false,
    addEventListener(name,fn){handlers.set(name,fn);},
    setAttribute(name,value){attributes.set(name,value);},
    classList:{toggle(name,enabled){if(enabled)classes.add(name);else classes.delete(name);}},
    click(){handlers.get('click')?.();},
  };
}
const markerElements=new Map([['old',element()],['arts',element()]]);
const container={...element(),innerHTML:'',
  querySelector(selector){
    const id=selector.match(/data-map-district="([^"]+)"/)?.[1];
    return markerElements.get(id);
  },
};
const toggle=element();
globalThis.document={getElementById:id=>id==='mapLabels'?container:toggle};
const storage=new Map();
globalThis.localStorage={
  getItem:key=>storage.get(key)??null,
  setItem:(key,value)=>storage.set(key,value),
};
const districts=[
  {id:'old',name:'Старый квартал',index:'01',color:'#c44',anchor:[-20,0,0]},
  {id:'arts',name:'Район искусств',index:'03',color:'#db4',anchor:[20,0,0]},
];
const focusEvents=[];
let selectedId='old';
const camera={zoom:1.5};
const labels=createDistrictLabels({
  districts,city:{heightAt:()=>1},camera,canvas:{clientWidth:1000,clientHeight:600},
  onFocus:id=>focusEvents.push(id),getSelectedId:()=>selectedId,
});
assert.equal(markerElements.size,2);
assert.ok(container.innerHTML.includes('Старый квартал'));
assert.equal(toggle.attributes.get('aria-pressed'),'true');
labels.update();
assert.equal(markerElements.get('old').hidden,false);
assert.equal(markerElements.get('old').style.left,'400px');
assert.equal(markerElements.get('arts').style.left,'600px');
assert.ok(markerElements.get('old').classes.has('selected'));
markerElements.get('arts').click();
assert.deepEqual(focusEvents,['arts'],'Marker click must focus exactly once');

toggle.click();
assert.equal(container.hidden,true);
assert.equal(storage.get('keynlock.world.labels.v1'),'false');
toggle.click();
assert.equal(container.hidden,false);
selectedId='arts';
camera.zoom=2.65;
labels.update();
assert.equal(markerElements.get('old').hidden,true);
assert.equal(markerElements.get('arts').hidden,false);
assert.ok(markerElements.get('arts').classes.has('selected'));
console.log('District labels: 2 projected, focus click, persistent toggle and zoom visibility');
