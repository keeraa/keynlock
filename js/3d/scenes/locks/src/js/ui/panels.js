import {formatToolCount} from '../gameplay/tool-supply.js';
// The pin puzzle is played on the 3D mechanism; the sidebar only reports its rules and progress.
export function createLockPanelUI({ $, state, getPuzzle, getPinXs,
    pinPuzzleModes, pinPuzzleSymbols, puzzleActiveIndex, puzzleReady, shackleBody }) {
  function renderPinPuzzleUI(){
    const g=getPuzzle();
    $('pinGamesSection').classList.toggle('playing',Boolean(g));
    if(!g){
      $('pinPuzzleFeedback').classList.remove('visible');
      $('pinPuzzleFeedback').textContent='';
      return;
    }
    const current=puzzleActiveIndex(g);
    const completed=g.fixed.filter(Boolean).length;
    const progress=['classic','sequence','special'].includes(g.type)?
      g.values.filter((v,i)=>v===g.targets[i]).length:completed;
    let detail='';
    if(g.type==='classic')detail=` Целевая позиция: ${g.targets[0]}.`;
    if(g.type==='sequence')detail=` Код: ${g.targets.join(' · ')}.`;
    if(g.type==='special')detail=` Связь: ${{chain:'цепь',mirror:'зеркало',wave:'волна'}[g.linkType]}.`;
    if(g.type==='springtumblers')detail=' Инвертированные тумблеры отмечены ↕.';
    if(g.type==='symbolpins')detail=` Порядок: ${g.order.map(i=>pinPuzzleSymbols[i]).join(' → ')}.`;
    $('pinPuzzleRule').textContent=pinPuzzleModes[g.type].rule+detail;
    const seconds=g.timeLeft>0||g.expired?` · ${g.timeLeft.toFixed(1)} с`:'';
    const indicator=g.type==='tension'?` · Усилие ${Math.round(g.value)}%`:
      g.type==='pinflight'?` · Штифт ${current+1} ${g.phases[current].phase}`:
      ` · Штифт ${current+1}`;
    $('pinPuzzleStats').textContent=`${progress}/${g.count} · ${formatToolCount(g.picks)} отмычек · ${g.score} очк.${indicator}${seconds}`;
    const toast=$('pinPuzzleFeedback');
    if(toast.textContent!==g.feedback){
      toast.textContent=g.feedback;
      toast.classList.toggle('error',g.error);
      toast.classList.remove('visible');
      // Restart only for a new message; frequent puzzle-frame updates must not keep it on screen.
      void toast.offsetWidth;
      toast.classList.add('visible');
    }
  }
  function updateButtons(){
    const game=state.mode==='pin'?getPuzzle():null;
    const name=state.picking?'отмычку':'ключ';
    $('insertButton').textContent=state.mode==='code'?(state.insertTarget?'Сбросить код':'Набрать код'):(state.insertTarget?`Извлечь ${name}`:`Вставить ${name}`);
    $('turnButton').textContent=shackleBody.released?'Сбросить':game?.completed?'Открывается…':state.turnTarget?'Закрыть':'Открыть';
    $('turnButton').disabled=!shackleBody.released&&(
      (game?.completed||game?.over)||!state.insertTarget||state.insertP<.96||
      (!game&&state.mode==='pin'&&state.picking&&state.pinSetCount<getPinXs().length));
    $('wrongButton').textContent=state.wrong?'✓ Неверный ключ':'Неверный ключ';
    $('wrongButton').disabled=state.mode!=='pin'||state.picking||Boolean(game);
    $('toolButton').disabled=state.mode!=='pin'||Boolean(game);
    $('toolButton').textContent=state.picking?'Инструмент: отмычка':'Инструмент: ключ';
    const actions={classic:'Проверить · пробел',sequence:'Проверить · пробел',
      special:'Проверить · пробел',tension:'Фиксировать · пробел',
      resonance:'Остановить · пробел',pinflight:'Подбросить / поймать',
      springtumblers:'Фиксировать · пробел',symbolpins:'Фиксировать · пробел'};
    $('pickButton').textContent=game?actions[game.type]:state.picking?'Поднять · W / ↑':'Поднять штифт';
    $('pickButton').disabled=game?(game.over||game.completed||game.expired||!state.insertTarget||state.insertP<.90):
      (!state.picking||!state.insertTarget||state.insertP<.95||state.pinSetCount>=getPinXs().length);
    $('insertButton').disabled=state.mode==='code'&&state.insertTarget&&state.turnTarget;
  }
  return { renderPinPuzzleUI, updateButtons };
}
