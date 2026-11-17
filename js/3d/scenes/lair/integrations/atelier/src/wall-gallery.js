import { createFrameGeometry } from './frame-geometry.js';
import { createWallArtworkPicker } from './wall-artwork-picker.js';
import { createWallPreviewCache } from './wall-preview-cache.js';
import { layoutWallPaintings, WALL_CAPACITY, WALL_TOP,
  WALL_WIDTH, WALL_COLUMNS } from './wall-layout.js';
import { paintingCategory } from './painting-catalog.js';

/** A compact, high-mounted salon wall. Preview textures are separate from the easel LRU. */
export function createWallGallery({ THREE, scene, camera, renderer, frameWood,
  pointerElement = renderer.domElement, onLayout = () => {} }) {
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
  labelStrip.userData.excludeFromInk = true;
  labelStrip.position.set(0, WALL_TOP - .42, .035);
  root.add(labelStrip);

  const previewCache = createWallPreviewCache({ THREE, renderer });
  const artworks = new Map();
  const imageMeshes = [];
  const selection = createWallArtworkPicker({ THREE, camera, renderer, artworks, imageMeshes, pointerElement });
  const imageLoader = new THREE.TextureLoader();
  const backingMaterial = new THREE.MeshStandardMaterial({ color: '#b29e7d', roughness: 1 });
  let revision = 0;
  let focusedId = null;
  let fullTexture = null;
  let focusRequest = 0;
  let layout = layoutWallPaintings([]);

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
    if (focusedId === id) return;
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

  function removeArtwork(id) {
    const item = artworks.get(id);
    if (!item) return;
    if (focusedId === id) clearFocus();
    for (const mesh of [item.backing, item.image, item.frame]) mesh.geometry.dispose();
    item.image.material.dispose();
    paintingsRoot.remove(item.mount);
    artworks.delete(id);
  }

  function updateImage(item, source) {
    item.preview = source.texture || null;
    const material = item.image.material;
    const nextTexture = focusedId === source.id && fullTexture ? fullTexture : item.preview;
    if (material.map !== nextTexture) {
      material.map = nextTexture;
      material.needsUpdate = true;
    }
    material.color.set(nextTexture ? '#ffffff' : '#75644c');
    // Preserve the image's proportions while the rest of its column is loading.
    // Once all its previews arrive the frame will be resized to the real aspect.
    const frameAspect = item.placement.width / item.placement.height;
    const sourceAspect = source.texture ? source.aspect : frameAspect;
    item.image.scale.set(Math.min(1, sourceAspect / frameAspect),
      Math.min(1, frameAspect / sourceAspect), 1);
  }

  function reconcile(nextLayout, sources) {
    const keep = new Set(nextLayout.placements.map((placement) => placement.id));
    let shadowsChanged = false;
    for (const id of artworks.keys()) {
      if (!keep.has(id)) { removeArtwork(id); shadowsChanged = true; }
    }
    imageMeshes.length = 0; // Keep the shared picker array identity.
    for (const placement of nextLayout.placements) {
      const source = sources.get(placement.id);
      let item = artworks.get(placement.id);
      if (!item) {
        const mount = new THREE.Group();
        mount.name = `restored-${placement.id}`;
        paintingsRoot.add(mount);
        // The backing is already visible before a network preview is ready.
        const backing = new THREE.Mesh(new THREE.BoxGeometry(placement.outerWidth, placement.outerHeight, .022), backingMaterial);
        backing.userData.excludeFromInk = true;
        backing.position.z = .012;
        backing.castShadow = backing.receiveShadow = true;
        mount.add(backing);
        const material = new THREE.MeshStandardMaterial({ roughness: 1 });
        const image = new THREE.Mesh(new THREE.PlaneGeometry(placement.width, placement.height), material);
        image.userData.excludeFromInk = true;
        image.position.z = .058;
        image.userData.galleryId = placement.id;
        mount.add(image);
        const frame = new THREE.Mesh(createFrameGeometry(THREE, placement.width, placement.height, placement.frameWidth, .044), frameWood);
        frame.userData.excludeFromInk = true;
        frame.position.z = .028;
        frame.castShadow = frame.receiveShadow = true;
        mount.add(frame);
        item = { mount, backing, image, frame, preview: null, art: source, placement };
        artworks.set(placement.id, item);
        shadowsChanged = true;
      } else {
        if (focusedId === placement.id && item.art.image !== source.image) clearFocus();
        const old = item.placement;
        if (Math.abs(old.outerWidth - placement.outerWidth) > 1e-5 ||
          Math.abs(old.outerHeight - placement.outerHeight) > 1e-5) {
          item.backing.geometry.dispose();
          item.backing.geometry = new THREE.BoxGeometry(placement.outerWidth, placement.outerHeight, .022);
          shadowsChanged = true;
        }
        if (Math.abs(old.width - placement.width) > 1e-5 ||
          Math.abs(old.height - placement.height) > 1e-5) {
          item.image.geometry.dispose();
          item.image.geometry = new THREE.PlaneGeometry(placement.width, placement.height);
          item.frame.geometry.dispose();
          item.frame.geometry = createFrameGeometry(THREE, placement.width, placement.height, placement.frameWidth, .044);
          shadowsChanged = true;
        }
      }
      if (item.mount.position.x !== placement.x || item.mount.position.y !== placement.y) {
        item.mount.position.set(placement.x, placement.y, 0);
        shadowsChanged = true;
      }
      item.art = source;
      item.placement = placement;
      updateImage(item, source);
      imageMeshes.push(item.image);
    }
    layout = nextLayout;
    if (shadowsChanged) renderer.shadowMap.needsUpdate = true;
  }

  async function setPaintings(paintings, { onProgress = () => {} } = {}) {
    const request = ++revision;
    const selected = paintings.slice(0, WALL_CAPACITY);
    previewCache.retain(selected.map((art) => art.id));
    const sources = new Map(selected.map((art) => {
      const ready = previewCache.getReady(art);
      return [art.id, { ...art, aspect: ready?.aspect || art.aspect || 1,
        texture: ready?.texture || null }];
    }));

    // Mount all frames immediately; load images into them independently.
    reconcile(layoutWallPaintings([...sources.values()]), sources);
    onLayout(layout);
    let loaded = selected.filter((art) => Boolean(sources.get(art.id).texture)).length;
    onProgress({ loaded, total: selected.length });
    const remaining = new Map();
    for (const art of selected) {
      if (sources.get(art.id).texture) continue;
      const category = paintingCategory(art);
      remaining.set(category, (remaining.get(category) || 0) + 1);
    }

    await Promise.all(selected.map(async (art) => {
      if (sources.get(art.id).texture) return;
      const preview = await previewCache.previewFor(art);
      if (request !== revision) return;
      const source = sources.get(art.id);
      if (preview) {
        source.texture = preview.texture;
        source.aspect = preview.aspect;
        const item = artworks.get(art.id);
        if (item) updateImage(item, source);
      }
      loaded++;
      onProgress({ loaded, total: selected.length });
      const category = paintingCategory(art);
      remaining.set(category, remaining.get(category) - 1);
      if (remaining.get(category) === 0) {
        // Column dimensions depend on each other's aspect ratios. Reflow one
        // finished column at a time, reusing every existing mesh/material.
        reconcile(layoutWallPaintings([...sources.values()]), sources);
        onLayout(layout);
      }
    }));
    return layout;
  }

  return {
    root, paintingsRoot, setPaintings, ...selection, showHighResolution, clearFocus,
    getPlacement: (id) => artworks.get(id)?.placement || null,
    getLayout: () => layout,
    clear() {
      revision++;
      clearFocus();
      for (const id of artworks.keys()) removeArtwork(id);
      imageMeshes.length = 0;
      layout = layoutWallPaintings([]);
      previewCache.clear();
    },
  };
}
