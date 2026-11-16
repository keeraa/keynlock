import { mapGameKey } from './keymap.js';

/** DOM and physical keys dispatch the same typed gameplay commands. */
export function attachLockControls({ $, document, state, getPinPuzzle,
  getPlatePuzzle = () => ({ selectedPlate: 0 }),
  dispatch }) {
  const send = command => dispatch(command, { source: 'ui' });
  const click = (id, type) => $(id).addEventListener('click', () => send({ type }));

  document.querySelectorAll('#modeButtons button').forEach(button => button.addEventListener('click',
    () => send({ type: 'mode', mode: button.dataset.mode })));
  $('plateRows').addEventListener('click', event => {
    const button = event.target.closest('[data-plate]');
    if (button) send({type:'plate-select',index:Number(button.dataset.plate)});
  });
  $('plateCountPicker').addEventListener('click', event => {
    const button = event.target.closest('[data-plate-count]');
    if (button) send({type:'plate-count',count:Number(button.dataset.plateCount)});
  });
  $('plateOpenButton').addEventListener('click', () => send({type:'open'}));
  $('plateResetButton').addEventListener('click', () => send({type:'reset'}));
  $('pinPuzzleSelect').addEventListener('change', event => {
    const level = Number(document.querySelector('#pinPuzzleLevels button.active')?.dataset.level) || 1;
    send({ type: 'puzzle-start', puzzle: event.target.value, level });
    // Return keyboard focus to the game after choosing a puzzle from the dropdown.
    event.target.blur?.();
  });
  document.querySelectorAll('#pinPuzzleLevels button').forEach(button => button.addEventListener('click', () => {
    send({ type: 'puzzle-start',
      puzzle: $('pinPuzzleSelect').value, level: Number(button.dataset.level) });
  }));
  $('opacitySlider').addEventListener('input', event => send({ type: 'opacity',
    value: Number(event.target.value) }));
  $('explodeSlider').addEventListener('input', event => send({ type: 'explode',
    value: Number(event.target.value) }));
  for (const [id, type] of [
    ['toonStrengthSlider', 'toon-strength'], ['toonBandsSlider', 'toon-bands'],
    ['cartoonOutlineSlider', 'cartoon-outline'], ['outlineWidthSlider', 'outline-width'],
    ['paintStrengthSlider', 'paint-strength'], ['paintMaterialSlider', 'paint-material'],
    ['paintDetailSlider', 'paint-detail'],
  ]) $(id).addEventListener('input', event => send({ type, value: Number(event.target.value) }));
  for (const [id, type] of [
    ['insertButton', 'insert-toggle'],
    ['turnButton', 'turn-toggle'], ['toolButton', 'tool-toggle'],
    ['pickButton', 'pick'], ['wrongButton', 'wrong-key-toggle'],
    ['resetButton', 'reset'], ['explodeButton', 'explode-toggle'],
    ['autoXray', 'auto-xray-toggle'], ['schematicXray', 'schematic-xray-toggle'],
    ['oilToolButton', 'oil-tool-toggle'],
    ['cartoonToggle', 'cartoon-toggle'], ['toonToggle', 'toon-toggle'],
    ['outlineToggle', 'outline-toggle'],
    ['paintedMaterialsToggle', 'painted-materials-toggle'],
  ]) click(id, type);
  document.querySelectorAll('#wrenchPicker .wrench-choice').forEach(button =>
    button.addEventListener('click', () => send({ type: 'wrench', index: Number(button.dataset.wrench) })));
  document.querySelectorAll('#swatches .swatch').forEach(button =>
    button.addEventListener('click', () => send({ type: 'case-finish', color: button.dataset.color })));
  document.querySelectorAll('.paint-variant').forEach(button =>
    button.addEventListener('click', () => send({
      type: button.dataset.group === 'steel' ? 'paint-steel-variant' : 'paint-brass-variant',
      variant: button.dataset.variant,
    })));
  document.querySelectorAll('#pinFinishSwatches .pin-finish').forEach(button =>
    button.addEventListener('click', () => send({ type: 'pin-finish', index: Number(button.dataset.finish) })));

  document.addEventListener('keydown', event => {
    const { handled, command } = mapGameKey({
      code: event.code, repeat: event.repeat, metaKey: event.metaKey,
      ctrlKey: event.ctrlKey, altKey: event.altKey,
      targetTag: event.target?.tagName || '', mode: state.mode,
      puzzle: getPinPuzzle(), picking: state.picking, insertTarget: state.insertTarget,
      plateSelected: getPlatePuzzle().selectedPlate,
      plateCount: getPlatePuzzle().plateCount,
    });
    if (handled) event.preventDefault();
    if (command) dispatch(command, { source: 'keyboard' });
  });
}
