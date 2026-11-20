// Station deadlines use a persisted clock that advances only while playing.
export function createStationClock(savedTime, elapsedNow = () => performance.now()) {
  let time = Number.isFinite(savedTime) ? savedTime : Date.now();
  let startedAt = null;
  function now() {
    return startedAt === null ? time : time + elapsedNow() - startedAt;
  }
  function setActive(active) {
    if (active === (startedAt !== null)) return;
    if (active) startedAt = elapsedNow();
    else {
      time = now();
      startedAt = null;
    }
  }
  return { now, setActive };
}
