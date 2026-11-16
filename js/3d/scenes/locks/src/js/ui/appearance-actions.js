// @ts-check
/** Visual controls remain independent of the gameplay command dispatcher. */
/** @typedef {import('../types/contracts.js').GameCommand} GameCommand */
/** @typedef {import('../types/contracts.js').CaseFinish} CaseFinish */

/** @type {Record<CaseFinish,number>} */
const FINISHES = {
  titanium: 0x75898c, graphite: 0x303942,
  bronze: 0x967147, navy: 0x3a667a,
};
const DRAWING_SLIDERS = {
  'toon-strength': ['toonStrength', 'toonStrengthSlider', 'toonStrengthValue', '%'],
  'toon-bands': ['toonBands', 'toonBandsSlider', 'toonBandsValue', ' ступ.'],
  'cartoon-outline': ['cartoonOutline', 'cartoonOutlineSlider', 'cartoonOutlineValue', '%'],
  'outline-width': ['outlineWidth', 'outlineWidthSlider', 'outlineWidthValue', ' px'],
};
const PAINT_SLIDERS = {
  'paint-strength': ['paintStrength', 'paintStrengthSlider', 'paintStrengthValue'],
  'paint-material': ['paintMaterial', 'paintMaterialSlider', 'paintMaterialValue'],
  'paint-detail': ['paintDetail', 'paintDetailSlider', 'paintDetailValue'],
};
/** @type {Array<[string, string, string[]]>} */
const DRAWING_TOGGLES = [
  ['toonEnabled', 'toonToggle', ['toonStrengthSlider', 'toonBandsSlider']],
  ['outlineEnabled', 'outlineToggle', ['cartoonOutlineSlider', 'outlineWidthSlider']],
];

/**
 * @param {{state:any, $:(id:string)=>any, document:Document, mat:any,
 *   status:(text:string)=>void, getPinXs:()=>number[],setPinFinish:(index:number)=>void,
 *   applyDrawingStyle:()=>void, applyPaintedMaterials:()=>void,
 *   setBaseCaseRoughness:(roughness:number)=>void}} deps
 */
export function createAppearanceActions({ state, $, document, mat, status, getPinXs,
  setPinFinish, applyDrawingStyle, applyPaintedMaterials,
  setBaseCaseRoughness }) {
  function syncDrawingControls() {
    state.cartoonEnabled = state.toonEnabled || state.outlineEnabled;
    for (const [field, buttonId, sliders] of DRAWING_TOGGLES) {
      const active = Boolean(state[field]);
      $(buttonId).classList.toggle('on', active);
      $(buttonId).setAttribute('aria-pressed', String(active));
      for (const sliderId of sliders) $(sliderId).disabled = !active;
    }
    $('cartoonToggle').classList.toggle('on', state.cartoonEnabled);
    $('cartoonToggle').setAttribute('aria-pressed', String(state.cartoonEnabled));
    applyDrawingStyle();
  }

  function syncInspectionControls() {
    $('opacitySlider').disabled = state.autoXray || state.schematicXray;
    $('autoXray').disabled = state.schematicXray;
    $('schematicXray').classList.toggle('on', state.schematicXray);
    $('schematicXray').setAttribute('aria-pressed', String(state.schematicXray));
    $('opacityHelp').textContent = state.schematicXray ?
      'Рентген показывает внутренние узлы сквозь переднюю стенку. После выключения прежняя прозрачность вернётся.' :
      state.autoXray ?
        'Авто: спереди стенка скрыта, при повороте сбоку она появляется.' :
        '100% — стенка скрыта. 0% — видна полностью, внутренние линии перекрыты.';
    if (state.schematicXray) $('opacityValue').textContent = 'Рентген';
    else if (!state.autoXray) $('opacityValue').textContent =
      `${Math.round(state.transparency * 100)}%`;
  }

  /** @param {GameCommand} command @returns {boolean} */
  return function applyAppearanceAction(command) {
    switch (command.type) {
      case 'opacity':
        state.transparency = command.value / 100;
        $('opacitySlider').value = String(command.value);
        if (!state.autoXray && !state.schematicXray)
          $('opacityValue').textContent = `${command.value}%`;
        return true;
      case 'explode':
        state.explodeTarget = command.value / 200;
        $('explodeSlider').value = String(command.value);
        $('explodeValue').textContent = `${command.value}%`;
        $('explodeButton').textContent = state.explodeTarget > .5 ? 'Собрать' : 'Разобрать';
        return true;
      case 'explode-toggle':
        state.explodeTarget = state.explodeTarget > .5 ? 0 : 1;
        $('explodeSlider').value = String(state.explodeTarget * 200);
        $('explodeValue').textContent = `${Math.round(state.explodeTarget * 200)}%`;
        $('explodeButton').textContent = state.explodeTarget ? 'Собрать' : 'Разобрать';
        status(state.explodeTarget ? 'Узлы плавно расходятся по направлениям сборки' :
          'Детали возвращаются в корпус');
        return true;
      case 'auto-xray-toggle':
        state.autoXray = !state.autoXray;
        $('autoXray').classList.toggle('on', state.autoXray);
        $('autoXray').setAttribute('aria-pressed', String(state.autoXray));
        syncInspectionControls();
        status(state.autoXray ? 'Автопрозрачность включена: поверни модель к боковой грани.' :
          'Ручная прозрачность восстановлена.');
        return true;
      case 'schematic-xray-toggle':
        state.schematicXray = !state.schematicXray;
        syncInspectionControls();
        status(state.schematicXray ?
          'Рентген: через стенку видны контуры и расположение деталей.' :
          'Рентген выключен: восстановлено обычное перекрытие деталей.');
        return true;
      case 'cartoon-toggle':
        for (const [field] of DRAWING_TOGGLES) state[field] = !state.cartoonEnabled;
        syncDrawingControls();
        status(state.cartoonEnabled ? 'Мультяшный свет и обводка включены.' :
          'Экранные эффекты выключены.');
        return true;
      case 'toon-toggle':
        state.toonEnabled = !state.toonEnabled;
        syncDrawingControls();
        return true;
      case 'outline-toggle':
        state.outlineEnabled = !state.outlineEnabled;
        syncDrawingControls();
        return true;
      // Preserve playback of older recordings after removing the paper shader.
      case 'paper-toggle':
      case 'paper-strength':
      case 'paper-scale':
        return true;
      case 'paint-steel-variant':
      case 'paint-brass-variant': {
        const group = command.type === 'paint-steel-variant' ? 'steel' : 'brass';
        if (group === 'steel') state.paintSteelVariant = command.variant;
        else state.paintBrassVariant = command.variant;
        document.querySelectorAll(`.paint-variant[data-group="${group}"]`).forEach(option => {
          const button = /** @type {HTMLElement} */ (option);
          const selected = button.dataset.variant === command.variant;
          button.classList.toggle('active', selected);
          button.setAttribute('aria-pressed', String(selected));
        });
        applyPaintedMaterials();
        return true;
      }
      case 'painted-materials-toggle':
        state.paintedMaterialsEnabled = !state.paintedMaterialsEnabled;
        $('paintedMaterialsToggle').classList.toggle('on', state.paintedMaterialsEnabled);
        $('paintedMaterialsToggle').setAttribute('aria-pressed', String(state.paintedMaterialsEnabled));
        for (const id of ['paintStrengthSlider', 'paintMaterialSlider', 'paintDetailSlider'])
          $(id).disabled = !state.paintedMaterialsEnabled;
        applyPaintedMaterials();
        status(state.paintedMaterialsEnabled ? 'Рисованные металлические фактуры включены.' :
          'Исходные металлические материалы восстановлены.');
        return true;
      case 'paint-strength':
      case 'paint-material':
      case 'paint-detail': {
        const [field, sliderId, outputId] = PAINT_SLIDERS[command.type];
        state[field] = command.value;
        $(sliderId).value = String(command.value);
        $(outputId).textContent = `${command.value}%`;
        applyPaintedMaterials();
        return true;
      }
      // Historical replay tapes may contain the removed page-wide film filter.
      case 'film-intensity':
        return true;
      case 'toon-strength':
      case 'toon-bands':
      case 'cartoon-outline':
      case 'outline-width': {
        const [field, sliderId, outputId, suffix] = DRAWING_SLIDERS[command.type];
        state[field] = command.value;
        $(sliderId).value = String(command.value);
        $(outputId).textContent = `${command.value}${suffix}`;
        applyDrawingStyle();
        return true;
      }
      case 'case-finish': {
        state.finish = command.color;
        document.querySelectorAll('.swatch').forEach(option => {
          const button = /** @type {HTMLElement} */ (option);
          button.classList.toggle('active', button.dataset.color === command.color);
        });
        mat.case.color.setHex(FINISHES[command.color]);
        mat.case.roughness = command.color === 'bronze' ? .55 : .49;
        mat.glass.color.copy(mat.case.color);
        mat.glass.roughness = mat.case.roughness;
        setBaseCaseRoughness(mat.case.roughness);
        const selected = /** @type {HTMLElement|null} */
          (document.querySelector(`.swatch[data-color="${command.color}"]`));
        status(`Покрытие корпуса: ${selected?.title || command.color}`);
        return true;
      }
      case 'pin-finish':
        setPinFinish(command.index);
        status(`Штифты (${getPinXs().length} шт.): ${$('pinFinishValue').textContent.toLowerCase()}`);
        return true;
      default:
        return false;
    }
  };
}
