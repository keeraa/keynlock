import * as THREE from '../../vendor/three.js';
import { DUST_OCCLUSION_GLSL, SCENE_OUTLINE_GLSL, createSceneOutlineUniforms } from './scene-outline.js';

const vertexShader = `varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

function stage(fragmentShader, uniforms) {
  const shader = new THREE.ShaderMaterial({
    uniforms, vertexShader, fragmentShader,
    depthTest: false, depthWrite: false, transparent: false, toneMapped: false,
  });
  return { shader, uniforms };
}

export function createToonShader() {
  return stage(`
    uniform sampler2D tScene;
    uniform float uToonLight;
    uniform float uSteps;
    uniform float uMaterial;
    varying vec2 vUv;
    float archiveLuma(vec3 c) { return dot(c, vec3(.2126,.7152,.0722)); }
    void main() {
      vec3 color = texture2D(tScene, vUv).rgb;
      float light = archiveLuma(color);
      float bands = max(2.0, uSteps);
      float position = clamp(light, 0.0, 1.0) * bands;
      float bandCenter = (floor(position) + .5) / bands;
      float adjustment = clamp(bandCenter - light, -.075, .075);
      float strength = uToonLight * uMaterial;
      // Keep the original scene's luminance and color identity. The slider
      // gently separates light bands; it never recolors the whole room.
      color *= 1.0 + adjustment * strength * 1.35;
      gl_FragColor = vec4(color, 1.0);
      #include <colorspace_fragment>
    }`, {
    tScene: { value: null },
    uToonLight: { value: .8 }, uSteps: { value: 4 }, uMaterial: { value: .9 },
  });
}

export function createOutlineShader() {
  return stage(`
    uniform sampler2D tScene;
    uniform sampler2D tDepth;
    uniform sampler2D tNormal;
    uniform sampler2D tDustCoverage;
    uniform vec2 uResolution;
    uniform float uInk;
    uniform float uWidth;
    uniform float uNear;
    uniform float uFar;
    uniform float uNormalThreshold;
    uniform float uDepthThreshold;
    uniform vec3 uInkColor;
    varying vec2 vUv;
    ${DUST_OCCLUSION_GLSL}
    ${SCENE_OUTLINE_GLSL}
    void main() {
      vec3 color = texture2D(tScene, vUv).rgb;
      float dust = dustInkTransmission(texture2D(tDustCoverage, vUv).a);
      float edge = inkEdge(vUv) * uInk * dust;
      color = mix(color, uInkColor, edge);
      gl_FragColor = vec4(color, 1.0);
      #include <colorspace_fragment>
    }`, {
    tScene: { value: null }, tDepth: { value: null }, tNormal: { value: null },
    tDustCoverage: { value: null },
    uResolution: { value: new THREE.Vector2(1, 1) },
    ...createSceneOutlineUniforms(),
  });
}

export function createCopyShader() {
  return stage(`
    uniform sampler2D tScene;
    varying vec2 vUv;
    void main() {
      gl_FragColor = vec4(texture2D(tScene, vUv).rgb, 1.0);
      #include <colorspace_fragment>
    }`, { tScene: { value: null } });
}

// Restrained lens softness in the distant half of the room. The depth buffer
// gates blur per pixel, so nearby keys, cabinets and the UI remain crisp.
export function createDistanceBlurShader() {
  return stage(`
    uniform sampler2D tScene;
    uniform sampler2D tDepth;
    uniform vec2 uResolution;
    uniform vec3 uAirColor;
    uniform float uNear;
    uniform float uFar;
    varying vec2 vUv;
    void main() {
      vec3 sharp = texture2D(tScene, vUv).rgb;
      float depth = texture2D(tDepth, vUv).r;
      float distance = (uNear * uFar) / max(.0001, uFar - depth * (uFar - uNear));
      float blur = smoothstep(20.0, 45.0, distance) * .34;
      vec2 stepPx = 1.8 / uResolution;
      vec3 soft = sharp * .32;
      soft += texture2D(tScene, vUv + vec2(stepPx.x, 0.0)).rgb * .17;
      soft += texture2D(tScene, vUv - vec2(stepPx.x, 0.0)).rgb * .17;
      soft += texture2D(tScene, vUv + vec2(0.0, stepPx.y)).rgb * .17;
      soft += texture2D(tScene, vUv - vec2(0.0, stepPx.y)).rgb * .17;
      vec3 color = mix(sharp, soft, blur);
      // Aerial perspective affects the distant room after contours, preserving close metal.
      float air = smoothstep(10.0, 42.0, distance);
      float luminance = dot(color, vec3(.2126,.7152,.0722));
      color = mix(color, vec3(luminance), air * .18);
      color = mix(color, uAirColor, air * .28);
      gl_FragColor = vec4(color, 1.0);
      #include <colorspace_fragment>
    }`, {
    tScene: { value: null }, tDepth: { value: null },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uAirColor: { value: new THREE.Color(.30, .325, .30) },
    uNear: { value: .055 }, uFar: { value: 120 },
  });
}
