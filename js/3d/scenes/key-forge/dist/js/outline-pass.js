import * as THREE from '../vendor/three.js';
import { KEY_ART } from './key-art.js';

// The shared Keynlock contour: geometry-based depth/normal edges in screen
// pixels. Painted texture strokes are deliberately ignored by this pass.
const vertexShader = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const fragmentShader = `
precision highp float;
uniform sampler2D uNormals;
uniform sampler2D uDepth;
uniform vec2 uTexel;
uniform float uRadius;
uniform float uNormalThreshold;
uniform float uDepthThreshold;
uniform float uOpacity;
uniform vec3 uInk;
varying vec2 vUv;

float occupied(float depth) {
  return 1.0 - step(0.99995, depth);
}

float edgeAt(vec2 direction, float depth, vec3 normal, float here) {
  vec2 uv = clamp(vUv + direction * uTexel * uRadius, vec2(0.001), vec2(0.999));
  float neighborDepth = texture2D(uDepth, uv).r;
  float there = occupied(neighborDepth);
  // Draw a silhouette edge on the empty side, leaving thin metal visible.
  if (here < .5) return there;
  if (there < .5) return 0.0;

  vec3 neighborNormal = texture2D(uNormals, uv).rgb;
  float normalDifference = length(normal - neighborNormal);
  float signedDepthDifference = depth - neighborDepth;
  float crease = max(
    smoothstep(uNormalThreshold, uNormalThreshold + .15, normalDifference),
    smoothstep(uDepthThreshold, uDepthThreshold * 1.8, abs(signedDepthDifference))
  );
  // At an edge between two surfaces, put the ink on the farther one. Only
  // when the depth step is decisive: along a fold (face meeting side wall)
  // the step is near zero and its sign flickers from pixel to pixel, which
  // broke the line into dashes. There both sides keep the ink.
  float farther = smoothstep(-uDepthThreshold * .12, uDepthThreshold * .12,
    signedDepthDifference);
  float decisive = smoothstep(uDepthThreshold * .6, uDepthThreshold * 1.6,
    abs(signedDepthDifference));
  return crease * mix(1.0, farther, decisive);
}

void main() {
  float depth = texture2D(uDepth, vUv).r;
  float here = occupied(depth);
  vec3 normal = texture2D(uNormals, vUv).rgb;
  float outline = 0.0;
  outline = max(outline, edgeAt(vec2( 1.0,  0.0), depth, normal, here));
  outline = max(outline, edgeAt(vec2(-1.0,  0.0), depth, normal, here));
  outline = max(outline, edgeAt(vec2( 0.0,  1.0), depth, normal, here));
  outline = max(outline, edgeAt(vec2( 0.0, -1.0), depth, normal, here));
  outline = max(outline, edgeAt(vec2( 0.7,  0.7), depth, normal, here));
  outline = max(outline, edgeAt(vec2(-0.7,  0.7), depth, normal, here));
  outline = max(outline, edgeAt(vec2( 0.7, -0.7), depth, normal, here));
  outline = max(outline, edgeAt(vec2(-0.7, -0.7), depth, normal, here));
  gl_FragColor = vec4(uInk, uOpacity * outline);
}`;

export class ScreenSpaceOutlinePass {
  constructor(renderer) {
    this.renderer = renderer;
    const depthTexture = new THREE.DepthTexture(1, 1, THREE.UnsignedIntType);
    depthTexture.format = THREE.DepthFormat;
    depthTexture.minFilter = depthTexture.magFilter = THREE.NearestFilter;
    this.target = new THREE.WebGLRenderTarget(1, 1, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      format: THREE.RGBAFormat,
      depthBuffer: true,
      stencilBuffer: false,
      depthTexture,
    });
    this.normalMaterial = new THREE.MeshNormalMaterial({ side: THREE.DoubleSide });
    this.normalMaterial.toneMapped = false;
    this.compositeMaterial = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      toneMapped: false,
      uniforms: {
        uNormals: { value: this.target.texture },
        uDepth: { value: depthTexture },
        uTexel: { value: new THREE.Vector2(1, 1) },
        uRadius: { value: KEY_ART.outline.radius },
        uNormalThreshold: { value: KEY_ART.outline.normalThreshold },
        uDepthThreshold: { value: KEY_ART.outline.depthThreshold },
        uOpacity: { value: KEY_ART.outline.opacity },
        uInk: { value: new THREE.Color(KEY_ART.outline.ink) },
      },
    });
    this.compositeScene = new THREE.Scene();
    this.compositeCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    this.compositeCamera.position.z = 1;
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.compositeMaterial);
    this.quad.frustumCulled = false;
    this.compositeScene.add(this.quad);
    this.clearColor = new THREE.Color();
  }

  setSize(width, height, pixelRatio = 1) {
    const w = Math.max(1, Math.round(width));
    const h = Math.max(1, Math.round(height));
    if (this.target.width !== w || this.target.height !== h) this.target.setSize(w, h);
    this.compositeMaterial.uniforms.uTexel.value.set(1 / w, 1 / h);
    this.compositeMaterial.uniforms.uRadius.value = KEY_ART.outline.radius * pixelRatio;
  }

  render(scene, camera, ignoredMesh) {
    const renderer = this.renderer;
    const oldTarget = renderer.getRenderTarget();
    const oldOverride = scene.overrideMaterial;
    const oldShadowEnabled = renderer.shadowMap.enabled;
    const oldToneMapping = renderer.toneMapping;
    const oldClearAlpha = renderer.getClearAlpha();
    renderer.getClearColor(this.clearColor);
    const oldVisibility = ignoredMesh?.visible;
    const paintedDetails=[];
    scene.traverse(object=>{
      if(object.isMesh && object.userData.exportable===false && object.userData.outlineable!==true) {
        paintedDetails.push([object,object.visible]);
      }
    });

    try {
      if (ignoredMesh) ignoredMesh.visible = false;
      for(const [mesh] of paintedDetails) mesh.visible=false;
      scene.overrideMaterial = this.normalMaterial;
      renderer.shadowMap.enabled = false;
      renderer.toneMapping = THREE.NoToneMapping;
      renderer.setRenderTarget(this.target);
      renderer.setClearColor(0x000000, 0);
      renderer.render(scene, camera);
    } finally {
      if (ignoredMesh) ignoredMesh.visible = oldVisibility;
      for(const [mesh,visible] of paintedDetails) mesh.visible=visible;
      scene.overrideMaterial = oldOverride;
      renderer.shadowMap.enabled = oldShadowEnabled;
      renderer.toneMapping = oldToneMapping;
      renderer.setClearColor(this.clearColor, oldClearAlpha);
      renderer.setRenderTarget(oldTarget);
    }

    renderer.render(scene, camera);
    const oldAutoClear = renderer.autoClear;
    try {
      renderer.autoClear = false;
      renderer.render(this.compositeScene, this.compositeCamera);
    } finally {
      renderer.autoClear = oldAutoClear;
    }
  }

  dispose() {
    this.target.dispose();
    this.normalMaterial.dispose();
    this.compositeMaterial.dispose();
    this.quad.geometry.dispose();
  }
}
