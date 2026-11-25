// Browser bindings and resources share one cleanup boundary per host/module.
export function createLifecycle() {
  const abort = new AbortController();
  const cleanups = [];
  let disposed = false;
  return {
    listen(target, type, handler, options = {}) {
      target.addEventListener(type, handler, { ...options, signal: abort.signal });
    },
    own(cleanup) {
      cleanups.push(cleanup);
      return cleanup;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      abort.abort();
      for (const cleanup of cleanups.reverse()) cleanup();
    },
  };
}
