import { SOAK_SECONDS } from './station-layout.js?v=2';

const clamp01 = value => Math.max(0, Math.min(1, value));

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
    const part = clamp01(1 - (key.bathUntil - now) / duration);
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
