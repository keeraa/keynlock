// @ts-check
import * as THREE from '../vendor/three.js';

const WIDTH = 256;
const HEIGHT = 128;
const LAYERS = [
  { distance: 24, width: 38, height: 31, speed: .26, opacity: .80 },
  { distance: 49, width: 87, height: 60, speed: .13, opacity: .48 },
];
const PALETTES = {
  day: { horizon: '#bdd5dc', zenith: '#4e86ad', near: '#f4e9d7', far: '#e6e7df' },
  night: { horizon: '#465575', zenith: '#172747', near: '#7081a1', far: '#8c9db7' },
};
const smooth = n => n * n * (3 - 2 * n);
const mix = (a, b, amount) => a + (b - a) * amount;

function noise(x, y, cells, seed) {
  const i = Math.floor(x), j = Math.floor(y);
  const hash = (cx, cy) => {
    const h = Math.imul((cx % cells + cells) % cells + seed, 0x9e3779b1) ^
      Math.imul((cy % cells + cells) % cells + seed * 7, 0x85ebca77);
    return (Math.imul(h ^ h >>> 16, 0x7feb352d) >>> 0) / 0xffffffff;
  };
  const a = smooth(x - i), b = smooth(y - j);
  return mix(mix(hash(i, j), hash(i + 1, j), a), mix(hash(i, j + 1), hash(i + 1, j + 1), a), b);
}

function cloudMask(seed) {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(WIDTH, HEIGHT);
  for (let y = 0; y < HEIGHT; y++) for (let x = 0; x < WIDTH; x++) {
    const u = x / WIDTH, v = y / HEIGHT;
    const density = .63 * noise(u * 5, v * 5, 5, seed) +
      .24 * noise(u * 10, v * 10, 10, seed + 13) +
      .10 * noise(u * 20, v * 20, 20, seed + 19) +
      .03 * noise(u * 40, v * 40, 40, seed + 23);
    const alpha = smooth(Math.max(0, Math.min(1, (density - .52) / .20)));
    const offset = (y * WIDTH + x) * 4;
    image.data[offset] = image.data[offset + 1] = image.data[offset + 2] = 255;
    image.data[offset + 3] = Math.round(alpha * 255);
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

function makeCloudMasks() { return [cloudMask(47), cloudMask(89)]; }

export function createWindowSky() {
  const textures = makeCloudMasks().map(canvas => {
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    return texture;
  });
  const uniforms = {
    nearCloud: { value: textures[0] }, farCloud: { value: textures[1] }, time: { value: 0 },
    skyHorizon: { value: new THREE.Color() }, skyZenith: { value: new THREE.Color() },
    nearColor: { value: new THREE.Color() }, farColor: { value: new THREE.Color() },
  };
  const material = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: true, toneMapped: false,
    vertexShader: `
      varying vec3 paneWorld;
      void main() {
        paneWorld = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D nearCloud, farCloud;
      uniform vec3 skyHorizon, skyZenith, nearColor, farColor;
      uniform float time;
      varying vec3 paneWorld;
      vec2 projectedCloud(vec3 ray, float depth, float width, float height, float speed) {
        float distanceToLayer = (sign(paneWorld.x) * depth - cameraPosition.x) / ray.x;
        vec3 point = cameraPosition + ray * distanceToLayer;
        return vec2((point.z - time * speed) / width, point.y / height);
      }
      void main() {
        vec3 ray = paneWorld - cameraPosition;
        float elevation = normalize(ray).y;
        vec3 color = mix(skyHorizon, skyZenith, smoothstep(.04, .83, elevation));
        float farAlpha = texture2D(farCloud, projectedCloud(ray, 49.0, 87.0, 60.0, .13)).a;
        float nearAlpha = texture2D(nearCloud, projectedCloud(ray, 24.0, 38.0, 31.0, .26)).a;
        color = mix(color, farColor, farAlpha * .48);
        color = mix(color, nearColor, nearAlpha * .80);
        gl_FragColor = vec4(color, 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
  return { material,
    setNight(night) {
      const palette = PALETTES[night ? 'night' : 'day'];
      uniforms.skyHorizon.value.set(palette.horizon);
      uniforms.skyZenith.value.set(palette.zenith);
      uniforms.nearColor.value.set(palette.near);
      uniforms.farColor.value.set(palette.far);
    },
    update(now) { uniforms.time.value = now / 1000; },
  };
}

export function createCanvasWindowSky(ctx, camera, project, path3) {
  const masks = makeCloudMasks();
  const styles = Object.fromEntries(Object.entries(PALETTES).map(([mode, palette]) => {
    const patterns = masks.map((mask, index) => {
      const canvas = document.createElement('canvas');
      canvas.width = WIDTH; canvas.height = HEIGHT;
      const paint = canvas.getContext('2d');
      paint.drawImage(mask, 0, 0);
      paint.globalCompositeOperation = 'source-in';
      paint.fillStyle = index ? palette.far : palette.near;
      paint.fillRect(0, 0, WIDTH, HEIGHT);
      return ctx.createPattern(canvas, 'repeat');
    });
    return [mode, { palette, patterns }];
  }));

  return (x, z, pane, now, night) => {
    if (!path3(pane, null)) return;
    const bottom = project(x, pane[0][1], z);
    const top = project(x, Math.max(...pane.map(point => point[1])), z);
    if (!top || !bottom) return;
    const { palette, patterns } = styles[night ? 'night' : 'day'];
    const sky = ctx.createLinearGradient(top.x, top.y, bottom.x, bottom.y);
    sky.addColorStop(0, palette.zenith);
    sky.addColorStop(1, palette.horizon);
    ctx.fillStyle = sky;
    ctx.fill();
    ctx.save();
    ctx.clip();
    const middleY = (pane[0][1] + pane[2][1]) * .5;
    for (let index = LAYERS.length - 1; index >= 0; index--) {
      const layer = LAYERS[index];
      const planeX = Math.sign(x) * layer.distance;
      const scale = (planeX - camera.position.x) / (x - camera.position.x);
      const y = camera.position.y + (middleY - camera.position.y) * scale;
      const worldZ = camera.position.z + (z - camera.position.z) * scale;
      const center = project(planeX, y, worldZ);
      const right = project(planeX, y, worldZ + 1);
      const down = project(planeX, y - 1, worldZ);
      const pattern = patterns[index];
      if (!center || !right || !down || !pattern) continue;
      const a = (right.x - center.x) * layer.width / WIDTH;
      const b = (right.y - center.y) * layer.width / WIDTH;
      const c = (down.x - center.x) * layer.height / HEIGHT;
      const d = (down.y - center.y) * layer.height / HEIGHT;
      const u = ((worldZ - now / 1000 * layer.speed) / layer.width % 1) * WIDTH;
      const v = (1 - y / layer.height % 1) * HEIGHT;
      pattern.setTransform(new DOMMatrix([a, b, c, d, center.x - a * u - c * v, center.y - b * u - d * v]));
      ctx.fillStyle = pattern;
      ctx.globalAlpha = layer.opacity;
      ctx.fill();
    }
    ctx.restore();
  };
}
