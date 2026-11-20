// Pointer Lock for first-person mouse look.
//
// The browser can refuse it (embedded browsers), grant it late, or release it
// on its own (the player presses Escape). This module tracks those states:
//   unavailable   the browser will not lock: the caller turns at screen edges
//   onLocked      the lock was granted
//   onBrowserUnlock  the browser released a lock we did not ask to release
//                    (the caller pauses the game)
export function createPointerLock({ canvas, document, isPlayMode, onLocked = () => {}, onBrowserUnlock = () => {} }) {
  let requestPending = false;
  let unavailable = false;
  let wasLocked = false;
  let releaseRequested = false;
  let nativeReleaseAt = -Infinity;

  const locked = () => document.pointerLockElement === canvas;

  function markUnavailable() {
    requestPending = false;
    unavailable = true;
  }

  function request() {
    if (!isPlayMode() || locked() || requestPending || unavailable) return;
    if (!canvas.requestPointerLock) {
      markUnavailable();
      return;
    }
    requestPending = true;
    try {
      const promise = canvas.requestPointerLock();
      if (promise?.then) {
        promise.then(() => { requestPending = false; }, markUnavailable);
      } else {
        // Older implementations use only pointerlockchange / pointerlockerror events.
        setTimeout(() => {
          if (requestPending && !locked()) markUnavailable();
        }, 650);
      }
    } catch { markUnavailable(); }
  }

  function release() {
    if (!locked() && !wasLocked) return;
    releaseRequested = true;
    if (locked()) document.exitPointerLock();
  }

  document.addEventListener('pointerlockchange', () => {
    if (locked()) {
      requestPending = false;
      unavailable = false;
      wasLocked = true;
      onLocked();
      if (!isPlayMode()) release();
      return;
    }
    const byBrowser = wasLocked && !releaseRequested;
    wasLocked = false;
    releaseRequested = false;
    requestPending = false;
    if (byBrowser && isPlayMode()) {
      nativeReleaseAt = performance.now();
      onBrowserUnlock();
    }
  });
  document.addEventListener('pointerlockerror', markUnavailable);

  return {
    request, release, locked,
    get unavailable() { return unavailable; },
    // A new play session may try again (the browser might allow it now).
    retry() { unavailable = false; },
    // One browser Escape both releases the lock and reaches the key handler:
    // true right after the browser released it.
    justReleasedByBrowser: (window = 100) => performance.now() - nativeReleaseAt <= window,
    clearBrowserRelease() { nativeReleaseAt = -Infinity; },
  };
}
