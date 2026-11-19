import * as THREE from '../vendor/three.js';
import { KEY_ART } from './key-art.js';

// The same depth/normal contour used by Key Forge. One full-screen pass
// outlines every visible opaque object, including all InstancedMesh keys,
// without adding back-face hulls, draw calls or polygons for each key.
export const SCENE_OUTLINE_GLSL = `
float occupied(float depth) {
  return 1.0 - step(0.99995, depth);
}

float edgeAt(vec2 direction, float depth, vec3 normal, float here) {
  vec2 uv = clamp(vUv + direction * uWidth / uResolution, vec2(0.001), vec2(0.999));
  float neighborDepth = texture2D(tDepth, uv).r;
  float there = occupied(neighborDepth);
  float silhouette = abs(here - there);
  float crease = 0.0;
  if (here > 0.5 && there > 0.5) {
    vec3 neighborNormal = texture2D(tNormal, uv).rgb;
    float normalDifference = length(normal - neighborNormal);
    float depthDifference = abs(depth - neighborDepth);
    crease = max(
      smoothstep(uNormalThreshold, uNormalThreshold + 0.15, normalDifference),
      smoothstep(uDepthThreshold, uDepthThreshold * 1.8, depthDifference)
    );
  }
  return max(silhouette, crease);
}

float inkEdge(vec2 uv) {
  float depth = texture2D(tDepth, uv).r;
  float here = occupied(depth);
  vec3 normal = texture2D(tNormal, uv).rgb;
  float outline = 0.0;
  outline = max(outline, edgeAt(vec2( 1.0,  0.0), depth, normal, here));
  outline = max(outline, edgeAt(vec2(-1.0,  0.0), depth, normal, here));
  outline = max(outline, edgeAt(vec2( 0.0,  1.0), depth, normal, here));
  outline = max(outline, edgeAt(vec2( 0.0, -1.0), depth, normal, here));
  outline = max(outline, edgeAt(vec2( 0.7,  0.7), depth, normal, here));
  outline = max(outline, edgeAt(vec2(-0.7,  0.7), depth, normal, here));
  outline = max(outline, edgeAt(vec2( 0.7, -0.7), depth, normal, here));
  outline = max(outline, edgeAt(vec2(-0.7, -0.7), depth, normal, here));
  return outline;
}`;

export function createSceneOutlineUniforms() {
  return {
    uInk: { value: 0 },
    uInkColor: { value: new THREE.Color(KEY_ART.outline.ink) },
    uWidth: { value: KEY_ART.outline.radius },
    uNormalThreshold: { value: KEY_ART.outline.normalThreshold },
    uDepthThreshold: { value: KEY_ART.outline.depthThreshold },
  };
}

export function applySceneOutlineSettings(uniforms, settings, pixelRatio = 1) {
  const sensitivity = Math.max(0, Math.min(100, Number(settings.outlineSensitivity) || 0));
  const thresholdScale = 1 - .6 * ((sensitivity - 50) / 50);
  uniforms.uInk.value = settings.outlineEnabled ?
    KEY_ART.outline.opacity * Math.max(0, Math.min(100, Number(settings.outlineStrength))) / 100 : 0;
  uniforms.uWidth.value = KEY_ART.outline.radius * Math.max(1, pixelRatio) *
    Math.max(1, Math.min(4, Number(settings.outlineWidth) || 1));
  uniforms.uNormalThreshold.value = KEY_ART.outline.normalThreshold * thresholdScale;
  uniforms.uDepthThreshold.value = KEY_ART.outline.depthThreshold * thresholdScale;
}
