// A mass-conserving flow of coherent, gravitationally moving liquid parcels.
// The renderer skins them into a single continuous jet; parcels are removed
// only after crossing the receiver's open rim or spilling onto the table.
export const JET_INTERVAL = 1 / 100;
const GRAVITY = 9.81;
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

export function createLiquidJet(quota) {
  return { quota, emitted: 0, received: 0, spilled: 0, parcels: [], bank: 0, serial: 0, flowing: false, touched: false, lastImpact: null };
}

export function outflowRate(angle, headFraction, baseRate) {
  const mouthBelowBody = clamp((-Math.cos(angle) - .05) / .32, 0, 1);
  const hydrostaticHead = .77 + .45 * Math.sqrt(clamp(headFraction, 0, 1));
  return Math.max(0, baseRate * mouthBelowBody * hydrostaticHead);
}

export function emitLiquid(jet, mouth, direction, speed, rate, dt) {
  if (rate <= 0 || jet.emitted >= jet.quota - 1e-6) { jet.flowing = false; return 0; }
  jet.flowing = true;
  jet.bank += Math.max(0, dt);
  let emitted = 0;
  for (let i = 0; jet.bank >= JET_INTERVAL && i < 8; i++) {
    jet.bank -= JET_INTERVAL;
    const amount = Math.min(jet.quota - jet.emitted, rate * JET_INTERVAL);
    if (amount <= 1e-6) break;
    const seed = jet.serial++;
    const speedNoise = 1 + .027 * Math.sin(seed * 2.41);
    jet.parcels.push({
      x: mouth.x, y: mouth.y, z: mouth.z,
      vx: direction.x * speed * speedNoise,
      vy: direction.y * speed * speedNoise,
      vz: direction.z * speed * speedNoise,
      age: 0, amount
    });
    jet.emitted += amount;
    emitted += amount;
    if (jet.emitted >= jet.quota - 1e-6) { jet.flowing = false; break; }
  }
  return emitted;
}

export function advanceLiquidJet(jet, dt, receiver) {
  let received = 0, spilled = 0;
  const steps = Math.max(1, Math.ceil(Math.max(0, dt) / (1 / 90)));
  const h = Math.max(0, dt) / steps;
  const radius2 = receiver.radius * receiver.radius;
  const surfaceY = Math.min(receiver.rimY, receiver.surfaceY ?? receiver.rimY);
  for (let step = 0; step < steps; step++) {
    for (let i = jet.parcels.length - 1; i >= 0; i--) {
      const p = jet.parcels[i];
      const previousY = p.y, previousX = p.x, previousZ = p.z;
      const drag = 1 - .11 * h;
      p.vx *= drag;
      p.vz *= drag;
      p.x += p.vx * h;
      p.y += p.vy * h - GRAVITY * h * h * .5;
      p.z += p.vz * h;
      p.vy -= GRAVITY * h;
      p.age += h;

      // Passing through the rim grants access to the *inside* of the vessel.
      // The drop remains in flight until it reaches the fluid surface, which
      // can be metres below the rim when the receiving flask is empty.
      if (previousY >= receiver.rimY && p.y <= receiver.rimY && p.y < previousY) {
        const factor = (previousY - receiver.rimY) / (previousY - p.y);
        const x = previousX + (p.x - previousX) * factor - receiver.x;
        const z = previousZ + (p.z - previousZ) * factor - receiver.z;
        p.entered = x * x + z * z <= radius2;
        if (!p.entered) p.missed = true;
      }
      const arrived = p.entered && p.y <= surfaceY && p.vy < 0;
      if (arrived) {
        const divisor = previousY - p.y;
        const t = divisor > 1e-8 ? clamp((previousY - surfaceY) / divisor, 0, 1) : 1;
        jet.lastImpact = {
          x: previousX + (p.x - previousX) * t,
          y: surfaceY,
          z: previousZ + (p.z - previousZ) * t
        };
        jet.touched = true;
        received += p.amount;
        jet.received += p.amount;
        jet.parcels.splice(i, 1);
      } else if (p.y < receiver.floorY || p.age > 2.2) {
        spilled += p.amount;
        jet.spilled += p.amount;
        jet.parcels.splice(i, 1);
      }
    }
  }
  return { received, spilled };
}

export function jetMassBalance(jet) {
  return jet.emitted - jet.received - jet.spilled - jet.parcels.reduce((sum, p) => sum + p.amount, 0);
}
