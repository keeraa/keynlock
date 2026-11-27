import test from 'node:test';
import assert from 'node:assert/strict';
import {createHud} from '../src/ui/hud.js';

test('a picture viewer can pause gameplay without showing the pause menu, and the normal menu still opens',t=>{
 const previous=globalThis.document;globalThis.document={body:{}};t.after(()=>{globalThis.document=previous;});
 const nodes=new Map(),elements=id=>{if(!nodes.has(id))nodes.set(id,{});return nodes.get(id);};
 const hud=createHud({elements});t.after(()=>hud.dispose());
 hud.refreshMode('pause',{pauseMenu:false});assert.equal(elements('pause').hidden,true);assert.equal(elements('crosshair').hidden,true);
 hud.refreshMode('play');assert.equal(elements('pause').hidden,true);assert.equal(elements('crosshair').hidden,false);
 hud.refreshMode('pause');assert.equal(elements('pause').hidden,false);
});
