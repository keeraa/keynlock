  // ===== ALCHEMY STATIONS =====
  // Ported from the standalone prototypes. Three of the ten are wired up so far
  // — mixing, concentrations, separation — but the whole script comes over at
  // once so the rest only need their markup later.
  //
  // Kept inside a closure: the prototype declares 231 top-level names into a
  // scope the game's classic scripts already share, where `apply` and `shuffle`
  // collide today.
  (function(){
  'use strict';

  let alchemyReady = false, alchemyRunning = false;
  const rawRAF = window.requestAnimationFrame.bind(window);
  let parked = [];

  // Seventeen animation loops live in here. Off-screen they park themselves
  // instead of burning frames next to the parallax, the noise decay and the
  // bird watcher; opening the station lets them all go again.
  function requestAnimationFrame(cb){
    if(alchemyRunning) return rawRAF(cb);
    parked.push(cb);
    return 0;
  }
  function releaseParked(){
    const queued = parked;
    parked = [];
    queued.forEach(cb => rawRAF(cb));
  }

  // A station whose markup has not been ported yet simply has no elements. The
  // prototype wires handlers straight onto the results of getElementById, so
  // missing ones get a stand-in rather than throwing and killing every station
  // after them in the file.
  const spare = () => {
    const node = document.createElement('div');
    node.style.display = 'none';
    return node;
  };
  const realById = document.getElementById.bind(document);
  // Searches stay inside the station panel. The prototype asks for '.scene',
  // and so does the game — that selector is its main stage — so an unscoped
  // query hands the alchemy code the game's own board to drive.
  const scope = () => realById('alchemyRoot') || document;
  const doc = {
    getElementById: id => realById(id) || spare(),
    querySelector: sel => scope().querySelector(sel),
    querySelectorAll: sel => scope().querySelectorAll(sel),
    createElement: tag => document.createElement(tag),
    addEventListener: (...a) => document.addEventListener(...a),
    get body(){ return document.body; },
    get documentElement(){ return document.documentElement; }
  };

  function boot(){
  const scenes=[...doc.querySelectorAll('.scene')];
    const tabs=doc.getElementById('tabs');
    const tabIconMap={
      'Смешение':'ti-droplet-half-2',
      'Концентрации':'ti-flask-2',
      'Разделение':'ti-filter',
      'Порядок':'ti-list-numbers',
      'Перегонка':'ti-test-pipe-2',
      'Формула':'ti-notes',
      'Давление + осаждение':'ti-gauge'
    };
    const tabSvgMap={
      'Баланс эссенций':`<svg class="tab-svg-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v18"></path><path d="M6 6h12"></path><path d="M7 6c0 0-3 3-3 5a3 3 0 0 0 6 0c0-2-3-5-3-5Z"></path><path d="M17 6c0 0-3 3-3 5a3 3 0 0 0 6 0c0-2-3-5-3-5Z"></path></svg>`,
      'Реакции слоёв':`<svg class="tab-svg-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 4 7l8 4 8-4-8-4Z"></path><path d="m4 12 8 4 8-4"></path><path d="m4 17 8 4 8-4"></path></svg>`,
      'Ветвящийся рецепт':`<svg class="tab-svg-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 4v6a4 4 0 0 0 4 4h8"></path><path d="M14 6h4v4"></path><path d="M10 14a4 4 0 0 1-4 4H4"></path><path d="M4 16v4h4"></path></svg>`
    };
    scenes.forEach((s,i)=>{
      const b=document.createElement('button');
      b.className='tab'+(i===0?' active':'');
      const name=s.dataset.name;
      b.innerHTML=tabSvgMap[name] || `<i class="ti ${tabIconMap[name]||'ti-hexagon'}" aria-hidden="true"></i>`;
      b.title=name;
      b.setAttribute('aria-label',name);
      b.onclick=()=>show(i);
      tabs.appendChild(b)
    });

    tabs.addEventListener('wheel',e=>{
      if(tabs.scrollWidth<=tabs.clientWidth)return;
      const delta=Math.abs(e.deltaX)>Math.abs(e.deltaY)?e.deltaX:e.deltaY;
      if(delta){e.preventDefault();tabs.scrollLeft+=delta;}
    },{passive:false});
    let tabPointerDown=false,tabDragging=false,tabDragStartX=0,tabDragStartScroll=0,tabDragPointerId=null;
    const TAB_DRAG_THRESHOLD=7;
    tabs.addEventListener('pointerdown',e=>{
      if(e.pointerType==='touch')return;
      if(e.button!==0)return;
      tabPointerDown=true;tabDragging=false;tabDragPointerId=e.pointerId;
      tabDragStartX=e.clientX;tabDragStartScroll=tabs.scrollLeft;
    });
    tabs.addEventListener('pointermove',e=>{
      if(!tabPointerDown||e.pointerId!==tabDragPointerId)return;
      const dx=e.clientX-tabDragStartX;
      if(!tabDragging&&Math.abs(dx)>=TAB_DRAG_THRESHOLD){
        tabDragging=true;tabs.classList.add('dragging');
        try{tabs.setPointerCapture?.(e.pointerId)}catch(_){}
      }
      if(!tabDragging)return;
      e.preventDefault();
      tabs.scrollLeft=tabDragStartScroll-dx;
    });
    function endTabDrag(e){
      if(!tabPointerDown)return;
      tabPointerDown=false;
      if(tabDragging){
        tabDragging=false;tabs.classList.remove('dragging');
        tabs.dataset.suppressClick='1';
        setTimeout(()=>{delete tabs.dataset.suppressClick},0);
      }
      try{if(tabDragPointerId!=null)tabs.releasePointerCapture?.(tabDragPointerId)}catch(_){}
      tabDragPointerId=null;
    }
    tabs.addEventListener('pointerup',endTabDrag);
    tabs.addEventListener('pointercancel',endTabDrag);
    tabs.addEventListener('lostpointercapture',e=>{if(tabPointerDown)endTabDrag(e)});
    tabs.addEventListener('click',e=>{
      if(tabs.dataset.suppressClick==='1'){
        e.preventDefault();e.stopPropagation();
      }
    },true);

    function stopTransientInteractions(){
      const active=doc.querySelector('.scene.active');
      if(!active)return;
      if(active.dataset.name==='Перегонка')active.querySelectorAll('.distill-heat-btn.active').forEach(b=>b.click());
      if(active.dataset.name==='Давление + осаждение')active.querySelector('#compoundHeat')?.dispatchEvent(new Event('pointerup',{bubbles:true}));
    }
    function show(i){stopTransientInteractions();scenes.forEach((s,j)=>s.classList.toggle('active',i===j));[...tabs.children].forEach((b,j)=>b.classList.toggle('active',i===j));requestAnimationFrame(()=>refreshPassiveBubbles(document));}
    function makeKeyClickable(el,action){el.tabIndex=0;el.setAttribute('role','button');el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();action()}})}
    const liquidReactionTimers=new WeakMap();

    function resolveLiquidHost(target){return typeof target==='string'?doc.getElementById(target):target||null}
    function liquidBurst(target,count=8,intensity=1){
      const host=resolveLiquidHost(target);if(!host)return;
      const vessel=host.closest?.('.test-tube,.compound-test-tube-v12,.layer-react-tube')||host.parentElement||host;
      if(!vessel)return;
      if(getComputedStyle(vessel).position==='static')vessel.style.position='relative';
      vessel.querySelectorAll('.liquid-burst-v13').forEach(n=>n.remove());
      const hostRect=host.getBoundingClientRect();
      const vesselRect=vessel.getBoundingClientRect();
      const startOffset=Math.max(10,hostRect.height*.18);
      const activeHeight=Math.max(44,hostRect.height-startOffset+26);
      const burst=document.createElement('div');burst.className='liquid-burst-v13';
      burst.style.left=(hostRect.left-vesselRect.left)+'px';
      burst.style.top=(hostRect.top-vesselRect.top+startOffset-14)+'px';
      burst.style.width=Math.max(18,hostRect.width)+'px';
      burst.style.height=Math.max(48,activeHeight)+'px';
      const width=Math.max(48,hostRect.width||host.clientWidth||100);
      const rise=Math.max(108,Math.min(196,activeHeight+58));
      for(let i=0;i<count;i++){
        const b=document.createElement('span');b.className='liquid-bubble-v13';
        const life=(960+Math.random()*640).toFixed(0)+'ms';
        b.style.setProperty('--bubble-size',(4+Math.random()*8*intensity).toFixed(1)+'px');
        b.style.setProperty('--bubble-x',(12+Math.random()*76).toFixed(1)+'%');
        b.style.setProperty('--bubble-drift',((Math.random()-.5)*width*.28).toFixed(1)+'px');
        b.style.setProperty('--bubble-delay',(Math.random()*160).toFixed(0)+'ms');
        b.style.setProperty('--bubble-life',life);
        b.style.setProperty('--bubble-rise',rise.toFixed(1)+'px');
        b.style.animation=`bubbleRiseV13 ${life} ease-out ${Math.random()*160}ms forwards`;
        burst.appendChild(b);
      }
      vessel.appendChild(burst);
      setTimeout(()=>burst.remove(),2100);
    }
    const liquidFrameAnimations=new WeakMap();
    function easeLiquidV83(t){t=Math.max(0,Math.min(1,t));return .5-Math.cos(Math.PI*t)/2}
    function meniscusPolygonV83(progress=1,now=0,intensity=1){
      const base=[0,1,3,5.5,7,5.5,3,1,0];
      const pts=[];
      for(let i=0;i<9;i++){
        const x=i*12.5;
        const envelope=Math.sin(Math.PI*(i/8));
        const baseScale=.25+.75*progress;
        const transient=(1-progress)*2.4*intensity*envelope;
        const wave=transient*(.58*Math.sin(now*.010+i*1.75)+.42*Math.sin(now*.016+i*.92));
        const y=Math.max(0,base[i]*baseScale+wave);
        pts.push(`${x}% ${y.toFixed(2)}px`);
      }
      return `polygon(${pts.join(',')},100% 100%,0 100%)`;
    }
    function flattenBuriedLiquidLayersV96(stack,selector){
      if(!(stack instanceof Element))return;
      const layers=[...stack.querySelectorAll(`:scope > ${selector}`)];
      layers.forEach((layer,i)=>{
        if(i===layers.length-1)return;
        layer.style.setProperty('clip-path','none','important');
        layer.style.setProperty('-webkit-clip-path','none','important');
      });
    }
    function applyTopMeniscusV96(stack,selector){
      if(!(stack instanceof Element))return;
      const layers=[...stack.querySelectorAll(`:scope > ${selector}`)];
      layers.forEach((layer,i)=>{
        if(i<layers.length-1){
          layer.style.setProperty('clip-path','none','important');
          layer.style.setProperty('-webkit-clip-path','none','important');
        }else{
          const p=meniscusPolygonV83(1,performance.now(),0);
          layer.style.setProperty('clip-path',p,'important');
          layer.style.setProperty('-webkit-clip-path',p,'important');
        }
      });
    }
    function animateLayerFillV83(layer,finalPct=25,duration=640,intensity=1){
      if(!(layer instanceof Element))return;
      const old=liquidFrameAnimations.get(layer);if(old)cancelAnimationFrame(old);
      layer.style.setProperty('height','0%','important');
      layer.style.setProperty('clip-path',meniscusPolygonV83(0,performance.now(),intensity),'important');
      layer.style.setProperty('-webkit-clip-path',meniscusPolygonV83(0,performance.now(),intensity),'important');
      const start=performance.now();
      const tick=now=>{
        const raw=Math.min(1,(now-start)/duration),e=easeLiquidV83(raw);
        const pct=finalPct*e;
        layer.style.setProperty('height',`${pct.toFixed(3)}%`,'important');
        const poly=meniscusPolygonV83(e,now,intensity);
        layer.style.setProperty('clip-path',poly,'important');
        layer.style.setProperty('-webkit-clip-path',poly,'important');
        if(raw<1){liquidFrameAnimations.set(layer,requestAnimationFrame(tick));}
        else{
          layer.style.setProperty('height',`${finalPct}%`,'important');
          const rest=meniscusPolygonV83(1,now,0);
          layer.style.setProperty('clip-path',rest,'important');
          layer.style.setProperty('-webkit-clip-path',rest,'important');
          const stack=layer.parentElement;
          if(stack?.classList.contains('sequence-liquid-stack'))applyTopMeniscusV96(stack,'.sequence-layer');
          else if(stack?.classList.contains('formula-tube-stack-v8'))applyTopMeniscusV96(stack,'.formula-tube-layer-v8');
          liquidFrameAnimations.delete(layer);
        }
      };
      liquidFrameAnimations.set(layer,requestAnimationFrame(tick));
    }

    const singleLiquidAnimationsV88=new WeakMap();
    function singleLiquidPolygonV88(topPct,now=0,motion=0){
      const base=[0,.7,1.55,2.35,2.7,2.35,1.55,.7,0];
      const pts=[];
      for(let i=0;i<9;i++){
        const x=i*12.5,envelope=Math.sin(Math.PI*(i/8));
        const wave=envelope*motion*(Math.sin(now*.0062+i*1.31)*.68+Math.sin(now*.0097+i*.77)*.32);
        pts.push(`${x}% ${(topPct+base[i]+wave).toFixed(3)}%`);
      }
      return `polygon(${pts.join(',')},100% 100%,0 100%)`;
    }
    // Call sites pass their own duration — pour and drain run quicker than the
    // prototype had them (820/680ms rather than 1350/1100), so the level
    // settles before the player's next keypress instead of trailing behind it.
    function setSingleLiquidLevelV88(target,topPct,{animate=true,duration=680,intensity=1}={}){
      const el=resolveLiquidHost(target);if(!el)return;
      el.classList.add('liquid-level-v88');
      const old=singleLiquidAnimationsV88.get(el);if(old)cancelAnimationFrame(old);
      let from=Number(el.dataset.liquidTopV88);
      if(!Number.isFinite(from))from=Number(getComputedStyle(el).getPropertyValue('--liquid-top-v88').replace('%',''));
      if(!Number.isFinite(from))from=12;
      const to=Math.max(9,Math.min(90,topPct));
      if(!animate){
        el.dataset.liquidTopV88=String(to);el.style.setProperty('--liquid-top-v88',`${to}%`);
        const p=singleLiquidPolygonV88(to,performance.now(),0);
        el.style.setProperty('clip-path',p,'important');el.style.setProperty('-webkit-clip-path',p,'important');return;
      }
      const start=performance.now();
      const tick=now=>{
        const raw=Math.min(1,(now-start)/duration),e=easeLiquidV83(raw);
        const top=from+(to-from)*e;
        const motion=Math.sin(Math.PI*raw)*1.05*intensity;
        el.dataset.liquidTopV88=String(top);el.style.setProperty('--liquid-top-v88',`${top.toFixed(3)}%`);
        const p=singleLiquidPolygonV88(top,now,motion);
        el.style.setProperty('clip-path',p,'important');el.style.setProperty('-webkit-clip-path',p,'important');
        if(raw<1)singleLiquidAnimationsV88.set(el,requestAnimationFrame(tick));
        else{
          el.dataset.liquidTopV88=String(to);el.style.setProperty('--liquid-top-v88',`${to}%`);
          const rest=singleLiquidPolygonV88(to,now,0);
          el.style.setProperty('clip-path',rest,'important');el.style.setProperty('-webkit-clip-path',rest,'important');
          singleLiquidAnimationsV88.delete(el);
        }
      };
      singleLiquidAnimationsV88.set(el,requestAnimationFrame(tick));
    }
    // `full` is how close the surface gets to the top at max fill — the
    // callers used to push it to 18/20, which read as brim-full against the
    // shoulder where the glass narrows. Backed off a few points so a maxed-out
    // mix still shows a visible gap under the neck, matching the sample tubes.
    function amountTopV88(total,{empty=84,full=18,steps=6}={}){
      const t=Math.max(0,Math.min(1,total/steps));return empty+(full-empty)*t;
    }
    function animateLayerRemovalV88(layer,duration=640,done=()=>{}){
      if(!(layer instanceof Element)){done();return}
      const startBasis=parseFloat(getComputedStyle(layer).height)||layer.getBoundingClientRect().height;
      const parentH=Math.max(1,layer.parentElement?.getBoundingClientRect().height||1);
      const startPct=startBasis/parentH*100;const start=performance.now();
      const tick=now=>{
        const raw=Math.min(1,(now-start)/duration),e=easeLiquidV83(raw),progress=1-e,pct=startPct*progress;
        layer.style.setProperty('height',`${pct.toFixed(3)}%`,'important');
        const poly=meniscusPolygonV83(Math.max(0,progress),now,.9);
        layer.style.setProperty('clip-path',poly,'important');
        layer.style.setProperty('-webkit-clip-path',poly,'important');
        layer.style.opacity=String(.35+.65*progress);
        if(raw<1)requestAnimationFrame(tick);
        else done();
      };requestAnimationFrame(tick);
    }
    function animateStackClipLevelV88(stack,topPct,{animate=true,duration=680,intensity=.8}={}){
      if(!(stack instanceof Element))return;
      let from=Number(stack.dataset.liquidTopV88);if(!Number.isFinite(from))from=90;
      const to=Math.max(4,Math.min(94,topPct));
      const apply=(top,now,motion)=>{
        const p=singleLiquidPolygonV88(top,now,motion);
        stack.style.setProperty('clip-path',p,'important');stack.style.setProperty('-webkit-clip-path',p,'important');
        stack.dataset.liquidTopV88=String(top);
      };
      if(!animate){apply(to,performance.now(),0);return}
      const start=performance.now();
      const tick=now=>{const raw=Math.min(1,(now-start)/duration),e=easeLiquidV83(raw),top=from+(to-from)*e;apply(top,now,Math.sin(Math.PI*raw)*intensity);if(raw<1)requestAnimationFrame(tick);else apply(to,now,0)};
      requestAnimationFrame(tick);
    }
    function setDistillSurfaceV83(el,topPct,now,index,heated=false){
      if(!(el instanceof Element))return;
      const base=[0,.7,1.5,2.15,2.45,2.15,1.5,.7,0];
      const amp=heated?1.45:.8;
      const pts=[];
      for(let i=0;i<9;i++){
        const x=i*12.5,envelope=Math.sin(Math.PI*(i/8));
        const wave=envelope*(Math.sin(now*.0042+index*1.17+i*1.36)*amp*.68+Math.sin(now*.0071+index*.63+i*2.04)*amp*.32);
        const y=topPct+base[i]+wave;
        pts.push(`${x}% ${y.toFixed(3)}%`);
      }
      const poly=`polygon(${pts.join(',')},100% 91%,0 91%)`;
      el.style.setProperty('clip-path',poly,'important');
      el.style.setProperty('-webkit-clip-path',poly,'important');
    }
    function pulseLiquidV83(target){
      const el=resolveLiquidHost(target);if(!el)return;
      el.classList.remove('liquid-surface-pulse-v83');void el.offsetWidth;el.classList.add('liquid-surface-pulse-v83');
      setTimeout(()=>el.classList.remove('liquid-surface-pulse-v83'),1120);
    }
    function waveLiquid(target,intensity=1){
      const el=resolveLiquidHost(target);if(!el)return;
      pulseLiquidV83(el);
      liquidBurst(el,Math.round(4+2*intensity),Math.min(.72,intensity*.66));
    }
    const liquidHoverCooldownV109=new WeakMap();
    function triggerHoverLiquidBurstV109(host){
      const el=resolveLiquidHost(host);if(!el)return;
      const now=performance.now(),last=liquidHoverCooldownV109.get(el)||0;
      if(now-last<340)return;
      liquidHoverCooldownV109.set(el,now);
      liquidBurst(el,4,.42);
    }
    document.addEventListener('pointerenter',e=>{
      const host=e.target instanceof Element?e.target.closest('.test-tube,.distill-flask-v76,.mini-swatch.tube-sm,.layer-react-tube,.proto-flask,.distill-column-hit') : null;
      if(!host)return;
      triggerHoverLiquidBurstV109(host);
    },true);
    function setContinuousLiquidReaction(target,on){
      const el=resolveLiquidHost(target);if(!el)return;
      const current=liquidReactionTimers.get(el);
      if(current){clearInterval(current);liquidReactionTimers.delete(el)}
      if(on){
        pulseLiquidV83(el);
        const timer=setInterval(()=>pulseLiquidV83(el),1180);
        liquidReactionTimers.set(el,timer);
      }
    }

    const PASSIVE_BUBBLE_HOSTS='.tube-liquid,.vapor,.sequence-liquid-stack,.formula-tube-stack-v8,.compound-tube-stack-v12,.layer-react-stack';
    function passiveHostHasLiquid(host){
      if(host.classList.contains('sequence-liquid-stack')||host.classList.contains('formula-tube-stack-v8')||host.classList.contains('compound-tube-stack-v12')||host.classList.contains('layer-react-stack'))return host.children.length>0;
      const r=host.getBoundingClientRect();return r.height>5&&r.width>5;
    }
    function ensurePassiveBubbleLayer(host){
      if(!(host instanceof Element))return;
      let layer=host.querySelector(':scope > .passive-bubbles-v44');
      if(!layer){
        layer=document.createElement('div');layer.className='passive-bubbles-v44';
        const total=12;
        for(let i=0;i<total;i++){
          const b=document.createElement('span');b.className='passive-bubble-v44';
          const dur=5.4+Math.random()*4.2;
          b.style.setProperty('--x',`${10+Math.random()*80}%`);
          b.style.setProperty('--s',`${1.8+Math.random()*2.6}px`);
          b.style.setProperty('--dur',`${dur}s`);
          b.style.setProperty('--delay',`${-(dur*(i/total)+Math.random()*.8)}s`);
          b.style.setProperty('--drift',`${(Math.random()-.5)*8}px`);
          layer.appendChild(b);
        }
        host.appendChild(layer);
      }
      const r=host.getBoundingClientRect();
      const rise=Math.max(34,r.height-14);
      layer.querySelectorAll('.passive-bubble-v44').forEach((b,i)=>{
        b.style.setProperty('--rise-px',`${Math.max(28,rise-(i%4)*3)}px`);
      });
      layer.style.display=passiveHostHasLiquid(host)?'block':'none';
    }
    function refreshPassiveBubbles(root=document){
      if(root.matches?.(PASSIVE_BUBBLE_HOSTS))ensurePassiveBubbleLayer(root);
      root.querySelectorAll?.(PASSIVE_BUBBLE_HOSTS).forEach(ensurePassiveBubbleLayer);
    }
    const passiveBubbleObserver=new MutationObserver(muts=>{
      for(const m of muts){
        if(m.type==='childList'){
          if(m.target instanceof Element&&m.target.matches(PASSIVE_BUBBLE_HOSTS))ensurePassiveBubbleLayer(m.target);
          m.addedNodes.forEach(n=>{if(n instanceof Element)refreshPassiveBubbles(n)});
        }
      }
    });
    refreshPassiveBubbles(document);
    passiveBubbleObserver.observe(document.body,{childList:true,subtree:true});
    let passiveResizeFrame=0;
    window.addEventListener('resize',()=>{cancelAnimationFrame(passiveResizeFrame);passiveResizeFrame=requestAnimationFrame(()=>refreshPassiveBubbles(document))});
    document.addEventListener('visibilitychange',()=>{if(document.hidden)stopTransientInteractions()});

    show(0);

    let flaskCount=3, lastBroken=-1;
    const flasksEl=doc.getElementById('flasks'), flaskNote=doc.getElementById('flaskNote');
    function renderFlasks(animate=false){flasksEl.innerHTML='';for(let i=0;i<3;i++){const f=document.createElement('div');f.className='flask-icon'+(i>=flaskCount?' used':'')+(animate&&i===lastBroken?' breaking':'');f.innerHTML='<i class="ti ti-flask"></i>';f.title=i<flaskCount?'целый флакон':'треснувший флакон';flasksEl.appendChild(f)}flaskNote.textContent=flaskCount>0?`${flaskCount} ${flaskCount===1?'флакон':'флакона'}`:'флаконы закончились';}
    function breakFlask(reason='Ошибка'){if(flaskCount<=0){flaskNote.textContent='флаконы закончились';return false}flaskCount--;lastBroken=flaskCount;renderFlasks(true);flaskNote.textContent=`${reason} — флакон треснул`;setTimeout(()=>renderFlasks(false),650);return true}
    doc.getElementById('refillFlasks').onclick=()=>{flaskCount=3;lastBroken=-1;renderFlasks()};renderFlasks();

    const sigilData=[{name:'Огонь',icon:'ti-flame',color:'#b55b42'},{name:'Эфир',icon:'ti-wind',color:'#758f9a'},{name:'Вода',icon:'ti-droplet',color:'#4e7fab'},{name:'Соль',icon:'ti-diamond',color:'#9b916c'}];
    let seq=[],seqPos=0;const sigWrap=doc.getElementById('sigils'),dots=doc.getElementById('seqDots'),seqTubeLayers=doc.getElementById('seqTubeLayers');
    function renderSequenceControlsV88(){
      sigWrap.innerHTML='';const poured=new Set(seq.slice(0,seqPos));
      sigilData.forEach((x,i)=>{const e=document.createElement('button');e.className='sigil'+(poured.has(i)?' added':'');e.innerHTML=`<i class="ti ${x.icon}"></i><small>${x.name}</small>`;e.onclick=()=>chooseSequence(i);sigWrap.appendChild(e)});
    }
    function appendSequenceLayerV88(item){
      flattenBuriedLiquidLayersV96(seqTubeLayers,'.sequence-layer');
      const prev=[...seqTubeLayers.querySelectorAll(':scope > .sequence-layer')].at(-1);
      if(prev){prev.style.setProperty('clip-path','none','important');prev.style.setProperty('-webkit-clip-path','none','important')}
      const layer=document.createElement('div');layer.className='sequence-layer';layer.style.background=item.color;layer.style.setProperty('--layer-bottom-v92',`${(seqPos-1)*25}%`);layer.title=item.name;layer.setAttribute('aria-label',item.name);
      layer.style.setProperty('height','0%','important');
      seqTubeLayers.appendChild(layer);refreshPassiveBubbles(seqTubeLayers);
      requestAnimationFrame(()=>animateLayerFillV83(layer,25,640,.98));
    }
    function randomizeSequence(){seq=shuffle([0,1,2,3]);seqPos=0;seqTubeLayers.innerHTML='';renderSequenceControlsV88();updateSeq()}
    function chooseSequence(i){
      if(seqPos>=seq.length)return;
      if(i===seq[seqPos]){
        const item=sigilData[i];seqPos++;renderSequenceControlsV88();appendSequenceLayerV88(item);updateSeq();
      }else{
        seqPos=0;breakFlask('Неверный реагент');seqTubeLayers.innerHTML='';renderSequenceControlsV88();updateSeq();
      }
    }
    for(let i=0;i<4;i++){let d=document.createElement('div');d.className='seq-dot';dots.appendChild(d)}
    function updateSeq(){[...dots.children].forEach((d,i)=>d.classList.toggle('on',i<seqPos));doc.getElementById('seqStatus').innerHTML=`<strong>${seqPos} / 4</strong>${seqPos===4?'эликсир собран':'этапов'}`}
    doc.getElementById('seqReset').onclick=randomizeSequence;randomizeSequence();

    const colWrap=doc.getElementById('columns');
    const distillPalette=[
      {name:'красный',hex:'#d46a5b'},
      {name:'золотой',hex:'#d2b25a'},
      {name:'зелёный',hex:'#69bf72'},
      {name:'синий',hex:'#5d86d6'},
      {name:'фиолетовый',hex:'#9271cd'}
    ];
    const DISTILL_HEAT_STAGES=[
      {name:'синий',pos:0.00,rgb:[93,134,214]},
      {name:'фиолетовый',pos:0.20,rgb:[146,113,205]},
      {name:'красный',pos:0.40,rgb:[212,106,91]},
      {name:'зелёный',pos:0.60,rgb:[105,191,114]},
      {name:'золотой',pos:0.80,rgb:[210,178,90]},
      {name:'синий',pos:1.00,rgb:[93,134,214]}
    ];
    let distillLevels=[18,42,68,27,81],distillDirs=[1,-1,1,1,-1],distillSpeeds=[18,23,15,20,17],distillLocked=[false,false,false,false,false],distillLast=performance.now(),distillHeatPos=[.12,.18,.26,.14,.22],distillHeating=[false,false,false,false,false],distillTargetIdx=[0,1,2,3,4],distillZoneCenters=[22,36,50,64,78],distillZoneHalf=11;
    const distillEls=[];
    function hexToRgb(hex){const h=hex.replace('#','');return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)]}
    function rgbToHex(rgb){return '#'+rgb.map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join('')}
    function hexToRgba(hex,a=.2){const rgb=hexToRgb(hex);return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`}
    function mixRgb(a,b,t){return [0,1,2].map(i=>a[i]+(b[i]-a[i])*t)}
    function saturateRgb(rgb,k=1.28){const avg=(rgb[0]+rgb[1]+rgb[2])/3;return rgb.map(v=>Math.max(0,Math.min(255,avg+(v-avg)*k)))}
    function darken(rgb,k=.12){return rgb.map(v=>Math.max(0,v*(1-k)))}
    function lighten(rgb,k=.18){return rgb.map(v=>v+(255-v)*k)}
    function distillStageData(pos){
      const p=((pos%1)+1)%1;
      const five=DISTILL_HEAT_STAGES.slice(0,5);
      let best=five[0],d=Infinity;
      five.forEach((s,idx)=>{
        const raw=Math.abs(s.pos-p),nd=Math.min(raw,1-raw);
        if(nd<d){d=nd;best={...s,index:idx,distance:nd}}
      });
      return best
    }
    function distillTargetHeatPos(idx){
      const stage=DISTILL_HEAT_STAGES[Math.max(0,Math.min(4,idx))];
      return stage?stage.pos:0;
    }
    function distillColorData(i){
      const p=((distillHeatPos[i]%1)+1)%1;
      let base=0;
      for(let k=0;k<DISTILL_HEAT_STAGES.length-1;k++){
        if(p>=DISTILL_HEAT_STAGES[k].pos&&p<=DISTILL_HEAT_STAGES[k+1].pos){base=k;break}
      }
      const a=DISTILL_HEAT_STAGES[base],b=DISTILL_HEAT_STAGES[base+1];
      const span=Math.max(.0001,b.pos-a.pos),t=Math.max(0,Math.min(1,(p-a.pos)/span));
      const rgb=mixRgb(a.rgb,b.rgb,t),nearest=distillStageData(p);
      return {hex:rgbToHex(rgb),rgb,nearest:distillPalette.findIndex(q=>q.name===nearest.name),closeness:nearest.distance,displayName:nearest.name};
    }
    function toggleDistillHeat(i,on){if(distillLocked[i])return;distillHeating[i]=on==null?!distillHeating[i]:!!on;if(distillEls[i]?.heatBtn)distillEls[i].heatBtn.classList.toggle('active',distillHeating[i]);if(distillHeating[i]){waveLiquid(distillEls[i]?.vapor,.9);setContinuousLiquidReaction(distillEls[i]?.vapor,true)}else setContinuousLiquidReaction(distillEls[i]?.vapor,false)}
    function setupDistill(){
      distillLevels=[16,34,61,76,88].map(v=>Math.max(8,Math.min(92,v+(Math.random()*12-6))));
      distillDirs=[1,-1,1,-1,1];
      distillSpeeds=[17,21,15,19,16].map(v=>v+(Math.random()*4-2));
      distillHeating=[false,false,false,false,false];
      distillTargetIdx=shuffle([0,1,2,3,4]);
      distillHeatPos=distillTargetIdx.map(idx=>(distillTargetHeatPos(idx)+(Math.random()*.016-.008)+1)%1);
      distillZoneCenters=[18,32,48,64,80].map(v=>Math.max(14,Math.min(86,v+(Math.random()*6-3))));
      distillLocked=[false,false,false,false,false];distillLast=performance.now();
      colWrap.innerHTML='';distillEls.length=0;
      for(let i=0;i<5;i++){
        const target=distillPalette[distillTargetIdx[i]];
        const box=document.createElement('div');box.className='columnbox';
        box.innerHTML=`<div class="distill-target-chip" title="${target.name}" style="background:${target.hex}"></div><div class="distill-target-name"></div><div class="test-tube tube-lg distill-flask-v76"><div class="vapor distill-liquid-v76"></div><div class="distill-zone-layer-v76"><div class="distill-zone-band-v76"></div></div></div><div class="distill-controls"><button class="distill-ctrl-btn distill-heat-btn" type="button" aria-label="Нагрев пробирки ${i+1}"><i class="ti ti-flame"></i></button><button class="distill-ctrl-btn distill-fix-btn" type="button" aria-label="Зафиксировать цвет пробирки ${i+1}"><i class="ti ti-circle-check"></i></button></div><div class="capture-key">клавиша ${i+1}</div>`;
        const col=box.querySelector('.distill-flask-v76');const heatBtn=box.querySelector('.distill-heat-btn');const fixBtn=box.querySelector('.distill-fix-btn');const center=distillZoneCenters[i];
        col.style.setProperty('--zone-top',`${Math.max(8,center-distillZoneHalf)}%`);col.style.setProperty('--zone-height',`${distillZoneHalf*2}%`);col.style.setProperty('--zone-fill',hexToRgba(target.hex,.15));col.style.setProperty('--zone-line',hexToRgba(target.hex,.72));col.onclick=()=>captureDistill(i);makeKeyClickable(col,()=>captureDistill(i));
        heatBtn.onclick=()=>toggleDistillHeat(i);
        fixBtn.onclick=()=>captureDistill(i);
        distillEls.push({box,col,vapor:box.querySelector('.vapor'),targetChip:box.querySelector('.distill-target-chip'),targetName:box.querySelector('.distill-target-name'),heatBtn,fixBtn});
        colWrap.appendChild(box)
      }
      renderDistill()
    }
    function distillZoneFor(i){const center=distillZoneCenters[i];return {min:center-distillZoneHalf,max:center+distillZoneHalf}}
    function inDistillZone(v,i){const z=distillZoneFor(i);return v>=z.min&&v<=z.max}
    function distillSuccess(i){const c=distillColorData(i);return inDistillZone(distillLevels[i],i)&&c.nearest===distillTargetIdx[i]&&c.closeness<=.055}
    function captureDistill(i){
      if(distillLocked[i])return;
      waveLiquid(distillEls[i]?.vapor,1.2);
      if(distillSuccess(i)){
        distillLocked[i]=true;toggleDistillHeat(i,false);renderDistill()
      }else{
        breakFlask('Нужны одновременно верная зона и нужный оттенок после нагрева');
        const c=distillEls[i].col;c.classList.remove('miss');void c.offsetWidth;c.classList.add('miss')
      }
    }
    function renderDistill(now=performance.now()){
      const bodyTop=29,bodyBottom=9,bodyHeight=100-bodyTop-bodyBottom;
      distillLevels.forEach((v,i)=>{
        if(!distillEls[i])return;
        const liveData=distillColorData(i);
        const target=distillPalette[distillTargetIdx[i]];
        const targetRgb=hexToRgb(target.hex);
        const data=distillHeating[i] ? liveData : {rgb:targetRgb,nearest:distillTargetIdx[i],closeness:0,displayName:target.name};
        const vividRgb=saturateRgb(data.rgb,1.34);
        const topRgb=rgbToHex(lighten(vividRgb,.26));
        const midRgb=rgbToHex(vividRgb);
        const lowRgb=rgbToHex(darken(vividRgb,.08));
        const liquidTop=bodyTop+(v/100)*bodyHeight;
        distillEls[i].vapor.style.height='100%';
        distillEls[i].vapor.style.setProperty('--liquid-top',`${liquidTop}%`);
        setDistillSurfaceV83(distillEls[i].vapor,liquidTop,now,i,!!distillHeating[i]);
        distillEls[i].vapor.style.background=`linear-gradient(180deg, ${topRgb} 0%, ${midRgb} 34%, ${midRgb} 72%, ${lowRgb} 100%)`;
        const z=distillZoneFor(i);
        const zoneTopVisual=bodyTop+(Math.max(0,z.min)/100)*bodyHeight;
        const zoneHeightVisual=(Math.max(0,z.max-z.min)/100)*bodyHeight;
        distillEls[i].col.style.setProperty('--zone-top-visual',`${zoneTopVisual}%`);
        distillEls[i].col.style.setProperty('--zone-height-visual',`${zoneHeightVisual}%`);
        distillEls[i].col.style.setProperty('--zone-fill',hexToRgba(target.hex,.16));distillEls[i].col.style.setProperty('--zone-line',hexToRgba(target.hex,.78));distillEls[i].col.classList.toggle('good',inDistillZone(v,i));
        distillEls[i].col.classList.toggle('locked',distillLocked[i]);
        distillEls[i].heatBtn.classList.toggle('active',!!distillHeating[i]);
        distillEls[i].targetChip.style.boxShadow = (data.nearest===distillTargetIdx[i]&&data.closeness<=.055)?'0 0 0 1px rgba(255,255,255,.24) inset,0 0 12px rgba(255,255,255,.18)':'0 0 0 1px rgba(0,0,0,.18) inset,0 0 10px rgba(255,255,255,.05)';
        if(distillEls[i].targetName)distillEls[i].targetName.className='distill-target-name '+(distillSuccess(i)||distillLocked[i]?'distill-ok':'');
      });
      const ok=distillLocked.filter(Boolean).length;
      doc.getElementById('distillStatus').innerHTML=`<strong>${ok} / 5</strong>${ok===5?'цветов поймано':'цветов зафиксировано'}`
    }
    function distillLoop(now){
      const dt=Math.min(.05,(now-distillLast)/1000);distillLast=now;
      if(activeGameName()==='Перегонка'){
        for(let i=0;i<5;i++){
          if(distillLocked[i])continue;
          distillLevels[i]+=distillDirs[i]*distillSpeeds[i]*dt;
          if(distillHeating[i])distillHeatPos[i]=(distillHeatPos[i]+dt*.20)%1;
          if(distillLevels[i]>=92){distillLevels[i]=92;distillDirs[i]=-1}else if(distillLevels[i]<=8){distillLevels[i]=8;distillDirs[i]=1}
        }
        renderDistill(now)
      }
      requestAnimationFrame(distillLoop)
    }
    setupDistill();requestAnimationFrame(distillLoop);

    const ingredientCatalog=[
    {id:'obsidian',name:'Обсидиановая крошка',icon:'ti-diamond',props:['минеральная','тёмная'],color:'#55494d'},{id:'chalk',name:'Толчёный мел',icon:'ti-circle',props:['минеральная','светлая'],color:'#c9c2ad'},{id:'moonwater',name:'Лунная вода',icon:'ti-moon',props:['холодная','светящаяся'],color:'#667fa4'},{id:'dew',name:'Утренняя роса',icon:'ti-droplet',props:['холодная','прозрачная'],color:'#7ea6b3'},{id:'salt',name:'Соляные кристаллы',icon:'ti-diamond',props:['кристаллическая','сухая'],color:'#b7b39f'},{id:'resin',name:'Чёрная смола',icon:'ti-bottle',props:['органическая','липкая'],color:'#463b34'},{id:'spark',name:'Эфирная искра',icon:'ti-bolt',props:['летучая','электрическая'],color:'#be9c55'},{id:'ash',name:'Солнечный пепел',icon:'ti-sun',props:['горячая','сухая'],color:'#a56f45'},{id:'fern',name:'Пепельный папоротник',icon:'ti-leaf',props:['органическая','сухая'],color:'#657357'},{id:'mercury',name:'Ртутная капля',icon:'ti-droplet',props:['металлическая','тяжёлая'],color:'#8d9396'},{id:'sulfur',name:'Жёлтая сера',icon:'ti-flame',props:['минеральная','горячая'],color:'#b5a443'},{id:'mist',name:'Серебряный туман',icon:'ti-wind',props:['летучая','холодная'],color:'#899ba1'},{id:'ember',name:'Живой уголёк',icon:'ti-flame',props:['горячая','светящаяся'],color:'#a84f36'},{id:'quartz',name:'Белый кварц',icon:'ti-diamond',props:['кристаллическая','светлая'],color:'#bfc4bd'},{id:'nightoil',name:'Ночное масло',icon:'ti-bottle',props:['тёмная','липкая'],color:'#3f4550'},{id:'stormdew',name:'Грозовая роса',icon:'ti-bolt',props:['электрическая','прозрачная'],color:'#5d8c9f'},{id:'root',name:'Корень мандрагоры',icon:'ti-leaf',props:['органическая','тяжёлая'],color:'#755d43'},{id:'glassdust',name:'Стеклянная пыль',icon:'ti-sparkles',props:['сухая','прозрачная'],color:'#9bb0ad'},{id:'frostsalt',name:'Морозная соль',icon:'ti-snowflake',props:['кристаллическая','холодная'],color:'#80a7b4'},{id:'copper',name:'Медная стружка',icon:'ti-hexagon',props:['металлическая','электрическая'],color:'#a76843'},{id:'pollen',name:'Золотая пыльца',icon:'ti-sun',props:['органическая','светящаяся'],color:'#b9a14d'},{id:'tar',name:'Каменная смола',icon:'ti-bottle',props:['минеральная','липкая'],color:'#50473d'},{id:'iceoil',name:'Ледяное масло',icon:'ti-snowflake',props:['холодная','липкая'],color:'#678a93'},{id:'ironpowder',name:'Железный порошок',icon:'ti-hexagon',props:['металлическая','сухая'],color:'#696d69'},{id:'ghostgas',name:'Призрачный газ',icon:'ti-wind',props:['летучая','светящаяся'],color:'#738b83'},{id:'deepwater',name:'Глубинная вода',icon:'ti-droplet',props:['тяжёлая','прозрачная'],color:'#355b78'},{id:'blackcrystal',name:'Чёрный кристалл',icon:'ti-diamond',props:['кристаллическая','тёмная'],color:'#45414e'},{id:'plasma',name:'Плазменная эссенция',icon:'ti-bolt',props:['электрическая','горячая'],color:'#9e5f69'}];
    const recipeKeys=['1','2','3','4','5','6','7','8','9','Q','W','E'];let recipeTargets=[],recipeRequirements=[],recipeChoices=[],chosen=[];const recipeCluesEl=doc.getElementById('recipeClues'),recipeTubeStack=doc.getElementById('recipeTubeStack'),partWrap=doc.getElementById('recipeParts');
    function shuffle(a){const r=[...a];for(let i=r.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[r[i],r[j]]=[r[j],r[i]]}return r}
    function newRecipe(){chosen=[];recipeTargets=shuffle(ingredientCatalog).slice(0,4);recipeRequirements=recipeTargets.map(x=>[...x.props]);const targetIds=new Set(recipeTargets.map(x=>x.id));const distractors=shuffle(ingredientCatalog.filter(x=>!targetIds.has(x.id))).slice(0,8);recipeChoices=shuffle([...recipeTargets,...distractors]);drawRecipe();waveLiquid('recipeTubeStack',1.06)}
    function recipeMatches(item,step){return recipeRequirements[step].every(p=>item.props.includes(p))}
    function chooseIngredientByIndex(i){if(chosen.length>=4)return;const item=recipeChoices[i];if(!item||chosen.includes(item.id))return;chosen.push(item.id);drawRecipe(false);const prev=[...recipeTubeStack.querySelectorAll(':scope > .formula-tube-layer-v8')].at(-1);if(prev){prev.style.setProperty('clip-path','none','important');prev.style.setProperty('-webkit-clip-path','none','important')}const layer=document.createElement('div');layer.className='formula-tube-layer-v8';layer.style.background=item.color;layer.style.setProperty('--layer-bottom-v92',`${(chosen.length-1)*25}%`);layer.innerHTML=`<i class="ti ${item.icon}"></i><span>${item.name}</span>`;layer.style.setProperty('height','0%','important');recipeTubeStack.appendChild(layer);refreshPassiveBubbles(recipeTubeStack);requestAnimationFrame(()=>animateLayerFillV83(layer,25,640,.95))}
    function resetRecipe(){newRecipe()}
    function checkRecipe(){if(chosen.length<4){doc.getElementById('recipeStatus').innerHTML=`<strong>${chosen.length} / 4</strong>сначала добавь четыре компонента`;return}let ok=0;chosen.forEach((id,step)=>{const item=ingredientCatalog.find(x=>x.id===id);if(recipeMatches(item,step))ok++});if(ok===4){doc.getElementById('recipeStatus').innerHTML='<strong>4 / 4</strong>формула верна'}else{breakFlask('Формула не соответствует рецепту');doc.getElementById('recipeStatus').innerHTML=`<strong>${ok} / 4</strong>правильных этапа`}}
    function drawRecipe(rebuildTube=true){recipeCluesEl.innerHTML=recipeRequirements.map((props,i)=>`<div class="recipe-line-v8"><b>${i+1}. ${['Основа','Растворитель','Связка','Активатор'][i]}</b>${props.join(' + ')}</div>`).join('');if(rebuildTube){recipeTubeStack.innerHTML='';chosen.forEach((id,step)=>{const item=ingredientCatalog.find(x=>x.id===id);const layer=document.createElement('div');layer.className='formula-tube-layer-v8';layer.style.background=item.color;layer.style.setProperty('--layer-bottom-v92',`${step*25}%`);layer.innerHTML=`<i class="ti ${item.icon}"></i><span>${item.name}</span>`;recipeTubeStack.appendChild(layer)});applyTopMeniscusV96(recipeTubeStack,'.formula-tube-layer-v8');refreshPassiveBubbles(recipeTubeStack)}doc.getElementById('recipeProgress').textContent=chosen.length?`${chosen.length} из 4 компонентов`:'пусто';partWrap.innerHTML='';recipeChoices.forEach((item,i)=>{const b=document.createElement('button');b.className='formula-part-v8'+(chosen.includes(item.id)?' used':'');b.innerHTML=`<span class="formula-key-v8">${recipeKeys[i]}</span><div class="ingredient-icon-v8"><i class="ti ${item.icon}"></i></div><div class="ingredient-name">${item.name}</div><div class="property-tags">${item.props.map(p=>`<span class="property-tag">${p}</span>`).join('')}</div>`;b.onclick=()=>chooseIngredientByIndex(i);partWrap.appendChild(b)});doc.getElementById('recipeStatus').innerHTML=`<strong>${chosen.length} / 4</strong>${chosen.length===4?'можно проверять':'компонентов добавлено'}`}
    doc.getElementById('recipeCheck').onclick=checkRecipe;doc.getElementById('recipeReset').onclick=resetRecipe;newRecipe();

    function rgbCss(rgb){return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`}
    function colorDistance(a,b){return Math.sqrt((a[0]-b[0])**2+(a[1]-b[1])**2+(a[2]-b[2])**2)}
    function setBg(id,rgb){
      const el=doc.getElementById(id);if(!el)return;
      const c=rgbCss(rgb);
      el.style.setProperty('--liquid-color',c);
      el.style.background=c;
      el.style.backgroundColor=c;
    }
    const SIMPLE_COLORS=[
      {name:'красный',recipe:[2,0,0,0],rgb:[207,79,73]},
      {name:'жёлтый',recipe:[0,2,0,0],rgb:[215,181,76]},
      {name:'синий',recipe:[0,0,2,0],rgb:[83,112,201]},
      {name:'оранжевый',recipe:[1,1,0,0],rgb:[220,131,66]},
      {name:'зелёный',recipe:[0,1,1,0],rgb:[91,157,98]},
      {name:'фиолетовый',recipe:[1,0,1,0],rgb:[145,92,178]},
      {name:'розовый',recipe:[2,0,0,1],rgb:[225,132,132]},
      {name:'кремовый',recipe:[0,2,0,1],rgb:[230,207,129]},
      {name:'голубой',recipe:[0,0,2,1],rgb:[132,157,221]},
      {name:'персиковый',recipe:[1,1,0,1],rgb:[232,166,116]},
      {name:'мятный',recipe:[0,1,1,1],rgb:[139,194,147]},
      {name:'сиреневый',recipe:[1,0,1,1],rgb:[182,145,204]}
    ];
    function recipeRatio(amts){const s=amts.reduce((a,b)=>a+b,0);return s?amts.map(v=>v/s):[0,0,0,0]}
    function simpleMixColor(amts){
      const total=amts.reduce((a,b)=>a+b,0);if(!total)return [198,191,171];
      const r=recipeRatio(amts);let best=SIMPLE_COLORS[0],bd=Infinity;
      SIMPLE_COLORS.forEach(c=>{const cr=recipeRatio(c.recipe);const d=Math.sqrt(cr.reduce((s,v,i)=>s+(v-r[i])**2,0));if(d<bd){bd=d;best=c}});
      const mute=Math.min(.22,bd*.65);return best.rgb.map(v=>Math.round(v*(1-mute)+150*mute));
    }
    function randomSimpleColor(excludeName=''){const pool=SIMPLE_COLORS.filter(c=>c.name!==excludeName);return pool[Math.floor(Math.random()*pool.length)]}
    function makeBottleCard(name,color,getCount,addFn,subFn,atMax=false){const card=document.createElement('div');card.className='color-card';card.innerHTML=`<div class="mini-swatch tube-sm" style="--tube-fill:${color}"><div class="mini-liquid-layer"></div><div class="mini-frame-layer"></div><span class="tube-count">${getCount()}</span></div><strong>${name}</strong><div class="drops">${getCount()}</div><div class="ctrl-row"><button class="small-btn">−</button><button class="small-btn">＋</button></div>`;const [minus,plus]=card.querySelectorAll('button');minus.onclick=subFn;plus.onclick=addFn;
      // The tube is the obvious thing to hit; the small + underneath is a
      // second-guess target, especially on a phone.
      const swatch=card.querySelector('.mini-swatch');
      if(swatch){ swatch.classList.add('tappable'); swatch.onclick=addFn; }
      // Every reagent used to take clicks past 99 for no visual return — the
      // tube was already at its fullest look well before that. Capped at the
      // source (chooseDrop below) and reflected here so the button stops
      // inviting more clicks once they'd do nothing.
      if(atMax){ plus.disabled=true; swatch.classList.add('atMax'); }
      return card}



    function sumAmountsV98(arr){return arr.reduce((a,b)=>a+b,0)}
    function setStatusHtmlV98(id,html){const el=doc.getElementById(id);if(el)el.innerHTML=html}
    function animateSceneLiquidV98(id,top,{animate=true,duration=900,intensity=.7}={}){setSingleLiquidLevelV88(id,top,{animate,duration,intensity})}
    function makeSingleActionBottleCardV98(name,color,count,buttonText,actionFn){
      const card=document.createElement('div');
      card.className='color-card';
      card.innerHTML=`<div class="mini-swatch tube-sm" style="--tube-fill:${color}"><div class="mini-liquid-layer"></div><div class="mini-frame-layer"></div><span class="tube-count">${count}</span></div><strong>${name}</strong><div class="drops">${count}</div><div class="ctrl-row"><button class="small-btn">${buttonText}</button></div>`;
      card.querySelector('button').onclick=actionFn;
      const swatchOne=card.querySelector('.mini-swatch');
      if(swatchOne){ swatchOne.classList.add('tappable'); swatchOne.onclick=actionFn; }
      return card;
    }
    function renderDualActionCardsV98(containerId,items,counts,onAdd,onSub,max=Infinity){
      const box=doc.getElementById(containerId);if(!box)return;box.innerHTML='';
      items.forEach(({name,color,index})=>box.appendChild(makeBottleCard(name,color,()=>counts[index],()=>onAdd(index),()=>onSub(index),counts[index]>=max)));
    }
    function renderSingleActionCardsV98(containerId,items,counts,buttonText,onAction){
      const box=doc.getElementById(containerId);if(!box)return;box.innerHTML='';
      items.forEach(({name,color,index})=>box.appendChild(makeSingleActionBottleCardV98(name,color,counts[index],buttonText,()=>onAction(index))));
    }
    const COLOR_ITEMS_V98=[
      {name:'Красный',color:'#cf4f49',index:0},
      {name:'Жёлтый',color:'#d7b54c',index:1},
      {name:'Синий',color:'#5370c9',index:2},
      {name:'Белый',color:'#ded8c9',index:3}
    ];
    const UNKNOWN_ITEMS_V98=[
      {name:'Реагент A',color:'#cf4f49',index:0},
      {name:'Реагент B',color:'#d7b54c',index:1},
      {name:'Реагент C',color:'#5370c9',index:2},
      {name:'Реагент D',color:'#ded8c9',index:3}
    ];
    const SEPARATION_ITEMS_V98=[
      {name:'Убрать красную примесь',color:'#cf4f49',index:0},
      {name:'Убрать жёлтую примесь',color:'#d7b54c',index:1},
      {name:'Убрать синюю примесь',color:'#5370c9',index:2},
      {name:'Убрать белую примесь',color:'#ded8c9',index:3}
    ];

    // Six of any one reagent is already past what any recipe calls for (the
    // widest ratio is a 2), and the tube's fill maxes out at the same total —
    // past that, more clicks did nothing but invite the player to find out
    // what 99 looked like.
    const MAX_DROPS_PER_REAGENT=6;
    let mixGoal=randomSimpleColor(),mixAmts=[0,0,0,0];
    function mixLevelTopV88(){return amountTopV88(sumAmountsV98(mixAmts),{empty:84,full:24,steps:6})}
    function drawMix(){
      setBg('mixTarget',mixGoal.rgb);
      setBg('mixCurrent',simpleMixColor(mixAmts));
      renderDualActionCardsV98('mixControls',COLOR_ITEMS_V98,mixAmts,
        i=>{if(mixAmts[i]>=MAX_DROPS_PER_REAGENT)return;mixAmts[i]++;drawMix();animateSceneLiquidV98('mixCurrent',mixLevelTopV88(),{duration:820,intensity:1})},
        i=>{mixAmts[i]=Math.max(0,mixAmts[i]-1);drawMix();animateSceneLiquidV98('mixCurrent',mixLevelTopV88(),{duration:680,intensity:.7})},
        MAX_DROPS_PER_REAGENT
      );
    }
    function newMixRound(){
      mixGoal=randomSimpleColor(mixGoal?.name);
      mixAmts=[0,0,0,0];
      drawMix();
      animateSceneLiquidV98('mixCurrent',mixLevelTopV88(),{animate:true,duration:560,intensity:.7});
      setStatusHtmlV98('mixStatus','<strong>Новый цвет</strong>смешай его по образцу');
    }
    doc.getElementById('mixCheck').onclick=()=>{
      const d=colorDistance(simpleMixColor(mixAmts),mixGoal.rgb),ok=d<38;
      setStatusHtmlV98('mixStatus',ok?`<strong>Совпало: ${mixGoal.name}</strong>цвет получен`:'<strong>Мимо</strong>цвет отличается от образца');
      if(!ok)breakFlask('Неверное смешение');
    };
    doc.getElementById('mixReset').onclick=newMixRound;drawMix();animateSceneLiquidV98('mixCurrent',mixLevelTopV88(),{animate:false});

    let unkStrength=[1,1,1,1],unkGoal=randomSimpleColor(),unkAmts=[0,0,0,0];
    function unknownLevelTopV88(){return amountTopV88(sumAmountsV98(unkAmts),{empty:84,full:24,steps:6})}
    function unkEffective(){return unkAmts.map((v,i)=>v*unkStrength[i])}
    function drawUnknown(){
      setBg('unknownTarget',unkGoal.rgb);
      setBg('unknownCurrent',simpleMixColor(unkEffective()));
      renderDualActionCardsV98('unknownControls',UNKNOWN_ITEMS_V98,unkAmts,
        i=>{if(unkAmts[i]>=MAX_DROPS_PER_REAGENT)return;unkAmts[i]++;drawUnknown();animateSceneLiquidV98('unknownCurrent',unknownLevelTopV88(),{duration:820,intensity:1})},
        i=>{unkAmts[i]=Math.max(0,unkAmts[i]-1);drawUnknown();animateSceneLiquidV98('unknownCurrent',unknownLevelTopV88(),{duration:680,intensity:.7})},
        MAX_DROPS_PER_REAGENT
      );
    }
    function rerollUnknown(){
      const vals=[.5,1,1.5,2];
      unkStrength=[vals[Math.floor(Math.random()*vals.length)],vals[Math.floor(Math.random()*vals.length)],vals[Math.floor(Math.random()*vals.length)],vals[Math.floor(Math.random()*vals.length)]];
      unkGoal=randomSimpleColor(unkGoal?.name);
      unkAmts=[0,0,0,0];
      drawUnknown();
      animateSceneLiquidV98('unknownCurrent',unknownLevelTopV88(),{animate:true,duration:560,intensity:.7});
      setStatusHtmlV98('unknownStatus','<strong>Новая партия</strong>силы реагентов снова скрыты');
    }
    doc.getElementById('unknownCheck').onclick=()=>{
      const d=colorDistance(simpleMixColor(unkEffective()),unkGoal.rgb),ok=d<40;
      setStatusHtmlV98('unknownStatus',ok?`<strong>Получен ${unkGoal.name}</strong>концентрации разгаданы`:'<strong>Неточно</strong>нужно скорректировать капли');
      if(!ok)breakFlask('Партия испорчена');
    };
    doc.getElementById('unknownReset').onclick=rerollUnknown;rerollUnknown();

    let sepGoal=randomSimpleColor(),sepImp=[1,1,1,1];
    function sepBaseRecipe(){return [...sepGoal.recipe]}
    function sepCurrentRecipe(){const base=sepBaseRecipe();return base.map((v,i)=>v+sepImp[i])}
    function separationLevelTopV88(){return amountTopV88(sumAmountsV98(sepCurrentRecipe()),{empty:82,full:26,steps:9})}
    function branchLevelTopV88(){return [78,60,42,24][Math.min(3,branchPath.length)]}
    function drawSep(){
      setBg('sepTarget',sepGoal.rgb);
      setBg('sepCurrent',simpleMixColor(sepCurrentRecipe()));
      renderSingleActionCardsV98('sepControls',SEPARATION_ITEMS_V98,sepImp,'Фильтр',i=>{
        if(sepImp[i]>0)sepImp[i]--;else breakFlask('Перефильтрация');
        drawSep();
        animateSceneLiquidV98('sepCurrent',separationLevelTopV88(),{duration:720,intensity:.65});
      });
    }
    function resetSeparation(){
      sepGoal=randomSimpleColor(sepGoal?.name);
      sepImp=[Math.floor(Math.random()*3),Math.floor(Math.random()*3),Math.floor(Math.random()*3),Math.floor(Math.random()*3)];
      if(sumAmountsV98(sepImp)<2)sepImp=[1,1,1,1];
      drawSep();
      animateSceneLiquidV98('sepCurrent',separationLevelTopV88(),{animate:true,duration:560,intensity:.7});
      setStatusHtmlV98('sepStatus',`<strong>Новая цель: ${sepGoal.name}</strong>убери лишние примеси`);
    }
    doc.getElementById('sepCheck').onclick=()=>{
      const ok=sepImp.every(v=>v===0);
      setStatusHtmlV98('sepStatus',ok?`<strong>Очищено до ${sepGoal.name}</strong>примеси удалены`:'<strong>Ещё есть примеси</strong>продолжай фильтрацию');
      if(!ok)breakFlask('Смесь очищена неверно');
    };
    doc.getElementById('sepReset').onclick=resetSeparation;resetSeparation();


    const compoundDial=doc.getElementById('compoundDial');
    const compoundPulseHand=doc.getElementById('compoundPulseHand');

    const compoundZoneSvg=doc.getElementById('compoundZoneSvg');
    const compoundTubeStack=doc.getElementById('compoundTubeStack');
    const COMPOUND_STAGES=[
      {color:'#79d97e',center:62,length:46,passes:2,share:30,name:'зелёная'},
      {color:'#f0cb5f',center:178,length:78,passes:3,share:40,name:'золотая'},
      {color:'#76c0f1',center:304,length:34,passes:2,share:30,name:'синяя'}
    ];
    const COMPOUND_EXTRA_ARCS=[
      {color:'#c6645d',center:118,length:26,name:'красная'},
      {color:'#8c68c7',center:256,length:22,name:'фиолетовая'},
      {color:'#5b8a83',center:338,length:20,name:'бирюзовая'}
    ];
    const compoundTubeTargets=doc.getElementById('compoundTubeTargets');
    function randomizeCompoundShares(){
      let shares;
      do{
        const a=18+Math.floor(Math.random()*25);
        const b=18+Math.floor(Math.random()*31);
        const c=100-a-b;
        shares=[a,b,c];
      }while(shares[2]<18||shares[2]>48||Math.max(...shares)-Math.min(...shares)<8);
      COMPOUND_STAGES.forEach((s,i)=>s.share=shares[i]);
      COMPOUND_EXTRA_ARCS.forEach((s,i)=>{s.center=(118+i*110+Math.random()*18-9+360)%360;s.length=18+Math.random()*16});
    }
    function renderCompoundTargets(){
      if(!compoundTubeTargets)return;compoundTubeTargets.innerHTML='';let bottom=0;
      COMPOUND_STAGES.forEach(s=>{const z=document.createElement('span');z.className='compound-target-zone-v15';z.style.bottom=`${bottom}%`;z.style.height=`${s.share}%`;z.style.setProperty('--zone-color',s.color);compoundTubeTargets.appendChild(z);bottom+=s.share});
    }
    let compoundPulse=0,compoundStage=0,compoundProgress=0,compoundHeatHeld=false;
    let compoundLast=performance.now(),compoundOutsideHold=0,compoundFaultedHold=false,compoundLastBubble=0;
    let compoundImpurity=0,compoundAllowedImpurity=12,compoundBursting=false,compoundManualLayers=[];
    const compoundSpeed=82;

    function compoundAngleDistance(a,b){return Math.abs(((a-b+540)%360)-180)}
    function compoundArcHit(){
      if(compoundStage<COMPOUND_STAGES.length){
        const active=COMPOUND_STAGES[compoundStage];
        if(compoundAngleDistance(compoundPulse,active.center)<=active.length/2)return {kind:'target',arc:active};
      }
      for(let i=0;i<COMPOUND_STAGES.length;i++){
        if(i===compoundStage)continue;
        const s=COMPOUND_STAGES[i];
        if(compoundAngleDistance(compoundPulse,s.center)<=s.length/2)return {kind:'impurity',arc:s};
      }
      for(const s of COMPOUND_EXTRA_ARCS){
        if(compoundAngleDistance(compoundPulse,s.center)<=s.length/2)return {kind:'impurity',arc:s};
      }
      return {kind:'none',arc:null};
    }
    function triggerCompoundBurst(reason){
      if(compoundBursting)return;
      compoundBursting=true;
      if(breakFlask(reason)){setTimeout(()=>{compoundBursting=false;resetCompound()},520)}else compoundBursting=false;
    }
    function compoundInTarget(){
      if(compoundStage>=COMPOUND_STAGES.length)return false;
      const s=COMPOUND_STAGES[compoundStage];
      return compoundAngleDistance(compoundPulse,s.center)<=s.length/2;
    }
    function renderCompoundZones(){
      compoundZoneSvg.innerHTML='';
      COMPOUND_EXTRA_ARCS.forEach((s)=>{
        const start=s.center-s.length/2;
        const c=document.createElementNS('http://www.w3.org/2000/svg','circle');
        c.setAttribute('cx','50');c.setAttribute('cy','50');c.setAttribute('r','40');
        c.setAttribute('pathLength','360');
        c.setAttribute('stroke-dasharray',`${s.length} ${360-s.length}`);
        c.setAttribute('transform',`rotate(${start-90} 50 50)`);
        c.setAttribute('stroke',s.color);
        c.dataset.color=s.color;c.dataset.name=s.name;
        c.classList.add('compound-zone-arc-v12','extra');
        c.style.cursor='pointer';
        c.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();compoundRememberLayer(s.color,s.name);});
        const hit=compoundArcHit();
        if(hit.kind==='impurity'&&hit.arc===s&&compoundHeatHeld)c.classList.add('impurity-hit');
        compoundZoneSvg.appendChild(c);
      });
      COMPOUND_STAGES.forEach((s,i)=>{
        const start=s.center-s.length/2;
        const c=document.createElementNS('http://www.w3.org/2000/svg','circle');
        c.setAttribute('cx','50');c.setAttribute('cy','50');c.setAttribute('r','40');
        c.setAttribute('pathLength','360');
        c.setAttribute('stroke-dasharray',`${s.length} ${360-s.length}`);
        c.setAttribute('transform',`rotate(${start-90} 50 50)`);
        c.setAttribute('stroke',s.color);
        c.style.color=s.color;c.dataset.color=s.color;c.dataset.name=s.name;
        c.classList.add('compound-zone-arc-v12');
        c.style.cursor='pointer';
        c.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();compoundRememberLayer(s.color,s.name);});
        if(i===compoundStage)c.classList.add('active');
        if(i<compoundStage)c.classList.add('done');
        const hit=compoundArcHit();
        if(hit.kind==='impurity'&&hit.arc===s&&compoundHeatHeld)c.classList.add('impurity-hit');
        compoundZoneSvg.appendChild(c);
      });
    }
    function compoundRememberLayer(color,name=''){
      compoundManualLayers.push({color,name,share:10});
      if(compoundManualLayers.length>8)compoundManualLayers=compoundManualLayers.slice(-8);
      waveLiquid(compoundTubeStack,.9);
    }
    function renderCompoundTube(){
      renderCompoundTargets();
      compoundTubeStack.innerHTML='';
      for(let i=0;i<compoundStage;i++){
        const s=COMPOUND_STAGES[i],l=document.createElement('div');
        l.className='compound-tube-layer-v12';l.style.height=`${s.share}%`;l.style.background=s.color;
        compoundTubeStack.appendChild(l);
      }
      if(compoundStage<COMPOUND_STAGES.length && compoundProgress>0){
        const s=COMPOUND_STAGES[compoundStage],l=document.createElement('div');
        const frac=Math.min(1,compoundProgress/s.passes);
        l.className='compound-tube-layer-v12';l.style.height=`${s.share*frac}%`;l.style.background=s.color;
        compoundTubeStack.appendChild(l);
      }
      compoundManualLayers.forEach((s)=>{const l=document.createElement('div');l.className='compound-tube-layer-v12';l.style.height=`${s.share}%`;l.style.background=s.color;compoundTubeStack.appendChild(l)});
      compoundTubeStack.classList.toggle('liquid-heating-v11',compoundHeatHeld&&compoundInTarget());
      const finished=compoundStage;
      doc.getElementById('compoundTubeLabel').textContent=
        compoundStage>=COMPOUND_STAGES.length?'пробирка заполнена':
        `${finished} из ${COMPOUND_STAGES.length} фракций собрано`;
    }
    function renderCompound(){
      compoundPulseHand.style.transform=`rotate(${compoundPulse}deg)`;
      renderCompoundZones();
      renderCompoundTube();
      const heatBtn=doc.getElementById('compoundHeat');
      heatBtn.classList.toggle('held',compoundHeatHeld);
      heatBtn.innerHTML=`<i class="ti ti-flame"></i> ${compoundHeatHeld?'Нагрев удерживается':'Удерживать нагрев'} · Space`;
      doc.getElementById('compoundStatus').innerHTML=
        compoundStage>=COMPOUND_STAGES.length?'<strong>Готово</strong>все фракции собраны':`<strong>Собрано ${compoundStage} / ${COMPOUND_STAGES.length}</strong>`;
      const hit=compoundArcHit(),inside=hit.kind==='target';
      const h=doc.getElementById('compoundHint');
      if(compoundStage>=COMPOUND_STAGES.length)h.textContent='Пробирка заполнена.';
      else if(inside&&compoundHeatHeld)h.textContent='Идёт набор — держи Space до выхода стрелки из дуги.';
      else if(inside)h.textContent='Стрелка в рабочей дуге — удерживай Space.';
      else if(hit.kind==='impurity'&&compoundHeatHeld)h.textContent=`Добавляется примесь: ${hit.arc.name}.`;
      else if(compoundHeatHeld)h.textContent='Нагрев вне рабочей дуги — отпусти Space.';
      else h.textContent='Удерживай Space только внутри активной цветной дуги.';
      const impurityEl=doc.getElementById('compoundImpurity');
      if(impurityEl){
        const pct=Math.min(100,compoundImpurity).toFixed(1).replace('.0','');
        impurityEl.innerHTML=`<b>Допустимая примесь:</b> ${compoundAllowedImpurity}%<br><b>Текущая примесь:</b> ${pct}%`;
      }
    }
    function setCompoundHeat(v){
      if(compoundStage>=COMPOUND_STAGES.length)return;
      compoundHeatHeld=v;
      if(!v){compoundOutsideHold=0;compoundFaultedHold=false}
      renderCompound();
    }
    function resetCompound(){
      randomizeCompoundShares();
      compoundPulse=0;compoundStage=0;compoundProgress=0;compoundHeatHeld=false;
      compoundOutsideHold=0;compoundFaultedHold=false;compoundLastBubble=0;compoundLast=performance.now();
      compoundImpurity=0;compoundAllowedImpurity=8+Math.floor(Math.random()*11);compoundBursting=false;compoundManualLayers=[];
      renderCompound();waveLiquid(compoundTubeStack,1.02);
    }
    function compoundLoop(now){
      const dt=Math.min(.05,(now-compoundLast)/1000);compoundLast=now;
      if(activeGameName()!=='Давление + осаждение'){requestAnimationFrame(compoundLoop);return}
      compoundPulse=(compoundPulse+dt*compoundSpeed)%360;

      if(compoundStage<COMPOUND_STAGES.length&&compoundHeatHeld&&!compoundBursting){
        const s=COMPOUND_STAGES[compoundStage];
        const hit=compoundArcHit();
        if(hit.kind==='target'){
          if(now-compoundLastBubble>650){liquidBurst(compoundTubeStack,6,.85);compoundLastBubble=now}
          compoundProgress+=dt*compoundSpeed/s.length;
          compoundOutsideHold=0;
          if(compoundProgress>=s.passes){
            compoundProgress=s.passes;
            waveLiquid(compoundTubeStack,1.02);
            compoundStage++;
            compoundProgress=0;
            compoundHeatHeld=false;
            compoundOutsideHold=0;compoundFaultedHold=false;
          }
        }else if(hit.kind==='impurity'){
          compoundImpurity=Math.min(100,compoundImpurity+dt*12.5);
          compoundOutsideHold=0;
          if(now-compoundLastBubble>760){liquidBurst(compoundTubeStack,4,.65);compoundLastBubble=now}
          if(compoundImpurity>compoundAllowedImpurity){
            triggerCompoundBurst('Примесь выше допустимого порога');
          }
        }else{
          compoundOutsideHold+=dt;
          if(compoundOutsideHold>.55&&!compoundFaultedHold){
            compoundFaultedHold=true;
            compoundProgress=Math.max(0,compoundProgress-.35);
            triggerCompoundBurst('Нагрев вне цветной дуги');
          }
        }
      }
      renderCompound();
      requestAnimationFrame(compoundLoop);
    }
    const compoundHeatBtn=doc.getElementById('compoundHeat');
    compoundHeatBtn.addEventListener('pointerdown',e=>{e.preventDefault();setCompoundHeat(true)});
    ['pointerup','pointerleave','pointercancel'].forEach(ev=>compoundHeatBtn.addEventListener(ev,()=>setCompoundHeat(false)));
    resetCompound();requestAnimationFrame(compoundLoop);

    const essenceLibrary=[
     {name:'Киноварь',icon:'ti-flame',v:[2,0,0]},
     {name:'Лунная вода',icon:'ti-moon',v:[0,2,0]},
     {name:'Эфирная соль',icon:'ti-wind',v:[0,0,2]},
     {name:'Пыльца',icon:'ti-sun',v:[1,1,0]},
     {name:'Морская пена',icon:'ti-droplet',v:[0,1,1]},
     {name:'Обсидиан',icon:'ti-diamond',v:[1,0,1]}
    ];
    const essenceColors=['#cf6257','#d7b54c','#5e7fd0'];let essenceSelected=new Set(),essenceTarget=[0,0,0],essenceCurrentTopV88=94;
    function sumEssence(indices){const out=[0,0,0];indices.forEach(i=>essenceLibrary[i].v.forEach((v,j)=>out[j]+=v));return out}
    function newEssenceRound(){essenceSelected=new Set();essenceCurrentTopV88=94;const ids=shuffle([0,1,2,3,4,5]).slice(0,3);essenceTarget=sumEssence(ids);renderEssence();const stack=doc.querySelector('#essenceCurrentBars .essence-stack');if(stack){stack.dataset.liquidTopV88=String(essenceCurrentTopV88);animateStackClipLevelV88(stack,essenceCurrentTopV88,{animate:false})}}
    function toggleEssence(i){const from=essenceCurrentTopV88;if(essenceSelected.has(i))essenceSelected.delete(i);else if(essenceSelected.size<3)essenceSelected.add(i);const to=essenceSelected.size?78-(essenceSelected.size-1)*29:94;renderEssence();const stack=doc.querySelector('#essenceCurrentBars .essence-stack');if(stack){stack.dataset.liquidTopV88=String(from);animateStackClipLevelV88(stack,to,{duration:1250,intensity:.75})}essenceCurrentTopV88=to}
    function renderEssenceBars(id,vals){
      const box=doc.getElementById(id);if(!box)return;
      const total=vals.reduce((a,b)=>a+b,0);
      const layers=vals.map((v,i)=>v?`<div class=\"essence-layer\" style=\"height:${(v/Math.max(1,total))*100}%;background:${essenceColors[i]}\"></div>`:'').join('');
      const chips=vals.map((v,i)=>`<span class=\"essence-chip\"><i style=\"background:${essenceColors[i]}\"></i>${['Тело','Дух','Искра'][i]}: ${v}</span>`).join('');
      box.innerHTML=`<div class=\"essence-beaker-card\"><div class=\"test-tube essence-test-tube\"><div class=\"essence-stack ${total?'':'empty'}\">${layers}</div></div><div class=\"essence-chips\">${chips}</div></div>`;
    }
    function renderEssence(){renderEssenceBars('essenceTargetBars',essenceTarget);renderEssenceBars('essenceCurrentBars',sumEssence([...essenceSelected]));const box=doc.getElementById('essenceCards');box.innerHTML='';essenceLibrary.forEach((x,i)=>{const c=document.createElement('button');c.className='essence-card'+(essenceSelected.has(i)?' selected':'');c.innerHTML=`<span class="key">${i+1}</span><i class="ti ${x.icon}"></i><div class="proto-title">${x.name}</div><div class="essence-pips">${x.v.map((v,j)=>Array(v).fill(`<span class="essence-pip" style="background:${essenceColors[j]}"></span>`).join('')).join('')}</div>`;c.onclick=()=>toggleEssence(i);box.appendChild(c)});doc.getElementById('essenceStatus').innerHTML=`<strong>${essenceSelected.size} / 3</strong>ингредиента выбрано`}
    function checkEssence(){const cur=sumEssence([...essenceSelected]),ok=essenceSelected.size===3&&cur.every((v,i)=>v===essenceTarget[i]);doc.getElementById('essenceStatus').innerHTML=ok?'<strong>Баланс совпал</strong>зелье стабильно':'<strong>Баланс неверный</strong>соотношение не совпало';if(!ok)breakFlask('Неверный баланс эссенций')}
    doc.getElementById('essenceCheck').onclick=checkEssence;doc.getElementById('essenceReset').onclick=newEssenceRound;newEssenceRound();

    const layerTypes={
     oil:{name:'Масло',color:'#b68a42'},water:{name:'Вода',color:'#568db7'},ice:{name:'Лёд',color:'#91bfd0'},sludge:{name:'Осадок',color:'#735c49'},crystal:{name:'Кристалл',color:'#a887bb'}
    };
    const layerScenarios=[['oil','water','sludge'],['water','oil','sludge'],['ice','water','sludge'],['oil','ice','sludge']];
    const layerReagentDefs=[
     {name:'Растворитель',icon:'ti-flask',key:'solvent'},
     {name:'Нагрев',icon:'ti-flame',key:'heat'},
     {name:'Соль',icon:'ti-diamond',key:'salt'},
     {name:'Холод',icon:'ti-snowflake',key:'cold'}
    ];
    let layerState=[];
    function resetLayerGame(){layerState=[...layerScenarios[Math.floor(Math.random()*layerScenarios.length)]];renderLayerGame()}
    let layerReactionAnimatingV88=false;function applyLayerReagent(key){if(!layerState.length||layerReactionAnimatingV88)return;const top=layerState[0];let action='none',next=null;if(key==='solvent'&&top==='oil')action='remove';else if(key==='heat'&&top==='water')action='remove';else if(key==='heat'&&top==='ice'){action='transform';next='water'}else if(key==='salt'&&top==='sludge'){action='transform';next='crystal'}else if(key==='cold'&&top==='water'){action='transform';next='ice'}if(action==='none'){breakFlask('Реагент не взаимодействует с верхним слоем');return}const stack=doc.getElementById('layerReactStack'),topEl=stack.querySelector('.layer-react-layer');if(action==='remove'&&topEl){layerReactionAnimatingV88=true;animateLayerRemovalV88(topEl,640,()=>{layerState.shift();renderLayerGame();layerReactionAnimatingV88=false})}else{layerState[0]=next;renderLayerGame();waveLiquid('layerReactStack',.65)}}
    function renderLayerGame(){const stack=doc.getElementById('layerReactStack');stack.innerHTML='';layerState.forEach(t=>{const d=document.createElement('div');d.className='layer-react-layer';d.style.background=layerTypes[t].color;d.textContent=layerTypes[t].name;stack.appendChild(d)});const top=layerState[0];const won=layerState.length===1&&top==='crystal';doc.getElementById('layerTopLabel').textContent=won?'получен чистый кристалл':top?`верхний слой: ${layerTypes[top].name}`:'реактор пуст';doc.getElementById('layerStatus').innerHTML=won?'<strong>Кристалл получен</strong>реакция завершена':'<strong>Цель: кристалл</strong>реагируй с верхним слоем';const box=doc.getElementById('layerReagents');box.innerHTML='';layerReagentDefs.forEach((r,i)=>{const b=document.createElement('button');b.className='layer-reagent';b.innerHTML=`<i class="ti ${r.icon}"></i><strong>${r.name}</strong><div class="proto-sub">клавиша ${i+1}</div>`;b.onclick=()=>applyLayerReagent(r.key);box.appendChild(b)})}
    doc.getElementById('layerReset').onclick=resetLayerGame;resetLayerGame();

    const branchFirst={
     herb:{name:'Живая основа',icon:'ti-leaf',color:'#6e9f62'},
     mineral:{name:'Минеральная основа',icon:'ti-diamond',color:'#8b7f9d'},
     fungus:{name:'Грибная основа',icon:'ti-mushroom',color:'#7f6a54'}
    };
    const branchSecond={
     ember:{name:'Огненный эффект',icon:'ti-flame',color:'#bd6d50'},
     moon:{name:'Лунный эффект',icon:'ti-moon',color:'#7186b5'},
     frost:{name:'Морозный эффект',icon:'ti-snowflake',color:'#82a7bf'}
    };
    const branchThird={
     salt:{name:'Устойчивый',icon:'ti-diamond',color:'#c7b783'},
     ether:{name:'Летучий',icon:'ti-wind',color:'#7f9ca4'},
     resin:{name:'Смолистый',icon:'ti-bottle',color:'#8b684f'}
    };
    const branchReagentDefs=[
     {key:'herb',name:'Трава',icon:'ti-leaf',stage:0},{key:'mineral',name:'Кристалл',icon:'ti-diamond',stage:0},{key:'fungus',name:'Гриб',icon:'ti-mushroom',stage:0},
     {key:'ember',name:'Уголь',icon:'ti-flame',stage:1},{key:'moon',name:'Луна',icon:'ti-moon',stage:1},{key:'frost',name:'Иней',icon:'ti-snowflake',stage:1},
     {key:'salt',name:'Соль',icon:'ti-hexagon',stage:2},{key:'ether',name:'Эфир',icon:'ti-wind',stage:2},{key:'resin',name:'Смола',icon:'ti-bottle',stage:2}
    ];
    const branchStagePool=[['herb','mineral','fungus'],['ember','moon','frost'],['salt','ether','resin']];
    const branchNameParts={
     herb:'Травяной',mineral:'Каменный',fungus:'Грибной',
     ember:'огненный',moon:'лунный',frost:'морозный',
     salt:'эликсир',ether:'настой',resin:'экстракт'
    };
    let branchTarget=['herb','ember','salt'],branchPath=[];
    function branchMeta(k){return branchFirst[k]||branchSecond[k]||branchThird[k]}
    function branchElixirName(path){
      if(!path||path.length<3)return '—';
      return `${branchNameParts[path[0]]} ${branchNameParts[path[1]]} ${branchNameParts[path[2]]}`;
    }
    function newBranchTarget(){branchTarget=branchStagePool.map(arr=>arr[Math.floor(Math.random()*arr.length)]);branchPath=[];renderBranch();setSingleLiquidLevelV88('branchLiquid',branchLevelTopV88(),{animate:true,duration:900,intensity:.6})}
    function chooseBranchReagent(key){const stage=branchPath.length,def=branchReagentDefs.find(x=>x.key===key);if(stage>=3)return;if(!def||def.stage!==stage){breakFlask('Реагент добавлен не на своей стадии');return}branchPath.push(key);renderBranch();setSingleLiquidLevelV88('branchLiquid',branchLevelTopV88(),{duration:1450,intensity:1})}
    function branchCurrentColor(){if(!branchPath.length)return [198,190,172];let cols=branchPath.map(k=>{const c=branchMeta(k).color.replace('#','');return [parseInt(c.slice(0,2),16),parseInt(c.slice(2,4),16),parseInt(c.slice(4,6),16)]});return [0,1,2].map(i=>Math.round(cols.reduce((a,c)=>a+c[i],0)/cols.length))}
    function renderBranch(){
      doc.getElementById('branchTargetName').textContent=branchElixirName(branchTarget);
      const tags=doc.getElementById('branchTargetTags');tags.innerHTML='';
      branchTarget.forEach(k=>{const m=branchMeta(k),t=document.createElement('span');t.className='branch-tag';t.innerHTML=`<i class="ti ${m.icon}"></i> ${m.name}`;tags.appendChild(t)});
      setBg('branchLiquid',branchCurrentColor());
      doc.getElementById('branchCurrentName').textContent=branchPath.length?branchMeta(branchPath.at(-1)).name:'Базовый настой';
      const steps=doc.getElementById('branchSteps');steps.innerHTML='';for(let i=0;i<3;i++){const s=document.createElement('span');s.className='branch-step'+(i<branchPath.length?' done':'');steps.appendChild(s)}
      const box=doc.getElementById('branchReagents');box.innerHTML='';
      const stage=branchPath.length;
      branchReagentDefs.forEach((r,i)=>{const selected=branchPath.includes(r.key),available=r.stage===stage;const b=document.createElement('button');b.className='branch-reagent '+(selected?'selected':available?'available':'muted');b.innerHTML=`<i class="ti ${r.icon}"></i>${r.name}<small>${i+1}</small>`;b.disabled=!available&&!selected;b.onclick=()=>{if(available)chooseBranchReagent(r.key)};box.appendChild(b)});
      if(stage===3){const ok=branchPath.every((v,i)=>v===branchTarget[i]);doc.getElementById('branchStatus').innerHTML=ok?'<strong>Эликсир готов</strong>ветка собрана верно':'<strong>Получился другой эликсир</strong>целевая ветка не совпала';if(!ok){breakFlask('Сварен неверный эликсир');branchPath=[];setTimeout(renderBranch,10)}}
      else doc.getElementById('branchStatus').innerHTML=`<strong>Шаг ${stage+1} / 3</strong>${['выбери основу','выбери эффект','выбери стабилизатор'][stage]}`
    }
    doc.getElementById('branchReset').onclick=newBranchTarget;newBranchTarget();

    function activeGameName(){const s=doc.querySelector('.scene.active');return s?s.dataset.name:''}
    document.addEventListener('keydown',e=>{if(e.ctrlKey||e.metaKey||e.altKey)return;const tag=(e.target&&e.target.tagName||'').toLowerCase();if(tag==='input'||tag==='textarea'||tag==='select')return;const game=activeGameName();let handled=true;if(game==='Порядок'){if(['1','2','3','4'].includes(e.key))chooseSequence(Number(e.key)-1);else if(e.code==='KeyR')randomizeSequence();else handled=false}else if(game==='Перегонка'){if(['1','2','3','4','5'].includes(e.key))captureDistill(Number(e.key)-1);else handled=false}else if(game==='Формула'){const map={'1':0,'2':1,'3':2,'4':3,'5':4,'6':5,'7':6,'8':7,'9':8,'q':9,'w':10,'e':11},k=e.key.toLowerCase();if(k in map)chooseIngredientByIndex(map[k]);else if(e.key==='Enter')checkRecipe();else if(e.code==='KeyR')resetRecipe();else handled=false}else if(game==='Смешение'){if(e.key==='1'){if(mixAmts[0]<MAX_DROPS_PER_REAGENT)mixAmts[0]++;drawMix();setSingleLiquidLevelV88('mixCurrent',mixLevelTopV88(),{duration:820,intensity:1})}else if(e.key==='2'){if(mixAmts[1]<MAX_DROPS_PER_REAGENT)mixAmts[1]++;drawMix();setSingleLiquidLevelV88('mixCurrent',mixLevelTopV88(),{duration:820,intensity:1})}else if(e.key==='3'){if(mixAmts[2]<MAX_DROPS_PER_REAGENT)mixAmts[2]++;drawMix();setSingleLiquidLevelV88('mixCurrent',mixLevelTopV88(),{duration:820,intensity:1})}else if(e.key==='4'){if(mixAmts[3]<MAX_DROPS_PER_REAGENT)mixAmts[3]++;drawMix();setSingleLiquidLevelV88('mixCurrent',mixLevelTopV88(),{duration:820,intensity:1})}else if(e.key==='Enter')doc.getElementById('mixCheck').click();else if(e.code==='KeyR')doc.getElementById('mixReset').click();else handled=false}else if(game==='Концентрации'){if(e.key==='1'){if(unkAmts[0]<MAX_DROPS_PER_REAGENT)unkAmts[0]++;drawUnknown();setSingleLiquidLevelV88('unknownCurrent',unknownLevelTopV88(),{duration:820,intensity:1})}else if(e.key==='2'){if(unkAmts[1]<MAX_DROPS_PER_REAGENT)unkAmts[1]++;drawUnknown();setSingleLiquidLevelV88('unknownCurrent',unknownLevelTopV88(),{duration:820,intensity:1})}else if(e.key==='3'){if(unkAmts[2]<MAX_DROPS_PER_REAGENT)unkAmts[2]++;drawUnknown();setSingleLiquidLevelV88('unknownCurrent',unknownLevelTopV88(),{duration:820,intensity:1})}else if(e.key==='4'){if(unkAmts[3]<MAX_DROPS_PER_REAGENT)unkAmts[3]++;drawUnknown();setSingleLiquidLevelV88('unknownCurrent',unknownLevelTopV88(),{duration:820,intensity:1})}else if(e.key==='Enter')doc.getElementById('unknownCheck').click();else if(e.code==='KeyR')doc.getElementById('unknownReset').click();else handled=false}else if(game==='Разделение'){if(['1','2','3','4'].includes(e.key)){const b=doc.querySelectorAll('#sepControls .small-btn')[Number(e.key)-1];if(b)b.click()}else if(e.key==='Enter')doc.getElementById('sepCheck').click();else if(e.code==='KeyR')doc.getElementById('sepReset').click();else handled=false}else if(game==='Давление + осаждение'){if(e.code==='Space'){setCompoundHeat(true)}else if(e.code==='KeyR')resetCompound();else handled=false}else if(game==='Баланс эссенций'){if(['1','2','3','4','5','6'].includes(e.key))toggleEssence(Number(e.key)-1);else if(e.key==='Enter')checkEssence();else if(e.code==='KeyR')newEssenceRound();else handled=false}else if(game==='Реакции слоёв'){if(['1','2','3','4'].includes(e.key))applyLayerReagent(layerReagentDefs[Number(e.key)-1].key);else if(e.code==='KeyR')resetLayerGame();else handled=false}else if(game==='Ветвящийся рецепт'){if(['1','2','3','4','5','6','7','8','9'].includes(e.key))chooseBranchReagent(branchReagentDefs[Number(e.key)-1].key);else if(e.code==='KeyR')newBranchTarget();else handled=false}else handled=false;if(handled)e.preventDefault()});
    document.addEventListener('keyup',e=>{if(activeGameName()==='Давление + осаждение'&&e.code==='Space'){e.preventDefault();setCompoundHeat(false)}});

    document.addEventListener('pointerdown',e=>{
      const tube=e.target.closest('.test-tube,.compound-test-tube-v12,.layer-react-tube');
      if(!tube)return;
      const liquid=tube.querySelector('.tube-liquid,.sequence-liquid-stack,.formula-tube-stack-v8,.compound-tube-stack-v12,.vapor');
      if(liquid)waveLiquid(liquid,.75);
    });


  }


  window.Alchemy = {
    start(){
      alchemyRunning = true;
      if(!alchemyReady){ alchemyReady = true; boot(); }
      releaseParked();
    },
    stop(){ alchemyRunning = false; }
  };
  })();

/* Station switching inside the lair panel. Only three of the ten are wired up,
   so this drives them by index over whatever scenes are present. */
(function(){
  const root = document.querySelector('#alchemyRoot');
  if(!root) return;
  const tabs = [...root.querySelectorAll('.alchemyStationTab')];
  const scenes = () => [...root.querySelectorAll('.scene')];
  function show(i){
    tabs.forEach((t, n) => t.classList.toggle('active', n === i));
    scenes().forEach((s, n) => s.classList.toggle('active', n === i));
  }
  // The prototype was a catalogue: every station carried its own heading and
  // status line because they scrolled past one another. Here the window is the
  // frame, so the heading is dropped, the verdict is moved down beside the
  // actions where it can be pinned, and the reagents are lifted out of the
  // cluster that squared them around the flask.
  function reframe(scene){
    if(scene.dataset.reframed) return;
    scene.dataset.reframed = '1';
    scene.querySelector('.scene-head h2')?.closest('div')?.remove();
    const lab = scene.querySelector('.lab');
    const actions = scene.querySelector('.big-actions');
    const status = scene.querySelector('.status');
    const controls = scene.querySelector('.color-controls');
    const pair = scene.querySelector('.tube-pair');
    // Reagents come out of the lab entirely. Inside it they sat in an absolute
    // grid of named corners around the flask, and no amount of overriding kept
    // them from painting over everything below. Out here they are a plain band
    // that always sits between the glassware and the verdict.
    if(lab && actions && status){
      const foot = document.createElement('div');
      foot.className = 'alchemyFoot';
      foot.append(status, actions);
      if(controls){
        const band = document.createElement('div');
        band.className = 'alchemyReagents';
        band.append(controls);
        scene.append(band);
      }
      scene.append(foot);
    }
  }

  tabs.forEach((t, i) => t.addEventListener('click', () => show(i)));
  scenes().forEach(reframe);
  show(0);
})();

/* Ingredient rack: pick one of seven bottles by its Latin name (the name
   itself isn't shown on the shelf — the bottle's medallion carries its
   alchemical symbol instead, and the verdict line names it on selection).
   Just a selection for now — remembers which element is chosen and shows
   its name back, the way the mixing stations show a verdict. What the
   choice unlocks (which elixir recipes it gates) is the planned next
   step, mirrored on the tension-tool type match in
   js/core/inventory-hit-testing.js: a lock only opens for the matching
   tool, an elixir will only brew from the matching element. */
(function(){
  const root = document.querySelector('#alchemyRoot');
  if(!root) return;
  const bottles = [...root.querySelectorAll('.alchemyRackBottle')];
  const statusEl = root.querySelector('#alchemyRackStatus');
  if(!bottles.length || !statusEl) return;
  function select(el){
    const element = el.dataset.element;
    bottles.forEach(b => b.classList.toggle('selected', b === el));
    const name = element.charAt(0).toUpperCase() + element.slice(1);
    statusEl.innerHTML = `<strong>${name}</strong>элемент выбран для варки`;
  }
  bottles.forEach(b => b.addEventListener('click', () => select(b)));
})();
