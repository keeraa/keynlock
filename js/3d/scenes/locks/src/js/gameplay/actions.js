// @ts-check
import { normalizeGameCommand } from './commands.js';
import { createWrenchSelector } from './wrench-actions.js';
import { resetLockMotion } from './lock-state-transitions.js';
import { replaceKeyProfile } from '../geometry/key-profile.js';
import { PLATE_SYMBOL_TO_WRENCH } from '../mechanisms/plate-symbols.js';
/** @typedef {import('../types/contracts.js').GameCommand} GameCommand */
/** @typedef {import('../types/contracts.js').LockMode} LockMode */
/**
 * Dependency boundary for the command bus. UI bindings and replay know only
 * dispatch(), while this adapter owns all gameplay mutations.
 * @typedef {object} GameActionDependencies
 * @property {any} THREE
 * @property {Document} document
 * @property {any} state
 * @property {(mode:LockMode)=>void} setMode
 * @property {(count:number)=>void} setPinCount
 * @property {(type:string,level:number)=>void} startPinPuzzle
 * @property {(delta:number)=>void} puzzleAdjust
 * @property {()=>void} pinPuzzleAction
 * @property {(value:number)=>void} puzzleSetSlider
 * @property {()=>void} updateButtons
 * @property {()=>void} resetPicking
 * @property {{released:boolean}} shackleBody
 * @property {()=>void} reset
 * @property {()=>void} attemptShackleOpen
 * @property {()=>void} restoreShackle
 * @property {any} pinKey
 * @property {any} pickRig
 * @property {any} tensionRig
 * @property {(wrong:boolean)=>any} makeKeyProfile
 * @property {(message:string)=>void} status
 * @property {Array<{visible:boolean}>} tensionModels
 * @property {Array<{name:string}>} tensionSpecs
 * @property {()=>any} getPinPuzzle
 * @property {()=>number[]} getPinXs
 * @property {(index:number)=>void} setSelectedTension
 * @property {()=>void} attemptPick
 * @property {(index:number,press?:boolean)=>void} puzzleSelectPin
 * @property {(x:number)=>{index:number}} nearestPin
 * @property {(command:GameCommand)=>boolean} applyAppearanceAction
 * @property {()=>void} toggleOilTool
 * @property {{model:{feedback:string},setCount:(count:number)=>boolean,
 *   selectPlate:(index:number)=>boolean,selectTool:(index:number)=>boolean,
 *   shift:(delta:number)=>boolean}} platePuzzle
 * @property {()=>void} renderPlateUI
 * @property {{getSnapshot:()=>{active:boolean},start:(id:string,level:number)=>any,
 *   choose:(index:number)=>boolean,confirm:()=>boolean,restart:()=>void,exit:()=>void}} [worldPuzzles]
 */
/** @param {GameActionDependencies} deps */
export function createGameActions(deps) {
  const { THREE, document, state, setMode, setPinCount, startPinPuzzle,
    puzzleAdjust, pinPuzzleAction, puzzleSetSlider, updateButtons, resetPicking,
    shackleBody, reset, attemptShackleOpen, restoreShackle, pinKey, pickRig,
    tensionRig, makeKeyProfile, status, tensionModels, tensionSpecs,
    getPinPuzzle, getPinXs, setSelectedTension, attemptPick, puzzleSelectPin,
    nearestPin, applyAppearanceAction, toggleOilTool, platePuzzle, renderPlateUI,
    worldPuzzles } = deps;
  /** @type {Set<(command:GameCommand,context:{source:string})=>void>} */
  const listeners = new Set();
  function toggleTool() {
    if (getPinPuzzle()) return;
    state.picking = !state.picking;
    resetLockMotion(state);
    restoreShackle(); resetPicking();
    pinKey.rig.visible = !state.picking; pickRig.visible = state.picking;
    tensionRig.visible = state.picking;
    replaceKeyProfile(pinKey, makeKeyProfile);
    status(state.picking ? 'Отмычка: A/D или стрелки — влево/вправо, W/↑ — поднять штифт' :
      'Выбран профильный ключ');
    updateButtons();
  }
  function toggleInsert() {
    state.insertTarget = state.insertTarget ? 0 : 1;
    if (!state.insertTarget) {
      state.turnTarget = 0; state.unlockTarget = 0;
      if (state.mode !== 'code') resetPicking();
    }
    status(state.mode === 'code' ? (state.insertTarget ? 'Набирается код из трёх положений' : 'Код сброшен') :
      state.insertTarget ? (state.picking ? 'Отмычка входит в цилиндрическое гнездо' :
        'Ключ входит в цилиндрическое гнездо') : 'Инструмент извлекается из цилиндра');
    updateButtons();
  }
  /** @param {number} direction */
  function keyInsert(direction) {
    if (state.picking) {
      if (!state.insertTarget && direction > 0) {
        state.insertTarget = 1;
        status('Отмычка входит в скважину'); updateButtons();
      } else if (!state.insertTarget) status('Сначала вставь отмычку');
      return;
    }
    state.insertTarget = direction > 0 ? 1 : 0;
    if (!state.insertTarget) { state.turnTarget = 0; state.unlockTarget = 0; resetPicking(); }
    status(direction > 0 ? 'Ключ движется внутрь замочной скважины' :
      'Ключ выходит из замочной скважины');
    updateButtons();
  }
  const selectWrench = createWrenchSelector({ document, state, setMode, setSelectedTension,
    tensionModels, tensionSpecs, toggleTool, status, platePuzzle, renderPlateUI });
  /** @param {GameCommand} command @param {string} source */
  function execute(command, source) {
    if (applyAppearanceAction(command)) return;
    if (command.type === 'world-start') { worldPuzzles?.start(command.id,command.level); return; }
    if (command.type === 'world-choice') { worldPuzzles?.choose(command.index); return; }
    if (command.type === 'world-confirm') { worldPuzzles?.confirm(); return; }
    if (command.type === 'world-exit') { worldPuzzles?.exit(); return; }
    if (command.type === 'world-restart') { worldPuzzles?.restart(); return; }
    // Menu navigation restores the lock; background scene input cannot interrupt it.
    if (worldPuzzles?.getSnapshot().active) {
      if (source === 'ui' || source === 'replay') worldPuzzles.exit(); else return;
    }
    switch (command.type) {
      case 'mode': setMode(command.mode); break;
      case 'plate-count':
        if (state.mode === 'plate' && platePuzzle.setCount(command.count)) reset();
        break;
      case 'plate-select':
        if (state.mode === 'plate') {
          platePuzzle.selectPlate(command.index);
          renderPlateUI(); status(platePuzzle.model.feedback);
        }
        break;
      case 'plate-tool':
        if (state.mode === 'plate') selectWrench(PLATE_SYMBOL_TO_WRENCH[command.index]);
        break;
      case 'plate-shift':
        if (state.mode === 'plate') {
          platePuzzle.shift(command.delta);
          renderPlateUI(); status(platePuzzle.model.feedback);
        }
        break;
      case 'pin-count': if (!getPinPuzzle()) setPinCount(command.count); break;
      case 'puzzle-start': startPinPuzzle(command.puzzle, command.level); break;
      case 'puzzle-select': puzzleSelectPin(command.index, command.press === true); break;
      case 'puzzle-adjust': puzzleAdjust(command.delta); break;
      case 'puzzle-value': puzzleSetSlider(command.value); break;
      case 'puzzle-action': pinPuzzleAction(); break;
      case 'insert-toggle': toggleInsert(); break;
      case 'key-insert': keyInsert(command.direction); break;
      case 'turn-toggle':
        if (shackleBody.released) reset();
        else if (state.turnTarget) {
          state.turnTarget = 0; state.unlockTarget = 0;
          status('Механизм закрывается'); updateButtons();
        } else attemptShackleOpen();
        break;
      case 'open': attemptShackleOpen(); break;
      case 'tool-toggle': toggleTool(); break;
      case 'wrench': selectWrench(command.index); break;
      case 'pick': attemptPick(); break;
      case 'pick-step': {
        if (!state.picking || !state.insertTarget) break;
        const pinXs = getPinXs();
        const current = nearestPin(state.pickTargetX).index;
        const next = THREE.MathUtils.clamp(current + command.delta, 0, pinXs.length - 1);
        state.pickTargetX = pinXs[next];
        status(`Отмычка → штифт ${next + 1} из ${pinXs.length}`); updateButtons();
        break;
      }
      case 'pick-down': state.pickPulse = 0; status('Отмычка опущена'); break;
      case 'pick-wait': status('Сначала вставь отмычку'); break;
      case 'wrong-key-toggle':
        state.wrong = !state.wrong;
        if (state.wrong) { state.turnTarget = 0; state.unlockTarget = 0; }
        replaceKeyProfile(pinKey, makeKeyProfile, state.wrong);
        status(state.wrong ? 'Включён ключ с неверным третьим вырезом' :
          'Верная нарезка восстановлена'); updateButtons();
        break;
      case 'reset': reset(); break;
      case 'oil-tool-toggle': toggleOilTool(); break;
    }
  }
  /**
   * @param {unknown} input
   * @param {{source?:string}} [meta]
   * @returns {GameCommand}
   */
  function dispatch(input, meta = {}) {
    const command = normalizeGameCommand(input);
    execute(command, meta.source || 'game');
    for (const listener of listeners) listener(command, { source: meta.source || 'game' });
    return command;
  }
  /** @param {(command:GameCommand,context:{source:string})=>void} listener */
  function subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); }
  return { dispatch, subscribe };
}
