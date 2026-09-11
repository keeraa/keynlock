import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';

const root=resolve(import.meta.dirname,'..');
const source=path=>readFileSync(resolve(root,path),'utf8');
const assert=(condition,message)=>{if(!condition)throw new Error(message);};

function memoryStorage(seed={}){
  const values=new Map(Object.entries(seed).map(([key,value])=>[key,String(value)]));
  return {
    get length(){return values.size;},
    key:index=>[...values.keys()][index]??null,
    getItem:key=>values.has(key)?values.get(key):null,
    setItem:(key,value)=>values.set(key,String(value)),
    removeItem:key=>values.delete(key)
  };
}

const storage=memoryStorage({
  keynlockResources:JSON.stringify({picks:0,parts:2,oil:1}),
  lockpickBalance:'125'
});
const saveContext={window:{localStorage:storage}};
runInNewContext(source('js/core/save-store.js'),saveContext,{filename:'save-store.js'});
const store=saveContext.window.KeynlockSaveStore;
assert(store.schemaVersion===2,'SaveStore schema version must be 2.');
assert(store.getJSON('keynlockResources').picks===0,'SaveStore must preserve zero picks.');
assert(store.getJSON('keynlockResources').components&&typeof store.getJSON('keynlockResources').components==='object','Migration must add the components object.');
store.setJSON('scenario',{ok:true});
assert(store.getJSON('scenario').ok===true,'SaveStore JSON round trip failed.');
const snapshot=store.snapshot(key=>key.startsWith('lockpick'));
assert(snapshot.lockpickBalance==='125','SaveStore snapshot omitted game progress.');
store.restore({lockpickBalance:'250'},{clear:key=>key.startsWith('lockpick')});
assert(store.getItem('lockpickBalance')==='250','SaveStore restore failed.');

const gameCatalogContext={
  window:{
    KeynlockSaveStore:{
      getJSON:()=>({drum:{lock:{present:true,requiresPick:true}}}),
      setJSON:()=>{}
    },
    dispatchEvent:()=>{}
  },
  CustomEvent:class{}
};
runInNewContext(source('js/core/game-catalog.js'),gameCatalogContext,{filename:'game-catalog.js'});
const gameCatalog=gameCatalogContext.window.GameCatalog;
for(const feature of ['noise','noiseSensor','guards','birds']){
  assert(gameCatalog.feature('wharf',`world.${feature}`)===true,`The first waterfront mission must enable ${feature}.`);
}
assert(gameCatalog.feature('classic','lock.requiresPick')===true,'Physical locks must require a pick.');
assert(gameCatalog.feature('drum','lock.present')===true,'Saved lock visibility must remain editable.');
assert(gameCatalog.feature('drum','lock.requiresPick')===false,'Saved display overrides must not make a logic puzzle require picks.');

// Deferred opening owns its outcome; starting or repeating it is not a failed attempt.
gameCatalogContext.solved=false;
gameCatalogContext.picks=3;
gameCatalogContext.mode='keyprofile';
let deferredBreaks=0;
gameCatalogContext.window.forceBreakOnePick=()=>{deferredBreaks++;};
runInNewContext("GameActions.registerOpen('keyprofile',()=> 'pending'); GameActions.attemptOpen(); GameActions.attemptOpen();",gameCatalogContext);
assert(deferredBreaks===0,'An inserting key must not consume picks before its result.');
runInNewContext("GameActions.registerOpen('keyprofile',()=>undefined); GameActions.attemptOpen();",gameCatalogContext);
assert(deferredBreaks===1,'An immediate failed opening must still consume one pick.');

const contentContext={window:{}};
for(const file of ['js/data/world.js','js/data/economy.js','js/data/restoration.js','js/data/paintings.js']){
  runInNewContext(source(file),contentContext,{filename:file});
}
const content=contentContext.window.KeynlockContent;
assert(Object.keys(content.world.districts).length===7,'The world must contain seven districts.');
assert(content.world.missionPlaces.length===28,'Mission catalogue size changed unexpectedly.');
assert(content.paintings.length===179,'Painting catalogue size changed unexpectedly.');
assert(content.restoration.targetScore===88,'Restoration target changed unexpectedly.');

globalThis.window=contentContext.window;
const catalogModule=await import('../js/modules/content-catalog.mjs');
assert(catalogModule.getPaintings().length===179,'Content module must expose every painting.');
assert(catalogModule.getDistricts().length===7,'Content module must expose every district.');
assert(catalogModule.getMissions().length===28,'Content module must expose every mission.');
assert(Object.keys(catalogModule.getComponents()).length>0,'Content module must expose components.');
assert(Object.keys(catalogModule.getLockLoot()).length>0,'Content module must expose lock loot.');
delete globalThis.window;

const scheduledFrames=[];
const fakeDocument={
  getElementById:()=>null,
  querySelector:()=>null,
  querySelectorAll:()=>[],
  createElement:()=>({style:{}}),
  addEventListener:()=>{},
  body:{},documentElement:{}
};
const engineContext={document:fakeDocument,window:{requestAnimationFrame:callback=>{scheduledFrames.push(callback);return scheduledFrames.length;}}};
runInNewContext(source('js/world/alchemy-engine.js'),engineContext,{filename:'alchemy-engine.js'});
const engine=engineContext.window.KeynlockAlchemyEngine;
engine.requestFrame(()=>{});
assert(scheduledFrames.length===0,'Closed alchemy must park animation frames.');
engine.start();
assert(scheduledFrames.length===1,'Opening alchemy must release parked animation frames.');
engine.stop();
engine.requestFrame(()=>{});
assert(scheduledFrames.length===1,'Stopped alchemy must park new animation frames.');

const rewardStorage=memoryStorage();
const rewardContext={window:{KeynlockSaveStore:null}};
const rewardSaveContext={window:{localStorage:rewardStorage}};
runInNewContext(source('js/core/save-store.js'),rewardSaveContext,{filename:'save-store.js'});
rewardContext.window.KeynlockSaveStore=rewardSaveContext.window.KeynlockSaveStore;
runInNewContext(source('js/core/painting-rewards.js'),rewardContext,{filename:'painting-rewards.js'});
const rewards=rewardContext.window.KeynlockPaintingRewards;
const rewardOptions={
  run:{id:'classic-1',mode:'classic',tier:1,roundId:7},currentRoundId:7,currentMode:'classic',
  missionsDone:{},missionPlaces:[{mode:'classic',district:'port'}],
  paintings:[{id:'p1',title:'One',artist:'Artist',year:'1900',image:'one.png',district:'port'}],
  lootTable:{1:{paintingChance:.2}},random:()=>0
};
assert(rewards.award(rewardOptions)?.id==='p1','First mission clear must award an available district painting.');
assert(rewards.ownedIds()[0]==='p1','Awarded painting must be persisted as owned.');
assert(rewards.award(rewardOptions)===null,'An owned painting must not be awarded twice.');
assert(rewards.award({...rewardOptions,currentRoundId:8})===null,'A stale mission round must not award a painting.');
const quizPainting=rewardOptions.paintings[0];
const quizPool=[quizPainting,{id:'duplicate-title',title:'One'},...['Two','Three','Four','Five'].map((title,index)=>({id:`quiz-${index}`,title}))];
const correctQuiz=rewards.createQuiz(quizPainting,quizPool,{random:()=>.4});
assert(correctQuiz.choices.length===4&&new Set(correctQuiz.choices.map(item=>item.title)).size===4,'Painting quiz must offer four different titles.');
assert(correctQuiz.choices.some(item=>item.id===quizPainting.id),'Painting quiz must include the correct title.');
assert(correctQuiz.answer('missing')===null,'Unknown quiz options must not consume the attempt.');
assert(correctQuiz.answer(quizPainting.id)?.coins===50,'A correct painting title must award 50 coins.');
assert(correctQuiz.answer(quizPainting.id)===null,'Repeated clicks must not award another painting bonus.');
const wrongQuiz=rewards.createQuiz(quizPainting,quizPool);
assert(wrongQuiz.answer(wrongQuiz.choices.find(item=>item.id!==quizPainting.id).id)?.coins===0,'A wrong title must award no coins.');
assert(wrongQuiz.answer(quizPainting.id)===null,'A wrong answer must not allow guessing again.');
let wharfTier=1,wharfMode;
const wharfContext={
  window:{},PuzzleModes:{register:definition=>{wharfMode=definition;}},
  chooseGamePinSkin(){},diffStep:(...counts)=>counts[wharfTier-1],
  $lock:{classList:{remove(){}}},$mechanism:{classList:{remove(){}}},
  $wfLock:null,pickCapacity:3,updateEconomyUI(){}
};
runInNewContext(source('js/modes/wharf.js'),wharfContext,{filename:'wharf.js'});
for(const [tier,count] of [[1,4],[2,6],[3,7],[1,4],[2,6],[1,4]]){
  wharfTier=tier;wharfMode.start();
  assert(wharfContext.generatedDistance===count,`Waterfront tier ${tier} must consistently create ${count} pins after switching tiers.`);
}
// Every artwork rotation must describe the same ports as the route solver.
let pipeTier=1,pipeMode;
const pipeContext={window:{innerWidth:1440,innerHeight:1050,addEventListener(){}},
  document:{body:{style:{setProperty(){}}}},performance:{now:()=>0},
  PuzzleModes:{register:definition=>{pipeMode=definition;}},diffStep:(...values)=>values[pipeTier-1],
  $lock:{classList:{remove(){}}},$mechanism:{classList:{remove(){}}},
  $plGrid:null,$plGridWrap:null,$plStartPort:null,$plExitPort:null,pickCapacity:3,updateEconomyUI(){}};
const pipeSource=source('js/modes/pipeline.js').replace('  PuzzleModes.register({',
  '  window.pipeProbe={tiles:()=>plTiles,paths:()=>plPaths,required:()=>plRequiredPaths,cols:()=>PL_COLS,rotate:plRotateType,turns:plRotationTo,trace:plTraceTiles,family:plPipeFamily,art:plArt};\n  PuzzleModes.register({');
runInNewContext(pipeSource,pipeContext,{filename:'pipeline.js'});
const pipe=pipeContext.window.pipeProbe;
for(const tier of [1,2,3])for(let round=0;round<15;round++){
  pipeTier=tier;pipeMode.start();
  assert(pipe.tiles().length===6*[6,8,10][tier-1],'Pipeline grid must follow difficulty.');
  for(const tile of pipe.tiles()){
    const family=pipe.family(tile.type),base=family==='corner'?'NW':'EW';
    if(family!=='X')assert(pipe.rotate(base,tile.angle/90)===tile.type,'Pipeline artwork rotation must match its logical ports.');
    assert(existsSync(resolve(pipe.art(tile,true).src))&&existsSync(resolve(pipe.art(tile,false).src)),'Pipeline artwork must exist, including hidden covers.');
  }
  pipe.paths().forEach((path,index)=>{
    const tiles=pipe.tiles().map(t=>({...t}));
    path.forEach(([r,c],j)=>{
      const tile=tiles[r*pipe.cols()+c],target=pipe.required()[index][j],turns=pipe.turns(tile.type,target);
      assert(turns>=0,'Generated pipeline route must be orientable.');tile.type=pipe.rotate(tile.type,turns);
    });
    assert(pipe.trace(tiles).ok,'Generated pipeline route must connect start and finish.');
  });
}
let flightTier=1,flightMode;
const flightContext={
  window:{innerWidth:1440,addEventListener(){}},document:{body:{style:{setProperty(){}}}},
  PuzzleModes:{register:definition=>{flightMode=definition;}},
  chooseGamePinSkin(){},diffStep:(...counts)=>counts[flightTier-1],
  $lock:{classList:{remove(){}}},$mechanism:{classList:{remove(){}}},
  $obLock:null,pickCapacity:3,updateEconomyUI(){}
};
runInNewContext(source('js/modes/pinflight.js'),flightContext,{filename:'pinflight.js'});
for(const [tier,count] of [[1,5],[2,6],[3,7],[1,5]]){
  flightTier=tier;flightMode.start();
  assert(flightContext.generatedDistance===count,`Pinflight tier ${tier} must restore its own pin count.`);
}
globalThis.window=rewardContext.window;
const rewardModule=await import('../js/modules/painting-rewards.mjs');
assert(rewardModule.getOwnedPaintingIds()[0]==='p1','Painting reward module must expose owned paintings.');
delete globalThis.window;

const restoration=source('js/world/restoration.js');
assert(restoration.includes('const success=value>=TARGET_SCORE&&clean>=100;'),'Restoration must require both target light and complete cleaning.');
const missions=source('js/world/missions.js');
assert(missions.includes("missionRequiresPicks(loc.mode)&&!playerHasPicks()"),'Physical missions must reject a run without picks.');
assert(missions.includes("missionRequiresPicks(place.mode)&&!playerHasPicks()"),'Physical mission thumbnails must be disabled without picks.');
assert(missions.includes("GameCatalog.feature(mode,'lock.requiresPick')"),'Mission access must use the immutable lockpick requirement, not lock visibility.');
const baseLocks=source('js/modes/base-locks.js');
assert(baseLocks.includes("GameCatalog.feature(mode,'lock.requiresPick')&&picks<=0&&!lairOpen"),'Starting a pickless puzzle or opening the lair with zero picks must not trigger defeat.');
const init=source('js/core/init.js');
assert(init.indexOf("if(mapLocation==='lair')openLair();")<init.indexOf('newLock(false);',init.indexOf('function bootGame')),'The saved lair must open before its hidden puzzle is initialized.');
const gameCatalogSource=source('js/core/game-catalog.js');
assert(gameCatalogSource.includes('game.lock.requiresPick&&failedPlayerAttempt'),'Failed pickless puzzles must not consume a pick.');
const defeat=source('js/core/game-defeat.js');
assert(defeat.includes("reason==='picks'"),'Out-of-picks defeat must have a dedicated return-to-lair flow.');
// Case upgrades preserve older saves and never allow more than six tools.
const pickStateSource=source('js/core/state.js');
const loadCaseSource=pickStateSource.slice(pickStateSource.indexOf('function loadPickProgress(){'),pickStateSource.indexOf('let pickProgress='));
for(const [saved,expected] of [[3,3],[4,4],[5,5],[6,6],[7,6],[undefined,3]]){
  const loaded=runInNewContext(`${loadCaseSource};loadPickProgress()`,{STORE:{getJSON:()=>({capacity:saved})}});
  assert(loaded.capacity===expected,`Saved case ${saved} must load with ${expected} slots.`);
}
const caseResourceSource=source('js/core/resources.js');
const upgradeCaseSource=caseResourceSource.slice(caseResourceSource.indexOf('function upgradeKeynlockCase(){'),caseResourceSource.indexOf('window.KeynlockResources='));
const caseContext={pickProgress:{capacity:3},balance:10000,window:{KeynlockContent:{economy:{caseUpgradePrice:2500}}},STORE:{setItem(){},setJSON(){}},updateEconomyUI(){},saveKeynlockResources(){},renderInventoryTools(){},toast(){}};
caseContext.resourceCaseCapacity=()=>caseContext.pickProgress.capacity;
for(const expected of [4,5,6]){
  assert(runInNewContext(`${upgradeCaseSource};upgradeKeynlockCase()`,caseContext)===true,'Case upgrade must succeed.');
  assert(caseContext.pickProgress.capacity===expected,`Case must upgrade to ${expected} slots.`);
}
assert(runInNewContext(`${upgradeCaseSource};upgradeKeynlockCase()`,caseContext)===false,'A six-slot case cannot be upgraded again.');
assert(caseContext.balance===2500,'Only the three valid upgrades may charge coins.');

const inventoryGuard=source('js/core/inventory-hit-testing.js');
for(const mode of ['classic','sequence','special','turnmemory'])assert(inventoryGuard.includes(`'${mode}'`),`Typed tension guard is missing ${mode}.`);
const pigmentMixing=source('js/world/alchemy-pigments.js');
assert(pigmentMixing.includes('KeynlockResources?.components'),'Pigment mixing must use the shared color resource catalogue.');
assert(pigmentMixing.includes('KeynlockResources?.state?.components'),'Pigment mixing must respect the player color inventory.');

console.log('KEYNLOCK scenarios OK — saves, content, rewards, restoration, missions, pigments and typed tools.');

// Execute the shared damage boundary: logic puzzles never spend physical tools.
const damageSource=source('js/core/ui.js').split('  function damagePick(')[1].split('\n  function forceBreakOnePick')[0];
let consumed=0,resetCount=0,renderCount=0;
const damageContext={
  mode:'museum',GameCatalog:{feature:()=>false},toast:()=>{},
  window:{KeynlockResources:{consumePicks:()=>{consumed++;}}}
};
runInNewContext(`function damagePick(${damageSource}\nthis.damagePick=damagePick;`,damageContext);
const harmless=damageContext.damagePick({resetProgress:()=>resetCount++,renderState:()=>renderCount++});
assert(!harmless.depleted&&consumed===0&&resetCount===1&&renderCount===1,'Logic failure must preserve picks and execute feedback/reset.');

// First-mission protection applies to both random and forced break paths.
const protectedDamageContext={...damageContext,mode:'wharf',picks:1,solved:false,
  GameCatalog:{feature:()=>true},SFX:{survive(){}},
  window:{KeynlockMissions:{protectsLastPick:()=>true},KeynlockResources:{consumePicks(){throw new Error('Protected pick was consumed');}}}
};
const forceSource=source('js/core/ui.js').split('  function forceBreakOnePick(')[1].split('  window.forceBreakOnePick')[0];
runInNewContext(`function damagePick(${damageSource}\nfunction forceBreakOnePick(${forceSource}\nthis.damagePick=damagePick;this.forceBreakOnePick=forceBreakOnePick;`,protectedDamageContext);
let protectedResets=0,protectedRenders=0;
for(let attempt=0;attempt<10;attempt++){
  const result=protectedDamageContext.damagePick({forceBreak:true,resetProgress:()=>protectedResets++,renderState:()=>protectedRenders++});
  assert(result.protected&&!result.broke&&!result.depleted,'The first mission must preserve the last pick even on forced damage.');
  assert(protectedDamageContext.forceBreakOnePick()===false,'Premature opening cannot break the protected pick.');
}
assert(protectedDamageContext.picks===1&&protectedResets===10&&protectedRenders===10,'Protected mistakes must still reset and render the puzzle.');

// Resource recovery is available only when all normal ways of buying/crafting
// are exhausted, and cannot be repeatedly claimed while parts remain.
const recoveryEvents=[];
const recoveryContext={
  window:{KeynlockContent:content,dispatchEvent:()=>{}},
  STORE:{getJSON:()=>null,setJSON:()=>{},setItem:()=>{}},
  document:{querySelector:()=>null,addEventListener:(_,fn)=>recoveryEvents.push(fn)},
  CustomEvent:class{},queueMicrotask:()=>{},pickProgress:{capacity:3},balance:0,
  lairOpen:true,renderInventoryTools:()=>{},toast:()=>{},updateEconomyUI:()=>{}
};
runInNewContext(source('js/core/resources.js'),recoveryContext);
const recoveryResources=recoveryContext.window.KeynlockResources.state;
assert(recoveryResources.picks===3,'A new game must start with three picks.');
const resourceClick=id=>recoveryEvents[0]({target:{closest:selector=>selector===id?{}:null}});
recoveryResources.picks=0;
resourceClick('#salvagePickButton');
assert(recoveryResources.parts===6,'An exhausted player must recover materials for three picks.');
resourceClick('#salvagePickButton');
assert(recoveryResources.parts===6,'Recovery cannot accumulate free parts.');
resourceClick('#craftAllPicksButton');
assert(recoveryResources.picks===3&&recoveryResources.parts===0,'Recovered parts must refill the starter case.');
resourceClick('#salvagePickButton');
assert(recoveryResources.parts===0,'Recovery must be unavailable when a pick remains.');
recoveryResources.picks=0;recoveryContext.balance=30;
resourceClick('#salvagePickButton');
assert(recoveryResources.parts===0,'Recovery must be unavailable when a pick can be bought.');
recoveryContext.balance=0;recoveryContext.lairOpen=false;
resourceClick('#salvagePickButton');
assert(recoveryResources.parts===0,'Recovery must only work in the lair.');
recoveryContext.window.KeynlockMissions={protectsLastPick:()=>true};
recoveryResources.picks=3;
assert(recoveryContext.window.KeynlockResources.consumePicks(3)===2&&recoveryResources.picks===1,'Mass tool loss must preserve one tutorial pick.');
assert(recoveryContext.window.KeynlockResources.consumePicks(1)===0&&recoveryResources.picks===1,'Repeated loss must preserve the last tutorial pick.');
recoveryContext.window.KeynlockMissions.protectsLastPick=()=>false;
assert(recoveryContext.window.KeynlockResources.consumePicks(1)===1&&recoveryResources.picks===0,'Ordinary play must still consume the last pick.');
console.log('Chapter safety OK — pickless damage and exhausted-player recovery.');

// Exercise launch/retry/credit with the real mission controller, including
// stale rounds and a repeated completion callback.
const missionWrites=new Map(),missionEvents=[],missionDifficulties={};
const missionContext={
  window:{KeynlockContent:content,KeynlockResources:{state:{picks:3}},dispatchEvent:event=>missionEvents.push(event),addEventListener:()=>{}},
  STORE:{getJSON:()=>null,getItem:()=>null,setJSON:(k,v)=>missionWrites.set(k,JSON.parse(JSON.stringify(v))),setItem:()=>{}},
  CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail;}},
  document:{querySelector:()=>null,querySelectorAll:()=>[],body:{classList:{contains:()=>missionContext.inactive,remove:()=>{}}}},
  GameCatalog:gameCatalog,MAP_LOCATIONS:{lair:{}},MAP_CONNECTIONS:{},DISTRICTS:content.world.districts,
  gameDefeat:{isActive:()=>false},mapLocation:'lair',mapOpen:false,lairOpen:false,mode:'museum',solved:false,activeRoundId:0,inactive:false,
  toast:()=>{},renderWorldMap:()=>{},celebrate:()=>{missionContext.inactive=true;},
  syncModePanels:()=>{},updateModeUI:()=>{},setModeDifficulty:(tier,id)=>{missionDifficulties[id]=tier;},getModeDifficulty:id=>missionDifficulties[id]||1,
  newLock:()=>{missionContext.activeRoundId++;missionContext.solved=false;missionContext.inactive=false;missionContext.window.onKeynlockRoundStarted?.(missionContext.activeRoundId);}
};
runInNewContext(source('js/world/missions.js'),missionContext);
const missionService=missionContext.window.KeynlockMissions;
// Selecting one mission's tier must not change another mission or its default.
missionService.start('pipeline',3);
missionContext.startMapMission('mission-wharf');
assert(missionService.active.tier===1&&missionDifficulties.pipeline===3,'Opening another map game must keep its own difficulty.');
missionService.start('wharf',2);
missionContext.startMapMission('mission-pipeline');
assert(missionService.active.tier===3&&missionDifficulties.wharf===2,'Returning from the map must restore that game’s selected difficulty.');
missionService.start('wharf');
assert(missionService.active.tier===2,'Launching without an explicit tier must reuse the selected game’s difficulty.');
missionContext.startMapMission('mission-silhouettes');
assert(missionService.active.tier===1,'A single-level game must remain playable after a tier-three mission.');
assert(missionService.start('silhouettes',3)===false&&missionDifficulties.pipeline===3,'Unsupported difficulty must not affect other games.');
// Returning home must preserve the terminal round state, so Continue retries it.
missionService.start('wharf',1,{guided:true,orderId:'wharf-1',stepId:'main'});
const defeatedRound=missionService.active.roundId;
missionContext.solved=true;missionContext.inactive=true;
missionContext.openLairFromHud=()=>{missionContext.lairOpen=true;};
missionContext.closeLair=()=>{missionContext.lairOpen=false;};
missionContext.setGameInactive=value=>{missionContext.inactive=value;};
const returnHomeCallback=source('js/core/state.js').match(/onReturnToLair:(.*?)\}\),/)[1];
runInNewContext(`(${returnHomeCallback})()`,missionContext);
assert(missionContext.solved&&missionContext.lairOpen,'Returning home after defeat must keep the round finished.');
assert(missionService.resume()&&missionService.active.roundId>defeatedRound&&!missionContext.solved,'Continue after defeat must start a fresh round.');
assert(missionService.active.guided&&missionService.active.orderId==='wharf-1','Retry must retain the active order.');

assert(missionService.start('wharf',1)===true&&missionService.protectsLastPick(),'First waterfront mission must protect the last pick without requiring guidance.');
assert(missionService.retry()&&missionService.protectsLastPick(),'Protection must survive a retry.');
missionContext.mode='museum';
assert(!missionService.protectsLastPick(),'A stale first-mission run must not protect other games.');
missionService.start('wharf',2);
assert(!missionService.protectsLastPick(),'Higher waterfront levels must not get tutorial protection.');
missionService.start('wharf',1);missionContext.solved=true;missionContext.inactive=true;
missionContext.window.markMissionCleared();
assert(missionWrites.get('lockpickMissions')['wharf-1'],'First victory must persist completion.');
missionService.start('wharf',1);
assert(!missionService.protectsLastPick(),'Replaying a completed first mission must use normal break rules.');
missionEvents.length=0;
assert(missionService.start('keyprofile',1,{guided:true,orderId:'keyprofile-1',stepId:'main'})===true,'Guided mission must launch.');
const firstRound=missionService.active.roundId;
assert(missionService.retry()&&missionService.active.roundId>firstRound&&missionService.active.guided,'Retry must preserve the guided mission and create a new round.');
assert(missionService.active.orderId==='keyprofile-1'&&missionService.active.stepId==='main','Retry must preserve the order and puzzle identity.');
missionContext.solved=true;missionContext.inactive=true;
missionContext.window.markMissionCleared();
assert(missionWrites.get('lockpickMissions')['keyprofile-1'],'A retried mission must be credited.');
missionContext.window.markMissionCleared();
assert(missionEvents.filter(e=>e.type==='keynlock-mission-cleared').length===1,'A mission completion must only be emitted once.');
missionService.start('museum',1,{guided:true});
missionContext.mode='pairednodes';missionContext.solved=true;
missionContext.window.markMissionCleared();
assert(!missionWrites.get('lockpickMissions')['museum-1'],'Winning another mode must not credit the abandoned mission.');
missionContext.window.KeynlockResources.state.picks=0;
assert(!missionService.start('keyprofile',1),'Physical missions must reject zero picks.');
assert(missionService.start('museum',1)===true,'Logic missions must remain playable with zero picks.');
console.log('Mission lifecycle OK — guided retry, single credit, stale-round rejection and zero-pick access.');

missionService.start('museum',1,{guided:true});
missionContext.solved=true;missionContext.gameDefeat.isActive=()=>true;
missionContext.window.markMissionCleared();
assert(!missionWrites.get('lockpickMissions')['museum-1'],'A defeat must never credit a mission even though it marks the round solved.');


// A campaign is ordered by tier, and only includes implemented difficulties.
const routeContext={window:{}};
runInNewContext(source('js/core/campaign-route.js'),routeContext);
const route=routeContext.window.KeynlockCampaignRoute;
const routeOrders=route.buildOrders({catalog:gameCatalog,places:content.world.missionPlaces});
assert(routeOrders[0].id==='wharf-1','The quay mechanism must start the route.');
for(const tier of [1,2,3]){
  const expected=content.world.missionPlaces.filter(p=>gameCatalog.get(p.mode).difficulty.levels.includes(tier));
  assert(routeOrders.filter(o=>o.tier===tier).length===expected.length,`Missing orders for tier ${tier}.`);
}
assert(routeOrders.every((o,i)=>!i||o.tier>=routeOrders[i-1].tier),'Finish each difficulty before the next one.');
const routeProgress=route.createProgress(routeOrders);
const tierTwo=routeOrders.find(o=>o.tier===2);
assert(!routeProgress.allowed(tierTwo),'Tier two must be locked at the start.');
for(const order of routeOrders){
  assert(routeProgress.next().id===order.id,'Unexpected next order.');
  const step=routeProgress.step(order);
  assert(!routeProgress.complete(order.id,step.id,step.mode,step.tier+1),'The wrong difficulty must not advance an order.');
  assert(routeProgress.complete(order.id,step.id,step.mode,step.tier),'A valid puzzle must advance the route.');
}
assert(routeProgress.next()===null&&routeProgress.completed.length===routeOrders.length,'The entire route must be completable.');
const migrated=route.createProgress(routeOrders,{introduced:true,completed:['museum','wharf']});
assert(migrated.done(routeOrders[0])&&migrated.next().id==='keyprofile-1','Old journal progress must migrate by mode, without unlocking tier two.');
assert(!migrated.allowed(tierTwo),'Legacy completion must not unlock tier two.');
const flexible=route.buildOrders({catalog:gameCatalog,places:content.world.missionPlaces,overrides:{
  'wharf-1':{steps:[{id:'main',mode:'wharf',tier:1},{id:'inner',mode:'keyprofile',tier:1},{id:'last',mode:'wharf',tier:1}]}
}});
let flexibleProgress=route.createProgress(flexible);
assert(!flexibleProgress.complete('wharf-1','last','wharf',1),'A later puzzle in the same job must remain locked.');
assert(flexibleProgress.complete('wharf-1','main','wharf',1),'First puzzle should be credited.');
flexibleProgress=route.createProgress(flexible,flexibleProgress.snapshot());
assert(flexibleProgress.step(flexible[0]).id==='inner'&&!flexibleProgress.done(flexible[0]),'Reload must preserve partial job completion.');
assert(flexibleProgress.complete('wharf-1','inner','keyprofile',1),'Second puzzle should be credited.');
assert(flexibleProgress.complete('wharf-1','last','wharf',1),'Repeated mode with a different step ID should be credited.');
assert(flexibleProgress.next().id==='keyprofile-1','Only all three puzzles complete the job.');
for(const [n,word] of [[0,'отмычек'],[1,'отмычка'],[2,'отмычки'],[3,'отмычки'],[5,'отмычек'],[11,'отмычек'],[21,'отмычка'],[22,'отмычки']]){
  assert(route.quantity(n,['отмычка','отмычки','отмычек'])===`${n} ${word}`,'Russian tool quantity is incorrect.');
}
assert(route.quantity(1,['деталь','детали','деталей'])==='1 деталь','Singular parts must be correct.');
console.log(`Campaign route OK — ${routeOrders.length} orders, tier gates, legacy saves, multi-puzzle jobs and Russian quantities.`);

flexibleProgress.beginReplay(flexible[0]);
assert(flexibleProgress.complete('wharf-1','main','wharf',1),'A completed job can be replayed.');
assert(flexibleProgress.step(flexible[0]).id==='inner','Replay must continue to its second puzzle.');
assert(flexibleProgress.complete('wharf-1','inner','keyprofile',1)&&flexibleProgress.complete('wharf-1','last','wharf',1),'Replay must allow all three puzzles.');
assert(flexibleProgress.replayOrder===null&&flexibleProgress.done(flexible[0]),'Finishing a replay must preserve original completion.');

// Repeated HUD ticks must not mutate the DOM when their displayed values match.
{
  let writes=0;
  const tracked=()=>new Proxy({}, {set(target,key,value){writes++;target[key]=value;return true;}});
  const nodes=new Map();
  const node=()=>Object.assign(tracked(),{classList:{toggle(){writes++;}},setAttribute(){writes++;},style:tracked(),dataset:tracked()});
  const hudRoot=node();hudRoot.querySelector=id=>{if(!nodes.has(id))nodes.set(id,node());return nodes.get(id);};
  const context={window:{}};
  runInNewContext(source('js/core/challenge-hud.js'),context);
  const hud=new context.window.GameChallengeHud(hudRoot);
  hud.setTimer({active:true,timeLeft:60,timeMax:70});writes=0;
  for(let i=0;i<100;i++)hud.setTimer({active:true,timeLeft:60,timeMax:70});
  assert(writes===0,'Identical timer ticks must not repeat DOM writes');
  hud.setTimer({active:true,timeLeft:59,timeMax:70});
  assert(nodes.get('#challengeTimerValue').textContent==='00:59','Changed timer value must still update');
  hud.setTimer({active:false});assert(hud.timerActive===false,'Timer must still hide');
}
console.log('HUD performance OK — unchanged ticks avoid DOM writes; changing values still render.');

// Teaching rounds allow exploration without making a long puzzle pay less than a spare pick.
const lessonConfigContext={window:{KeynlockContent:{}}};
runInNewContext(source('js/data/campaign.js'),lessonConfigContext);
const lessonPolicies=lessonConfigContext.window.KeynlockContent.campaign.balance;
assert(Object.keys(lessonPolicies).length===10,'The opening ten modes need explicit balance policies.');
const moveSource=source('js/core/ui.js').split('  function registerMove(){')[1].split('\n  function awardRun(){')[0];
const lessonRewardContext={mode:'pipeline',moves:0,runReward:100,toolMotionController:{impulse:()=>{}},animateRewardDrop:()=>{},updateEconomyUI:()=>{},window:{KeynlockCampaign:{balance:id=>lessonPolicies[id]}}};
runInNewContext(`function registerMove(){${moveSource}\nthis.performMove=registerMove;`,lessonRewardContext);
for(let i=0;i<32;i++)lessonRewardContext.performMove();
assert(lessonRewardContext.runReward===100,'Revealing and planning the introductory pipe route must not immediately erase its reward.');
for(let i=0;i<100;i++)lessonRewardContext.performMove();
assert(lessonRewardContext.runReward===60,'A long introductory attempt must still cover two purchased picks.');
lessonRewardContext.window.KeynlockCampaign.balance=()=>null;
lessonRewardContext.performMove();
assert(lessonRewardContext.runReward===10,'Advanced rounds retain their existing reward curve.');
console.log('Opening balance OK — exploration allowance, reward floor and advanced-round isolation.');

// A failed pipe route destroys the carried set exactly once, including repeat ticks.
const pipeFailureSource=source('js/modes/pipeline.js').split('  function plFail(msg){')[1].split('\n  let plPausedAt')[0];
const pipeFailureContext={solved:false,plState:'flow',plPos:{r:2,c:0},pickCapacity:3,picks:3,brokenPicks:0,SFX:{wrongLock:()=>{},break:()=>{}},updatePickUI:()=>{},renderPipeline:()=>{},spent:0,slots:[],failure:null};
pipeFailureContext.window={KeynlockResources:{consumePicks:n=>{pipeFailureContext.spent+=n;}}};
pipeFailureContext.triggerInventoryBreakAnimation=slot=>pipeFailureContext.slots.push(slot);
pipeFailureContext.showGameDefeat=(reason,options)=>{pipeFailureContext.failure={reason,...options};};
runInNewContext(`function plFail(msg){${pipeFailureSource}\nthis.fail=plFail;`,pipeFailureContext);
pipeFailureContext.fail('Трубы не соединены');
pipeFailureContext.fail('Повторный тик');
assert(pipeFailureContext.picks===0&&pipeFailureContext.spent===3&&pipeFailureContext.brokenPicks===3,'Pipe failure must consume exactly the carried set once.');
assert(pipeFailureContext.slots.join() === '3,2,1'&&pipeFailureContext.failure.reason==='picks','Pipe failure must animate every carried pick and return the player to the lair.');

// Guard penalties are applied once per defeat, persist, and always lead home.
for(const [roll,coins,expectedCoins,expectedPicks] of [[0,101,101,0],[.4,101,50,7],[.9,101,0,7],[0,0,0,0],[.4,0,0,0],[.9,0,0,0]]){
  const elements=Object.fromEntries(['Title','Text','Restart','Loss','LossValue'].map(name=>['#gameDefeat'+name,{textContent:'',hidden:false,setAttribute(){},addEventListener(type,fn){this.click=fn;},focus(){}}]));
  const resourceState={picks:7};const saved={};let home=0;
  const context={Math:Object.assign(Object.create(Math),{random:()=>roll}),balance:coins,picks:3,
    STORE:{setItem:(key,value)=>saved[key]=value},updatePickUI(){},updateEconomyUI(){},
    window:{KeynlockResources:{state:resourceState,consumePicks(n){resourceState.picks-=n;saved.picks=resourceState.picks;return n;},render(){}}},
    document:{body:{classList:{add(){},remove(){}}}},requestAnimationFrame:fn=>fn(),
    root:{querySelector:key=>elements[key],dataset:{},hidden:true},goHome:()=>home++};
  runInNewContext(source('js/core/game-defeat.js')+'\nconst defeat=new GameDefeat(root,{onReturnToLair:goHome}); defeat.show("noise"); defeat.show("noise");',context);
  assert(context.balance===expectedCoins&&resourceState.picks===expectedPicks,'Guard penalty incorrect or charged twice.');
  assert(elements['#gameDefeatText'].textContent.startsWith('Вы привлекли внимание шумным взломом.'),'Guard introduction missing.');
  assert(elements['#gameDefeatRestart'].textContent==='Вернуться в логово','Guard action must lead home.');
  elements['#gameDefeatRestart'].click();assert(home===1,'Guard defeat did not return home.');
  if(roll>0&&coins>0)assert(saved.lockpickBalance===String(expectedCoins),'Guard coin penalty was not persisted.');
  if(coins===0){
    assert(elements['#gameDefeatText'].textContent.includes('Вы сбежали'),'A penniless player must escape with lost tools.');
    assert(elements['#gameDefeatLoss'].hidden,'A penniless player must not see a zero-coin loss.');
  }
}
console.log('Guard encounters OK — three outcomes, zero coins, odd rounding, single charge and return home.');

// Resonance charges only misses, forces a break and never makes rewards negative.
const resonanceSource=source('js/modes/resonance.js');
const resonanceHit=resonanceSource.slice(resonanceSource.indexOf('function hitResonance(){'),resonanceSource.indexOf('function tickResonance('));
const resonanceContext={solved:false,rsReady:false,rsIndex:0,rsPinCount:4,moves:0,runReward:100,position:50,broken:0,toolMotionController:{impulse(){}},SFX:{move(){},ready(){},wrongLock(){}},diffStep:()=>5,renderResonance(){},animateRewardDrop(){},updateEconomyUI(){}};
resonanceContext.rsPos=()=>resonanceContext.position;
resonanceContext.damagePick=options=>{assert(options.forceBreak===true,'A resonance miss must always break a pick.');resonanceContext.broken++;options.resetProgress();options.renderState();};
runInNewContext(resonanceHit+';this.hit=hitResonance;this.open=tryOpenResonance;',resonanceContext);
resonanceContext.hit();
assert(resonanceContext.runReward===100&&resonanceContext.broken===0,'Correct resonance hits must not reduce rewards or break picks.');
resonanceContext.position=80;resonanceContext.hit();
assert(resonanceContext.runReward===80&&resonanceContext.broken===1,'One resonance miss must cost exactly 20 reward coins and one pick.');
resonanceContext.position=50;resonanceContext.hit();
assert(resonanceContext.runReward===80,'Correct hits must not restore an earlier penalty.');
resonanceContext.position=80;for(let i=0;i<6;i++)resonanceContext.hit();
assert(resonanceContext.runReward===0,'Resonance reward cannot fall below zero.');
resonanceContext.runReward=100;const beforeEarlyOpen=resonanceContext.broken;resonanceContext.open();
assert(resonanceContext.runReward===80&&resonanceContext.broken===beforeEarlyOpen+1,'Opening an unfinished resonance lock must apply one miss penalty.');


const progressionRewardContext={window:{KeynlockContent:content}};
runInNewContext(source('js/core/reward-policy.js'),progressionRewardContext);
const policy=progressionRewardContext.window.KeynlockRewardPolicy;
const openingModes=['wharf','keyprofile','pairednodes','museum','classic','sequence','special','pipeline','timingneedle','composite'];
let milestones=0,bonuses=0;const claimed={};
for(const mode of openingModes){
  const id=`${mode}-1`;
  const bonus=policy.firstClearBonus(id,claimed);bonuses+=bonus;
  if(policy.handleDrop({id,misses:0,claimed,chance:.04,roll:.99}).milestone)milestones++;
  claimed[id]=true;
  assert(policy.firstClearBonus(id,claimed)===0,'Repeated first-clear bonus.');
  assert(!policy.handleDrop({id,misses:0,claimed,chance:.04,roll:.99}).drop,'Repeated milestone handle.');
}
assert(milestones===8&&bonuses===1350,'Opening rewards must fund eight handles and the case milestone.');
assert(!policy.handleDrop({id:'scope-1',misses:3,claimed,chance:.04,roll:.99}).drop,'Pity triggered too early.');
assert(policy.handleDrop({id:'scope-1',misses:4,claimed,chance:.04,roll:.99}).drop,'Fifth victory must break a dry streak.');
assert(policy.handleDrop({id:'scope-1',misses:0,claimed,chance:.04,roll:.039}).drop,'Random chance disabled.');
assert(!policy.handleDrop({id:'scope-1',misses:0,claimed,chance:.04,roll:.04}).drop,'Chance boundary incorrect.');
console.log('Progression rewards OK — eight milestones, one-time coin bonuses, random drops and five-win pity.');

await import("./story-check.mjs");

await import("./audio-check.mjs");

await import("./release-fixes-check.mjs");
await import("./asset-preload-check.mjs");

// Loading and menus pause hazards, including a strike callback already queued.
const hazardClasses=new Set(['assets-loading']);
const hazardEffects=[];
const hazardContext={document:{hidden:false,body:{dataset:{},classList:{contains:name=>hazardClasses.has(name),remove(){},add(){hazardEffects.push('flash');}}}},
  mode:'classic',lairOpen:false,mapOpen:false,solved:false,guardsCalled:false,
  GameCatalog:{feature:()=>true},clearTimeout(){},setTimeout(){hazardEffects.push('timer');return 1;},
  BIRD_GAP_MIN:14000,BIRD_GAP_MAX:26000,BIRD_NOISE_MIN:.5,BIRD_NOISE_MAX:.8,birdTimer:0,birdState:'warning',
  sendBird(){},endBird(){hazardContext.birdState='idle';},flashHitFromAbove(){hazardEffects.push('hit');},
  SFX:{birdHit(){hazardEffects.push('sound');}},toast(){},addNoise(){hazardEffects.push('noise');}};
const pauseSource=source('js/core/state.js').split('  function syncWorldPauseState(){')[0];
const hazardSource=source('js/world/guards.js');
runInNewContext(pauseSource+
  hazardSource.slice(hazardSource.indexOf('  function noiseGameId(){'),hazardSource.indexOf('  let guardFace'))+
  hazardSource.slice(hazardSource.indexOf('  function birdsActive(){'),hazardSource.indexOf('  let birdHovered'))+
  hazardSource.slice(hazardSource.indexOf('  function birdStrike(){'),hazardSource.indexOf('  // Looking up is the same gesture')),hazardContext);
for(const blocked of ['assets-loading','main-menu-open','game-settings-open','game-defeat']){
  hazardClasses.clear();hazardClasses.add(blocked);
  assert(hazardContext.isWorldPaused()&&!hazardContext.noiseActive()&&!hazardContext.birdsActive(),`Hazards must pause during ${blocked}.`);
  hazardContext.scheduleBird();hazardContext.birdState='warning';hazardContext.birdStrike();
  assert(hazardEffects.length===0,`No bird timer, hit, sound, shake or noise during ${blocked}.`);
}
hazardClasses.clear();
assert(hazardContext.noiseActive()&&hazardContext.birdsActive(),'Hazards must resume in active gameplay.');
hazardContext.scheduleBird();hazardContext.birdState='warning';hazardContext.birdStrike();
assert(hazardEffects.join(',')==='timer,hit,sound,flash,noise','Active gameplay must retain the bird encounter.');
hazardClasses.add('prototype-mechanic-open');
assert(hazardContext.noiseActive()&&!hazardContext.birdsActive(),'Prototype gameplay keeps noise but suppresses native birds.');
hazardClasses.add('assets-loading');
assert(!hazardContext.noiseActive(),'Loading must also pause a prototype mechanic.');
hazardClasses.clear();hazardContext.document.hidden=true;
assert(!hazardContext.noiseActive()&&!hazardContext.birdsActive(),'A background tab must pause hazards.');
console.log('Startup hazards OK — loading, menus, queued strikes, active play and prototype pause.');

// Guard artwork follows the current encounter, never a stale caught class.
const guardClasses=new Set(['caught','watching']);
const guardVisualContext={guardFace:{style:{setProperty(){}},classList:{toggle(name,on){if(on)guardClasses.add(name);else guardClasses.delete(name);}}},
  guardsActive:()=>true,solved:true,noiseLevel:1,NOISE_WARN:.68,gameDefeat:{isActive:()=>false,reason:'noise'}};
const guardRenderSource=source('js/world/guards.js').split('  function renderGuardFace(){')[1].split('  function buildNoiseMeter')[0];
runInNewContext(`function renderGuardFace(){${guardRenderSource};this.renderGuardFace=renderGuardFace;`,guardVisualContext);
guardVisualContext.renderGuardFace();
assert(guardClasses.size===0,'Guard portrait must disappear after a completed encounter and on victory.');
guardVisualContext.gameDefeat.isActive=()=>true;
guardVisualContext.renderGuardFace();
assert(guardClasses.has('caught'),'An active guard defeat may show the guard portrait.');
guardVisualContext.guardsActive=()=>false;
guardVisualContext.renderGuardFace();
assert(guardClasses.size===0,'The lair must hide the guard portrait even before a retry.');
console.log('Guard retry lifecycle OK — finished round, fresh retry and portrait cleanup.');

// Reagent hit testing uses a small screen-space tolerance around discovered UV
// pixels, including transparent holes, resized canvases and painting edges.
const reagentSource=source('js/world/restoration.js').split('  function reagentPoint(event){')[1].split('  function applyDiagnosticReagent')[0];
for(const scale of [.5,1,2]){
  const marks=new Map([['20,20',255],['0,0',255],['40,40',20]]);
  const scan={width:80,height:100,getBoundingClientRect:()=>({left:100,top:200,width:80*scale,height:100*scale}),getContext:()=>({getImageData(left,top,w,h){const data=new Uint8ClampedArray(w*h*4);for(let y=0;y<h;y++)for(let x=0;x<w;x++)data[(y*w+x)*4+3]=marks.get(`${left+x},${top+y}`)||0;return {data};}})};
  const ctx={elements:{scan}};
  runInNewContext(`function reagentPoint(event){${reagentSource};this.hit=reagentPoint;`,ctx);
  const hit=ctx.hit({clientX:100+20*scale+6,clientY:200+20*scale});
  assert(hit?.x===20&&hit?.y===20,'A six-pixel miss beside a discovered stain must still hit at every scale.');
  assert(ctx.hit({clientX:100+20*scale+9,clientY:200+20*scale})===null,'Distant clicks must not activate stains.');
  assert(ctx.hit({clientX:100,clientY:200})?.x===0,'Stains on canvas edges must remain clickable.');
  assert(ctx.hit({clientX:100+40*scale,clientY:200+40*scale})===null,'Unrevealed or transparent pixels cannot be activated.');
}
console.log('Reagent precision OK — nearby discovered stains, scaling, edges and rejected empty clicks.');
