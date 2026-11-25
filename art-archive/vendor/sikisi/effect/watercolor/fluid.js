import {
  validateRuntime,
  validateSize,
  validateSource,
  copyPalette,
  releaseTimeScale,
} from './runtime.js';
import { createWatercolorPigments } from './watercolor-appearance.js';
import { createFluidShaders } from './fluid-shaders.js';
import { createRendererGuard } from './render-utils.js';
import { resolvePourSeed, createPourRandom } from './pour-random.js';
import {
  vertex,
  washDisplayFragment,
  smokeDisplayFragment,
  softenFragment,
  makePaperTexture,
} from './shaders.js';
import { VERSION, WATERCOLOR_SMOKE_V1, WATERCOLOR_WASH } from './preset.js';

/** GPU top-down watercolor smoke; caller owns THREE, renderer and animation loop. */
export async function createFluidWatercolor({
  THREE: T,
  renderer,
  width,
  height,
  resolution = 256,
  options = {},
}) {
  validateRuntime({ THREE: T, renderer, width, height, resolution });
  const config = Object.freeze({
    ...WATERCOLOR_WASH,
    ...(options.appearance === 'smoke' ? WATERCOLOR_SMOKE_V1 : {}),
    ...options,
    palette: copyPalette(options.palette || WATERCOLOR_WASH.palette),
  });
  for (const key of [
    'gravity',
    'edgeSoftness',
    'impulse',
    'swirl',
    'density',
    'vorticity',
    'velocityDecay',
    'pigmentDecay',
    'velocityDiffusion',
    'pigmentDiffusion',
  ])
    if (!Number.isFinite(config[key]) || config[key] < 0) throw new RangeError('Invalid ' + key);
  if (
    !Number.isInteger(config.pressureIterations) ||
    config.pressureIterations < 1 ||
    config.pressureIterations > 64 ||
    !Number.isFinite(config.emissionDuration) ||
    config.emissionDuration <= 0
  )
    throw new RangeError('Invalid solver settings');
  if (config.velocityDiffusion > 1 || config.pigmentDiffusion > 1)
    throw new RangeError('Invalid diffusion');
  if (!['wash', 'smoke'].includes(config.appearance)) throw new RangeError('Unknown appearance');
  if (!Array.isArray(config.palette) || config.palette.length !== 7)
    throw new RangeError('Palette must contain seven colors');
  const palette =
    config.appearance === 'smoke'
      ? createWatercolorPigments(T, config.palette)
      : config.palette.map((hex) => {
          const c = new T.Color(hex);
          return new T.Vector3(
            -Math.log(Math.max(0.02, c.r)) * 0.22,
            -Math.log(Math.max(0.02, c.g)) * 0.22,
            -Math.log(Math.max(0.02, c.b)) * 0.22,
          );
        });
  const SIZE = resolution;
  const fluidShaders = createFluidShaders(config.vorticity);
  const velocityFade = Math.exp(-config.velocityDecay / 60),
    pigmentFade = Math.exp(-config.pigmentDecay / 60);
  const preserve = createRendererGuard(T, renderer),
    drawingSize = new T.Vector2();
  const scene = new T.Scene(),
    camera = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1),
    geometry = new T.PlaneGeometry(2, 2),
    quad = new T.Mesh(geometry);
  quad.frustumCulled = false;
  scene.add(quad);
  const resources = [],
    programs = [];
  const create = (fragment, uniforms = {}) => {
    const m = new T.ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      uniforms,
      depthTest: false,
      depthWrite: false,
    });
    programs.push(m);
    return m;
  };
  const paper = makePaperTexture(T);
  const display = create(
    config.appearance === 'wash' ? washDisplayFragment : smokeDisplayFragment,
    {
      paperTex: { value: paper },
      parchment: { value: options.paperTexture || paper },
      hasParchment: { value: !!options.paperTexture },
      pigment: { value: null },
      screen: { value: new T.Vector2(width, height) },
      texel: { value: new T.Vector2(1 / SIZE, 1 / SIZE) },
    },
  );
  const clear = () => {
    const old = renderer.getRenderTarget();
    renderer.setClearColor(0, 0);
    for (const t of resources) {
      renderer.setRenderTarget(t);
      renderer.clear();
    }
    renderer.setRenderTarget(old);
  };
  function target() {
    const t = new T.WebGLRenderTarget(SIZE, SIZE, {
      type: T.HalfFloatType,
      minFilter: T.LinearFilter,
      magFilter: T.LinearFilter,
      depthBuffer: false,
      stencilBuffer: false,
    });
    resources.push(t);
    return t;
  }
  const smoothTarget = config.appearance === 'wash' ? target() : null;
  const smooth = smoothTarget
    ? create(softenFragment, {
        source: { value: null },
        texel: { value: new T.Vector2(1 / SIZE, 1 / SIZE) },
        radius: { value: config.edgeSoftness },
      })
    : null;
  function pass(m, out) {
    quad.material = m;
    renderer.setRenderTarget(out);
    if (!out) {
      const size = renderer.getDrawingBufferSize(drawingSize);
      renderer.setViewport(0, 0, size.x, size.y);
    }
    renderer.render(scene, camera);
  }
  let ink, velocity, pressure, divergence, curl;
  let pourSeed = null,
    simulation,
    smokeAge = 99;
  let accumulator = 0;
  let disposed = false,
    hasSource = false;
  let obstacleScene = null,
    obstacleCamera = null;
  const obstacleTarget = new T.WebGLRenderTarget(SIZE, SIZE, {
    minFilter: T.NearestFilter,
    magFilter: T.NearestFilter,
    depthBuffer: true,
  });
  const obstacleMaterial = new T.MeshBasicMaterial({
    color: 0xffffff,
    side: T.DoubleSide,
    toneMapped: false,
  });
  const source = {
    obstacles: { value: obstacleTarget.texture },
    card: { value: new T.Vector4(-2, -2, 0, 0) },
    pulse: { value: 0 },
    preservePigmentRatio: { value: config.appearance === 'smoke' },
    clock: { value: 0 },
    pourShape: { value: new T.Vector4(0, 0, 0, 1) },
    pourFlow: { value: new T.Vector4(7, 1, 1, 1) },
  };

  function updateObstacles() {
    const old = renderer.getRenderTarget();
    renderer.setRenderTarget(obstacleTarget);
    renderer.setClearColor(0, 0);
    renderer.clear();
    if (obstacleScene) {
      const saved = obstacleScene.overrideMaterial;
      try {
        obstacleScene.overrideMaterial = obstacleMaterial;
        renderer.render(obstacleScene, obstacleCamera);
      } finally {
        obstacleScene.overrideMaterial = saved;
      }
    }
    renderer.setRenderTarget(old);
  }

  const emit = create(fluidShaders.emit, {
    ...source,
    palette: { value: palette.map((c) => c.clone()) },
    downwardFlow: { value: config.appearance === 'wash' },
    impact: { value: 0 },
    impulse: { value: config.impulse },
    swirl: { value: config.swirl },
    load: { value: config.density },
    aspect: { value: width / height },
    source: { value: null },
    isVelocity: { value: false },
  });
  const pair = () => ({
    read: target(),
    write: target(),
    swap() {
      const previous = this.read;
      this.read = this.write;
      this.write = previous;
    },
  });
  ink = pair();
  velocity = pair();
  pressure = pair();
  divergence = target();
  curl = target();
  const base = {
    ...source,
    texel: { value: new T.Vector2(1 / SIZE, 1 / SIZE) },
    delta: { value: 1 / 60 },
  };
  const advect = create(fluidShaders.advect, {
    ...base,
    source: { value: null },
    velocityTex: { value: null },
    fade: { value: 1 },
    diffusion: { value: 0 },
    limitPigment: { value: false },
    limitVelocity: { value: false },
  });
  const curlPass = create(fluidShaders.curlPass, { ...base, v: { value: null } });
  const confine = create(fluidShaders.confine, {
    ...base,
    gravity: { value: config.gravity },
    v: { value: null },
    c: { value: null },
  });
  const divergencePass = create(fluidShaders.divergencePass, { ...base, v: { value: null } });
  const jacobi = create(fluidShaders.jacobi, { ...base, p: { value: null }, d: { value: null } });
  const project = create(fluidShaders.project, { ...base, v: { value: null }, p: { value: null } });
  simulation = () => {
    smokeAge += 1 / 60;
    source.clock.value = smokeAge;
    source.pulse.value =
      smokeAge < config.emissionDuration
        ? Math.pow(Math.max(0, 1 - smokeAge / config.emissionDuration), 1.6)
        : 0;
    emit.uniforms.aspect.value = width / height;
    // Momentum must outlive visible pigment: the previous .985/frame erased it in ~3 seconds.
    const emitting = source.pulse.value > 0;
    advect.uniforms.limitPigment.value = false;
    advect.uniforms.limitVelocity.value = !emitting;
    advect.uniforms.diffusion.value = config.velocityDiffusion;
    advect.uniforms.fade.value = velocityFade;
    advect.uniforms.source.value = advect.uniforms.velocityTex.value = velocity.read.texture;
    pass(advect, velocity.write);
    velocity.swap();
    if (emitting) {
      emit.uniforms.isVelocity.value = true;
      emit.uniforms.source.value = velocity.read.texture;
      pass(emit, velocity.write);
      velocity.swap();
    }
    curlPass.uniforms.v.value = velocity.read.texture;
    pass(curlPass, curl);
    confine.uniforms.v.value = velocity.read.texture;
    confine.uniforms.c.value = curl.texture;
    pass(confine, velocity.write);
    velocity.swap();
    divergencePass.uniforms.v.value = velocity.read.texture;
    pass(divergencePass, divergence);
    jacobi.uniforms.d.value = divergence.texture;
    for (let i = 0; i < config.pressureIterations; i++) {
      jacobi.uniforms.p.value = pressure.read.texture;
      pass(jacobi, pressure.write);
      pressure.swap();
    }
    project.uniforms.p.value = pressure.read.texture;
    project.uniforms.v.value = velocity.read.texture;
    pass(project, velocity.write);
    velocity.swap();
    advect.uniforms.limitPigment.value = true;
    advect.uniforms.limitVelocity.value = false;
    advect.uniforms.diffusion.value = config.pigmentDiffusion;
    advect.uniforms.fade.value = pigmentFade;
    advect.uniforms.source.value = ink.read.texture;
    advect.uniforms.velocityTex.value = velocity.read.texture;
    pass(advect, ink.write);
    ink.swap();
    if (emitting) {
      emit.uniforms.isVelocity.value = false;
      emit.uniforms.source.value = ink.read.texture;
      pass(emit, ink.write);
      ink.swap();
    }
    return ink.read.texture;
  };
  // Compile all passes off the input path; pressure passes do not compile during a stroke.
  try {
    preserve(() => {
      updateObstacles();
      clear();
    });
    for (const material of programs) {
      quad.material = material;
      renderer.compile(scene, camera);
    }
  } catch (error) {
    dispose();
    throw error;
  }
  function inspect() {
    const pixels = new Uint16Array(SIZE * SIZE * 4);
    renderer.readRenderTargetPixels(ink.read, 0, 0, SIZE, SIZE, pixels);
    const mask = new Uint8Array(SIZE * SIZE * 4);
    renderer.readRenderTargetPixels(obstacleTarget, 0, 0, SIZE, SIZE, mask);
    let keyCells = 0,
      keyMass = 0,
      keySpeed = 0;
    const speeds = new Uint16Array(SIZE * SIZE * 4);
    renderer.readRenderTargetPixels(velocity.read, 0, 0, SIZE, SIZE, speeds);
    let mass = 0,
      nonFinite = 0,
      weightedSpeed = 0,
      weightedRadius = 0,
      detailMass = 0,
      weightedDetailRadius = 0,
      weightedEdgeDistance = 0;
    const sides = [0, 0, 0, 0],
      c = source.card.value;
    for (let y = 0; y < SIZE; y++)
      for (let x = 0; x < SIZE; x++) {
        const i = (y * SIZE + x) * 4;
        const d =
          T.DataUtils.fromHalfFloat(pixels[i]) +
          T.DataUtils.fromHalfFloat(pixels[i + 1]) +
          T.DataUtils.fromHalfFloat(pixels[i + 2]);
        const detail = T.DataUtils.fromHalfFloat(pixels[i + 3]);
        if (!Number.isFinite(d + detail)) {
          nonFinite++;
          continue;
        }
        if (mask[i] > 127) {
          keyCells++;
          keyMass += d;
          keySpeed += Math.hypot(
            T.DataUtils.fromHalfFloat(speeds[i]),
            T.DataUtils.fromHalfFloat(speeds[i + 1]),
          );
        }
        const dx = (Math.max(0, Math.abs(x / SIZE - c.x) - c.z) * width) / height;
        const dy = Math.max(0, Math.abs(y / SIZE - c.y) - c.w);
        weightedEdgeDistance += d * Math.hypot(dx, dy);
        mass += d;
        detailMass += detail;
        weightedDetailRadius +=
          detail * Math.hypot(((x / SIZE - c.x) * width) / height, y / SIZE - c.y);
        weightedSpeed +=
          d *
          Math.hypot(
            T.DataUtils.fromHalfFloat(speeds[i]),
            T.DataUtils.fromHalfFloat(speeds[i + 1]),
          );
        weightedRadius += d * Math.hypot(((x / SIZE - c.x) * width) / height, y / SIZE - c.y);
        if (x / SIZE < c.x - c.z) sides[0] += d;
        if (x / SIZE > c.x + c.z) sides[1] += d;
        if (y / SIZE < c.y - c.w) sides[2] += d;
        if (y / SIZE > c.y + c.w) sides[3] += d;
      }
    return {
      seed: pourSeed,
      age: smokeAge,
      mass,
      sides,
      nonFinite,
      keyCells,
      keyMass,
      keySpeed,
      detailMass,
      meanDetailRadius: weightedDetailRadius / Math.max(detailMass, 1e-8),
      meanSpeed: weightedSpeed / Math.max(mass, 1e-8),
      meanEdgeDistance: weightedEdgeDistance / Math.max(mass, 1e-8),
      meanRadius: weightedRadius / Math.max(mass, 1e-8),
    };
  }

  function assertAlive() {
    if (disposed) throw new Error('WatercolorSmoke has been disposed');
  }
  function render(target = null) {
    assertAlive();
    return preserve(() => {
      if (smooth && hasSource) {
        smooth.uniforms.source.value = ink.read.texture;
        pass(smooth, smoothTarget);
      }
      display.uniforms.pigment.value =
        smooth && hasSource ? smoothTarget.texture : ink.read.texture;
      pass(display, target);
    });
  }
  function step(dt = 1 / 60) {
    assertAlive();
    if (!Number.isFinite(dt) || dt < 0) throw new RangeError('dt must be finite and nonnegative');
    if (!hasSource) return 0;
    return preserve(() => {
      accumulator +=
        Math.min(dt, 0.1) *
        releaseTimeScale(emit.uniforms.impact.value, smokeAge, config.emissionDuration);
      let steps = 0;
      while (accumulator + 1e-8 >= 1 / 60) {
        simulation();
        accumulator = Math.max(0, accumulator - 1 / 60);
        steps++;
      }
      return steps;
    });
  }
  function emitRect({ x, y, width: w, height: h, seed, impact = 0 }) {
    assertAlive();
    validateSource({ x, y, width: w, height: h, seed, impact });
    emit.uniforms.impact.value = impact;
    pourSeed = resolvePourSeed(seed);
    const random = createPourRandom(pourSeed);
    source.card.value.set(x, 1 - y, w / 2, h / 2);
    hasSource = true;
    smokeAge = 0;
    source.pourShape.value.set(
      random() * 40,
      random() * 40,
      random() * Math.PI * 2,
      0.75 + random() * 0.55,
    );
    source.pourFlow.value.set(5 + Math.floor(random() * 5), random(), random(), 1);
    emit.uniforms.impulse.value = config.impulse * (0.85 + random() * 0.3) * (1 + impact * 1.6);
    emit.uniforms.swirl.value = config.swirl * (0.75 + random() * 0.5);
    emit.uniforms.load.value = config.density * (0.85 + random() * 0.3);
    const start = Math.floor(random() * 7),
      direction = random() < 0.5 ? 1 : -1;
    emit.uniforms.palette.value.forEach((c, i) => c.copy(palette[(start + direction * i + 7) % 7]));
    return pourSeed;
  }
  function setObstacles(scene, camera) {
    assertAlive();
    if (scene && !camera) throw new TypeError('Obstacle scene requires a camera');
    obstacleScene = scene;
    obstacleCamera = camera;
    preserve(updateObstacles);
  }
  function resize(w, h) {
    assertAlive();
    validateSize(w, h);
    width = w;
    height = h;
    display.uniforms.screen.value.set(w, h);
    emit.uniforms.aspect.value = w / h;
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    obstacleTarget.dispose();
    obstacleMaterial.dispose();
    programs.forEach((m) => m.dispose());
    resources.forEach((t) => t.dispose());
    paper.dispose();
    geometry.dispose();
  }
  return {
    version: VERSION,
    config,
    step,
    render,
    emitRect,
    setObstacles,
    resize,
    inspect() {
      assertAlive();
      return preserve(inspect);
    },
    clear() {
      assertAlive();
      accumulator = 0;
      hasSource = false;
      smokeAge = 99;
      source.card.value.set(-2, -2, 0, 0);
      preserve(clear);
    },
    get seed() {
      return pourSeed;
    },
    contourMode: config.appearance,
    get contourTexture() {
      return smoothTarget?.texture || ink.read.texture;
    },
    get pigmentTexture() {
      return ink.read.texture;
    },
    get velocityTexture() {
      return velocity.read.texture;
    },
    dispose,
  };
}
