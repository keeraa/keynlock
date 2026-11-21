// @ts-check
import { t } from '../i18n.js';

// The FPS button in the header opens a panel with the render's numbers, like
// the Key Archive's (js/3d/scenes/key-archive/dist/js/performance-hud.js).
// Hovering (or focusing) the triangle row lists where most triangles are.
// Details are gathered only while the panel is open.

const WORKSHOP_ROOT = /^keynlock-world-(atelier|alchemy|workbench)/;
const WORKSHOP_NAMES = () => ({ atelier: t('Ателье'), alchemy: t('Алхимия'), workbench: t('Верстак') });

/** Triangles drawn for one mesh, as Three.js counts them. */
function meshTriangles(mesh) {
  const geometry = mesh.geometry;
  const vertices = geometry?.index?.count ?? geometry?.attributes?.position?.count ?? 0;
  return Math.floor(vertices / 3) * (mesh.isInstancedMesh ? mesh.count : 1);
}

/**
 * Where the scene's triangles are: visible meshes grouped by workshop or the
 * room, and within it by the outermost named group, or the geometry type when
 * nothing is named (e.g. the lab's flasks are LatheGeometry). Largest first.
 * @returns {{ total: number, groups: { label: string, triangles: number }[] }}
 */
export function getTriangleBreakdown(scene, { limit = 6 } = {}) {
  const workshopNames = WORKSHOP_NAMES();
  const totals = new Map();
  let total = 0;
  scene.traverse(object => {
    if (!object.isMesh || object.userData?.inkOutlineShell || object.userData?.atmosphere) return;
    // A hidden ancestor hides the mesh, and the walk up gives its owner.
    let workshop = null, part = '', named = object.name || '';
    for (let node = object; node; node = node.parent) {
      if (!node.visible) return;
      const match = WORKSHOP_ROOT.exec(node.name || '');
      if (match) { workshop = match[1]; break; }
      if (!named && node.name) named = node.name;
      if (node.name) part = node.name;     // the outermost named group below the root wins
    }
    const triangles = meshTriangles(object);
    if (!triangles) return;
    const owner = workshop ? workshopNames[workshop] : t('Комната');
    const label = `${owner} · ${part || named || object.geometry?.type || '?'}`;
    totals.set(label, (totals.get(label) ?? 0) + triangles);
    total += triangles;
  });
  const groups = [...totals].map(([label, triangles]) => ({ label, triangles }))
    .sort((a, b) => b.triangles - a.triangles).slice(0, limit);
  return { total, groups };
}

/** Wires the FPS button and its panel; call frame() once per rendered frame. */
export function mountPerformancePanel({ document, renderer, scene, canvas }) {
  const $ = id => /** @type {HTMLElement} */ (document.getElementById(id));
  const toggle = $('perf-toggle');
  const panel = $('perf-panel');
  const trianglesRow = $('perf-triangles-row');
  const breakdown = $('perf-breakdown');
  const number = new Intl.NumberFormat(document.documentElement.lang || 'ru');
  let frames = 0, seconds = 0, cpuTotal = 0, cpuPeak = 0, calls = 0, lastTriangles = 0;

  function setOpen(open) {
    panel.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    if (!open) breakdown.hidden = true;
  }
  toggle.addEventListener('click', () => setOpen(panel.hidden));
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !panel.hidden) setOpen(false); });
  document.addEventListener('pointerdown', event => {
    if (!panel.hidden && !toggle.parentElement?.contains(/** @type {Node} */ (event.target))) setOpen(false);
  });

  function showBreakdown() {
    const { total, groups } = getTriangleBreakdown(scene);
    const list = $('perf-breakdown-list');
    list.replaceChildren(...groups.map(group => {
      const item = document.createElement('li');
      const share = total ? Math.round(group.triangles / total * 100) : 0;
      item.innerHTML = '<div><span></span><strong></strong></div>';
      const [name, count] = item.firstElementChild.children;
      name.textContent = group.label;
      /** @type {HTMLElement} */ (name).title = group.label;
      count.textContent = `${number.format(group.triangles)} · ${share}%`;
      return item;
    }));
    breakdown.hidden = false;
  }
  trianglesRow.addEventListener('pointerenter', showBreakdown);
  trianglesRow.addEventListener('focus', showBreakdown);
  trianglesRow.addEventListener('click', showBreakdown);          // touch screens have no hover
  trianglesRow.addEventListener('pointerleave', () => { breakdown.hidden = true; });
  trianglesRow.addEventListener('blur', () => { breakdown.hidden = true; });

  function details() {
    let lights = 0, sceneTriangles = 0;
    scene.traverse(object => {
      if (object.isPointLight && object.visible && object.intensity > 0) lights++;
    });
    sceneTriangles = getTriangleBreakdown(scene, { limit: 0 }).total;
    const width = Math.round(canvas.clientWidth * renderer.getPixelRatio());
    const height = Math.round(canvas.clientHeight * renderer.getPixelRatio());
    $('perf-scene-triangles').textContent = number.format(sceneTriangles);
    $('perf-calls').textContent = frames ? number.format(Math.round(calls / frames)) : '—';
    $('perf-cpu').textContent = frames ? `${(cpuTotal / frames).toFixed(1)} / ${cpuPeak.toFixed(1)} ${t('мс')}` : '—';
    $('perf-lights').textContent = String(lights);
    $('perf-memory').textContent = `${renderer.info.memory.geometries} / ${renderer.info.memory.textures}`;
    $('perf-resolution').textContent = `${width} × ${height}`;
  }

  /**
   * @param {number} delta seconds since the previous frame
   * @param {number} cpuMs JavaScript time spent on this frame
   * @param {{ triangles: number, calls: number }} drawn what the renderer drew
   */
  function frame(delta, cpuMs, drawn) {
    frames++; seconds += delta;
    cpuTotal += cpuMs; cpuPeak = Math.max(cpuPeak, cpuMs);
    calls += drawn.calls; lastTriangles = drawn.triangles;
    if (seconds < .65) return;
    $('fps').textContent = String(Math.round(frames / seconds));
    $('triangles').textContent = number.format(lastTriangles);
    if (!panel.hidden) details();
    frames = 0; seconds = 0; cpuTotal = 0; cpuPeak = 0; calls = 0;
  }
  return { frame, setOpen, isOpen: () => !panel.hidden };
}
