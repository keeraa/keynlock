/* Integrated runtime for the mechanics originally delivered as a standalone page.
 * The source document is parsed once into an isolated shadow tree; games then
 * switch like native modes without creating or navigating an iframe.
 */
(()=>{
  const host=document.querySelector('#prototypeMechanicHost');
  if(!host)return;
  let runtime=null;

  async function loadRuntime(){
    const response=await fetch('prototypes/lockpicking-mechanics-v63.html');
    if(!response.ok)throw new Error(`Imported games failed to load: ${response.status}`);
    const source=await response.text();
    const parsed=new DOMParser().parseFromString(source,'text/html');
    const prototypeRoot=parsed.querySelector('.lockpick-prototype');
    const sourceStyle=parsed.querySelector('style');
    const sourceScript=parsed.querySelector('script');
    if(!prototypeRoot||!sourceStyle||!sourceScript)throw new Error('Imported games source is incomplete');

    const shadow=host.attachShadow({mode:'open'});
    const style=document.createElement('style');
    style.textContent=sourceStyle.textContent
      .replace(':root {',':host {')
      .replaceAll('html.embedded',':host(.embedded)')+`
        /* Timers are rendered only by the application's shared challenge HUD. */
        .lockpick-prototype .ap-time,
        .lockpick-prototype .hill-timer,
        .lockpick-prototype .tds-time,
        .lockpick-prototype .wm-time,
        .lockpick-prototype .th12-time,
        .lockpick-prototype .an-time,
        .lockpick-prototype .me2-time,
        .lockpick-prototype .bs1-meter,
        .lockpick-prototype .bs1-head #bs1Time{display:none!important}
        .lockpick-prototype{font-family:var(--ui-font,"Golos Text",Arial,sans-serif)!important}
        .lockpick-prototype button{font-family:inherit!important}
        .lockpick-prototype .scene-head h2{font-family:var(--title-font,"Cormorant Garamond",Georgia,serif)!important}
        .lockpick-prototype .status,.lockpick-prototype .museum-msg{font-family:var(--accent-font,"Forum",Georgia,serif)!important}

        /* Fallout uses the application's shared physical-lock tools. The
           prototype's bars stay as state carriers only and are never painted. */
        .lockpick-prototype .scene[data-name="Fallout"] .sf-pick,
        .lockpick-prototype .scene[data-name="Fallout"] .sf-wrench{display:none!important}
        .lockpick-prototype .scene[data-name="Fallout"],
        .lockpick-prototype .scene[data-name="Fallout"] .lab,
        .lockpick-prototype .scene[data-name="Fallout"] .museum-wrap,
        .lockpick-prototype .scene[data-name="Fallout"] .sf-lock{overflow:visible!important}
        .lockpick-prototype .scene[data-name="Fallout"] .museum-actions{display:none!important}`;
    shadow.append(style,prototypeRoot.cloneNode(true));
    host.classList.add('embedded');

    const runtimeDocument={
      querySelector:selector=>shadow.querySelector(selector),
      querySelectorAll:selector=>shadow.querySelectorAll(selector),
      getElementById:id=>shadow.querySelector(`#${CSS.escape(id)}`),
      createElement:tag=>document.createElement(tag),
      addEventListener:(type,listener,options)=>window.addEventListener(type,listener,options),
      documentElement:host,
      body:host
    };
    window.KeynlockImportedInitialPicks=Math.max(0,Number(window.KeynlockImportedInitialPicks)||3);

    let code=sourceScript.textContent
      .replace("const EMBEDDED_PARAMS=new URLSearchParams(location.search);\nconst EMBEDDED_GAME=EMBEDDED_PARAMS.get('game')||'';\nconst EMBEDDED_PICK_VALUE=Number(EMBEDDED_PARAMS.get('picks'));\nconst EMBEDDED_TENSION_VALUE=Number(EMBEDDED_PARAMS.get('tension'));\nconst PLAYER_PICK_COUNT=Math.max(0,Math.min(99,Math.round(Number.isFinite(EMBEDDED_PICK_VALUE)?EMBEDDED_PICK_VALUE:3)));\nlet playerTensionSkin=Math.max(1,Math.min(5,Math.round(Number.isFinite(EMBEDDED_TENSION_VALUE)?EMBEDDED_TENSION_VALUE:1)));",
        "let EMBEDDED_GAME='';\nlet PLAYER_PICK_COUNT=Math.max(0,Math.min(99,Math.round(Number(window.KeynlockImportedInitialPicks)||3)));\nlet playerTensionSkin=1;")
      .replace('  const DEFAULT_PICKS=PLAYER_PICK_COUNT;','  let DEFAULT_PICKS=PLAYER_PICK_COUNT;')
      .replace(/  return\{DEFAULT_PICKS,([^}]+)\};/,
        "  function setDefaultPicks(count){DEFAULT_PICKS=Math.max(0,Math.min(99,Math.round(Number(count)||0)))}\n  return{get DEFAULT_PICKS(){return DEFAULT_PICKS},setDefaultPicks,$1};")
      .replace(/const embeddedGame=EMBEDDED_GAME;[\s\S]*?window\.addEventListener\('message',[\s\S]*?\n\}\);\s*$/,'');

    code+=`\nlet integratedLossObserver=null,integratedTimerObserver=null;
      let integratedManualOpen=false,integratedPendingOpen=null,integratedPendingTension=null;
      const integratedTimerConfigs={
        'Трубопровод':{bar:'#bs1TimerBar',duration:17,invert:true,gate:'#bs1Time',defeatOnZero:false},
        'Watchmen':{bar:'#wmTimer',duration:16},
        'Thief 1/2':{bar:'#th12Timer',duration:22},
        'Thief: Deadly Shadows':{bar:'#tdsTimer',duration:22},
        'Anachronox':{bar:'#anTimer',duration:30},
        'Hillsfar':{bar:'#hillTimer',duration:28},
        'Alpha Protocol':{bar:'#apTimer',duration:26},
        'Mass Effect 2':{bar:'#me2Timer',duration:40}
      };
      let integratedTimerLastSent=0;
      let integratedTimerDefeated=false;
      function emitIntegratedTimer(game,force=false){
        const config=integratedTimerConfigs[game];
        if(!config){window.postMessage({type:'keynlock-mechanic-timer',game,active:false},location.origin);return;}
        const now=performance.now();
        if(!force&&now-integratedTimerLastSent<80)return;
        integratedTimerLastSent=now;
        const bar=document.querySelector(config.bar);
        let percent=Math.max(0,Math.min(100,parseFloat(bar?.style.width)||0));
        let active=true;
        if(config.gate){
          const text=document.querySelector(config.gate)?.textContent||'';
          active=/Поток через/i.test(text);
        }
        if(config.invert)percent=100-percent;
        window.postMessage({type:'keynlock-mechanic-timer',game,active,timeLeft:config.duration*percent/100,timeMax:config.duration,label:'Время'},location.origin);
        if(active&&config.defeatOnZero!==false&&percent<=.01&&!integratedTimerDefeated){
          integratedTimerDefeated=true;
          window.postMessage({type:'keynlock-mechanic-loss',game,reason:'time'},location.origin);
        }
      }
      function observeIntegratedTimer(game){
        integratedTimerObserver?.disconnect();
        const config=integratedTimerConfigs[game];
        if(!config){emitIntegratedTimer(game,true);return;}
        const bar=document.querySelector(config.bar);
        const gate=config.gate?document.querySelector(config.gate):null;
        integratedTimerObserver=new MutationObserver(()=>emitIntegratedTimer(game));
        if(bar)integratedTimerObserver.observe(bar,{attributes:true,attributeFilter:['style']});
        if(gate)integratedTimerObserver.observe(gate,{subtree:true,childList:true,characterData:true});
        emitIntegratedTimer(game,true);
      }
      const integratedOriginalOpen=LockRuntime.open;
      const integratedOriginalResetOpen=LockRuntime.resetOpen;
      const integratedOriginalTensionReady=LockRuntime.tensionReady;
      LockRuntime.open=function(game,options={}){
        if(integratedManualOpen&&game===EMBEDDED_GAME){
          integratedPendingOpen={game,options};
          if(options.statusEl)options.statusEl.innerHTML='<strong>Механизм выставлен</strong>нажми на замок наверху';
          window.postMessage({type:'keynlock-mechanic-ready',game,ready:true},location.origin);
          return false;
        }
        return integratedOriginalOpen(game,options);
      };
      LockRuntime.resetOpen=function(game){
        if(game===EMBEDDED_GAME){
          integratedPendingOpen=null;
          integratedPendingTension=null;
          integratedTimerDefeated=false;
          window.postMessage({type:'keynlock-mechanic-ready',game,ready:false},location.origin);
        }
        return integratedOriginalResetOpen(game);
      };
      LockRuntime.tensionReady=function(game,options={}){
        if(integratedManualOpen&&game===EMBEDDED_GAME){integratedPendingTension={game,options};return true;}
        return integratedOriginalTensionReady(game,options);
      };
      function observeIntegratedGame(game){
        integratedLossObserver?.disconnect();
        const scene=GameHub.scene(game);
        const status=scene?.querySelector(':scope > .scene-head .status');
        integratedLossObserver=new MutationObserver(()=>{
          emitEmbeddedState(game);
          if(/отмычки закончились/i.test(status?.textContent||''))window.postMessage({type:'keynlock-mechanic-loss',game,reason:'picks'},location.origin);
        });
        if(status)integratedLossObserver.observe(status,{subtree:true,childList:true,characterData:true});
      }
      window.__KeynlockImportedRuntime={
        open(game,options={}){
          EMBEDDED_GAME=game;
          integratedManualOpen=!!options.manualOpen;
          integratedPendingOpen=null;
          integratedPendingTension=null;
          integratedTimerDefeated=false;
          playerTensionSkin=Math.max(1,Math.min(5,Math.round(Number(options.tension)||1)));
          LockRuntime.setDefaultPicks(options.picks);
          const index=GameHub.scenes.findIndex(scene=>scene.dataset.name===game);
          if(index<0)throw new Error('Unknown imported game: '+game);
          GameHub.show(index);
          GameHub.get(game)?.reset?.();
          observeIntegratedGame(game);
          observeIntegratedTimer(game);
          emitEmbeddedState(game);
          host.hidden=false;
          host.focus({preventScroll:true});
        },
        close(){
          integratedLossObserver?.disconnect();
          integratedTimerObserver?.disconnect();
          if(EMBEDDED_GAME)window.postMessage({type:'keynlock-mechanic-timer',game:EMBEDDED_GAME,active:false},location.origin);
          GameHub.get(EMBEDDED_GAME)?.leave?.();
          integratedManualOpen=false;
          integratedPendingOpen=null;
          integratedPendingTension=null;
          EMBEDDED_GAME='';
          host.hidden=true;
        },
        replay(){if(EMBEDDED_GAME){integratedTimerDefeated=false;GameHub.get(EMBEDDED_GAME)?.reset?.();observeIntegratedTimer(EMBEDDED_GAME)}},
        attemptOpen(){
          if(integratedPendingOpen){
            if(integratedPendingTension&&!integratedOriginalTensionReady(integratedPendingTension.game,integratedPendingTension.options)){
              integratedPendingOpen=null;
              integratedPendingTension=null;
              window.postMessage({type:'keynlock-mechanic-ready',game:EMBEDDED_GAME,ready:false},location.origin);
              GameHub.get(EMBEDDED_GAME)?.mistake?.();
              return false;
            }
            const pending=integratedPendingOpen;
            integratedPendingOpen=null;
            integratedPendingTension=null;
            window.postMessage({type:'keynlock-mechanic-ready',game:pending.game,ready:false},location.origin);
            return integratedOriginalOpen(pending.game,pending.options);
          }
          return GameHub.get(EMBEDDED_GAME)?.open?.();
        },
        penalizeOpenAttempt(){return GameHub.get(EMBEDDED_GAME)?.mistake?.()},
        setTools(options={}){playerTensionSkin=Math.max(1,Math.min(5,Math.round(Number(options.tension)||1)))},
        active(){return EMBEDDED_GAME}
      };`;
    new Function('document','host',code)(runtimeDocument,host);
    runtime=window.__KeynlockImportedRuntime;
    if(!runtime)throw new Error('Imported games runtime did not initialize');
    return runtime;
  }

  const ready=loadRuntime();
  ready.catch(error=>console.error('[imported-games]',error));
  window.KeynlockImportedGames={
    ready,
    open:(game,options)=>ready.then(api=>api.open(game,options)),
    close:()=>runtime?.close(),
    replay:()=>runtime?.replay(),
    attemptOpen:()=>runtime?.attemptOpen(),
    penalizeOpenAttempt:()=>runtime?.penalizeOpenAttempt(),
    setTools:options=>runtime?.setTools(options),
    active:()=>runtime?.active()||''
  };
})();
