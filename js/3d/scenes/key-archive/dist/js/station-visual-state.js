// @ts-check
import { SOAK_SECONDS } from './station-layout.js';

const clamp01 = value => Math.max(0, Math.min(1, value));
export const BATH_LIFT_MS = 950;

export function bathKeyProgress(key, kind, now) {
  return clamp01(1 - (key.bathUntil - now) / (SOAK_SECONDS[kind] * 1000));
}

const WATER_DIPS = 3;
const WATER_START = .15;
const WATER_TRAVEL = .27;
const WATER_ENTRY_PHASE = Math.acos(1 - 2 * WATER_START / WATER_TRAVEL) / (Math.PI * 2);

export function waterDipCount(progress) {
  return Math.min(WATER_DIPS, Math.floor(clamp01(progress) * WATER_DIPS + 1 - WATER_ENTRY_PHASE));
}

export function waterDip(progress) {
  const cycles = progress * WATER_DIPS;
  const dip = (1 - Math.cos(cycles * Math.PI * 2)) / 2;
  const rinsed = Math.min(1, Math.floor(cycles) / WATER_DIPS + Math.max(0, (cycles % 1 - .45) / .46) / 3);
  return { height: WATER_START - WATER_TRAVEL * dip - .10 * clamp01((progress - .97) / .03), remaining: 1 - rinsed, drip: Math.max(0, -Math.sin(cycles * Math.PI * 2)) };
}

// Visual timing is derived from persisted bathUntil: reopening a save never
// restarts a cleaning animation or changes the actual processing rules.
export function bathVisualState(keys, kind, now = Date.now()) {
  const duration = SOAK_SECONDS[kind] * 1000;
  if (!duration || !keys.length) return { active: 0, progress: 0, pigment: 0 };
  let active = 0;
  let progress = 0;
  let pigment = 0;
  for (const key of keys) {
    if (now >= key.bathUntil) continue;
    const part = bathKeyProgress(key, kind, now);
    active++;
    progress += part;
    pigment += Math.sin(part * Math.PI) * .5 + (1 - part) * .5;
  }
  return { active, progress: active ? progress / active : 1,
    pigment: active ? pigment / active : 0 };
}

export function meltVisualIntensity(now, impactAt) {
  const elapsed = now - impactAt;
  if (!Number.isFinite(elapsed) || elapsed < 0 || elapsed >= 1500) return 0;
  const attack = Math.min(1, elapsed / 140);
  return attack * Math.pow(1 - elapsed / 1500, 1.45);
}
