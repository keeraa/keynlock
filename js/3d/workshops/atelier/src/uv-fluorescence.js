/**
 * A projected UV inspection lamp. Both the indigo pool of light and the
 * fluorescent halo are shaded on the actual canvas plane, so they follow
 * the painting through camera zooms and rotations.
 */
export function createUVFluorescence({ THREE, width, height, damageCanvas }) {
  const texture = new THREE.CanvasTexture(damageCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  const uniforms = {
    tDefects: { value: texture },
    uBeam: { value: new THREE.Vector2(-2, -2) },
    uScale: { value: new THREE.Vector2(width / Math.min(width, height), height / Math.min(width, height)) },
    uTexel: { value: new THREE.Vector2(1 / damageCanvas.width, 1 / damageCanvas.height) },
    uTime: { value: 0 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      varying vec2 vUv;
      uniform sampler2D tDefects;
      uniform vec2 uBeam;
      uniform vec2 uScale;
      uniform vec2 uTexel;
      uniform float uTime;

      void main() {
        float dist = length((vUv - uBeam) * uScale);
        float core = 1.0 - smoothstep(.065, .185, dist);
        float penumbra = 1.0 - smoothstep(.13, .32, dist);
        float halo = 1.0 - smoothstep(.22, .43, dist);
        if (halo < .001) discard;

        vec4 damage = texture2D(tDefects, vUv);
        vec4 blur = vec4(0.0);
        vec2 stepUv = uTexel * 5.5;
        blur += texture2D(tDefects, vUv + vec2(stepUv.x, 0.0));
        blur += texture2D(tDefects, vUv - vec2(stepUv.x, 0.0));
        blur += texture2D(tDefects, vUv + vec2(0.0, stepUv.y));
        blur += texture2D(tDefects, vUv - vec2(0.0, stepUv.y));
        blur += texture2D(tDefects, vUv + stepUv);
        blur += texture2D(tDefects, vUv - stepUv);
        blur += texture2D(tDefects, vUv + vec2(stepUv.x, -stepUv.y));
        blur += texture2D(tDefects, vUv + vec2(-stepUv.x, stepUv.y));
        blur /= 8.0;

        // UV excites the pale cyan / violet defect pigments, with a soft
        // outward bloom computed only over the painting's illuminated area.
        float flicker = .985 + .015 * sin(uTime * 8.1);
        vec3 lightPool = vec3(.19, .16, .64) * (core * .32 + penumbra * .22 + halo * .07);
        vec3 fluorescence = damage.rgb * damage.a * core * 3.3 +
          blur.rgb * blur.a * penumbra * 1.4;
        float alpha = clamp(core * .38 + penumbra * .22 + halo * .09 +
          damage.a * core * .8 + blur.a * penumbra * .5, 0.0, .98);
        gl_FragColor = vec4((lightPool + fluorescence) * flicker, alpha);
      }
    `,
    blending: THREE.AdditiveBlending,
    depthTest: true, depthWrite: false,
    transparent: true, opacity: .99, toneMapped: false,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
  mesh.position.z = .196;
  mesh.renderOrder = 12;
  mesh.frustumCulled = false;
  mesh.userData.excludeFromInk = true;
  mesh.visible = false;

  return {
    mesh,
    setPointer(point) {
      mesh.visible = Boolean(point);
      if (point) uniforms.uBeam.value.copy(point);
    },
    setTime(seconds) { uniforms.uTime.value = seconds; },
    refresh() { texture.needsUpdate = true; },
    dispose() {
      mesh.parent?.remove(mesh);
      mesh.geometry.dispose();
      material.dispose();
      texture.dispose();
    },
  };
}
