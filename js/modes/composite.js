(function(){
  // ===== COMPOSITE PICK — CONTINUOUS BUILDER =====
  const CP_LEVEL_NAMES=['ВЕРХ','ВЫШЕ','НИЖЕ','НИЗ'];
  let cpNodes=[1,1,1,1], cpTarget=[1,1,1,1], cpVals=[1,1,1,1], cpInitial=[1,1,1,1], cpSelected=-1, cpReady=false;
  const CP_XS=[0,160,320,480,640];
  const CP_PIN_COUNT=4;
  const CP_LEVEL_Y=[10,20,30,40];
  function cpY(level){ return CP_LEVEL_Y[level] ?? CP_LEVEL_Y[1]; }
  function cpSvgY(level){ return cpY(level) + 12; }
  function cpMiniY(level){
    const y=cpY(level);
    return 6+((y-CP_LEVEL_Y[0])/(CP_LEVEL_Y.at(-1)-CP_LEVEL_Y[0]))*17;
  }

  function cpPathD(nodes){
    let d=`M 0 ${cpSvgY(nodes[0])}`;
    nodes.forEach((level,i)=>{
      const right=CP_XS[i+1];
      d+=` L ${right} ${cpSvgY(level)}`;
      if(i<nodes.length-1) d+=` L ${right} ${cpSvgY(nodes[i+1])}`;
    });
    return d;
  }

  function cpProfileD(nodes){
    const bottomY=74;
    let d=`M 0 ${bottomY} L 0 ${cpSvgY(nodes[0])}`;
    nodes.forEach((level,i)=>{
      const right=CP_XS[i+1];
      d+=` L ${right} ${cpSvgY(level)}`;
      if(i<nodes.length-1) d+=` L ${right} ${cpSvgY(nodes[i+1])}`;
    });
    d+=` L 640 ${bottomY} L 0 ${bottomY} Z`;
    return d;
  }

  function cpBuiltNodes(vals=cpVals){
    return [...vals];
  }

  function cpMatchesTarget(vals=cpVals){
    return vals.length===4 && vals.every((level,i)=>level===cpTarget[i]);
  }

  function cpSamplePoints(nodes,count=CP_PIN_COUNT){
    return nodes.slice(0,count).map((level,i)=>({
      x:(CP_XS[i]+CP_XS[i+1])/2,
      y:cpSvgY(level)
    }));
  }

  function cpSetPath($el,d){
    if($el) $el.setAttribute('d',d);
  }

  function cpApplyProfile({shadow,fill,topLine,bevel,path,glow},nodes){
    const profileD=cpProfileD(nodes);
    const lineD=cpPathD(nodes);
    cpSetPath(shadow,profileD);
    cpSetPath(fill,profileD);
    cpSetPath(topLine,lineD);
    cpSetPath(bevel,lineD);
    cpSetPath(path,lineD);
    cpSetPath(glow,lineD);
  }

  function cpPartPreviewSvg(index,nodes){
    const y=cpMiniY(nodes[index]);
    const gradId=`cpMiniMetal${index}`;
    const path=`M 6 26 L 6 ${y} L 104 ${y} L 110 26 Z`;
    const line=`M 6 ${y} L 104 ${y}`;
    return `
      <svg viewBox="0 0 116 32" aria-hidden="true">
        <defs>
          <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#ffe3a2"></stop>
            <stop offset="0.42" stop-color="#e3bd69"></stop>
            <stop offset="1" stop-color="#895821"></stop>
          </linearGradient>
        </defs>
        <path d="${path}" fill="rgba(0,0,0,.28)" transform="translate(0,2)"></path>
        <path d="${path}" fill="url(#${gradId})" stroke="rgba(92,60,24,.55)" stroke-width="1"></path>
        <path d="${line}" stroke="rgba(255,245,213,.42)" stroke-width="1.15" fill="none" stroke-linecap="round"></path>
      </svg>`;
  }

  function cpRenderPinRail($rail,nodes){
    if(!$rail) return;
    const points=cpSamplePoints(nodes);
    const pinSkin=currentPinSkin();
    const frag=document.createDocumentFragment();
    points.forEach((pt,i)=>{
      const pin=document.createElement('div');
      pin.className=`cpPin cpPinSegment${i+1}`;
      pin.style.left=`${(pt.x/640)*100}%`;
      pin.style.setProperty('--cp-pin-top', `${Math.round(pt.y - 36)}px`);

      const img=document.createElement('img');
      img.className='cpPinImg';
      img.src=pinSkin;
      img.alt='';
      pin.appendChild(img);
      frag.appendChild(pin);
    });
    $rail.replaceChildren(frag);
  }

  function cpRenderJoints(nodes){
    if(!$cpBuildJoints) return;
    $cpBuildJoints.innerHTML='';
    const svgBox=$cpBuildPath?.ownerSVGElement?.getBoundingClientRect();
    const canvasBox=$cpBuildJoints.getBoundingClientRect();
    if(!svgBox || !canvasBox.width) return;

    nodes.forEach((level,i)=>{
      const dot=document.createElement('div');
      dot.className='cpJoint'+(i===cpSelected&&!cpReady?' selected':'');
      const px=(((CP_XS[i]+CP_XS[i+1])/2)/640)*svgBox.width + (svgBox.left-canvasBox.left);
      const py=(cpSvgY(level)/90)*svgBox.height + (svgBox.top-canvasBox.top);
      dot.style.left=`${px}px`;
      dot.style.top=`${py}px`;
      $cpBuildJoints.appendChild(dot);
    });
  }

  function setCompositeLevel(i,level){
    if(solved||cpReady) return;
    level=clamp(level,0,CP_LEVEL_NAMES.length-1);
    cpSelected=i;
    if(cpVals[i]===level){
      renderComposite();
      return;
    }
    cpVals[i]=level;
    registerMove();
    SFX.select();
    renderComposite();
    if(cpReady) SFX.ready();
  }

  function renderComposite(){
    if(!$cpParts) return;

    cpRenderPinRail($cpPins, cpNodes);
    cpApplyProfile({
      shadow:$cpTargetShadow,
      fill:$cpTargetFill,
      topLine:$cpTargetTopLine,
      bevel:$cpTargetBevel,
      path:$cpTargetPath,
      glow:$cpTargetGlow
    },cpNodes);

    const builtNodes=cpBuiltNodes();
    cpRenderPinRail($cpBuildPins, builtNodes);
    cpApplyProfile({
      shadow:$cpBuildShadow,
      fill:$cpBuildFill,
      topLine:$cpBuildTopLine,
      bevel:$cpBuildBevel,
      path:$cpBuildPath,
      glow:$cpBuildGlow
    },builtNodes);

    $cpParts.innerHTML='';
    $cpParts.classList.add('has-selection');

    cpVals.forEach((level,i)=>{
      const wrap=document.createElement('div');
      wrap.className='cpPart'+(i===cpSelected&&!cpReady?' selected':'');
      wrap.setAttribute('role','group');
      wrap.setAttribute('aria-label',`Сегмент ${i+1}`);

      wrap.innerHTML=`
        <div class="cpPartPreview">${cpPartPreviewSvg(i,builtNodes)}</div>
      `;
      wrap.setAttribute('aria-label',`Сегмент ${i+1}: ${CP_LEVEL_NAMES[level].toLowerCase()}. Нажми, чтобы изменить высоту`);

      wrap.addEventListener('click',()=>{
        if(solved||cpReady) return;
        if(cpSelected!==i){
          cpSelected=i;
          SFX.select();
          renderComposite();
          return;
        }
        setCompositeLevel(i,(level+1)%CP_LEVEL_NAMES.length);
      });

      $cpParts.appendChild(wrap);
    });

    cpReady=cpMatchesTarget();
    $cpState.classList.remove('ready');

    $cpState.textContent='';

    requestAnimationFrame(()=>cpRenderJoints(builtNodes));
  }

  function startCompositeRound(){
    solved=false;
    picks=pickCapacity;
    moves=0;
    brokenPicks=0;
    runReward=1000;

    cpNodes=[rand(0,CP_LEVEL_NAMES.length-1)];
    for(let i=1;i<4;i++){
      const prev=cpNodes[i-1];
      const options=[prev-1,prev,prev+1].filter(v=>v>=0&&v<CP_LEVEL_NAMES.length);
      cpNodes.push(options[rand(0,options.length-1)]);
    }
    cpTarget=[...cpNodes];

    const minDistance=diffStep(2,4,6,'composite');
    do{ cpVals=Array.from({length:4},()=>rand(0,CP_LEVEL_NAMES.length-1)); }
    while(cpMatchesTarget(cpVals) || cpVals.reduce((sum,v,i)=>sum+Math.abs(v-cpTarget[i]),0) < minDistance);

    cpInitial=[...cpVals];
    cpSelected=-1;
    cpReady=false;
    generatedDistance=cpVals.reduce((sum,v,i)=>sum+Math.abs(v-cpTarget[i]),0);
    updateEconomyUI();
    renderComposite();
  }

  function moveCompositeSelection(dir){
    if(solved||cpReady) return;
    const next=cpSelected<0 ? (dir<0?3:0) : clamp(cpSelected+dir,0,3);
    if(next===cpSelected){
      SFX.blocked();
      return;
    }
    cpSelected=next;
    SFX.select();
    renderComposite();
  }

  function changeCompositeShape(i,delta){
    if(solved||cpReady) return;
    if(i<0){
      cpSelected=0;
      SFX.select();
      renderComposite();
      return;
    }
    const next=clamp(cpVals[i]+delta,0,CP_LEVEL_NAMES.length-1);
    if(next===cpVals[i]){
      SFX.blocked();
      return;
    }
    setCompositeLevel(i,next);
  }

  function tryOpenComposite(){
    if(solved) return;
    cpReady=cpMatchesTarget();

    if(!cpReady){
      SFX.wrongLock();
      damagePick({
        resetProgress:()=>{
          cpVals=[...cpInitial];
          cpSelected=-1;
          cpReady=false;
        },
        renderState:renderComposite,
        surviveText:'Профиль отмычки не подходит'
      });
      return;
    }

    solved=true;
    SFX.open();
    renderComposite();
    setTimeout(()=>celebrate(),420);
  }

  PuzzleModes.register({
    id:'composite',
    start:startCompositeRound,
    render:renderComposite,
    resize:()=>{
      cpRenderPinRail($cpPins,cpNodes);
      cpRenderPinRail($cpBuildPins,cpBuiltNodes());
      cpRenderJoints(cpBuiltNodes());
    },
    objective:()=>GameCatalog.get('composite')?.objective,
    restartMessage:'Новая составная отмычка',
    input:{
      horizontal:dir=>changeCompositeShape(cpSelected,dir),
      vertical:moveCompositeSelection
    },
    attemptOpen:tryOpenComposite
  });
})();
