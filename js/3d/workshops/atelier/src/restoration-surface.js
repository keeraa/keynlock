// @ts-check
/**
 * Interactive restoration layers for the right-hand painting.
 * Brush and swab remove dust and grime; UV identifies oxidized varnish.
 * Reagent treats scanned varnish, and a fine retouch brush fills paint chips.
 */
import { paintAgingTextures } from './aging-textures.js';
import { createUVFluorescence } from './uv-fluorescence.js';
import { applyRestorationStamp, RESTORATION_TOOLS } from './restoration-operations.js';
import { t } from './i18n.js';

// These layers contain the actual edits. UV is recomputed from scan + uvSource.
export const RESTORATION_SNAPSHOT_LAYERS = ['dust', 'dirt', 'cracks', 'loss', 'varnish', 'uvSource', 'scan'];

export function createRestorationSurface({ THREE, width, height, seed = 1 }) {
  const scale = 640 / Math.max(width, height);
  const w = Math.max(260, Math.round(width * scale));
  const h = Math.max(260, Math.round(height * scale));
  const layers = {};
  for (const key of ['dust', 'dirt', 'cracks', 'loss', 'varnish', 'uvSource', 'uv', 'scan']) {
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    layers[key] = { canvas, context: canvas.getContext('2d', { willReadFrequently: true }), texture: null, mesh: null };
  }
  let randomState = seed >>> 0;
  const random = () => {
    randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
    return randomState / 4294967296;
  };
  const rand = (min, max) => min + (max - min) * random();
  const { dust, dirt, cracks, loss, varnish, uvSource, uv, scan } = layers;
  const contexts = Object.fromEntries(Object.entries(layers).map(([key, layer]) => [key, layer.context]));
  let originalDust = 1;
  let originalDirt = 1;
  let originalCracks = 1;
  let originalLoss = 1;
  let originalVarnish = 1;
  let meshes = [];
  let lastProgress = null;
  let currentTool = null;
  let uvFluorescence = null;
  let hoveredUV = null;
  let revision = 0;
  let savedRevision = 0;

  function blot(context, x, y, radius, color, stretch = 1) {
    context.save();
    context.translate(x, y);
    context.rotate(rand(-.65, .65));
    context.scale(1, stretch);
    const gradient = context.createRadialGradient(0, 0, radius * .06, 0, 0, radius);
    gradient.addColorStop(0, color);
    gradient.addColorStop(.65, color.replace(/,\s*([\d.]+)\)$/, (_, alpha) => `, ${Number(alpha) * .55})`));
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(0, 0, radius, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  function amount(context, step = 9) {
    const pixels = context.getImageData(0, 0, w, h).data;
    let sum = 0;
    for (let y = 0; y < h; y += step) {
      for (let x = 0; x < w; x += step) sum += pixels[(y * w + x) * 4 + 3];
    }
    return sum;
  }

  function renewDamage() {
    for (const layer of Object.values(layers)) layer.context.clearRect(0, 0, w, h);
    randomState = seed >>> 0;

    paintAgingTextures({ width: w, height: h, random, dust: dust.context,
      dirt: dirt.context, cracks: cracks.context, loss: loss.context, uvSource: uvSource.context });

    // UV fluorescent shapes are hidden until scanned; the same shapes also
    // appear as aging varnish which must be dissolved with reagent.
    const palette = ['rgba(192,115,61,0.46)', 'rgba(173,112,46,0.43)', 'rgba(140,91,47,0.40)'];
    for (let i = 0; i < 12; i++) {
      const x = rand(w * .08, w * .92);
      const y = rand(h * .08, h * .92);
      const radius = rand(Math.min(w,h) * .065, Math.min(w,h) * .19);
      blot(varnish.context, x, y, radius, palette[i % palette.length], rand(.55, 1.5));
      blot(uvSource.context, x, y, radius * .92,
        i % 2 ? 'rgba(70,234,252,0.90)' : 'rgba(203,117,248,0.88)', rand(.55, 1.35));
      for (let j = 0; j < 11; j++) {
        blot(uvSource.context, x + rand(-radius, radius), y + rand(-radius, radius),
          rand(2, 8), 'rgba(181,238,255,0.65)', rand(.4, 1.4));
      }
    }
    originalDust = Math.max(1, amount(dust.context));
    originalDirt = Math.max(1, amount(dirt.context));
    originalCracks = Math.max(1, amount(cracks.context));
    // Chips are small: sample them at a finer interval than broad damage.
    originalLoss = Math.max(1, amount(loss.context, 2));
    originalVarnish = Math.max(1, amount(varnish.context));
    lastProgress = null;
    for (const key of ['dust','dirt','cracks','loss','varnish','uv']) {
      if (layers[key].texture) layers[key].texture.needsUpdate = true;
    }
    uvFluorescence?.refresh();
  }

  function erase(context, x, y, radius, strength = 1) {
    context.save();
    context.globalCompositeOperation = 'destination-out';
    const gradient = context.createRadialGradient(x, y, radius * .1, x, y, radius);
    gradient.addColorStop(0, `rgba(0,0,0,${strength})`);
    gradient.addColorStop(.67, `rgba(0,0,0,${strength * .85})`);
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  function markUV(x, y) {
    const radius = Math.min(w, h) * .125;
    scan.context.fillStyle = '#fff';
    scan.context.beginPath();
    scan.context.arc(x, y, radius, 0, Math.PI * 2);
    scan.context.fill();
  }

  function rebuildUV() {
    // Build the fluorescent overlay once per pointer event, masking it with
    // the scanned area. Repeated passes never accumulate alpha.
    uv.context.clearRect(0, 0, w, h);
    uv.context.drawImage(scan.canvas, 0, 0);
    uv.context.globalCompositeOperation = 'source-in';
    uv.context.drawImage(uvSource.canvas, 0, 0);
    uv.context.globalCompositeOperation = 'source-over';
  }

  function apply(tool, uvPoint, previousUv = null, motionStrength = .35) {
    if (!RESTORATION_TOOLS.has(tool) || !uvPoint) return false;
    const start = previousUv || uvPoint;
    const dx = (uvPoint.x - start.x) * w;
    const dy = -(uvPoint.y - start.y) * h;
    const distance = Math.hypot(dx, dy);
    const steps = Math.max(1, Math.ceil(distance / (Math.min(w,h) * .028)));
    const changed = new Set();
    let affected = false;
    for (let step = 0; step <= steps; step++) {
      const t = step / steps;
      const u = Math.max(.002, Math.min(.998, start.x + (uvPoint.x - start.x) * t));
      const v = Math.max(.002, Math.min(.998, start.y + (uvPoint.y - start.y) * t));
      affected = applyRestorationStamp({
        tool, x: u * w, y: (1 - v) * h, width: w, height: h, strength: motionStrength,
        layers: contexts,
        erase, markUV, changed,
      }) || affected;
    }
    if (changed.has('uv')) rebuildUV();
    // Upload only touched textures once, regardless of the number of stamps
    // used to interpolate a continuous pointer stroke.
    for (const key of changed) {
      if (layers[key].texture) layers[key].texture.needsUpdate = true;
    }
    if (changed.has('uvSource')) uvFluorescence?.refresh();
    if (['dust', 'dirt', 'varnish', 'cracks', 'loss'].some(key => changed.has(key))) lastProgress = null;
    if (affected) revision++;
    return affected;
  }

  function reset() {
    renewDamage();
    revision++;
  }

  function snapshot() {
    return Promise.all(RESTORATION_SNAPSHOT_LAYERS.map((key) => new Promise((resolve, reject) => {
      layers[key].canvas.toBlob((blob) => blob ? resolve([key, blob]) : reject(new Error(`Cannot save ${key} layer`)), 'image/png');
    }))).then((pairs) => ({ version: 1, width: w, height: h, layers: Object.fromEntries(pairs) }));
  }

  async function restore(saved, decode = createImageBitmap) {
    if (saved?.version !== 1 || saved.width !== w || saved.height !== h
      || !RESTORATION_SNAPSHOT_LAYERS.every((key) => saved.layers?.[key] instanceof Blob)) return false;
    // Decode everything before touching the current canvases. Corrupt or
    // incomplete snapshots cannot leave a half-restored painting behind.
    const decoded = [];
    try {
      for (const key of RESTORATION_SNAPSHOT_LAYERS) decoded.push([key, await decode(saved.layers[key])]);
      for (const [key, image] of decoded) {
        layers[key].context.clearRect(0, 0, w, h);
        layers[key].context.drawImage(image, 0, 0);
      }
      rebuildUV();
      for (const layer of Object.values(layers)) if (layer.texture) layer.texture.needsUpdate = true;
      uvFluorescence?.refresh();
      lastProgress = null;
      revision = savedRevision = 0;
      return true;
    } finally {
      for (const [, image] of decoded) image.close?.();
    }
  }

  function progress() {
    if (lastProgress) return lastProgress;
    const brushed = 100 * (1 - .48 * amount(dust.context) / originalDust
      - .52 * amount(dirt.context) / originalDirt);
    const treated = 100 * (1 - .77 * amount(varnish.context) / originalVarnish
      - .23 * amount(cracks.context) / originalCracks);
    const dirtPercent = Math.max(0, Math.min(100, Math.round(brushed)));
    const varnishPercent = Math.max(0, Math.min(100, Math.round(treated)));
    const retouchPercent = Math.max(0, Math.min(100,
      Math.round(100 * (1 - amount(loss.context, 2) / originalLoss))));
    const cleaning = Math.round(dirtPercent * .5 + varnishPercent * .32 + retouchPercent * .18);
    lastProgress = { dirt: dirtPercent, varnish: varnishPercent, retouch: retouchPercent, cleaning };
    return lastProgress;
  }

  function inspect(point) {
    if (!point) return null;
    const x = Math.max(0, Math.min(w - 1, Math.floor(point.x * w)));
    const y = Math.max(0, Math.min(h - 1, Math.floor((1 - point.y) * h)));

    // A small neighbourhood catches fine cracks and chips between pixels
    // without allocating a full-size image buffer on every mouse movement.
    function nearbyAlpha(context) {
      const left = Math.max(0, x - 3);
      const top = Math.max(0, y - 3);
      const sample = context.getImageData(left, top,
        Math.min(7, w - left), Math.min(7, h - top)).data;
      let peak = 0;
      let sum = 0;
      for (let i = 3; i < sample.length; i += 4) {
        const alpha = sample[i];
        peak = Math.max(peak, alpha);
        sum += alpha;
      }
      return peak * .72 + sum / (sample.length / 4) * .28;
    }

    if (nearbyAlpha(loss.context) > 28) {
      return { type: 'loss', title: t('СКОЛ КРАСКИ'), action: t('Кисть · 8'), tool: 'retouch' };
    }
    if (nearbyAlpha(varnish.context) > 17 || nearbyAlpha(cracks.context) > 35) {
      const scanned = nearbyAlpha(scan.context) > 12;
      return { type: 'varnish', title: t('СТАРЫЙ ЛАК ИЛИ ТРЕЩИНЫ'),
        action: scanned ? t('Реагент · 6') : t('УФ · 5 → реагент · 6'), tool: scanned ? 'reagent' : 'uv' };
    }
    if (nearbyAlpha(dirt.context) > 20) {
      return { type: 'dirt', title: t('ГРЯЗЬ И ПЯТНА'), action: t('Тампон · 7'), tool: 'swab' };
    }
    if (nearbyAlpha(dust.context) > 12) {
      return { type: 'dust', title: t('СЛОЙ ПЫЛИ'), action: t('Щётка · 4'), tool: 'brush' };
    }
    return { type: 'clean', title: t('УЧАСТОК ОЧИЩЕН'), action: t('Фактура оригинала сохранена'), tool: null };
  }

  function mount(group) {
    unmount();
    const order = ['varnish', 'cracks', 'loss', 'dirt', 'dust', 'uv'];
    const geometry = new THREE.PlaneGeometry(width, height);
    meshes = order.map((key, index) => {
      const layer = layers[key];
      layer.texture = new THREE.CanvasTexture(layer.canvas);
      layer.texture.colorSpace = THREE.SRGBColorSpace;
      const material = new THREE.MeshBasicMaterial({
        map: layer.texture, transparent: true, opacity: .999,
        depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.z = .169 + index * .004;
      mesh.renderOrder = 4 + index;
      mesh.userData.excludeFromInk = true;
      mesh.visible = key !== 'uv' || currentTool === 'uv' || currentTool === 'reagent';
      group.add(mesh);
      layer.mesh = mesh;
      return mesh;
    });
    uvFluorescence = createUVFluorescence({ THREE, width, height, damageCanvas: uvSource.canvas });
    group.add(uvFluorescence.mesh);
    uvFluorescence.setPointer(currentTool === 'uv' ? hoveredUV : null);
  }

  function unmount() {
    uvFluorescence?.dispose();
    uvFluorescence = null;
    const geometry = meshes[0]?.geometry;
    for (const mesh of meshes) {
      mesh.parent?.remove(mesh);
      mesh.material.map?.dispose();
      mesh.material.dispose();
    }
    geometry?.dispose();
    meshes = [];
    for (const key of ['varnish','cracks','loss','dirt','dust','uv']) {
      layers[key].texture = null;
      layers[key].mesh = null;
    }
  }

  function setTool(tool) {
    currentTool = tool;
    if (uv.mesh) {
      uv.mesh.visible = tool === 'uv' || tool === 'reagent';
      uv.mesh.material.opacity = tool === 'reagent' ? .48 : .72;
    }
    uvFluorescence?.setPointer(tool === 'uv' ? hoveredUV : null);
  }

  function setUVPointer(point) {
    hoveredUV = point ? point.clone() : null;
    uvFluorescence?.setPointer(currentTool === 'uv' ? hoveredUV : null);
  }

  function update(seconds) { uvFluorescence?.setTime(seconds); }

  renewDamage();
  return { mount, unmount, setTool, setUVPointer, update, apply, inspect, progress, reset,
    snapshot, restore, getRevision: () => revision, isDirty: () => revision !== savedRevision,
    markSaved: (saved) => { savedRevision = saved; } };
}
