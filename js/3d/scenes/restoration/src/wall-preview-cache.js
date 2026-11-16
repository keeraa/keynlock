/** Small wall thumbnails are independent of the easel texture cache. */
export function createWallPreviewCache({ THREE, renderer, maxConcurrent = 5 }) {
  const previews = new Map();
  const waiting = [];
  const concurrency = Math.max(1, Math.floor(maxConcurrent));
  let active = 0;

  async function load(art) {
    let picture;
    try {
      picture = await new Promise((resolve, reject) => {
        const image = new Image();
        image.crossOrigin = 'anonymous';
        const timer = setTimeout(() => {
          image.onload = image.onerror = null;
          image.src = '';
          reject(new Error(`Painting timed out: ${art.id}`));
        }, 12000);
        image.onload = () => { clearTimeout(timer); resolve(image); };
        image.onerror = () => { clearTimeout(timer); reject(new Error(`Painting unavailable: ${art.id}`)); };
        image.src = art.image;
      });
    } catch (error) { console.warn('Не удалось загрузить миниатюру на стену', error); }

    const aspect = picture ? picture.naturalWidth / picture.naturalHeight : 1;
    const canvas = document.createElement('canvas');
    const maxSize = 480;
    canvas.width = Math.max(1, Math.round(Math.min(maxSize, maxSize * aspect)));
    canvas.height = Math.max(1, Math.round(Math.min(maxSize, maxSize / aspect)));
    const context = canvas.getContext('2d');
    context.fillStyle = '#b7a78e';
    context.fillRect(0, 0, canvas.width, canvas.height);
    if (picture) {
      try { context.drawImage(picture, 0, 0, canvas.width, canvas.height); }
      catch { context.fillStyle = '#71634d'; context.fillRect(7, 7, canvas.width - 14, canvas.height - 14); }
    } else {
      context.fillStyle = '#685c49';
      context.font = 'bold 12px sans-serif';
      context.textAlign = 'center';
      context.fillText?.('РЕПРОДУКЦИЯ', canvas.width / 2, canvas.height / 2);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    return { texture, aspect };
  }

  function pump() {
    while (active < concurrency && waiting.length) {
      const entry = waiting.shift();
      if (entry.evicted) continue;
      entry.started = true;
      active++;
      void load(entry.art).then((value) => {
        if (entry.evicted) value.texture.dispose();
        else entry.value = value;
        entry.resolve(value);
      }).catch((error) => {
        console.warn('Не удалось подготовить миниатюру на стену', error);
        entry.resolve(null);
      }).finally(() => { active--; pump(); });
    }
  }

  function evict(entry) {
    entry.evicted = true;
    if (!entry.started) entry.resolve(null);
    else if (entry.value) entry.value.texture.dispose();
  }

  function previewFor(art) {
    let entry = previews.get(art.id);
    if (entry && entry.art.image !== art.image) {
      previews.delete(art.id);
      evict(entry);
      entry = null;
    }
    if (!entry) {
      entry = { art, started: false, evicted: false, value: null, resolve: null, promise: null };
      entry.promise = new Promise((resolve) => { entry.resolve = resolve; });
      previews.set(art.id, entry);
      waiting.push(entry);
      pump();
    }
    return entry.promise;
  }

  function getReady(art) {
    const entry = previews.get(art.id);
    return entry?.art.image === art.image ? entry.value : null;
  }

  function retain(ids) {
    const keep = new Set(ids);
    for (const [id, entry] of previews) {
      if (keep.has(id)) continue;
      previews.delete(id);
      evict(entry);
    }
  }

  return { previewFor, getReady, retain, clear: () => retain([]) };
}
