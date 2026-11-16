import { CHAPTER_MISSIONS, createWorldPuzzle, makePuzzleRandom } from './rules.js';
import {UNLIMITED_TOOLS_FOR_TESTING,startingToolCount,spendTool} from '../tool-supply.js';

const SAVE_KEY = 'keynlock.chapter-one.v1';
const DEFAULT_SAVE = () => ({ completed: {}, coins: 0 });
const ids = new Set(CHAPTER_MISSIONS.map(mission => mission.id));

function loadProgress(storage) {
  try {
    const parsed = JSON.parse(storage?.getItem(SAVE_KEY) || 'null');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return DEFAULT_SAVE();
    const completed = {};
    for (const [key, value] of Object.entries(parsed.completed || {})) {
      const [id, tier] = key.split('-');
      if (ids.has(id) && /^[123]$/.test(tier) && value === true) completed[key] = true;
    }
    return {completed, coins: Number.isFinite(parsed.coins) ? Math.max(0, Math.floor(parsed.coins)) : 0};
  } catch { return DEFAULT_SAVE(); }
}

/** Universal, headless lifecycle: a renderer may subscribe without owning game rules. */
export function createWorldPuzzleEngine({storage=null, seed=0x6b65796e,
  unlimitedTools=UNLIMITED_TOOLS_FOR_TESTING}={}) {
  const progress = loadProgress(storage);
  const listeners = new Set();
  let session = null, serial = 0, runId = 0, previousSecond = -1;
  const emit = () => { const snapshot = getSnapshot(); for (const listener of listeners) listener(snapshot); };
  const persist = () => { try { storage?.setItem(SAVE_KEY, JSON.stringify(progress)); } catch { /* private mode */ } };

  function getSnapshot() {
    if (!session) return {active:false,progress:{completed:{...progress.completed},coins:progress.coins},missions:CHAPTER_MISSIONS};
    const view=session.model.view();
    return {active:true,serial,runId,id:session.id,level:session.level,
      mission:CHAPTER_MISSIONS.find(mission=>mission.id===session.id),
      view,picks:session.picks,moves:session.moves,mistakes:session.mistakes,
      completed:session.completed,failed:session.failed,feedback:session.feedback,
      reward:session.reward,progress:{completed:{...progress.completed},coins:progress.coins},
      missions:CHAPTER_MISSIONS};
  }
  function start(id,level=1) {
    if (!ids.has(id)) throw new Error(`Unknown mission: ${id}`);
    runId++;
    const random = makePuzzleRandom(seed ^ (Math.imul(runId,0x9e3779b9)>>>0) ^ (level<<8));
    session = {id,level,model:createWorldPuzzle(id,level,random),
      picks:startingToolCount(unlimitedTools),moves:0,
      mistakes:0,completed:false,failed:false,reward:0,feedback:'Исследуй механизм и найди решение.'};
    serial++;
    previousSecond=-1;
    emit();
    return getSnapshot();
  }
  function exit() { session=null; emit(); }
  function restart() { if (session) start(session.id,session.level); }
  function apply(outcome) {
    if (!session || !outcome?.changed) return false;
    if (outcome.mistake) session.mistakes++;
    if (outcome.damage) session.picks=spendTool(session.picks);
    session.moves++;
    session.feedback=outcome.message || '';
    if (outcome.solved) {
      session.completed=true;
      const key=`${session.id}-${session.level}`;
      const fresh=!progress.completed[key];
      session.reward=fresh?Math.max(40,100-session.mistakes*12):0;
      progress.completed[key]=true;
      if (fresh) progress.coins+=session.reward;
      persist();
    } else if (session.picks===0 || session.model.view().timeLeft===0) {
      session.failed=true;
      session.feedback=session.picks===0?'Отмычки закончились. Повтори попытку.':'Время вышло. Повтори попытку.';
    }
    emit();
    return true;
  }
  function choose(index) {
    if (!session || session.completed || session.failed || !Number.isInteger(index)) return false;
    return apply(session.model.choose(index));
  }
  function confirm() {
    if (!session || session.completed || session.failed) return false;
    return apply(session.model.confirm());
  }
  function tick(dt) {
    if (!session || session.completed || session.failed) return;
    const before=session.model.view();
    const expired=session.model.tick(Math.min(.05,Math.max(0,dt)));
    if (expired) {session.failed=true;session.feedback='Время вышло. Повтори попытку.';emit();return;}
    const after=session.model.view(),second=Math.ceil(after.timeLeft??0);
    if (second!==previousSecond||(before.pending?.length&&!after.pending?.length)) {
      previousSecond=second;emit();
    }
  }
  return {getSnapshot,start,exit,restart,choose,confirm,tick,
    subscribe(listener) { listeners.add(listener);return()=>listeners.delete(listener); }};
}
