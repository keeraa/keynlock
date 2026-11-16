import {createPinPuzzleTicker} from './pin-ticker.js';
import {resetLockMotion} from './lock-state-transitions.js';
import {replaceKeyProfile} from '../geometry/key-profile.js';
import {UNLIMITED_TOOLS_FOR_TESTING,startingToolCount,spendTool} from './tool-supply.js';

// Game-state transitions for all eight pin puzzles; no scene geometry is created here.
export function createPinPuzzleController({
  THREE, $, document, performance, state, modeDetails, pinPuzzleModes,
  getPuzzle, setPuzzle, getPinXs, setPinCount, pinKey, pickRig, tensionRig,
  makeKeyProfile, restoreShackle, resetPicking, status, rand,
  pinPuzzleSymbols, puzzleRandom, puzzleLinkedStep, puzzleGenerate,
  puzzleReady, puzzleActiveIndex, renderPuzzle, updateControls,
  setMode, attemptShackleOpen, unlimitedTools=UNLIMITED_TOOLS_FOR_TESTING,
}) {
  const puzzleState = {
    get current() { return getPuzzle(); },
    set current(value) { setPuzzle(value); },
  };
  function startPinPuzzle(type='free',level=1){
    if(state.mode!=='pin'){setMode('pin');return;}
    if(type!=='free'&&!pinPuzzleModes[type])type='free';
    level=THREE.MathUtils.clamp(Math.round(Number(level)||1),1,3);
    puzzleState.current=null;
    // Difficulty owns the chamber count, including the free-study setup.
    setPinCount(type==='free'?[4,5,6][level-1]:pinPuzzleModes[type].counts[level-1]);
    resetLockMotion(state);
    state.insertTarget=type==='free'?0:1;
    state.picking=type!=='free';
    restoreShackle();resetPicking();
    pinKey.rig.visible=!state.picking;pickRig.visible=state.picking;
    tensionRig.visible=state.picking;
    replaceKeyProfile(pinKey,makeKeyProfile);
    if(type!=='free'){
      const g={type,level,count:getPinXs().length,picks:startingToolCount(unlimitedTools),failures:0,score:100,
        moves:0,over:false,completed:false,feedback:'Выбери штифт и начни.',error:false};
      puzzleGenerate(g);puzzleState.current=g;
      state.pickTargetX=getPinXs()[puzzleActiveIndex(g)];
    }
    document.querySelectorAll('#pinPuzzleLevels button').forEach(button=>{
      const active=Number(button.dataset.level)===level;
      button.classList.toggle('active',active);
      button.setAttribute('aria-pressed',String(active));
    });
    $('pinPuzzleSelect').value=type;
    $('pinGamesSection').classList.toggle('playing',Boolean(puzzleState.current));
    $('modeDescription').textContent=puzzleState.current?pinPuzzleModes[type].rule:modeDetails.pin.description;
    $('lockFootnote').textContent=puzzleState.current?
      'A/D или ←/→ — соседний штифт · W/S или ↑/↓ — по механике · Пробел — действие · Enter — открыть · R/N — заново.':
      'Клик по дужке или пробел — попытка открыть замок. ЛКМ — вращение · ПКМ — сдвиг · Колесо — масштаб.';
    status(puzzleState.current?`Начато: ${pinPuzzleModes[type].name}. Уровень ${level}.`:'Свободное изучение штифтового цилиндра.');
    renderPuzzle(true);updateControls();
  }
  function puzzleMovePenalty(g){
    const now=performance.now();
    // Continuous mouse dragging counts as steps, not hundreds of DOM events.
    if(now-(g.lastScoredMove||0)<105)return;
    g.lastScoredMove=now;g.moves++;
    g.score=Math.max(10,g.score-5);
  }
  function puzzleNotice(message,error=false){
    if(!puzzleState.current)return;
    puzzleState.current.feedback=message;puzzleState.current.error=error;
    state.pickTargetX=getPinXs()[puzzleActiveIndex(puzzleState.current)];
    status(message);renderPuzzle();updateControls();
  }
  function puzzleDamage(message,reason='miss'){
    const g=puzzleState.current;
    if(!g||g.over||g.completed)return;
    const finiteInventory=Number.isFinite(g.picks);
    g.picks=spendTool(g.picks);g.failures++;
    if(['classic','sequence','special'].includes(g.type)){
      g.values=g.initial.slice();
    }else if(g.type==='tension'){
      g.fixed.fill(false);g.value=Math.max(0,g.value-16);
    }else if(g.type==='resonance'){
      g.fixed.fill(false);g.score=Math.max(0,g.score-20);
    }else if(g.type==='pinflight'){
      const i=g.selected;
      g.phases[i].phase='idle';g.phases[i].time=0;g.motion[i]=0;
      const alreadySet=g.fixed.map((set,j)=>set?j:-1).filter(j=>j>=0);
      if(alreadySet.length){
        const lost=alreadySet[Math.floor(rand()*alreadySet.length)];
        g.fixed[lost]=false;g.motion[lost]=0;
        g.phases[lost].phase='idle';g.phases[lost].time=0;
      }
    }else if(g.type==='springtumblers'){
      if(reason==='timeout'&&g.picks>0)puzzleGenerate(g);
      else g.values=g.values.map((value,i)=>g.fixed[i]?value:
        Math.max(0,value-(i===g.selected?27:12)));
    }else if(g.type==='symbolpins'){
      if(reason==='symbol')g.timeLeft=Math.max(0,g.timeLeft-1);
      if(reason==='height')g.timeLeft=Math.max(0,g.timeLeft-1.25);
    }
    if(g.picks===0)g.over=true;
    puzzleNotice(`${message} · ${finiteInventory?'−1 отмычка':'запас инструментов ∞'}${g.over?' · Инструменты закончились, нажми «Сброс».':''}`,true);
  }
  function puzzleSelectPin(index,press=false){
    const g=puzzleState.current;
    if(!g||g.over||g.completed)return;
    g.selected=THREE.MathUtils.clamp(index,0,g.count-1);
    state.pickTargetX=getPinXs()[g.selected];
    if(press&&g.type==='pinflight')pinPuzzleAction();
    else renderPuzzle();
  }
  function selectNextUnfixed(g,index){
    const next=g.fixed.findIndex((done,i)=>i>index&&!done);
    g.selected=next>=0?next:g.fixed.findIndex(done=>!done);
    if(g.selected<0)g.selected=index;
  }
  function puzzleUnfixFrom(g,index){
    if(!g.fixed[index])return;
    const place=g.order.indexOf(index);
    for(let j=place;j<g.order.length;j++)g.fixed[g.order[j]]=false;
  }
  function puzzleAdjust(direction){
    const g=puzzleState.current;
    if(!g||g.over||g.completed||g.expired||!direction)return;
    const index=puzzleActiveIndex(g);
    if(['classic','sequence','special'].includes(g.type)){
      const valid=g.type==='sequence'?g.values[index]+direction>=1&&g.values[index]+direction<=7:
        puzzleLinkedStep(g,index,direction);
      if(!valid){puzzleDamage('Штифт упёрся в край хода','limit');return;}
      if(g.type==='sequence')g.values[index]+=direction;
      puzzleMovePenalty(g);
      puzzleNotice(puzzleReady(g)?'Все штифты выставлены. Теперь открой замок.':
        `Штифт ${index+1}: позиция ${g.values[index]}`);
    }else if(g.type==='tension'){
      g.value=THREE.MathUtils.clamp(g.value+direction*3,0,100);
      puzzleMovePenalty(g);renderPuzzle();
    }else if(g.type==='springtumblers'){
      if(g.fixed[index]){puzzleNotice('Этот тумблер уже закреплён.');return;}
      const shift=direction*3.5*(g.inverted[index]?-1:1);
      const changes=new Map([[index,shift]]);
      if(index>0&&!g.fixed[index-1])changes.set(index-1,shift*.38);
      if(index<g.count-1&&!g.fixed[index+1])changes.set(index+1,shift*.38);
      if([...changes].some(([i,d])=>g.values[i]+d<=0||g.values[i]+d>=100)){
        puzzleDamage('Тумблер дошёл до упора','limit');return;
      }
      for(const [i,d] of changes)g.values[i]+=d;
      puzzleMovePenalty(g);renderPuzzle();
    }else if(g.type==='symbolpins'){
      puzzleUnfixFrom(g,index);
      g.values[index]=THREE.MathUtils.clamp(g.values[index]+direction*3,0,100);
      puzzleMovePenalty(g);renderPuzzle();
    }
  }
  function puzzleSetSlider(value){
    const g=puzzleState.current;
    if(!g||g.over||g.completed||g.expired)return;
    const index=puzzleActiveIndex(g);
    if(g.type==='tension'){
      g.value=THREE.MathUtils.clamp(value,0,100);puzzleMovePenalty(g);
    }else if(['classic','sequence','special'].includes(g.type)){
      const goal=THREE.MathUtils.clamp(Math.round(value),1,7);
      for(let n=0;n<7&&g.values[index]!==goal;n++){
        if(g.over)break;
        const failuresBefore=g.failures;
        puzzleAdjust(Math.sign(goal-g.values[index]));
        if(g.failures!==failuresBefore)break;
      }
    }else if(g.type==='symbolpins'){
      puzzleUnfixFrom(g,index);
      g.values[index]=THREE.MathUtils.clamp(value,0,100);
      puzzleMovePenalty(g);
    }
    renderPuzzle();
  }
  function puzzleComplete(){
    const g=puzzleState.current;
    if(!g||g.completed||!puzzleReady(g))return false;
    g.completed=true;
    if(g.failures===0)g.score+=25;
    state.turnTarget=1;state.unlockTarget=1;
    puzzleNotice(`Замок открыт · ${g.score} очков${g.failures===0?' · +25 без поломок':''}`);
    return true;
  }
  function pinPuzzleAction(){
    const g=puzzleState.current;
    if(!g||g.over||g.completed||g.expired)return false;
    if(!state.insertTarget||state.insertP<.90){puzzleNotice('Подожди, пока отмычка войдёт в скважину.');return false;}
    if(puzzleReady(g)){attemptShackleOpen();return true;}
    const index=puzzleActiveIndex(g);
    if(['classic','sequence','special'].includes(g.type)){
      attemptShackleOpen();return puzzleReady(g);
    }
    if(g.type==='tension'){
      if(g.fixed[index]){puzzleNotice(`Штифт ${index+1} уже зафиксирован.`);return false;}
      if(Math.abs(g.needle-g.bandCenter)>g.bandWidth*.5){
        puzzleDamage('Натяжение вышло за рабочую полосу');return false;
      }
      g.fixed[index]=true;
      g.bandWidth=[puzzleRandom(18,28),puzzleRandom(12,20),puzzleRandom(9,15)][g.level-1];
      g.bandCenter=puzzleRandom(22,78);
      selectNextUnfixed(g,index);
      puzzleNotice(puzzleReady(g)?'Все штифты зафиксированы. Открой дужку.':
        `Штифт ${index+1} зафиксирован. Рабочая полоса сменилась.`);
      return true;
    }
    if(g.type==='resonance'){
      if(g.fixed[index]){puzzleNotice(`Штифт ${index+1} уже зафиксирован.`);return false;}
      if(Math.abs(g.needle-50)>g.tolerance){
        puzzleDamage('Штифт остановлен за пределами линии');return false;
      }
      g.fixed[index]=true;
      selectNextUnfixed(g,index);
      puzzleNotice(puzzleReady(g)?'Все штифты на линии. Открой замок.':
        `Штифт ${index+1} остановлен точно на линии.`);
      return true;
    }
    if(g.type==='pinflight'){
      if(g.fixed[index]){puzzleNotice(`Штифт ${index+1} уже пойман.`);return false;}
      const flight=g.phases[index];
      if(flight.phase==='idle'){
        flight.phase='up';flight.time=0;
        puzzleMovePenalty(g);puzzleNotice(`Штифт ${index+1} подброшен. Лови в верхней точке!`);
        return true;
      }
      if(flight.phase!=='apex'){
        puzzleDamage('Рано или поздно: штифт ещё движется');return false;
      }
      g.fixed[index]=true;g.motion[index]=1;
      flight.phase='fixed';flight.time=0;
      if(puzzleReady(g))puzzleComplete();
      else puzzleNotice(`Штифт ${index+1} пойман! Готово ${g.fixed.filter(Boolean).length}/${g.count}.`);
      return true;
    }
    if(g.type==='springtumblers'){
      if(g.fixed[index]){puzzleNotice('Тумблер уже закреплён.');return false;}
      if(Math.abs(g.values[index]-g.targets[index])>3.8){
        puzzleDamage('Тумблер не совпал с посадочным уровнем');return false;
      }
      g.fixed[index]=true;
      puzzleNotice(puzzleReady(g)?'Все тумблеры закреплены. Открой дужку.':
        `Тумблер ${index+1} зафиксирован. Соседи ещё подвижны.`);
      return true;
    }
    if(g.type==='symbolpins'){
      const expected=g.order[g.fixed.filter(Boolean).length];
      if(expected!==index){
        puzzleDamage(`Очередь символа ${pinPuzzleSymbols[expected]}`,'symbol');return false;
      }
      if(Math.abs(g.values[index]-g.targets[index])>1.5){
        puzzleDamage('Прорезь не совпала с лучом','height');return false;
      }
      g.fixed[index]=true;
      puzzleNotice(puzzleReady(g)?'Все прорези совпали. Открой дужку.':
        `Символ ${pinPuzzleSymbols[index]} закреплён. Следующий: ${pinPuzzleSymbols[g.order[g.fixed.filter(Boolean).length]]}.`);
      return true;
    }
    return false;
  }
  const tickPinPuzzle=createPinPuzzleTicker({THREE,state,getPuzzle:()=>puzzleState.current,
    puzzleReady,puzzleDamage,puzzleNotice});
  return { startPinPuzzle, puzzleSelectPin, puzzleAdjust,
    puzzleSetSlider, puzzleComplete, pinPuzzleAction, tickPinPuzzle,
    puzzleNotice, puzzleDamage };
}
