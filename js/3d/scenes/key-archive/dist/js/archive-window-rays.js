import * as THREE from '../vendor/three.js';
import { WINDOW_CENTERS } from './hall-architecture.js';
import { birdShadowGlsl } from './archive-entrance-light.js';
import { RUG_TOP } from './floor-contact.js';
import { WINDOW_WALL_X as WALL_X, WINDOW_BEAM_SILL as SILL, WINDOW_BEAM_SPRING as SPRING,
  WINDOW_BEAM_CROWN as CROWN, WINDOW_BEAM_HALF_WIDTH as HALF_WIDTH,
  WINDOW_BEAM_SLOPE } from './window-beam-light.js';

export { WINDOW_BEAM_SLOPE, windowBeamLightAt } from './window-beam-light.js';

const { y: SLOPE_Y, z: SLOPE_Z } = WINDOW_BEAM_SLOPE;
export const WINDOW_LIGHT_POSITION = [-24, 24 * SLOPE_Y, 24 * SLOPE_Z];

export function dustOriginInWindowBeam(index, random) {
  const distance = 1.6 + random() * 9.7;
  const openingY = SILL + .48 + random() * (SPRING - SILL - .63);
  const openingZ = WINDOW_CENTERS[index % WINDOW_CENTERS.length] + (random() - .5) * HALF_WIDTH * 1.48;
  return [WALL_X + distance, openingY - distance * SLOPE_Y, openingZ - distance * SLOPE_Z];
}

// Two sets of translucent slices give the window light depth as the camera
// turns. Each slice ends where it intersects the carpet plane.
export function addWindowAirLight(scene, birdShadow) {
  const positions = [];
  const aperture = [];
  const families = [];
  const indices = [];
  const near = .18;
  const width = HALF_WIDTH * 1.08;
  const bottom = SILL - .12;
  const top = CROWN;
  const slices = 5;

  function addSlice(center, a, b, family) {
    const first = positions.length / 3;
    const floorAt = height => (height - RUG_TOP) / SLOPE_Y;
    const corners = [[near, a], [floorAt(a[0]), a], [floorAt(b[0]), b], [near, b]];
    for (const [distance, [height, offset]] of corners) {
      positions.push(WALL_X + distance, height - distance * SLOPE_Y,
        center + offset - distance * SLOPE_Z);
      aperture.push(height, offset / HALF_WIDTH);
      families.push(family);
    }
    indices.push(first, first + 1, first + 2, first, first + 2, first + 3);
  }

  for (const center of WINDOW_CENTERS) {
    for (let layer = 0; layer < slices; layer++) {
      const fraction = (layer + .5) / slices;
      const offset = (fraction * 2 - 1) * width;
      const height = bottom + (top - bottom) * fraction;
      addSlice(center, [bottom, offset], [top, offset], 0);
      addSlice(center, [height, -width], [height, width], 1);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('aperture', new THREE.Float32BufferAttribute(aperture, 2));
  geometry.setAttribute('family', new THREE.Float32BufferAttribute(families, 1));
  geometry.setIndex(indices);
  const uniforms = {
    uAirStrength: { value: 0 },
    uAirTint: { value: new THREE.Color(0xaac6e8) },
    ...birdShadow,
  };
  const material = new THREE.ShaderMaterial({
    uniforms, side: THREE.DoubleSide, forceSinglePass: true, transparent: true,
    depthWrite: false, toneMapped: false,
    vertexShader: `
      attribute vec2 aperture;
      attribute float family;
      varying vec3 vBeamPosition;
      varying vec2 vAperture;
      varying float vFamily;
      void main() {
        vBeamPosition = position;
        vAperture = aperture;
        vFamily = family;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform float uAirStrength;
      uniform vec3 uAirTint;
      ${birdShadowGlsl}
      varying vec3 vBeamPosition;
      varying vec2 vAperture;
      varying float vFamily;
      void main() {
        float distanceFromWindow = vBeamPosition.x - (${WALL_X.toFixed(3)});
        float height = vAperture.x;
        float offset = vAperture.y;
        float arch = max(0.0, (height - ${SPRING.toFixed(4)}) / ${(CROWN - SPRING).toFixed(4)});
        float apertureEdge = 1.0 - smoothstep(.50, 1.04, length(vec2(offset, arch)));
        apertureEdge *= smoothstep(${bottom.toFixed(4)}, ${(SILL + .38).toFixed(4)}, height);
        float mullion = 1.0 - .17 * exp(-38.0 * offset * offset);
        float aboveCarpet = vBeamPosition.y - (${RUG_TOP.toFixed(4)});
        float air = smoothstep(.20, 1.65, distanceFromWindow) *
          mix(1.0, .60, smoothstep(2.0, 9.0, distanceFromWindow)) *
          smoothstep(.0, .36, aboveCarpet);
        vec3 sight = normalize(cameraPosition - vBeamPosition);
        float verticalFacing = dot(sight, normalize(vec3(${SLOPE_Z.toFixed(5)}, 0.0, 1.0)));
        float horizontalFacing = dot(sight, normalize(vec3(${SLOPE_Y.toFixed(5)}, 1.0, 0.0)));
        vec2 facing = vec2(verticalFacing, horizontalFacing);
        facing *= facing;
        float layerWeight = mix(facing.x, facing.y, vFamily) / max(.14, facing.x + facing.y);
        float opacity = uAirStrength * air * apertureEdge * mullion * layerWeight * birdShade(vBeamPosition);
        gl_FragColor = vec4(uAirTint, opacity);
        #include <colorspace_fragment>
      }`,
  });
  const beams = new THREE.Mesh(geometry, material);
  beams.renderOrder = 3;
  scene.add(beams);
  return (daylight, tint = 0xaac6e8) => {
    beams.visible = daylight > 0;
    uniforms.uAirStrength.value = daylight * .033;
    uniforms.uAirTint.value.setHex(tint);
  };
}
