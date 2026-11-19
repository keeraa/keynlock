import { CABINET_PLACE_SECONDS } from './cabinet-layout.js?v=22';

const clamp01 = number => Math.max(0, Math.min(1, number));

// Backend-independent trajectories, progress and durations for the archive.
export function samplePlacement(start, end, elapsed) {
  const travel = clamp01(elapsed / .30);
  const ease = 1 - (1 - travel) ** 3;
  const swayTime = Math.max(0, elapsed - .30);
  const sway = elapsed > .30 ? Math.sin(swayTime * 15) * .055 *
    Math.exp(-swayTime * 3) *
    Math.max(0, (CABINET_PLACE_SECONDS - elapsed) / (CABINET_PLACE_SECONDS - .30)) : 0;
  return {
    x: start.x + (end.x - start.x) * ease,
    y: start.y + (end.y - start.y) * ease + Math.sin(Math.PI * travel) * .16,
    z: start.z + (end.z - start.z) * ease,
    ease, sway, landed: elapsed >= CABINET_PLACE_SECONDS,
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
    landed: elapsed >= .48,
  };
}
