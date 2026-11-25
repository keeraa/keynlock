import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { createBirdFlock } from '../vendor/sikisi/bird-flock/bird-flock.js';
import { WINDOW_OPENING } from './window.js';

export const WINDOW_BIRD_COUNT = 3;
export const WINDOW_BIRD_WINGSPAN = .82;

/** Mount the SIKISI flock beyond the masonry, among the city window's layers. */
export function mountWindowBirds(scene, renderer, shadowPositions) {
  const textures = new KTX2Loader().detectSupport(renderer);
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).setKTX2Loader(textures);
  const flock = createBirdFlock({
    THREE, scene, clone, load: url => loader.loadAsync(url),
    count: WINDOW_BIRD_COUNT, height: 2.3, radius: 7.5,
    center: { x: WINDOW_OPENING.centerX, z: -20 },
    wingspan: WINDOW_BIRD_WINGSPAN,
  });
  flock.ready.then(() => {
    for (const actor of flock.root.children) {
      actor.traverse(object => { object.userData.atmosphere = true; });
    }
  }).catch(error => {
    flock.dispose();
    console.warn('Lair: window birds could not be loaded', error);
  }).finally(() => textures.dispose());

  let previousTime = null;
  return time => {
    const elapsed = previousTime === null ? 0 : time - previousTime;
    previousTime = time;
    if (elapsed <= 0 || !flock.root.children.length) return;
    flock.update(Math.min(elapsed, .05));
    flock.root.children.forEach(({ position }, index) => {
      shadowPositions[index].set(position.x, position.y, position.z, 1);
    });
  };
}
