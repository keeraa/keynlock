// Time-driven landing; no timers or event listeners, so repeat/cancel stay deterministic.
export function createSourceDrop({ onPose, onImpact, onEnd = () => {} }) {
  let time = 0,
    active = false,
    struck = false;
  const contact = 0.44,
    duration = 1.05;
  function pose() {
    if (time < contact) {
      const lift = 1 - (time / contact) ** 2;
      onPose(lift, -0.065 * lift, 1 + 0.22 * lift);
    } else {
      const t = time - contact;
      const lift = 0.065 * Math.abs(Math.sin(t * 14)) * Math.exp(-t * 8);
      onPose(lift, 0.012 * Math.sin(t * 19) * Math.exp(-t * 9), 1 + lift * 0.22);
    }
  }
  return {
    get active() {
      return active;
    },
    play() {
      time = 0;
      active = true;
      struck = false;
      pose();
    },
    cancel() {
      active = false;
      onPose(0, 0, 1);
    },
    step(dt) {
      if (!Number.isFinite(dt) || dt < 0) throw new RangeError('Invalid drop dt');
      if (!active) return;
      time += dt;
      if (!struck && time >= contact) {
        struck = true;
        onPose(0, 0, 1);
        onImpact();
      }
      if (time >= duration) {
        active = false;
        onPose(0, 0, 1);
        onEnd();
      } else pose();
    },
  };
}
