import test from 'node:test';
import assert from 'node:assert/strict';
import {createPaintingInspector} from '../src/ui/painting-inspector.js';

for(const [code,key]of [['Escape','Escape'],['KeyF','а']])test('inspector consumes '+code+' and returns directly to play',t=>{
 const previous=[globalThis.document,globalThis.Image];
 class Element extends EventTarget{
  constructor(){super();this.classList={toggle(){}};this.open=false;}
  setAttribute(){}removeAttribute(){this.removed=true;}scrollTo(){}
  showModal(){this.open=true;}
  close(){this.open=false;this.dispatchEvent(new Event('close'));}
 }
 const doc=new EventTarget(),nodes=new Map(),modes=[];
 globalThis.document=doc;globalThis.Image=class{};
 t.after(()=>{[globalThis.document,globalThis.Image]=previous;});
 const elements=id=>{if(!nodes.has(id))nodes.set(id,new Element());return nodes.get(id);};
 const inspector=createPaintingInspector({elements,catalog:{imageUrl:()=>'/preview',detailUrl:()=>'/detail'},setMode:mode=>modes.push(mode)});
 t.after(()=>inspector.dispose());
 const painting={id:'test',title:'Test',image:{}};
 inspector.open(painting);assert.equal(elements('art-inspector').open,true);
 let leaked=0;doc.addEventListener('keydown',()=>leaked++);
 const event=Object.assign(new Event('keydown',{cancelable:true}),{code,key});doc.dispatchEvent(event);
 assert.equal(event.defaultPrevented,true);assert.equal(leaked,0);
 assert.deepEqual(modes,['pause','play']);assert.equal(elements('art-inspector').open,false);
 assert.equal(elements('inspect-image').removed,true);
 inspector.open(painting);
 const cancel=new Event('cancel',{cancelable:true});elements('art-inspector').dispatchEvent(cancel);
 assert.equal(cancel.defaultPrevented,true);assert.deepEqual(modes,['pause','play','pause','play']);
});
