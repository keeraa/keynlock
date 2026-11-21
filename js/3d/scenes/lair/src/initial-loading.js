// @ts-check
/** Keep the initial room veil up until its visible paintings are ready. */
export function createInitialLoadingGate({
  onProgress, onDone, minimumMs = 900, timeoutMs = 90000,
  now = () => performance.now(),
  setTimer = (callback, ms) => setTimeout(callback, ms),
  clearTimer = (id) => clearTimeout(id),
}) {
  const started = now();
  let finished = false;
  let lastLoaded = 0;
  const watchdog = setTimer(() => finish('timeout'), timeoutMs);

  function progress(loaded, total) {
    if (finished || !Number.isFinite(loaded) || !Number.isFinite(total)) return;
    const count = Math.max(0, Math.floor(total));
    lastLoaded = Math.max(lastLoaded, Math.min(count, Math.floor(loaded)));
    onProgress({ loaded: lastLoaded, total: count });
  }

  function finish(reason = 'ready') {
    if (finished) return;
    finished = true;
    clearTimer(watchdog);
    setTimer(() => onDone(reason), Math.max(0, minimumMs - (now() - started)));
  }

  return { progress, finish };
}
