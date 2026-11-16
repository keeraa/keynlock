// Soft sun shafts originate in the *room*. Their projected vanishing points
// and travel directions are refreshed with the orbit camera every frame.
// The screen quad only draws the haze; the beams track real 3D anchors.
export function createSunbeams(THREE) {
  const overlay = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const geometry = new THREE.PlaneGeometry(2, 2);
  const time = { value: 0 };
  const intensity = { value: 1 };
  const shafts = {};
  const rays = {
    left: {
      origin: new THREE.Vector3(-8, 7.5, -5),
      end: new THREE.Vector3(5, -10, 2)
    },
    right: {
      origin: new THREE.Vector3(8, 7.5, -5),
      end: new THREE.Vector3(-5, -10, 2)
    }
  };
  const projectedOrigin = new THREE.Vector3();
  const projectedEnd = new THREE.Vector3();

  for (const side of ['left', 'right']) {
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: time, uIntensity: intensity,
        uOrigin: { value: new THREE.Vector2(side === 'left' ? 0 : 1, 1.08) },
        uDirection: { value: new THREE.Vector2(side === 'left' ? .4 : -.4, -.92) },
        uSpan: { value: 1.9 },
        uProjectionValid: { value: 1 }
      },
      transparent: true, depthTest: false, depthWrite: false,
      blending: THREE.AdditiveBlending, toneMapped: false,
      vertexShader: `varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }`,
      fragmentShader: `uniform float uTime;
        uniform float uIntensity;
        uniform vec2 uOrigin;
        uniform vec2 uDirection;
        uniform float uSpan;
        uniform float uProjectionValid;
        varying vec2 vUv;
        void main() {
          // Ray distance is measured relative to a 3D world-space source
          // projected by the *live* scene camera, not a fixed screen corner.
          vec2 offset = vUv - uOrigin;
          float travel = dot(offset, uDirection);
          float sideways = dot(offset, vec2(-uDirection.y, uDirection.x));
          float spanScale = clamp(uSpan / 1.9, .65, 1.7);
          float rays = 0.0;
          for (int i = 0; i < 5; i++) {
            float k = float(i);
            float fanAngle = (k - 2.0) * .104;
            float axis = fanAngle * max(travel, 0.0);
            float width = (.010 + max(travel, 0.0) * (.032 + k * .0015)) * spanScale;
            float distanceToRay = (sideways - axis) / width;
            float feather = exp(-distanceToRay * distanceToRay * 1.15);
            float drift = .88 + .12 * sin(uTime * .17 + travel * 4.2 + k * 2.3);
            rays += feather * drift * (.72 + .09 * sin(k * 2.1));
          }
          float haze = exp(-pow(sideways / (.13 + max(travel, 0.0) * .21), 2.0));
          // Extend off the viewport edge instead of ending on a plane.
          float onset = smoothstep(-.015, .17, travel);
          float alpha = (rays * .062 + haze * .008) * onset * uIntensity * uProjectionValid;
          gl_FragColor = vec4(.99, .84, .62, clamp(alpha, 0.0, .24));
          #include <colorspace_fragment>
        }`
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `sunbeams-${side}`;
    mesh.frustumCulled = false;
    mesh.castShadow = mesh.receiveShadow = false;
    overlay.add(mesh);
    shafts[side] = mesh;
  }
  shafts.left.visible = false;
  shafts.right.visible = true;

  function setVisible(side, visible) {
    if (!shafts[side]) return false;
    shafts[side].visible = Boolean(visible);
    return true;
  }
  function update(t, strength = 1, sceneCamera = null) {
    time.value = t;
    intensity.value = Math.max(.2, Math.min(1.7, strength));
    if (!sceneCamera) return;
    for (const side of ['left', 'right']) {
      const material = shafts[side].material;
      const { origin, end } = rays[side];
      projectedOrigin.copy(origin).project(sceneCamera);
      projectedEnd.copy(end).project(sceneCamera);
      const startX = projectedOrigin.x * .5 + .5;
      const startY = projectedOrigin.y * .5 + .5;
      const dx = (projectedEnd.x - projectedOrigin.x) * .5;
      const dy = (projectedEnd.y - projectedOrigin.y) * .5;
      const length = Math.hypot(dx, dy);
      material.uniforms.uOrigin.value.set(startX, startY);
      material.uniforms.uDirection.value.set(dx / Math.max(.0001, length), dy / Math.max(.0001, length));
      material.uniforms.uSpan.value = length;
      material.uniforms.uProjectionValid.value = projectedOrigin.z < 1 && length > .02 ? 1 : 0;
    }
  }
  function render(renderer) {
    if (shafts.left.visible || shafts.right.visible) renderer.render(overlay, camera);
  }

  return { ...shafts, setVisible, update, render,
    getState: () => ({ left: shafts.left.visible, right: shafts.right.visible }) };
}
