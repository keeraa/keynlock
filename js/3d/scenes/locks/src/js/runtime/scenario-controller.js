import { normalizeScenario, parseScenario, scenarioSearch } from './scenarios.js';

/** Apply reproducible mode, puzzle, seed and camera settings through real game actions. */
export function createScenarioController({ window, document, camera, controls,
  rng, state, getPinXs, getPinPuzzle, dispatch }) {
  const originalView = camera.position.clone();
  let currentView = 'default';
  let currentSeed = parseScenario(window.location.search).seed;

  function setView(view) {
    const normalized = normalizeScenario({ view }).view;
    currentView = normalized;
    controls.target.set(.28, .02, 0);
    const positions = {
      default: originalView,
      front: { x: .28, y: .85, z: 8.4 },
      side: { x: -8.2, y: .5, z: .25 },
      top: { x: .28, y: 8.1, z: 1.55 },
    };
    const next = positions[normalized];
    camera.position.set(next.x, next.y, next.z);
    controls.update();
    return normalized;
  }

  function current() {
    const game = getPinPuzzle();
    return normalizeScenario({
      seed: currentSeed, mode: state.mode, puzzle: game?.type || 'free',
      level: game?.level || Number(document.querySelector('#pinPuzzleLevels button.active')?.dataset.level) || 1,
      pins: getPinXs().length, view: currentView,
    });
  }

  function apply(input, { updateUrl = false } = {}) {
    const scenario = normalizeScenario(input);
    currentSeed = scenario.seed;
    rng.reset(scenario.seed);
    // Clear the selection first: a mode change can otherwise auto-start a stale game.
    document.querySelector('#pinPuzzleSelect').value = 'free';
    dispatch({ type: 'mode', mode: scenario.mode }, { source: 'scenario' });
    if (scenario.mode === 'pin') {
      // Legacy free-mode links with ?pins=5/6 still work, but the visible
      // difficulty selection is now the sole owner of the number of chambers.
      const level=scenario.puzzle==='free'&&scenario.level===1?
        Math.max(1,scenario.pins-3):scenario.level;
      dispatch({ type: 'puzzle-start', puzzle: scenario.puzzle, level },
        { source: 'scenario' });
    }
    setView(scenario.view);
    const applied = current();
    if (updateUrl) window.history.replaceState(null, '',
      `${window.location.pathname}${scenarioSearch(applied, { debug: new URLSearchParams(window.location.search).get('debug') === '1' })}`);
    return applied;
  }

  function loadFromUrl() {
    const params = new URLSearchParams(window.location.search);
    if (![ 'scenario', 'mode', 'puzzle', 'level', 'pins', 'seed', 'view' ].some(key => params.has(key)))
      return current();
    return apply(parseScenario(window.location.search));
  }
  return { current, apply, loadFromUrl, setView,
    get search() { return scenarioSearch(current()); } };
}
