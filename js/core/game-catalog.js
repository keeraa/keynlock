/*
 * Canonical game catalogue and action dispatcher.
 *
 * A puzzle owns its algorithm, while this file owns the facts shared by the
 * world and UI: whether the location has a physical lock, whether it consumes
 * lockpicks, which ambient systems run there, and whether opening is explicit.
 */
const GAME_DEFINITIONS={
  silhouettes:{title:'Четыре печати',description:'Переключай верхнюю и нижнюю составляющие, чтобы их наложение совпало с образцом посередине. Открой четыре печати слева направо за 30 секунд. Отмычки не расходуются.',objective:'СОБЕРИ ЧЕТЫРЕ СИЛУЭТА',kind:'native',lock:{present:false,manualOpen:false},world:{noise:false,guards:false,birds:false},difficulty:{levels:[1]}},
  classic:{title:'Классика',description:'Выстрой связанные штифты по центральной линии, подбери натяжитель и открой скобы. Следи за шумом: он привлекает стражу.',kind:'native',lock:{present:true,manualOpen:true,specialTool:true},world:{noise:true,noiseSensor:true,guards:true,birds:true}},
  sequence:{title:'Альтернатива 2',description:'Выстави каждый штифт по коду, указанному над механизмом. Учти связи между штифтами, выбери натяжитель и открой скобы.',kind:'native',lock:{present:true,manualOpen:true,specialTool:true},world:{noise:true,noiseSensor:true,guards:true,birds:true}},
  special:{title:'Особые замки',description:'Выровняй все штифты по центральной линии, учитывая цепные, зеркальные или волновые связи механизма. Подбери натяжитель перед открытием.',kind:'native',lock:{present:true,manualOpen:true,specialTool:true},world:{noise:true,noiseSensor:true,guards:true,birds:true}},
  keyprofile:{title:'Слепок скважины',description:'Сравни слепок замочной скважины с заготовками ключей и выбери ключ с подходящим профилем.',objective:'ВЫБРАТЬ КЛЮЧ, СОВПАДАЮЩИЙ СО СЛЕПКОМ',kind:'native',lock:{present:true,manualOpen:true},world:{noise:false,guards:false,birds:false}},
  turnmemory:{title:'Память поворотов',description:'Найди и запомни последовательность поворотов влево и вправо. Повтори её целиком, выбери подходящий натяжитель и открой замок.',kind:'native',lock:{present:true,manualOpen:true,specialTool:true},world:{noise:false,guards:false,birds:false}},
  workingangle:{title:'Рабочий угол',description:'Найди рабочий угол отмычки по сопротивлению механизма, затем проверни цилиндр.',objective:'НАЙТИ ПРАВИЛЬНЫЙ УГОЛ ОТМЫЧКИ',kind:'native',lock:{present:true,manualOpen:true},world:{noise:false,guards:false,birds:false}},
  signalbalance:{title:'Баланс сигналов',description:'Настрой три канала так, чтобы их суммарное отклонение исчезло и сигнал достиг 100.0.',objective:'МЕНЯЙ 3 КАНАЛА ТАК, ЧТОБЫ ЧИСЛО ВЫРОСЛО ДО 100.0',kind:'native',lock:{present:true,manualOpen:true},world:{noise:false,guards:false,birds:false}},
  tension:{title:'Натяжение',description:'Удерживай натяжение в движущейся рабочей зоне и последовательно выставляй штифты.',objective:'УДЕРЖИВАТЬ НАТЯЖЕНИЕ В РАБОЧЕЙ ЗОНЕ И ВЫСТАВИТЬ ВСЕ ШТИФТЫ',kind:'native',lock:{present:true,manualOpen:true},world:{noise:false,guards:false,birds:false}},
  resonance:{title:'Резонанс',description:'Останавливай движущиеся штифты точно на центральной линии резонанса. Промах ломает отмычку и уменьшает награду за замок на 20 монет.',objective:'ЗАФИКСИРОВАТЬ ВСЕ ШТИФТЫ ТОЧНО НА ЗОЛОТОЙ ЛИНИИ',kind:'native',lock:{present:true,manualOpen:true},world:{noise:false,guards:false,birds:false}},
  deduction:{title:'Слепок ключа',description:'Восстанови скрытый профиль ключа, используя подсказку о первом неверном зубце.',objective:'ВОССТАНОВИТЬ ПРОФИЛЬ КЛЮЧА ПО ОБРАТНОЙ СВЯЗИ',kind:'native',lock:{present:true,manualOpen:true},world:{noise:false,guards:false,birds:false}},
  composite:{title:'Составная',description:'Собери профиль отмычки из четырёх независимых участков и совмести каждый участок с соответствующим штифтом.',objective:'СОБРАТЬ ОТМЫЧКУ ИЗ 4 УЧАСТКОВ ПОД ЦЕЛЕВОЙ ПРОФИЛЬ',kind:'native',lock:{present:true,manualOpen:true},world:{noise:false,guards:false,birds:false}},
  drum:{title:'Щелчки барабана',description:'Выстави четыре барабана, ориентируясь на громкость и характер щелчка каждого положения.',objective:'ВЫСТАВИТЬ 4 БАРАБАНА ПО СИЛЕ ЩЕЛЧКА',kind:'native',lock:{present:false,manualOpen:true},world:{noise:false,guards:false,birds:false},difficulty:{levels:[1]}},
  scope:{title:'Осциллограф',description:'Настрой четыре гармоники так, чтобы текущая форма сигнала полностью совпала с эталоном.',objective:'СОВМЕСТИТЬ ТЕКУЩИЙ СИГНАЛ С ЭТАЛОНОМ',kind:'native',lock:{present:false,manualOpen:true},world:{noise:false,guards:false,birds:false},difficulty:{levels:[1]}},
  pinflight:{title:'Штифтовый замок',description:'Подбрасывай штифты и фиксируй каждый точно в момент совпадения с верхней прорезью.',objective:'ПОДНЯТЬ И ЗАФИКСИРОВАТЬ ВСЕ ШТИФТЫ',kind:'native',lock:{present:true,manualOpen:true},world:{noise:false,guards:false,birds:false},difficulty:{levels:[1]}},
  springtumblers:{title:'Подпружиненные тумблеры',description:'Выставляй высоту связанных тумблеров и фиксируй их в целевых зонах до окончания времени.',objective:'ВЫСТАВИТЬ И ЗАФИКСИРОВАТЬ ВСЕ ТУМБЛЕРЫ ДО ИСТЕЧЕНИЯ ВРЕМЕНИ',kind:'native',lock:{present:true,manualOpen:true},world:{noise:false,guards:false,birds:false}},
  museum:{title:'Символьный замок',description:'Сопоставляй профиль текущего тумблера с формой в нижнем наборе. Частично закрытый профиль нужно узнать по видимой половине, а заклинивший — выбрать повторно.',objective:'ПОДОБРАТЬ ПРОФИЛЬ ОТМЫЧКИ ДЛЯ КАЖДОГО ТУМБЛЕРА',kind:'native',lock:{present:false,manualOpen:false},world:{noise:false,guards:false,birds:false}},
  pairednodes:{title:'Парные узлы',description:'Открывай узлы попарно, запоминай символы и найди все совпадения до окончания времени.',objective:'НАЙТИ ВСЕ ПАРЫ УЗЛОВ ДО ИСТЕЧЕНИЯ ВРЕМЕНИ',kind:'native',lock:{present:false,manualOpen:false},world:{noise:false,guards:false,birds:false}},
  pipeline:{title:'Трубопровод',description:'Раскрой и поверни плитки, чтобы собрать непрерывный маршрут от входа до выхода до запуска потока.',objective:'СОБРАТЬ МАРШРУТ ОТ ВХОДА ДО ВЫХОДА ДО ЗАПУСКА ПОТОКА',kind:'native',lock:{present:false,manualOpen:false},world:{noise:false,guards:false,birds:false}},
  wharf:{title:'Задвижки набережной',description:'Открывай задвижки в скрытом порядке; ошибочный выбор сбрасывает последовательность. Следи за шумом и замечай птицу над замком, чтобы не привлечь стражу.',objective:'ОТКРЫТЬ ЗАДВИЖКИ ПО ПОРЯДКУ',kind:'native',lock:{present:true,manualOpen:true},world:{noise:true,noiseSensor:true,guards:true,birds:true}},
  ringsecret:{title:'Кольцевой секрет',description:'Выбирай кольца в заданном порядке, находи их скрытые рабочие углы и фиксируй.',objective:'ВЫСТАВИТЬ КОЛЬЦА В СКРЫТОМ ПОРЯДКЕ',kind:'native',lock:{present:true,manualOpen:true},world:{noise:false,guards:false,birds:false}},
  cylinderpath:{title:'Ход цилиндра',description:'Найди рабочую точку и веди отмычку вслед за вращающимся цилиндром, не накапливая стресс.',objective:'НАЙТИ И УДЕРЖАТЬ РАБОЧУЮ ТОЧКУ ДО КОНЦА ПОВОРОТА',kind:'native',lock:{present:true,manualOpen:true},world:{noise:false,guards:false,birds:false}},
  soundlatch:{title:'Звуковой зацеп',description:'Определяй правильный профиль по звуку и удерживай его до полного зацепления на каждой стадии.',objective:'НАЙТИ И УДЕРЖАТЬ ПРОФИЛЬ ОТМЫЧКИ НА КАЖДОЙ СТАДИИ',kind:'native',lock:{present:true,manualOpen:true},world:{noise:false,guards:false,birds:false}},
  torqueangle:{title:'Угол натяжения',description:'Подбери угол отмычки и направление вращения, не доводя износ инструмента до предела.',objective:'НАЙТИ УГОЛ И ВЕРНОЕ НАПРАВЛЕНИЕ ВРАЩЕНИЯ',kind:'native',lock:{present:true,manualOpen:true},world:{noise:true,noiseSensor:true,guards:false,birds:false}},
  ringpassage:{title:'Кольцевой проход',description:'Проходи через вращающиеся кольца к ядру, избегая движущихся блоков.',objective:'ПРОЙТИ ВСЕ 5 КОЛЕЦ И ПОДТВЕРДИТЬ ЯДРО',kind:'native',lock:{present:true,manualOpen:true},world:{noise:false,guards:false,birds:false},difficulty:{levels:[1]}},
  twinbalance:{title:'Двойное равновесие',description:'Ударами удерживай обе стороны механизма в центральных зонах и зафиксируй совпадение.',objective:'СОВМЕСТИТЬ ОБЕ ЗОНЫ С ЦЕНТРАЛЬНОЙ ЛИНИЕЙ И ЗАФИКСИРОВАТЬ',kind:'native',lock:{present:true,manualOpen:true},world:{noise:false,guards:false,birds:false},difficulty:{levels:[1]}},
  timingneedle:{title:'Точная остановка',description:'Останавливай движущуюся иглу в зелёных зонах пять этапов подряд.',objective:'ОСТАНОВИТЬ ИГЛУ НА ЗЕЛЁНОЙ ЗОНЕ 5 РАЗ ПОДРЯД',kind:'native',lock:{present:true,manualOpen:true},world:{noise:false,guards:false,birds:false},difficulty:{levels:[1]}},
  symbolpins:{title:'Символьные штифты',description:'Выставляй пины по высоте и фиксируй их в порядке показанных символов.',objective:'ВЫСТАВИТЬ 5 ПИНОВ В ПОРЯДКЕ СИМВОЛОВ',kind:'native',lock:{present:true,manualOpen:true},world:{noise:false,guards:false,birds:false}}
};

// Scene art belongs to the game catalogue rather than individual mechanics,
// so changing a location never requires editing puzzle code.
const GAME_LOCATIONS={
  silhouettes:'bg-house-03.jpg',
  classic:'bg-church-01.jpg',sequence:'bg-church-01.jpg',special:'bg-church-01.jpg',
  keyprofile:'bg-street-01.jpg',workingangle:'bg-street-01.jpg',ringsecret:'bg-street-01.jpg',
  turnmemory:'bg-basement-01.jpg',pinflight:'bg-basement-01.jpg',soundlatch:'bg-basement-01.jpg',
  torqueangle:'bg-basement-01.jpg',twinbalance:'bg-basement-01.jpg',
  cylinderpath:'bg-house-01.jpg',springtumblers:'bg-house-01.jpg',
  timingneedle:'bg-house-02.jpg',
  deduction:'bg-house-03.jpg',composite:'bg-house-03.jpg',museum:'bg-house-03.jpg',
  tension:'bg-house-04.jpg',resonance:'bg-house-04.jpg',symbolpins:'bg-house-04.jpg',
  signalbalance:'bg-orangery-01.jpg',ringpassage:'bg-orangery-01.jpg',scope:'bg-orangery-01.jpg',
  drum:'bg-orangery-02.jpg',pairednodes:'bg-orangery-02.jpg',
  wharf:'bg-port-01.jpg',pipeline:'bg-port-01.jpg'
};

function freezeGameDefinitions(definitions){
  Object.entries(definitions).forEach(([id,entry])=>{
    // Quiet locations omit the flag for readability; normalization keeps the
    // catalogue schema complete for every consumer.
    if(entry.world.noiseSensor===undefined)entry.world.noiseSensor=false;
    if(entry.lock.specialTool===undefined)entry.lock.specialTool=false;
    // This is a gameplay rule, not a display setting. Capture it from the
    // canonical definition before user-editable `present` overrides are read.
    if(entry.lock.requiresPick===undefined)entry.lock.requiresPick=entry.lock.present;
    if(entry.readiness===undefined)entry.readiness=entry.kind==='native'?4:3;
    if(entry.rating===undefined)entry.rating=null;
    if(entry.difficulty===undefined)entry.difficulty={levels:entry.kind==='native'?[1,2,3]:[]};
    entry.location=`/assets/backgrounds/${GAME_LOCATIONS[id]||'bg-church-01.jpg'}`;
    Object.freeze(entry.lock);
    Object.freeze(entry.world);
    Object.freeze(entry.difficulty.levels);
    Object.freeze(entry.difficulty);
    Object.freeze(entry);
  });
  return Object.freeze(definitions);
}

const GameCatalog=(()=>{
  const store=window.KeynlockSaveStore;
  const definitions=freezeGameDefinitions(GAME_DEFINITIONS);
  const storageKey='keynlockGameCatalogOverrides';
  const editablePaths=Object.freeze(['lock.present','lock.manualOpen','lock.specialTool','world.noise','world.noiseSensor','world.guards','world.birds','readiness','rating']);
  let overrides={};
  overrides=store.getJSON(storageKey,{})||{};
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
      lock:{...base.lock,...saved.lock,requiresPick:base.lock.requiresPick},
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
    store.setJSON(storageKey,overrides);
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
    const picksBefore=Number(picks);
    const context={modeId,source,game,solvedBefore};
    const playerAttempt=['interface','puzzle-control','universal-lock'].includes(source);
    for(const guard of openGuards.get(modeId)||[]) if(guard(context)===false){
      if(game.lock.requiresPick&&playerAttempt&&Number(picks)===picksBefore)window.forceBreakOnePick?.();
      return false;
    }
    const result=handler(context);
    const failedPlayerAttempt=result!=='pending' && !solved && !solvedBefore && playerAttempt;
    if(game.lock.requiresPick&&failedPlayerAttempt&&Number(picks)===picksBefore)window.forceBreakOnePick?.();
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
