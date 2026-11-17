import * as THREE from 'three';

// These coordinates belong to the same building as the Lair. Every source
// THREE.Scene is retained as an actual child of this world, with all of its
// existing meshes, materials, interactions and camera preserved.
export const WORKSHOP_PLACEMENTS = Object.freeze({
  // The Atelier's 32 m rear wall becomes the Lair's own 32 m left wall.
  // Both original easels, paintings and tools sit INSIDE the Lair corridor.
  restoration: {position: [-3.7, 0, 10.35], yaw: Math.PI / 2},
  alchemy: {position: [14.7, 3.16, 10.1], yaw: -Math.PI / 2, scale: .35},
  workbench: {position: [17.5, 3.8, 20.07], yaw: -Math.PI / 2},
});

export function createWorldStationRegistry(worldScene) {
  const roots = new Map();
  const entries = new Map();
  const activeSlots = new Map();
  const originalLightVisibility = new WeakMap();
  let lightedStation = null;

  function forEachSourceLight(callback) {
    for (const entry of entries.values()) for (const light of entry.lights)
      callback(light,entry.station);
  }

  function syncLighting() {
    forEachSourceLight((light,station) => {
      if(!originalLightVisibility.has(light))originalLightVisibility.set(light,light.visible);
      if(station!==lightedStation)light.visible=false;
    });
  }

  function setLighting(station=null) {
    if(lightedStation===station)return;
    if(lightedStation)forEachSourceLight((light,id) => {
      if(id===lightedStation)originalLightVisibility.set(light,light.visible);
    });
    lightedStation=station;
    forEachSourceLight((light,id) => {
      if(!originalLightVisibility.has(light))originalLightVisibility.set(light,light.visible);
      light.visible=id===station&&originalLightVisibility.get(light);
    });
  }

  function rootFor(station) {
    if (roots.has(station)) return roots.get(station);
    const placement = WORKSHOP_PLACEMENTS[station];
    if (!placement) throw new Error(`Unknown workshop: ${station}`);
    const root = new THREE.Group();
    root.name = `keynlock-world-${station}`;
    root.position.set(...placement.position);
    root.rotation.y = placement.yaw;
    root.scale.setScalar(placement.scale || 1);
    // The restoration scene is physically visible from the main room camera.
    // Other heavy modules remain parked until their own workstations are used.
    root.visible = station === 'restoration';
    worldScene.add(root);
    roots.set(station, root);
    return root;
  }

  function register(station, {scene, camera, additionalScenes = [], slot = 'main'}) {
    if (!scene?.isScene || !camera?.isCamera) throw new Error('Original THREE.Scene and camera required');
    const root = rootFor(station);
    const slotKey = `${station}:${slot}`;
    const previous = entries.get(slotKey);
    if (previous?.scene === scene) return previous;

    // The lock mechanism is a distinct activity inside the same existing
    // workshop. Keep its original geometry in the workshop world as well.
    const slotRoot = new THREE.Group();
    slotRoot.name = `keynlock-world-${slotKey}`;
    if (slot === 'mechanism') slotRoot.position.set(0, 5.4, -7.8);
    root.add(slotRoot);
    slotRoot.add(scene);
    for (const background of additionalScenes) if (background?.isScene) slotRoot.add(background);

    // Camera coordinates and OrbitControls targets remain local to the
    // original workshop; the view is physically transformed with its room.
    slotRoot.add(camera);
    const unpatchedLookAt = camera.lookAt.bind(camera);
    const localTarget = new THREE.Vector3();
    camera.lookAt = (...args) => {
      if (args[0]?.isVector3) localTarget.copy(args[0]);
      else localTarget.set(args[0], args[1], args[2]);
      slotRoot.updateWorldMatrix(true, false);
      slotRoot.localToWorld(localTarget);
      unpatchedLookAt(localTarget);
    };

    // A DirectionalLight's target is normally left parentless at (0,0,0).
    // Give it the same coordinate space as the unchanged original light.
    const entry = {station, slot, scene, camera, root: slotRoot,
      scenes:[scene,...additionalScenes],lights:[],lightsUpdated:false};
    entry.updateLights = () => {
      const found=[];
      for(const source of entry.scenes)source.traverse(object => {
        if(object.isLight)found.push(object);
        if((object.isDirectionalLight || object.isSpotLight) && !object.target.parent)
          slotRoot.add(object.target);
      });
      entry.lights=found;
      entry.lightsUpdated=true;
    };
    entry.updateLights();
    entry.lightsUpdated=false;
    entries.set(slotKey, entry);
    slotRoot.visible = slot === (activeSlots.get(station) || 'main');
    root.updateWorldMatrix(true, true);
    // Source scripts finish constructing their original light rigs during
    // the same JavaScript turn; only then collect them for Lair lighting.
    queueMicrotask(() => {
      if(entries.get(slotKey)!==entry)return;
      entry.updateLights();
      syncLighting();
    });
    return entry;
  }

  function pose(station, slot = 'main') {
    const entry = entries.get(`${station}:${slot}`);
    if (!entry) return null;
    entry.root.updateWorldMatrix(true, true);
    const position = entry.camera.getWorldPosition(new THREE.Vector3());
    const direction = entry.camera.getWorldDirection(new THREE.Vector3());
    return {
      position,
      target: position.clone().addScaledVector(direction, 9),
      fov: entry.camera.fov,
    };
  }

  function selectSlot(station, slot = 'main') {
    if (station !== 'workbench') return;
    activeSlots.set(station,slot);
    for (const entry of entries.values()) {
      if (entry.station === station) entry.root.visible = entry.slot === slot;
    }
  }

  function update() {
    for (const entry of entries.values()) {
      if (!entry.lightsUpdated) {
        entry.updateLights();
        entry.lightsUpdated=true;
      }
    }
    syncLighting();
    for (const root of roots.values()) root.updateWorldMatrix(true, true);
  }

  return {register, pose, selectSlot, update, setLighting, roots, entries,
    has: station => entries.has(`${station}:main`)};
}
