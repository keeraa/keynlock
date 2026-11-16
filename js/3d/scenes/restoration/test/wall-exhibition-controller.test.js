import test from 'node:test';
import assert from 'node:assert/strict';
import { createWallExhibitionController } from '../src/wall-exhibition-controller.js';

test('gallery shows general info until a particular painting is zoomed in', () => {
  const nodes = new Map();
  const $ = (id) => {
    if (!nodes.has(id)) nodes.set(id, {
      hidden: false, textContent: '', setAttribute() {}, addEventListener() {},
    });
    return nodes.get(id);
  };
  let mode = 'gallery';
  let traveling = false;
  let zoomedIn = false;
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
    collectionUI: {}, getNavigation: () => ({ mode: () => mode,
      isTraveling: () => traveling, isWallZoomedIn: () => zoomedIn }),
    getWorkshopUI: () => ({ isWorkbenchVisible: () => true, setWorkbenchVisible() {} }),
    showToast() {}, $ });

  exhibition.handleModeChange({ mode: 'overview' });
  assert.equal($('wall-art-lore').hidden, true);
  exhibition.updateViewedArtwork(100);
  assert.equal($('wall-gallery-title').textContent, 'Стена восстановленных картин',
    'a centered painting on the overview must not replace the general heading');
  assert.equal($('wall-art-lore').hidden, true);

  zoomedIn = true;
  exhibition.updateViewedArtwork(200);
  assert.equal($('wall-gallery-title').textContent, 'Праздник Дано');
  assert.equal($('wall-art-lore').hidden, false);
  assert.match($('wall-art-description').textContent, /весенний праздник/);
  assert.match($('wall-art-ban-reason').textContent, /подглядывания/);
  assert.equal(focusedLoads, 0, 'camera-driven descriptions do not open the zoom mode');

  prominent = { id: 'dream-flight-bee', title: 'Сон, вызванный полётом пчелы',
    artist: 'Сальвадор Дали', year: '1944', columnLabel: 'Сюрреализм' };
  exhibition.updateViewedArtwork(300);
  assert.equal($('wall-gallery-title').textContent, prominent.title);
  assert.match($('wall-art-ban-reason').textContent, /эротики/);

  zoomedIn = false;
  exhibition.updateViewedArtwork(400);
  assert.equal($('wall-gallery-title').textContent, 'Стена восстановленных картин');
  assert.equal($('wall-art-lore').hidden, true,
    'zooming back out restores the general heading and hides the ban plaque');

  mode = 'art';
  exhibition.handleModeChange({ mode: 'art', art: prominent });
  assert.equal(focusedLoads, 1, 'clicking still opens full artwork focus');

  zoomedIn = true;
  traveling = true;
  prominent = { id: 'night-watch', title: 'Ночной дозор', artist: 'Рембрандт',
    year: '1642', columnLabel: 'Голландская живопись' };
  exhibition.updateViewedArtwork(500);
  assert.equal($('wall-gallery-title').textContent, 'Сон, вызванный полётом пчелы',
    'the clicked artwork remains described during the camera flight');

  traveling = false;
  exhibition.updateViewedArtwork(600);
  assert.equal($('wall-gallery-title').textContent, 'Ночной дозор',
    'looking at a different artwork updates the description even after a click');

  zoomedIn = false;
  exhibition.updateViewedArtwork(700);
  assert.equal($('wall-gallery-title').textContent, 'Стена восстановленных картин',
    'returning to the wall overview clears an earlier clicked artwork too');
  assert.equal($('wall-art-lore').hidden, true);
});
