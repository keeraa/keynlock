import { DISTRICTS } from './world-data.js';
import { DISTRICT_ZONES, WATERWAYS, ZONING_PLAN, districtZoneAt } from './district-zoning.js';

// Data-driven district overlay: visual only, no changes to terrain, water, buildings or routing.
export function worldFromZoning(u, v, { width = 2640, height = 1800, flipX = false, flipZ = false } = {}) {
  return {
    x: (u / ZONING_PLAN.width - .5) * width * (flipX ? -1 : 1),
    z: (v / ZONING_PLAN.height - .5) * height * (flipZ ? -1 : 1),
  };
}

export function createDistrictLayer({
  host, project, heightAt = () => 0, dimensions = { width: 2640, height: 1800 },
  onSelect = () => {}, initiallyVisible = true,
} = {}) {
  if (!host || typeof project !== 'function') throw new Error('Missing overlay host or project(worldPoint).');
  const ns = 'http://www.w3.org/2000/svg';
  const svgNode = (tag, attributes = {}) => {
    const el = document.createElementNS(ns, tag);
    Object.entries(attributes).forEach(([key, val]) => el.setAttribute(key, String(val)));
    return el;
  };
  const root = document.createElement('div');
  root.style.cssText = 'position:absolute;inset:0;z-index:6;pointer-events:none;overflow:hidden';
  const svg = svgNode('svg', { 'aria-hidden': 'true', preserveAspectRatio: 'none' });
  svg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none';
  root.append(svg);
  const maskId = 'district-water-' + Math.random().toString(36).slice(2, 10);
  const defs = svgNode('defs'), mask = svgNode('mask', { id: maskId, maskUnits: 'userSpaceOnUse' });
  const maskGround = svgNode('rect', { fill: '#fff' });
  mask.append(maskGround);
  const maskedWater = WATERWAYS.map(() => svgNode('path', { fill: '#000' }));
  mask.append(...maskedWater);
  defs.append(mask); svg.append(defs);
  const land = svgNode('g', { mask: 'url(#' + maskId + ')' }); svg.append(land);
  const byId = new Map(DISTRICTS.map(d => [d.id, d]));
  const zoneShapes = new Map(), labels = new Map();
  for (const zone of DISTRICT_ZONES) {
    const district = byId.get(zone.id);
    const shapes = zone.polygons.map(() => {
      const path = svgNode('path', {
        fill: district.color, 'fill-opacity': .16, stroke: district.color,
        'stroke-opacity': .9, 'stroke-width': 2, 'vector-effect': 'non-scaling-stroke',
        'stroke-linejoin': 'round',
      });
      land.append(path); return path;
    });
    zoneShapes.set(zone.id, shapes);
    const label = document.createElement('div');
    label.textContent = district.index + ' · ' + district.name;
    label.style.cssText = 'position:absolute;transform:translate(-50%,-50%);white-space:nowrap;' +
      'border:2px solid ' + district.color + ';background:#f9f5e9ed;color:#253b38;' +
      'font:600 12px/1.2 system-ui,sans-serif;border-radius:8px;padding:6px 8px;box-shadow:0 2px 8px #0003';
    root.append(label); labels.set(zone.id, label);
  }
  const tools = document.createElement('div');
  tools.style.cssText = 'position:absolute;right:16px;top:16px;pointer-events:auto;display:grid;gap:4px;' +
    'max-height:75%;overflow:auto;background:#152d2ee8;color:#eee5c9;padding:9px;border-radius:9px';
  const toggle = document.createElement('button');
  toggle.type = 'button'; toggle.textContent = 'Районы';
  toggle.style.cssText = 'background:#e6d4a3;border:0;border-radius:6px;padding:7px 9px;cursor:pointer';
  tools.append(toggle);
  const list = document.createElement('div'); list.style.cssText = 'display:grid;gap:3px';
  for (const district of DISTRICTS) {
    const btn = document.createElement('button');
    btn.type = 'button'; btn.textContent = district.index + ' ' + district.name;
    btn.style.cssText = 'text-align:left;background:transparent;color:#f6eddf;border:0;' +
      'border-left:4px solid ' + district.color + ';padding:4px 8px;cursor:pointer';
    btn.addEventListener('click', () => { selected = selected === district.id ? null : district.id; refresh(); onSelect(selected); });
    list.append(btn);
  }
  tools.append(list); root.append(tools);
  let visible = Boolean(initiallyVisible), selected = null, opacity = 1;
  function refresh() {
    svg.style.display = visible ? '' : 'none';
    list.style.display = visible ? '' : 'none';
    toggle.setAttribute('aria-pressed', String(visible));
    for (const zone of DISTRICT_ZONES) {
      const dim = selected && selected !== zone.id;
      const active = selected === zone.id;
      zoneShapes.get(zone.id).forEach(p => {
        p.setAttribute('fill-opacity', String((dim ? .05 : active ? .30 : .16) * opacity));
        p.setAttribute('stroke-opacity', dim ? '.25' : '.9');
        p.setAttribute('stroke-width', active ? '3' : '2');
      });
      labels.get(zone.id).style.display = visible ? '' : 'none';
      labels.get(zone.id).style.opacity = dim ? '.4' : '1';
    }
  }
  toggle.addEventListener('click', () => { visible = !visible; refresh(); });
  const toScreen = ([u, v]) => {
    const { x, z } = worldFromZoning(u, v, dimensions);
    return project({ x, y: heightAt(x, z) + .2, z });
  };
  function polygonPath(points) {
    const projected = [];
    for (let i = 0; i < points.length; i++) {
      const a = points[i], b = points[(i + 1) % points.length];
      const count = Math.max(1, Math.ceil(Math.hypot(a[0]-b[0], a[1]-b[1]) / 35));
      for (let j = 0; j < count; j++) {
        const t = j / count;
        projected.push(toScreen([a[0] * (1-t) + b[0] * t, a[1] * (1-t) + b[1] * t]));
      }
    }
    if (projected.some(p => !p || !Number.isFinite(p.x) || !Number.isFinite(p.y))) return '';
    return projected.map((p, i) => (i ? 'L' : 'M') + p.x.toFixed(1) + ',' + p.y.toFixed(1)).join(' ') + 'Z';
  }
  function update() {
    if (!visible) return;
    const w = host.clientWidth || 1, h = host.clientHeight || 1;
    svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    maskGround.setAttribute('width', String(w)); maskGround.setAttribute('height', String(h));
    maskedWater.forEach((el, i) => el.setAttribute('d', polygonPath(WATERWAYS[i])));
    for (const zone of DISTRICT_ZONES) {
      zone.polygons.forEach((poly, i) => zoneShapes.get(zone.id)[i].setAttribute('d', polygonPath(poly)));
      const p = toScreen(zone.anchor), label = labels.get(zone.id);
      if (!p || p.visible === false) label.style.visibility = 'hidden';
      else { label.style.visibility = 'visible'; label.style.left = p.x + 'px'; label.style.top = p.y + 'px'; }
    }
  }
  const priorPosition = getComputedStyle(host).position;
  if (priorPosition === 'static') host.style.position = 'relative';
  host.append(root); refresh(); update();
  return {
    update, setVisible(value) { visible = Boolean(value); refresh(); update(); },
    isVisible: () => visible,
    setOpacity(value) { opacity = Math.min(1, Math.max(0, value)); refresh(); },
    selectDistrict(id) { selected = byId.has(id) ? id : null; refresh(); },
    districtAtWorld(x, z) {
      const u = (x / (dimensions.width * (dimensions.flipX ? -1 : 1)) + .5) * ZONING_PLAN.width;
      const v = (z / (dimensions.height * (dimensions.flipZ ? -1 : 1)) + .5) * ZONING_PLAN.height;
      return districtZoneAt(u, v);
    },
    destroy() { root.remove(); if (priorPosition === 'static') host.style.position = ''; },
  };
}
