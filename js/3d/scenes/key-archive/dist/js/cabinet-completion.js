import { CABINET_CAPACITY, CABINET_COLUMNS, CABINET_ROWS } from './cabinet-layout.js?v=single-source';

export const COMPLETION_SECONDS = 2.25;
export function sampleCabinetCelebration(seconds) {
  if (seconds < 0 || seconds >= COMPLETION_SECONDS) return null;
  const sweep = Math.min(1, seconds / 1.05);
  const flash = Math.exp(-Math.pow((seconds - 1.2) / .15, 2));
  const fade = seconds < 1.45 ? 1 : Math.max(0, (COMPLETION_SECONDS - seconds) / .8);
  return { sweep, flash, fade };
}

// Membership is inspected after actions, never by scanning all keys in the frame loop.
// Initial snapshots establish a baseline without replaying earned celebrations.
export function createCabinetCompletion() {
  const columns = CABINET_COLUMNS * 2;
  const lines = CABINET_ROWS * 2;
  let initialized = false, complete = false, finishedAt = -Infinity;
  let filled = Array(lines).fill(false);
  const events = new Map();
  let rowsStarted = 0;           // counts row celebrations as they begin
  function refresh(keys, now = performance.now()) {
    const slots = new Set(keys.map(key => key.cabinetSlot)
      .filter(slot => Number.isInteger(slot) && slot >= 0 && slot < CABINET_CAPACITY));
    const next = filled.map((_, row) => Array.from({ length: columns }, (_, column) => row * columns + column)
      .every(slot => slots.has(slot)));
    next.forEach((full, row) => {
      if (initialized && full && !filled[row]) { events.set(row, now); rowsStarted++; }
      if (!full) events.delete(row);
    });
    const all = slots.size === CABINET_CAPACITY;
    if (initialized && all && !complete) finishedAt = now;
    if (!all) finishedAt = -Infinity;
    filled = next; complete = all; initialized = true;
  }
  function frame(now = performance.now()) {
    const rows = [];
    for (const [row, start] of events) {
      // requestAnimationFrame timestamps can precede an event created during that frame.
      if (now < start) continue;
      const pulse = sampleCabinetCelebration((now - start) / 1000);
      if (pulse) rows.push({ row, ...pulse }); else events.delete(row);
    }
    return { rows, cabinet: sampleCabinetCelebration((now - finishedAt) / 1000), complete,
      crownGlow: complete ? .08 + .14 * Math.exp(-Math.max(0, now - finishedAt - 1200) / 1800) : 0 };
  }
  function settledRows() {
    return filled.reduce((mask, full, row) => full && !events.has(row) ? mask | (1 << row) : mask, 0);
  }
  return { refresh, frame, settledRows, isComplete: () => complete, rowsStarted: () => rowsStarted };
}
