  // ===== INTERNAL GAME CATALOG SETTINGS =====
  (()=>{
    const screen=document.querySelector('#gameSettingsScreen');
    const rows=document.querySelector('#gameSettingsRows');
    const empty=document.querySelector('#gameSettingsEmpty');
    const search=document.querySelector('#gameSettingsSearch');
    const table=document.querySelector('.gameSettingsTable');
    const musicVolume=document.querySelector('#gameMusicVolume');
    const musicVolumeValue=document.querySelector('#gameMusicVolumeValue');
    const recentStorageKey='keynlockRecentlyOpenedGames';
    let recentGames=[];
    try{recentGames=JSON.parse(STORE.getItem(recentStorageKey)||'[]').filter(id=>GameCatalog.has(id)).slice(0,3);}catch(_){recentGames=[];}
    let sortPath='title';
    let sortDirection=1;
    let settingsReturnToLair=false;
    const featureColumns=[
      ['lock.present','Физический замок'],
      ['lock.manualOpen','Отдельное открытие'],
      ['lock.specialTool','Особый натяжитель'],
      ['world.noise','Шум'],
      ['world.noiseSensor','Датчик шума'],
      ['world.guards','Стражники'],
      ['world.birds','Птицы']
    ];

    function syncMusicVolume(){
      if(!musicVolume)return;
      const value=window.KeynlockAudio?.getMusicVolume?.() ?? 28;
      musicVolume.value=String(value);
      if(musicVolumeValue)musicVolumeValue.value=`${value}%`;
    }

    function recordRecentGame(id){
      if(!GameCatalog.has(id))return;
      recentGames=[id,...recentGames.filter(saved=>saved!==id)].slice(0,3);
      try{STORE.setItem(recentStorageKey,JSON.stringify(recentGames));}catch(_){}
      if(!screen?.hidden)renderGameSettings();
    }

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
      const select=document.createElement('select');
      select.className='gameNumberSelect';
      select.dataset.gameId=gameId;
      select.dataset.feature='readiness';
      select.setAttribute('aria-label',`Готовность: ${gameId}`);
      for(let number=1;number<=5;number++)select.add(new Option(String(number),String(number),false,number===value));
      return select;
    }

    function ratingControl(gameId,value){
      const select=document.createElement('select');
      select.className='gameNumberSelect';
      select.dataset.gameId=gameId;
      select.dataset.feature='rating';
      select.setAttribute('aria-label',`Рейтинг: ${gameId}`);
      select.add(new Option('—','',false,value===null));
      for(let number=1;number<=5;number++)select.add(new Option(String(number),String(number),false,number===value));
      return select;
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
      }).sort((a,b)=>{
        const recentA=recentGames.indexOf(a);
        const recentB=recentGames.indexOf(b);
        if(recentA!==-1||recentB!==-1){
          if(recentA===-1)return 1;
          if(recentB===-1)return -1;
          return recentA-recentB;
        }
        return compareGames(a,b);
      });
      rows.replaceChildren();
      visible.forEach(id=>{
        const game=GameCatalog.get(id);
        const tr=document.createElement('tr');
        tr.dataset.gameId=id;
        const name=document.createElement('th');
        name.scope='row';
        name.innerHTML=`<button class="gameLaunchButton" type="button" aria-label="Перейти в игру"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"></path></svg></button><span class="gameSettingName"><button class="gameNameText" type="button"></button></span>`;
        name.querySelector('button').dataset.launchGame=id;
        name.querySelector('.gameNameText').dataset.launchGame=id;
        name.querySelector('.gameNameText').setAttribute('aria-label',`Открыть ${game.title}, первый уровень`);
        name.querySelector('.gameNameText').innerHTML='<strong></strong><small></small>';
        name.querySelector('strong').textContent=game.title;
        name.querySelector('small').textContent=id;
        if(game.readiness===5){
          const ready=document.createElement('span');
          ready.className='gameReadyMark';
          ready.textContent='✓';
          ready.title='Готово';
          name.querySelector('strong').appendChild(ready);
        }
        const difficulty=document.createElement('span');
        difficulty.className='gameDifficulty';
        difficulty.setAttribute('aria-label','Сложность');
        const supportedLevels=game.difficulty.levels.length?game.difficulty.levels:[1];
        [1,2,3].forEach(level=>{
          const supported=supportedLevels.includes(level);
          const button=document.createElement('button');
          button.type='button';
          button.dataset.gameDifficulty=id;
          button.dataset.level=String(level);
          button.textContent=String(level);
          button.disabled=!supported;
          button.classList.toggle('unsupported',!supported);
          button.title=supported?`Уровень ${level}`:`Уровень ${level} ещё не готов`;
          button.classList.toggle('active',supported&&game.kind==='native'&&id===mode&&getModeDifficulty(id)===level);
          button.setAttribute('aria-label',`${game.title}: сложность ${level}${supported?'':' недоступна'}`);
          difficulty.appendChild(button);
        });
        if(supportedLevels.length<3){
          const note=document.createElement('em');
          note.className='gameLevelsNote';
          note.textContent='только 1 уровень';
          difficulty.appendChild(note);
        }
        name.querySelector('.gameSettingName').appendChild(difficulty);
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

    function launchGame(id,level=1){
      const game=GameCatalog.get(id);
      if(!game?.difficulty.levels.includes(level)){
        toast(`${game?.title||id}: уровень ${level} ещё не готов`);
        return;
      }
      closeGameSettings(false);
      if(game?.kind==='native'){
        setModeDifficulty(level,id,false);
        switchMode(id,true);
      }
    }

    function openGameSettings(){
      if(!screen)return;
      settingsReturnToLair=lairOpen;
      if(lairOpen)closeLair();
      if(mapOpen)closeMap(false);
      document.body.classList.add('game-settings-open');
      setGameInactive(true);
      screen.hidden=false;
      syncMusicVolume();
      renderGameSettings();
      requestAnimationFrame(()=>search?.focus({preventScroll:true}));
    }

    function closeGameSettings(restorePrevious=true){
      if(!screen||screen.hidden)return;
      const restoreLair=restorePrevious&&settingsReturnToLair;
      settingsReturnToLair=false;
      screen.hidden=true;
      document.body.classList.remove('game-settings-open');
      setGameInactive(false);
      render();
      if(restoreLair)openLair();
    }

    document.querySelector('#gameSettingsButton')?.addEventListener('click',openGameSettings);
    document.querySelector('#gameSettingsClose')?.addEventListener('click',()=>closeGameSettings(true));
    screen?.addEventListener('pointerdown',event=>{if(event.target===screen)closeGameSettings(true);});
    search?.addEventListener('input',renderGameSettings);
    musicVolume?.addEventListener('input',()=>{
      const value=window.KeynlockAudio?.setMusicVolume?.(Number(musicVolume.value)/100) ?? Number(musicVolume.value);
      if(musicVolumeValue)musicVolumeValue.value=`${value}%`;
    });
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
      if(input.dataset.feature==='readiness'){
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
        const gameId=difficulty.dataset.gameDifficulty;
        const level=Number(difficulty.dataset.level)||1;
        launchGame(gameId,level);
        return;
      }
      const button=event.target.closest?.('[data-launch-game]');
      if(!button)return;
      launchGame(button.dataset.launchGame);
    });
    addEventListener('keynlock-game-opened',event=>recordRecentGame(event.detail?.id));
    addEventListener('keydown',event=>{
      if(event.code!=='Escape'||!document.body.classList.contains('game-settings-open'))return;
      event.preventDefault();
      event.stopImmediatePropagation();
      closeGameSettings(true);
    },{capture:true});

    window.openGameSettings=openGameSettings;
    window.closeGameSettings=closeGameSettings;
  })();
