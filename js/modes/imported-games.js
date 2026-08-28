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
      .replaceAll('html.embedded',':host(.embedded)');
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

    code+=`\nlet integratedLossObserver=null;
      function observeIntegratedGame(game){
        integratedLossObserver?.disconnect();
        const scene=GameHub.scene(game);
        const status=scene?.querySelector(':scope > .scene-head .status');
        integratedLossObserver=new MutationObserver(()=>{
          emitEmbeddedState(game);
          if(/отмычки закончились/i.test(status?.textContent||''))window.postMessage({type:'keynlock-mechanic-loss',game},location.origin);
        });
        if(status)integratedLossObserver.observe(status,{subtree:true,childList:true,characterData:true});
      }
      window.__KeynlockImportedRuntime={
        open(game,options={}){
          EMBEDDED_GAME=game;
          playerTensionSkin=Math.max(1,Math.min(5,Math.round(Number(options.tension)||1)));
          LockRuntime.setDefaultPicks(options.picks);
          const index=GameHub.scenes.findIndex(scene=>scene.dataset.name===game);
          if(index<0)throw new Error('Unknown imported game: '+game);
          GameHub.show(index);
          GameHub.get(game)?.reset?.();
          observeIntegratedGame(game);
          emitEmbeddedState(game);
          host.hidden=false;
          host.focus({preventScroll:true});
        },
        close(){
          integratedLossObserver?.disconnect();
          GameHub.get(EMBEDDED_GAME)?.leave?.();
          EMBEDDED_GAME='';
          host.hidden=true;
        },
        replay(){if(EMBEDDED_GAME)GameHub.get(EMBEDDED_GAME)?.reset?.()},
        attemptOpen(){return GameHub.get(EMBEDDED_GAME)?.open?.()},
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
    setTools:options=>runtime?.setTools(options),
    active:()=>runtime?.active()||''
  };
})();
