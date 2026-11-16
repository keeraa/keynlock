import { createFrameGeometry } from './frame-geometry.js';
import { layoutWallPaintings, WALL_CAPACITY, WALL_HEIGHT, WALL_TOP,
  WALL_WIDTH, WALL_ROWS, WALL_LABEL_WIDTH } from './wall-layout.js';

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
  labelCanvas.width = 512;
  labelCanvas.height = 2048;
  const labelContext = labelCanvas.getContext('2d');
  const labelStep = labelCanvas.height / WALL_ROWS.length;
  for (const [index, row] of WALL_ROWS.entries()) {
    const center = (index + .5) * labelStep;
    labelContext.fillStyle = '#f0dcb6';
    labelContext.font = '600 36px Manrope, sans-serif';
    labelContext.textAlign = 'left';
    labelContext.textBaseline = 'middle';
    labelContext.fillText?.(row.label.toUpperCase(), 16, center - 5, 482);
    labelContext.fillStyle = 'rgba(240,220,182,.36)';
    labelContext.fillRect(16, center + 35, 330, 1);
  }
  const labelTexture = new THREE.CanvasTexture(labelCanvas);
  labelTexture.colorSpace = THREE.SRGBColorSpace;
  const labelStrip = new THREE.Mesh(
    new THREE.PlaneGeometry(WALL_LABEL_WIDTH - .14, WALL_HEIGHT),
    new THREE.MeshBasicMaterial({ map: labelTexture, transparent: true, depthWrite: false,
      toneMapped: false }),
  );
  labelStrip.name = 'twelve-art-history-labels';
  labelStrip.position.set(-WALL_WIDTH / 2 + WALL_LABEL_WIDTH / 2 - .06,
    WALL_TOP - WALL_HEIGHT / 2, .035);
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

  return {
    root, paintingsRoot, setPaintings, hitTest, showHighResolution, clearFocus,
    getPlacement: (id) => artworks.get(id)?.placement || null,
    getLayout: () => layout,
    clear() { revision++; clearFrames(); },
  };
}
