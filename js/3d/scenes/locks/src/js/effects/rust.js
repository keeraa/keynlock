/** Procedural oxidation, individual material states and incremental cleaning. */
export function createRustSystem(THREE, rand) {
  function makeRustGrain() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#e4d7c8';
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 3200; i++) {
      const x = rand() * 256, y = rand() * 256, r = .4 + rand() * 3;
      ctx.fillStyle = rand() > .4 ? `rgba(118,55,24,${.10 + rand() * .55})`
        : `rgba(65,50,42,${.04 + rand() * .25})`;
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * (.35 + rand() * 1.25), rand() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2, 2);
    texture.anisotropy = 4;
    return texture;
  }

  const rustGrain = makeRustGrain();
  function updateRustMaterial(mesh) {
    const data = mesh.userData.rustState;
    if (!data) return;
    mesh.material.color.copy(data.cleanColor).lerp(data.oxidizedColor, data.level * .73);
    mesh.material.roughness = Math.min(.97, data.cleanRoughness + data.level * .29);
    if (data.level < .025 && mesh.material.map === rustGrain) {
      mesh.material.map = null;
      mesh.material.needsUpdate = true;
    }
  }

  function rustify(mesh, level) {
    if (!mesh?.isMesh || !mesh.material?.isMeshStandardMaterial) return;
    const original = mesh.material;
    mesh.material = original.clone();
    mesh.material.map = rustGrain;
    mesh.material.needsUpdate = true;
    mesh.userData.rustState = {
      level,
      cleanColor: original.color.clone(),
      oxidizedColor: new THREE.Color(0x854729),
      cleanRoughness: original.roughness,
    };
    updateRustMaterial(mesh);
  }

  return { rustify, updateRustMaterial };
}
