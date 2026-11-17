/** Frame geometry and color-correction shader for both easels. */
import { createFrameGeometry } from './frame-geometry.js';

const vertexShader = /* glsl */`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */`
  uniform sampler2D uPainting;
  uniform float uHue;
  uniform float uSaturation;
  uniform float uBrightness;
  varying vec2 vUv;

  vec3 rgb2hsv(vec3 c) {
    vec4 K = vec4(0., -1. / 3., 2. / 3., -1.);
    vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
    vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
    float d = q.x - min(q.w, q.y);
    float e = 1.0e-10;
    return vec3(abs(q.z + (q.w - q.y) / (6. * d + e)), d / (q.x + e), q.x);
  }
  vec3 hsv2rgb(vec3 c) {
    vec3 p = abs(fract(c.xxx + vec3(0., 2. / 3., 1. / 3.)) * 6. - 3.);
    return c.z * mix(vec3(1.), clamp(p - 1., 0., 1.), c.y);
  }
  void main() {
    vec3 col = texture2D(uPainting, vUv).rgb;
    vec3 hsv = rgb2hsv(col);
    hsv.x = fract(hsv.x + uHue / 360. + 1.);
    hsv.y = clamp(hsv.y * uSaturation, 0., 1.);
    hsv.z = clamp(hsv.z * uBrightness, 0., 1.);
    gl_FragColor = vec4(hsv2rgb(hsv), 1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export function createArtworkRenderer({ THREE, frameWood }) {
  // A physical stretcher/canvas backing casts a complete rectangular shadow.
  // The visible painting stays a pixel-sharp shader plane above this backing.
  const canvasBacking = new THREE.MeshStandardMaterial({ color: '#d5c3a4', roughness: 1 });
  function createPaintingMaterial(texture) {
    return new THREE.ShaderMaterial({
      uniforms: {
        uPainting: { value: texture },
        uHue: { value: 0 },
        uSaturation: { value: 1 },
        uBrightness: { value: 1 },
      },
      vertexShader, fragmentShader, side: THREE.FrontSide,
    });
  }

  return function framedArtwork(easel, texture, width, height) {
    // A previous restoration surface is unmounted before replacing a frame.
    easel.artwork.traverse((object) => {
      if (!object.isMesh) return;
      object.geometry.dispose();
      if (object.material.isShaderMaterial) object.material.dispose();
    });
    easel.artwork.clear();

    const a = easel.artwork;
    const rim = .135 * .7;
    const outerH = height + rim * 2;
    const material = createPaintingMaterial(texture);
    const backing = new THREE.Mesh(new THREE.BoxGeometry(width + rim, height + rim, .045), canvasBacking);
    backing.position.z = .126;
    backing.castShadow = true;
    backing.receiveShadow = true;
    a.add(backing);

    const image = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
    image.position.z = .16;
    image.renderOrder = 2;
    a.add(image);
    easel.paintingMesh = image;

    const frame = new THREE.Mesh(createFrameGeometry(THREE, width, height, rim), frameWood);
    frame.position.z = .085;
    frame.castShadow = true;
    frame.receiveShadow = true;
    a.add(frame);

    const previousShelfHeight = 1.91 - outerH / 2 - .065;
    const centerY = 1.91 + previousShelfHeight * .60;
    easel.artwork.position.y = centerY;
    easel.shelf.position.y = centerY - outerH / 2 - .065;
    easel.topClamp.position.y = Math.min(3.82, centerY + outerH / 2 + .045);
    return { centerY, material };
  };
}
