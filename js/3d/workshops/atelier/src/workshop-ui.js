import { t } from './i18n.js';
/** Independent visual settings panel, collapsible workbench and shortcuts. */
export function wireWorkshopUI({ cartoonFilter, navigation, restorationInput, collectionUI, $,
  bindKeyboard = true,
  isEnabled = () => true,
  focusEasel = side => navigation.focusOn(side),
  leaveEaselFocus = () => navigation.leaveFocus() }) {
  function updateVisualSettings() {
    const toonOn = $('toon-enabled').checked;
    const outlineOn = $('outline-enabled').checked;
    $('visual-master').checked = toonOn || outlineOn;
    $('toon-effect').classList.toggle('is-disabled', !toonOn);
    $('outline-effect').classList.toggle('is-disabled', !outlineOn);
    for (const id of ['toon-strength', 'toon-steps']) $(id).disabled = !toonOn;
    for (const id of ['outline-saturation', 'outline-thickness']) $(id).disabled = !outlineOn;
    $('toon-strength-value').textContent = `${$('toon-strength').value}%`;
    $('toon-steps-value').textContent = t('{steps} ступ.', { steps: $('toon-steps').value });
    $('outline-saturation-value').textContent = `${$('outline-saturation').value}%`;
    $('outline-thickness-value').textContent = `${$('outline-thickness').value} px`;
    cartoonFilter.setOptions({
      toon: toonOn,
      toonStrength: Number($('toon-strength').value) / 100,
      bands: Number($('toon-steps').value),
      outline: outlineOn,
      outlineStrength: Number($('outline-saturation').value) / 100,
      outlineWidth: Number($('outline-thickness').value),
    });
  }

  function setVisualPanelOpen(open) {
    $('atelier-visual-panel').hidden = !open;
    $('atelier-visual-trigger').setAttribute('aria-expanded', String(open));
  }
  $('atelier-visual-trigger').addEventListener('click', () => setVisualPanelOpen($('atelier-visual-panel').hidden));
  $('atelier-visual-close').addEventListener('click', () => setVisualPanelOpen(false));
  $('visual-master').addEventListener('input', () => {
    const enabled = $('visual-master').checked;
    $('toon-enabled').checked = enabled;
    $('outline-enabled').checked = enabled;
    updateVisualSettings();
  });
  for (const id of ['toon-enabled', 'outline-enabled', 'toon-strength', 'toon-steps', 'outline-saturation', 'outline-thickness']) {
    $(id).addEventListener('input', updateVisualSettings);
  }
  updateVisualSettings();

  const workbench = $('workbench');
  const workbenchContent = $('workbench-content');
  const toggle = $('workbench-toggle');
  function setWorkbenchVisible(visible) {
    workbenchContent.hidden = !visible;
    workbench.classList.toggle('is-collapsed', !visible);
    toggle.setAttribute('aria-expanded', String(visible));
    const label = visible ? t('Скрыть нижнее меню') : t('Показать нижнее меню');
    toggle.setAttribute('aria-label', label);
    toggle.title = label;
    toggle.querySelector('.workbench-toggle-label').textContent = visible ? t('СКРЫТЬ ПАНЕЛЬ') : t('ПОКАЗАТЬ ПАНЕЛЬ');
    toggle.querySelector('.workbench-toggle-symbol').textContent = visible ? '⌄' : '⌃';
  }
  toggle.addEventListener('click', () => setWorkbenchVisible(workbenchContent.hidden));

  function handleKey(event) {
    if (!isEnabled()) return;
    if (collectionUI.isOpen()) return;
    if (navigation.isWallGallery()) {
      if (event.code === 'Escape') {
        event.preventDefault();
        if (navigation.focusedWallId()) navigation.leaveWallArt();
        else navigation.leaveWallGallery();
      } else if (['ArrowLeft', 'KeyA', 'ArrowRight', 'KeyD'].includes(event.code)) {
        event.preventDefault();
        navigation.moveAlongWall(['ArrowRight', 'KeyD'].includes(event.code) ? 1 : -1);
      }
      return;
    }
    // Use physical keys so WASD/number tools work with RU keyboard layouts.
    if (!event.altKey && !event.ctrlKey && !event.metaKey && !event.isComposing) {
      const side = { ArrowLeft: 'original', KeyA: 'original', ArrowRight: 'copy', KeyD: 'copy' }[event.code];
      if (side) { event.preventDefault(); event.stopPropagation(); focusEasel(side); return; }
      if (event.code === 'ArrowUp' || event.code === 'KeyW') {
        event.preventDefault(); event.stopPropagation();
        if (!navigation.focusedSide()) focusEasel(navigation.lastFocusedSide());
        return;
      }
      if (event.code === 'ArrowDown' || event.code === 'KeyS') {
        event.preventDefault(); event.stopPropagation(); leaveEaselFocus(); return;
      }
    }
    if (event.code === 'Escape' && !$('atelier-visual-panel').hidden) {
      event.preventDefault(); event.stopPropagation(); setVisualPanelOpen(false); return;
    }
    const target = event.target;
    if (target && (target.matches('input, textarea, select, button') || target.isContentEditable)) return;
    const tool = {
      Digit4: 'brush', Digit5: 'uv', Digit6: 'reagent', Digit7: 'swab', Digit8: 'retouch',
    }[event.code];
    if (tool) { event.preventDefault(); restorationInput.selectTool(tool); return; }
    if (event.code === 'Space') {
      event.preventDefault(); event.stopPropagation();
      focusEasel(navigation.focusedSide() === 'original' ? 'copy' : 'original');
      return;
    }
    if (event.code === 'Escape' && navigation.focusedSide()) {
      event.preventDefault(); event.stopPropagation(); leaveEaselFocus(); return;
    }
    if (event.code === 'Escape' && restorationInput.currentTool()) {
      event.preventDefault(); event.stopPropagation(); restorationInput.selectTool(restorationInput.currentTool());
    }
  }
  if (bindKeyboard) window.addEventListener('keydown', handleKey, { capture: true });
  return { handleKey, setWorkbenchVisible, isWorkbenchVisible: () => !workbenchContent.hidden };
}
