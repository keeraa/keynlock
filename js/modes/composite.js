  // ===== COMPOSITE PICK — CONTINUOUS BUILDER =====
  const CP_XS=[0,160,320,480,640];
  const CP_PIN_COUNT=5;
  function cpY(level){ return [14,24,34][level] ?? 24; }
  function cpSvgY(level){ return cpY(level) + 12; }
  function cpMiniY(level){ return [8,13,18][level] ?? 13; }

  function cpPathD(nodes){
    return nodes.map((level,i)=>`${i?'L':'M'} ${CP_XS[i]} ${cpSvgY(level)}`).join(' ');
  }

  function cpProfileD(nodes){
    const bottomY=74;
    let d=`M 0 ${bottomY} L 0 ${cpSvgY(nodes[0])}`;
    for(let i=1;i<nodes.length;i++) d+=` L ${CP_XS[i]} ${cpSvgY(nodes[i])}`;
    d+=` L 632 ${bottomY} L 0 ${bottomY} Z`;
    return d;
  }

  function cpBuiltNodes(vals=cpVals){
    return [cpNodes[0], ...vals];
  }

  function cpMatchesTarget(vals=cpVals){
    return vals.length===4 && vals.every((level,i)=>level===cpTarget[i]);
  }

  function cpSamplePoints(nodes,count=CP_PIN_COUNT){
    const pts=[];
    const totalSegments=nodes.length-1;
    for(let i=0;i<count;i++){
      const t = (i/(count-1))*totalSegments;
      const seg = Math.min(totalSegments-1, Math.floor(t));
      const local = Math.max(0, Math.min(1, t-seg));
      const x1=CP_XS[seg], x2=CP_XS[seg+1];
      const y1=cpY(nodes[seg]), y2=cpY(nodes[seg+1]);
      pts.push({
        x: x1 + (x2-x1)*local,
        y: y1 + (y2-y1)*local
      });
    }
    return pts;
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

  function cpPartPreviewSvg(index,level){
    const leftLevel=index===0 ? cpNodes[0] : cpVals[index-1];
    const y1=cpMiniY(leftLevel), y2=cpMiniY(level);
    const gradId=`cpMiniMetal${index}`;
    const path=`M 6 26 L 6 ${y1} L 56 ${y1} L 104 ${y2} L 110 26 Z`;
    const line=`M 6 ${y1} L 56 ${y1} L 104 ${y2}`;
    return `
      <svg viewBox="0 0 116 32" aria-hidden="true">
        <defs>
          <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#ffe3a2"></stop>
            <stop offset="0.42" stop-color="#e3bd69"></stop>
            <stop offset="1" stop-color="#895821"></stop>
          </linearGradient>
        </defs>
        <rect x="1" y="3" width="114" height="28" rx="9" fill="rgba(0,0,0,.16)" stroke="rgba(219,175,88,.12)"></rect>
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
    points.forEach(pt=>{
      const pin=document.createElement('div');
      pin.className='cpPin';
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
      dot.className='cpJoint'+(i===0?' start':'')+(i===cpSelected+1&&!cpReady?' selected':'');
      const px=(CP_XS[i]/640)*svgBox.width + (svgBox.left-canvasBox.left);
      const py=(cpSvgY(level)/90)*svgBox.height + (svgBox.top-canvasBox.top);
      dot.style.left=`${px}px`;
      dot.style.top=`${py}px`;
      $cpBuildJoints.appendChild(dot);
    });
  }

  function setCompositeLevel(i,level){
    if(solved||cpReady) return;
    level=clamp(level,0,2);
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

      const buttons=CP_LEVEL_NAMES.map((name,buttonLevel)=>
        `<button class="cpLevelBtn${level===buttonLevel?' active':''}" data-level="${buttonLevel}" type="button" aria-label="Сегмент ${i+1}: ${name.toLowerCase()}">${name}</button>`
      ).join('');

      wrap.innerHTML=`
        <div class="cpPartPreview">${cpPartPreviewSvg(i,level)}</div>
        <div class="cpPartLabel">КОНЕЦ: ${CP_LEVEL_NAMES[level]}</div>
        <div class="cpLevelControls">${buttons}</div>
      `;

      wrap.addEventListener('click',e=>{
        if(solved||cpReady) return;
        if(!e.target.closest('.cpLevelBtn')){
          cpSelected=i;
          SFX.select();
          renderComposite();
        }
      });

      wrap.querySelectorAll('.cpLevelBtn').forEach(btn=>{
        btn.addEventListener('click',e=>{
          e.stopPropagation();
          setCompositeLevel(i,Number(btn.dataset.level));
        });
      });

      $cpParts.appendChild(wrap);
    });

    cpReady=cpMatchesTarget();
    $cpState.classList.remove('ready');

    if(solved) {
      $cpState.textContent='Замок открыт';
    } else {
      $cpState.textContent=`Сегмент ${cpSelected+1}/4 · конец: ${CP_LEVEL_NAMES[cpVals[cpSelected]].toLowerCase()}`;
    }

    requestAnimationFrame(()=>cpRenderJoints(builtNodes));
  }

  function startCompositeRound(){
    solved=false;
    picks=pickCapacity;
    moves=0;
    brokenPicks=0;
    runReward=1000;

    cpNodes=[rand(0,2)];
    for(let i=0;i<4;i++){
      const prev=cpNodes[i];
      const options=[prev-1,prev,prev+1].filter(v=>v>=0&&v<=2);
      cpNodes.push(options[rand(0,options.length-1)]);
    }
    cpTarget=cpNodes.slice(1);

    const minDistance=diffStep(2,4,6,'composite');
    do{ cpVals=Array.from({length:4},()=>rand(0,2)); }
    while(cpMatchesTarget(cpVals) || cpVals.reduce((sum,v,i)=>sum+Math.abs(v-cpTarget[i]),0) < minDistance);

    cpInitial=[...cpVals];
    cpSelected=0;
    cpReady=false;
    generatedDistance=cpVals.reduce((sum,v,i)=>sum+Math.abs(v-cpTarget[i]),0);
    updateEconomyUI();
    renderComposite();
  }

  function moveCompositeSelection(dir){
    if(solved||cpReady) return;
    const next=clamp(cpSelected+dir,0,3);
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
    const next=clamp(cpVals[i]+delta,0,2);
    if(next===cpVals[i]){
      SFX.blocked();
      return;
    }
    setCompositeLevel(i,next);
  }

  function tryOpenComposite(){
    if(shopOpen||solved) return;
    cpReady=cpMatchesTarget();

    if(!cpReady){
      SFX.wrongLock();
      damagePick({
        resetProgress:()=>{
          cpVals=[...cpInitial];
          cpSelected=0;
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

