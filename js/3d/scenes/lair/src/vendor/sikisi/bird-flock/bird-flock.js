// SIKISI · bird-flock — a flock that flaps, glides, lands on perches, rests and takes off again.
// Generalised from KEYNLOCK art-archive (src/environment/birds.js). The game passes THREE,
// a loader and SkeletonUtils.clone, so the package never imports three itself.
import { smoothWingBeat } from './bird-animation.js';
import { createBirdRoute } from './bird-route.js';
import { createBirdFlight } from './bird-flight.js';

/** Species shipped with the package (CC0, see assets/LICENSES.txt). */
export const BIRD_SPECIES = Object.freeze({
  crow: { url: new URL('./assets/hooded-crow.glb', import.meta.url).href, flap: 'fly', rests: ['idle'], flapSpeed: 1.05 },
  // afk.ai rig: its loop has a hitch at the seam, smoothWingBeat fixes it.
  afk: { url: new URL('./assets/afk-bird.glb', import.meta.url).href, flap: 'Flap', glide: 'Glide', rests: ['Idle', 'Look Around', 'Preen'], smooth: true, flapSpeed: 1.55 },
});

/**
 * @param {object} o
 * @param {any} o.THREE
 * @param {any} o.scene
 * @param {(url: string) => Promise<any>} o.load      e.g. url => gltfLoader.loadAsync(url)
 * @param {(root: any) => any} o.clone                SkeletonUtils.clone
 * @param {Array<keyof typeof BIRD_SPECIES | object>} [o.species]
 * @param {number} [o.count]       birds in the flock
 * @param {number} [o.height]      altitude of the sky layer (world units)
 * @param {number} [o.radius]      radius of the flight area
 * @param {{x:number,z:number}} [o.center]
 * @param {number} [o.wingspan]    every model is scaled to this span
 * @param {((i:number) => ({position:any, yaw:number} | null)) | null} [o.perch]  landing spots; null = never land
 */
export function createBirdFlock({ THREE, scene, load, clone, species = ['crow', 'afk'], count = 6, height = 12, radius = 23, center = { x: 0, z: 0 }, wingspan = 1.2, perch = null }) {
  const root = new THREE.Group(); root.name = 'bird-flock'; scene.add(root);
  const defs = species.map(s => typeof s === 'string' ? BIRD_SPECIES[s] : s);
  const cache = new Map(), actors = [], bounds = new THREE.Box3();
  let time = 0, disposed = false;
  const loadDef = (d) => { if (!cache.has(d.url)) cache.set(d.url, load(d.url)); return cache.get(d.url); };
  const find = (gltf, name) => THREE.AnimationClip.findByName(gltf.animations, name);

  // A clip with one airborne pose only (the crow): hold its broad-wing frame as the glide.
  function heldPose(clip) {
    const tracks = clip.tracks.map(track => {
      const pose = track.createInterpolant().evaluate(clip.duration * .25);
      const t = track.clone(); t.times = new Float32Array([0, 1]); t.values = new Float32Array([...pose, ...pose]); return t;
    });
    return new THREE.AnimationClip('Held glide', 1, tracks);
  }

  async function spawn() {
    const loaded = await Promise.all(defs.map(loadDef));
    if (disposed) return;
    for (let i = 0; i < count; i++) {
      const def = defs[i % defs.length], gltf = loaded[i % defs.length], model = clone(gltf.scene);
      const box = new THREE.Box3().setFromObject(model), size = box.getSize(new THREE.Vector3());
      model.scale.setScalar(wingspan / size.x); // same wingspan for every species
      const pivot = new THREE.Group(); pivot.add(model); root.add(pivot);
      model.position.sub(box.getCenter(new THREE.Vector3()).multiplyScalar(model.scale.x));
      const mixer = new THREE.AnimationMixer(model);
      const flapClip = find(gltf, def.flap); if (!flapClip) throw Error(`bird-flock: нет клипа «${def.flap}»`);
      const flap = mixer.clipAction(def.smooth ? smoothWingBeat(THREE, flapClip) : flapClip);
      flap.timeScale = (def.flapSpeed || 1) * (1 + (i % 3 - 1) * .07);
      const glide = mixer.clipAction((def.glide && find(gltf, def.glide)) || heldPose(flapClip));
      const rests = (def.rests || []).map(n => find(gltf, n)).filter(Boolean).map(c => mixer.clipAction(c));
      model.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
      // Measure the feet once in the quiet pose: flapping wings must not lift the body off the perch.
      let restOffset = 0;
      if (rests.length) { rests[0].play(); mixer.update(0); pivot.updateMatrixWorld(true); model.traverse(o => o.skeleton?.update()); bounds.setFromObject(model, true); restOffset = pivot.position.y - bounds.min.y; rests[0].stop(); }
      flap.play(); flap.time = i * .137 % flapClip.duration; mixer.update(0);
      actors.push({ pivot, model, mixer, index: i, flap, glide, rests, action: flap, gliding: false, state: 'flying',
        nextChange: time + 1.2 + i * .83, nextRest: time + 8 + i * 13, restIndex: 0, restOffset, restPoseY: model.position.y,
        flight: createBirdFlight(THREE, i, { height, radius, center }) });
    }
  }
  const ready = spawn();

  function play(a, action) {
    if (a.action === action) return;
    action.reset().setEffectiveWeight(1).play(); a.action.stopFading(); action.crossFadeFrom(a.action, .45, false); a.action = action;
  }
  function steer(a, dt) {
    const result = a.route.sample(time - a.routeStart, a.pivot.position), d = result.direction;
    const turn = Math.atan2(Math.sin(Math.atan2(d.x, d.z) - a.pivot.rotation.y), Math.cos(Math.atan2(d.x, d.z) - a.pivot.rotation.y));
    const change = Math.max(-1.1 * dt, Math.min(1.1 * dt, turn)), blend = 1 - Math.exp(-4 * dt);
    a.pivot.rotation.y += change;
    a.pivot.rotation.x += (-Math.atan2(d.y, Math.hypot(d.x, d.z)) - a.pivot.rotation.x) * blend;
    a.pivot.rotation.z += (-change / Math.max(dt, .0001) * .25 - a.pivot.rotation.z) * blend;
    return result.finished;
  }
  function beginRest(a, spot) {
    const tangent = new THREE.Vector3(Math.sin(spot.yaw), 0, Math.cos(spot.yaw));
    const above = spot.position.clone().addScaledVector(tangent, -7); above.y = Math.max(above.y, height + 2.5);
    const incoming = new THREE.Vector3(Math.sin(a.pivot.rotation.y) * 3, 0, Math.cos(a.pivot.rotation.y) * 3);
    const approach = tangent.clone().multiplyScalar(2.3); approach.y = -.6;
    a.route = createBirdRoute(THREE, [a.pivot.position.clone(), above, spot.position.clone()], [incoming, approach, new THREE.Vector3()], [Math.max(3, a.pivot.position.distanceTo(above) / 3), 4]);
    a.routeStart = time; a.perch = spot.position.clone(); a.state = 'landing'; play(a, a.flap);
  }

  function update(dt) {
    time += dt;
    for (const a of actors) {
      if (a.state === 'flying' && perch && a.rests.length && time >= a.nextRest && actors.filter(b => b.state !== 'flying').length < 2) {
        const spot = perch(a.index); if (spot) beginRest(a, spot); else a.nextRest = time + 20;
      }
      if (a.state === 'landing') {
        const done = steer(a, dt);
        if (time - a.routeStart > a.route.duration - .8) play(a, a.rests[0]); // fold the wings in the final descent
        if (done) { a.state = 'resting'; a.until = time + 12 + a.index * 1.5; a.nextGesture = time + 3; }
      } else if (a.state === 'resting') {
        a.pivot.position.copy(a.perch);
        const settle = 1 - Math.exp(-4 * dt); a.pivot.rotation.x *= 1 - settle; a.pivot.rotation.z *= 1 - settle;
        if (time >= a.nextGesture) { a.restIndex = (a.restIndex + 1) % a.rests.length; play(a, a.rests[a.restIndex]); a.nextGesture = time + 3.5; }
        if (time >= a.until) {
          const tangent = new THREE.Vector3(Math.sin(a.pivot.rotation.y), 0, Math.cos(a.pivot.rotation.y));
          const forward = a.perch.clone().addScaledVector(tangent, 11); forward.y = height + 3.5;
          const out = tangent.clone().multiplyScalar(2.4); out.y = 1.1; const leave = tangent.clone().multiplyScalar(3); leave.y = .7;
          a.route = createBirdRoute(THREE, [a.perch, forward], [out, leave], [5]); a.routeStart = time; a.state = 'taking-off'; play(a, a.flap);
        }
      } else if (a.state === 'taking-off' && steer(a, dt)) {
        a.state = 'flying'; a.flight.resume(a.pivot.position, a.pivot.rotation.y, -a.pivot.rotation.x, a.pivot.rotation.z);
        a.nextRest = time + 35 + a.index * 4; a.nextChange = time + 2; a.gliding = false;
      }
      if (a.state !== 'flying') {
        a.mixer.update(dt);
        // Pin the resting pose to the perch while the flight pose blends away.
        const w = a.state === 'resting' ? 1 : a.state === 'landing' ? Math.max(0, Math.min(1, (time - a.routeStart - a.route.duration + .8) / .8)) : Math.max(0, 1 - (time - a.routeStart) / .8);
        a.model.position.y = a.restPoseY + a.restOffset * w * w * (3 - 2 * w);
        a.pivot.userData.flight = a.state; continue;
      }
      a.model.position.y = a.restPoseY;
      if (time >= a.nextChange) { a.gliding = !a.gliding; play(a, a.gliding ? a.glide : a.flap); a.nextChange = time + (a.gliding ? 1.6 + (a.index % 3) * .5 : 2.8 + (a.index % 3) * .7); }
      const f = a.flight.update(dt, a.gliding);
      a.pivot.position.copy(f.position); a.pivot.rotation.set(-f.pitch, f.heading, f.bank, 'YXZ');
      a.pivot.userData.flight = a.gliding ? 'glide' : 'flap';
      a.mixer.update(dt);
    }
  }

  return {
    ready, update, root,
    setVisible(v) { root.visible = !!v; },
    dispose() {
      disposed = true;
      for (const a of actors) { a.mixer.stopAllAction(); a.mixer.uncacheRoot(a.model); a.model.traverse(o => o.skeleton?.dispose()); }
      actors.length = 0; root.removeFromParent();
      // Free GPU memory of the shared sources (hiding is not enough).
      for (const p of cache.values()) p.then(g => {
        const seen = new Set();
        g.scene.traverse(o => { if (o.geometry) seen.add(o.geometry); for (const m of [].concat(o.material || [])) { seen.add(m); for (const v of Object.values(m)) if (v?.isTexture) seen.add(v); } });
        for (const r of seen) r.dispose?.();
      }).catch(() => {});
    },
  };
}
