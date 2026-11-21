import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createAlchemyRuntime} from '../../../workshops/alchemy/src/runtime-host.js';

test('embedded alchemy registers the room lifecycle and pauses between visits', () => {
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
  const runtime = createAlchemyRuntime({ THREE, canvas: {}, host });
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
