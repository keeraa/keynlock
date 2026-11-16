import { PLATE_SYMBOLS } from '../mechanisms/plate-symbols.js';
import { applyPlateCoupling, plateCoupling } from './plate-links.js';

export const PLATE_COUNT = 4;
export const PLATE_MIN_COUNT = 4;
export const PLATE_MAX_COUNT = 6;
export const PLATE_TARGET = 4;
export const PLATE_POSITIONS = 7;

/** One motif per lock, with four to six coupled plates. */
export function createPlatePuzzle(random = Math.random) {
  const model = { plates: [], scrambleMoves: [], plateCount: PLATE_COUNT, symbol: 0,
    selectedPlate: 0, selectedTool: -1, feedback: '' };
  const choice = count => Math.min(count - 1, Math.floor(random() * count));
  const plate = index => model.plates[index];

  function setCount(count) {
    if (!Number.isInteger(count) || count < PLATE_MIN_COUNT || count > PLATE_MAX_COUNT) return false;
    model.plateCount = count;
    return true;
  }

  function reset() {
    model.symbol = choice(PLATE_SYMBOLS.length);
    // Scramble from the solved state using only legal coupled moves so every
    // generated arrangement has a guaranteed route back to the shear line.
    const positions = Array(model.plateCount).fill(PLATE_TARGET);
    model.scrambleMoves = [];
    for (let step = 0; step < model.plateCount * 7; step++) {
      const index = choice(model.plateCount), direction = choice(2) ? 1 : -1;
      if (applyPlateCoupling(positions, index, direction, 1, PLATE_POSITIONS)) {
        model.scrambleMoves.push({index,delta:direction});
      }
    }
    if (positions.every(position => position === PLATE_TARGET)) {
      applyPlateCoupling(positions, 0, 1, 1, PLATE_POSITIONS);
      model.scrambleMoves.push({index:0,delta:1});
    }
    model.plates = positions.map((position,index) =>
      ({index,symbol:model.symbol,position,engaged:false}));
    model.selectedPlate = 0;
    model.selectedTool = -1;
    model.feedback = 'Найди инструмент с общим знаком пластин и выставь штифты.';
    return model;
  }

  function selectPlate(index) {
    if (!Number.isInteger(index) || index < 0 || index >= model.plates.length) return false;
    model.selectedPlate = index;
    model.feedback = `Пластина ${index + 1}. Найди инструмент с её узором.`;
    return true;
  }

  function selectTool(index) {
    if (!Number.isInteger(index) || index < 0 || index >= PLATE_SYMBOLS.length) return false;
    model.selectedTool = index;
    const current = plate(model.selectedPlate);
    if (index !== current.symbol) {
      model.feedback = 'Узор не совпадает: инструмент не входит в край пластины.';
      return false;
    }
    current.engaged = true;
    model.feedback = current.position === PLATE_TARGET ?
      `Инструмент подошёл. Пластина ${current.index + 1} уже на линии среза.` :
      `Инструмент подошёл. Сдвигай пластину ${current.index + 1} к позиции ${PLATE_TARGET}.`;
    return true;
  }

  function shift(delta) {
    const current = plate(model.selectedPlate);
    if (model.selectedTool !== current.symbol) {
      model.feedback = 'Для сдвига нужен инструмент с символом выбранной пластины.';
      return false;
    }
    if (delta !== -1 && delta !== 1) return false;
    const moves = plateCoupling(current.index, model.plateCount, delta);
    const positions = model.plates.map(item => item.position);
    if (!applyPlateCoupling(positions, current.index, delta, 1, PLATE_POSITIONS)) {
      model.feedback = 'Связанные пластины упёрлись в край хода.';
      return false;
    }
    for (const {index} of moves) {
      plate(index).position = positions[index];
      plate(index).engaged = true;
    }
    model.feedback = isSolved() ? `Все ${model.plateCount} пластин выставлены. Дужку можно открыть.` :
      `Пластины ${current.index + 1} и ${moves[1].index + 1} связаны · ${current.position}/7 и ${plate(moves[1].index).position}/7.`;
    return true;
  }

  const isSolved = () => model.plates.length === model.plateCount &&
    model.plates.every(current => current.position === PLATE_TARGET) &&
    model.selectedTool === model.symbol;
  return { model, reset, setCount, selectPlate, selectTool, shift, isSolved };
}
