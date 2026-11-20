import { CABINET_PLACE_SECONDS } from './cabinet-layout.js?v=cabinet-cell-glow';

export const BUNDLE_RELEASE_INTERVAL_MS = 330;
export const CABINET_CONTACT_SECONDS = .30;
export const CABINET_CONTACT_GLOW_SECONDS = .48;

export function cabinetContactGlow(elapsed) {
  const age = elapsed - CABINET_CONTACT_SECONDS;
  return age < 0 ? 0 : Math.max(0, 1 - age / CABINET_CONTACT_GLOW_SECONDS);
}

export function playMotionContact(motion, contact, kind, playSound) {
  if (!contact || motion.soundPlayed) return;
  motion.soundPlayed = true;
  playSound?.(kind, motion.end);
}

const clamp01 = number => Math.max(0, Math.min(1, number));

// Backend-independent trajectories, progress and durations for the archive.
export function samplePlacement(start, end, elapsed) {
  const travel = clamp01(elapsed / CABINET_CONTACT_SECONDS);
  const ease = 1 - (1 - travel) ** 3;
  const swayTime = Math.max(0, elapsed - .30);
  const sway = elapsed > .30 ? Math.sin(swayTime * 17) * .19 *
    Math.exp(-swayTime * 2.3) *
    Math.max(0, (CABINET_PLACE_SECONDS - elapsed) / (CABINET_PLACE_SECONDS - .30)) : 0;
  return {
    x: start.x + (end.x - start.x) * ease,
    y: start.y + (end.y - start.y) * ease + Math.sin(Math.PI * travel) * .16,
    z: start.z + (end.z - start.z) * ease,
    ease, sway, contact: elapsed >= CABINET_CONTACT_SECONDS, landed: elapsed >= CABINET_PLACE_SECONDS,
  };
}

export function sampleDiscard(start, end, elapsed) {
  const progress = clamp01(elapsed / .48);
  const ease = 1 - (1 - progress) ** 3;
  return {
    x: start.x + (end.x - start.x) * ease,
    y: start.y + (end.y - start.y) * ease + Math.sin(Math.PI * progress) * .26,
    z: start.z + (end.z - start.z) * ease,
    progress, ease, rotationX: ease * Math.PI * 1.3,
    rotationY: ease * Math.PI * 1.1,
    scale: .38 * (1 - ease) + .04,
    contact: elapsed >= .44, landed: elapsed >= .48,
  };
}
