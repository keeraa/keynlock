// Free picking simulation: binding order, placement tolerance and the shear line.
export function createFreePickingController({
  state, getPinXs, pinClearances, pinStacks, getPinPuzzle,
  puzzleReady, pinPuzzleAction, setPinFinish, status, updateButtons,
}) {
  const pinCountWord=count=>count>=2&&count<=4?'штифта':'штифтов';

  function resetPicking(){
    const pinXs=getPinXs();
    state.pinSet=Array(pinXs.length).fill(false);state.pinSetCount=0;
    state.pinLifts=Array(pinXs.length).fill(0);state.pickPulse=0;
    state.pinWobble=0;state.pinWobbleIndex=-1;
    state.pinSequence=Array.from({length:pinXs.length},(_,i)=>i)
      .sort((a,b)=>pinClearances[a]-pinClearances[b]);
    setPinFinish(state.pinFinishIndex);
    state.pickX=pinXs[0];state.pickTargetX=state.pickX;
  }
  function nearestPin(x=state.pickX){
    const pinXs=getPinXs();
    let closest=0;
    for(let i=1;i<pinXs.length;i++)if(Math.abs(pinXs[i]-x)<Math.abs(pinXs[closest]-x))closest=i;
    return {index:closest,distance:Math.abs(pinXs[closest]-x)};
  }
  function pinsAtShear(){
    if(state.mode!=='pin')return true;
    const pinXs=getPinXs(),pinPuzzle=getPinPuzzle();
    if(pinPuzzle){
      if(!puzzleReady(pinPuzzle))return false;
      return pinStacks.every(st=>st.i>=pinXs.length||
        Math.abs(st.lift-st.requiredLift)<.014);
    }
    if(!state.insertTarget||state.wrong||state.insertP<.95)return false;
    if(state.picking&&state.pinSetCount!==pinXs.length)return false;
    return pinStacks.every(st=>st.i>=pinXs.length||
      Math.abs(st.lift-st.requiredLift)<.012);
  }
  function attemptPick(){
    if(getPinPuzzle())return pinPuzzleAction();
    if(state.mode!=='pin'||!state.picking||!state.insertTarget||state.insertP<.95){
      status('Сначала вставь отмычку в цилиндр');return false;
    }
    if(state.turnTarget){status('Замок уже открыт');return false;}
    const pinXs=getPinXs();
    const {index,distance}=nearestPin(state.pickTargetX);
    if(distance>.105){
      state.pickPulse=.22;
      status('Отмычка мимо штифта: точнее наведи A/D или ←/→');return false;
    }
    if(state.pinSet[index]){status(`Штифт ${index+1} уже поднят. Переместись к следующему.`);return false;}
    if(index!==state.pinSequence[state.pinSetCount]){
      state.pinWobbleIndex=index;state.pinWobble=1;
      state.pickPulse=.35;
      status(`Штифт ${index+1} не фиксируется: неверная последовательность. Готово ${state.pinSetCount}/${pinXs.length}.`);
      return false;
    }
    state.pinSet[index]=true;
    state.pinSetCount=state.pinSet.filter(Boolean).length;
    state.pickPulse=1;
    status(state.pinSetCount===pinXs.length?`Все ${pinXs.length} ${pinCountWord(pinXs.length)} подняты. Теперь можно открыть замок.`:
      `Штифт ${index+1} поднят (${state.pinSetCount}/${pinXs.length}). Наведи инструмент на другой штифт.`);
    updateButtons();
    return true;
  }
  return {resetPicking,nearestPin,pinsAtShear,attemptPick};
}
