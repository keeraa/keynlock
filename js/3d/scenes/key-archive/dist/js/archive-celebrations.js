// @ts-check
import { TOTAL_KEYS, getProgress } from './rules.js';
import { t } from './i18n.js';

// Rewards for progress: a chime when a cabinet row fills, a fanfare and gold
// stars when a whole cabinet does, and the finale when the archive is done
// (the hall warms, the forgotten door opens, then the victory screen).
const FINALE_MS = 7000;

export function createCelebrations({ world, state, tone, playAt, toast, statistics = null, getMode, showVictory }) {
  // Baselines from the loaded save: already earned rewards do not replay.
  const litCabinets = world.cabinets.map(cabinet => cabinet.completion.isComplete());
  const startedRows = world.cabinets.map(cabinet => cabinet.completion.rowsStarted());
  let finalePlayed = false;

  // Once per frame, after the cabinets updated their completion.
  function update() {
    for (const cabinet of world.cabinets) {
      const lit = cabinet.completion.isComplete();
      // The row chime starts together with the shimmer, not after it settles.
      const started = cabinet.completion.rowsStarted();
      if (started > startedRows[cabinet.type]) playAt('row', cabinet.group.position);
      // A finished cabinet is heard across the hall, with a shower of stars.
      if (lit && !litCabinets[cabinet.type]) {
        tone('fanfare');
        world.celebrateCabinet?.(cabinet.type);
      }
      // Statistics: when each row and cabinet was completed (reward pacing).
      for (let row = startedRows[cabinet.type]; row < started; row++) statistics?.event('rowTimes');
      if (lit && !litCabinets[cabinet.type]) statistics?.event('cabinetTimes');
      startedRows[cabinet.type] = started;
      litCabinets[cabinet.type] = lit;
    }
  }

  // The last key is in. If the player is in a menu when the finale ends, the
  // victory screen waits for them to come back.
  function celebrateCompletion() {
    if (getProgress(state).processed !== TOTAL_KEYS) return;
    if (finalePlayed) { showVictory(); return; }
    finalePlayed = true;
    world.startFinale?.();
    tone('finale');
    toast(t('toast.archiveComplete'));
    const reveal = () => {
      if (getMode() === 'play') showVictory();
      else if (getMode() !== 'victory') setTimeout(reveal, 1000);
    };
    setTimeout(reveal, FINALE_MS);
  }

  return { update, celebrateCompletion };
}
