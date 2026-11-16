import { PLATE_SYMBOLS, plateSymbolSvg } from '../mechanisms/plate-symbols.js';
import { PLATE_TARGET } from '../gameplay/plate-rules.js';

/** Read-only plate rendering; all clicks travel through typed game actions. */
export function createPlatePanelUI({ document, $, puzzle }) {
  const plateRows = $('plateRows');
  function addRow(i) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'plate-row';
    button.dataset.plate = String(i);
    button.innerHTML = `<span class="plate-row-number">${String(i + 1).padStart(2, '0')}</span>` +
      '<span class="plate-row-glyph"></span><span class="plate-row-label"></span>';
    plateRows.append(button);
  }
  function render() {
    const { model } = puzzle;
    while (plateRows.children.length < model.plates.length) addRow(plateRows.children.length);
    while (plateRows.children.length > model.plates.length) plateRows.lastElementChild.remove();
    const ready = puzzle.isSolved();
    const count = model.plates.filter(plate => plate.position === PLATE_TARGET).length;
    $('plateProgress').textContent = `${count}/${model.plateCount} выставлены`;
    $('plateCountValue').textContent = String(model.plateCount);
    document.querySelectorAll('#plateCountPicker button').forEach(button => {
      const active = Number(button.dataset.plateCount) === model.plateCount;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed',String(active));
    });
    $('plateFeedback').textContent = model.feedback;
    [...plateRows.children].forEach((button, index) => {
      const plate = model.plates[index];
      const selected = model.selectedPlate === index;
      const solved = plate.position === PLATE_TARGET;
      button.classList.toggle('selected', selected);
      button.classList.toggle('solved', solved);
      button.setAttribute('aria-pressed', String(selected));
      button.querySelector('.plate-row-glyph').innerHTML = plateSymbolSvg(plate.symbol);
      button.querySelector('.plate-row-label').textContent =
        `${PLATE_SYMBOLS[plate.symbol].name} · ${plate.position}/7${solved ? ' ✓' : ''}`;
    });
    $('plateOpenButton').disabled = !ready;
    $('plateOpenButton').textContent = ready ? 'Открыть дужку' : `Выставь все ${model.plateCount} пластин`;
  }

  render();
  return { render };
}
