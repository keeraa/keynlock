import { chooseDemoWallPaintings } from './wall-demo.js';
import { createWallArtworkInfo } from './wall-artwork-info.js';

const CLOSE_UP_FRAME_FRACTION = .48;

/** Gallery demo, player favorites, toolbar and easel-panel visibility. */
export function createWallExhibitionController({ paintings, playerProgress, wallGallery,
  collectionUI, getNavigation, getWorkshopUI, showToast, $ }) {
  const artById = new Map(paintings.map((art) => [art.id, art]));
  let demoArtworks = chooseDemoWallPaintings(paintings);
  let showingDemo = true;
  let priorWorkbenchVisible = null;
  let viewedId = null;
  let lastAutoPickAt = -Infinity;
  const artworkInfo = createWallArtworkInfo({ $ });

  function updateCounters() {
    const count = playerProgress.getWallIds().length;
    $('wall-count').textContent = showingDemo ? `${demoArtworks.length} ДЕМО` : `${count} / 30`;
    $('wall-select-count').textContent = `${count}/30`;
    $('collection-wall-count').textContent = `${count}/30`;
    $('wall-gallery-demo').textContent = showingDemo ? 'МОИ КАРТИНЫ' : 'ДЕМО · 30';
    $('wall-gallery-demo').setAttribute('aria-pressed', String(showingDemo));
    $('wall-gallery-shuffle').hidden = !showingDemo;
  }

  async function refresh({ onProgress } = {}) {
    const selected = showingDemo ? demoArtworks
      : playerProgress.getWallIds().map((id) => artById.get(id)).filter(Boolean);
    try {
      await wallGallery.setPaintings(selected, { onProgress });
      return true;
    } catch (error) {
      console.error('Не удалось обновить стену картин:', error);
      return false;
    }
  }

  function toggleWall(id) {
    const result = playerProgress.toggleWall(id);
    if (!result.changed && result.reason === 'full') {
      showToast('На стене уже 30 картин. Снимите одну, чтобы повесить другую.');
    }
    if (result.changed) {
      refreshAfterWallChange();
    }
  }

  function refreshAfterWallChange() {
    updateCounters();
    if (!showingDemo) void refresh();
  }

  function onNewRestoration(id) {
    if (playerProgress.autoPin(id)) {
      updateCounters();
      if (!showingDemo) void refresh();
    }
    collectionUI.refresh();
  }

  function updateViewedArtwork(now) {
    const navigation = getNavigation();
    const mode = navigation.mode();
    if ((mode !== 'gallery' && mode !== 'art') || navigation.isTraveling?.()
      || now - lastAutoPickAt < 90) return;
    lastAutoPickAt = now;
    const prominent = navigation.isWallZoomedIn?.()
      ? wallGallery.getProminentPainting(viewedId, { minFrameFraction: CLOSE_UP_FRAME_FRACTION })
      : null;
    if (!prominent) {
      if (viewedId !== null) {
        viewedId = null;
        artworkInfo.showOverview(showingDemo, playerProgress.getWallIds().length > 0);
      }
      return;
    }
    if (prominent.id === viewedId) return;
    viewedId = prominent.id;
    artworkInfo.show(prominent, showingDemo);
    if (mode === 'art') void wallGallery.showHighResolution(prominent.id);
  }

  function handleModeChange({ mode, art }) {
    const active = mode !== 'closed';
    $('wall-gallery-open').hidden = active;
    $('wall-gallery-toolbar').hidden = !active;
    $('wall-gallery-navigation').hidden = !active || mode === 'art';
    $('wall-art-back').hidden = mode !== 'art';
    $('wall-art-hover').hidden = true;
    viewedId = mode === 'art' ? art.id : null;
    lastAutoPickAt = -Infinity;
    if (mode === 'art') {
      artworkInfo.show(art, showingDemo);
    } else {
      artworkInfo.showOverview(showingDemo, playerProgress.getWallIds().length > 0);
    }
    if (mode === 'art') void wallGallery.showHighResolution(art.id);
    else wallGallery.clearFocus();
    const workshopUI = getWorkshopUI();
    if (active && priorWorkbenchVisible === null) {
      priorWorkbenchVisible = workshopUI?.isWorkbenchVisible() ?? true;
      workshopUI?.setWorkbenchVisible(false);
    } else if (!active && priorWorkbenchVisible !== null) {
      workshopUI?.setWorkbenchVisible(priorWorkbenchVisible);
      priorWorkbenchVisible = null;
    }
  }

  function refreshModeHeader() {
    const navigation = getNavigation();
    if (navigation.focusedWallId()) navigation.leaveWallArt();
    updateCounters();
    if (navigation.isWallGallery()) handleModeChange({ mode: 'overview' });
    void refresh();
  }

  function bind() {
    $('wall-gallery-open').addEventListener('click', () => getNavigation().enterWallGallery(wallGallery.getLayout().bounds));
    $('wall-gallery-back').addEventListener('click', () => getNavigation().leaveWallGallery());
    $('wall-gallery-select').addEventListener('click', () => collectionUI.open('wall'));
    $('wall-gallery-demo').addEventListener('click', () => {
      showingDemo = !showingDemo;
      refreshModeHeader();
    });
    $('wall-gallery-shuffle').addEventListener('click', () => {
      demoArtworks = chooseDemoWallPaintings(paintings);
      refreshModeHeader();
    });
    $('wall-art-back').addEventListener('click', () => getNavigation().leaveWallArt());
    $('wall-gallery-next').addEventListener('click', () => getNavigation().moveAlongWall(1));
    $('wall-gallery-prev').addEventListener('click', () => getNavigation().moveAlongWall(-1));
    updateCounters();
  }

  return { bind, refresh, toggleWall, onNewRestoration,
    handleModeChange, updateViewedArtwork, updateCounters, refreshAfterWallChange,
    viewedId: () => viewedId };
}
