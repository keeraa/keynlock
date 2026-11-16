/** Validate, record and replay deterministic semantic commands and older DOM tapes. */
import {normalizeGameCommand} from '../gameplay/commands.js';
import {normalizeScenario, SCENARIO_PUZZLES} from './scenario-model.js';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const CLICK_SELECTORS = new Set([
  'insertButton', 'turnButton', 'toolButton', 'pickButton', 'wrongButton',
  'resetButton', 'explodeButton', 'autoXray', 'pinPuzzleMinus',
  'pinPuzzlePlus', 'pinPuzzlePlayButton', 'oilToolButton', 'cartoonToggle',
  'toonToggle', 'outlineToggle', 'paperToggle',
].map(id => `#${id}`));
const INPUT_SELECTORS = new Set([
  // Preserved only for validating recordings made before the numeric buttons.
  'pinCountSlider', 'pinPuzzleSelect', 'pinPuzzleValueSlider',
  'opacitySlider', 'explodeSlider', 'cartoonOutlineSlider',
  'toonStrengthSlider', 'toonBandsSlider', 'outlineWidthSlider',
  'paperStrengthSlider', 'paperScaleSlider',
].map(id => `#${id}`));
const GROUP_SELECTORS = [
  /^#modeButtons button\[data-mode="(pin|disc|code)"\]$/,
  /^#pinPuzzleLevels button\[data-level="[123]"\]$/,
  /^#wrenchPicker button\[data-wrench="[0-4]"\]$/,
  /^#swatches button\[data-color="(titanium|graphite|bronze|navy)"\]$/,
  /^#pinFinishSwatches button\[data-finish="[0-5]"\]$/,
];
const INPUT_RANGES = {
  '#pinCountSlider': [4, 7], '#pinPuzzleValueSlider': [0, 100],
  '#opacitySlider': [0, 100], '#explodeSlider': [0, 200],
  '#cartoonOutlineSlider': [0, 100],
  '#toonStrengthSlider': [0, 100], '#toonBandsSlider': [2, 7],
  '#outlineWidthSlider': [1, 4], '#paperStrengthSlider': [0, 100],
  '#paperScaleSlider': [50, 200],
};

export function validateActionTape(tape) {
  if (!tape || tape.version !== 1 || !Array.isArray(tape.actions) || tape.actions.length > 500)
    throw new Error('Неверный формат записи действий.');
  const initial = normalizeScenario(tape.initial);
  let previous = 0;
  const actions = tape.actions.map(action => {
    const t = Number(action.t);
    if (!Number.isFinite(t) || t < previous || t > 180_000)
      throw new Error('Некорректное время действия.');
    if (!['click', 'input', 'change', 'key', 'command'].includes(action.type))
      throw new Error('Неизвестное действие.');
    if (action.type === 'command') {
      previous = t;
      return { t, type: 'command', command: normalizeGameCommand(action.command) };
    }
    if (action.type === 'key') {
      if (!/^(Key[A-Z]|Digit[0-9]|Arrow(Left|Right|Up|Down)|Space|Enter)$/.test(action.code || ''))
        throw new Error('Некорректная клавиша.');
    } else if (!(action.type === 'click'
      ? CLICK_SELECTORS.has(action.selector) || GROUP_SELECTORS.some(rule => rule.test(action.selector))
      : INPUT_SELECTORS.has(action.selector))) {
      throw new Error('Недопустимый селектор действия.');
    }
    let value;
    if (action.type === 'input' || action.type === 'change') {
      if (action.selector === '#pinPuzzleSelect') {
        if (!SCENARIO_PUZZLES.includes(action.value))
          throw new Error('Некорректный тип головоломки.');
        value = action.value;
      } else {
        const number = Number(action.value);
        const [min, max] = INPUT_RANGES[action.selector];
        if (action.value === undefined || !Number.isFinite(number) || number < min || number > max)
          throw new Error('Некорректное значение ползунка.');
        value = String(number);
      }
    }
    previous = t;
    return { t, type: action.type, selector: action.selector || '',
      value, code: action.code || '' };
  });
  return { version: 1, initial, actions };
}

export function createScenarioTape({ now = () => performance.now(),
  wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)) } = {}) {
  let recording = null, startedAt = 0, playing = false;
  return {
    start(initial) {
      if (playing) throw new Error('Идёт воспроизведение.');
      recording = { version: 1, initial: normalizeScenario(initial), actions: [] };
      startedAt = now();
    },
    record(action) {
      if (!recording || playing || recording.actions.length >= 500) return;
      const t = clamp(Math.round(now() - startedAt), 0, 180_000);
      recording.actions.push({ ...action, t });
    },
    stop() {
      const result = recording;
      recording = null;
      return result ? validateActionTape(result) : null;
    },
    get isRecording() { return Boolean(recording); },
    get isPlaying() { return playing; },
    async replay(source, { reset, dispatch, speed = 1 } = {}) {
      const tape = validateActionTape(source);
      if (playing) throw new Error('Запись уже воспроизводится.');
      if (typeof reset !== 'function' || typeof dispatch !== 'function')
        throw new Error('Для воспроизведения нужны reset и dispatch.');
      recording = null;
      playing = true;
      try {
        await reset(tape.initial);
        let previous = 0;
        const multiplier = clamp(Number(speed) || 1, .1, 10);
        for (const action of tape.actions) {
          await wait((action.t - previous) / multiplier);
          await dispatch(action);
          previous = action.t;
        }
      } finally {
        playing = false;
      }
    },
  };
}
