import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CHAPTER_MISSIONS, MUSEUM_SYMBOLS, createWorldPuzzle, makePuzzleRandom,
} from '../src/js/gameplay/world-puzzles/rules.js';
import { createWorldPuzzleEngine } from '../src/js/gameplay/world-puzzles/engine.js';

test('four stable chapter-one IDs map to the opening sequence of the original campaign',()=>{
  assert.deepEqual(CHAPTER_MISSIONS.map(mission=>mission.id),
    ['wharf','keyprofile','pairednodes','museum']);
  for (const mission of CHAPTER_MISSIONS) for(let level=1;level<=3;level++) {
    const puzzle=createWorldPuzzle(mission.id,level,makePuzzleRandom(2026));
    assert.equal(puzzle.view().solved,false);
    assert.equal(typeof puzzle.choose,'function');
    assert.equal(typeof puzzle.confirm,'function');
    assert.equal(typeof puzzle.tick,'function');
  }
  assert.throws(()=>createWorldPuzzle('fake',1),/Unknown/);
  assert.throws(()=>createWorldPuzzle('museum',4),/Invalid/);
});

test('wharf advances in a spatially close hidden order, then requires explicit opening',()=>{
  const puzzle=createWorldPuzzle('wharf',1,()=>0);
  assert.equal(puzzle.view().count,4);
  assert.equal(puzzle.choose(2).mistake,true);
  assert.equal(puzzle.view().step,0);
  assert.equal(puzzle.choose(3).damage,true,'second failed sequence breaks one pick');
  for(let i=0;i<4;i++)assert.equal(puzzle.choose(i).mistake,undefined);
  assert.deepEqual(puzzle.view().opened,[0,1,2,3]);
  assert.equal(puzzle.view().solved,false);
  assert.equal(puzzle.confirm().solved,true);
});

test('keyprofile generates one true key and resets the original timer after a wrong insertion',()=>{
  for(let level=1;level<=3;level++) {
    const puzzle=createWorldPuzzle('keyprofile',level,makePuzzleRandom(level*971));
    const view=puzzle.view();
    assert.equal(view.options.length,[6,8,9][level-1]);
    const matches=view.options.map((pattern,i)=>pattern.every((v,j)=>v===view.target[j])?i:-1)
      .filter(i=>i>=0);
    assert.equal(matches.length,1);
    const wrong=view.options.findIndex((_,i)=>i!==matches[0]);
    puzzle.choose(wrong);puzzle.tick(2);
    assert.equal(puzzle.confirm().damage,true);
    assert.equal(puzzle.view().timeLeft,view.duration);
    puzzle.choose(matches[0]);
    assert.equal(puzzle.confirm().solved,true);
  }
});

test('paired nodes reveal pairs, briefly expose mistakes and solve all matches',()=>{
  const puzzle=createWorldPuzzle('pairednodes',2,makePuzzleRandom(71));
  const nodes=puzzle.view().nodes;
  const first=0,other=nodes.findIndex((symbol,i)=>i>0&&symbol!==nodes[first]);
  puzzle.choose(first);
  assert.equal(puzzle.choose(other).damage,true);
  assert.deepEqual(puzzle.view().pending,[first,other]);
  puzzle.tick(.65);
  assert.deepEqual(puzzle.view().pending,[]);
  for(const symbol of new Set(nodes)) {
    const indices=nodes.flatMap((value,i)=>value===symbol?[i]:[]);
    puzzle.choose(indices[0]);puzzle.choose(indices[1]);
  }
  assert.equal(puzzle.view().matched.length,16);
  assert.equal(puzzle.view().solved,true);
});

test('museum masks some targets, jams harder tumblers and accepts all original glyphs',()=>{
  assert.equal(MUSEUM_SYMBOLS.length,21);
  for(let level=1;level<=3;level++) {
    const puzzle=createWorldPuzzle('museum',level,makePuzzleRandom(level*44));
    const first=puzzle.view();
    assert.equal(first.count,level===1?3:6);
    const covered=first.covered.filter(Boolean).length;
    if(level===1)assert.equal(covered,0);
    else assert.ok(covered>=2&&covered<=3);
    while(!puzzle.view().solved) {
      const view=puzzle.view();
      const choice=view.targets[view.step];
      const result=puzzle.choose(choice);
      assert.equal(result.mistake,undefined);
      if(view.jam[view.step]>1)assert.equal(puzzle.view().step,view.step);
    }
  }
});

test('chapter engine persists progress and awards a mission-level reward once',()=>{
  const values=new Map();
  const storage={getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)};
  const engine=createWorldPuzzleEngine({storage,seed:7});
  let notifications=0;
  engine.subscribe(()=>notifications++);
  engine.start('museum',1);
  while(!engine.getSnapshot().completed){
    const view=engine.getSnapshot().view;
    engine.choose(view.targets[view.step]);
  }
  assert.equal(engine.getSnapshot().reward,100);
  assert.equal(engine.getSnapshot().progress.coins,100);
  assert.equal(engine.getSnapshot().progress.completed['museum-1'],true);
  engine.exit();engine.start('museum',1);
  while(!engine.getSnapshot().completed){
    const view=engine.getSnapshot().view;
    engine.choose(view.targets[view.step]);
  }
  assert.equal(engine.getSnapshot().reward,0);
  assert.equal(engine.getSnapshot().progress.coins,100);
  assert.ok(notifications>=6);
  assert.equal(createWorldPuzzleEngine({storage}).getSnapshot().progress.coins,100);
});

test('chapter run failure and restart never erase already completed missions',()=>{
  const engine=createWorldPuzzleEngine({seed:43,unlimitedTools:false});
  engine.start('museum',1);
  for(let i=0;i<3;i++) {
    const target=engine.getSnapshot().view.targets[0];
    engine.choose((target+1)%MUSEUM_SYMBOLS.length);
  }
  assert.equal(engine.getSnapshot().failed,true);
  assert.equal(engine.getSnapshot().picks,0);
  engine.restart();
  assert.equal(engine.getSnapshot().failed,false);
  assert.equal(engine.getSnapshot().picks,3);
  engine.start('keyprofile',3);
  for(let i=0;i<400;i++)engine.tick(.04);
  assert.equal(engine.getSnapshot().failed,true);
});

test('chapter playtest has endless tools while preserving mistakes and timeouts',()=>{
  const engine=createWorldPuzzleEngine({seed:43});
  engine.start('museum',1);
  assert.equal(engine.getSnapshot().picks,Infinity);
  for(let i=0;i<12;i++){
    const target=engine.getSnapshot().view.targets[0];
    engine.choose((target+1)%MUSEUM_SYMBOLS.length);
  }
  assert.equal(engine.getSnapshot().picks,Infinity);
  assert.equal(engine.getSnapshot().mistakes,12);
  assert.equal(engine.getSnapshot().failed,false);
  engine.start('keyprofile',3);
  for(let i=0;i<400;i++)engine.tick(.04);
  assert.equal(engine.getSnapshot().failed,true,'timers still limit time-based challenges');
});
