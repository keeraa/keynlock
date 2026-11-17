import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createAlchemyRuntime} from '../integrations/alchemy/src/runtime-host.js';
import {readFileSync} from 'node:fs';

test('in-room alchemy updates physics at 30 Hz while retaining its live controls',()=>{
  const previousEvent=globalThis.CustomEvent;
  globalThis.CustomEvent=class {constructor(type,{detail}={}){this.type=type;this.detail=detail;}};
  let tick;
  const renderer={setAnimationLoop:fn=>{tick=fn;}};
  const events=[];
  const win={dispatchEvent:event=>events.push(event.type)};
  win.parent=win;
  const host={createRenderer:()=>renderer,registerWorldScene:()=>{}};
  const runtime=createAlchemyRuntime({THREE,canvas:{},win,host});
  let updates=0;
  runtime.start(()=>updates++);
  for(let t=1000;t<1100;t+=10)tick(t);
  assert.ok(updates>=2 && updates<=4,`expected 30 Hz, got ${updates} updates per 100 ms`);
  runtime.setActive(false);
  tick(1150);
  assert.equal(updates<=4,true,'inactive station does not consume simulation frames');
  runtime.dispose();
  globalThis.CustomEvent=previousEvent;
});

test('entering alchemy changes exposure without switching the shared shadow shader',()=>{
  const code=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
  const stationLook=code.slice(code.indexOf('function applyWorldAlchemyLook('),code.indexOf('function leaveGalleryCamera('));
  assert.match(stationLook,/renderer\.toneMappingExposure = ALCHEMY_LOOK\.renderer\.exposure/);
  assert.match(stationLook,/renderer\.shadowMap\.autoUpdate = false/);
  assert.match(stationLook,/light\.visible = !enabled && visible/,
    'alchemy uses its own light rig instead of also evaluating the room lights');
  assert.match(stationLook,/enabled \? 1\.35 : 1\.75/,
    'alchemy lowers retina fill cost without changing the other stations');
  assert.match(code,/rendererHost\.prepareWorldLightsForRender\(\)/);
  assert.match(code,/rendererHost\.restoreWorldLightsAfterRender\(\)/);
  assert.match(code,/originalStations\.open\(id\);\s*if \(id === 'alchemy'\) applyWorldAlchemyLook\(true\)/);
  assert.doesNotMatch(stationLook,/applyAlchemyRendererLook\(/);
});

test('alchemy keeps the Lair camera as the sole visible camera during interactions',()=>{
  const code=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
  assert.match(code,/window\.__keynlockLairManipulateAlchemy =/);
  assert.match(code,/rendererHost\?\.getWorldPose\('alchemy'\)/,
    'station entry should use the original camera pose');
  assert.match(code,/focus\(stationPosition, stationTarget, sourcePose\?\.fov/,
    'the station transition preserves the source camera field of view');
  assert.match(code,/window\.__keynlockLairResetAlchemyCamera =/);
  const source=readFileSync(new URL('../integrations/alchemy/src/alchemy.js',import.meta.url),'utf8');
  assert.match(source,/if \(runtime\.embedded\) window\.__keynlockLairResetAlchemyCamera\?\.\(\)/,
    'the original visual-panel camera reset also resets the visible Lair camera');
  assert.doesNotMatch(code,/alchemyCameraInteracted/);
});
