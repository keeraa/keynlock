/*
 * Canonical game catalogue and action dispatcher.
 *
 * A puzzle owns its algorithm, while this file owns the facts shared by the
 * world and UI: whether the location has a physical lock, which ambient
 * systems run there, and whether opening is an explicit player action.
 */
const GAME_DEFINITIONS={
  classic:{title:'Классика',kind:'native',lock:{present:true,manualOpen:true},world:{noise:true,noiseSensor:true,guards:true,birds:true}},
  target:{title:'Альтернатива',kind:'native',lock:{present:true,manualOpen:true},world:{noise:true,noiseSensor:true,guards:true,birds:true}},
  line:{title:'Другая линия',kind:'native',lock:{present:true,manualOpen:true},world:{noise:true,noiseSensor:true,guards:true,birds:true}},
  sequence:{title:'Альтернатива 2',kind:'native',lock:{present:true,manualOpen:true},world:{noise:true,noiseSensor:true,guards:true,birds:true}},
  special:{title:'Особые замки',kind:'native',lock:{present:true,manualOpen:true},world:{noise:true,noiseSensor:true,guards:true,birds:true}},
  hillsfar:{title:'Hillsfar',kind:'native',lock:{present:true,manualOpen:true},world:{noise:false,guards:false,birds:false}},
  mass:{title:'Mass Effect',kind:'native',lock:{present:true,manualOpen:true},world:{noise:false,guards:false,birds:false}},
  g1:{title:'Gothic 1',kind:'native',lock:{present:true,manualOpen:true},world:{noise:false,guards:false,birds:false}},
  r2:{title:'Risen 2',kind:'native',lock:{present:true,manualOpen:true},world:{noise:false,guards:false,birds:false}},
  skyrim:{title:'Skyrim',kind:'native',lock:{present:true,manualOpen:true},world:{noise:false,guards:false,birds:false}},
  anach:{title:'Anachronox',kind:'native',lock:{present:true,manualOpen:true},world:{noise:false,guards:false,birds:false}},
  tension:{title:'Натяжение',kind:'native',lock:{present:true,manualOpen:true},world:{noise:false,guards:false,birds:false}},
  resonance:{title:'Резонанс',kind:'native',lock:{present:true,manualOpen:true},world:{noise:false,guards:false,birds:false}},
  deduction:{title:'Слепок ключа',kind:'native',lock:{present:true,manualOpen:true},world:{noise:false,guards:false,birds:false}},
  composite:{title:'Составная',kind:'native',lock:{present:true,manualOpen:true},world:{noise:false,guards:false,birds:false}},
  heatcold:{title:'Тепло — холодно',kind:'native',lock:{present:false,manualOpen:true},world:{noise:false,guards:false,birds:false}},
  drum:{title:'Щелчки барабана',kind:'native',lock:{present:false,manualOpen:true},world:{noise:false,guards:false,birds:false}},
  scope:{title:'Осциллограф',kind:'native',lock:{present:false,manualOpen:true},world:{noise:false,guards:false,birds:false}},

  'prototype:pipeline':{title:'Трубопровод',kind:'prototype',lock:{present:false,manualOpen:false},world:{noise:false,guards:false,birds:false}},
  'prototype:bioshock2':{title:'BioShock 2',kind:'prototype',lock:{present:false,manualOpen:false},world:{noise:false,guards:false,birds:false}},
  'prototype:risen-2':{title:'Risen 2 — верфь',kind:'prototype',lock:{present:false,manualOpen:false},world:{noise:false,guards:false,birds:false}},
  'prototype:alpha-protocol':{title:'Alpha Protocol',kind:'prototype',lock:{present:false,manualOpen:false},world:{noise:false,guards:false,birds:false}},
  'prototype:hillsfar':{title:'Hillsfar — музей',kind:'prototype',lock:{present:false,manualOpen:false},world:{noise:false,guards:false,birds:false}},
  'prototype:thief-ds':{title:'Thief: Deadly Shadows',kind:'prototype',lock:{present:true,manualOpen:true},world:{noise:false,guards:false,birds:false}},
  'prototype:kingdom-come':{title:'Kingdom Come',kind:'prototype',lock:{present:true,manualOpen:true},world:{noise:false,guards:false,birds:false}},
  'prototype:oblivion':{title:'Oblivion',kind:'prototype',lock:{present:true,manualOpen:true},world:{noise:false,guards:false,birds:false}},
  'prototype:watchmen':{title:'Watchmen',kind:'prototype',lock:{present:true,manualOpen:true},world:{noise:false,guards:false,birds:false}},
  'prototype:thief-12':{title:'Thief 1/2',kind:'prototype',lock:{present:true,manualOpen:true},world:{noise:false,guards:false,birds:false}},
  'prototype:fallout':{title:'Fallout',kind:'prototype',lock:{present:true,manualOpen:true},world:{noise:false,guards:false,birds:false}},
  'prototype:anachronox':{title:'Anachronox — лаборатория',kind:'prototype',lock:{present:false,manualOpen:false},world:{noise:false,guards:false,birds:false}},
  'prototype:mass-effect':{title:'Mass Effect — узел',kind:'prototype',lock:{present:false,manualOpen:false},world:{noise:false,guards:false,birds:false}},
  'prototype:mass-effect-2':{title:'Mass Effect 2',kind:'prototype',lock:{present:false,manualOpen:false},world:{noise:false,guards:false,birds:false}},
  'prototype:pathologic-2':{title:'Pathologic 2',kind:'prototype',lock:{present:false,manualOpen:false},world:{noise:false,guards:false,birds:false}}
};

function freezeGameDefinitions(definitions){
  Object.values(definitions).forEach(entry=>{
    // Quiet locations omit the flag for readability; normalization keeps the
    // catalogue schema complete for every consumer.
    if(entry.world.noiseSensor===undefined)entry.world.noiseSensor=false;
    if(entry.readiness===undefined)entry.readiness=entry.kind==='native'?4:3;
    if(entry.rating===undefined)entry.rating=null;
    Object.freeze(entry.lock);
    Object.freeze(entry.world);
    Object.freeze(entry);
  });
  return Object.freeze(definitions);
}

const GameCatalog=(()=>{
  const definitions=freezeGameDefinitions(GAME_DEFINITIONS);
  const storageKey='keynlockGameCatalogOverrides';
  const editablePaths=Object.freeze(['lock.present','lock.manualOpen','world.noise','world.noiseSensor','world.guards','world.birds','readiness','rating']);
  let overrides={};
  try{overrides=JSON.parse(localStorage.getItem(storageKey)||'{}')||{};}catch(_){overrides={};}
  const nativeIds=Object.freeze(Object.keys(definitions).filter(id=>definitions[id].kind==='native'));
  const prototypeIds=Object.freeze(Object.keys(definitions).filter(id=>definitions[id].kind==='prototype'));
  function get(id){
    const base=definitions[id];
    if(!base)return null;
    const saved=overrides[id]||{};
    return {
      ...base,
      readiness:Number.isFinite(+saved.readiness)
        ? Math.max(1,Math.min(5,+saved.readiness>5?Math.round(+saved.readiness/20):+saved.readiness))
        : base.readiness,
      rating:saved.rating===null||saved.rating===''||!Number.isFinite(+saved.rating)?base.rating:Math.max(1,Math.min(10,+saved.rating)),
      lock:{...base.lock,...saved.lock},
      world:{...base.world,...saved.world}
    };
  }
  function feature(id,path){
    const parts=String(path).split('.');
    let value=get(id);
    for(const part of parts)value=value?.[part];
    return value;
  }
  function setFeature(id,path,value){
    if(!definitions[id])throw new Error(`Unknown game: ${id}`);
    if(!editablePaths.includes(path))throw new Error(`Game feature is not editable: ${path}`);
    const parts=path.split('.');
    const entry=overrides[id]||(overrides[id]={});
    let target=entry;
    for(const part of parts.slice(0,-1))target=target[part]||(target[part]={});
    target[parts.at(-1)]=path==='readiness'
      ? Math.max(1,Math.min(5,Number(value)||1))
      : path==='rating'
        ? (value===''||value===null?null:Math.max(1,Math.min(10,Number(value)||1)))
        : !!value;
    persist();
    emitChange(id,path);
    return get(id);
  }
  function reset(id){
    if(id){delete overrides[id];}else{overrides={};}
    persist();
    emitChange(id||null,'reset');
  }
  function persist(){
    try{localStorage.setItem(storageKey,JSON.stringify(overrides));}catch(_){}
  }
  function emitChange(id,path){
    window.dispatchEvent(new CustomEvent('keynlock-game-catalog-change',{detail:{id,path,game:id?get(id):null}}));
  }
  return Object.freeze({definitions,nativeIds,prototypeIds,editablePaths,get,feature,setFeature,reset,has:id=>!!get(id)});
})();

const GameActions=(()=>{
  const openers=new Map();
  function registerOpen(modeId,handler){
    if(!GameCatalog.has(modeId))throw new Error(`Unknown game mode: ${modeId}`);
    if(typeof handler!=='function')throw new TypeError(`Open action for ${modeId} must be a function`);
    openers.set(modeId,handler);
  }
  function registerOpeners(entries){Object.entries(entries).forEach(([id,handler])=>registerOpen(id,handler));}
  function attemptOpen({modeId=mode,source='interface'}={}){
    const game=GameCatalog.get(modeId);
    if(!game?.lock.manualOpen)return false;
    const handler=openers.get(modeId);
    if(!handler){console.warn(`No open action registered for ${modeId}`);return false;}
    const solvedBefore=!!solved;
    const result=handler({modeId,source,game});
    window.dispatchEvent(new CustomEvent('keynlock-game-action',{detail:{action:'open',modeId,source,solvedBefore,solvedAfter:!!solved}}));
    return result;
  }
  return Object.freeze({registerOpen,registerOpeners,attemptOpen,hasOpen:id=>openers.has(id)});
})();

// Deliberate public surface for diagnostics and future isolated mechanics.
// The objects themselves are frozen; handlers can only be added through the
// validated registration API above.
window.GameCatalog=GameCatalog;
window.GameActions=GameActions;
