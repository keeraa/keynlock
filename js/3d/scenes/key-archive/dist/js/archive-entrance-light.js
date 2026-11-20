import * as THREE from '../vendor/three.js';
import { floorSurfaceY, RUG_TOP } from './floor-contact.js';
import { WINDOW_WASHES, WINDOW_BEAM_GLSL } from './window-beam-light.js';

export { WINDOW_WASHES } from './window-beam-light.js';

export const birdShadowGlsl = `
  uniform sampler2D uWindowBirdMap;
  uniform vec4 uWindowBirdPose;
  uniform vec4 uWindowBirdProjection;
  uniform vec2 uWindowBirdSize;
  float birdShade(vec3 worldPosition) {
    if (uWindowBirdPose.z == 0.0) return 1.0;
    float distanceToBird = worldPosition.x - uWindowBirdProjection.x;
    vec2 birdPoint = vec2(worldPosition.z + distanceToBird * uWindowBirdProjection.z,
      worldPosition.y + distanceToBird * uWindowBirdProjection.y);
    vec2 uv = (birdPoint - uWindowBirdPose.yx) *
      vec2(uWindowBirdPose.w, 1.0) / uWindowBirdSize + .5;
    if (min(uv.x, uv.y) < .05 || max(uv.x, uv.y) > .95) return 1.0;
    float shadow = texture2D(uWindowBirdMap, uv).a * .36;
    shadow += texture2D(uWindowBirdMap, uv + vec2(.048, .035)).a * .16;
    shadow += texture2D(uWindowBirdMap, uv + vec2(-.048, .035)).a * .16;
    shadow += texture2D(uWindowBirdMap, uv + vec2(.048, -.035)).a * .16;
    shadow += texture2D(uWindowBirdMap, uv + vec2(-.048, -.035)).a * .16;
    return 1.0 - shadow * .86 * uWindowBirdPose.z;
  }`;

const vertexShader = `
  varying vec2 vPaintUv;
  varying float vEntrance;
  varying vec2 vFloorPosition;
  void main() {
    vPaintUv = uv;
    vec4 local = vec4(position, 1.0);
    #ifdef USE_INSTANCING
      local = instanceMatrix * local;
    #endif
    vec3 world = (modelMatrix * local).xyz;
    vEntrance = smoothstep(11.5, 15.5, world.z);
    vFloorPosition = world.xz;
    gl_Position = projectionMatrix * modelViewMatrix * local;
  }`;

function paintMaterial(color, strength, brush, helpers = '') {
  return new THREE.ShaderMaterial({
    uniforms: { ink: { value: new THREE.Color(color) }, strength: { value: strength } },
    vertexShader,
    fragmentShader: `
      uniform vec3 ink;
      uniform float strength;
      varying vec2 vPaintUv;
      varying float vEntrance;
      ${helpers}
      void main() {
        vec2 p = vPaintUv * 2.0 - 1.0;
        ${brush}
        gl_FragColor = vec4(ink, strength * coverage);
        #include <colorspace_fragment>
      }`,
    transparent: true, depthWrite: false, toneMapped: false,
  });
}

export function addEntranceLighting(scene, birdShadow) {
  const base = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const cool = paintMaterial(0xa7c5f1, 0, `
    vec3 point = vec3(vFloorPosition.x, ${RUG_TOP.toFixed(6)}, vFloorPosition.y);
    float coverage = archiveWindowLightAt(point);
    if (coverage > .001) coverage *= birdShade(point);
  `, WINDOW_BEAM_GLSL + birdShadowGlsl + 'varying vec2 vFloorPosition;');
  Object.assign(cool.uniforms, birdShadow);
  function addWash(area, material) {
    const mesh = new THREE.Mesh(base, material);
    mesh.scale.set(area.width, 1, area.depth);
    mesh.position.set(area.x, RUG_TOP + .0018, area.z);
    mesh.renderOrder = 1;
    scene.add(mesh);
  }
  WINDOW_WASHES.forEach(wash => addWash(wash, cool));

  // The work lamp falls off near the table instead of painting a second pool on the rug.
  const worklight = new THREE.SpotLight(0xffbc75, 88, 4.30, .78, .70, 2);
  worklight.position.set(-.45, 3.65, 1.55);
  worklight.target.position.set(0, 1.03, .05);
  scene.add(worklight, worklight.target);

  return (strength, tint = 0xa7c5f1) => {
    cool.uniforms.strength.value = .095 * strength;
    cool.uniforms.ink.value.setHex(tint);
  };
}

export function createEntranceContactShadows(scene, keys) {
  const material = paintMaterial(0x241922, .44, `
    float stem = exp(-dot((p - vec2(-.03, -.19)) / vec2(.25, .50),
                         (p - vec2(-.03, -.19)) / vec2(.25, .50)) * 1.35);
    float bow = exp(-dot((p - vec2(.05, .39)) / vec2(.50, .34),
                        (p - vec2(.05, .39)) / vec2(.50, .34)) * 1.7);
    float coverage = max(stem * .84, bow) * vEntrance *
      (1.0 - smoothstep(.80, 1.0, max(abs(p.x), abs(p.y))));
  `);
  const shadows = new THREE.InstancedMesh(new THREE.PlaneGeometry(.39, .77).rotateX(-Math.PI / 2), material, keys.length);
  shadows.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  shadows.frustumCulled = false;
  shadows.renderOrder = 2;
  scene.add(shadows);
  const index = new Map(keys.map((key, slot) => [key.id, slot]));
  const pose = new THREE.Object3D();
  return (key, visible) => {
    const slot = index.get(key.id);
    if (slot === undefined) return;
    pose.position.set(key.x, floorSurfaceY(key.x, key.z) + .0032, key.z);
    pose.rotation.y = key.rotation || 0;
    const scale = visible && key.z > 11.5 ? 1 : .000001;
    pose.scale.set(scale, scale, scale * (key.broken ? .79 : 1));
    pose.updateMatrix();
    shadows.setMatrixAt(slot, pose.matrix);
    shadows.instanceMatrix.needsUpdate = true;
  };
}

export function createEntranceKeyMaterial(source, windowDaylight, windowWarmth, birdShadow) {
  const material = source.clone();
  material.onBeforeCompile = (shader, renderer) => {
    source.onBeforeCompile(shader, renderer);
    shader.uniforms.uArchiveWindowDaylight = windowDaylight;
    shader.uniforms.uWindowWarmth = windowWarmth;
    Object.assign(shader.uniforms, birdShadow);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vArchiveFloorPosition;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vArchiveFloorPosition = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vArchiveFloorPosition;
        uniform float uArchiveWindowDaylight;
        uniform float uWindowWarmth;
        ${WINDOW_BEAM_GLSL}
        ${birdShadowGlsl}`)
      .replace('#include <opaque_fragment>', `
        vec3 facet = inverseTransformDirection(normal, viewMatrix);
        float bevel = smoothstep(.08, .44, facet.y) * (1.0 - smoothstep(.78, .995, facet.y));
        float brush = smoothstep(.30, .90, dot(facet, normalize(vec3(-.73, .65, .24))));
        float nearDoor = smoothstep(11.5, 15.5, vArchiveFloorPosition.z);
        outgoingLight += vec3(.115, .155, .21) * bevel * brush * nearDoor * (1.0 - .75 * roughnessFactor);
        vec3 floorPoint = vec3(vArchiveFloorPosition.x, ${RUG_TOP.toFixed(6)}, vArchiveFloorPosition.z);
        float windowLight = archiveWindowLightAt(floorPoint) * uArchiveWindowDaylight;
        if (windowLight > .001) windowLight *= birdShade(floorPoint);
        float litFace = .36 + .64 * max(0.0, dot(facet, normalize(vec3(-.72, .65, .24))));
        outgoingLight += windowLight * litFace *
          (diffuseColor.rgb * mix(vec3(.30, .40, .57), vec3(.54, .40, .25), uWindowWarmth) +
          mix(vec3(.022, .039, .066), vec3(.062, .040, .020), uWindowWarmth) +
          mix(vec3(.060, .082, .115), vec3(.110, .077, .040), uWindowWarmth)
            * bevel * brush * (1.0 - .65 * roughnessFactor));
        #include <opaque_fragment>
      `);
  };
  material.customProgramCacheKey = () => source.customProgramCacheKey() + ':archive-window-spill';
  return material;
}
