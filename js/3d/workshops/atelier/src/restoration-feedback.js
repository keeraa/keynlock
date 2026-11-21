// @ts-check
const TOOL_INSTRUCTIONS = {
  brush: 'Щётка: зажмите ЛКМ и ведите по картине · стойкие пятна — тампон (7)',
  swab: 'Тампон: зажмите ЛКМ и медленно очищайте пятна круговыми движениями',
  uv: 'УФ: наведите фонарь, затем зажмите ЛКМ и просканируйте повреждения',
  reagent: 'Реагент: зажмите ЛКМ и проведите по участкам, отмеченным УФ',
  retouch: 'Кисть: аккуратно закрашивайте светлые сколы на полотне · размер кисти маленький',
};

/** Deterministic scoring can be tested without a renderer or browser. */
export function calculateColorAccuracy(art, player) {
  const h = Math.abs(art.hue + player.hue) / 60;
  const s = Math.abs(Math.log(art.saturation * player.saturation / 100)) / Math.log(1.8);
  const b = Math.abs(Math.log(art.brightness * player.brightness / 100)) / Math.log(1.7);
  const error = Math.sqrt(.34 * h * h + .33 * s * s + .33 * b * b);
  const unassisted = Math.max(0, Math.min(100, 100 * (1 - error * 1.4)));
  return Math.min(100, Math.round(unassisted / .95));
}

/** Color controls, tool hints and restoration milestones for the active canvas. */
export function createRestorationFeedback({ paintings, getSelectedIndex, getSurface,
  getCopyMaterial, getCurrentTool, playerProgress, onRestorationComplete, showToast, $ }) {
  const inputs = { hue: $('hue'), saturation: $('saturation'), brightness: $('brightness') };
  const values = { hue: $('hue-value'), saturation: $('saturation-value'), brightness: $('brightness-value') };
  const current = () => ({ art: paintings[getSelectedIndex()], player: playerProgress.state[getSelectedIndex()] });

  function updateShader(art, player) {
    const material = getCopyMaterial();
    if (!material) return;
    material.uniforms.uHue.value = art.hue + player.hue;
    material.uniforms.uSaturation.value = art.saturation * player.saturation / 100;
    material.uniforms.uBrightness.value = art.brightness * player.brightness / 100;
  }

  function updateRestorationStatus(checkCompletion = false) {
    const surface = getSurface();
    if (!surface) return;
    const progress = surface.progress();
    $('restoration-progress').firstChild.textContent = `${progress.cleaning}% `;
    $('restoration-description').textContent = TOOL_INSTRUCTIONS[getCurrentTool()] ||
      'Наведите курсор на пятно — игра подскажет подходящий инструмент';
    if (!checkCompletion) return;
    const { art, player } = current();
    let message = null;
    if (progress.dirt >= 91 && !player.dustMilestone) {
      player.dustMilestone = true;
      message = 'Пыль и грязь удалены — проявились детали картины';
    }
    if (progress.varnish >= 91 && !player.varnishMilestone) {
      player.varnishMilestone = true;
      message = 'Пожелтевший лак снят — цвета раскрываются';
    }
    if (progress.retouch >= 94 && !player.retouchMilestone) {
      player.retouchMilestone = true;
      message = 'Сколы восстановлены — живопись снова цельная';
    }
    if (progress.cleaning >= 96 && !player.surfaceComplete) {
      player.surfaceComplete = true;
      message = `«${art.short}» — реставрация завершена!`;
      onRestorationComplete(art.id);
    }
    if (message) { showToast(message); playerProgress.save(); }
  }

  function updateUI() {
    const { art, player } = current();
    // The painting's shader responds even if an ancillary HUD element is
    // absent or currently hidden by the shared-room layout.
    updateShader(art, player);
    for (const key of ['hue', 'saturation', 'brightness']) inputs[key].value = player[key];
    values.hue.textContent = `${player.hue > 0 ? '+' : ''}${player.hue}°`;
    values.saturation.textContent = `${player.saturation}%`;
    values.brightness.textContent = `${player.brightness}%`;
    const score = calculateColorAccuracy(art, player);
    $('score-number').textContent = score;
    $('score-fill').style.width = `${score}%`;
    $('score-comment').textContent = score >= 97 ? 'Цвет почти восстановлен ✦'
      : score >= 83 ? 'Очень близко к эталону' : score >= 63 ? 'Уже похоже, продолжайте' : 'Нужно восстановить баланс';
    $('score-fill').style.background = score >= 97 ? '#688264' : '#a88b54';
    if (score >= 98 && !player.completed) {
      player.completed = true;
      playerProgress.save();
      showToast(`«${art.short}» — цвет восстановлен!`);
      onRestorationComplete(art.id);
    }
  }

  function bindControls() {
    for (const key of Object.keys(inputs)) {
      const onValueChanged = (event) => {
        current().player[key] = Number(event.target.value);
        updateUI();
        playerProgress.save();
      };
      inputs[key].addEventListener('input', onValueChanged);
      // Some input devices commit a range on `change` without intermediate
      // `input` events; both routes drive the very same shader and save state.
      inputs[key].addEventListener('change', onValueChanged);
    }
  }

  return { updateUI, updateRestorationStatus, bindControls };
}
