/** Explicit ownership of every DOM listener attached by a UI subsystem. */
export function createEventScope() {
  const listeners = [];
  return {
    listen(target, type, handler, options) {
      target.addEventListener(type, handler, options);
      listeners.push({ target, type, handler, options });
    },
    dispose() {
      for (const { target, type, handler, options } of listeners.splice(0))
        target.removeEventListener?.(type, handler, options);
    },
  };
}
