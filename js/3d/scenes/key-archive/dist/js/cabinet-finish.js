import * as THREE from '../vendor/three.js';
import { CABINET_COLUMN_WIDTH, CABINET_ROW_HEIGHT, CABINET_GRID_HALF_WIDTH,
  CABINET_CORNICE_TOP, CABINET_GRID_BOTTOM_Y, CABINET_GRID_TOP_Y, CABINET_ROWS } from './cabinet-layout.js?v=single-source';

// Round the visible edge inside the board's original dimensions. The back,
// shelf spacing and grid stay fixed so keys and the reticle still line up.
export function createRoundedShelfGeometry(width, height, depth) {
  const y = height / 2;
  const z = depth / 2;
  const radius = Math.min(.019, height * .41, depth * .25);
  const section = new THREE.Shape();
  section.moveTo(-z + radius, y);
  section.lineTo(z, y);
  section.lineTo(z, -y);
  section.lineTo(-z + radius, -y);
  section.quadraticCurveTo(-z, -y, -z, -y + radius);
  section.lineTo(-z, y - radius);
  section.quadraticCurveTo(-z, y, -z + radius, y);
  section.closePath();
  const geometry = new THREE.ExtrudeGeometry(section, { depth: width, bevelEnabled: false, curveSegments: 3 });
  geometry.rotateY(Math.PI / 2);
  geometry.translate(-width / 2, 0, 0);
  const position = geometry.getAttribute('position');
  const uv = geometry.getAttribute('uv');
  for (let vertex = 0; vertex < position.count; vertex++) {
    uv.setXY(vertex, position.getX(vertex) / 2.6 + .56,
      (position.getY(vertex) + .54 * position.getZ(vertex)) / 2.6 + .38);
  }
  return geometry;
}

function paintOnWood(source, name, pigment, cellLights) {
  const material = source.clone();
  material.customProgramCacheKey = () => name;
  material.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCabinetWood;\nvarying float vCabinetFront;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCabinetWood = position;\nvCabinetFront = normal.z;');
    if (cellLights) shader.uniforms.uCellLights = { value: cellLights };
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCabinetWood;\nvarying float vCabinetFront;')
      .replace('#include <map_fragment>', `#include <map_fragment>\n${pigment}`);
    if (cellLights) {
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform sampler2D uCellLights;')
        .replace('#include <emissivemap_fragment>',
          '#include <emissivemap_fragment>\ntotalEmissiveRadiance += cellGlow * vec3(.27, .16, .067);');
    }
  };
  return material;
}

export function createCabinetFinish(materials) {
  const recessBase = materials.cabinetBack.clone();
  recessBase.color.setHex(0xb5a087);
  // Reuse the ivory gouache painting, tinted into a muted warm backing.
  recessBase.map = materials.hallVault.map.clone();
  recessBase.map.repeat.set(2.2, 1.6);
  // A pale matte backing keeps dark metal readable on both sides of the hall.
  recessBase.emissive.setHex(0x8a735a);
  recessBase.emissiveIntensity = .10;
  const createRecess = cellLights => paintOnWood(recessBase, 'archive-cell-gouache-with-glow', `
    float cellGlow = 0.0;
    vec2 cabinetPoint = vCabinetWood.xy + vec2(0.0, ${((CABINET_CORNICE_TOP - .5) / 2 + .31).toFixed(3)});
    if (vCabinetFront > .5 && abs(cabinetPoint.x) < ${CABINET_GRID_HALF_WIDTH.toFixed(3)} &&
        cabinetPoint.y > ${CABINET_GRID_BOTTOM_Y.toFixed(3)} && cabinetPoint.y < ${CABINET_GRID_TOP_Y.toFixed(3)}) {
      vec2 cell = (cabinetPoint + vec2(${CABINET_GRID_HALF_WIDTH.toFixed(3)}, -${CABINET_GRID_BOTTOM_Y.toFixed(3)})) /
        vec2(${(CABINET_COLUMN_WIDTH / 2).toFixed(4)}, ${(CABINET_ROW_HEIGHT / 2).toFixed(4)});
      vec2 p = fract(cell);
      float sideShade = smoothstep(.03, .44, min(p.x, 1.0 - p.x));
      float upperShade = 1.0 - smoothstep(.56, 1.0, p.y);
      float lowerShade = smoothstep(.01, .32, p.y);
      float flecks = .94 + .06 * sin(cabinetPoint.x * 26.0 + sin(cabinetPoint.y * 17.0));
      float panel = .91 + .09 * sin(dot(floor(cell), vec2(1.72, 3.56)));
      float softness = .67 + .33 * sideShade * upperShade * lowerShade;
      diffuseColor.rgb *= softness * flecks * panel;
      vec2 cellIndex = floor(cell);
      cellIndex.y = ${CABINET_ROWS * 2 - 1}.0 - cellIndex.y;
      float glow = texelFetch(uCellLights, ivec2(cellIndex), 0).r;
      vec2 delta = (p - vec2(.5, .56)) * vec2(1.68, 1.44);
      cellGlow = glow * exp(-3.6 * dot(delta, delta)) * flecks;
    }
  `, cellLights);
  const walnut = materials.cabinetWalnut.clone();
  walnut.color.setHex(0xa48470);
  const wood = materials.wood.clone();
  wood.color.setHex(0xe2c7ad);
  const darkWood = materials.darkWood.clone();
  darkWood.color.setHex(0xab8874);
  const carvedWood = materials.carvedWood.clone();
  carvedWood.color.setHex(0xc5a18a);
  const shelf = paintOnWood(wood, 'archive-shelf-gouache-wear', `
    vec2 grain = vCabinetWood.xy;
    float grainStreak = sin(grain.y * 124.0 + sin(grain.x * 8.0) * 1.2);
    float paintWear = sin(grain.x * 12.7 + sin(grain.y * 70.0)) * .55 +
      sin(grain.x * 31.4 - grain.y * 19.0) * .24 + grainStreak * .21;
    float lip = smoothstep(.091, .14, vCabinetWood.z);
    float rubbed = smoothstep(.12, .77, paintWear) * lip;
    diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.30, .145, .074), rubbed * .36);
    diffuseColor.rgb *= 1.0 + .15 * lip * max(0.0, vCabinetFront);
  `);
  shelf.roughness = .89;
  return { createRecess, shelf, walnut, wood, darkWood, carvedWood };
}
