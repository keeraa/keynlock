import test from 'node:test';
import assert from 'node:assert/strict';
import { getWorkshopApi, getWorkshopHost, publishWorkshopApi, setWorkshopHost } from './workshop-host.js';

test('a workshop finds no host on its own site, and the Lair host once it is set', () => {
  assert.equal(getWorkshopHost(), null);
  const host = setWorkshopHost({ atelier: {}, alchemy: {} });
  assert.equal(getWorkshopHost(), host);
  // Members added later (when a view is created) are seen by the workshop.
  host.atelier.focusEasels = () => 'easels';
  assert.equal(getWorkshopHost().atelier.focusEasels(), 'easels');
});

test('a workshop API is null until published, and parts published separately merge', () => {
  assert.equal(getWorkshopApi('restoration'), null);
  const gallery = { open() {} };
  const bridge = { isReady: () => true };
  publishWorkshopApi('restoration', { gallery });
  publishWorkshopApi('restoration', { bridge });
  assert.equal(getWorkshopApi('restoration').gallery, gallery);
  assert.equal(getWorkshopApi('restoration').bridge, bridge);
  assert.equal(getWorkshopApi('alchemy'), null);
});
