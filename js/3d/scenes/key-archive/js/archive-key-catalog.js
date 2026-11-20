import * as THREE from '../vendor/three.js';
import { ARCHIVE_LEDGER, ARCHIVE_LEDGER_URL } from './archive-ledger.js?v=key-catalog';
import { KEY_TYPES } from './rules.js?v=key-ring';
import { familyName, t } from './i18n.js?v=catalog-spread';

const KEYS_PER_SPREAD = 8;
const ease = t => t * t * t * (t * (t * 6 - 15) + 10);

function bookFlight(camera, canvas, rect) {
  camera.updateMatrixWorld();
  const view = canvas.getBoundingClientRect();
  const { x, y, z, yaw, width, depth } = ARCHIVE_LEDGER;
  const centerOnTable = new THREE.Vector3(x, y + .05, z).applyMatrix4(camera.matrixWorldInverse);
  const worldToEye = camera.getWorldQuaternion(new THREE.Quaternion()).invert();
  const flatOnTable = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, yaw, 0, 'YXZ'));
  flatOnTable.premultiply(worldToEye);
  const focusX = camera.projectionMatrix.elements[0] * view.width / 2;
  const focusY = camera.projectionMatrix.elements[5] * view.height / 2;
  const distance = width * focusX / rect.width;
  const centerAtScreen = new THREE.Vector3(
    (rect.left + rect.width / 2 - view.left - view.width / 2) * distance / focusX,
    (view.top + view.height / 2 - rect.top - rect.height / 2) * distance / focusY,
    -distance,
  );
  const upright = new THREE.Quaternion();
  const lift = new THREE.Vector3(0, .23, 0).applyQuaternion(worldToEye);
  const center = new THREE.Vector3();
  const angle = new THREE.Quaternion();
  const point = new THREE.Vector3();
  const corners = [[-.5, .5], [.5, .5], [.5, -.5], [-.5, -.5]];
  return progress => {
    // Move one rigid plane. Reproject after rotating it so perspective never
    // interpolates independently from the book's position.
    const travel = ease(progress);
    center.lerpVectors(centerOnTable, centerAtScreen, travel)
      .addScaledVector(lift, Math.sin(progress * Math.PI));
    angle.copy(flatOnTable).slerp(upright, ease(Math.min(1, progress / .92)));
    const points = corners.map(([col, row]) => {
      point.set(col * width, row * depth, 0).applyQuaternion(angle).add(center);
      if (point.z > -.06) return null;
      point.applyMatrix4(camera.projectionMatrix);
      return [view.left + (1 + point.x) * view.width / 2, view.top + (1 - point.y) * view.height / 2];
    });
    return points.every(Boolean) ? bookTransform(points, rect.width, rect.height) : null;
  };
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

export function createArchiveKeyCatalog(document, world, canvas, keyThumbnail, onClose) {
  const $ = id => document.getElementById(id);
  const dialog = $('archive-key-catalog');
  const spread = $('catalog-spread');
  const previous = $('catalog-previous'), next = $('catalog-next'), closeButton = $('catalog-close');
  const meter = $('catalog-page-number');
  const flight = $('catalog-flight');
  flight.src = ARCHIVE_LEDGER_URL;
  const spreadCount = Math.ceil(KEY_TYPES.length / KEYS_PER_SPREAD);
  let spreadIndex = 0;
  let moving = false;

  function paint() {
    spread.replaceChildren();
    const start = spreadIndex * KEYS_PER_SPREAD;
    for (let type = start; type < Math.min(start + KEYS_PER_SPREAD, KEY_TYPES.length); type++) {
      const article = document.createElement('article');
      const picture = document.createElement('img');
      const name = document.createElement('h3');
      const image = keyThumbnail({ type });
      if (image) picture.src = image;
      picture.alt = '';
      name.textContent = familyName(type);
      article.append(picture, name);
      spread.append(article);
    }
    previous.disabled = spreadIndex === 0;
    next.disabled = spreadIndex === spreadCount - 1;
    meter.textContent = t('catalog.spread', { current: spreadIndex + 1, total: spreadCount });
  }

  function turn(offset) {
    const target = spreadIndex + offset;
    if (moving || target < 0 || target >= spreadCount) return;
    spreadIndex = target;
    paint();
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      spread.animate([{ opacity: .58, transform: `translateX(${Math.sign(offset) * 10}px)` },
        { opacity: 1, transform: 'translateX(0)' }], { duration: 190, easing: 'ease-out' });
    }
    if (document.activeElement === previous && previous.disabled) next.focus();
    if (document.activeElement === next && next.disabled) previous.focus();
  }

  async function animate(toScreen) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const rect = spread.getBoundingClientRect();
    const pose = bookFlight(world.camera, canvas, rect);
    if (!pose(0)) return;
    dialog.classList.add('is-lifting');
    flight.style.width = `${rect.width}px`;
    flight.style.height = `${rect.height}px`;
    flight.style.transform = pose(toScreen ? 0 : 1);
    flight.hidden = false;
    const duration = toScreen ? 850 : 680;
    await new Promise(resolve => {
      const startedAt = performance.now();
      function frame(now) {
        const progress = Math.min(1, Math.max(0, now - startedAt) / duration);
        const transform = pose(toScreen ? progress : 1 - progress);
        if (transform) flight.style.transform = transform;
        if (progress < 1) requestAnimationFrame(frame);
        else resolve();
      }
      requestAnimationFrame(frame);
    });
    flight.hidden = true;
    dialog.classList.remove('is-lifting');
  }

  async function open() {
    if (dialog.open || moving) return;
    moving = true;
    paint();
    dialog.showModal();
    world.setLedgerVisible(false);
    await animate(true);
    moving = false;
    closeButton.focus({ preventScroll: true });
  }

  async function close() {
    if (!dialog.open || moving) return;
    moving = true;
    await animate(false);
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
