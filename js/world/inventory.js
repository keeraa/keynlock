  function inventoryEls(){
    return {
      root:document.querySelector('#inventoryDrawer'),
      toggle:document.querySelector('#inventoryToggle'),
      pickRail:document.querySelector('#inventoryPickRail'),
      tensionRail:document.querySelector('#inventoryTensionRail'),
      avatar:document.querySelector('#inventoryAvatar')
    };
  }

  function triggerInventoryBreakAnimation(slot){
    inventoryBrokenSlot = Math.max(0, Math.min(5, Number(slot)||0));
    if(inventoryBreakTimer) clearTimeout(inventoryBreakTimer);
    inventoryBreakTimer = setTimeout(()=>{
      inventoryBrokenSlot = 0;
      renderInventoryTools();
    }, 280);
  }

  function setInventoryOpen(force){
    const {root,toggle}=inventoryEls();
    if(!root || !toggle) return;
    const next=typeof force==='boolean' ? force : !root.classList.contains('open');
    root.classList.toggle('open',next);
    document.body.classList.toggle('inventory-open',next);
    toggle.setAttribute('aria-expanded',next?'true':'false');
    toggle.setAttribute('aria-label',next?'Закрыть инвентарь':'Открыть инвентарь');
  }

  function renderInventoryAvatar(){
    const {avatar}=inventoryEls();
    if(!avatar) return;
    const ch=LAIR_CHARACTERS[lairCharacter] || LAIR_CHARACTERS.kai;
    avatar.innerHTML=ch?.portrait
      ? `<img src="${ch.portrait}" alt="${ch.name}">`
      : `<span>${(ch?.name||'К')[0]}</span>`;
  }

  function inventoryTool(kind,index,src,label,options={}){
    const btn=document.createElement('button');
    btn.type='button';
    const active=kind==='pick' ? pickSkin===index : tensionSkin===index;
    btn.className=`inventoryTool inventoryTool-${kind}${active?' selected':''}`;
    if(options.hidden) btn.classList.add('hidden-slot');
    if(options.breaking) btn.classList.add('breaking-out');
    if(options.hidden || options.breaking) btn.disabled = true;
    btn.title=label;
    btn.setAttribute('aria-label',label);
    const img=document.createElement('img');
    img.src=src;
    img.alt='';
    btn.appendChild(img);
    if(!(options.hidden || options.breaking)) btn.addEventListener('click',e=>{
      e.stopPropagation();
      if(kind==='pick') selectPickSkin(index);
      else selectTensionSkin(index);
    });
    return btn;
  }

  function renderInventoryTools(){
    const {pickRail,tensionRail}=inventoryEls();
    if(!pickRail || !tensionRail) return;
    pickRail.replaceChildren();
    tensionRail.replaceChildren();

    const visiblePicks=Math.max(0, Math.min(pickCapacity, picks));
    pickRail.style.gridTemplateColumns = 'repeat(5,1fr)';
    pickRail.style.opacity = pickCapacity > 0 ? '1' : '.45';

    for(let i=1;i<=5;i++){
      const pickIndex=i;
      const isAvailable=i<=visiblePicks;
      const isBreaking=(i===inventoryBrokenSlot && i===visiblePicks+1 && i<=pickCapacity+1);
      const isRenderable=isAvailable || isBreaking;
      const btn=inventoryTool('pick',pickIndex,PICK_SKINS[pickIndex],`Отмычка ${pickIndex} · слот ${i}${isAvailable ? ` · осталось ${visiblePicks}` : ''}`,{
        hidden: !isRenderable,
        breaking: isBreaking
      });
      btn.dataset.pickIndex=String(pickIndex);
      btn.dataset.slot=String(i);
      pickRail.appendChild(btn);
    }

    tensionRail.style.gridTemplateColumns = 'repeat(5,1fr)';
    for(let i=1;i<=5;i++){
      tensionRail.appendChild(inventoryTool('tension',i,TENSION_SKINS[i],`Натяжитель · ${TENSION_SKIN_LABELS[i]||`Вариант ${i}`}`));
    }
  }

  function initInventoryDrawer(){
    const {toggle,root}=inventoryEls();
    renderInventoryTools();
    renderInventoryAvatar();
    window.setInventoryOpen = setInventoryOpen;
    toggle?.addEventListener('click',e=>{
      e.stopPropagation();
      setInventoryOpen();
    });
    if(!initInventoryDrawer._outsideBound){
      document.addEventListener('pointerdown',function(e){
        const currentRoot=document.querySelector('#inventoryDrawer');
        if(!currentRoot || !currentRoot.classList.contains('open')) return;
        if(currentRoot.contains(e.target)) return;
        setInventoryOpen(false);
      },true);
      initInventoryDrawer._outsideBound = true;
    }
  }

