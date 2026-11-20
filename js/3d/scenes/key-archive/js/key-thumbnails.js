import * as THREE from '../vendor/three.js';
import { KEY_ART } from './key-art.js';
import { createKeyModel, disposeKeySceneModel } from './key-factory.js?v=key-ring';

const SIZE = 160;
const inkValue = Number.parseInt(KEY_ART.outline.ink.slice(1), 16);
const INK = [(inkValue >> 16) & 255, (inkValue >> 8) & 255, inkValue & 255];

export function thumbnailCacheKey(key) {
  return `${key.type}:${key.variation ?? 0}:${Number(!!key.broken)}:${Number(!!key.mud)}:${Number(!!key.rust)}:${Number(!!key.wax)}:${key.id ?? ''}`;
}

// Render on the game's existing WebGL context only when the held inventory
// changes. This makes real material-and-condition snapshots without a second
// context, an extra per-frame render, or hundreds of thumbnail assets.
export function createKeyThumbnailRenderer(renderer) {
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(KEY_ART.skyColor, KEY_ART.groundColor, 2.2));
  const keyLight = new THREE.DirectionalLight(KEY_ART.keyColor, 2.9);
  keyLight.position.set(-3, 5, 7);
  scene.add(keyLight);
  const fill = new THREE.DirectionalLight(KEY_ART.fillColor, 1.45);
  fill.position.set(4, -3, 5);
  scene.add(fill);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 15);
  camera.position.set(0, 0, 6);
  camera.lookAt(0, 0, 0);
  const target = new THREE.WebGLRenderTarget(SIZE, SIZE, {
    minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter,
    depthBuffer: true, stencilBuffer: false,
  });
  target.texture.colorSpace = THREE.SRGBColorSpace;
  const pixels = new Uint8Array(SIZE * SIZE * 4);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  const context = canvas.getContext('2d');
  const oldColor = new THREE.Color();

  function capture(key) {
    if (!context) return null;
    const model = createKeyModel(key.type, {
      id: key.id, variation: key.variation, broken: key.broken,
      mud: key.mud, rust: key.rust, wax: key.wax,
    });
    scene.add(model);
    const oldTarget = renderer.getRenderTarget();
    const oldAlpha = renderer.getClearAlpha();
    renderer.getClearColor(oldColor);
    const oldAutoClear = renderer.autoClear;
    const oldShadow = renderer.shadowMap.enabled;
    try {
      model.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(model);
      const size = bounds.getSize(new THREE.Vector3());
      const center = bounds.getCenter(new THREE.Vector3());
      model.position.sub(center);
      const half = Math.max(size.x * .75, size.y * .63, .35);
      camera.left = camera.bottom = -half;
      camera.right = camera.top = half;
      camera.updateProjectionMatrix();
      renderer.autoClear = true;
      renderer.shadowMap.enabled = false;
      renderer.setClearColor(0, 0);
      renderer.setRenderTarget(target);
      renderer.clear(true, true, true);
      renderer.render(scene, camera);
      renderer.readRenderTargetPixels(target, 0, 0, SIZE, SIZE, pixels);

      const image = context.createImageData(SIZE, SIZE);
      for (let y = 0; y < SIZE; y++) {
        const row = (SIZE - 1 - y) * SIZE * 4;
        image.data.set(pixels.subarray(row, row + SIZE * 4), y * SIZE * 4);
      }
      // Forge's thin opaque ink line follows the photograph's alpha edge.
      const copy = new Uint8ClampedArray(image.data);
      for (let y = 1; y < SIZE - 1; y++) for (let x = 1; x < SIZE - 1; x++) {
        const at = (y * SIZE + x) * 4;
        if (copy[at + 3] > 16) continue;
        let hasEdge = false;
        for (let dy = -1; dy <= 1 && !hasEdge; dy++)
          for (let dx = -1; dx <= 1; dx++)
            if (copy[((y + dy) * SIZE + x + dx) * 4 + 3] > 64) hasEdge = true;
        if (hasEdge) {
          image.data.set(INK, at);
          image.data[at + 3] = 240;
        }
      }
      context.putImageData(image, 0, 0);
      return canvas.toDataURL('image/png');
    } finally {
      renderer.setRenderTarget(oldTarget);
      renderer.setClearColor(oldColor, oldAlpha);
      renderer.autoClear = oldAutoClear;
      renderer.shadowMap.enabled = oldShadow;
      scene.remove(model);
      disposeKeySceneModel(model);
    }
  }

  return { capture, dispose: () => target.dispose() };
}
