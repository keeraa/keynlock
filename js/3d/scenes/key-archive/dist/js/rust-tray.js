import * as THREE from '../vendor/three.js';
import { BATH_CAPACITY, FIXTURE_OFFSETS, SOAK_SECONDS, bathId } from './station-layout.js';
import { createBathEffects } from './station-visual-effects.js';

// The rust solution sits in a low rectangular ceramic tray; keys lie flat in
// one row under the liquid. Here: its shape, and how a key behaves in it.

// Rust tray: the key drops in and sinks with a splash, the solution reacts
// (smoke, fizzing rings), then its head floats up so it can be grabbed.
// The lift is short: players collect several keys in a row (tester feedback).
const TRAY_ENTRY_MS = 850, TRAY_FLOAT_MS = 1600;
export const TRAY_LIFT_MS = 1400;

function block(parent, dimensions, where, material) {
  const object = new THREE.Mesh(new THREE.BoxGeometry(...dimensions), material);
  object.position.set(...where);
  parent.add(object);
  return object;
}

export const RUST_TRAY = Object.freeze({ width: .94, depth: .56, wall: .045, base: .95, height: .12,
  surface: 1.035, slots: [-.31, -.105, .105, .31] });

function trayRing(outerW, outerD, wall) {
  const shape = new THREE.Shape();
  shape.moveTo(-outerW / 2, -outerD / 2); shape.lineTo(outerW / 2, -outerD / 2);
  shape.lineTo(outerW / 2, outerD / 2); shape.lineTo(-outerW / 2, outerD / 2); shape.closePath();
  const hole = new THREE.Path();
  const w = outerW / 2 - wall, d = outerD / 2 - wall;
  hole.moveTo(-w, -d); hole.lineTo(-w, d); hole.lineTo(w, d); hole.lineTo(w, -d); hole.closePath();
  shape.holes.push(hole);
  return shape;
}

export function createRustTray(group, station, spotTexture, ceramic) {
  const kind = 'rust';
  const x = FIXTURE_OFFSETS[kind];
  const id = bathId(station.id, kind);
  const { width, depth, wall, base, height, surface } = RUST_TRAY;
  const trayMaterial = new THREE.MeshStandardMaterial({ map: ceramic, color: 0x81936b, roughness: .68 });
  const lipMaterial = new THREE.MeshStandardMaterial({ map: ceramic, color: 0xaab792, roughness: .73 });
  const liquidMaterial = new THREE.MeshStandardMaterial({
    color: 0xa0a76e, roughness: .42, transparent: true, opacity: .78, depthWrite: false,
    blending: THREE.CustomBlending,
    blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    emissive: 0x302e16, emissiveIntensity: .17,
  });
  // Walls are one extruded ring (also the hover outline); base and lip apart.
  const walls = new THREE.ExtrudeGeometry(trayRing(width, depth, wall), { depth: height, bevelEnabled: false });
  walls.rotateX(-Math.PI / 2);
  const shell = new THREE.Mesh(walls, trayMaterial);
  shell.position.set(x, base - .02, .10);
  group.add(shell);
  block(group, [width - .01, .022, depth - .01], [x, base - .009, .10], trayMaterial);
  const lipGeometry = new THREE.ExtrudeGeometry(trayRing(width + .016, depth + .016, wall + .016),
    { depth: .014, bevelEnabled: false });
  lipGeometry.rotateX(-Math.PI / 2);
  const lip = new THREE.Mesh(lipGeometry, lipMaterial);
  lip.position.set(x, base - .02 + height, .10);
  group.add(lip);
  const liquid = block(group, [width - 2 * wall, .01, depth - 2 * wall], [x, surface, .10], liquidMaterial);
  liquid.renderOrder = 2;

  const collider = new THREE.Mesh(new THREE.BoxGeometry(width + .08, base + height - .87, depth + .08),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
  collider.position.set(x, (base + height + .87) / 2, .10);
  collider.userData = { kind: 'bath', id, bathKind: kind, stationId: station.id };
  group.add(collider);
  const slots = RUST_TRAY.slots.slice(0, BATH_CAPACITY).map(offset => {
    const holder = new THREE.Group();
    holder.position.set(x + offset, surface, .10);
    group.add(holder);
    return { holder, keyId: null, keyMesh: null, paint: null, crust: null };
  });
  return { id, kind, shell, slots, collider, waterMaterial: liquidMaterial, group, x, surfaceY: surface,
    lift: null, tray: true,
    visual: createBathEffects(group, x, kind, spotTexture, surface, .3), visualKeys: null };
}

const slotWorld = new THREE.Vector3();
export function animateTrayKey(bath, slot, key, index, wallTime, { effects = null, playSound = null } = {}) {
  const elapsed = wallTime - (key.bathUntil - SOAK_SECONDS.rust * 1000);
  const entry = Math.max(0, Math.min(1, elapsed / TRAY_ENTRY_MS));
  const fall = 1 - entry;
  const floating = Math.max(0, Math.min(1, (elapsed - TRAY_ENTRY_MS - 1200) / TRAY_FLOAT_MS));
  const float = floating * floating * (3 - 2 * floating);
  const bob = Math.sin(wallTime * .0015 + index) * .05;
  // Falls in tilted, lies flat under the liquid, then the head rises out.
  slot.keyMesh.position.y = -.03 + .36 * fall * fall + .02 * float;
  slot.keyMesh.rotation.set(-Math.PI / 2 + .9 * fall + .34 * float, 0, bob * (1 - fall));
  if (!effects) return;
  slot.holder.getWorldPosition(slotWorld);
  const surface = bath.group.position.y + bath.surfaceY;
  if (entry >= 1 && !slot.splashed) {
    slot.splashed = elapsed < TRAY_ENTRY_MS + 600;       // no splash for keys loaded from a save
    if (slot.splashed) {
      effects.ripple(slotWorld.x, surface, slotWorld.z, .16);
      effects.ripple(slotWorld.x, surface, slotWorld.z, .09);
      // The splash sound plays when the key actually meets the solution.
      playSound?.('rust', slotWorld.clone());
    }
    slot.splashed = true;
  }
  const soaking = entry >= 1 && wallTime < key.bathUntil;
  if (soaking && wallTime - slot.lastPuff > 380 + index * 37) {
    slot.lastPuff = wallTime;
    const along = (Math.random() - .5) * .26;
    effects.smoke(slotWorld.clone().add(new THREE.Vector3((Math.random() - .5) * .05, .02, along)),
      .05 + Math.random() * .04);
    if (Math.random() < .7) effects.ripple(slotWorld.x + (Math.random() - .5) * .05, surface,
      slotWorld.z + (Math.random() - .5) * .26, .035);
  }
}
