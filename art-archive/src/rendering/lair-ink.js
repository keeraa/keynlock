// Back-face silhouette used by the lair's Village Engine ink renderer.
// Reuse the source geometry and one material across static batches and moving frames.
export function createLairInk(THREE) {
  const material = new THREE.ShaderMaterial({
    uniforms: { inkColor: {value: new THREE.Color(0x2b241d)} },
    side: THREE.BackSide, depthWrite: false, toneMapped: false,
    vertexShader: `
      void main() {
        vec4 eye = modelViewMatrix * vec4(position, 1.0);
        vec4 clip = projectionMatrix * eye;
        vec3 outward = normalize(normalMatrix * normal);
        vec2 direction = outward.xy * vec2(projectionMatrix[0][0], projectionMatrix[1][1]);
        float len = length(direction);
        if (len > 0.0001) {
          float breadth = min(0.0031, 0.035 * projectionMatrix[1][1] / max(1.0, -eye.z));
          clip.xy += direction / len * clip.w * breadth * 0.65;
        }
        clip.xy += clip.w * vec2(0.00008, -0.00011);
        gl_Position = clip;
      }`,
    fragmentShader: `uniform vec3 inkColor;
      void main() { gl_FragColor = vec4(inkColor, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  function shell(geometry) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = 'lair-ink-silhouette';
    mesh.userData.inkOutlineShell = true;
    mesh.renderOrder = 1;
    mesh.raycast = () => {};
    return mesh;
  }
  return {shell, setEnabled(on) { material.visible = on; }, dispose() { material.dispose(); }};
}
