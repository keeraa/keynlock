import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../src/vendor/three-core.js';
import { normalizeGameCommand } from '../src/js/gameplay/commands.js';
import { createGameActions } from '../src/js/gameplay/actions.js';
import { createAppearanceActions } from '../src/js/ui/appearance-actions.js';
import { mapGameKey } from '../src/js/ui/keymap.js';
import { createWorldPuzzleEngine } from '../src/js/gameplay/world-puzzles/engine.js';

function actionFixture(worldPuzzles) {
  const events = [], nodes = new Map();
  const $ = id => {
    if (!nodes.has(id)) nodes.set(id, {
      textContent: id === 'pinFinishValue' ? 'Медь' : '',
      value: '', classList: { toggle() {} }, setAttribute() {},
    });
    return nodes.get(id);
  };
  const state = {
    mode: 'pin', picking: false, insertTarget: 0, insertP: 0,
    turnTarget: 0, turnP: 0, unlockTarget: 0, unlockP: 0,
    wrong: false, pickTargetX: -.5, finish: 'titanium',
    transparency: 1, explodeTarget: 0, autoXray: false, schematicXray: false,
    cartoonEnabled: false, cartoonOutline: 70,
    toonEnabled: false, toonStrength: 80, toonBands: 4,
    outlineEnabled: false, outlineWidth: 1,
    paintedMaterialsEnabled: true, paintStrength: 95, paintMaterial: 90, paintDetail: 2,
    paintSteelVariant: 'steel', paintBrassVariant: 'brass',
  };
  const pinKey = {
    rig: { visible: true },
    blade: { geometry: { dispose() {} } },
  };
  const appearance = {
    state, $, document: { querySelectorAll: () => [], querySelector: () => null },
    status: message => events.push(['status', message]),
    getPinXs: () => [-.5, 0, .5, .9],
    mat: {
      case: { color: new THREE.Color(), roughness: .49 },
      glass: { color: new THREE.Color(), roughness: .49 },
    },
    setPinFinish: index => events.push(['pin-finish', index]),
    applyDrawingStyle: () => events.push(['drawing', state.toonEnabled,
      state.outlineEnabled, state.cartoonOutline]),
    applyPaintedMaterials: () => events.push(['paint', state.paintedMaterialsEnabled,
      state.paintStrength, state.paintMaterial, state.paintDetail,
      state.paintSteelVariant, state.paintBrassVariant]),
    setBaseCaseRoughness() {},
  };
  const deps = {
    THREE, $, state,
    document: { querySelectorAll: () => [], querySelector: () => null },
    setMode: mode => { state.mode = mode; events.push(['mode', mode]); },
    setPinCount: count => events.push(['pins', count]),
    startPinPuzzle: (puzzle, level) => events.push(['puzzle', puzzle, level]),
    puzzleAdjust: delta => events.push(['adjust', delta]),
    puzzleSetSlider: value => events.push(['slider', value]),
    pinPuzzleAction: () => events.push(['puzzle-action']),
    updateButtons() {}, resetPicking() {},
    shackleBody: { released: false },
    reset: () => events.push(['reset']),
    attemptShackleOpen: () => events.push(['open']),
    restoreShackle() {}, pinKey, pickRig: { visible: false },
    tensionRig: { visible: false }, makeKeyProfile: () => ({}),
    status: message => events.push(['status', message]),
    tensionModels: Array.from({ length: 5 }, () => ({ visible: false })),
    tensionSpecs: Array.from({ length: 5 }, (_, i) => ({ name: `W${i}` })),
    getPinPuzzle: () => null, getPinXs: () => [-.5, 0, .5, .9],
    setSelectedTension: index => events.push(['tension', index]),
    attemptPick: () => events.push(['pick']),
    puzzleSelectPin: (index, press) => events.push(['select', index, press]),
    nearestPin: () => ({ index: 0 }),
    applyAppearanceAction: createAppearanceActions(appearance),
    toggleOilTool: () => events.push(['oil']),
    platePuzzle: {
      model: {feedback:'Пластина выбрана'},
      setCount: count => {events.push(['plate-count',count]);return true;},
      selectPlate: index => {events.push(['plate-select',index]);return true;},
      selectTool: index => {events.push(['plate-tool',index]);return true;},
      shift: delta => {events.push(['plate-shift',delta]);return true;},
    },
    renderPlateUI: () => events.push(['plate-render']),
    worldPuzzles,
  };
  return { actions: createGameActions(deps), events, state, $ };
}

test('regular menu clicks stay responsive while a chapter puzzle is on the table',()=>{
  const worldPuzzles=createWorldPuzzleEngine({seed:27});
  const {actions,events,state}=actionFixture(worldPuzzles);
  actions.dispatch({type:'world-start',id:'museum',level:2},{source:'ui'});
  assert.equal(worldPuzzles.getSnapshot().active,true);
  actions.dispatch({type:'paint-strength',value:70},{source:'ui'});
  assert.equal(worldPuzzles.getSnapshot().active,true,'visual settings keep the story running');
  actions.dispatch({type:'mode',mode:'disc'},{source:'scene'});
  assert.equal(state.mode,'pin','background scene commands do not interrupt the puzzle');
  actions.dispatch({type:'mode',mode:'disc'},{source:'ui'});
  assert.equal(worldPuzzles.getSnapshot().active,false,'lock menu takes back its workspace');
  assert.equal(state.mode,'disc','the clicked command executes after leaving the story');
  assert.ok(events.some(row=>row[0]==='mode'&&row[1]==='disc'));
  actions.dispatch({type:'world-start',id:'wharf',level:1},{source:'replay'});
  actions.dispatch({type:'mode',mode:'plate'},{source:'replay'});
  assert.equal(worldPuzzles.getSnapshot().active,false,'recorded menu navigation stays replayable');
  assert.equal(state.mode,'plate');
});

test('action protocol accepts only valid, serializable gameplay commands', () => {
  const values = [
    { type: 'mode', mode: 'disc' },
    { type: 'world-start', id: 'wharf', level: 1 },
    { type: 'world-start', id: 'museum', level: 3 },
    { type: 'world-choice', index: 20 },
    { type: 'world-confirm' }, { type: 'world-restart' }, { type: 'world-exit' },
    { type: 'mode', mode: 'plate' },
    { type: 'plate-select', index: 3 },
    { type: 'plate-select', index: 5 },
    { type: 'plate-count', count: 4 },
    { type: 'plate-count', count: 6 },
    { type: 'pin-count', count: 6 },
    { type: 'plate-tool', index: 4 },
    { type: 'plate-shift', delta: -1 },
    { type: 'puzzle-select', index: 2, press: true },
    { type: 'case-finish', color: 'bronze' },
    { type: 'oil-tool-toggle' },
    { type: 'schematic-xray-toggle' },
    { type: 'cartoon-toggle' },
    { type: 'toon-toggle' }, { type: 'outline-toggle' }, { type: 'paper-toggle' },
    { type: 'toon-strength', value: 92 }, { type: 'toon-bands', value: 6 },
    { type: 'cartoon-outline', value: 85 },
    { type: 'outline-width', value: 2.5 },
    { type: 'paper-strength', value: 40 }, { type: 'paper-scale', value: 160 },
    { type: 'painted-materials-toggle' }, { type: 'paint-strength', value: 78 },
    { type: 'paint-material', value: 60 }, { type: 'paint-detail', value: 92 },
    { type: 'film-intensity', value: 45 },
    { type: 'paint-steel-variant', variant: 'enamel' },
    { type: 'paint-brass-variant', variant: 'copper' },
  ];
  for (const value of values)
    assert.deepEqual(normalizeGameCommand(JSON.parse(JSON.stringify(value))), value);
  for (const value of [
    { type: 'mode', mode: 'padlock' }, { type: 'pin-count', count: 99 },
    { type: 'world-start', id: 'nonexistent', level: 1 },
    { type: 'world-start', id: 'museum', level: 4 },
    { type: 'world-choice', index: -1 }, { type: 'world-choice', index: 21 },
    { type: 'world-confirm', extra: 1 },
    { type: 'pin-count', count: 7 }, { type: 'puzzle-select', index: 6 },
    { type: 'plate-select', index: 6 }, { type: 'plate-tool', index: 5 },
    { type: 'plate-count', count: 3 }, { type: 'plate-count', count: 7 },
    { type: 'plate-count', count: '5' },
    { type: 'plate-shift', delta: 2 }, { type: 'plate-tool', index: 1, extra: 1 },
    { type: 'wrench', index: -1 }, { type: 'pick-step', delta: 4 },
    { type: 'reset', extra: true }, { type: 'opacity', value: Infinity },
    { type: 'schematic-xray-toggle', value: true },
    { type: 'cartoon-outline', value: -1 }, { type: 'cartoon-outline', value: 120 },
    { type: 'toon-bands', value: 1 }, { type: 'toon-bands', value: 3.5 },
    { type: 'outline-width', value: 5 }, { type: 'paper-scale', value: 20 },
    { type: 'paper-strength', value: '50' }, { type: 'toon-toggle', value: 1 },
    { type: 'paint-strength', value: -1 }, { type: 'paint-material', value: 110 },
    { type: 'paint-detail', value: '35' }, { type: 'painted-materials-toggle', value: false },
    { type: 'film-intensity', value: -1 }, { type: 'film-intensity', value: 101 },
    { type: 'paint-steel-variant', variant: 'brass' },
    { type: 'paint-brass-variant', variant: 'steel' },
    { type: 'paint-brass-variant', variant: 'copper', extra: true },
    { type: 'puzzle-select', index: 2, press: 'yes' },
    { type: '__proto__' }, null, [],
  ]) assert.throws(() => normalizeGameCommand(value), /команд/i);
});

test('schematic X-ray is separate from the opaque 0% wall and restores its previous setting', () => {
  const {actions,state,$}=actionFixture();
  actions.dispatch({type:'opacity',value:0});
  actions.dispatch({type:'schematic-xray-toggle'});
  assert.equal(state.schematicXray,true);
  assert.equal(state.transparency,0);
  assert.equal($('opacityValue').textContent,'Рентген');
  assert.equal($('opacitySlider').disabled,true);
  assert.equal($('autoXray').disabled,true);
  actions.dispatch({type:'schematic-xray-toggle'});
  assert.equal(state.schematicXray,false);
  assert.equal($('opacitySlider').disabled,false);
  assert.equal($('autoXray').disabled,false);
  assert.equal($('opacityValue').textContent,'0%');
});

test('dispatcher applies actions once and publishes typed commands with their source', () => {
  const { actions, events, state, $ } = actionFixture();
  const observed = [];
  const unsubscribe = actions.subscribe((command, context) => observed.push([command, context.source]));
  actions.dispatch({ type: 'pin-count', count: 6 }, { source: 'ui' });
  actions.dispatch({ type: 'mode', mode: 'disc' }, { source: 'replay' });
  actions.dispatch({ type: 'puzzle-start', puzzle: 'classic', level: 2 });
  actions.dispatch({ type: 'puzzle-select', index: 1, press: true }, { source: 'scene' });
  actions.dispatch({ type: 'puzzle-adjust', delta: -1 });
  actions.dispatch({ type: 'opacity', value: 37 });
  actions.dispatch({ type: 'case-finish', color: 'bronze' });
  actions.dispatch({ type: 'pin-finish', index: 3 });
  actions.dispatch({ type: 'cartoon-toggle' });
  actions.dispatch({ type: 'cartoon-outline', value: 85 });
  actions.dispatch({ type: 'oil-tool-toggle' });
  assert.deepEqual(events.filter(row => row[0] !== 'status'), [
    ['pins', 6], ['mode', 'disc'], ['puzzle', 'classic', 2], ['select', 1, true],
    ['adjust', -1], ['pin-finish', 3],
    ['drawing', true, true, 70], ['drawing', true, true, 85], ['oil'],
  ]);
  assert.equal(state.transparency, .37);
  assert.equal($('opacityValue').textContent, '37%');
  assert.equal(state.finish, 'bronze');
  assert.equal(state.cartoonEnabled, true);
  assert.equal(state.toonEnabled, true);
  assert.equal(state.outlineEnabled, true);
  assert.equal(state.cartoonOutline, 85);
  assert.equal($('cartoonOutlineValue').textContent, '85%');
  assert.equal($('cartoonOutlineSlider').disabled, false);
  assert.equal(observed.length, 11);
  assert.deepEqual(observed[1], [{ type: 'mode', mode: 'disc' }, 'replay']);
  assert.deepEqual(observed[3], [{ type: 'puzzle-select', index: 1, press: true }, 'scene']);
  assert.throws(() => actions.dispatch({ type: 'mode', mode: 'invalid' }), /команд/);
  assert.equal(observed.length, 11);
  unsubscribe();
  actions.dispatch({ type: 'cartoon-toggle' });
  assert.equal(state.cartoonEnabled, false);
  assert.equal($('cartoonOutlineSlider').disabled, true);
  assert.equal($('toonBandsSlider').disabled, true);
  actions.dispatch({ type: 'reset' });
  assert.equal(observed.length, 11);
  assert.ok(events.some(row => row[0] === 'reset'));
});

test('drawing controls can run separately and retain their own intensity and scale', () => {
  const { actions, state, $, events } = actionFixture();
  actions.dispatch({ type: 'toon-toggle' });
  assert.equal(state.toonEnabled, true);
  assert.equal(state.outlineEnabled, false);
  assert.equal(state.cartoonEnabled, true);
  assert.equal($('toonStrengthSlider').disabled, false);
  assert.equal($('cartoonOutlineSlider').disabled, true);
  actions.dispatch({ type: 'toon-bands', value: 7 });
  actions.dispatch({ type: 'toon-strength', value: 65 });
  actions.dispatch({ type: 'outline-toggle' });
  actions.dispatch({ type: 'outline-width', value: 3.5 });
  actions.dispatch({ type: 'paper-toggle' });
  actions.dispatch({ type: 'paper-strength', value: 73 });
  actions.dispatch({ type: 'paper-scale', value: 175 });
  assert.equal(state.paperEnabled, undefined, 'old paper commands are harmless no-ops');
  assert.equal($('toonBandsValue').textContent, '7 ступ.');
  assert.equal($('toonStrengthValue').textContent, '65%');
  assert.equal($('outlineWidthValue').textContent, '3.5 px');
  assert.equal(state.toonBands, 7);
  assert.equal(state.outlineWidth, 3.5);
  assert.equal($('outlineWidthSlider').disabled, false);
  assert.equal(events.filter(row => row[0] === 'drawing').length, 5);
  actions.dispatch({ type: 'toon-toggle' });
  assert.equal($('toonBandsSlider').disabled, true);
  assert.equal($('outlineWidthSlider').disabled, false);
  assert.equal(state.cartoonEnabled, true, 'master stays active if any layer remains enabled');
  actions.dispatch({ type: 'cartoon-toggle' });
  assert.equal(state.outlineEnabled, false);
  assert.equal(state.cartoonEnabled, false);
  actions.dispatch({ type: 'cartoon-toggle' });
  assert.equal(state.toonBands, 7, 'master retains per-layer settings');
  assert.equal(state.toonEnabled, true);
});

test('hand-painted material controls preserve their settings and restore original rendering', () => {
  const { actions, state, $, events } = actionFixture();
  actions.dispatch({ type: 'paint-strength', value: 89 });
  actions.dispatch({ type: 'paint-material', value: 48 });
  actions.dispatch({ type: 'paint-detail', value: 75 });
  actions.dispatch({ type: 'paint-steel-variant', variant: 'graphite' });
  actions.dispatch({ type: 'paint-brass-variant', variant: 'copper' });
  assert.equal(state.paintSteelVariant, 'graphite');
  assert.equal(state.paintBrassVariant, 'copper');
  assert.equal(state.paintStrength, 89);
  assert.equal(state.paintMaterial, 48);
  assert.equal(state.paintDetail, 75);
  assert.equal($('paintStrengthValue').textContent, '89%');
  assert.equal($('paintMaterialValue').textContent, '48%');
  assert.equal($('paintDetailValue').textContent, '75%');
  actions.dispatch({ type: 'painted-materials-toggle' });
  assert.equal(state.paintedMaterialsEnabled, false);
  assert.equal($('paintStrengthSlider').disabled, true);
  assert.equal(state.toonEnabled, false, 'separate post effects keep their own state');
  actions.dispatch({ type: 'painted-materials-toggle' });
  assert.equal($('paintDetailSlider').disabled, false);
  assert.equal(state.paintStrength, 89);
  assert.deepEqual(events.filter(row => row[0] === 'paint'), [
    ['paint', true, 89, 90, 2, 'steel', 'brass'],
    ['paint', true, 89, 48, 2, 'steel', 'brass'],
    ['paint', true, 89, 48, 75, 'steel', 'brass'],
    ['paint', true, 89, 48, 75, 'graphite', 'brass'],
    ['paint', true, 89, 48, 75, 'graphite', 'copper'],
    ['paint', false, 89, 48, 75, 'graphite', 'copper'],
    ['paint', true, 89, 48, 75, 'graphite', 'copper'],
  ]);
});

test('older film-grain commands remain harmless when replayed', () => {
  const { actions, state, events } = actionFixture();
  const replayed = [];
  actions.subscribe(command => replayed.push(command));
  actions.dispatch({ type: 'film-intensity', value: 78 }, { source: 'replay' });
  assert.deepEqual(replayed, [{ type: 'film-intensity', value: 78 }]);
  assert.equal('filmIntensity' in state, false, 'the removed effect has no runtime state');
  assert.deepEqual(events, [], 'legacy commands cannot re-enable a page overlay');
});

test('plate input selects a row, matches one of five tools and moves via typed actions', () => {
  const {actions,events,state}=actionFixture();
  state.mode='plate';
  actions.dispatch({type:'plate-select',index:2},{source:'scene'});
  actions.dispatch({type:'plate-tool',index:4},{source:'ui'});
  actions.dispatch({type:'plate-shift',delta:-1},{source:'keyboard'});
  assert.deepEqual(events.filter(([type])=>type.startsWith('plate-')&&!['plate-render'].includes(type)),[
    ['plate-select',2],['plate-tool',4],['plate-shift',-1],
  ]);
  assert.equal(events.filter(([type])=>type==='plate-render').length,3);
  state.mode='disc';
  actions.dispatch({type:'plate-shift',delta:1});
  assert.equal(events.filter(([type])=>type==='plate-shift').length,1,
    'inactive plate game ignores plate movement');
});

test('shared wrench picker stays in plate mode and maps all five pin wrenches to the original signs', () => {
  const expected = [1,4,0,2,3];
  const {actions,events,state}=actionFixture();
  state.mode='plate';
  for (let index=0;index<5;index++) {
    actions.dispatch({type:'wrench',index},{source:'ui'});
    assert.equal(state.mode,'plate');
    assert.deepEqual(events.filter(([type])=>type==='plate-tool').at(-1),
      ['plate-tool',expected[index]]);
    assert.deepEqual(events.filter(([type])=>type==='tension').at(-1),['tension',index]);
  }
  assert.equal(events.filter(([type])=>type==='plate-render').length,5);
  assert.equal(events.filter(([type])=>type==='mode').length,0,
    'selecting a tension wrench must never switch the plate lock to pin');
  state.mode='pin';
  actions.dispatch({type:'wrench',index:3});
  assert.equal(state.picking,true,'the original pin wrench still enables picking');
});

test('changing plate count through an action resets the lock only in plate mode', () => {
  const {actions,events,state}=actionFixture();
  state.mode='plate';
  actions.dispatch({type:'plate-count',count:6},{source:'ui'});
  assert.deepEqual(events.filter(([type])=>type==='plate-count'||type==='reset'),[
    ['plate-count',6],['reset'],
  ]);
  state.mode='pin';
  actions.dispatch({type:'plate-count',count:5},{source:'ui'});
  assert.equal(events.filter(([type])=>type==='plate-count').length,1);
});

test('keyboard maps puzzle, picking and reset keys regardless of layout', () => {
  const input = { code: 'KeyA', mode: 'pin', puzzle: null, picking: true, insertTarget: 1 };
  assert.deepEqual(mapGameKey(input), { handled: true,
    command: { type: 'pick-step', delta: -1 } });
  assert.deepEqual(mapGameKey({ ...input, code: 'KeyW' }), { handled: true,
    command: { type: 'pick' } });
  assert.deepEqual(mapGameKey({ ...input, code: 'Space' }), { handled: true,
    command: { type: 'open' } });
  assert.deepEqual(mapGameKey({ ...input, code: 'KeyA', targetTag: 'INPUT' }),
    { handled: false, command: null });
  const puzzle = { type: 'classic', selected: 1, count: 5 };
  assert.deepEqual(mapGameKey({ ...input, puzzle, code: 'ArrowUp' }), { handled: true,
    command: { type: 'puzzle-adjust', delta: 1 } });
  assert.deepEqual(mapGameKey({ ...input, puzzle, code: 'KeyR' }), { handled: true,
    command: { type: 'reset' } });
  assert.deepEqual(mapGameKey({ ...input, puzzle, code: 'ArrowRight' }), { handled: true,
    command: { type: 'puzzle-select', index: 2 } });
  assert.deepEqual(mapGameKey({ ...input, puzzle, code: 'KeyS' }), { handled: true,
    command: { type: 'puzzle-adjust', delta: -1 } });
  assert.deepEqual(mapGameKey({ ...input, puzzle: { ...puzzle, type: 'sequence' }, code: 'KeyA' }),
    { handled: true, command: { type: 'puzzle-select', index: 0 } });
  assert.deepEqual(mapGameKey({ ...input, puzzle: { ...puzzle, type: 'special' }, code: 'KeyW' }),
    { handled: true, command: { type: 'puzzle-adjust', delta: 1 } });
  for (const type of ['classic','sequence','special','tension','resonance',
    'pinflight','springtumblers','symbolpins']) {
    for (const [code, delta] of [['KeyA',-1],['ArrowLeft',-1],
      ['KeyD',1],['ArrowRight',1]]) {
      assert.deepEqual(mapGameKey({ ...input, puzzle: { ...puzzle, type }, code }),
        { handled: true, command: { type: 'puzzle-select', index: puzzle.selected + delta } },
        `${type}: ${code} must move the pick horizontally`);
    }
    assert.deepEqual(mapGameKey({ ...input, puzzle: { ...puzzle, type }, code: 'KeyD', repeat: true }),
      { handled: true, command: null },`${type}: key repeat must not skip pins`);
    assert.deepEqual(mapGameKey({ ...input, puzzle: { ...puzzle, type, selected: 0 }, code: 'ArrowLeft' }),
      { handled: true, command: { type: 'puzzle-select', index: 0 } },
      `${type}: selection stays within the cylinder`);
  }
  for (const type of ['classic','sequence','special','tension','springtumblers','symbolpins']) {
    for (const [code, delta] of [['KeyW',1],['ArrowUp',1],
      ['KeyS',-1],['ArrowDown',-1]]) {
      assert.deepEqual(mapGameKey({ ...input, puzzle: { ...puzzle, type }, code }),
        { handled: true, command: { type: 'puzzle-adjust', delta } },
        `${type}: ${code} must change height or tension`);
    }
  }
  for (const type of ['resonance','pinflight']) {
    for (const code of ['KeyW','ArrowUp','Space'])
      assert.deepEqual(mapGameKey({ ...input, puzzle: { ...puzzle, type }, code }),
        { handled: true, command: { type: 'puzzle-action' } });
  }
  assert.deepEqual(mapGameKey({...input,mode:'plate',puzzle:null,
    plateSelected:1,code:'KeyS'}),{handled:true,command:{type:'plate-select',index:2}});
  assert.deepEqual(mapGameKey({...input,mode:'plate',puzzle:null,
    plateSelected:4,plateCount:6,code:'KeyS'}),
  {handled:true,command:{type:'plate-select',index:5}});
  assert.deepEqual(mapGameKey({...input,mode:'plate',puzzle:null,
    code:'Digit5'}),{handled:true,command:{type:'wrench',index:1}});
  assert.deepEqual(mapGameKey({...input,mode:'plate',puzzle:null,
    code:'Digit1'}),{handled:true,command:{type:'wrench',index:4}});
  assert.deepEqual(mapGameKey({...input,mode:'plate',puzzle:null,
    code:'Digit2'}),{handled:true,command:{type:'wrench',index:2}});
  assert.deepEqual(mapGameKey({...input,mode:'plate',puzzle:null,
    code:'ArrowLeft'}),{handled:true,command:{type:'plate-shift',delta:-1}});
});

test('browser, system and accessibility shortcuts never reach gameplay', () => {
  const ignored = { handled: false, command: null };
  const puzzle = { type: 'classic', selected: 2, count: 5 };
  for (const [mode, selectedPuzzle] of [['pin', puzzle], ['pin', null],
    ['plate', null], ['disc', null], ['code', null]]) {
    for (const modifier of ['metaKey', 'ctrlKey', 'altKey']) {
      for (const code of ['KeyR', 'KeyN', 'Space', 'ArrowLeft', 'Digit1']) {
        assert.deepEqual(mapGameKey({ code, mode, puzzle: selectedPuzzle,
          picking: true, insertTarget: 1, [modifier]: true }), ignored,
        `${mode}: ${modifier}+${code} belongs to the browser`);
      }
    }
  }
  assert.deepEqual(mapGameKey({code:'KeyR', mode:'pin', puzzle, picking:false}),
    {handled:true,command:{type:'reset'}}, 'unmodified reset remains available');
});
