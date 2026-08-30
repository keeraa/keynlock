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
  function restartMessage(id){return get(id)?.restartMessage||'Головоломка обновлена';}

  return Object.freeze({register,get,has:id=>modes.has(id),call,input,action,objective,restartMessage});
})();

window.PuzzleModes=PuzzleModes;
