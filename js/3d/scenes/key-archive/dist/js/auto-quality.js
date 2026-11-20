// Automatic quality: when the hall runs slowly, render fewer pixels.
//
// The painted look is several full-screen passes (toon light, ink outline,
// distance blur, hover contours), so the cost grows with the pixel count and
// lowering the pixel ratio is the one step that keeps the style intact.
// Only time spent actually playing in a visible tab counts; after a pause or
// a change it waits a little before judging again. Quality only goes down
// within a session; a reload starts again from full detail.
export const QUALITY_PIXEL_RATIOS = Object.freeze([2, 1.5, 1, .75]);

export function qualityLevels(devicePixelRatio = 1) {
  const full = Math.min(Math.max(devicePixelRatio || 1, .75), 2);
  const levels = [full, ...QUALITY_PIXEL_RATIOS.filter(ratio => ratio < full)];
  return [...new Set(levels)];
}

export function createAutoQuality({ devicePixelRatio = 1, minFps = 40, windowMs = 4000, settleMs = 3000 } = {}) {
  const levels = qualityLevels(devicePixelRatio);
  let level = 0;
  let windowStart = null;
  let frames = 0;
  let judgeAfter = -Infinity;

  function restart(now) {
    windowStart = null;
    frames = 0;
    judgeAfter = now + settleMs;
  }

  // One rendered frame. Returns the new pixel ratio when it should change.
  function sample(now, frameMs, active) {
    // A long gap is a pause, a hidden tab or a stall, not steady slowness.
    if (!active || !(frameMs > 0) || frameMs > 250) { restart(now); return null; }
    if (now < judgeAfter) return null;
    if (windowStart === null) { windowStart = now; frames = 0; return null; }
    frames++;
    const elapsed = now - windowStart;
    if (elapsed < windowMs) return null;
    const fps = frames * 1000 / elapsed;
    windowStart = now;
    frames = 0;
    if (fps >= minFps || level >= levels.length - 1) return null;
    level++;
    judgeAfter = now + settleMs;
    return levels[level];
  }

  return {
    sample,
    get pixelRatio() { return levels[level]; },
    get lowered() { return level > 0; },
    // Back to full detail (the player turned the option off, or on again).
    reset(now = 0) { level = 0; restart(now); return levels[0]; },
  };
}
