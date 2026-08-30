/*
 * Canonical game catalogue and action dispatcher.
 *
 * A puzzle owns its algorithm, while this file owns the facts shared by the
 * world and UI: whether the location has a physical lock, which ambient
 * systems run there, and whether opening is an explicit player action.
 */
const GAME_DEFINITIONS={
  classic:{title:'Классика',kind:'native',lock:{present:true,manualOpen:true,specialTool:true},world:{noise:true,noiseSensor:true,guards:true,birds:true}},
  target:{title:'Альтернатива',kind:'native',lock:{present:true,manualOpen:true,specialTool:true},world:{noise:true,noiseSensor:true,guards:true,birds:true}},
  line:{title:'Другая линия',kind:'native',lock:{present:true,manualOpen:true,specialTool:true},world:{noise:true,noiseSensor:true,guards:true,birds:true}},
  sequence:{title:'Альтернатива 2',kind:'native',lock:{present:true,manualOpen:true,specialTool:true},world:{noise:true,noiseSensor:true,guards:true,birds:true}},
  special:{title:'Особые замки',kind:'native',lock:{present:true,manualOpen:true,specialTool:true},world:{noise:true,noiseSensor:true,guards:true,birds:true}},
  hillsfar:{title:'Hillsfar',kind:'native',lock:{present:true,manualOpen:true},world:{noise:false,guards:false,birds:false}},
  mass:{title:'Mass Effect',kind:'native',lock:{present:true,manualOpen:true},world:{noise:false,guards:false,birds:false}},
  g1:{title:'Gothic 1',kind:'native',lock:{present:true,manualOpen:true,specialTool:true},world:{noise:false,guards:false,birds:false}},
  r2:{title:'Risen 2',description:'Поднимай штифты в скрытом правильном порядке; ошибка сбрасывает набранный прогресс.',objective:'ПОДНЯТЬ ШТИФТЫ В ПРАВИЛЬНОМ ПОРЯДКЕ',kind:'native',lock:{present:true,manualOpen:true},world:{noise:false,guards:false,birds:false}},
  skyrim:{title:'Skyrim',description:'Найди рабочий угол отмычки по сопротивлению механизма, затем проверни цилиндр.',objective:'НАЙТИ ПРАВИЛЬНЫЙ УГОЛ ОТМЫЧКИ',kind:'native',lock:{present:true,manualOpen:true},world:{noise:false,guards:false,birds:false}},
  anach:{title:'Anachronox',description:'Настрой три канала так, чтобы их суммарное отклонение исчезло и сигнал достиг 100.0.',objective:'МЕНЯЙ 3 КАНАЛА ТАК, ЧТОБЫ ЧИСЛО ВЫРОСЛО ДО 100.0',kind:'native',lock:{present:true,manualOpen:true},world:{noise:false,guards:false,birds:false}},
  tension:{title:'Натяжение',description:'Удерживай натяжение в движущейся рабочей зоне и последовательно выставляй штифты.',objective:'УДЕРЖИВАТЬ НАТЯЖЕНИЕ В РАБОЧЕЙ ЗОНЕ И ВЫСТАВИТЬ ВСЕ ШТИФТЫ',kind:'native',lock:{present:true,manualOpen:true},world:{noise:false,guards:false,birds:false}},
  resonance:{title:'Резонанс',description:'Останавливай движущиеся штифты точно на центральной линии резонанса.',objective:'ЗАФИКСИРОВАТЬ ВСЕ ШТИФТЫ ТОЧНО НА ЗОЛОТОЙ ЛИНИИ',kind:'native',lock:{present:true,manualOpen:true},world:{noise:false,guards:false,birds:false}},
  deduction:{title:'Слепок ключа',description:'Восстанови скрытый профиль ключа, используя подсказку о первом неверном зубце.',objective:'ВОССТАНОВИТЬ ПРОФИЛЬ КЛЮЧА ПО ОБРАТНОЙ СВЯЗИ',kind:'native',lock:{present:true,manualOpen:true},world:{noise:false,guards:false,birds:false}},
  composite:{title:'Составная',description:'Собери профиль отмычки из четырёх независимых участков и совмести каждый участок с соответствующим штифтом.',objective:'СОБРАТЬ ОТМЫЧКУ ИЗ 4 УЧАСТКОВ ПОД ЦЕЛЕВОЙ ПРОФИЛЬ',kind:'native',lock:{present:true,manualOpen:true},world:{noise:false,guards:false,birds:false}},
  heatcold:{title:'Тепло — холодно',kind:'native',lock:{present:false,manualOpen:true},world:{noise:false,guards:false,birds:false},difficulty:{levels:[1]}},
  drum:{title:'Щелчки барабана',kind:'native',lock:{present:false,manualOpen:true},world:{noise:false,guards:false,birds:false},difficulty:{levels:[1]}},
  scope:{title:'Осциллограф',kind:'native',lock:{present:false,manualOpen:true},world:{noise:false,guards:false,birds:false},difficulty:{levels:[1]}},
  oblivion:{title:'Штифтовый замок',description:'Подбрасывай штифты и фиксируй каждый точно в момент совпадения с верхней прорезью.',objective:'ПОДНЯТЬ И ЗАФИКСИРОВАТЬ ВСЕ ШТИФТЫ',kind:'native',lock:{present:true,manualOpen:true},world:{noise:false,guards:false,birds:false},difficulty:{levels:[1]}},
  watchmen:{title:'Подпружиненные тумблеры',description:'Выставляй высоту связанных тумблеров и фиксируй их в целевых зонах до окончания времени.',objective:'ВЫСТАВИТЬ И ЗАФИКСИРОВАТЬ ВСЕ ТУМБЛЕРЫ ДО ИСТЕЧЕНИЯ ВРЕМЕНИ',kind:'native',lock:{present:true,manualOpen:true},world:{noise:false,guards:false,birds:false}},
  museum:{title:'Подбор формы отмычки',description:'Сопоставляй профиль текущего тумблера с формой в нижнем наборе. Частично закрытый профиль нужно узнать по видимой половине, а заклинивший — выбрать повторно.',objective:'ПОДОБРАТЬ ПРОФИЛЬ ОТМЫЧКИ ДЛЯ КАЖДОГО ТУМБЛЕРА',kind:'native',lock:{present:false,manualOpen:false},world:{noise:false,guards:false,birds:false}},
  mass2:{title:'Парные узлы',description:'Открывай узлы попарно, запоминай символы и найди все совпадения до окончания времени.',objective:'НАЙТИ ВСЕ ПАРЫ УЗЛОВ ДО ИСТЕЧЕНИЯ ВРЕМЕНИ',kind:'native',lock:{present:false,manualOpen:false},world:{noise:false,guards:false,birds:false}},
  pipeline:{title:'Трубопровод',description:'Раскрой и поверни плитки, чтобы собрать непрерывный маршрут от входа до выхода до запуска потока.',objective:'СОБРАТЬ МАРШРУТ ОТ ВХОДА ДО ВЫХОДА ДО ЗАПУСКА ПОТОКА',kind:'native',lock:{present:false,manualOpen:false},world:{noise:false,guards:false,birds:false}},
  wharf:{title:'Risen 2 — верфь',description:'Открывай задвижки в скрытом порядке; ошибочный выбор сбрасывает последовательность.',objective:'ОТКРЫТЬ ЗАДВИЖКИ ПО ПОРЯДКУ',kind:'native',lock:{present:true,manualOpen:true},world:{noise:false,guards:false,birds:false}},
  thiefds:{title:'Thief: Deadly Shadows',description:'Выбирай кольца в заданном порядке, находи их скрытые рабочие углы и фиксируй.',objective:'ВЫСТАВИТЬ КОЛЬЦА В СКРЫТОМ ПОРЯДКЕ',kind:'native',lock:{present:true,manualOpen:true},world:{noise:false,guards:false,birds:false}},
  kingdomcome:{title:'Kingdom Come',description:'Найди рабочую точку и веди отмычку вслед за вращающимся цилиндром, не накапливая стресс.',objective:'НАЙТИ И УДЕРЖАТЬ РАБОЧУЮ ТОЧКУ ДО КОНЦА ПОВОРОТА',kind:'native',lock:{present:true,manualOpen:true},world:{noise:false,guards:false,birds:false}},
  thief12:{title:'Thief 1/2',description:'Определяй правильный профиль по звуку и удерживай его до полного зацепления на каждой стадии.',objective:'НАЙТИ И УДЕРЖАТЬ ПРОФИЛЬ ОТМЫЧКИ НА КАЖДОЙ СТАДИИ',kind:'native',lock:{present:true,manualOpen:true},world:{noise:false,guards:false,birds:false}},
  fallout:{title:'Fallout',description:'Подбери угол отмычки и направление вращения, не доводя износ инструмента до предела.',objective:'НАЙТИ УГОЛ И ВЕРНОЕ НАПРАВЛЕНИЕ ВРАЩЕНИЯ',kind:'native',lock:{present:true,manualOpen:true},world:{noise:true,noiseSensor:true,guards:false,birds:false}},
  anachlab:{title:'Anachronox — лаборатория',description:'Подбери трёхзначный код по измерению близости каждой отдельно проверяемой цифры.',objective:'ПОДОБРАТЬ ТРЁХЗНАЧНЫЙ КОД ПО ПОДСКАЗКАМ БЛИЗОСТИ',kind:'native',lock:{present:true,manualOpen:true},world:{noise:false,guards:false,birds:false}},
  masshack:{title:'Mass Effect — узел',description:'Проходи через вращающиеся кольца к ядру, избегая движущихся блоков.',objective:'ПРОЙТИ ВСЕ 5 КОЛЕЦ И ПОДТВЕРДИТЬ ЯДРО',kind:'native',lock:{present:true,manualOpen:true},world:{noise:false,guards:false,birds:false},difficulty:{levels:[1]}},
  pathologic:{title:'Pathologic 2',description:'Ударами удерживай обе стороны механизма в центральных зонах и зафиксируй совпадение.',objective:'СОВМЕСТИТЬ ОБЕ ЗОНЫ С ЦЕНТРАЛЬНОЙ ЛИНИЕЙ И ЗАФИКСИРОВАТЬ',kind:'native',lock:{present:true,manualOpen:true},world:{noise:false,guards:false,birds:false},difficulty:{levels:[1]}},
  bioshock2:{title:'BioShock 2',description:'Останавливай движущуюся иглу в зелёных зонах пять этапов подряд.',objective:'ОСТАНОВИТЬ ИГЛУ НА ЗЕЛЁНОЙ ЗОНЕ 5 РАЗ ПОДРЯД',kind:'native',lock:{present:true,manualOpen:true},world:{noise:false,guards:false,birds:false},difficulty:{levels:[1]}},
  alphaprotocol:{title:'Alpha Protocol',description:'Выставляй пины по высоте и фиксируй их в порядке показанных символов.',objective:'ВЫСТАВИТЬ 5 ПИНОВ В ПОРЯДКЕ СИМВОЛОВ',kind:'native',lock:{present:true,manualOpen:true},world:{noise:false,guards:false,birds:false}}
};

function freezeGameDefinitions(definitions){
  Object.values(definitions).forEach(entry=>{
    // Quiet locations omit the flag for readability; normalization keeps the
    // catalogue schema complete for every consumer.
    if(entry.world.noiseSensor===undefined)entry.world.noiseSensor=false;
    if(entry.lock.specialTool===undefined)entry.lock.specialTool=false;
    if(entry.readiness===undefined)entry.readiness=entry.kind==='native'?4:3;
    if(entry.rating===undefined)entry.rating=null;
    if(entry.difficulty===undefined)entry.difficulty={levels:entry.kind==='native'?[1,2,3]:[]};
    Object.freeze(entry.lock);
    Object.freeze(entry.world);
    Object.freeze(entry.difficulty.levels);
    Object.freeze(entry.difficulty);
    Object.freeze(entry);
  });
  return Object.freeze(definitions);
}

const GameCatalog=(()=>{
  const definitions=freezeGameDefinitions(GAME_DEFINITIONS);
  const storageKey='keynlockGameCatalogOverrides';
  const editablePaths=Object.freeze(['lock.present','lock.manualOpen','lock.specialTool','world.noise','world.noiseSensor','world.guards','world.birds','readiness','rating']);
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
      rating:saved.rating===null||saved.rating===''||!Number.isFinite(+saved.rating)
        ? base.rating
        : Math.max(1,Math.min(5,+saved.rating>5?Math.round(+saved.rating/2):+saved.rating)),
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
  function mapLabel(id,label){
    const game=get(id);
    if(!game)return String(label||id);
    const readiness=Math.max(1,Math.min(5,Number(game.readiness)||1));
    return `${readiness===5?'✓':readiness} ${label||game.title}`;
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
        ? (value===''||value===null?null:Math.max(1,Math.min(5,Number(value)||1)))
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
  return Object.freeze({definitions,nativeIds,prototypeIds,editablePaths,get,feature,mapLabel,setFeature,reset,has:id=>!!get(id)});
})();

const GameActions=(()=>{
  const openers=new Map();
  const openGuards=new Map();
  function registerOpen(modeId,handler){
    if(!GameCatalog.has(modeId))throw new Error(`Unknown game mode: ${modeId}`);
    if(typeof handler!=='function')throw new TypeError(`Open action for ${modeId} must be a function`);
    openers.set(modeId,handler);
  }
  function registerOpeners(entries){Object.entries(entries).forEach(([id,handler])=>registerOpen(id,handler));}
  function registerOpenGuard(modeId,guard){
    if(!GameCatalog.has(modeId))throw new Error(`Unknown game mode: ${modeId}`);
    if(typeof guard!=='function')throw new TypeError(`Open guard for ${modeId} must be a function`);
    if(!openGuards.has(modeId))openGuards.set(modeId,[]);
    openGuards.get(modeId).push(guard);
  }
  function attemptOpen({modeId=mode,source='interface'}={}){
    const game=GameCatalog.get(modeId);
    if(!game?.lock.manualOpen)return false;
    const handler=openers.get(modeId);
    if(!handler){console.warn(`No open action registered for ${modeId}`);return false;}
    const solvedBefore=!!solved;
    const context={modeId,source,game,solvedBefore};
    for(const guard of openGuards.get(modeId)||[]) if(guard(context)===false)return false;
    const result=handler(context);
    window.dispatchEvent(new CustomEvent('keynlock-game-action',{detail:{action:'open',modeId,source,solvedBefore,solvedAfter:!!solved}}));
    return result;
  }
  return Object.freeze({registerOpen,registerOpeners,registerOpenGuard,attemptOpen,hasOpen:id=>openers.has(id)});
})();

// Deliberate public surface for diagnostics and future isolated mechanics.
// The objects themselves are frozen; handlers can only be added through the
// validated registration API above.
window.GameCatalog=GameCatalog;
window.GameActions=GameActions;
