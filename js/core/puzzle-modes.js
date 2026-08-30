/*
 * Incremental home for native puzzle modules.
 *
 * A mode owns its lifecycle and input map. Legacy modes may keep using the
 * old dispatcher until they are migrated; registered modes bypass those
 * mode-specific branches without changing the rest of the game shell.
 */
const PuzzleModes=(()=>{
  const modes=new Map();
  const allowedKeys=new Set(['id','start','render','tick','resize','syncHud','objective','restartMessage','attemptOpen','actions','input','destroy']);

  function register(definition){
    if(!definition||typeof definition!=='object')throw new TypeError('Puzzle mode definition must be an object');
    const id=String(definition.id||'');
    if(!GameCatalog.has(id))throw new Error(`Unknown puzzle mode: ${id}`);
    if(modes.has(id))throw new Error(`Puzzle mode already registered: ${id}`);
    if(typeof definition.start!=='function')throw new TypeError(`Puzzle mode ${id} must define start()`);
    Object.keys(definition).forEach(key=>{if(!allowedKeys.has(key))throw new Error(`Unsupported puzzle mode field: ${id}.${key}`);});
    const frozen={
      ...definition,
      id,
      input:Object.freeze({...definition.input}),
      actions:Object.freeze({...definition.actions})
    };
    modes.set(id,Object.freeze(frozen));
    return frozen;
  }

  function get(id){return modes.get(id)||null;}
  function call(id,key,...args){
    const fn=get(id)?.[key];
    if(typeof fn!=='function')return false;
    fn(...args);
    return true;
  }
  function input(id,axis,delta){
    const fn=get(id)?.input?.[axis];
    if(typeof fn!=='function')return false;
    fn(delta);
    return true;
  }
  function action(id,name,...args){
    const fn=get(id)?.actions?.[name];
    if(typeof fn!=='function')return false;
    fn(...args);
    return true;
  }
  function objective(id){
    const value=get(id)?.objective;
    return typeof value==='function'?value():value||GameCatalog.get(id)?.objective||'';
  }
  function restartMessage(id){
    const value=get(id)?.restartMessage;
    return (typeof value==='function'?value():value)||'Головоломка обновлена';
  }

  return Object.freeze({register,get,has:id=>modes.has(id),call,input,action,objective,restartMessage});
})();

window.PuzzleModes=PuzzleModes;

/* Reusable visual shell for lock mechanisms and optional per-game overlays. */
(() => {
  const BASE_MODES = new Set(['classic', 'target', 'line', 'sequence', 'special']);
  const frame = document.querySelector('#lockShellFrame');
  const background = document.querySelector('#lockShellBackground');
  const funnelBack = document.querySelector('#lockShellFunnelBack');
  const funnelFront = document.querySelector('#lockShellFunnelFront');
  const overlayLayer = document.querySelector('#lockShellOverlayLayer');
  const profiles = new Map();
  let activeProfile = null;

  function registerProfile(id, profile) {
    profiles.set(id, {background:'',funnelBack:'',funnelFront:'',className:'',...profile});
  }
  function renderOverlays(overlays = []) {
    overlayLayer.replaceChildren();
    overlays.forEach((overlay, index) => {
      if (!overlay?.src) return;
      const image = document.createElement('img');
      image.src = overlay.src;
      image.alt = '';
      image.className = `lockShellOverlay ${overlay.className || ''}`.trim();
      image.dataset.overlayIndex = String(index);
      if (overlay.style) Object.assign(image.style, overlay.style);
      overlayLayer.appendChild(image);
    });
  }
  function activate(id, options = {}) {
    const profile = profiles.get(id);
    if (!profile || !frame) return false;
    const rows = String(options.rows || 5);
    activeProfile = id;
    document.body.classList.add('lock-shell-active');
    document.body.dataset.lockShellRows = rows;
    frame.dataset.profile = id;
    frame.dataset.rows = rows;
    frame.className = `lockShellFrame ${profile.className || ''}`.trim();
    if (profile.background) background.src = profile.background;
    if (profile.funnelBack) funnelBack.src = profile.funnelBack;
    if (profile.funnelFront) funnelFront.src = profile.funnelFront;
    renderOverlays(options.overlays || profile.overlays);
    return true;
  }
  function deactivate() {
    activeProfile = null;
    document.body.classList.remove('lock-shell-active');
    delete document.body.dataset.lockShellRows;
    renderOverlays();
  }
  function syncMode(mode, options = {}) {
    if (BASE_MODES.has(mode)) activate(options.profile || 'base-plates', options);
    else deactivate();
  }

  registerProfile('base-plates', {
    background:'assets/lock-shell/lock-bg-01.png',
    funnelBack:'assets/lock-shell/funnel-lower-01.png',
    funnelFront:'assets/lock-shell/funnel-upper-01.png'
  });
  window.LockShell = {
    registerProfile,activate,deactivate,syncMode,setOverlays:renderOverlays,
    setRows(rows) {
      const value = String(rows || 5);
      if (frame) frame.dataset.rows = value;
      document.body.dataset.lockShellRows = value;
    },
    get activeProfile() { return activeProfile; }
  };
})();
