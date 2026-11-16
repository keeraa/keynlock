import { SCENARIO_PUZZLES, SCENARIO_VIEWS, createScenarioTape } from '../runtime/scenarios.js';

/** Tooling is only constructed on ?debug=1 and never appears in player mode. */
export function createLockDevtools({ THREE, window, document, root, scene, state,
  scenarioController, getPinXs, getPinPuzzle, pinStacks, pinGroup, pinShearY,
  coreCenterZ, pinGearDrive, pinGearOutput, shackleBody, gameActions }) {
  if (new URLSearchParams(window.location.search).get('debug') !== '1')
    return { tick() {}, dispose() {} };

  const panel = document.createElement('aside');
  panel.id = 'keynlock-devtools';
  panel.setAttribute('aria-label', 'Диагностика замка');
  panel.innerHTML = `
    <div class="dev-heading"><strong>KEYNLOCK · DEBUG</strong><button data-action="collapse" aria-label="Свернуть">−</button></div>
    <div class="dev-content">
      <div class="dev-fields">
        <label>Механизм<select data-field="mode"><option value="pin">Штифтовый</option><option value="disc">Дисковый</option><option value="code">Кодовый</option></select></label>
        <label>Головоломка<select data-field="puzzle">${SCENARIO_PUZZLES.map(v => `<option value="${v}">${v}</option>`).join('')}</select></label>
        <label>Уровень<select data-field="level"><option>1</option><option>2</option><option>3</option></select></label>
        <label>Штифты<input data-field="pins" type="number" min="4" max="6" value="4"></label>
        <label>Seed<input data-field="seed" type="number" min="1" max="4294967295" value="97461"></label>
        <label>Камера<select data-field="view">${SCENARIO_VIEWS.map(v => `<option value="${v}">${v}</option>`).join('')}</select></label>
      </div>
      <div class="dev-actions"><button data-action="apply">Применить</button><button data-action="copy">Ссылка</button></div>
      <input data-output="url" aria-label="Ссылка на сценарий" type="text" readonly>
      <fieldset><legend>Геометрия</legend>
        <label><input type="checkbox" data-overlay="axes">Оси XYZ</label>
        <label><input type="checkbox" data-overlay="bounds">Границы штифтов</label>
        <label><input type="checkbox" data-overlay="shear">Линия среза</label>
      </fieldset>
      <pre data-output="metrics">Ожидание кадра…</pre>
      <div class="dev-actions"><button data-action="record">● Запись</button><button data-action="replay">▶ Повтор</button></div>
      <textarea data-output="tape" rows="5" spellcheck="false" placeholder="JSON записи действий"></textarea>
      <small data-output="status">Диагностика включена только для debug=1.</small>
    </div>`;
  document.querySelector('#app').append(panel);
  const field = name => panel.querySelector(`[data-field="${name}"]`);
  const output = name => panel.querySelector(`[data-output="${name}"]`);
  const notify = message => { output('status').textContent = message; };

  const axes = new THREE.AxesHelper(1.4);
  axes.position.set(-1.80, -.90, .40);
  axes.visible = false;
  root.add(axes);
  const bounds = pinStacks.map(st => {
    const box = new THREE.BoxHelper(st.pin, 0x59d4ff);
    box.visible = false;
    scene.add(box);
    return box;
  });
  const shearGeometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-1.65, pinShearY, coreCenterZ + .23),
    new THREE.Vector3(.85, pinShearY, coreCenterZ + .23),
  ]);
  const shearMaterial = new THREE.LineBasicMaterial({ color: 0xffd073, depthTest: false });
  const shearLine = new THREE.Line(shearGeometry, shearMaterial);
  shearLine.visible = false;
  pinGroup.add(shearLine);
  const overlays = { axes: false, bounds: false, shear: false };
  function setOverlay(name, enabled) {
    if (!(name in overlays)) throw new Error(`Неизвестный слой: ${name}`);
    overlays[name] = Boolean(enabled);
    axes.visible = overlays.axes;
    shearLine.visible = overlays.shear && state.mode === 'pin';
    for (const [i, box] of bounds.entries()) box.visible = overlays.bounds &&
      state.mode === 'pin' && i < getPinXs().length;
    panel.querySelector(`[data-overlay="${name}"]`).checked = overlays[name];
  }

  function syncForm() {
    const snapshot = scenarioController.current();
    for (const [key, value] of Object.entries(snapshot)) field(key).value = String(value);
    field('puzzle').disabled = snapshot.mode !== 'pin';
    output('url').value = `${window.location.origin}${window.location.pathname}${scenarioController.search}&debug=1`;
  }
  function formScenario() {
    return Object.fromEntries(['mode', 'puzzle', 'level', 'pins', 'seed', 'view']
      .map(key => [key, field(key).value]));
  }
  function apply(input, { updateUrl = true } = {}) {
    const result = scenarioController.apply(input, { updateUrl });
    syncForm();
    notify(`Сценарий: ${result.mode}/${result.puzzle} · seed ${result.seed}`);
    return result;
  }

  const tape = createScenarioTape({ now: () => window.performance.now() });
  let lastTape = null;
  // Record committed game commands, regardless of whether they came from the
  // keyboard, HTML controls, or a raycast into the 3D scene.
  const unsubscribeActions = gameActions.subscribe((command, { source }) => {
    if (tape.isRecording && !tape.isPlaying && source !== 'replay')
      tape.record({ type: 'command', command });
  });

  function dispatch(action) {
    if (action.type === 'command') {
      gameActions.dispatch(action.command, { source: 'replay' });
      return;
    }
    // An older recording may still contain the removed 4–7 slider. Route it
    // through the current validated action and cap the obsolete seventh pin.
    if ((action.type === 'input' || action.type === 'change') &&
      action.selector === '#pinCountSlider') {
      gameActions.dispatch({ type: 'pin-count', count: Math.min(6, Number(action.value)) },
        { source: 'replay' });
      return;
    }
    // UI controls removed in the compact 3D-first layout still replay as commands.
    if(action.type==='click'&&['#pinPuzzleMinus','#pinPuzzlePlus','#pinPuzzlePlayButton']
      .includes(action.selector)){
      gameActions.dispatch(action.selector==='#pinPuzzlePlayButton'?{type:'puzzle-action'}:
        {type:'puzzle-adjust',delta:action.selector==='#pinPuzzleMinus'?-1:1},
      {source:'replay'});
      return;
    }
    if(action.selector==='#pinPuzzleValueSlider'&&action.type!=='click'){
      gameActions.dispatch({type:'puzzle-value',value:Number(action.value)},{source:'replay'});
      return;
    }
    // Legacy event tapes made before semantic commands still replay safely.
    if (action.type === 'key') {
      document.dispatchEvent(new window.KeyboardEvent('keydown', {
        code: action.code, key: action.code, bubbles: true, cancelable: true,
      }));
      return;
    }
    const target = document.querySelector(action.selector);
    if (!target) throw new Error(`Элемент больше не найден: ${action.selector}`);
    if (action.type === 'click') target.click();
    else {
      target.value = action.value;
      target.dispatchEvent(new window.Event(action.type, { bubbles: true }));
    }
  }
  panel.addEventListener('change', event => {
    if (event.target.dataset.overlay) setOverlay(event.target.dataset.overlay, event.target.checked);
    if (event.target.dataset.field === 'mode') field('puzzle').disabled = event.target.value !== 'pin';
  });
  panel.addEventListener('click', async event => {
    const action = event.target.closest('button')?.dataset.action;
    if (!action) return;
    if (action === 'collapse') {
      const collapsed = panel.classList.toggle('collapsed');
      event.target.textContent = collapsed ? '+' : '−';
    } else if (action === 'apply') {
      if (tape.isRecording) { notify('Останови запись перед сменой сценария.'); return; }
      apply(formScenario());
    }
    else if (action === 'copy') {
      try { await window.navigator.clipboard.writeText(output('url').value); notify('Ссылка скопирована.'); }
      catch { output('url').select(); notify('Ссылка выделена для копирования.'); }
    } else if (action === 'record') {
      if (tape.isRecording) {
        lastTape = tape.stop();
        output('tape').value = JSON.stringify(lastTape, null, 2);
        event.target.textContent = '● Запись';
        notify(`Записано действий: ${lastTape.actions.length}.`);
      } else {
        tape.start(scenarioController.current());
        event.target.textContent = '■ Стоп';
        notify('Запись действий запущена.');
      }
    } else if (action === 'replay') {
      if (tape.isRecording) { notify('Сначала останови запись.'); return; }
      try {
        const source = output('tape').value ? JSON.parse(output('tape').value) : lastTape;
        if (!source) { notify('Нет записи для повтора.'); return; }
        notify('Воспроизводим действия…');
        await tape.replay(source, { reset: initial => apply(initial), dispatch });
        notify(`Повтор завершён: ${source.actions.length} действий.`);
      } catch (error) { notify(`Ошибка повтора: ${error.message}`); }
    }
  });

  let frames = 0;
  function metrics() {
    const count = getPinXs().length;
    return {
      mode: state.mode, puzzle: getPinPuzzle()?.type || 'free', count,
      lift: pinStacks.slice(0, count).map(st => Number(st.lift.toFixed(3))),
      shear: pinStacks.slice(0, count).map(st => Number(st.requiredLift.toFixed(3))),
      spring: pinStacks.slice(0, count).map(st => Number(st.spring.scale.y.toFixed(3))),
      gears: [pinGearDrive.rotation.z, pinGearOutput.rotation.z].map(v => Number(v.toFixed(3))),
      insert: Number(state.insertP.toFixed(2)), explode: Number(state.explodeP.toFixed(2)),
      shackleReleased: shackleBody.released,
      fps: document.querySelector('#fpsCount')?.textContent,
    };
  }
  function tick() {
    if (overlays.bounds) for (let i = 0; i < getPinXs().length; i++) bounds[i].update();
    if (overlays.shear) {
      const xs = getPinXs();
      const positions = shearGeometry.attributes.position;
      positions.setX(0, xs[0] - .20);
      positions.setX(1, xs[xs.length - 1] + .20);
      positions.needsUpdate = true;
      shearLine.visible = state.mode === 'pin';
    }
    if (++frames % 15 === 0 && !panel.classList.contains('collapsed')) {
      output('metrics').textContent = JSON.stringify(metrics(), null, 2);
      for (let i = 0; i < bounds.length; i++)
        bounds[i].visible = overlays.bounds && state.mode === 'pin' && i < getPinXs().length;
    }
  }
  function setTargets({ insert, explode, turn, unlock } = {}) {
    for (const [value, property] of [[insert, 'insertTarget'], [explode, 'explodeTarget'],
      [turn, 'turnTarget'], [unlock, 'unlockTarget']])
      if (value !== undefined) state[property] = Math.max(0, Math.min(1, Number(value) || 0));
  }
  syncForm();
  window.__keynlockDev = { applyScenario: apply, setView: scenarioController.setView,
    currentScenario: scenarioController.current, setOverlay, setTargets, getMetrics: metrics };
  return { tick, dispose() {
    unsubscribeActions();
    axes.removeFromParent(); axes.geometry.dispose(); axes.material.dispose();
    for (const box of bounds) { box.removeFromParent(); box.geometry.dispose(); box.material.dispose(); }
    shearLine.removeFromParent(); shearGeometry.dispose(); shearMaterial.dispose();
    panel.remove(); delete window.__keynlockDev;
  } };
}
