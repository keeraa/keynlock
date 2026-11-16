/** Shared mode transitions, reset and shackle-unlock rules. No scene construction. */
import { WRENCH_TO_PLATE_SYMBOL } from '../mechanisms/plate-symbols.js';
import { resetLockMotion } from './lock-state-transitions.js';
import { replaceKeyProfile } from '../geometry/key-profile.js';

export function createLockSession({ $, document, state, modeDetails, mechanismRegistry,
  getPinPuzzle, setPinPuzzle, getPinXs, pinKey, pickRig, tensionRig, makeKeyProfile,
  restoreShackle, resetPicking, status, startPinPuzzle, renderPinPuzzleUI,
  updateButtons, shackleBody, puzzleReady, puzzleNotice, puzzleDamage, puzzleComplete,
  platePuzzle, renderPlateUI, getSelectedTension = () => 2 }) {
  function resetPlates() {
    platePuzzle.reset();
    platePuzzle.selectTool(WRENCH_TO_PLATE_SYMBOL[getSelectedTension()]);
    renderPlateUI();
  }
  function setMode(mode) {
    const selectedPuzzle = $('pinPuzzleSelect').value || 'free';
    const selectedLevel = Number(document.querySelector('#pinPuzzleLevels button.active')?.dataset.level) || 1;
    setPinPuzzle(null);
    state.mode = mode;
    resetLockMotion(state);
    state.picking = false;
    restoreShackle();
    resetPicking();
    mechanismRegistry.activate(mode);
    $('modeTitle').textContent = modeDetails[mode].title;
    $('modeDescription').textContent = modeDetails[mode].description;
    $('pinFinishControls').style.display = mode === 'pin' ? 'block' : 'none';
    $('pinGamesSection').style.display = mode === 'pin' ? 'block' : 'none';
    $('plateSection').style.display = mode === 'plate' ? 'block' : 'none';
    $('lockActionsSection').style.display = mode === 'plate' ? 'none' : 'block';
    $('wrenchPicker').style.display = '';
    $('lockFootnote').textContent = 'Клик по дужке или пробел — попытка открыть замок. ЛКМ — вращение · ПКМ — сдвиг · Колесо — масштаб.';
    document.querySelectorAll('#modeButtons button').forEach(button => {
      const active = button.dataset.mode === mode;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    replaceKeyProfile(pinKey, makeKeyProfile);
    pinKey.rig.visible = true; pickRig.visible = false; tensionRig.visible = false;
    if (mode === 'plate') resetPlates();
    status(`Выбран ${modeDetails[mode].title.toLowerCase()} механизм`);
    if (mode === 'pin') {
      startPinPuzzle(selectedPuzzle, selectedLevel);
      return;
    }
    renderPinPuzzleUI();
    updateButtons();
  }
  function reset() {
    mechanismRegistry.reset(state.mode);
    if (state.mode === 'plate') {
      resetPlates();
      resetLockMotion(state, { clearWrong: false });
      restoreShackle(); status(`${platePuzzle.model.plateCount} пластин перемешаны.`); updateButtons();
      return;
    }
    const pinPuzzle = getPinPuzzle();
    if (state.mode === 'pin' && pinPuzzle) {
      startPinPuzzle(pinPuzzle.type, pinPuzzle.level);
      return;
    }
    resetLockMotion(state);
    restoreShackle();
    resetPicking();
    replaceKeyProfile(pinKey, makeKeyProfile);
    status(''); updateButtons();
  }
  function attemptShackleOpen() {
    const pinPuzzle = getPinPuzzle();
    if (shackleBody.released) { status('Дужка уже на поверхности. Сброс восстановит замок.'); return; }
    if (state.turnTarget) { status('Дужка освобождается из корпуса'); return; }
    if (state.mode === 'plate') {
      if (!platePuzzle.isSolved()) {
        shackleBody.shaking = 1;
        status(`Пластинчатый замок закрыт: подбери общий узор и выставь все ${platePuzzle.model.plateCount} штифтов на позицию 4.`);
        return;
      }
      state.insertTarget = 1; state.insertP = 1;
      state.turnTarget = 1; state.unlockTarget = 1;
      status(`Все ${platePuzzle.model.plateCount} пластин на линии среза — дужка освобождается.`);
      updateButtons();
      return;
    }
    if (state.mode === 'pin' && pinPuzzle) {
      if (pinPuzzle.over) { puzzleNotice('Отмычки закончились. Нажми «Сброс».', true); return; }
      if (!state.insertTarget || state.insertP < .95) { puzzleNotice('Сначала дождись вставки отмычки.'); return; }
      if (!puzzleReady(pinPuzzle)) {
        shackleBody.shaking = 1;
        puzzleDamage('Рано открывать: штифты ещё не выставлены', 'early'); return;
      }
      puzzleComplete(); return;
    }
    const ready = state.insertTarget && state.insertP > .95 &&
      !(state.mode === 'pin' && state.wrong) &&
      !(state.mode === 'pin' && state.picking && state.pinSetCount < getPinXs().length);
    if (!ready) {
      shackleBody.shaking = 1;
      status('Дужка заперта: механизм слегка дрожит, но не открывается');
      return;
    }
    state.turnTarget = 1; state.unlockTarget = 1;
    status('Механизм разблокирован: дужка выходит из гнёзд и падает');
    updateButtons();
  }
  return { setMode, reset, attemptShackleOpen };
}
