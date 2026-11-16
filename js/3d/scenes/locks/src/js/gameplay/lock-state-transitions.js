/** Keep insertion, turning and shackle motion in sync across every reset path. */
/** @param {any} state @param {{clearWrong?:boolean}} options */
export function resetLockMotion(state, { clearWrong = true } = {}) {
  state.insertTarget = 0;
  state.turnTarget = 0;
  state.unlockTarget = 0;
  state.insertP = 0;
  state.turnP = 0;
  state.unlockP = 0;
  if (clearWrong) state.wrong = false;
}
