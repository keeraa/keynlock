// Back-face silhouette used by the lair's Village Engine ink renderer.
// Reuse the source geometry and one material across static batches and moving frames.
export function createLairInk(THREE) {
  const instancedShells = new Set();
  const material = new THREE.ShaderMaterial({
    uniforms: { inkColor: {value: new THREE.Color(0x2b241d)} },
    side: THREE.BackSide, depthWrite: false, toneMapped: false,
    vertexShader: `
      void main() {
        vec4 point = vec4(position, 1.0);
        vec3 surfaceNormal = normal;
        #ifdef USE_INSTANCING
          point = instanceMatrix * point;
          mat3 transform = mat3(instanceMatrix);
          surfaceNormal /= vec3(dot(transform[0], transform[0]), dot(transform[1], transform[1]), dot(transform[2], transform[2]));
          surfaceNormal = transform * surfaceNormal;
        #endif
        vec4 eye = modelViewMatrix * point;
        vec4 clip = projectionMatrix * eye;
        vec3 outward = normalize(normalMatrix * surfaceNormal);
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
  function shell(geometry, source) {
    const mesh = source?.isInstancedMesh ? new THREE.InstancedMesh(geometry, material, source.count) : new THREE.Mesh(geometry, material);
    if (source?.isInstancedMesh) {
      mesh.instanceMatrix = source.instanceMatrix;
      instancedShells.add(mesh);
    }
    mesh.name = 'lair-ink-silhouette';
    mesh.userData.inkOutlineShell = true;
    mesh.renderOrder = 1;
    mesh.raycast = () => {};
    return mesh;
  }
  function add(root) {
    const meshes=[];
    root.traverse(node=>{
      if(node.isMesh && !node.userData.inkOutlineShell && !node.userData.excludeFromInk &&
          ![].concat(node.material).some(material=>material?.transparent) &&
          !node.children.some(child=>child.userData.inkOutlineShell))meshes.push(node);
    });
    for(const mesh of meshes)mesh.add(shell(mesh.geometry,mesh));
  }
  return {shell,add,setEnabled(on) { material.visible = on; }, dispose() {
    for (const mesh of instancedShells) mesh.dispose();
    instancedShells.clear();material.dispose();
  }};
}
