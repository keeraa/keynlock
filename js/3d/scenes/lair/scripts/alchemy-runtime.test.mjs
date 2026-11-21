import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createAlchemyRuntime} from '../integrations/alchemy/src/runtime-host.js';
import {readFileSync} from 'node:fs';

test('embedded alchemy registers the room lifecycle and pauses between visits', () => {
  const win = new EventTarget();
  win.parent = win;
  const calls = [];
  let workshop;
  const host = {
    createRenderer: () => ({
      setAnimationLoop: callback => assert.equal(callback, null, 'the room owns the frame loop'),
    }),
    registerWorldWorkshop(id, lifecycle, options) {
      assert.equal(id, 'alchemy');
      assert.equal(options.interval, 25);
      workshop = lifecycle;
      return () => calls.push('unregister');
    },
  };
  const runtime = createAlchemyRuntime({ THREE, canvas: {}, win, host });
  runtime.setActive(false);
  runtime.start(() => calls.push('update'), {
    enter: () => calls.push('enter'),
    exit: () => calls.push('exit'),
  });
  workshop.update();
  workshop.enter();
  workshop.update();
  workshop.exit();
  workshop.update();
  runtime.dispose();
  assert.deepEqual(calls, ['enter', 'update', 'exit', 'unregister']);
});

test('entering alchemy changes exposure without switching the shared shadow shader',()=>{
  const code=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
  const transitions = readFileSync(new URL('../src/zone-transitions.js', import.meta.url), 'utf8');
  const stationLook = transitions.slice(transitions.indexOf('function applyWorldAlchemyLook('),
    transitions.indexOf('function setInRoomWorkshop('));
  assert.match(stationLook,/renderer\.toneMappingExposure = ALCHEMY_LOOK\.renderer\.exposure/);
  assert.match(stationLook,/renderer\.shadowMap\.autoUpdate = false/);
  assert.match(stationLook,/light\.visible = !enabled && visible/,
    'alchemy uses its own light rig instead of also evaluating the room lights');
  assert.match(stationLook,/enabled \? 1\.35 : 1\.75/,
    'alchemy lowers retina fill cost without changing the other stations');
  assert.match(code,/rendererHost\.prepareWorldLightsForRender\(\)/);
  assert.match(code,/rendererHost\.restoreWorldLightsAfterRender\(\)/);
  assert.match(transitions,/setInRoomWorkshop\(pendingStationOpen\)/);
  assert.match(transitions,/applyWorldAlchemyLook\(id === 'alchemy' && ready\)/);
  assert.doesNotMatch(stationLook,/applyAlchemyRendererLook\(/);
});

test('alchemy keeps the Lair camera as the sole visible camera during interactions',()=>{
  const code=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
  const transitions = readFileSync(new URL('../src/zone-transitions.js', import.meta.url), 'utf8');
  assert.match(code,/window\.__keynlockLairManipulateAlchemy =/);
  assert.match(transitions,/rendererHost\.getWorldPose\('alchemy'\)/,
    'station entry should use the original camera pose');
  assert.match(transitions,/focus\(stationPosition, stationTarget, sourcePose\?\.fov/,
    'the station transition preserves the source camera field of view');
  assert.match(code,/window\.__keynlockLairResetAlchemyCamera =/);
  const source=readFileSync(new URL('../integrations/alchemy/src/alchemy.js',import.meta.url),'utf8');
  assert.match(source,/if \(runtime\.embedded\) window\.__keynlockLairResetAlchemyCamera\?\.\(\)/,
    'the original visual-panel camera reset also resets the visible Lair camera');
  assert.doesNotMatch(code,/alchemyCameraInteracted/);
});
