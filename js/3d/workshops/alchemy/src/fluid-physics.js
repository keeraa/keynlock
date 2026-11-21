// @ts-check
// Lightweight fixed-step liquid inertia for small vessels. A damped free-surface
// spring reacts to the vessel's acceleration and gravity projected into its
// local axes. Falling droplets use ballistic integration instead of a timed fill.
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

export function createSlosh() {
  return {
    slopeX: 0, slopeZ: 0, rateX: 0, rateZ: 0,
    lastPosition: null, lastSpeedX: 0, lastSpeedZ: 0
  };
}

export function stepSlosh(state, position, angleZ, dt) {
  const h = clamp(dt, 1 / 240, 1 / 30);
  if (!state.lastPosition) state.lastPosition = { x: position.x, z: position.z };
  const vx = (position.x - state.lastPosition.x) / h;
  const vz = (position.z - state.lastPosition.z) / h;
  const ax = clamp((vx - state.lastSpeedX) / h, -60, 60);
  const az = clamp((vz - state.lastSpeedZ) / h, -60, 60);
  state.lastPosition.x = position.x;
  state.lastPosition.z = position.z;
  state.lastSpeedX = vx;
  state.lastSpeedZ = vz;

  // In the vessel frame gravity tilts the meniscus in the opposite direction.
  // Linear acceleration leans the surface against the direction of travel.
  const gravitySlope = -Math.tan(clamp(angleZ, -1.05, 1.05));
  const targetX = clamp(gravitySlope - ax / 32, -.65, .65);
  const targetZ = clamp(-az / 32, -.55, .55);
  const spring = 11.5;
  const damping = 2 * .42 * spring;
  state.rateX += ((targetX - state.slopeX) * spring * spring - damping * state.rateX) * h;
  state.rateZ += ((targetZ - state.slopeZ) * spring * spring - damping * state.rateZ) * h;
  state.slopeX = clamp(state.slopeX + state.rateX * h, -.68, .68);
  state.slopeZ = clamp(state.slopeZ + state.rateZ * h, -.58, .58);
  return state;
}

export function splashSlosh(state, lateralImpulse = 0.7) {
  state.rateX += clamp(lateralImpulse, -2.5, 2.5);
  state.rateZ += .25;
}

export function follow(current, target, dt, response = 9) {
  return current + (target - current) * (1 - Math.exp(-response * Math.max(0, dt)));
}

export function stepDroplet(drop, dt) {
  const h = Math.max(0, dt);
  drop.x += drop.vx * h;
  drop.y += drop.vy * h - 4.905 * h * h;
  drop.z += drop.vz * h;
  drop.vy -= 9.81 * h;
  drop.age += h;
  return drop;
}

export function landsInVessel(drop, rimY, centerX, centerZ, radius) {
  const dx = drop.x - centerX, dz = drop.z - centerZ;
  return drop.y <= rimY && dx * dx + dz * dz < radius * radius;
}
