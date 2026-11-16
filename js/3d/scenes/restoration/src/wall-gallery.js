import { createFrameGeometry } from './frame-geometry.js';

/** Mountable art on the rear wall. An empty layout leaves the gouache wall unobstructed. */
export function createWallGallery({ THREE, scene, frameWood }) {
  const root = new THREE.Group();
  root.name = 'rear-wall-paintings';
  root.position.z = -4.42; // In front of the plaster wall's visible surface (-4.60).
  scene.add(root);

  const ownedMaterials = new Set();

  function clear() {
    root.traverse((part) => {
      if (!part.isMesh) return;
      part.geometry.dispose();
      if (ownedMaterials.has(part.material)) part.material.dispose();
    });
    ownedMaterials.clear();
    root.clear();
  }

  function setPaintings(layout) {
    clear();
    for (const item of layout) {
      const { texture, x, y, width, height, angle = 0, frameWidth = .085 } = item;
      if (!texture?.isTexture || ![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) continue;

      const mount = new THREE.Group();
      mount.name = `wall-art-${item.id ?? root.children.length + 1}`;
      mount.position.set(x, y, 0);
      mount.rotation.z = angle;
      root.add(mount);

      const imageMaterial = new THREE.MeshStandardMaterial({ map: texture, roughness: 1 });
      ownedMaterials.add(imageMaterial);
      const image = new THREE.Mesh(new THREE.PlaneGeometry(width, height), imageMaterial);
      image.position.z = .11;
      mount.add(image);

      const frame = new THREE.Mesh(createFrameGeometry(THREE, width, height, frameWidth, .07), frameWood);
      frame.position.z = .075;
      frame.castShadow = true;
      frame.receiveShadow = true;
      mount.add(frame);
    }
  }

  return { root, setPaintings, clear };
}
