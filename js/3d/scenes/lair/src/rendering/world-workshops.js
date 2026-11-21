import * as THREE from 'three';

// The laboratory's metal foot caps end at local y=-9.525. Its original
// furniture is scaled into the Lair, where the timber floor ends at y=.0385.
const ALCHEMY_SCALE = .28;
const ALCHEMY_FEET_BOTTOM = -9.525;
const LAIR_FLOOR_TOP = .0385;

// These coordinates belong to the same building as the Lair. Every source
// THREE.Scene is retained as an actual child of this world, with all of its
// existing meshes, materials, interactions and camera preserved.
export const WORKSHOP_PLACEMENTS = Object.freeze({
  // The Atelier's 32 m rear wall becomes the Lair's own 32 m left wall.
  // Both original easels, paintings and tools sit INSIDE the Lair corridor.
  atelier: {position: [-3.7, 0, 10.35], yaw: Math.PI / 2},
  // Original lab wall sits just in front of the Lair's right tiled wall;
  // its two-tier table has four actual feet resting on the shared floor.
  alchemy: {position: [6.86, LAIR_FLOOR_TOP - ALCHEMY_FEET_BOTTOM * ALCHEMY_SCALE, 10.1],
    yaw: -Math.PI / 2, scale: ALCHEMY_SCALE},
  workbench: {position: [17.5, 3.8, 20.07], yaw: -Math.PI / 2},
});

export function createWorldWorkshopRegistry(worldScene) {
  const roots = new Map();
  const entries = new Map();
  const activeSlots = new Map();
  const originalLightVisibility = new WeakMap();
  const scaledLights = new Map();
  let litWorkshop = null;

  function forEachSourceLight(callback) {
    for (const entry of entries.values()) for (const light of entry.lights)
      callback(light,entry.workshopId,entry.backgroundLights?.has(light));
  }

  function syncLighting() {
    forEachSourceLight((light,workshopId,backgroundOnly) => {
      if(!originalLightVisibility.has(light))originalLightVisibility.set(light,light.visible);
      // A standalone Alchemy scene renders its backdrop separately. In the
      // shared world that second ambient/key rig would light everything twice.
      if(workshopId!==litWorkshop || backgroundOnly)light.visible=false;
    });
  }

  function setLighting(workshopId=null) {
    if(litWorkshop===workshopId)return;
    if(litWorkshop)forEachSourceLight((light,id,backgroundOnly) => {
      if(id===litWorkshop && !backgroundOnly)originalLightVisibility.set(light,light.visible);
    });
    litWorkshop=workshopId;
    // The source Atelier and Alchemy furniture remain visible in the room
    // between visits; only their interactive simulation is paused off-workshop.
    for (const [id,root] of roots) root.visible = id === 'atelier' || id === 'alchemy' || id === workshopId;
    forEachSourceLight((light,id,backgroundOnly) => {
      if(!originalLightVisibility.has(light))originalLightVisibility.set(light,light.visible);
      light.visible=id===workshopId&&!backgroundOnly&&originalLightVisibility.get(light);
    });
  }

  function rootFor(workshopId) {
    if (roots.has(workshopId)) return roots.get(workshopId);
    const placement = WORKSHOP_PLACEMENTS[workshopId];
    if (!placement) throw new Error(`Unknown workshop: ${workshopId}`);
    const root = new THREE.Group();
    root.name = `keynlock-world-${workshopId}`;
    root.position.set(...placement.position);
    root.rotation.y = placement.yaw;
    root.scale.setScalar(placement.scale || 1);
    root.visible = workshopId === 'atelier' || workshopId === 'alchemy';
    worldScene.add(root);
    roots.set(workshopId, root);
    return root;
  }

  function register(workshopId, {scene, camera, additionalScenes = [], slot = 'main'}) {
    if (!scene?.isScene || !camera?.isCamera) throw new Error('Original THREE.Scene and camera required');
    const root = rootFor(workshopId);
    const slotKey = `${workshopId}:${slot}`;
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
    const entry = {workshopId, slot, scene, camera, root: slotRoot,
      scenes:[scene,...additionalScenes],lights:[],backgroundLights:new WeakSet(),lightsUpdated:false};
    entry.updateLights = () => {
      const found=[];
      for(const source of entry.scenes)source.traverse(object => {
        if(object.isLight) {
          found.push(object);
          if(source!==scene)entry.backgroundLights.add(object);
        }
        if((object.isDirectionalLight || object.isSpotLight) && !object.target.parent)
          slotRoot.add(object.target);
      });
      entry.lights=found;
      entry.lightsUpdated=true;
    };
    entry.updateLights();
    entry.lightsUpdated=false;
    entries.set(slotKey, entry);
    slotRoot.visible = slot === (activeSlots.get(workshopId) || 'main');
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

  function pose(workshopId, slot = 'main') {
    const entry = entries.get(`${workshopId}:${slot}`);
    if (!entry) return null;
    // Only the camera ancestry is needed for its world pose. Recursively
    // updating the entire imported laboratory every frame can stall the UI.
    entry.camera.updateWorldMatrix(true, false);
    const position = entry.camera.getWorldPosition(new THREE.Vector3());
    // The source laboratory saves its exact orbit target. Using a synthetic
    // point 9 metres along the view ray gives the Lair the wrong zoom/orbit
    // pivot even when the camera position happens to be correct.
    const sourceTarget = entry.camera.userData.keynlockLocalTarget;
    const target = sourceTarget?.isVector3
      ? entry.root.localToWorld(sourceTarget.clone())
      : position.clone().addScaledVector(entry.camera.getWorldDirection(new THREE.Vector3()), 9);
    return {
      position,
      target,
      fov: entry.camera.fov,
    };
  }

  function selectSlot(workshopId, slot = 'main') {
    if (workshopId !== 'workbench') return;
    activeSlots.set(workshopId,slot);
    for (const entry of entries.values()) {
      if (entry.workshopId === workshopId) entry.root.visible = entry.slot === slot;
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
    // WebGLRenderer.render() updates the entire shared scene's world matrices.
    // Updating every workshop recursively here duplicates a costly traversal.
  }

  function prepareLightsForRender() {
    if(litWorkshop!=='alchemy')return;
    // Imported point lights are physically close together because the whole
    // lab is scaled to 28%. Three.js does not scale their inverse-square
    // intensities or cutoff distances with Object3D.scale. Correct those for
    // the render only, leaving original flicker/heat simulation values intact.
    const scale=WORKSHOP_PLACEMENTS.alchemy.scale;
    forEachSourceLight((light,workshopId,backgroundOnly) => {
      if(workshopId!=='alchemy'||backgroundOnly||!light.visible||
        (!light.isPointLight&&!light.isSpotLight))return;
      scaledLights.set(light,{intensity:light.intensity,distance:light.distance});
      light.intensity*=scale*scale;
      if(light.distance>0)light.distance*=scale;
    });
  }

  function restoreLightsAfterRender() {
    for(const [light,{intensity,distance}] of scaledLights) {
      light.intensity=intensity;
      light.distance=distance;
    }
    scaledLights.clear();
  }

  return {register, pose, selectSlot, update, setLighting,
    prepareLightsForRender,restoreLightsAfterRender,roots, entries,
    has: workshopId => entries.has(`${workshopId}:main`)};
}
