import { DISTRICTS } from '../js/world-data.js';
import { DISTRICT_ZONES, WATERWAYS, ZONING_PLAN, districtZoneAt, polygonPath } from '../js/district-zoning.js';

const byId = id => document.getElementById(id);
const viewport = byId('mapViewport');
const stage = byId('mapStage');
const overlay = byId('zoneOverlay');
const chips = byId('mapChips');
const list = byId('zoneList');
const info = byId('zoneInfo');
const SVG_NS = 'http://www.w3.org/2000/svg';
const districtById = new Map(DISTRICTS.map(district => [district.id, district]));
const view = { x: 0, y: 0, scale: 1, fit: 1 };
const pointers = new Map();
const shapes = new Map();
const labels = new Map();
let selectedId = null;
let hoveredId = null;
let dragOrigin = null;
let pinchDistance = 0;
let pointerMoved = false;
let fillEnabled = true;

function svgNode(tag, attributes = {}) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attributes)) el.setAttribute(key, value);
  return el;
}

function createZones() {
  const defs = svgNode('defs');
  const mask = svgNode('mask', { id: 'riverExclusion', maskUnits: 'userSpaceOnUse' });
  mask.append(svgNode('rect', { width: ZONING_PLAN.width, height: ZONING_PLAN.height, fill: 'white' }));
  for (const waterway of WATERWAYS) mask.append(svgNode('path', { d: polygonPath(waterway), fill: 'black' }));
  defs.append(mask);
  overlay.append(defs);
  const land = svgNode('g', { mask: 'url(#riverExclusion)' });
  overlay.append(land);

  for (const zone of DISTRICT_ZONES) {
    const district = districtById.get(zone.id);
    const group = svgNode('g', { 'data-zone': zone.id });
    group.style.setProperty('--zone-color', district.color);
    zone.polygons.forEach(polygon => {
      const shape = svgNode('path', { class: 'zone-path', d: polygonPath(polygon) });
      group.append(shape);
    });
    land.append(group);
    shapes.set(zone.id, group);

    const chip = document.createElement('div');
    chip.className = 'map-chip';
    chip.style.left = `${zone.anchor[0]}px`;
    chip.style.top = `${zone.anchor[1]}px`;
    chip.style.setProperty('--zone-color', district.color);
    chip.innerHTML = `<small>${district.index}</small><span>${district.name}</span>`;
    chips.append(chip);
    labels.set(zone.id, chip);

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'zone-item';
    button.style.setProperty('--zone-color', district.color);
    button.dataset.zone = zone.id;
    button.setAttribute('aria-pressed', 'false');
    button.innerHTML = `<i aria-hidden="true"></i><span><small>${district.index} · ${district.kind}</small><strong>${district.name}</strong></span>`;
    button.addEventListener('click', () => selectZone(zone.id, true));
    list.append(button);
  }
}

function updateClasses() {
  const highlighted = hoveredId || selectedId;
  for (const zone of DISTRICT_ZONES) {
    const active = highlighted === zone.id;
    const muted = highlighted !== null && !active;
    shapes.get(zone.id).querySelectorAll('.zone-path').forEach(path => {
      path.classList.toggle('active', active);
      path.classList.toggle('muted', muted);
    });
    labels.get(zone.id).classList.toggle('active', active);
    labels.get(zone.id).classList.toggle('muted', muted);
  }
  for (const button of list.querySelectorAll('.zone-item')) {
    const active = button.dataset.zone === selectedId;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  }
}

function selectZone(id, focus = false) {
  if (id !== null && !districtById.has(id)) return;
  selectedId = id;
  hoveredId = null;
  if (id) {
    const district = districtById.get(id);
    const zone = DISTRICT_ZONES.find(item => item.id === id);
    info.innerHTML = `<span class="zone-info-label">РАЙОН ${district.index} / 07</span><h2>${district.name}</h2><p>${zone.notes}</p>`;
    if (focus) focusZone(zone);
  } else {
    info.innerHTML = '<span class="zone-info-label">ПЛАН ГОРОДА</span><h2>Выбери район</h2><p>Семь территорий разделены естественными границами. Вода остаётся самостоятельной частью карты.</p>';
  }
  updateClasses();
}

function renderView() {
  stage.style.transform = `translate3d(${view.x}px,${view.y}px,0) scale(${view.scale})`;
}

function mapSize() {
  const narrow = window.innerWidth <= 900;
  return {
    width: Math.max(280, viewport.clientWidth - (narrow ? 0 : 344)),
    height: Math.max(250, viewport.clientHeight - (narrow ? (window.innerWidth <= 520 ? 248 : 267) : 0)),
  };
}

function fitMap() {
  const { width, height } = mapSize();
  view.fit = Math.min(width / ZONING_PLAN.width, height / ZONING_PLAN.height) * .95;
  view.scale = view.fit;
  view.x = (width - ZONING_PLAN.width * view.scale) / 2;
  view.y = (height - ZONING_PLAN.height * view.scale) / 2;
  renderView();
}

function zoomAt(factor, clientX, clientY) {
  const old = view.scale;
  view.scale = Math.max(view.fit * .75, Math.min(view.fit * 6, view.scale * factor));
  if (Math.abs(view.scale - old) < 1e-7) return;
  const rect = viewport.getBoundingClientRect();
  const x = clientX - rect.left, y = clientY - rect.top;
  view.x = x - (x - view.x) * view.scale / old;
  view.y = y - (y - view.y) * view.scale / old;
  renderView();
}

function focusZone(zone) {
  const { width, height } = mapSize();
  view.scale = Math.max(view.fit * 1.7, Math.min(view.fit * 3.1, view.scale));
  view.x = width * .5 - zone.anchor[0] * view.scale;
  view.y = height * .5 - zone.anchor[1] * view.scale;
  renderView();
}

function zoneAtPointer(event) {
  const rect = viewport.getBoundingClientRect();
  const x = (event.clientX - rect.left - view.x) / view.scale;
  const y = (event.clientY - rect.top - view.y) / view.scale;
  return districtZoneAt(x, y);
}

viewport.addEventListener('wheel', event => {
  event.preventDefault();
  zoomAt(Math.exp(-event.deltaY * .00125), event.clientX, event.clientY);
}, { passive: false });

viewport.addEventListener('pointerdown', event => {
  viewport.setPointerCapture(event.pointerId);
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  if (pointers.size === 1) {
    dragOrigin = { x: event.clientX, y: event.clientY };
    pointerMoved = false;
  } else {
    pointerMoved = true;
    const [a, b] = [...pointers.values()];
    pinchDistance = Math.hypot(a.x - b.x, a.y - b.y);
  }
});

viewport.addEventListener('pointermove', event => {
  if (!pointers.has(event.pointerId)) {
    const next = zoneAtPointer(event);
    if (next !== hoveredId) { hoveredId = next; updateClasses(); }
    return;
  }
  const previous = pointers.get(event.pointerId);
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  if (pointers.size >= 2) {
    const [a, b] = [...pointers.values()];
    const distance = Math.hypot(a.x - b.x, a.y - b.y);
    if (pinchDistance > 0) zoomAt(distance / pinchDistance, (a.x + b.x) / 2, (a.y + b.y) / 2);
    pinchDistance = distance;
  } else {
    if (Math.hypot(event.clientX - dragOrigin.x, event.clientY - dragOrigin.y) > 5) pointerMoved = true;
    if (pointerMoved) {
      view.x += event.clientX - previous.x;
      view.y += event.clientY - previous.y;
      renderView();
    }
  }
  viewport.classList.toggle('dragging', pointerMoved);
});

function endPointer(event) {
  if (!pointers.has(event.pointerId)) return;
  if (!pointerMoved && pointers.size === 1 && event.type === 'pointerup') selectZone(zoneAtPointer(event));
  pointers.delete(event.pointerId);
  if (pointers.size < 2) pinchDistance = 0;
  if (!pointers.size) {
    dragOrigin = null;
    pointerMoved = false;
    viewport.classList.remove('dragging');
  }
}
viewport.addEventListener('pointerup', endPointer);
viewport.addEventListener('pointercancel', endPointer);
viewport.addEventListener('pointerleave', () => {
  if (!pointers.size && hoveredId) { hoveredId = null; updateClasses(); }
});

function zoomToCenter(factor) {
  const { width, height } = mapSize();
  zoomAt(factor, width / 2, height / 2);
}
byId('zoomIn').addEventListener('click', () => zoomToCenter(1.25));
byId('zoomOut').addEventListener('click', () => zoomToCenter(1 / 1.25));
byId('resetView').addEventListener('click', fitMap);
byId('showAll').addEventListener('click', () => { selectZone(null); fitMap(); });
byId('toggleFill').addEventListener('click', event => {
  fillEnabled = !fillEnabled;
  event.currentTarget.setAttribute('aria-pressed', String(fillEnabled));
  overlay.classList.toggle('no-fill', !fillEnabled);
});
window.addEventListener('resize', fitMap, { passive: true });
window.addEventListener('keydown', event => {
  if (event.key === 'Escape') { selectZone(null); return; }
  if (event.key === '+' || event.key === '=') zoomToCenter(1.25);
  if (event.key === '-') zoomToCenter(1 / 1.25);
  if (event.key.toLowerCase() === 'r' || event.key.toLowerCase() === 'к') fitMap();
});

createZones();
fitMap();
window.__keynlockZoning = {
  version: ZONING_PLAN.version,
  zones: DISTRICT_ZONES,
  waterways: WATERWAYS,
  districtAt: districtZoneAt,
  select: selectZone,
  getSelected: () => selectedId,
};
