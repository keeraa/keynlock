import { readFileSync } from 'node:fs';
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
assert(store.schemaVersion===1,'SaveStore schema version must be 1.');
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
assert(gameCatalog.feature('classic','lock.requiresPick')===true,'Physical locks must require a pick.');
assert(gameCatalog.feature('drum','lock.present')===true,'Saved lock visibility must remain editable.');
assert(gameCatalog.feature('drum','lock.requiresPick')===false,'Saved display overrides must not make a logic puzzle require picks.');

const contentContext={window:{}};
for(const file of ['js/data/world.js','js/data/economy.js','js/data/restoration.js','js/data/paintings.js']){
  runInNewContext(source(file),contentContext,{filename:file});
}
const content=contentContext.window.KeynlockContent;
assert(Object.keys(content.world.districts).length===7,'The world must contain seven districts.');
assert(content.world.missionPlaces.length===27,'Mission catalogue size changed unexpectedly.');
assert(content.paintings.length===180,'Painting catalogue size changed unexpectedly.');
assert(content.restoration.targetScore===88,'Restoration target changed unexpectedly.');

globalThis.window=contentContext.window;
const catalogModule=await import('../js/modules/content-catalog.mjs');
assert(catalogModule.getPaintings().length===180,'Content module must expose every painting.');
assert(catalogModule.getDistricts().length===7,'Content module must expose every district.');
assert(catalogModule.getMissions().length===27,'Content module must expose every mission.');
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
const defeat=source('js/core/game-defeat.js');
assert(defeat.includes("reason==='picks'"),'Out-of-picks defeat must have a dedicated return-to-lair flow.');
const inventoryGuard=source('js/core/inventory-hit-testing.js');
for(const mode of ['classic','sequence','special','g1'])assert(inventoryGuard.includes(`'${mode}'`),`Typed tension guard is missing ${mode}.`);
const pigmentMixing=source('js/world/alchemy-pigments.js');
assert(pigmentMixing.includes('KeynlockResources?.components'),'Pigment mixing must use the shared color resource catalogue.');
assert(pigmentMixing.includes('KeynlockResources?.state?.components'),'Pigment mixing must respect the player color inventory.');

console.log('KEYNLOCK scenarios OK — saves, content, rewards, restoration, missions, pigments and typed tools.');
