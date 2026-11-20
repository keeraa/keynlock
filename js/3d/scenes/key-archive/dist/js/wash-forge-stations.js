import * as THREE from '../vendor/three.js';
import { RUG_TOP } from './floor-contact.js';
import { contactShadow } from './world-architecture.js?v=key-ring';
import { createStationFinishes } from './station-finish.js';
import { createKeyModel, disposeKeySceneModel, getKeyDisplayScale, getKeyRustStrength,
  getKeyCoatLayout, buildKeyCoatGeometry, getKeyCoatPoint } from './key-factory.js?v=key-ring';
import { rustFlakingPaint } from './key-instance-finish.js?v=wax-and-bundles';
import { bathKeyProgress, waterDip, BATH_LIFT_MS } from './station-visual-state.js?v=cleaning-cues';
import { BATH_CAPACITY, FORGE_SURFACE_Y, FIXTURE_OFFSETS, STATIONS, bathId } from './station-layout.js?v=working-baths';
import { createBathEffects, createForgeEffects, createEffectSpotTexture } from './station-visual-effects.js?v=cleaning-cues';

function block(parent, dimensions, where, material) {
  const object = new THREE.Mesh(new THREE.BoxGeometry(...dimensions), material);
  object.position.set(...where);
  parent.add(object);
  return object;
}

function cylinder(parent, top, bottom, height, where, material, segments = 16, open = false) {
  const object = new THREE.Mesh(new THREE.CylinderGeometry(top, bottom, height, segments, 1, open), material);
  object.position.set(...where);
  parent.add(object);
  return object;
}

function rim(parent, radius, y, x, z, material, thickness = .052) {
  const object = new THREE.Mesh(new THREE.TorusGeometry(radius, thickness, 7, 28), material);
  object.rotation.x = -Math.PI / 2;
  object.position.set(x, y, z);
  parent.add(object);
  return object;
}

function createBath(group, station, kind, spotTexture, ceramic) {
  const x = FIXTURE_OFFSETS[kind];
  const id = bathId(station.id, kind);
  const isWater = kind === 'mud';
  const surfaceY = isWater ? 1.19 : 1.415;
  const radius = isWater ? .57 : .39;
  const lipY = surfaceY + .026;
  const bowlMaterial = new THREE.MeshStandardMaterial({
    map: ceramic, color: isWater ? 0x548d89 : 0x81936b, roughness: .68,
  });
  const lipMaterial = new THREE.MeshStandardMaterial({
    map: ceramic, color: isWater ? 0x87b4aa : 0xaab792, roughness: .73,
  });
  const waterMaterial = new THREE.MeshStandardMaterial({
    color: isWater ? 0x6baba6 : 0xa0a76e,
    roughness: .42, transparent: true, opacity: .78, depthWrite: false,
    // Use the same transmission channel as dust so the ink follows the
    // visible surface instead of tracing the part of a key under the liquid.
    blending: THREE.CustomBlending,
    blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    emissive: isWater ? 0x17302c : 0x302e16, emissiveIntensity: .17,
  });
  const bodyProfile = (isWater ?
    [[0,.91],[.35,.91],[.37,.937],[.43,.97],[.50,1.06],[.56,1.17],[.57,lipY],
      [.52,lipY],[.48,1.16],[.40,1.02],[0,1.0]] :
    [[0,.91],[.34,.91],[.40,.95],[.45,1.05],[.46,1.23],[.42,1.36],[.39,lipY],
      [.35,lipY],[.35,1.34],[.38,1.10],[0,1.0]]);
  const shell = new THREE.Mesh(new THREE.LatheGeometry(bodyProfile.map(([r,y]) => new THREE.Vector2(r,y)), 28), bowlMaterial);
  shell.position.set(x, 0, .10);
  group.add(shell);
  const water = cylinder(group, radius - .035, radius - .035, .012, [x, surfaceY, .10], waterMaterial, 26);
  water.renderOrder = 2;
  const lip = rim(group, radius - .022, lipY, x, .10, lipMaterial, .022);
  lip.scale.z = .60;

  const collider = new THREE.Mesh(new THREE.CylinderGeometry(radius + .055, radius - .08, lipY - .89, 24),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
  collider.position.set(x, (lipY + .89) / 2, .10);
  collider.userData = { kind: 'bath', id, bathKind: kind, stationId: station.id };
  group.add(collider);
  const slots = [];
  for (let index = 0; index < BATH_CAPACITY; index++) {
    const holder = new THREE.Group();
    holder.position.set(x + (index % 2 ? .15 : -.15), surfaceY,
      .10 + (index < 2 ? -.14 : .14));
    group.add(holder);
    slots.push({ holder, keyId: null, keyMesh: null, paint: null, crust: null });
  }
  return { id, kind, shell, slots, collider, waterMaterial, group, x, surfaceY, lift: null,
    visual: createBathEffects(group, x, kind, spotTexture, surfaceY, radius), visualKeys: null };
}

function keyForBath(key, kind) {
  return createKeyModel(key.type, { ...key, [kind]: true,
    scale: getKeyDisplayScale('bath', key.type) * 1.25 });
}

function bindBathFinish(slot) {
  slot.paint = null;
  slot.remaining = null;
  slot.crust = null;
  slot.original = null;
  slot.level = 0;
  slot.flakeDebt = 0;
  slot.keyMesh.traverse(object => {
    if (!object.isMesh) return;
    const paint = object.geometry.getAttribute('instanceKeyPaint');
    if (paint) slot.paint = paint;
    else slot.crust = object;
  });
}

// Mud washes off in steps: crumbs first, then the clods shrink and drop.
const MUD_WASH_LEVELS = 6;
const washedCoats = new Map();
function mudBlobAlive(blob, progress) {
  const soaked = Math.min(1, progress * (blob.kind === 'crumb' ? 1.8 : 1));
  const shrink = 1 - soaked * soaked * (3 - 2 * soaked);
  return soaked < 1 && blob.rx * (.2 + .8 * shrink) > .016;
}
function washedMud(key, level) {
  const id = `${key.type}:${!!key.broken}:${level}`;
  if (!washedCoats.has(id)) {
    const layout = getKeyCoatLayout(key.type, key.broken, 'mud') || [];
    const progress = level / MUD_WASH_LEVELS;
    const blobs = layout.filter(blob => mudBlobAlive(blob, progress)).map(blob => {
      const soaked = Math.min(1, progress * (blob.kind === 'crumb' ? 1.8 : 1));
      const shrink = 1 - soaked * soaked * (3 - 2 * soaked);
      return { ...blob, rx: blob.rx * (.2 + .8 * shrink), ry: blob.ry * (.2 + .8 * shrink) };
    });
    washedCoats.set(id, { layout, alive: layout.map(blob => mudBlobAlive(blob, progress)),
      geometry: buildKeyCoatGeometry(key.type, key.broken, 'mud', { blobs, heightScale: 1 - .3 * progress }) });
  }
  return washedCoats.get(id);
}

function applyBathFinish(slot, kind, remaining, key, cleaning = null) {
  if (remaining === slot.remaining) return;
  const before = slot.remaining ?? 1;
  slot.remaining = remaining;
  if (slot.paint && kind === 'rust') {
    // Rust flakes off in patches while the key leaves the solution.
    slot.paint.setX(0, remaining >= 1 ? getKeyRustStrength(key.type) :
      remaining <= 0 ? 0 : rustFlakingPaint(1 - remaining));
    slot.paint.needsUpdate = true;
    if (cleaning && remaining < before) cleaning.flakes(slot, key, before - remaining);
  }
  if (slot.crust && kind === 'mud') {
    slot.original ??= slot.crust.geometry;
    const level = Math.round((1 - remaining) * MUD_WASH_LEVELS);
    if (level === (slot.level ?? 0)) return;
    const coat = level === 0 ? null : washedMud(key, level);
    slot.crust.geometry = coat?.geometry ?? slot.original;
    // Clods that just washed off fall into the water.
    if (cleaning && coat && level > (slot.level ?? 0)) {
      const previous = (slot.level ?? 0) === 0 ? coat.layout.map(() => true) : washedMud(key, slot.level).alive;
      cleaning.clods(slot, key, coat.layout.filter((blob, index) => previous[index] && !coat.alive[index]));
    }
    slot.level = level;
  }
}

// Bake the visible pieces in station-local space for one silhouette draw.
function forgeHoverGeometry(parts) {
  const positions = [];
  const point = new THREE.Vector3();
  for (const part of parts) {
    part.updateMatrix();
    const attribute = part.geometry.getAttribute('position');
    const index = part.geometry.getIndex();
    for (let vertex = 0; vertex < (index?.count ?? attribute.count); vertex++) {
      point.fromBufferAttribute(attribute, index ? index.getX(vertex) : vertex).applyMatrix4(part.matrix);
      positions.push(point.x, point.y, point.z);
    }
  }
  return new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
}

function createForge(group, station, materials, spotTexture, finish) {
  const x = FIXTURE_OFFSETS.forge;
  const { iron, soot } = finish;
  const copper = new THREE.MeshStandardMaterial({ map: materials.brass.map,
    color: 0xbe895e, roughness: .76, metalness: .20 });
  const ember = new THREE.MeshBasicMaterial({ color: 0xef8b45 });
  const hotMetal = new THREE.MeshBasicMaterial({ color: 0xc96d36, transparent: true, opacity: .84 });
  const body = cylinder(group, .55, .42, .47, [x, 1.145, .08], iron, 18);
  const collar = cylinder(group, .53, .49, .09, [x, FORGE_SURFACE_Y - .065, .08], materials.darkBrass, 18, true);
  const hearth = cylinder(group, .43, .43, .022, [x, FORGE_SURFACE_Y - .007, .08], soot, 24);
  cylinder(group, .33, .33, .025, [x, FORGE_SURFACE_Y + .008, .08], hotMetal, 24);
  const edge = rim(group, .53, FORGE_SURFACE_Y, x, .08, copper, .037);
  const embers = [];
  for (let index = 0; index < 6; index++) {
    const angle = index / 6 * Math.PI * 2;
    const pebble = cylinder(group, .045 + (index % 3) * .012, .06, .06,
      [Math.cos(angle) * .21, FORGE_SURFACE_Y + .027, .08 + Math.sin(angle) * .21], index % 2 ? ember : soot, 8);
    embers.push(pebble);
  }
  const collider = new THREE.Mesh(new THREE.CylinderGeometry(.69, .69, .94, 14),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
  collider.position.set(x, 1.29, .08);
  collider.userData = { kind: 'forge', stationId: station.id };
  group.add(collider);
  return { embers, collider,
    hover: { anchor: group, geometry: forgeHoverGeometry([body, collar, hearth, edge]) },
    visual: createForgeEffects(group, x, spotTexture, hotMetal, FORGE_SURFACE_Y) };
}

export function createWorkstations(scene, materials, keyIndex, { effects = null, onLiftDone = null } = {}) {
  const stations = [];
  const interactables = [];
  const bathMap = new Map();
  const forgeMap = new Map();
  const spotTexture = createEffectSpotTexture();
  const finish = createStationFinishes();
  const tableShade = materials.contactShadow.clone();
  tableShade.opacity = .60;
  for (const station of STATIONS) {
    const group = new THREE.Group();
    group.position.set(station.x, 0, station.z);
    scene.add(group);
    contactShadow(group, 5.55, 2.25, 0, RUG_TOP + .0026, .08, tableShade);
    // Low, open workbench: the hall remains readable and cabinets stay visible.
    block(group, [5.05, .16, 1.62], [0, .81, .08], finish.benchEdge);
    block(group, [4.92, .045, 1.48], [0, .905, .08], finish.benchTop);
    for (const x of [-2.29, 2.29]) for (const z of [-.55, .69])
      block(group, [.16, .80, .16], [x, .38, z], materials.darkWood);
    block(group, [4.86, .12, .27], [0, .29, -.49], materials.blackWood);
    block(group, [4.86, .12, .27], [0, .29, .67], materials.blackWood);
    const baths = ['mud', 'rust'].map(kind => createBath(group, station, kind, spotTexture, finish.glaze));
    const forge = createForge(group, station, materials, spotTexture, finish);
    for (const bath of baths) {
      bathMap.set(bath.id, bath);
      interactables.push(bath.collider);
    }
    forgeMap.set(station.id, forge);
    interactables.push(forge.collider);
    stations.push({ ...station, group, baths, forge });
  }

  // Pieces leaving a key in a bath: mud clods and rust flakes land on the
  // liquid of that bath with a ring.
  function bathOf(slot) {
    for (const bath of bathMap.values())
      if (bath.lift === slot || bath.slots.includes(slot)) return bath;
    return null;
  }
  const cleaning = effects && {
    clods(slot, key, blobs) {
      const bath = bathOf(slot);
      if (!bath || !slot.keyMesh) return;
      slot.keyMesh.updateMatrixWorld(true);
      const worldScale = slot.keyMesh.getWorldScale(new THREE.Vector3()).x;
      const surface = bath.group.position.y + bath.surfaceY;
      for (const blob of blobs) {
        const local = getKeyCoatPoint(key.type, key.broken, blob.x, blob.y, -.02);
        if (!local) continue;
        const pieces = blob.kind === 'crumb' ? 1 : 2;
        for (let i = 0; i < pieces; i++) {
          const point = slot.keyMesh.localToWorld(local.clone().add(new THREE.Vector3(
            (Math.random() - .5) * .04, (Math.random() - .5) * .04, 0)));
          const size = Math.max(.006, Math.min(blob.rx, blob.ry) * .3 * worldScale * (pieces > 1 ? .8 : 1));
          effects.drop('mud', point, size, surface, { onLand: p => effects.ripple(p.x, surface, p.z, .07) });
        }
      }
    },
    flakes(slot, key, amount) {
      const bath = bathOf(slot);
      const metal = slot.keyMesh?.children.find(child => child.isMesh && child.geometry.getAttribute('instanceKeyPaint'));
      const position = metal?.geometry.getAttribute('position');
      if (!bath || !position) return;
      metal.updateMatrixWorld(true);
      const surface = bath.group.position.y + bath.surfaceY;
      slot.flakeDebt = (slot.flakeDebt ?? 0) + amount * 26;
      while (slot.flakeDebt >= 1) {
        slot.flakeDebt--;
        const point = metal.localToWorld(new THREE.Vector3().fromBufferAttribute(position,
          Math.floor(Math.random() * position.count)));
        effects.drop('rust', point, .006 + Math.random() * .008, surface,
          { onLand: p => { if (Math.random() < .5) effects.ripple(p.x, surface, p.z, .045); } });
      }
    },
  };

  function getHoverSurface(target) {
    if (target?.kind === 'forge') return forgeMap.get(target.stationId)?.hover;
    const shell = bathMap.get(target?.id)?.shell;
    return shell && { anchor: shell, geometry: shell.geometry };
  }

  function clearLift(bath) {
    if (!bath.lift) return;
    bath.group.remove(bath.lift.keyMesh);
    disposeKeySceneModel(bath.lift.keyMesh);
    bath.lift = null;
  }

  function liftKey(id, key) {
    const bath = bathMap.get(id);
    if (!bath) return;
    clearLift(bath);
    const keyMesh = keyForBath(key, bath.kind);
    bath.lift = { keyMesh, key, startedAt: performance.now() };
    bindBathFinish(bath.lift);
    bath.group.add(keyMesh);
  }

  function isLifting(keyId) {
    if (!keyId) return false;
    for (const bath of bathMap.values()) if (bath.lift?.key.id === keyId) return true;
    return false;
  }

  function bindBathKeys(bath, keys) {
    if (keys === bath.visualKeys) return;
    bath.visualKeys = keys;
    bath.slots.forEach((slot, index) => {
      const key = keys[index];
      const id = key?.id ?? null;
      if (slot.keyId === id) return;
      if (slot.keyMesh) {
        slot.holder.remove(slot.keyMesh);
        disposeKeySceneModel(slot.keyMesh);
      }
      slot.keyId = id;
      slot.keyMesh = key ? keyForBath(key, bath.kind) : null;
      if (slot.keyMesh) {
        bindBathFinish(slot);
        slot.holder.add(slot.keyMesh);
      }
    });
  }

  function animateBathKeys(bath, wallTime) {
    let drip = 0;
    for (let index = 0; index < bath.visualKeys.length; index++) {
      const key = bath.visualKeys[index];
      const slot = bath.slots[index];
      const progress = bathKeyProgress(key, bath.kind, wallTime);
      const dip = bath.kind === 'mud' ? waterDip(progress) : null;
      slot.keyMesh.position.y = dip ? dip.height : -.07;
      slot.keyMesh.rotation.set(dip ? -.53 : -1.04, .16, Math.sin(wallTime * .002 + index) * .11);
      if (dip) {
        applyBathFinish(slot, bath.kind, dip.remaining, key, cleaning);
        drip = Math.max(drip, dip.drip * dip.remaining);
      }
    }
    return drip;
  }

  function update(now) {
    const wallTime = Date.now();
    // Static pigment geometry and pooled sprites keep these effects inexpensive.
    for (const station of stations) {
      station.forge.embers.forEach((ember, index) => {
        if (index % 2 === 0) ember.scale.y = .72 + .27 * Math.sin(now * .0024 + index);
      });
      station.forge.visual.update(now);
      for (const bath of station.baths) {
        bath.waterMaterial.emissiveIntensity = .14 + .055 * Math.sin(now * .0015 + station.z);
        bindBathKeys(bath, keyIndex.bathKeys(bath.id));
        let drip = animateBathKeys(bath, wallTime);
        if (bath.lift) {
          const { startedAt, key, keyMesh } = bath.lift;
          const progress = Math.max(0, (now - startedAt) / BATH_LIFT_MS);
          if (progress >= 1) {
            clearLift(bath);
            onLiftDone?.(key);
          } else {
            const lift = Math.min(1, progress * 2.1);
            keyMesh.position.set(bath.x, bath.surfaceY - .06 + lift * .34, .1 + lift * .16);
            keyMesh.rotation.set(-1 + lift * .70, .20, -.20);
            // A lifted muddy key is already washed: no clods left to drop.
            applyBathFinish(bath.lift, bath.kind,
              bath.kind === 'rust' ? Math.max(0, 1 - (progress - .16) * 1.65) : 0, key,
              bath.kind === 'rust' ? cleaning : null);
            drip = Math.sin(progress * Math.PI);
          }
        }
        bath.visual.update(now, bath.visualKeys, wallTime, drip);
      }
    }
  }

  return { stations, interactables, getHoverSurface, update, liftKey, isLifting,
    startMelt(stationId = 'center') { forgeMap.get(stationId)?.visual.ignite(performance.now()); } };
}
