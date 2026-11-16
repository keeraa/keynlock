import test from 'node:test';
import assert from 'node:assert/strict';
import { createMechanismHandle, createMechanismRegistry } from '../src/js/mechanisms/registry.js';

test('mechanism registry activates a single group and updates only that mechanism', () => {
  const history = [];
  const names = ['pin', 'disc', 'code'];
  const handles = Object.fromEntries(names.map(name => [name, createMechanismHandle({
    name, model: { kind: name }, group: { visible: false },
    update: frame => history.push(`${name}:${frame}`),
    reset: () => history.push(`${name}:reset`),
    dispose: () => history.push(`${name}:dispose`),
  })]));
  const registry = createMechanismRegistry(handles);
  assert.deepEqual(registry.get('pin').create(), { kind: 'pin' });
  registry.activate('pin');
  registry.update(1);
  registry.activate('disc');
  registry.update(2);
  registry.activate('code');
  registry.update(3);
  registry.reset();
  assert.deepEqual(history, ['pin:1', 'disc:2', 'code:3', 'code:reset']);
  assert.deepEqual(names.map(name => handles[name].group.visible), [false, false, true]);
  assert.equal(registry.activeMode, 'code');
  assert.throws(() => registry.activate('unknown'), /Unknown lock mechanism/);
  assert.equal(registry.activeMode, 'code');
  registry.dispose();
  registry.dispose();
  registry.update(4);
  assert.deepEqual(history.slice(-3), ['pin:dispose', 'disc:dispose', 'code:dispose']);
  assert.ok(names.every(name => handles[name].disposed));
});

test('mechanism handle verifies required update lifecycle', () => {
  assert.throws(() => createMechanismHandle({ name: 'pin', group: {} }), /requires/);
  assert.throws(() => createMechanismRegistry({ pin: createMechanismHandle({
    name: 'code', group: {}, update() {},
  }) }), /mismatch/);
});
