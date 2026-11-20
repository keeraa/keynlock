import { getLanguage, t } from './i18n.js';
import { getProgress, TOTAL_KEYS } from './rules.js?v=key-ring';

const COUNTERS = ['pickedUp', 'throws', 'cleaned', 'washed', 'derusted', 'dewaxed'];
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
  };
  state.statistics = data;
  let activeSince = null;
  let lastCheckpoint = data.activeMs;

  function elapsed() {
    return data.activeMs + (activeSince === null ? 0 : Math.max(0, Math.round(now() - activeSince)));
  }

  function checkpoint() {
    const time = data.activeMs = elapsed();
    if (activeSince !== null) activeSince = now();
    lastCheckpoint = time;
  }

  function setActive(active) {
    if (active && activeSince === null) activeSince = now();
    if (!active && activeSince !== null) {
      checkpoint();
      activeSince = null;
      return true;
    }
    return false;
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
      schemaVersion: 1, activeMs: elapsed(), trackedFromProcessed: data.trackedFromProcessed,
      stage: progress.processed === TOTAL_KEYS ? 'complete' : data.stage,
      lastProgress: { processed: progress.processed, total: TOTAL_KEYS, sorted: progress.done,
        smelted: progress.trashed, completedCabinets: progress.completedCabinets },
      counts: { ...data.counts }, milestones: { ...data.milestones },
      completionMs: data.milestones.complete ?? null,
    };
  }

  return { record, checkpoint, setActive, snapshot,
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
