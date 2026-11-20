// Trial look (settings: «Штриховка теней»): deep shadow drawn as pen hatching,
// the Key Forge style, on every lit material in the room. It is decided per
// material from how much light actually reaches the surface (lit colour
// against the material's own colour), so dark-coloured but lit things like
// the carpet keep their paint and only real shadow gets the pen.
//
// Strokes live in world space, each face hatched in its own plane (picked by
// its normal), and fade into a flat muted shade where they would get denser
// than about three pixels, so distant surfaces never shimmer.
// Cost: a few arithmetic operations per shaded pixel; the toggle is one shared
// uniform, so switching it never recompiles a shader.

const enabled = { value: 0 };
const PATCHED = Symbol('shadowHatch');
const LIT = ['isMeshStandardMaterial', 'isMeshLambertMaterial', 'isMeshPhongMaterial', 'isMeshToonMaterial'];

export const SHADOW_HATCH_SPACING = .022; // metres between strokes

const vertexDeclarations = `
varying vec3 vHatchWorld;
varying vec3 vHatchNormal;`;
const vertexBody = `
  vec4 hatchPoint = vec4(transformed, 1.0);
  vec3 hatchNormal = objectNormal;
  #ifdef USE_INSTANCING
    hatchPoint = instanceMatrix * hatchPoint;
    hatchNormal = mat3(instanceMatrix) * hatchNormal;
  #endif
  vHatchWorld = (modelMatrix * hatchPoint).xyz;
  vHatchNormal = normalize(mat3(modelMatrix) * hatchNormal);`;
const fragmentDeclarations = `
uniform float uShadowHatch;
varying vec3 vHatchWorld;
varying vec3 vHatchNormal;
float hatchStroke(float coord, float width) {
  float d = abs(fract(coord) - .5);
  float w = fwidth(coord);
  float line = 1.0 - smoothstep(width * .5 - w, width * .5 + w, d);
  return line * (1.0 - smoothstep(.22, .45, w));
}`;
const fragmentBody = `
  if (uShadowHatch > .5) {
    float reflectance = 1.0;
    #ifdef STANDARD
      // Metal returns little diffuse light even when lit; judge it fairly.
      reflectance = 1.0 - .85 * metalnessFactor;
    #endif
    float albedo = max(dot(diffuseColor.rgb, vec3(.2126, .7152, .0722)) * reflectance, .02);
    float received = dot(outgoingLight, vec3(.2126, .7152, .0722)) / albedo;
    float shade = 1.0 - smoothstep(.06, .2, received);
    if (shade > 0.0) {
      vec3 n = abs(vHatchNormal);
      vec2 plane = n.y >= n.x && n.y >= n.z ? vHatchWorld.xz
        : (n.x > n.z ? vHatchWorld.zy : vHatchWorld.xy);
      plane /= ${SHADOW_HATCH_SPACING.toFixed(4)};
      float strokes = hatchStroke((plane.x + plane.y) * .7071, .3);
      float crossed = hatchStroke((plane.x - plane.y) * .7071, .26) * smoothstep(.55, .85, shade);
      float ink = max(strokes, crossed);
      vec3 paper = diffuseColor.rgb * .5;
      vec3 drawn = mix(paper, vec3(.03, .022, .016), ink * .85);
      gl_FragColor.rgb = mix(gl_FragColor.rgb, drawn, shade);
    }
  }`;

export function patchShadowHatch(material) {
  if (!material || material[PATCHED] || !LIT.some(flag => material[flag])) return false;
  material[PATCHED] = true;
  const previous = material.onBeforeCompile;
  const previousKey = material.customProgramCacheKey;
  material.onBeforeCompile = function (shader, renderer) {
    previous.call(this, shader, renderer);
    shader.uniforms.uShadowHatch = enabled;
    // A clone of a patched material (held key light, entrance light) runs the
    // source's hook too: inject once per shader.
    if (shader.fragmentShader.includes('uniform float uShadowHatch;')) return;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>${vertexDeclarations}`)
      .replace('#include <project_vertex>', `#include <project_vertex>${vertexBody}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>${fragmentDeclarations}`)
      .replace('#include <opaque_fragment>', `#include <opaque_fragment>${fragmentBody}`);
  };
  material.customProgramCacheKey = function () { return `${previousKey.call(this)}:shadow-hatch`; };
  material.needsUpdate = true;
  return true;
}

// New objects (thrown keys, cabinet rewards) may bring new materials, so the
// world calls this again from time to time; already patched ones are skipped.
export function patchSceneShadowHatch(scene) {
  let patched = 0;
  scene.traverse(object => {
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) if (patchShadowHatch(material)) patched++;
  });
  return patched;
}

export function setShadowHatch(on) { enabled.value = on ? 1 : 0; }
export function shadowHatchEnabled() { return enabled.value > .5; }
