/** Independent visual settings panel, collapsible workbench and shortcuts. */
export function wireWorkshopUI({ cartoonFilter, navigation, restorationInput, collectionUI, $ }) {
  function updateVisualSettings() {
    const toonOn = $('toon-enabled').checked;
    const outlineOn = $('outline-enabled').checked;
    $('visual-master').checked = toonOn || outlineOn;
    $('toon-effect').classList.toggle('is-disabled', !toonOn);
    $('outline-effect').classList.toggle('is-disabled', !outlineOn);
    for (const id of ['toon-strength', 'toon-steps']) $(id).disabled = !toonOn;
    for (const id of ['outline-saturation', 'outline-thickness']) $(id).disabled = !outlineOn;
    $('toon-strength-value').textContent = `${$('toon-strength').value}%`;
    $('toon-steps-value').textContent = `${$('toon-steps').value} ступ.`;
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
    $('visual-panel').hidden = !open;
    $('visual-trigger').setAttribute('aria-expanded', String(open));
  }
  $('visual-trigger').addEventListener('click', () => setVisualPanelOpen($('visual-panel').hidden));
  $('visual-close').addEventListener('click', () => setVisualPanelOpen(false));
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
    const label = visible ? 'Скрыть нижнее меню' : 'Показать нижнее меню';
    toggle.setAttribute('aria-label', label);
    toggle.title = label;
    toggle.querySelector('.workbench-toggle-label').textContent = visible ? 'СКРЫТЬ ПАНЕЛЬ' : 'ПОКАЗАТЬ ПАНЕЛЬ';
    toggle.querySelector('.workbench-toggle-symbol').textContent = visible ? '⌄' : '⌃';
  }
  toggle.addEventListener('click', () => setWorkbenchVisible(workbenchContent.hidden));

  window.addEventListener('keydown', (event) => {
    if (collectionUI.isOpen()) return;
    if (navigation.isWallGallery()) {
      if (event.code === 'Escape') {
        event.preventDefault();
        if (navigation.focusedWallId()) navigation.leaveWallArt();
        else navigation.leaveWallGallery();
      } else if (['ArrowUp', 'KeyW', 'ArrowDown', 'KeyS'].includes(event.code)) {
        event.preventDefault();
        navigation.moveAlongWall(['ArrowUp', 'KeyW'].includes(event.code) ? 1 : -1);
      }
      return;
    }
    // Use physical keys so WASD/number tools work with RU keyboard layouts.
    if (!event.altKey && !event.ctrlKey && !event.metaKey && !event.isComposing) {
      const side = { ArrowLeft: 'original', KeyA: 'original', ArrowRight: 'copy', KeyD: 'copy' }[event.code];
      if (side) { event.preventDefault(); event.stopPropagation(); navigation.focusOn(side); return; }
      if (event.code === 'ArrowUp' || event.code === 'KeyW') {
        event.preventDefault(); event.stopPropagation();
        if (!navigation.focusedSide()) navigation.focusOn(navigation.lastFocusedSide());
        return;
      }
      if (event.code === 'ArrowDown' || event.code === 'KeyS') {
        event.preventDefault(); event.stopPropagation(); navigation.leaveFocus(); return;
      }
    }
    if (event.code === 'Escape' && !$('visual-panel').hidden) { setVisualPanelOpen(false); return; }
    const target = event.target;
    if (target && (target.matches('input, textarea, select, button') || target.isContentEditable)) return;
    const tool = {
      Digit4: 'brush', Digit5: 'uv', Digit6: 'reagent', Digit7: 'swab', Digit8: 'retouch',
    }[event.code];
    if (tool) { event.preventDefault(); restorationInput.selectTool(tool); return; }
    if (event.code === 'Space') {
      event.preventDefault();
      navigation.focusOn(navigation.focusedSide() === 'original' ? 'copy' : 'original');
      return;
    }
    if (event.code === 'Escape' && navigation.focusedSide()) {
      event.preventDefault(); navigation.leaveFocus(); return;
    }
    if (event.code === 'Escape' && restorationInput.currentTool()) {
      event.preventDefault(); restorationInput.selectTool(restorationInput.currentTool());
    }
  }, { capture: true });
  return { setWorkbenchVisible, isWorkbenchVisible: () => !workbenchContent.hidden };
}
