import * as THREE from '../vendor/three.js';
import { createWindowPaneGeometry } from './hall-architecture.js?v=21';

// Snow stays beyond the panes. Large, heavy flakes, short wet streaks and
// condensed glass are rendered together, with one material shared by all windows.
export function createWetSnow() {
  const uniforms = {
    uTime: { value: 0 },
    uAmount: { value: .65 },
    uWind: { value: .28 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexShader: `varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform float uTime;
      uniform float uAmount;
      uniform float uWind;
      varying vec2 vUv;
      float rand(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
      float layer(vec2 uv, float scale, float speed, float seed) {
        vec2 flow = vec2(uv.x * scale + uTime * uWind * (.17 + seed * .09),
                         uv.y * scale * 1.15 + uTime * speed);
        vec2 cell = floor(flow);
        vec2 q = fract(flow);
        float probability = step(rand(cell + seed), .65);
        float x = .17 + rand(cell + seed + 3.0) * .66;
        float y = .18 + rand(cell + seed + 4.0) * .65;
        float radius = mix(.065, .15, rand(cell + seed + 8.0));
        vec2 diff = (q - vec2(x,y)) * vec2(1.0,1.32);
        float flake = 1.0 - smoothstep(radius * .55, radius * 1.5, length(diff));
        float streak = 1.0 - smoothstep(radius * .25, radius * .6, abs(q.x - x));
        streak *= 1.0 - smoothstep(radius * 2.0, radius * 4.3, abs(q.y - y));
        return probability * max(flake, streak * .24) * mix(.6, 1.0, rand(cell + seed + 9.0));
      }
      void main() {
        if (uAmount <= .001) discard;
        float flakes = layer(vUv, 11.0, .38, 2.0) * .74;
        flakes += layer(vUv + vec2(.15,.25), 19.0, .62, 7.0) * .58;
        flakes += layer(vUv + vec2(.36,.1), 26.0, .91, 11.0) * .30;
        float slush = pow(1.0 - vUv.y, 8.0);
        float ice = smoothstep(.20,.85,rand(vec2(floor(vUv.x * 27.0), 41.0))) * slush * .38;
        float droplets = 0.0;
        for (int i = 0; i < 3; i++) {
          float x = rand(vec2(float(i),14.0));
          float lengthY = .20 + rand(vec2(float(i),34.0)) * .34;
          float head = .82 - mod(uTime * (.045 + float(i) * .012) + float(i) * .24, .77);
          float distX = abs(vUv.x - x);
          float trail = (1.0 - smoothstep(.001,.009, distX)) * smoothstep(head - lengthY, head, vUv.y)
            * (1.0 - smoothstep(head, head + .03, vUv.y));
          droplets += trail * .08;
        }
        float alpha = clamp(flakes * uAmount * .90 + ice * uAmount + droplets * uAmount,0.0,.85);
        vec3 color = mix(vec3(.56,.72,.76), vec3(.96,.97,.94), clamp(flakes,0.0,1.0));
        gl_FragColor = vec4(color, alpha);
        #include <colorspace_fragment>
      }
    `,
  });
  const geometry = createWindowPaneGeometry();
  const meshes = [];
  function addToWindow(windowGroup) {
    const pane = new THREE.Mesh(geometry, material);
    pane.position.z = -.032;
    pane.renderOrder = 1;
    windowGroup.add(pane);
    meshes.push(pane);
  }
  function setSettings(settings) {
    uniforms.uAmount.value = settings.wetSnowEnabled ? settings.snowIntensity / 100 : 0;
    uniforms.uWind.value = settings.snowWind / 100;
    for (const pane of meshes) pane.visible = uniforms.uAmount.value > 0;
  }
  function update(now) { uniforms.uTime.value = now / 1000; }
  function dispose() { geometry.dispose(); material.dispose(); }
  return { addToWindow, setSettings, update, dispose };
}
