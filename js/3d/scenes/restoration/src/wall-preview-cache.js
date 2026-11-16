/** Small wall thumbnails are independent of the easel texture cache. */
export function createWallPreviewCache({ THREE, renderer }) {
  const previews = new Map();

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

  function previewFor(art) {
    if (!previews.has(art.id)) previews.set(art.id, load(art));
    return previews.get(art.id);
  }

  function retain(ids) {
    const keep = new Set(ids);
    for (const [id, promise] of previews) {
      if (keep.has(id)) continue;
      previews.delete(id);
      void promise.then(({ texture }) => texture.dispose());
    }
  }

  return { previewFor, retain, clear: () => retain([]) };
}
