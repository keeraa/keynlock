// @ts-check
// Graphics quality for the Lair: a fixed level or "auto", which steps down
// when the frame rate stays low (the Key Archive's auto-quality.js approach).
// Each step removes GPU work, most expensive first:
//   pixel ratio  — the number of pixels drawn and outlined;
//   MSAA samples — the smoothing of the outline's colour buffer;
//   normal pass  — the outline's second scene pass (folds then come from depth).
// Auto only goes down within a session; choosing "auto" again starts at the top.
// It also holds the optional 60 FPS cap, which the frame loop reads.

export const QUALITY_LEVELS = Object.freeze([
  Object.freeze({ id: 'high', pixelRatio: 1.75, samples: 4, normals: true }),
  Object.freeze({ id: 'medium', pixelRatio: 1.25, samples: 2, normals: true }),
  Object.freeze({ id: 'low', pixelRatio: 1, samples: 0, normals: false }),
  Object.freeze({ id: 'minimal', pixelRatio: .75, samples: 0, normals: false }),
]);
export const QUALITY_MODES = Object.freeze(['auto', ...QUALITY_LEVELS.map(level => level.id)]);
/** The open lab is close to the camera: its pixel cost stays bounded on retina screens. */
const LAB_PIXEL_RATIO = 1.35;

/**
 * @param {{ renderer: any, outline: { setQuality(options: { samples: number, normals: boolean }): void } | null,
 *   devicePixelRatio?: number, minFps?: number, windowMs?: number, settleMs?: number }} options
 */
export function createQuality({ renderer, outline, devicePixelRatio = globalThis.devicePixelRatio || 1,
  minFps = 50, windowMs = 4000, settleMs = 3000 }) {
  let mode = 'auto', autoLevel = 0, labOpen = false, fpsCap = 0;
  let windowStart = null, frames = 0, judgeAfter = -Infinity;
  const listeners = new Set();

  const level = () => QUALITY_LEVELS[mode === 'auto' ? autoLevel : Math.max(0, QUALITY_LEVELS.findIndex(item => item.id === mode))];
  const pixelRatio = () => Math.min(devicePixelRatio, level().pixelRatio, labOpen ? LAB_PIXEL_RATIO : Infinity);
  const state = () => ({ mode, level: level().id, pixelRatio: pixelRatio(), fpsCap, lowered: mode === 'auto' && autoLevel > 0 });

  function apply() {
    const ratio = pixelRatio();
    if (Math.abs(renderer.getPixelRatio() - ratio) > .001) renderer.setPixelRatio(ratio);
    outline?.setQuality({ samples: level().samples, normals: level().normals });
    const current = state();
    for (const listener of listeners) listener(current);
  }

  function restart(now) { windowStart = null; frames = 0; judgeAfter = now + settleMs; }

  return {
    /** 'auto' or a level id; anything else is treated as 'auto'. */
    setMode(next) {
      const value = QUALITY_MODES.includes(next) ? next : 'auto';
      if (value === mode) return;
      mode = value;
      autoLevel = 0;
      restart(performance.now());
      apply();
    },
    /** Bound the pixel ratio while the alchemy lab is open. */
    setLabOpen(open) { if (labOpen !== Boolean(open)) { labOpen = Boolean(open); apply(); } },
    /** 60 or 0 (no cap). */
    setFpsCap(value) {
      const next = value ? 60 : 0;
      if (next === fpsCap) return;
      fpsCap = next;
      restart(performance.now());
      apply();
    },
    fpsCap: () => fpsCap,
    /**
     * One drawn frame (auto mode). A long gap is a pause or a hidden tab, not
     * steady slowness; after a change it waits a little before judging again.
     */
    sample(now, frameMs, active) {
      if (mode !== 'auto') return;
      if (!active || !(frameMs > 0) || frameMs > 250) { restart(now); return; }
      if (now < judgeAfter) return;
      if (windowStart === null) { windowStart = now; frames = 0; return; }
      frames++;
      const elapsed = now - windowStart;
      if (elapsed < windowMs) return;
      const fps = frames * 1000 / elapsed;
      windowStart = now; frames = 0;
      if (fps >= minFps || autoLevel >= QUALITY_LEVELS.length - 1) return;
      autoLevel++;
      judgeAfter = now + settleMs;
      apply();
    },
    state,
    /** Calls listener now and after every change. */
    subscribe(listener) { listeners.add(listener); listener(state()); return () => listeners.delete(listener); },
    apply,
  };
}

/**
 * The optional FPS cap for a requestAnimationFrame loop: skip(now) is true
 * for a refresh to leave out. On a 120 Hz screen with a 60 cap every other
 * refresh is skipped; a small tolerance keeps the browser's timing jitter
 * from dropping frames on a 60 Hz screen.
 * @param {() => number} getCap frames per second, 0 for no cap
 */
export function createFrameCap(getCap) {
  let nextFrameAt = 0;
  return function skip(now) {
    const cap = getCap() || 0;
    if (!cap) return false;
    const interval = 1000 / cap;
    if (now < nextFrameAt - 2) return true;
    nextFrameAt = now - nextFrameAt > interval ? now + interval : nextFrameAt + interval;
    return false;
  };
}
