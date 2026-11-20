import { getLanguage, t } from './i18n.js';
import { getProgress, TOTAL_KEYS } from './rules.js';

const COUNTERS = ['pickedUp', 'throws', 'cleaned', 'washed', 'derusted', 'dewaxed',
  // Schema 2: where play time goes and what trips the player up.
  'wrongCabinet',     // a clean key offered to another family's cabinet
  'notReadyCabinet',  // a dirty, waxed or broken key offered to a cabinet
  'takenFromCabinet', // keys taken back out of a cell
  'bundlesBought', 'bundlesPlaced',
  'throwRepicks',     // thrown keys picked up again
  'quickRepicks',     // ... within 10 s and 4 m of the throw: likely an accidental R
  'pauses'];
// Active-play timestamps (ms) of each completed row / cabinet, for reward pacing.
const EVENT_LISTS = ['rowTimes', 'cabinetTimes'];
const MAX_EVENTS = 200;
const QUICK_REPICK_MS = 10000;
const QUICK_REPICK_METERS = 4;
const STAGES = ['explore', 'pickup', 'throw', 'rinse', 'rust', 'wax', 'sorted', 'forge', 'complete'];
const MILESTONES = ['firstPickup', 'firstClean', 'firstSort', 'firstCabinet', 'quarter', 'half', 'threeQuarters', 'complete'];
const CHECKPOINT_MS = 20000;
const nonnegative = value => Number.isSafeInteger(value) && value >= 0 ? value : 0;

export function createArchiveStatistics(state, now = () => performance.now()) {
  const previous = state.statistics;
  const initialProgress = getProgress(state);
  const data = {
    activeMs: nonnegative(previous?.activeMs),
    trackedFromProcessed: previous ? nonnegative(previous.trackedFromProcessed) : initialProgress.processed,
    counts: Object.fromEntries(COUNTERS.map(key => [key, nonnegative(previous?.counts?.[key])])),
    stage: STAGES.includes(previous?.stage) ? previous.stage : 'explore',
    milestones: Object.fromEntries(MILESTONES
      .filter(name => Number.isSafeInteger(previous?.milestones?.[name]) && previous.milestones[name] >= 0)
      .map(name => [name, previous.milestones[name]])),
    walkedM: nonnegative(previous?.walkedM),
    // Active time standing by the workbench while a key there soaks or smelts.
    stationWaitMs: nonnegative(previous?.stationWaitMs),
    // Time in pause, menus or another tab after first entering the hall.
    pausedMs: nonnegative(previous?.pausedMs),
    ...Object.fromEntries(EVENT_LISTS.map(name => [name,
      Array.isArray(previous?.[name]) ? previous[name].filter(at => Number.isSafeInteger(at) && at >= 0).slice(-MAX_EVENTS) : []])),
  };
  state.statistics = data;
  let activeSince = null;
  let pausedSince = null;
  let lastCheckpoint = data.activeMs;
  let walkedRemainder = 0;
  let waitRemainder = 0;
  const thrown = new Map(); // key id -> { at, x, z } of its throw (this session)

  function elapsed() {
    return data.activeMs + (activeSince === null ? 0 : Math.max(0, Math.round(now() - activeSince)));
  }

  function checkpoint() {
    const time = data.activeMs = elapsed();
    if (activeSince !== null) activeSince = now();
    lastCheckpoint = time;
  }

  function setActive(active) {
    if (active && activeSince === null) {
      activeSince = now();
      if (pausedSince !== null) data.pausedMs += Math.max(0, Math.round(activeSince - pausedSince));
      pausedSince = null;
    }
    if (!active && activeSince !== null) {
      checkpoint();
      activeSince = null;
      pausedSince = now();
      data.counts.pauses++;
      return true;
    }
    return false;
  }

  // Once per frame while playing: metres walked, and whether the player stands
  // by the workbench while something there is still processing.
  function frame(deltaMs, { walked = 0, waitingAtStation = false } = {}) {
    walkedRemainder += Math.max(0, walked);
    const metres = Math.floor(walkedRemainder);
    data.walkedM += metres;
    walkedRemainder -= metres;
    if (waitingAtStation) {
      waitRemainder += Math.max(0, deltaMs);
      const whole = Math.floor(waitRemainder);
      data.stationWaitMs += whole;
      waitRemainder -= whole;
    }
  }

  function count(name, by = 1) {
    if (COUNTERS.includes(name)) data.counts[name] += by;
  }

  function event(list, at = elapsed()) {
    if (!EVENT_LISTS.includes(list)) return;
    data[list].push(at);
    if (data[list].length > MAX_EVENTS) data[list].shift();
  }

  function keyThrown(keyId, x, z) { thrown.set(keyId, { at: elapsed(), x, z }); }

  // A key picked up from the floor; the player stands at x, z.
  function keyPicked(keyId, x, z) {
    const toss = thrown.get(keyId);
    if (!toss) return;
    thrown.delete(keyId);
    data.counts.throwRepicks++;
    if (elapsed() - toss.at <= QUICK_REPICK_MS && Math.hypot(x - toss.x, z - toss.z) <= QUICK_REPICK_METERS)
      data.counts.quickRepicks++;
  }

  function record(stage, increments = {}) {
    const progress = getProgress(state);
    const at = elapsed();
    for (const key of COUNTERS) data.counts[key] += increments[key] ?? 0;
    if (data.milestones.complete === undefined) data.stage = stage;
    const mark = (name, reached) => {
      if (reached) data.milestones[name] ??= at;
    };
    mark('firstPickup', data.counts.pickedUp > 0);
    mark('firstClean', data.counts.cleaned > 0);
    mark('firstSort', stage === 'sorted');
    mark('firstCabinet', stage === 'sorted' && progress.completedCabinets > initialProgress.completedCabinets);
    mark('quarter', data.trackedFromProcessed < TOTAL_KEYS * .25 && progress.processed >= TOTAL_KEYS * .25);
    mark('half', data.trackedFromProcessed < TOTAL_KEYS * .50 && progress.processed >= TOTAL_KEYS * .50);
    mark('threeQuarters', data.trackedFromProcessed < TOTAL_KEYS * .75 && progress.processed >= TOTAL_KEYS * .75);
    mark('complete', data.trackedFromProcessed < TOTAL_KEYS && progress.processed === TOTAL_KEYS);
    if (data.milestones.complete !== undefined) data.stage = 'complete';
  }

  function snapshot() {
    const progress = getProgress(state);
    return {
      schemaVersion: 2, activeMs: elapsed(), trackedFromProcessed: data.trackedFromProcessed,
      stage: progress.processed === TOTAL_KEYS ? 'complete' : data.stage,
      lastProgress: { processed: progress.processed, total: TOTAL_KEYS, sorted: progress.done,
        smelted: progress.trashed, completedCabinets: progress.completedCabinets },
      counts: { ...data.counts }, milestones: { ...data.milestones },
      completionMs: data.milestones.complete ?? null,
      walkedM: data.walkedM, stationWaitMs: data.stationWaitMs, pausedMs: data.pausedMs,
      rowTimes: [...data.rowTimes], cabinetTimes: [...data.cabinetTimes],
    };
  }

  return { record, checkpoint, setActive, snapshot, frame, count, event, keyThrown, keyPicked,
    shouldCheckpoint: () => activeSince !== null && elapsed() - lastCheckpoint >= CHECKPOINT_MS };
}

function duration(ms) {
  const seconds = Math.floor(ms / 1000);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds / 60) % 60;
  const stamp = [minutes, seconds % 60].map(part => String(part).padStart(2, '0')).join(':');
  return hours ? hours + ':' + stamp : stamp;
}

export function createStatisticsPanel(document, statistics) {
  const values = document.getElementById('statistics-values');
  function render() {
    const report = statistics.snapshot();
    const { lastProgress, counts, completionMs } = report;
    const format = new Intl.NumberFormat(getLanguage());
    const n = value => format.format(value);
    const metrics = [
      ['active', duration(report.activeMs)], ['throws', n(counts.throws)],
      ['pickedUp', n(counts.pickedUp)], ['cleaned', n(counts.cleaned)],
      ['washed', n(counts.washed)], ['derusted', n(counts.derusted)], ['dewaxed', n(counts.dewaxed)],
      ['sorted', n(lastProgress.sorted)], ['smelted', n(lastProgress.smelted)],
      ['walked', `${n(report.walkedM)} ${t('statistics.metres')}`],
      ['stationWait', duration(report.stationWaitMs)],
      ['wrongCabinet', n(counts.wrongCabinet)],
      ['bundlesPlaced', n(counts.bundlesPlaced)],
      ['progress', n(lastProgress.processed)],
      ['stage', t('statistics.stage.' + report.stage)],
    ];
    if (completionMs !== null) metrics.push(['completion', duration(completionMs)]);
    const entries = metrics.flatMap(([key, value]) => {
      const term = document.createElement('dt');
      const description = document.createElement('dd');
      term.textContent = t('statistics.' + key);
      description.textContent = value;
      return [term, description];
    });
    values.replaceChildren(...entries);
  }

  document.getElementById('statistics-export').addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(statistics.snapshot(), null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'key-archive-statistics.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  return { render };
}
