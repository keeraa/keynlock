import * as THREE from '../vendor/three.js';

// Small world-space pieces for the cleaning stations (Key Forge animations,
// adapted to the first-person hall): mud clods dropping into the water,
// rust flakes fluttering into the solution, wax beads falling into a candle
// flame, rings on the liquid and the glint of a freshly cleaned key.
// Everything is pooled per kind, a few dozen meshes at most, and removed as
// soon as it lands or fades.

const MUD = ['#4e3924', '#3d2b1a', '#5c4429'];
const RUST = ['#8a3f1c', '#a9552a', '#6b3018', '#b8693a'];
const WAX = '#e4cf9f';
const GRAVITY = 4.2;
export const SHINE_MS = 1100;

function starTexture() {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const glow = ctx.createRadialGradient(32, 32, 0, 32, 32, 20);
  glow.addColorStop(0, 'rgba(255,255,255,1)');
  glow.addColorStop(1, 'rgba(255,248,220,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  for (const [dx, dy] of [[0, -30], [30, 0], [0, 30], [-30, 0]]) {
    ctx.moveTo(32, 32);
    ctx.lineTo(32 + dx + dy * .08, 32 + dy - dx * .08);
    ctx.lineTo(32 + dx - dy * .08, 32 + dy + dx * .08);
  }
  ctx.fill();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function softTexture() {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const puff = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  puff.addColorStop(0, 'rgba(255,255,255,.9)');
  puff.addColorStop(.55, 'rgba(255,255,255,.35)');
  puff.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = puff;
  ctx.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createCleaningEffects(scene, camera) {
  const root = new THREE.Group();
  root.name = 'cleaning-effects';
  scene.add(root);
  const chunkGeometry = new THREE.IcosahedronGeometry(1, 0);
  const flakeGeometry = new THREE.PlaneGeometry(1, .7);
  const dropGeometry = new THREE.SphereGeometry(1, 8, 6);
  const ringGeometry = new THREE.RingGeometry(.82, 1, 24).rotateX(-Math.PI / 2);
  const starGeometry = new THREE.PlaneGeometry(1, 1);
  const materials = {
    mud: MUD.map(color => new THREE.MeshStandardMaterial({ color, roughness: 1, flatShading: true })),
    rust: RUST.map(color => new THREE.MeshStandardMaterial({ color, roughness: 1, side: THREE.DoubleSide })),
    wax: new THREE.MeshStandardMaterial({ color: WAX, roughness: .5, emissive: '#5a3a12', emissiveIntensity: .16 }),
    star: new THREE.MeshBasicMaterial({ map: starTexture(), transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, color: '#fff6dc' }),
  };
  const smokeMap = softTexture();
  const falling = [];
  const rings = [];
  const stars = [];
  const puffs = [];

  // A wisp of reaction smoke rising from the rust solution.
  function smoke(position, size = .06, color = '#d9d0bd') {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeMap, color,
      transparent: true, opacity: 0, depthWrite: false }));
    sprite.position.copy(position);
    sprite.scale.setScalar(size);
    sprite.userData = { age: 0, life: 1.8 + Math.random() * .8, size,
      drift: new THREE.Vector3((Math.random() - .5) * .05, .13 + Math.random() * .06, (Math.random() - .5) * .05) };
    root.add(sprite);
    puffs.push(sprite);
  }

  // A piece falls (with a little drag for flakes) until it reaches `landY`.
  function drop(kind, position, size, landY, { onLand } = {}) {
    const palette = materials[kind];
    const material = Array.isArray(palette) ? palette[Math.floor(Math.random() * palette.length)] : palette;
    const geometry = kind === 'mud' ? chunkGeometry : kind === 'rust' ? flakeGeometry : dropGeometry;
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(position);
    mesh.scale.set(size, kind === 'mud' ? size * .75 : size, size);
    mesh.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
    mesh.castShadow = false;
    mesh.userData = { kind, velocity: 0, landY, onLand, spin: (Math.random() - .5) * 7,
      phase: Math.random() * 6, delay: Math.random() * .12 };
    root.add(mesh);
    falling.push(mesh);
    return mesh;
  }

  function ripple(x, y, z, size = .09) {
    const material = new THREE.MeshBasicMaterial({ color: '#eef7f4', transparent: true,
      opacity: .75, depthWrite: false, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(ringGeometry, material);
    mesh.position.set(x, y + .003, z);
    mesh.scale.setScalar(.01);
    mesh.userData = { age: 0, size };
    root.add(mesh);
    rings.push(mesh);
  }

  // Glint on a model: stars at points of its own geometry, facing the camera.
  // `attachTo` keeps the stars with a moving parent (the hand follows the camera).
  // `size` fixes the star size (a cabinet is far larger than a key).
  function shine(model, count = 5, { attachTo = root, size = null } = {}) {
    if (!model) return;
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model);
    if (box.isEmpty()) return;
    const meshes = [];
    model.traverse(object => { if (object.isMesh) meshes.push(object); });
    for (let i = 0; i < count; i++) {
      const source = meshes[Math.floor(Math.random() * meshes.length)];
      const position = source?.geometry.getAttribute('position');
      const local = new THREE.Vector3();
      if (position?.count) local.fromBufferAttribute(position, Math.floor(Math.random() * position.count));
      const point = source ? source.localToWorld(local) : box.getCenter(new THREE.Vector3());
      const star = new THREE.Mesh(starGeometry, materials.star.clone());
      attachTo.updateMatrixWorld(true);
      star.position.copy(attachTo.worldToLocal(point));
      star.renderOrder = 5;
      star.userData = { age: -i * .13, size: size ?? box.getSize(new THREE.Vector3()).length() * .22,
        spin: (Math.random() - .5) * 2 };
      star.scale.setScalar(0);
      star.userData.size /= attachTo.getWorldScale(new THREE.Vector3()).x || 1;
      star.userData.parent = attachTo;
      attachTo.add(star);
      stars.push(star);
    }
  }

  function update(dt, now = performance.now()) {
    for (let i = puffs.length - 1; i >= 0; i--) {
      const puff = puffs[i];
      const data = puff.userData;
      data.age += dt;
      const life = data.age / data.life;
      if (life >= 1) { root.remove(puff); puff.material.dispose(); puffs.splice(i, 1); continue; }
      puff.position.addScaledVector(data.drift, dt);
      puff.scale.setScalar(data.size * (1 + 2.2 * life));
      puff.material.opacity = .38 * Math.sin(Math.PI * Math.min(1, life * 1.4)) * (1 - life);
    }
    for (let i = falling.length - 1; i >= 0; i--) {
      const piece = falling[i];
      const data = piece.userData;
      if ((data.delay -= dt) > 0) continue;
      const drag = data.kind === 'rust' ? 1.1 : 6;          // flakes flutter
      data.velocity = Math.min(drag, data.velocity + GRAVITY * dt);
      piece.position.y -= data.velocity * dt;
      if (data.kind === 'rust') piece.position.x += Math.sin(now * .005 + data.phase) * .12 * dt;
      piece.rotation.x += data.spin * dt;
      piece.rotation.z += data.spin * .6 * dt;
      if (piece.position.y <= data.landY) {
        data.onLand?.(piece.position);
        root.remove(piece);
        falling.splice(i, 1);
      }
    }
    for (let i = rings.length - 1; i >= 0; i--) {
      const ring = rings[i];
      ring.userData.age += dt;
      const life = ring.userData.age / .55;
      ring.scale.setScalar(.01 + ring.userData.size * life);
      ring.material.opacity = .75 * (1 - life);
      if (life >= 1) { root.remove(ring); ring.material.dispose(); rings.splice(i, 1); }
    }
    for (let i = stars.length - 1; i >= 0; i--) {
      const star = stars[i];
      star.userData.age += dt;
      const life = star.userData.age / .5;
      if (life >= 1) { star.userData.parent.remove(star); star.material.dispose(); stars.splice(i, 1); continue; }
      const s = life <= 0 ? 0 : Math.sin(Math.PI * life);
      const parentTurn = star.userData.parent.getWorldQuaternion(new THREE.Quaternion()).invert();
      star.quaternion.copy(parentTurn.multiply(camera.getWorldQuaternion(new THREE.Quaternion())));
      star.rotateZ(star.userData.spin * Math.max(0, life));
      star.scale.setScalar(star.userData.size * s);
      star.material.opacity = s;
    }
  }

  return {
    drop, ripple, shine, smoke, update,
    get active() { return falling.length + rings.length + stars.length + puffs.length; },
  };
}
