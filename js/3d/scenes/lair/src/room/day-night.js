// @ts-check
// Day and night change gradually: the window light, the city outside, the room
// light and the lamps all follow one value from 0 (day) to 1 (night).

/**
 * @param {(night: number) => void} apply called with the eased value 0..1
 * @param {{ seconds?: number }} [options]
 */
export function createDayNight(apply, { seconds = 1.6 } = {}) {
  let amount = 0;
  let target = 0;
  let started = false;
  const ease = (/** @type {number} */ t) => t * t * (3 - 2 * t);
  return {
    /** The first call (the saved setting on load) applies at once; later ones fade. */
    set(/** @type {boolean} */ night) {
      target = night ? 1 : 0;
      if (!started) {
        started = true;
        amount = target;
        apply(amount);
      }
    },
    /** Once per frame, with the frame's duration in seconds. */
    update(/** @type {number} */ delta) {
      if (amount === target) return;
      const step = Math.max(0, delta) / seconds;
      amount = target > amount ? Math.min(target, amount + step) : Math.max(target, amount - step);
      apply(ease(amount));
    },
    get amount() { return amount; },
  };
}
