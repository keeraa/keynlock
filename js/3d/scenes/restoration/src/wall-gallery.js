import { createFrameGeometry } from './frame-geometry.js';
import { layoutWallPaintings, WALL_CAPACITY, WALL_TOP,
  WALL_WIDTH, WALL_COLUMNS } from './wall-layout.js';

/** A compact, high-mounted salon wall. Preview textures are separate from the easel LRU. */
export function createWallGallery({ THREE, scene, camera, renderer, frameWood, onLayout = () => {} }) {
  const root = new THREE.Group();
  root.name = 'rear-wall-paintings';
  // Wallpaper's front face is z=-4.6. The canvas backs are only 4–5 cm away.
  root.position.z = -4.555;
  scene.add(root);

  const paintingsRoot = new THREE.Group();
  paintingsRoot.name = 'restored-frames';
  root.add(paintingsRoot);
  const labelCanvas = document.createElement('canvas');
  labelCanvas.width = 4096;
  labelCanvas.height = 192;
  const labelContext = labelCanvas.getContext('2d');
  const labelStep = labelCanvas.width / WALL_COLUMNS.length;
  for (const [index, column] of WALL_COLUMNS.entries()) {
    const center = (index + .5) * labelStep;
    const [name, subtitle] = column.label.toUpperCase().split(' · ');
    labelContext.fillStyle = '#f0dcb6';
    labelContext.font = '600 37px Manrope, sans-serif';
    labelContext.textAlign = 'center';
    labelContext.textBaseline = 'middle';
    labelContext.fillText?.(name, center, subtitle ? 73 : 90, labelStep - 26);
    if (subtitle) {
      labelContext.font = '500 26px Manrope, sans-serif';
      labelContext.fillText?.(subtitle, center, 116, labelStep - 26);
    }
    labelContext.fillStyle = 'rgba(240,220,182,.45)';
    labelContext.fillRect(center - labelStep * .38, 157, labelStep * .76, 2);
  }
  const labelTexture = new THREE.CanvasTexture(labelCanvas);
  labelTexture.colorSpace = THREE.SRGBColorSpace;
  const labelStrip = new THREE.Mesh(
    new THREE.PlaneGeometry(WALL_WIDTH, .81),
    new THREE.MeshBasicMaterial({ map: labelTexture, transparent: true, depthWrite: false,
      toneMapped: false }),
  );
  labelStrip.name = 'twelve-art-history-column-headings';
  labelStrip.position.set(0, WALL_TOP - .42, .035);
  root.add(labelStrip);

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const previewCache = new Map();
  const artworks = new Map();
  const imageMeshes = [];
  const imageLoader = new THREE.TextureLoader();
  const backingMaterial = new THREE.MeshStandardMaterial({ color: '#b29e7d', roughness: 1 });
  const imageMaterials = new Set();
  let revision = 0;
  let focusedId = null;
  let fullTexture = null;
  let focusRequest = 0;
  let layout = layoutWallPaintings([]);

  async function previewFor(art) {
    if (previewCache.has(art.id)) return previewCache.get(art.id);
    const promise = (async () => {
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
    })();
    previewCache.set(art.id, promise);
    return promise;
  }

  function clearFocus() {
    focusRequest++;
    if (focusedId) {
      const item = artworks.get(focusedId);
      if (item) item.image.material.map = item.preview;
    }
    fullTexture?.dispose();
    fullTexture = null;
    focusedId = null;
  }

  async function showHighResolution(id) {
    clearFocus();
    const item = artworks.get(id);
    if (!item) return;
    focusedId = id;
    const request = focusRequest;
    try {
      const texture = await imageLoader.loadAsync(item.art.image);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      if (request !== focusRequest || focusedId !== id || !artworks.has(id)) {
        texture.dispose();
        return;
      }
      fullTexture = texture;
      item.image.material.map = texture;
      item.image.material.needsUpdate = true;
    } catch (error) { console.warn('Не удалось загрузить картину крупно', error); }
  }

  function clearFrames() {
    clearFocus();
    paintingsRoot.traverse((part) => { if (part.isMesh) part.geometry.dispose(); });
    for (const material of imageMaterials) material.dispose();
    imageMaterials.clear();
    imageMeshes.length = 0;
    artworks.clear();
    paintingsRoot.clear();
  }

  async function setPaintings(paintings) {
    const request = ++revision;
    const selected = paintings.slice(0, WALL_CAPACITY);
    const resolved = await Promise.all(selected.map(async (art) => ({ ...art, ...await previewFor(art) })));
    if (request !== revision) return layout;
    clearFrames();
    layout = layoutWallPaintings(resolved);
    for (const placement of layout.placements) {
      const source = resolved.find((item) => item.id === placement.id);
      const mount = new THREE.Group();
      mount.name = `restored-${placement.id}`;
      mount.position.set(placement.x, placement.y, 0);
      paintingsRoot.add(mount);

      // A real canvas backing casts the painting's complete rectangular shadow.
      const backing = new THREE.Mesh(new THREE.BoxGeometry(placement.outerWidth, placement.outerHeight, .022), backingMaterial);
      backing.position.z = .012;
      backing.castShadow = true;
      backing.receiveShadow = true;
      mount.add(backing);

      const material = new THREE.MeshStandardMaterial({ map: source.texture, roughness: 1 });
      imageMaterials.add(material);
      const image = new THREE.Mesh(new THREE.PlaneGeometry(placement.width, placement.height), material);
      image.position.z = .058;
      image.userData.galleryId = placement.id;
      mount.add(image);
      imageMeshes.push(image);

      const frame = new THREE.Mesh(createFrameGeometry(THREE, placement.width, placement.height, placement.frameWidth, .044), frameWood);
      frame.position.z = .028;
      frame.castShadow = true;
      frame.receiveShadow = true;
      mount.add(frame);
      artworks.set(placement.id, { image, preview: source.texture, art: source, placement });
    }
    const keep = new Set(selected.map((art) => art.id));
    for (const [id, promise] of previewCache) {
      if (keep.has(id)) continue;
      previewCache.delete(id);
      void promise.then(({ texture }) => texture.dispose());
    }
    renderer.shadowMap.needsUpdate = true;
    onLayout(layout);
    return layout;
  }

  function hitTest(event) {
    if (!imageMeshes.length) return null;
    const bounds = renderer.domElement.getBoundingClientRect();
    pointer.set((event.clientX - bounds.left) / bounds.width * 2 - 1,
      -(event.clientY - bounds.top) / bounds.height * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(imageMeshes, false)[0];
    return hit ? artworks.get(hit.object.userData.galleryId)?.placement || null : null;
  }

  /** Pick the artwork with the strongest screen presence, even without a pointer hit. */
  function getProminentPainting(previousId = null) {
    if (!artworks.size) return null;
    camera.updateMatrixWorld();
    root.updateWorldMatrix(true, false);
    const corner = new THREE.Vector3();
    const viewCenter = new THREE.Vector3();
    const scores = new Map();
    let winner = null;
    let bestScore = 0;

    for (const { placement } of artworks.values()) {
      viewCenter.set(placement.x, placement.y, .058).applyMatrix4(root.matrixWorld)
        .applyMatrix4(camera.matrixWorldInverse);
      if (viewCenter.z >= -camera.near) continue;

      const halfWidth = placement.width / 2;
      const halfHeight = placement.height / 2;
      let left = Infinity, right = -Infinity, bottom = Infinity, top = -Infinity;
      for (const x of [-halfWidth, halfWidth]) {
        for (const y of [-halfHeight, halfHeight]) {
          corner.set(placement.x + x, placement.y + y, .058)
            .applyMatrix4(root.matrixWorld).project(camera);
          left = Math.min(left, corner.x);
          right = Math.max(right, corner.x);
          bottom = Math.min(bottom, corner.y);
          top = Math.max(top, corner.y);
        }
      }
      left = Math.max(-1, left);
      right = Math.min(1, right);
      bottom = Math.max(-1, bottom);
      top = Math.min(1, top);
      if (left >= right || bottom >= top) continue;

      const visibleArea = (right - left) * (top - bottom);
      const dx = left > 0 ? left : right < 0 ? right : 0;
      const dy = bottom > 0 ? bottom : top < 0 ? top : 0;
      const score = visibleArea / (1 + 8 * (dx * dx + dy * dy));
      scores.set(placement.id, score);
      if (score > bestScore) { winner = placement; bestScore = score; }
    }
    // Prevent rapid title switching when two frames are similarly prominent.
    if (previousId && winner?.id !== previousId &&
        (scores.get(previousId) || 0) * 1.12 >= bestScore) {
      return artworks.get(previousId)?.placement || winner;
    }
    return bestScore > .002 ? winner : null;
  }

  return {
    root, paintingsRoot, setPaintings, hitTest, showHighResolution, clearFocus,
    getProminentPainting,
    getPlacement: (id) => artworks.get(id)?.placement || null,
    getLayout: () => layout,
    clear() { revision++; clearFrames(); },
  };
}
