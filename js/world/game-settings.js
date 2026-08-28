  // ===== INTERNAL GAME CATALOG SETTINGS =====
  (()=>{
    const screen=document.querySelector('#gameSettingsScreen');
    const rows=document.querySelector('#gameSettingsRows');
    const empty=document.querySelector('#gameSettingsEmpty');
    const search=document.querySelector('#gameSettingsSearch');
    const kind=document.querySelector('#gameSettingsKind');
    const featureColumns=[
      ['lock.present','Физический замок'],
      ['lock.manualOpen','Отдельное открытие'],
      ['world.noise','Шум'],
      ['world.noiseSensor','Датчик шума'],
      ['world.guards','Стражники'],
      ['world.birds','Птицы']
    ];

    function checkbox(gameId,path,label,checked){
      const control=document.createElement('label');
      control.className='gameSettingToggle';
      control.title=label;
      const input=document.createElement('input');
      input.type='checkbox';
      input.checked=!!checked;
      input.dataset.gameId=gameId;
      input.dataset.feature=path;
      input.setAttribute('aria-label',`${label}: ${gameId}`);
      const mark=document.createElement('span');
      mark.setAttribute('aria-hidden','true');
      control.append(input,mark);
      return control;
    }

    function readinessControl(gameId,value){
      const control=document.createElement('div');
      control.className='gameReadiness';
      const input=document.createElement('input');
      input.type='range';
      input.min='0';
      input.max='100';
      input.step='5';
      input.value=String(value);
      input.dataset.gameId=gameId;
      input.dataset.feature='readiness';
      input.setAttribute('aria-label','Готовность');
      const output=document.createElement('output');
      output.value=`${value}%`;
      output.textContent=`${value}%`;
      control.append(input,output);
      return control;
    }

    function renderGameSettings(){
      if(!rows)return;
      const query=(search?.value||'').trim().toLocaleLowerCase('ru');
      const filter=kind?.value||'all';
      const ids=[...GameCatalog.nativeIds,...GameCatalog.prototypeIds];
      const visible=ids.filter(id=>{
        const game=GameCatalog.get(id);
        return (filter==='all'||game.kind===filter) && (!query||game.title.toLocaleLowerCase('ru').includes(query)||id.includes(query));
      });
      rows.replaceChildren();
      visible.forEach(id=>{
        const game=GameCatalog.get(id);
        const tr=document.createElement('tr');
        tr.dataset.gameId=id;
        const name=document.createElement('th');
        name.scope='row';
        name.innerHTML=`<strong></strong><small></small>`;
        name.querySelector('strong').textContent=game.title;
        name.querySelector('small').textContent=id;
        tr.appendChild(name);
        const type=document.createElement('td');
        const badge=document.createElement('span');
        badge.className=`gameKindBadge ${game.kind}`;
        badge.textContent=game.kind==='native'?'Встроенная':'Перенесённая';
        type.appendChild(badge);
        tr.appendChild(type);
        featureColumns.forEach(([path,label])=>{
          const td=document.createElement('td');
          td.appendChild(checkbox(id,path,label,GameCatalog.feature(id,path)));
          tr.appendChild(td);
        });
        const readiness=document.createElement('td');
        readiness.appendChild(readinessControl(id,game.readiness));
        tr.appendChild(readiness);
        const actions=document.createElement('td');
        const reset=document.createElement('button');
        reset.type='button';
        reset.className='gameSettingReset';
        reset.dataset.resetGame=id;
        reset.textContent='Сбросить';
        actions.appendChild(reset);
        tr.appendChild(actions);
        rows.appendChild(tr);
      });
      if(empty)empty.hidden=visible.length>0;
    }

    function openGameSettings(){
      if(!screen)return;
      closeMobileModeMenu?.();
      if(shopOpen)closeShop();
      if(lairOpen)closeLair();
      if(mapOpen)closeMap();
      leavePrototypeMechanic?.();
      document.body.classList.add('game-settings-open');
      setGameInactive(true);
      screen.hidden=false;
      renderGameSettings();
      requestAnimationFrame(()=>search?.focus({preventScroll:true}));
    }

    function closeGameSettings(){
      if(!screen||screen.hidden)return;
      screen.hidden=true;
      document.body.classList.remove('game-settings-open');
      setGameInactive(false);
      render();
      document.querySelector('#mobileModeMenuButton')?.focus({preventScroll:true});
    }

    document.querySelector('#gameSettingsButton')?.addEventListener('click',openGameSettings);
    document.querySelector('#gameSettingsClose')?.addEventListener('click',closeGameSettings);
    screen?.addEventListener('pointerdown',event=>{if(event.target===screen)closeGameSettings();});
    search?.addEventListener('input',renderGameSettings);
    kind?.addEventListener('change',renderGameSettings);
    rows?.addEventListener('input',event=>{
      const input=event.target.closest?.('[data-game-id][data-feature]');
      if(!input)return;
      const value=input.type==='checkbox'?input.checked:Number(input.value);
      GameCatalog.setFeature(input.dataset.gameId,input.dataset.feature,value);
      if(input.type==='range'){
        const output=input.parentElement?.querySelector('output');
        if(output){output.value=`${input.value}%`;output.textContent=`${input.value}%`;}
      }
    });
    rows?.addEventListener('click',event=>{
      const button=event.target.closest?.('[data-reset-game]');
      if(!button)return;
      GameCatalog.reset(button.dataset.resetGame);
      renderGameSettings();
    });
    document.querySelector('#gameSettingsResetAll')?.addEventListener('click',()=>{
      GameCatalog.reset();
      renderGameSettings();
    });
    addEventListener('keydown',event=>{
      if(event.code!=='Escape'||!document.body.classList.contains('game-settings-open'))return;
      event.preventDefault();
      event.stopImmediatePropagation();
      closeGameSettings();
    },{capture:true});

    window.openGameSettings=openGameSettings;
    window.closeGameSettings=closeGameSettings;
  })();
