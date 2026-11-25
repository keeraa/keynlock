import {
  validateRuntime,
  validateSize,
  validateSource,
  copyPalette,
  releaseTimeScale,
} from './runtime.js';
import {
  WATERCOLOR_PALETTE,
  createWatercolorPigments,
  PAPER_RECONSTRUCTION_GLSL,
  WATERCOLOR_APPEARANCE_GLSL,
} from './watercolor-appearance.js';
import { createRendererGuard } from './render-utils.js';
import { VERSION } from './preset.js';
import { vertex, makePaperTexture } from './shaders.js';
import { resolvePourSeed, createPourRandom } from './pour-random.js';

export { PAPER_RECONSTRUCTION_GLSL } from './watercolor-appearance.js';

/** Porous-paper approximation: water flux transports mobile pigment; adsorption is irreversible. */
export async function createPaperWatercolor({
  THREE: T,
  renderer,
  width,
  height,
  resolution = 256,
  options = {},
}) {
  validateRuntime({ THREE: T, renderer, width, height, resolution }, { attachments: 2 });
  const config = Object.freeze({
    appearance: 'paper',
    substeps: 4,
    evaporation: 0.19,
    adsorption: 0.32,
    emissionDuration: 1.1,
    pigmentLoad: 1.5,
    dropCount: 18,
    fadeRate: 1.6,
    palette: WATERCOLOR_PALETTE,
    ...options,
    palette: copyPalette(options.palette || WATERCOLOR_PALETTE),
  });
  if (
    !Number.isInteger(config.substeps) ||
    config.substeps < 1 ||
    config.substeps > 8 ||
    !['evaporation', 'adsorption', 'emissionDuration', 'pigmentLoad'].every(
      (k) => Number.isFinite(config[k]) && config[k] >= 0,
    ) ||
    config.palette.length !== 7 ||
    !Number.isInteger(config.dropCount) ||
    config.dropCount < 0 ||
    config.dropCount > 24 ||
    !Number.isFinite(config.fadeRate) ||
    config.fadeRate < 0
  )
    throw new RangeError('Invalid paper options');
  const palette = createWatercolorPigments(T, config.palette);
  const N = resolution,
    resources = [],
    materials = [],
    geometry = new T.PlaneGeometry(2, 2),
    scene = new T.Scene(),
    camera = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1),
    quad = new T.Mesh(geometry);
  quad.frustumCulled = false;
  scene.add(quad);
  const paper = makePaperTexture(T);
  let pourSeed = null,
    age = 99,
    accumulator = 0,
    disposed = false,
    hasSource = false,
    obstacleScene = null,
    obstacleCamera = null,
    lastFixed = null;
  const preserve = createRendererGuard(T, renderer),
    drawingSize = new T.Vector2();
  function target(type = T.HalfFloatType, depth = false, count = 1) {
    const rt = new T.WebGLRenderTarget(N, N, {
      type,
      count,
      minFilter: T.LinearFilter,
      magFilter: T.LinearFilter,
      depthBuffer: depth,
    });
    resources.push(rt);
    return rt;
  }
  // Two MRT attachments share a swap: mobile pigment/water and fixed pigment/visibility.
  const state = {
      read: target(T.HalfFloatType, false, 2),
      write: target(T.HalfFloatType, false, 2),
      swap() {
        const previous = this.read;
        this.read = this.write;
        this.write = previous;
      },
    },
    transported = target(),
    mask = target(T.UnsignedByteType, true);
  mask.texture.minFilter = mask.texture.magFilter = T.NearestFilter;
  // Exact per-cell coefficients, baked once per viewport rather than re-evaluated each substep.
  const paperCoefficients = target(T.FloatType);
  paperCoefficients.texture.minFilter = paperCoefficients.texture.magFilter = T.NearestFilter;
  const solidMaterial = new T.MeshBasicMaterial({
    color: 0xffffff,
    side: T.DoubleSide,
    toneMapped: false,
  });
  const uniforms = {
    mobile: { value: null },
    boundTex: { value: null },
    transported: { value: transported.texture },
    paperCoefficients: { value: paperCoefficients.texture },
    obstacles: { value: mask.texture },
    texel: { value: new T.Vector2(1 / N, 1 / N) },
    aspect: { value: width / height },
    card: { value: new T.Vector4(-2, -2, 0, 0) },
    pulse: { value: 0 },
    impact: { value: 0 },
    impactPulse: { value: 0 },
    dt: { value: 1 / 60 / config.substeps },
    adsorption: { value: config.adsorption },
    evaporation: { value: config.evaporation },
    load: { value: config.pigmentLoad },
    palette: { value: palette.map((c) => c.clone()) },
    pourShape: { value: new T.Vector4(0, 0, 0, 1) },
    pourFlow: { value: new T.Vector4(5, 1, 1, 0.22) },
    drops: { value: Array.from({ length: 24 }, () => new T.Vector4()) },
    dropBurst: { value: 0 },
    dropCount: { value: config.dropCount },
    fadeRate: { value: config.fadeRate },
  };
  const stampCapacity = 8;
  uniforms.stampCount = { value: 0 };
  uniforms.stamps = { value: Array.from({ length: stampCapacity }, () => new T.Vector4()) };
  uniforms.stampShapes = { value: Array.from({ length: stampCapacity }, () => new T.Vector4()) };
  uniforms.stampColors = { value: Array.from({ length: stampCapacity }, () => new T.Vector3()) };
  const common = `varying vec2 vUv;uniform sampler2D mobile,boundTex,transported,obstacles,paperCoefficients;uniform vec2 texel;uniform vec4 card;uniform float dt,aspect,pulse,load,adsorption,evaporation,impactPulse;uniform vec3 palette[7];uniform vec4 pourShape,pourFlow;uniform vec4 drops[24];uniform float dropBurst,fadeRate;uniform int dropCount;uniform int stampCount;uniform vec4 stamps[8],stampShapes[8];uniform vec3 stampColors[8];
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float pores(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}
float solid(vec2 uv){vec2 q=abs(uv-card.xy)-card.zw;return max(step(max(q.x,q.y),0.),step(.5,texture2D(obstacles,uv).r));}
float permeability(vec2 uv){return .08+.92*pow(pores(uv*vec2(aspect,1.)*67.),1.4);}
float bindFraction(float water){return 1.-exp(-dt*(adsorption*(.6+1.2*(1.-permeability(vUv)))+1.3*(1.-smoothstep(.015,.28,water))));}
`;
  function material(body) {
    const m = new T.ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: common + body,
      uniforms,
      depthTest: false,
      depthWrite: false,
    });
    materials.push(m);
    return m;
  }
  const bakePaper = material(
    `void main(){float p=permeability(vUv);gl_FragColor=sqrt(p*vec4(permeability(vUv+vec2(texel.x,0.)),permeability(vUv-vec2(texel.x,0.)),permeability(vUv+vec2(0.,texel.y)),permeability(vUv-vec2(0.,texel.y))));}`,
  );
  const transport = material(`
void main(){vec4 c=texture2D(mobile,vUv);vec3 pigment=c.rgb;float water=c.a;float sumFlux=0.;vec3 dyeFlux=vec3(0.);vec4 conductance=texture2D(paperCoefficients,vUv);
for(int j=0;j<4;j++){vec2 offset=j==0?vec2(texel.x,0.):j==1?vec2(-texel.x,0.):j==2?vec2(0.,texel.y):vec2(0.,-texel.y);vec2 uv=vUv+offset;if(uv.x<0.||uv.y<0.||uv.x>1.||uv.y>1.||solid(uv)>.5)continue;vec4 n=texture2D(mobile,uv);
// Symmetric conductance and upwind concentration: pigment follows water, never a free velocity field.
float mobility=.22*pow(clamp((water+n.a)*.75,0.,1.),1.2);float k=mobility*conductance[j];float flux=k*(n.a-water);sumFlux+=flux;dyeFlux+=flux>0.?flux*n.rgb/max(n.a,.0001):flux*c.rgb/max(water,.0001);
}
water=max(0.,water+sumFlux-evaporation*dt);pigment=max(vec3(0.),pigment+dyeFlux);
if(pulse>0.){vec2 p=(vUv-card.xy)*vec2(aspect,1.),h=card.zw*vec2(aspect,1.),q=abs(p)-h;float distance=length(max(q,0.))+min(max(q.x,q.y),0.);
float angle=atan(p.y,p.x);float bulge=pow(.5+.5*sin(angle*pourFlow.x+pourShape.z),3.);float band=(.004+.020*bulge)*pourShape.w*(1.+impactPulse*.85);float offset=.003+.012*bulge+impactPulse*.012;float bridge=pourFlow.w*exp(-pow((distance-.003)/.0035,2.));float puddle=(.25+bulge)*exp(-pow((distance-offset)/band,2.));float feed=(bridge+puddle)*step(0.,distance)*pulse*pourFlow.y*(1.+impactPulse*2.4);
water+=feed*dt*4.5*pourFlow.z;float sector=fract((atan(p.y,p.x)+3.14159265)/6.2831853)*7.;int a=int(floor(sector)),b=a==6?0:a+1;vec3 color=mix(palette[a],palette[b],smoothstep(.08,.92,fract(sector)));float dilution=.28+.90*smoothstep(.18,.85,pores(p*23.+pourShape.xy));pigment+=color*feed*load*dt*dilution;}
if(dropBurst>.5){for(int j=0;j<24;j++){if(j>=dropCount)break;vec2 v=(vUv-drops[j].xy)*vec2(aspect,1.);vec2 axes=vec2(.85+.22*sin(float(j)*1.7),1.15+.20*cos(float(j)*2.1));v*=axes;float shape=exp(-dot(v,v)/max(.0000001,drops[j].z*drops[j].z)*2.4);water+=shape*drops[j].w*dt*4.5;int colorIndex=j-7*(j/7);pigment+=palette[colorIndex]*shape*drops[j].w*dt*.9;}}
if(stampCount>0){for(int j=0;j<8;j++){
 if(j>=stampCount)break;
 vec2 p=(vUv-stamps[j].xy)*vec2(aspect,1.);vec4 shape=stampShapes[j];
 float c=cos(shape.x),s=sin(shape.x);p=mat2(c,-s,s,c)*p;p.x*=shape.y;
 float a=atan(p.y,p.x);float edge=1.+.13*sin(a*shape.z+shape.x)+.07*cos(a*(shape.z+2.)-shape.x);
 float r=length(p)/max(stamps[j].z*edge,.00001);
 float wet=1.-smoothstep(.65,1.06,r);
 float bloom=.7+.3*pores(p*180.+shape.x);
 water+=wet*stamps[j].w;
 pigment+=stampColors[j]*wet*(.28+.48*(1.-smoothstep(.05,.9,r)))*bloom;
}}
gl_FragColor=vec4(pigment,min(1.8,water))*(1.-solid(vUv));}
`);
  const absorb = new T.ShaderMaterial({
    vertexShader: vertex.replace('varying vec2 vUv;', 'out vec2 vUv;'),
    fragmentShader: (
      common +
      `
layout(location=0) out vec4 outMobile;layout(location=1) out vec4 outFixed;
void main(){vec4 wet=texture2D(transported,vUv),old=texture2D(boundTex,vUv);float fraction=bindFraction(wet.a);float pigment=max(wet.r,max(wet.g,wet.b));float dryFade=exp(-fadeRate*dt*(1.-smoothstep(.01,.09,wet.a)));float soaked=max(old.a*dryFade,smoothstep(.015,.045,wet.a)*smoothstep(.0003,.0015,pigment));outFixed=vec4(old.rgb+wet.rgb*fraction,soaked);outMobile=vec4(wet.rgb*(1.-fraction),wet.a)*(1.-solid(vUv));}`
    )
      .replace('varying vec2 vUv;', 'in vec2 vUv;')
      .replaceAll('texture2D(', 'texture('),
    uniforms,
    glslVersion: T.GLSL3,
    depthTest: false,
    depthWrite: false,
  });
  materials.push(absorb);
  const displayUniforms = {
    ...uniforms,
    paper: { value: paper },
    parchment: { value: options.paperTexture || paper },
    hasParchment: { value: !!options.paperTexture },
    screen: { value: new T.Vector2(width, height) },
  };
  const display = new T.ShaderMaterial({
    vertexShader: vertex,
    uniforms: displayUniforms,
    depthTest: false,
    depthWrite: false,
    fragmentShader: `${common}uniform sampler2D paper,parchment;uniform bool hasParchment;uniform vec2 screen;
${PAPER_RECONSTRUCTION_GLSL}
${WATERCOLOR_APPEARANCE_GLSL}
void main(){vec4 stain=reconstruct(boundTex,vUv);vec4 surface=reconstruct(mobile,vUv);vec3 ink=stain.rgb+surface.rgb;float concentration=max(ink.r,max(ink.g,ink.b));float field=stain.a-.035;float slope=max(length(vec2(dFdx(field),dFdy(field))),.000001);float coverage=smoothstep(-.65,.85,field/slope)*pow(clamp(stain.a,0.,1.),.8);
vec3 paperColor=watercolorPaper(vUv,paper,parchment,hasParchment,screen,aspect);
gl_FragColor=vec4(watercolorPaint(ink,paperColor,coverage,field/slope,surface.a),1.);
#include <colorspace_fragment>
}`,
  });
  materials.push(display);
  function pass(m, out) {
    quad.material = m;
    renderer.setRenderTarget(out);
    if (!out) {
      const size = renderer.getDrawingBufferSize(drawingSize);
      renderer.setViewport(0, 0, size.x, size.y);
    }
    renderer.render(scene, camera);
  }
  function clearFields() {
    renderer.setClearColor(0, 0);
    for (const rt of resources) {
      if (rt === mask || rt === paperCoefficients) continue;
      renderer.setRenderTarget(rt);
      renderer.clear();
    }
  }
  function updateMask() {
    renderer.setRenderTarget(mask);
    renderer.setClearColor(0, 0);
    renderer.clear();
    if (obstacleScene) {
      const old = obstacleScene.overrideMaterial;
      try {
        obstacleScene.overrideMaterial = solidMaterial;
        renderer.render(obstacleScene, obstacleCamera);
      } finally {
        obstacleScene.overrideMaterial = old;
      }
    }
  }
  try {
    preserve(() => {
      clearFields();
      updateMask();
      pass(bakePaper, paperCoefficients);
    });
    for (const m of materials) {
      quad.material = m;
      renderer.compile(scene, camera);
    }
  } catch (error) {
    dispose();
    throw error;
  }
  function substep() {
    uniforms.dropBurst.value = age < 1 ? 1 : 0;
    age += uniforms.dt.value;
    uniforms.impactPulse.value = uniforms.impact.value * Math.exp(-age * 5);
    uniforms.pulse.value =
      age < config.emissionDuration ? Math.pow(1 - age / config.emissionDuration, 0.65) : 0;
    uniforms.mobile.value = state.read.textures[0];
    uniforms.boundTex.value = state.read.textures[1];
    pass(transport, transported);
    uniforms.stampCount.value = 0;
    pass(absorb, state.write);
    state.swap();
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    resources.forEach((r) => r.dispose());
    materials.forEach((m) => m.dispose());
    solidMaterial.dispose();
    paper.dispose();
    geometry.dispose();
  }
  function assertAlive() {
    if (disposed) throw new Error('Watercolor paper has been disposed');
  }
  function inspect() {
    assertAlive();
    return preserve(() => {
      const wet = new Uint16Array(N * N * 4),
        dry = new Uint16Array(N * N * 4),
        solids = new Uint8Array(N * N * 4);
      renderer.readRenderTargetPixels(state.read, 0, 0, N, N, wet);
      renderer.readRenderTargetPixels(state.read, 0, 0, N, N, dry, undefined, 1);
      renderer.readRenderTargetPixels(mask, 0, 0, N, N, solids);
      let mass = 0,
        mobileMass = 0,
        fixedMass = 0,
        water = 0,
        nonFinite = 0,
        keyMass = 0,
        keyCells = 0,
        fixedLoss = 0,
        visibleCoverage = 0,
        weightedEdgeDistance = 0;
      const sides = [0, 0, 0, 0],
        card = uniforms.card.value;
      for (let i = 0; i < wet.length; i += 4) {
        let w = 0,
          d = 0;
        for (let c = 0; c < 3; c++) {
          const a = T.DataUtils.fromHalfFloat(wet[i + c]),
            b = T.DataUtils.fromHalfFloat(dry[i + c]);
          if (!Number.isFinite(a + b)) nonFinite++;
          w += a;
          d += b;
          if (lastFixed) fixedLoss += Math.max(0, T.DataUtils.fromHalfFloat(lastFixed[i + c]) - b);
        }
        const m = w + d;
        visibleCoverage += T.DataUtils.fromHalfFloat(dry[i + 3]);
        mass += m;
        mobileMass += w;
        fixedMass += d;
        water += T.DataUtils.fromHalfFloat(wet[i + 3]);
        if (solids[i] > 127) {
          keyCells++;
          keyMass += m;
        }
        const x = ((i / 4) % N) / N,
          y = Math.floor(i / 4 / N) / N;
        weightedEdgeDistance +=
          m *
          Math.hypot(
            (Math.max(0, Math.abs(x - card.x) - card.z) * width) / height,
            Math.max(0, Math.abs(y - card.y) - card.w),
          );
        if (x < card.x - card.z) sides[0] += m;
        if (x > card.x + card.z) sides[1] += m;
        if (y < card.y - card.w) sides[2] += m;
        if (y > card.y + card.w) sides[3] += m;
      }
      lastFixed = dry;
      return {
        model: 'paper',
        seed: pourSeed,
        age,
        mass,
        mobileMass,
        fixedMass,
        water,
        fixedLoss,
        visibleCoverage,
        sides,
        nonFinite,
        keyCells,
        keyMass,
        keySpeed: 0,
        meanSpeed: 0,
        meanEdgeDistance: weightedEdgeDistance / Math.max(mass, 1e-8),
      };
    });
  }
  return {
    version: VERSION,
    model: 'paper',
    config,
    inspect,
    step(dt = 1 / 60) {
      assertAlive();
      if (!Number.isFinite(dt) || dt < 0) throw new RangeError('Invalid dt');
      if (!hasSource) return 0;
      return preserve(() => {
        accumulator +=
          Math.min(0.1, dt) * releaseTimeScale(uniforms.impact.value, age, config.emissionDuration);
        let count = 0;
        while (accumulator + 1e-8 >= 1 / 60) {
          for (let i = 0; i < config.substeps; i++) substep();
          accumulator = Math.max(0, accumulator - 1 / 60);
          count++;
        }
        return count;
      });
    },
    render(target = null) {
      assertAlive();
      preserve(() => {
        uniforms.mobile.value = state.read.textures[0];
        uniforms.boundTex.value = state.read.textures[1];
        pass(display, target);
      });
    },
    // A bounded queue is consumed by the next physics substep, without extra render passes.
    emitSpot({ x, y, radius = 22, seed }) {
      assertAlive();
      if (![x, y, radius].every(Number.isFinite) || x < 0 || x > 1 || y < 0 || y > 1 || radius <= 0)
        throw new RangeError('Spot expects normalized x/y and a positive radius in pixels');
      const usedSeed = resolvePourSeed(seed),
        random = createPourRandom(usedSeed);
      hasSource = true;
      const i = Math.min(uniforms.stampCount.value, stampCapacity - 1);
      uniforms.stamps.value[i].set(x, 1 - y, radius / height, 0.7 + random() * 0.4);
      uniforms.stampShapes.value[i].set(
        random() * Math.PI * 2,
        0.72 + random() * 0.65,
        3 + Math.floor(random() * 4),
        0,
      );
      const first = Math.floor(random() * 7),
        second = (first + 1 + Math.floor(random() * 3)) % 7;
      uniforms.stampColors.value[i]
        .copy(palette[first])
        .lerp(palette[second], 0.15 + random() * 0.35);
      uniforms.stampCount.value = Math.min(stampCapacity, i + 1);
      return usedSeed;
    },
    emitRect({ x, y, width: w, height: h, seed, impact = 0 }) {
      assertAlive();
      validateSource({ x, y, width: w, height: h, seed, impact });
      uniforms.impact.value = impact;
      uniforms.card.value.set(x, 1 - y, w / 2, h / 2);
      pourSeed = resolvePourSeed(seed);
      const random = createPourRandom(pourSeed);
      hasSource = true;
      age = 0;
      lastFixed = null;
      uniforms.pourShape.value.set(
        random() * 40,
        random() * 40,
        random() * Math.PI * 2,
        0.8 + random() * 0.5,
      );
      uniforms.pourFlow.value.set(
        4 + Math.floor(random() * 4),
        0.85 + random() * 0.3,
        0.85 + random() * 0.3,
        0.18 + random() * 0.1,
      );
      const start = Math.floor(random() * 7),
        direction = random() < 0.5 ? 1 : -1;
      uniforms.palette.value.forEach((c, i) => c.copy(palette[(start + direction * i + 7) % 7]));
      const dropAngle = random() * Math.PI * 2;
      for (let i = 0; i < 24; i++) {
        const angle = dropAngle + i * 2.399963 + random() * 0.4,
          dx = Math.cos(angle),
          dy = Math.sin(angle),
          hw = (w * width) / 2,
          hh = (h * height) / 2,
          r = 1 / Math.max(Math.abs(dx) / hw, Math.abs(dy) / hh),
          scale = Math.min(hw / 99, 2),
          offset = (16 + random() * 50) * scale,
          radius = (i < 7 ? 1.4 + Math.pow(random(), 2) * 2.8 : 0.55 + random() * 0.7) * scale;
        const u = x + (dx * (r + offset)) / width,
          v = 1 - y - (dy * (r + offset)) / height;
        uniforms.drops.value[i].set(
          (Math.floor(u * N) + 0.5) / N,
          (Math.floor(v * N) + 0.5) / N,
          radius / height,
          0.9 + random() * 0.6,
        );
      }
      return pourSeed;
    },
    setObstacles(scene, camera) {
      assertAlive();
      if (scene && !camera) throw new TypeError('Camera required');
      obstacleScene = scene;
      obstacleCamera = camera;
      preserve(updateMask);
    },
    resize(w, h) {
      assertAlive();
      validateSize(w, h);
      const aspectChanged = w / h !== width / height;
      width = w;
      height = h;
      uniforms.aspect.value = w / h;
      displayUniforms.screen.value.set(w, h);
      if (aspectChanged) preserve(() => pass(bakePaper, paperCoefficients));
    },
    clear() {
      assertAlive();
      hasSource = false;
      age = 99;
      uniforms.stampCount.value = 0;
      accumulator = 0;
      lastFixed = null;
      uniforms.card.value.set(-2, -2, 0, 0);
      preserve(clearFields);
    },
    get seed() {
      return pourSeed;
    },
    contourMode: 'paper',
    get contourTexture() {
      return state.read.textures[1];
    },
    get pigmentTexture() {
      return state.read.textures[1];
    },
    get mobilePigmentTexture() {
      return state.read.textures[0];
    },
    get velocityTexture() {
      return null;
    },
    dispose,
  };
}
