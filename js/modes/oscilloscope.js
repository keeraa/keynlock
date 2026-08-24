  // Oscilloscope
  const scopeFreqs=[1,2,3,5];
  const scopeWeights=[.22,.18,.14,.11];
  const scopePhases=[.1,.7,1.3,2.1];

  function scopeSignal(code){
    const sampleCount=420;
    const signal=[];
    for(let index=0;index<sampleCount;index++){
      const x=index/(sampleCount-1)*Math.PI*2;
      let y=.10*Math.sin(x*.5);
      for(let harmonic=0;harmonic<4;harmonic++){
        const coefficient=(code[harmonic]-4.5)/4.5;
        y+=scopeWeights[harmonic]*coefficient*Math.sin(scopeFreqs[harmonic]*x+scopePhases[harmonic]);
      }
      signal.push(y);
    }
    return signal;
  }

  function scopeScoreValue(reference,current){
    let squaredError=0;
    for(let index=0;index<reference.length;index++){
      const delta=reference[index]-current[index];
      squaredError+=delta*delta;
    }
    const rms=Math.sqrt(squaredError/reference.length);
    return Math.max(0,Math.min(100,100-rms*180));
  }

  function drawScope(){
    if(!$scopeCanvas)return;
    const context=$scopeCanvas.getContext('2d');
    const width=$scopeCanvas.width;
    const height=$scopeCanvas.height;

    context.clearRect(0,0,width,height);
    context.fillStyle='#08090a';
    context.fillRect(0,0,width,height);
    context.strokeStyle='rgba(220,201,170,.055)';
    context.lineWidth=1;

    for(let row=0;row<7;row++){
      const y=20+row*(height-40)/6;
      context.beginPath();
      context.moveTo(18,y);
      context.lineTo(width-18,y);
      context.stroke();
    }
    for(let column=0;column<10;column++){
      const x=18+column*(width-36)/9;
      context.beginPath();
      context.moveTo(x,16);
      context.lineTo(x,height-16);
      context.stroke();
    }

    const plot=(signal,color,lineWidth)=>{
      context.beginPath();
      signal.forEach((value,index)=>{
        const x=18+index*(width-36)/(signal.length-1);
        const y=height/2-value*height*.70;
        index?context.lineTo(x,y):context.moveTo(x,y);
      });
      context.strokeStyle=color;
      context.lineWidth=lineWidth;
      context.shadowBlur=7;
      context.shadowColor=color;
      context.stroke();
      context.shadowBlur=0;
    };

    const reference=scopeSignal(scopeSecret);
    const current=scopeSignal(scopeState);
    plot(reference,'#748d9f',2.4);
    plot(current,'#d2a75f',2.6);

    const score=scopeScoreValue(reference,current);
    if($scopeScore)$scopeScore.textContent=score.toFixed(1)+'%';
    if($scopeBar)$scopeBar.style.width=score+'%';
  }

  function renderScope(){
    if($scopeWheels){
      $scopeWheels.innerHTML=scopeState.map((value,index)=>`
        <div class="digitalWheel">
          <button data-scope-i="${index}" data-dir="1" type="button">▲</button>
          <div class="digitalWheelValue">${value}</div>
          <button data-scope-i="${index}" data-dir="-1" type="button">▼</button>
        </div>
      `).join('');
    }
    drawScope();
  }

  function startScopeRound(){
    resetDigitalRunState();
    ({secret:scopeSecret,state:scopeState}=randomCodeAndState());
    setDigitalResult($scopeResult);
    renderScope();
    updateEconomyUI();
  }

  function changeScope(index,direction){
    if(solved)return;
    scopeState[index]=(scopeState[index]+direction+10)%10;
    registerMove();
    SFX.select();
    renderScope();
    setDigitalResult($scopeResult);
  }

  function checkScope(){
    if(solved)return;
    const exact=scopeState.every((value,index)=>value===scopeSecret[index]);
    if(exact){
      setDigitalResult($scopeResult,'Код найден. Сигналы совпали на 100%.',true);
      finishDigitalPuzzle(renderScope);
      return;
    }
    setDigitalResult($scopeResult,'Сигналы ещё различаются.');
    SFX.wrongLock();
  }

