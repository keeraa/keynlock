import * as THREE from '../vendor/three.js';
import { KEY_ART } from './key-art.js';

// The same depth/normal contour used by Key Forge. One full-screen pass
// outlines every visible opaque object, including all InstancedMesh keys,
// without adding back-face hulls, draw calls or polygons for each key.
export const DUST_OCCLUSION_GLSL = `
float dustInkTransmission(float transmittance) {
  return 1.0 - smoothstep(.018, .30, 1.0 - transmittance);
}`;

export const SCENE_OUTLINE_GLSL = `
float occupied(float depth) {
  return 1.0 - step(0.99995, depth);
}

float closestInkDepth;
float edgeAt(vec2 direction, float depth, vec3 normal, float here) {
  float strokeDepth = depth;
  if (here < .5) {
    vec2 probe = clamp(vUv + direction * uWidth / uResolution, vec2(.001), vec2(.999));
    strokeDepth = min(depth, texture2D(tDepth, probe).r);
  }
  float viewDistance = (uNear * uFar) / max(.0001, uFar - strokeDepth * (uFar - uNear));
  float perspectiveWidth = clamp(4.5 / max(4.5, viewDistance), .22, 1.0);
  vec2 uv = clamp(vUv + direction * uWidth * perspectiveWidth / uResolution, vec2(0.001), vec2(0.999));
  float neighborDepth = texture2D(tDepth, uv).r;
  closestInkDepth = min(closestInkDepth, min(strokeDepth, neighborDepth));
  float there = occupied(neighborDepth);
  float silhouette = abs(here - there);
  float crease = 0.0;
  vec3 neighborNormal = normal;
  if (here > 0.5 && there > 0.5) {
    neighborNormal = texture2D(tNormal, uv).rgb;
    float normalDifference = length(normal - neighborNormal);
    float depthDifference = abs(depth - neighborDepth);
    crease = max(
      smoothstep(uNormalThreshold, uNormalThreshold + 0.15, normalDifference),
      smoothstep(uDepthThreshold, uDepthThreshold * 1.8, depthDifference)
    );
  }
  // Ink belongs on the farther surface, outside the foreground silhouette.
  // A two-sided depth edge can paint over almost the entire thin key shaft.
  float farther = smoothstep(-uDepthThreshold * .12, uDepthThreshold * .12,
    depth - neighborDepth);
  // Along a fold (a face meeting a side wall) the depth step is near zero and
  // its sign flickers from pixel to pixel, which broke lines into dashes.
  // There the ink goes on the face turned further from the camera (smaller
  // view-space normal z): one side, chosen the same way along the whole edge.
  float decisive = smoothstep(uDepthThreshold * .6, uDepthThreshold * 1.6,
    abs(depth - neighborDepth));
  float oblique = smoothstep(-.02, .02, neighborNormal.z - normal.z);
  float fold = here * there;
  float outside = mix(farther, mix(oblique, farther, decisive), fold);
  return max(silhouette, crease) * outside;
}

float inkEdge(vec2 uv) {
  float depth = texture2D(tDepth, uv).r;
  float here = occupied(depth);
  closestInkDepth = depth;
  vec3 normal = texture2D(tNormal, uv).rgb;
  vec4 cardinal = vec4(
    edgeAt(vec2( 1.0,  0.0), depth, normal, here),
    edgeAt(vec2(-1.0,  0.0), depth, normal, here),
    edgeAt(vec2( 0.0,  1.0), depth, normal, here),
    edgeAt(vec2( 0.0, -1.0), depth, normal, here)
  );
  vec4 diagonal = vec4(
    edgeAt(vec2( 0.7,  0.7), depth, normal, here),
    edgeAt(vec2(-0.7,  0.7), depth, normal, here),
    edgeAt(vec2( 0.7, -0.7), depth, normal, here),
    edgeAt(vec2(-0.7, -0.7), depth, normal, here)
  );
  vec4 peaks = max(cardinal, diagonal);
  float peak = max(max(peaks.x, peaks.y), max(peaks.z, peaks.w));
  // An isolated tap adds a soft fringe. Agreement across directions
  // produces the solid stroke and keeps diagonals even as the camera moves.
  float support = dot(cardinal, vec4(1.0)) + dot(diagonal, vec4(.8));
  float outline = mix(peak, smoothstep(0.0, 2.6, support), .72);
  float distance = (uNear * uFar) / max(.0001, uFar - closestInkDepth * (uFar - uNear));
  return outline * mix(1.0, .28, smoothstep(3.0, 12.0, distance));
}`;

export function createSceneOutlineUniforms() {
  return {
    uInk: { value: 0 },
    uNear: { value: .055 },
    uFar: { value: 120 },
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
  uniforms.uWidth.value = KEY_ART.outline.radius * Math.max(1, pixelRatio);
  uniforms.uNormalThreshold.value = KEY_ART.outline.normalThreshold * thresholdScale;
  uniforms.uDepthThreshold.value = KEY_ART.outline.depthThreshold * thresholdScale;
}
