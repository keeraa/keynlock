import * as THREE from '../vendor/three.js';
import { createCombinedKeyGeometry, makeLabel } from './art.js?v=17';
import { getKeyPaint } from './painted-textures.js';
import { bathContents } from './rules.js';
import { BATH_CAPACITY, FIXTURE_OFFSETS, STATIONS, bathId } from './station-layout.js';

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

function rim(parent, radius, y, x, z, material) {
  const object = new THREE.Mesh(new THREE.TorusGeometry(radius, .052, 7, 28), material);
  object.rotation.x = -Math.PI / 2;
  object.position.set(x, y, z);
  parent.add(object);
  return object;
}

function addHoverRim(edge) {
  const material = new THREE.MeshBasicMaterial({
    color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, toneMapped: false,
  });
  const outline = new THREE.Mesh(edge.geometry, material);
  outline.scale.setScalar(1.09);
  outline.position.z = -.014;
  outline.visible = false;
  edge.add(outline);
  return { outline, material, hoverTarget: 0, hoverAmount: 0 };
}

function mountSign(group, label, materials, { x, y, z, width, height, supports }) {
  // Every floating-looking label is now a wooden plate on two metal uprights.
  block(group, [width + .12, height + .06, .075], [x, y, z - .04], materials.blackWood);
  const topOfPost = y - height / 2 + .04;
  const postFoot = .91;
  for (const dx of [-supports, supports]) {
    block(group, [.064, topOfPost - postFoot, .075],
      [x + dx, (topOfPost + postFoot) / 2, z - .065], materials.darkBrass);
  }
  label.position.set(x, y, z);
  group.add(label);
}

function createBath(group, station, kind, materials) {
  const x = FIXTURE_OFFSETS[kind];
  const id = bathId(station.id, kind);
  const waterMaterial = new THREE.MeshStandardMaterial({
    color: kind === 'mud' ? 0x617a72 : 0x9b7065,
    metalness: .06, roughness: .32, transparent: true, opacity: .93,
    emissive: kind === 'mud' ? 0x17302c : 0x342017, emissiveIntensity: .17,
  });
  cylinder(group, .52, .47, .30, [x, 1.07, .10], materials.darkBrass, 18);
  cylinder(group, .44, .44, .02, [x, 1.23, .10], waterMaterial, 22);
  const edge = rim(group, .51, 1.24, x, .10, materials.brass);
  const mark = makeLabel(kind === 'mud' ? 'ВОДА' : 'РАСТВОР',
    kind === 'mud' ? 'грязь · 5 сек' : 'ржавчина · 7 сек',
    { worldWidth: 1.35, worldHeight: .42, fontSize: 100, width: 600, height: 220 });
  mountSign(group, mark, materials,
    { x, y: 1.66, z: .43, width: 1.35, height: .42, supports: .58 });
  const collider = new THREE.Mesh(new THREE.BoxGeometry(1.18, .78, .98),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
  collider.position.set(x, 1.22, .13);
  collider.userData = { kind: 'bath', id, bathKind: kind, stationId: station.id };
  group.add(collider);
  const slots = [];
  for (let index = 0; index < BATH_CAPACITY; index++) {
    const holder = new THREE.Group();
    holder.position.set(x + (index % 2 ? .19 : -.19), 1.235,
      .10 + (index < 2 ? -.18 : .18));
    group.add(holder);
    // A pale four-place rack is visible even when nothing is soaking.
    cylinder(holder, .035, .035, .012, [0, .012, 0], materials.brass, 9);
    slots.push({ holder, keyId: null, keyMesh: null });
  }
  return { id, kind, edge, slots, collider, waterMaterial, ...addHoverRim(edge) };
}

function createForge(group, station, materials) {
  const x = FIXTURE_OFFSETS.forge;
  const soot = new THREE.MeshStandardMaterial({ color: 0x453733, roughness: 1 });
  const ember = new THREE.MeshBasicMaterial({ color: 0xef8b45 });
  const hotMetal = new THREE.MeshBasicMaterial({ color: 0xc96d36, transparent: true, opacity: .84 });
  cylinder(group, .54, .39, .65, [x, 1.11, .08], materials.blackWood, 18);
  cylinder(group, .52, .46, .67, [x, 1.14, .08], materials.darkBrass, 18, true);
  cylinder(group, .43, .43, .022, [x, 1.48, .08], soot, 24);
  cylinder(group, .33, .33, .025, [x, 1.505, .08], hotMetal, 24);
  const edge = rim(group, .53, 1.47, x, .08, materials.brass);
  const embers = [];
  for (let index = 0; index < 6; index++) {
    const angle = index / 6 * Math.PI * 2;
    const pebble = cylinder(group, .045 + (index % 3) * .012, .06, .06,
      [Math.cos(angle) * .21, 1.53, .08 + Math.sin(angle) * .21], index % 2 ? ember : soot, 8);
    embers.push(pebble);
  }
  const mark = makeLabel('ПЛАВИЛЬНЯ', 'сломанные · +1 металл',
    { worldWidth: 1.65, worldHeight: .43, fontSize: 82, width: 700, height: 220 });
  mountSign(group, mark, materials,
    { x, y: 1.96, z: .44, width: 1.65, height: .43, supports: .72 });
  const collider = new THREE.Mesh(new THREE.CylinderGeometry(.69, .69, .94, 14),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
  collider.position.set(x, 1.29, .08);
  collider.userData = { kind: 'forge', stationId: station.id };
  group.add(collider);
  return { edge, embers, collider, ...addHoverRim(edge) };
}

export function createWorkstations(scene, materials, state) {
  const stations = [];
  const interactables = [];
  const bathMap = new Map();
  const forgeMap = new Map();
  for (const station of STATIONS) {
    const group = new THREE.Group();
    group.position.set(station.x, 0, station.z);
    scene.add(group);
    // Low, open workbench: the hall remains readable and cabinets stay visible.
    block(group, [5.05, .16, 1.62], [0, .81, .08], materials.wood);
    block(group, [4.92, .045, 1.48], [0, .905, .08], materials.darkBrass);
    for (const x of [-2.29, 2.29]) for (const z of [-.55, .69])
      block(group, [.16, .80, .16], [x, .38, z], materials.darkWood);
    block(group, [4.86, .12, .27], [0, .29, -.49], materials.blackWood);
    block(group, [4.86, .12, .27], [0, .29, .67], materials.blackWood);
    const title = makeLabel(`СТАНЦИЯ · ${station.name}`, 'отмачивание · очистка · переплавка',
      { worldWidth: 3.8, worldHeight: .65, fontSize: 71 });
    mountSign(group, title, materials,
      { x: 0, y: 2.47, z: -.52, width: 3.8, height: .65, supports: 1.65 });
    const baths = ['mud', 'rust'].map(kind => createBath(group, station, kind, materials));
    const forge = createForge(group, station, materials);
    for (const bath of baths) {
      bathMap.set(bath.id, bath);
      interactables.push(bath.collider);
    }
    forgeMap.set(station.id, forge);
    interactables.push(forge.collider);
    stations.push({ ...station, group, baths, forge });
  }

  const hoverFixtures = [...bathMap.values(), ...forgeMap.values()];
  let lastHoverFrame = performance.now();
  function highlight(target) {
    const fixture = target?.kind === 'bath' ? bathMap.get(target.id) :
      target?.kind === 'forge' ? forgeMap.get(target.stationId) : null;
    for (const current of hoverFixtures) current.hoverTarget = current === fixture ? 1 : 0;
  }

  const keyMaterials = new Map();
  function refreshBaths(now = Date.now()) {
    for (const bath of bathMap.values()) {
      const contents = bathContents(state, bath.id, now).keys;
      bath.slots.forEach((slot, index) => {
        const key = contents[index];
        if (slot.keyId !== (key?.id || null)) {
          if (slot.keyMesh) {
            slot.holder.remove(slot.keyMesh);
            slot.keyMesh = null;
          }
          slot.keyId = key?.id || null;
          if (key) {
            if (!keyMaterials.has(key.type)) keyMaterials.set(key.type,
              new THREE.MeshStandardMaterial({ map: getKeyPaint(key.type), color: 0xe6d1a8,
                roughness: .75, metalness: .16 }));
            slot.keyMesh = new THREE.Mesh(createCombinedKeyGeometry(key.type), keyMaterials.get(key.type));
            slot.keyMesh.rotation.x = -Math.PI / 2;
            slot.keyMesh.scale.setScalar(.22);
            slot.holder.add(slot.keyMesh);
          }
        }
        if (slot.keyMesh) {
          const ready = now >= key.bathUntil;
          slot.keyMesh.position.y = ready ? .15 : .035;
          slot.keyMesh.rotation.z = Math.sin(now * .001 + index) * .06;
        }
      });
    }
  }

  function update(now) {
    const dt = Math.max(0, Math.min(.1, (now - lastHoverFrame) / 1000));
    lastHoverFrame = now;
    const hoverFactor = 1 - Math.exp(-dt / .15);
    for (const fixture of hoverFixtures) {
      fixture.hoverAmount += (fixture.hoverTarget - fixture.hoverAmount) * hoverFactor;
      fixture.material.opacity = fixture.hoverAmount;
      fixture.outline.visible = fixture.hoverAmount > .005;
    }
    // The hot metal breathes softly; no dynamic shadow-casting lights or particles.
    for (const station of stations) {
      station.forge.embers.forEach((ember, index) => {
        if (index % 2 === 0) ember.scale.y = .72 + .27 * Math.sin(now * .0024 + index);
      });
      for (const bath of station.baths)
        bath.waterMaterial.emissiveIntensity = .14 + .055 * Math.sin(now * .0015 + station.z);
    }
    refreshBaths(Date.now());
  }

  refreshBaths();
  return { stations, interactables, highlight, refreshBaths, update };
}
