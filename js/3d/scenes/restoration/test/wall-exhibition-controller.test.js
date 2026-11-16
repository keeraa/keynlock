import test from 'node:test';
import assert from 'node:assert/strict';
import { createWallExhibitionController } from '../src/wall-exhibition-controller.js';

test('gallery shows the most prominent painting description and ban without any click', () => {
  const nodes = new Map();
  const $ = (id) => {
    if (!nodes.has(id)) nodes.set(id, {
      hidden: false, textContent: '', setAttribute() {}, addEventListener() {},
    });
    return nodes.get(id);
  };
  let mode = 'gallery';
  let traveling = false;
  let prominent = { id: 'dano-day', title: 'Праздник Дано', artist: 'Син Юн Бок',
    year: 'конец XVIII века', columnLabel: 'Корея' };
  let focusedLoads = 0;
  const wallGallery = {
    getProminentPainting: () => prominent,
    showHighResolution: () => { focusedLoads++; },
    clearFocus() {},
  };
  const exhibition = createWallExhibitionController({ paintings: [],
    playerProgress: { getWallIds: () => [] }, wallGallery,
    collectionUI: {}, getNavigation: () => ({ mode: () => mode, isTraveling: () => traveling }),
    getWorkshopUI: () => ({ isWorkbenchVisible: () => true, setWorkbenchVisible() {} }),
    showToast() {}, $ });

  exhibition.handleModeChange({ mode: 'overview' });
  assert.equal($('wall-art-lore').hidden, true);
  exhibition.updateViewedArtwork(100);
  assert.equal($('wall-gallery-title').textContent, 'Праздник Дано');
  assert.equal($('wall-art-lore').hidden, false);
  assert.match($('wall-art-description').textContent, /весенний праздник/);
  assert.match($('wall-art-ban-reason').textContent, /подглядывания/);
  assert.equal(focusedLoads, 0, 'camera-driven descriptions do not open the zoom mode');

  prominent = { id: 'dream-flight-bee', title: 'Сон, вызванный полётом пчелы',
    artist: 'Сальвадор Дали', year: '1944', columnLabel: 'Сюрреализм' };
  exhibition.updateViewedArtwork(200);
  assert.equal($('wall-gallery-title').textContent, prominent.title);
  assert.match($('wall-art-ban-reason').textContent, /эротики/);

  mode = 'art';
  exhibition.handleModeChange({ mode: 'art', art: prominent });
  assert.equal(focusedLoads, 1, 'clicking still opens full artwork focus');

  traveling = true;
  prominent = { id: 'night-watch', title: 'Ночной дозор', artist: 'Рембрандт',
    year: '1642', columnLabel: 'Голландская живопись' };
  exhibition.updateViewedArtwork(300);
  assert.equal($('wall-gallery-title').textContent, 'Сон, вызванный полётом пчелы',
    'the clicked artwork remains described during the camera flight');

  traveling = false;
  exhibition.updateViewedArtwork(400);
  assert.equal($('wall-gallery-title').textContent, 'Ночной дозор',
    'looking at a different artwork updates the description even after a click');
});
