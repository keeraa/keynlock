import * as THREE from '../vendor/three.js';
import { ARCHIVE_LEDGER, ARCHIVE_LEDGER_URL } from './archive-ledger.js?v=key-catalog';
import { createKeyFallbackStamp } from './key-factory.js?v=key-ring';
import { KEY_TYPES } from './rules.js?v=key-ring';
import { familyName, t } from './i18n.js';

function projectBook(camera, canvas) {
  camera.updateMatrixWorld();
  const rect = canvas.getBoundingClientRect();
  const { x, y, z, yaw, width, depth } = ARCHIVE_LEDGER;
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const corners = [[-.5, -.5], [.5, -.5], [.5, .5], [-.5, .5]];
  const points = corners.map(([col, row]) => {
    const u = col * width, v = row * depth;
    const point = new THREE.Vector3(x + c * u + s * v, y + .05, z - s * u + c * v);
    if (point.clone().applyMatrix4(camera.matrixWorldInverse).z > -.06) return null;
    point.project(camera);
    return [rect.left + (1 + point.x) * rect.width / 2,
      rect.top + (1 - point.y) * rect.height / 2];
  });
  return points.every(Boolean) ? points : null;
}

// Project the lifting sheet onto the four corners of the world-space book.
function bookTransform(points, width, height) {
  if (!points) return null;
  const [[x0,y0],[x1,y1],[x2,y2],[x3,y3]] = points;
  const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
  const determinant = dx1 * dy2 - dx2 * dy1;
  if (Math.abs(determinant) < .01) return null;
  const g = (dx3 * dy2 - dx2 * dy3) / determinant;
  const h = (dx1 * dy3 - dx3 * dy1) / determinant;
  return `matrix3d(${(x1 - x0 + g * x1) / width},${(y1 - y0 + g * y1) / width},0,${g / width},
    ${(x3 - x0 + h * x3) / height},${(y3 - y0 + h * y3) / height},0,${h / height},
    0,0,1,0,${x0},${y0},0,1)`;
}

export function createArchiveKeyCatalog(document, world, canvas, onClose) {
  const $ = id => document.getElementById(id);
  const dialog = $('archive-key-catalog');
  const spread = $('catalog-spread');
  const previous = $('catalog-previous'), next = $('catalog-next'), closeButton = $('catalog-close');
  const meter = $('catalog-page-number');
  const flight = $('catalog-flight');
  flight.src = ARCHIVE_LEDGER_URL;
  const images = new Map();
  const pageCount = Math.ceil(KEY_TYPES.length / 2);
  let page = 0;
  let moving = false;

  function paint() {
    spread.replaceChildren();
    const start = page * 2;
    for (let type = start; type < Math.min(start + 2, KEY_TYPES.length); type++) {
      const article = document.createElement('article');
      const picture = document.createElement('img');
      const name = document.createElement('h3');
      const key = { id: `catalog-${type}`, type };
      if (!images.has(type)) {
        let url;
        try { url = world.captureKeyThumbnail?.(key); }
        catch { /* The Canvas stamp also works if WebGL loses its context. */ }
        url ||= createKeyFallbackStamp(type, false)?.toDataURL('image/png');
        if (url) images.set(type, url);
      }
      const url = images.get(type);
      if (url) picture.src = url;
      picture.alt = '';
      name.textContent = familyName(type);
      article.append(picture, name);
      spread.append(article);
    }
    previous.disabled = page === 0;
    next.disabled = page === pageCount - 1;
    meter.textContent = t('catalog.page', { current: page + 1, total: pageCount });
  }

  function turn(offset) {
    const target = page + offset;
    if (moving || target < 0 || target >= pageCount) return;
    page = target;
    paint();
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      spread.animate([{ opacity: .58, transform: `translateX(${Math.sign(offset) * 10}px)` },
        { opacity: 1, transform: 'translateX(0)' }], { duration: 190, easing: 'ease-out' });
    }
    if (document.activeElement === previous && previous.disabled) next.focus();
    if (document.activeElement === next && next.disabled) previous.focus();
  }

  async function animate(toScreen, bookPoints) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const rect = spread.getBoundingClientRect();
    const fromTable = bookTransform(bookPoints, rect.width, rect.height);
    if (!fromTable) return;
    const atScreen = `translate3d(${rect.left}px, ${rect.top}px, 0)`;
    dialog.classList.add('is-lifting');
    flight.style.width = `${rect.width}px`;
    flight.style.height = `${rect.height}px`;
    flight.hidden = false;
    const animation = flight.animate(
      (toScreen ? [fromTable, atScreen] : [atScreen, fromTable]).map(transform => ({ transform })),
      { duration: toScreen ? 500 : 400, easing: 'cubic-bezier(.22,.72,.23,1)', fill: 'both' });
    try { await animation.finished; }
    catch (error) { if (error.name !== 'AbortError') throw error; }
    finally {
      flight.hidden = true;
      animation.cancel();
      dialog.classList.remove('is-lifting');
    }
  }

  async function open() {
    if (dialog.open || moving) return;
    moving = true;
    const points = projectBook(world.camera, canvas);
    paint();
    dialog.showModal();
    world.setLedgerVisible(false);
    await animate(true, points);
    moving = false;
    closeButton.focus({ preventScroll: true });
  }

  async function close() {
    if (!dialog.open || moving) return;
    moving = true;
    await animate(false, projectBook(world.camera, canvas));
    world.setLedgerVisible(true);
    dialog.close();
    moving = false;
    onClose();
  }

  dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
  dialog.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft') { event.preventDefault(); turn(-1); }
    if (event.key === 'ArrowRight') { event.preventDefault(); turn(1); }
  });
  closeButton.addEventListener('click', close);
  previous.addEventListener('click', () => turn(-1));
  next.addEventListener('click', () => turn(1));
  return { open };
}
