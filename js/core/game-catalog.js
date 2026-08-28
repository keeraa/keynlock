/*
 * Canonical game catalogue and action dispatcher.
 *
 * A puzzle owns its algorithm, while this file owns the facts shared by the
 * world and UI: whether the location has a physical lock, which ambient
 * systems run there, and whether opening is an explicit player action.
 */
const GAME_DEFINITIONS={
  classic:{title:'Классика',kind:'native',lock:{present:true,manualOpen:true},world:{noise:true,guards:true,birds:true}},
  target:{title:'Альтернатива',kind:'native',lock:{present:true,manualOpen:true},world:{noise:true,guards:true,birds:true}},
  line:{title:'Другая линия',kind:'native',lock:{present:true,manualOpen:true},world:{noise:true,guards:true,birds:true}},
  sequence:{title:'Альтернатива 2',kind:'native',lock:{present:true,manualOpen:true},world:{noise:true,guards:true,birds:true}},
  special:{title:'Особые замки',kind:'native',lock:{present:true,manualOpen:true},world:{noise:true,guards:true,birds:true}},
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
    Object.freeze(entry.lock);
    Object.freeze(entry.world);
    Object.freeze(entry);
  });
  return Object.freeze(definitions);
}

const GameCatalog=(()=>{
  const definitions=freezeGameDefinitions(GAME_DEFINITIONS);
  const nativeIds=Object.freeze(Object.keys(definitions).filter(id=>definitions[id].kind==='native'));
  const prototypeIds=Object.freeze(Object.keys(definitions).filter(id=>definitions[id].kind==='prototype'));
  function get(id){return definitions[id]||null;}
  function feature(id,path){
    const parts=String(path).split('.');
    let value=get(id);
    for(const part of parts)value=value?.[part];
    return value;
  }
  return Object.freeze({definitions,nativeIds,prototypeIds,get,feature,has:id=>!!get(id)});
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
