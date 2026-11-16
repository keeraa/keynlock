/** Quiet marine-snow/dust atmosphere: one GPU draw and no per-frame buffer writes. */
export const FLOATING_PARTICLE_COUNT=340;

const vertexShader=/* glsl */`
  uniform float uTime;
  uniform float uPixelRatio;
  attribute float aSize;
  attribute float aSpeed;
  attribute float aPhase;
  attribute float aOpacity;
  attribute vec3 aTint;
  varying vec3 vTint;
  varying float vOpacity;

  void main() {
    vec3 point=position;
    point.y=mod(point.y+3.0-uTime*aSpeed,6.0)-3.0;
    point.x+=sin(uTime*(0.27+abs(aSpeed)*0.38)+aPhase)*(0.16+aSize*0.4);
    point.z+=cos(uTime*0.18+aPhase*1.7)*0.11;
    vec4 eye=modelViewMatrix*vec4(point,1.0);
    gl_Position=projectionMatrix*eye;
    gl_PointSize=clamp(aSize*320.0*uPixelRatio/max(-eye.z,0.5),1.0,5.4);
    float fadeIn=smoothstep(-3.0,-2.55,point.y);
    float fadeOut=1.0-smoothstep(2.55,3.0,point.y);
    vOpacity=aOpacity*fadeIn*fadeOut;
    vTint=aTint;
  }
`;

const fragmentShader=/* glsl */`
  varying vec3 vTint;
  varying float vOpacity;
  void main() {
    float radius=length(gl_PointCoord-vec2(0.5));
    float mist=1.0-smoothstep(0.07,0.5,radius);
    float core=1.0-smoothstep(0.0,0.2,radius);
    gl_FragColor=vec4(vTint,vOpacity*(mist*0.72+core*0.28));
  }
`;

export function createFloatingParticles({THREE,scene,pixelRatio=1,count=FLOATING_PARTICLE_COUNT}) {
  // Independent seed: adding ambience cannot alter puzzle or rust randomness.
  let seed=0x51c1a5;
  const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  const positions=new Float32Array(count*3);
  const sizes=new Float32Array(count),speeds=new Float32Array(count);
  const phases=new Float32Array(count),opacities=new Float32Array(count);
  const tints=new Float32Array(count*3);
  const colors=[[.93,.95,.91],[.98,.88,.72],[.70,.84,.87]];
  for(let i=0;i<count;i++){
    positions[i*3]=random()*14-7;
    positions[i*3+1]=random()*6-3;
    positions[i*3+2]=random()*12-5.5;
    sizes[i]=.035+Math.pow(random(),2)*.075;
    speeds[i]=(.07+random()*.15)*(random()<.16?-1:1);
    phases[i]=random()*Math.PI*2;
    opacities[i]=.19+random()*.30;
    const tint=colors[Math.floor(random()*colors.length)];
    for(let channel=0;channel<3;channel++)tints[i*3+channel]=tint[channel];
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
  geometry.setAttribute('aSize',new THREE.BufferAttribute(sizes,1));
  geometry.setAttribute('aSpeed',new THREE.BufferAttribute(speeds,1));
  geometry.setAttribute('aPhase',new THREE.BufferAttribute(phases,1));
  geometry.setAttribute('aOpacity',new THREE.BufferAttribute(opacities,1));
  geometry.setAttribute('aTint',new THREE.BufferAttribute(tints,3));
  const material=new THREE.ShaderMaterial({
    vertexShader,fragmentShader,
    uniforms:{uTime:{value:0},uPixelRatio:{value:Math.min(2,Math.max(1,pixelRatio))}},
    transparent:true,depthTest:true,depthWrite:false,
    blending:THREE.NormalBlending,toneMapped:false,
  });
  const particles=new THREE.Points(geometry,material);
  particles.name='Парящая пыль';
  particles.userData.atmosphere=true;
  particles.frustumCulled=false; // Vertex shader moves flakes around the volume.
  particles.castShadow=false;
  particles.renderOrder=2;
  scene.add(particles);
  function update(dt){material.uniforms.uTime.value+=Math.max(0,dt);}
  function dispose(){scene.remove(particles);geometry.dispose();material.dispose();}
  return {particles,update,dispose};
}
