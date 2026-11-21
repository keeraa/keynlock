// @ts-check
import { getPaintingLore, getPaintingLoreLabels } from './lore/painting-lore.js';

/** One presenter for gallery overview, auto-selected artwork and zoomed artwork. */
export function createWallArtworkInfo({ $ }) {
  function show(art, showingDemo) {
    $('wall-gallery-title').textContent = art.title;
    $('wall-gallery-caption').textContent =
      `${art.columnLabel} · ${art.artist} · ${art.year}${showingDemo ? ' · демо' : ''}`;
    const lore = getPaintingLore(art.id);
    const labels = getPaintingLoreLabels();
    $('wall-art-description').textContent = lore?.description || '';
    $('wall-art-ban-label').textContent = labels.banned;
    $('wall-art-ban-reason').textContent = lore?.banReason || '';
    $('wall-art-policy').textContent = labels.policy;
    $('wall-art-lore').hidden = false;
  }

  function showOverview(showingDemo, hasWallArt) {
    $('wall-gallery-title').textContent = 'Стена восстановленных картин';
    $('wall-gallery-caption').textContent = showingDemo
      ? '12 вертикальных колонок · 30 случайных работ · листайте влево и вправо'
      : hasWallArt ? '12 направлений · листайте колонки и выбирайте картину'
        : '12 тематических колонок ждут ваших отреставрированных картин';
    $('wall-art-lore').hidden = true;
  }

  return { show, showOverview };
}
