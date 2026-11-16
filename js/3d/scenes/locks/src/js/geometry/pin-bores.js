/** Drilled radial sockets in the rotating plug, following its curved barrel. */
export const PIN_BORE_RADIUS = .109;

/** Match CPU picking with the radial openings clipped by the plug shader. */
export function isPlugBoreOpening(localPoint, pinPositions) {
  if (localPoint.y <= .11) return false;
  return pinPositions.some(x => {
    const dx = localPoint.x - (x + 1.525);
    return dx * dx + localPoint.z * localPoint.z < PIN_BORE_RADIUS * PIN_BORE_RADIUS;
  });
}

/** Cut actual visible apertures from the top of the round keyway barrel. */
export function configurePlugBoreShader(material, {plugCutStart, plugCutEnd,
  plugSideReveal, plugBorePositions}) {
  material.onBeforeCompile=shader=>{
    shader.uniforms.uPlugCutStart=plugCutStart;
    shader.uniforms.uPlugCutEnd=plugCutEnd;
    shader.uniforms.uPlugSideReveal=plugSideReveal;
    shader.uniforms.uPlugBorePositions=plugBorePositions;
    shader.vertexShader=shader.vertexShader
      .replace('#include <common>','#include <common>\nvarying vec3 vPlugLocal;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\nvPlugLocal = position;');
    shader.fragmentShader=shader.fragmentShader
      .replace('#include <common>',`#include <common>
        varying vec3 vPlugLocal;
        uniform float uPlugBorePositions[6];
        uniform float uPlugCutStart;
        uniform float uPlugCutEnd;
        uniform float uPlugSideReveal;`)
      .replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>
        if (vPlugLocal.y > 0.11) {
          for (int i = 0; i < 6; i++) {
            vec2 bore = vec2(vPlugLocal.x - uPlugBorePositions[i], vPlugLocal.z);
            if (dot(bore, bore) < ${String(PIN_BORE_RADIUS * PIN_BORE_RADIUS)}) discard;
          }
        }`)
      .replace('#include <opaque_fragment>',`#include <opaque_fragment>
        float pinZoneIn = smoothstep(uPlugCutStart - 0.09,uPlugCutStart + 0.09,vPlugLocal.x);
        float pinZoneOut = 1.0 - smoothstep(uPlugCutEnd - 0.09,uPlugCutEnd + 0.09,vPlugLocal.x);
        gl_FragColor.a *= 1.0 - uPlugSideReveal * pinZoneIn * pinZoneOut;`);
  };
}

export function createPinBoreDetails({ THREE, pinPlug, mat, addMesh, tag,
  plugRadius = .286, count = 6 }) {
  const segments = 40;
  const wallVertices = [], wallUvs = [], wallIndices = [];
  for (let i = 0; i <= segments; i++) {
    const angle = i * Math.PI * 2 / segments;
    const x = PIN_BORE_RADIUS * Math.cos(angle);
    const z = PIN_BORE_RADIUS * Math.sin(angle);
    const rimY = Math.sqrt(plugRadius * plugRadius - z * z);
    wallVertices.push(x, rimY - .003, z, x, .066, z);
    wallUvs.push(i / segments, 1, i / segments, 0);
    if (i < segments) {
      const top = 2 * i, bottom = top + 1;
      // Faces point INTO the socket, where the user looks from above.
      wallIndices.push(top, bottom, top + 2, bottom, bottom + 2, top + 2);
    }
  }
  const liningGeometry = new THREE.BufferGeometry();
  liningGeometry.setAttribute('position', new THREE.Float32BufferAttribute(wallVertices, 3));
  liningGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(wallUvs, 2));
  liningGeometry.setIndex(wallIndices);
  liningGeometry.computeVertexNormals();

  const lipPoints = Array.from({ length: segments }, (_, i) => {
    const angle = i * Math.PI * 2 / segments;
    const x = PIN_BORE_RADIUS * Math.cos(angle);
    const z = PIN_BORE_RADIUS * Math.sin(angle);
    return new THREE.Vector3(x, Math.sqrt(plugRadius * plugRadius - z * z) + .002, z);
  });
  const lipGeometry = new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3(lipPoints, true, 'centripetal'), segments * 2, .005, 6, true);

  const groups = Array.from({ length: count }, (_, index) => {
    const group = new THREE.Group();
    pinPlug.add(group);
    const lining = addMesh(group, liningGeometry, mat.dark);
    const lip = addMesh(group, lipGeometry, mat.brass);
    lining.castShadow = false;
    lip.castShadow = false;
    tag(lip, `Гнездо кодового штифта ${index + 1}`,
      'Сквозная радиальная расточка сердцевины: нижний штифт входит сюда сверху.');
    return group;
  });

  function setPositions(positions) {
    groups.forEach((group, i) => {
      group.visible = i < positions.length;
      if (group.visible) group.position.x = positions[i];
    });
  }
  return { groups, setPositions };
}
