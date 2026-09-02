  // Digital puzzle helpers
  function randomFourDigitCode(){
    return Array.from({length:4},()=>rand(0,9));
  }

  function randomCodeAndState(){
    let secret,state;
    do{
      secret=randomFourDigitCode();
      state=randomFourDigitCode();
    }while(state.every((value,index)=>value===secret[index]));
    return {secret,state};
  }

  function resetDigitalRunState(){
    solved=false;
    picks=pickCapacity;
    moves=0;
    brokenPicks=0;
    runReward=100;
    generatedDistance=4;
  }

  function setDigitalResult(element,text='',success=false){
    if(!element)return;
    element.textContent=text;
    element.classList.toggle('success',success);
  }

  function finishDigitalPuzzle(renderFn=null){
    if(solved)return;
    solved=true;
    SFX.open();
    $lock.classList.add('win');
    $mechanism.classList.remove('ready');
    try{renderFn?.();}catch{}
    setTimeout(()=>celebrate(),420);
  }
