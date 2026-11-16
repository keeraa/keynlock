/** Swap key blades atomically and release the old GPU geometry exactly once. */
/** @param {any} pinKey @param {(wrong:boolean)=>any} makeKeyProfile @param {boolean} wrong */
export function replaceKeyProfile(pinKey, makeKeyProfile, wrong = false) {
  const blade = pinKey.blade;
  const next = makeKeyProfile(wrong);
  const previous = blade.geometry;
  if (previous === next) return next;
  blade.geometry = next;
  previous?.dispose?.();
  return next;
}
