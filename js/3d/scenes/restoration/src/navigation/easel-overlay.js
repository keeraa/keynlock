/** 2D easel labels and focus controls, independent of camera motion. */
export function createEaselOverlay({ THREE, camera, stage, easelX, labelLayer,
  getPaintingCenterY, getTexture, getTool, inWallMode, $ }) {
  const stageShell = stage.closest?.('.stage') || stage;
  const originalLabel = document.querySelector('.label-original');
  const copyLabel = document.querySelector('.label-copy');
  const projection = new THREE.Vector3();

  Object.assign(labelLayer.style, { inset: '0', width: 'auto' });
  for (const label of [originalLabel, copyLabel]) {
    label.style.position = 'absolute';
    label.style.whiteSpace = 'nowrap';
  }

  function updateStepper(activeSide) {
    const stepper = document.querySelector('.painting-stepper');
    const previous = $('prev-painting');
    const next = $('next-painting');
    stepper.classList.add('focused');
    if (activeSide) {
      $('step-number').textContent = activeSide === 'original' ? 'ОРИГИНАЛ' : 'КОПИЯ';
      previous.disabled = activeSide === 'original';
      next.disabled = activeSide === 'copy';
      previous.setAttribute('aria-label', 'Перейти к оригиналу');
      next.setAttribute('aria-label', 'Перейти к изменённой копии');
    } else {
      $('step-number').textContent = 'СРАВНЕНИЕ';
      previous.disabled = next.disabled = false;
      previous.setAttribute('aria-label', 'Приблизить оригинал');
      next.setAttribute('aria-label', 'Приблизить изменённую копию');
    }
  }

  function updateFocusedHint() {
    $('scene-hint-text').textContent = getTool()
      ? 'Зажмите на копии — реставрация · S/↓ — общий вид · A/D — картины'
      : '← / A — оригинал · → / D — копия · Пробел — сменить · S / ↓ — общий вид';
  }

  function enterFocus(side) {
    document.querySelector('.stage').classList.add('focused');
    labelLayer.classList.add('is-focused');
    $('focus-exit').hidden = false;
    updateFocusedHint();
    updateStepper(side);
  }

  function leaveFocus() {
    document.querySelector('.stage').classList.remove('focused');
    labelLayer.classList.remove('is-focused');
    $('focus-exit').hidden = true;
    $('scene-hint-text').innerHTML = 'Клик / W / ↑ — приблизить <span class="hint-divider">·</span> S / ↓ — общий вид <span class="hint-divider">·</span> A/D, ←/→ — картины';
    updateStepper(null);
  }

  function projectLabel(element, x, y, z) {
    projection.set(x, y, z).project(camera);
    element.style.left = `${(projection.x * .5 + .5) * stage.clientWidth}px`;
    element.style.top = `${(-projection.y * .5 + .5) * stage.clientHeight}px`;
    element.style.transform = 'translate(-50%, -50%)';
  }

  function renderLabels() {
    if (inWallMode()) return;
    const texture = getTexture();
    if (!texture) return;
    const aspect = (texture.image.naturalWidth || texture.image.width) / (texture.image.naturalHeight || texture.image.height);
    const height = Math.min(2.28, 2.17 / aspect);
    const labelY = getPaintingCenterY() + height / 2 + .17;
    projectLabel(originalLabel, -easelX - .62, labelY, .45);
    projectLabel(copyLabel, easelX + .62, labelY, .45);
  }

  return { stageShell, enterFocus, leaveFocus, updateStepper, updateFocusedHint, renderLabels };
}
