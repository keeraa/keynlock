// @ts-check
// From the Alchemy Lab candle effect.
// Soft procedural flame in genuine Three.js shader planes. Crossing quads
// give the flame volume at oblique angles without geometry-heavy particles.
export function createCandleFlameMaterial(THREE, timeUniform) {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: timeUniform },
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    // Blend over the scene and write transmittance for the outline pass,
    // as the dust does. Ink behind the bright core disappears without
    // giving the transparent quad a visible rectangular edge.
    blending: THREE.CustomBlending, toneMapped: false,
    blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    vertexShader: [
      'varying vec2 vUv;',
      'void main() {',
      '  vUv = uv;',
      '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
      '}'
    ].join('\n'),
    fragmentShader: [
      'uniform float uTime;',
      'varying vec2 vUv;',
      'float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }',
      'float noise(vec2 p) {',
      '  vec2 i = floor(p), f = fract(p);',
      '  f = f*f*(3.0-2.0*f);',
      '  return mix(mix(hash(i), hash(i+vec2(1.,0.)), f.x),',
      '    mix(hash(i+vec2(0.,1.)), hash(i+vec2(1.,1.)), f.x), f.y);',
      '}',
      'void main() {',
      '  float y = vUv.y;',
      '  float motion = (noise(vec2(y * 4.4, uTime * 1.27)) - .5) * .045;',
      '  float swirl = (noise(vec2(y * 3.1, uTime * 1.8)) - .5) * .18;',
      '  float bend = (motion + swirl) * pow(y, 1.7);',
      '  float width = .34 * pow(1.0 - y, .77) + .008;',
      '  float distance = abs(vUv.x - .5 - bend);',
      '  float feather = 1.0 - smoothstep(width * .58, width, distance);',
      '  float alpha = feather * smoothstep(.0, .11, y) * (1.0 - smoothstep(.94, 1.0, y));',
      '  float core = 1.0 - smoothstep(0.0, width * .5, distance);',
      '  vec3 amber = mix(vec3(1.0,.25,.045), vec3(1.0,.77,.26), smoothstep(.12,.7,y));',
      '  vec3 color = mix(amber, vec3(1.0,.97,.66), core * (1.0 - y * .43));',
      '  color = mix(vec3(.28,.66,1.0), color, smoothstep(.035,.20,y));',
      '  alpha *= .82 + .16 * noise(vec2(vUv.x * 9., y * 11. - uTime * 2.));',
      '  gl_FragColor = vec4(color, alpha * .89);',
      '}'
    ].join('\n')
  });
}

export function createCandleFlame(THREE, material, geometry) {
  const flame = new THREE.Group();
  flame.name = 'procedural-candle-flame';
  for (const angle of [0, Math.PI / 2]) {
    const plane = new THREE.Mesh(geometry, material);
    plane.rotation.y = angle;
    plane.castShadow = plane.receiveShadow = false;
    plane.renderOrder = 12;
    flame.add(plane);
  }
  return flame;
}
