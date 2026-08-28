  // ===== INTERNAL GAME CATALOG SETTINGS =====
  (()=>{
    const screen=document.querySelector('#gameSettingsScreen');
    const rows=document.querySelector('#gameSettingsRows');
    const empty=document.querySelector('#gameSettingsEmpty');
    const search=document.querySelector('#gameSettingsSearch');
    const table=document.querySelector('.gameSettingsTable');
    let sortPath='title';
    let sortDirection=1;
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
      input.min='1';
      input.max='5';
      input.step='1';
      input.value=String(value);
      input.dataset.gameId=gameId;
      input.dataset.feature='readiness';
      input.setAttribute('aria-label','Готовность');
      const output=document.createElement('output');
      output.value=`${value}/5`;
      output.textContent=`${value}/5`;
      control.append(input,output);
      return control;
    }

    function ratingControl(gameId,value){
      const input=document.createElement('input');
      input.className='gameRatingInput';
      input.type='number';
      input.min='1';
      input.max='10';
      input.step='1';
      input.inputMode='numeric';
      input.placeholder='—';
      input.value=value??'';
      input.dataset.gameId=gameId;
      input.dataset.feature='rating';
      input.setAttribute('aria-label',`Рейтинг: ${gameId}`);
      return input;
    }

    function sortValue(id,path){
      const game=GameCatalog.get(id);
      return path==='title'?game.title:GameCatalog.feature(id,path);
    }

    function compareGames(a,b){
      const left=sortValue(a,sortPath);
      const right=sortValue(b,sortPath);
      if(left===null&&right===null)return 0;
      if(left===null)return 1;
      if(right===null)return -1;
      if(typeof left==='string')return left.localeCompare(right,'ru',{sensitivity:'base'})*sortDirection;
      return ((Number(left)||0)-(Number(right)||0))*sortDirection;
    }

    function renderSortIndicators(){
      table?.querySelectorAll('[data-sort]').forEach(button=>{
        const active=button.dataset.sort===sortPath;
        button.classList.toggle('active',active);
        button.setAttribute('aria-sort',active?(sortDirection>0?'ascending':'descending'):'none');
        const indicator=button.querySelector('span');
        if(indicator)indicator.textContent=active?(sortDirection>0?'А→Я':'Я→А'):'';
      });
    }

    function renderGameSettings(){
      if(!rows)return;
      const query=(search?.value||'').trim().toLocaleLowerCase('ru');
      const ids=[...GameCatalog.nativeIds,...GameCatalog.prototypeIds];
      const visible=ids.filter(id=>{
        const game=GameCatalog.get(id);
        return !query||game.title.toLocaleLowerCase('ru').includes(query)||id.includes(query);
      }).sort(compareGames);
      rows.replaceChildren();
      visible.forEach(id=>{
        const game=GameCatalog.get(id);
        const tr=document.createElement('tr');
        tr.dataset.gameId=id;
        const name=document.createElement('th');
        name.scope='row';
        name.innerHTML=`<button class="gameLaunchButton" type="button" aria-label="Перейти в игру"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"></path></svg></button><span class="gameSettingName"><strong></strong><small></small></span>`;
        name.querySelector('button').dataset.launchGame=id;
        name.querySelector('strong').textContent=game.title;
        name.querySelector('small').textContent=id;
        if(game.readiness===5){
          const ready=document.createElement('span');
          ready.className='gameReadyMark';
          ready.textContent='✓';
          ready.title='Готово';
          name.querySelector('strong').appendChild(ready);
        }
        if(game.difficulty.levels.length){
          const difficulty=document.createElement('span');
          difficulty.className='gameDifficulty';
          difficulty.setAttribute('aria-label','Сложность');
          game.difficulty.levels.forEach(level=>{
            const button=document.createElement('button');
            button.type='button';
            button.dataset.gameDifficulty=id;
            button.dataset.level=String(level);
            button.textContent=String(level);
            button.classList.toggle('active',getModeDifficulty(id)===level);
            button.setAttribute('aria-label',`${game.title}: сложность ${level}`);
            difficulty.appendChild(button);
          });
          name.querySelector('.gameSettingName').appendChild(difficulty);
        }
        tr.appendChild(name);
        featureColumns.forEach(([path,label])=>{
          const td=document.createElement('td');
          td.appendChild(checkbox(id,path,label,GameCatalog.feature(id,path)));
          tr.appendChild(td);
        });
        const readiness=document.createElement('td');
        readiness.appendChild(readinessControl(id,game.readiness));
        tr.appendChild(readiness);
        const rating=document.createElement('td');
        rating.appendChild(ratingControl(id,game.rating));
        tr.appendChild(rating);
        rows.appendChild(tr);
      });
      if(empty)empty.hidden=visible.length>0;
      renderSortIndicators();
    }

    function launchGame(id){
      closeGameSettings();
      const game=GameCatalog.get(id);
      if(game?.kind==='native'){switchMode(id);return;}
      const location=MAP_LOCATIONS[`prototype-${id.replace(/^prototype:/,'')}`];
      if(location)openPrototypeMechanic(location);
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
    table?.querySelector('thead')?.addEventListener('click',event=>{
      const button=event.target.closest?.('[data-sort]');
      if(!button)return;
      if(sortPath===button.dataset.sort)sortDirection*=-1;
      else{sortPath=button.dataset.sort;sortDirection=1;}
      renderGameSettings();
    });
    rows?.addEventListener('input',event=>{
      const input=event.target.closest?.('[data-game-id][data-feature]');
      if(!input)return;
      const value=input.type==='checkbox'?input.checked:input.dataset.feature==='rating'?input.value:Number(input.value);
      GameCatalog.setFeature(input.dataset.gameId,input.dataset.feature,value);
      if(input.type==='range'){
        const output=input.parentElement?.querySelector('output');
        if(output){output.value=`${input.value}/5`;output.textContent=`${input.value}/5`;}
        const title=input.closest('tr')?.querySelector('.gameSettingName strong');
        const mark=title?.querySelector('.gameReadyMark');
        if(input.value==='5'&&!mark){
          const ready=document.createElement('span');ready.className='gameReadyMark';ready.textContent='✓';ready.title='Готово';title?.appendChild(ready);
        }else if(input.value!=='5')mark?.remove();
      }
    });
    rows?.addEventListener('click',event=>{
      const difficulty=event.target.closest?.('[data-game-difficulty]');
      if(difficulty){
        setModeDifficulty(Number(difficulty.dataset.level),difficulty.dataset.gameDifficulty,false);
        difficulty.parentElement?.querySelectorAll('button').forEach(button=>button.classList.toggle('active',button===difficulty));
        return;
      }
      const button=event.target.closest?.('[data-launch-game]');
      if(!button)return;
      launchGame(button.dataset.launchGame);
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
