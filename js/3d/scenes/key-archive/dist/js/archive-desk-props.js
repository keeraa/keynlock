import { ARCHIVE_DESK } from './archive-ledger.js';

const models = [
  { name: 'scroll-red', x: .30, z: -.58, yaw: .32, scale: 1.4 },
  { name: 'books-strapped', x: .29, z: .52, yaw: -.18, scale: 1.1 },
];

export async function addArchiveDeskProps(scene, onPlaced) {
  try {
    const { GLTFLoader } = await import('../vendor/loaders/GLTFLoader.js');
    const loader = new GLTFLoader();
    await Promise.all(models.map(async ({ name, x, z, yaw, scale }) => {
      try {
        const url = new URL(`../assets/quaternius-fantasy-props/${name}.glb`, import.meta.url);
        const { scene: prop } = await loader.loadAsync(url.href);
        prop.name = name;
        prop.position.set(ARCHIVE_DESK.x + x, ARCHIVE_DESK.y + .002, ARCHIVE_DESK.z + z);
        prop.rotation.y = yaw;
        prop.scale.setScalar(scale);
        prop.traverse(object => {
          if (!object.isMesh) return;
          object.castShadow = true;
          object.receiveShadow = true;
        });
        scene.add(prop);
        onPlaced(prop);
      } catch (error) {
        console.warn(`Archive desk could not load ${name}`, error);
      }
    }));
  } catch (error) {
    console.warn('Archive desk models are unavailable', error);
  }
}
