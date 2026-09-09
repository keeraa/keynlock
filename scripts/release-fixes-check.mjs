import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
function storageHarness({blocked=false,full=false,seed={}}={}){
  const data=new Map(Object.entries(seed)),events=[];
  const flags={blocked,full};
  const storage={get length(){if(flags.blocked)throw Error('SecurityError');return data.size;},key:i=>[...data.keys()][i]??null,
    getItem(k){if(flags.blocked)throw Error('SecurityError');return data.get(k)??null;},
    setItem(k,v){if(flags.blocked||flags.full)throw Error('QuotaExceededError');data.set(k,String(v));},
    removeItem(k){if(flags.blocked)throw Error('SecurityError');data.delete(k);}};
  const window={get localStorage(){if(flags.blocked)throw Error('SecurityError');return storage;},dispatchEvent:e=>events.push(e.type)};
  runInNewContext(read('js/core/save-store.js'),{window,Event:class{constructor(type){this.type=type;}}});
  return {store:window.KeynlockSaveStore,flags,data,events};
}
const old={'keynlockSaveSchema':'1',lockpickBalance:'300',keynlockResources:'{"picks":3}'};
const h=storageHarness({seed:old});
assert(h.store.persistent);
h.flags.full=true;
assert.doesNotThrow(()=>h.store.setJSON('keynlockResources',{picks:2}));
assert.equal(h.store.persistent,false);
assert.equal(h.store.getJSON('keynlockResources').picks,2);
assert.equal(h.store.getItem('lockpickBalance'),'300');
assert.deepEqual(h.events,['keynlock-storage-change']);
h.store.removeItem('lockpickBalance');
assert.equal(h.store.snapshot().lockpickBalance,undefined);
assert.equal(h.store.retry(),false);
h.flags.full=false;
assert(h.store.retry());assert(h.store.persistent);
assert.equal(h.data.has('lockpickBalance'),false);
assert.equal(JSON.parse(h.data.get('keynlockResources')).picks,2);
const reloaded=storageHarness({seed:Object.fromEntries(h.data)});
assert.equal(reloaded.store.getJSON('keynlockResources').picks,2);
// Full storage at boot retains readable saves even when the probe cannot write.
const full=storageHarness({full:true,seed:old});
assert.equal(full.store.persistent,false);assert.equal(full.store.getItem('lockpickBalance'),'300');
const denied=storageHarness({blocked:true});
assert.equal(denied.store.persistent,false);denied.store.setItem('lockpickBalance','42');
assert.equal(denied.store.getItem('lockpickBalance'),'42');
denied.flags.blocked=false;assert(denied.store.retry());assert.equal(denied.data.get('lockpickBalance'),'42');
// Read failure after boot retains the cached inventory and does not throw.
const readFail=storageHarness({seed:old});readFail.flags.blocked=true;
assert.equal(readFail.store.getItem('lockpickBalance'),'300');assert.equal(readFail.store.persistent,false);
// Healthy storage still sees updates from another tab.
h.data.set('lockpickBalance','77');assert.equal(h.store.getItem('lockpickBalance'),'77');
console.log('Save failure recovery OK — quota, denied reads/writes, old saves, deletion, retry and reload.');

const colors=['red','orange','yellow','green','cyan','blue','violet'].map(id=>({id}));
const window={KeynlockResources:{components:colors}};
const source=read('js/world/alchemy-pigments.js');
// Exercise production color math without mounting its interaction listeners.
const prefix=source.slice(0,source.indexOf("  root.addEventListener('click'"));
runInNewContext(prefix+'window.testPigments={mix,matchesTarget};})();',{window,document:{querySelector:()=>({querySelector:()=>({})})}});
const {mix,matchesTarget}=window.testPigments;
for(const {id} of colors){assert(matchesTarget([id],[id,id]));assert(matchesTarget([id],[id,id,id]));}
assert(matchesTarget(['red','blue'],['blue','red']));
assert(!matchesTarget([],[]));assert(!matchesTarget([],['red']));assert(!matchesTarget(['red'],['blue']));
assert(!matchesTarget(['red','red','blue'],['red','blue','blue']));
assert.equal(mix(['cyan']),mix(['cyan','cyan']));
console.log('Pigment verdict OK — identical shades, repeated portions, order, empty and different mixtures.');

// Pre-rename save fixtures deliberately retain obsolete IDs to protect compatibility.
const legacyProgress={
  keynlockSaveSchema:'1',lockpickCurrentMode:'g1',lockpickMapLocation:'mission-thiefds',
  lockpickModeDifficulty:JSON.stringify({g1:3,skyrim:2}),
  lockpickMissions:JSON.stringify({'hillsfar-1':true,'mass2-1':true}),
  keynlockFirstChapter:JSON.stringify({completedSteps:['hillsfar-1/main','mass2-1/main'],currentId:'bioshock2-1'}),
  keynlockChapterStory:JSON.stringify({seen:{'hillsfar-1:before':true},pending:['mass2-1'],active:{id:'bioshock2-1',run:{mode:'bioshock2',orderId:'bioshock2-1'}}}),
  keynlockHandleDropProgress:JSON.stringify({claimed:{'hillsfar-1':true},misses:4}),
  keynlockResources:JSON.stringify({picks:3,coins:500}),
  unrelated:'thiefds',keynlockPlayerNote:'I enjoyed Gothic 1 yesterday.'
};
const legacySlots=JSON.stringify([{name:'My Gothic 1 save',state:legacyProgress}]);
const migrated=storageHarness({seed:{...legacyProgress,keynlockSaveSlots:legacySlots}});
assert.equal(migrated.store.getItem('keynlockSaveSchema'),'2');
assert.equal(migrated.store.getItem('lockpickCurrentMode'),'turnmemory');
assert.equal(migrated.store.getItem('lockpickMapLocation'),'mission-ringsecret');
assert.deepEqual(JSON.parse(JSON.stringify(migrated.store.getJSON('lockpickModeDifficulty'))),{turnmemory:3,workingangle:2});
assert(migrated.store.getJSON('lockpickMissions')['keyprofile-1']);
assert.equal(migrated.store.getJSON('keynlockFirstChapter').completedSteps[0],'keyprofile-1/main');
assert(migrated.store.getJSON('keynlockChapterStory').seen['keyprofile-1:before']);
assert.equal(migrated.store.getJSON('keynlockChapterStory').active.run.mode,'timingneedle');
assert.equal(migrated.store.getJSON('keynlockChapterStory').pending[0],'pairednodes-1');
assert(migrated.store.getJSON('keynlockHandleDropProgress').claimed['keyprofile-1']);
assert.equal(migrated.store.getJSON('keynlockHandleDropProgress').misses,4);
assert.equal(migrated.store.getItem('keynlockResources'),legacyProgress.keynlockResources);
assert.equal(migrated.store.getItem('unrelated'),'thiefds');
assert.equal(migrated.store.getItem('keynlockPlayerNote'),legacyProgress.keynlockPlayerNote);
const slot=migrated.store.getJSON('keynlockSaveSlots')[0];
assert.equal(slot.name,'My Gothic 1 save');
assert.equal(slot.state.lockpickCurrentMode,'turnmemory');
assert(JSON.parse(slot.state.lockpickMissions)['keyprofile-1']);
// Old slots/backups imported after the app has already migrated must also work.
migrated.store.restore(legacyProgress);
assert.equal(migrated.store.getItem('keynlockSaveSchema'),'2');
assert.equal(migrated.store.getItem('lockpickCurrentMode'),'turnmemory');
migrated.store.restore({lockpickCurrentMode:'skyrim',lockpickModeDifficulty:'{"g1":1,"turnmemory":3}'});
assert.equal(migrated.store.getItem('lockpickCurrentMode'),'workingangle');
assert.equal(migrated.store.getJSON('lockpickModeDifficulty').turnmemory,3);
const offlineMigration=storageHarness({full:true,seed:legacyProgress});
assert.equal(offlineMigration.store.getItem('lockpickCurrentMode'),'turnmemory');
offlineMigration.flags.full=false;assert(offlineMigration.store.retry());
assert.equal(offlineMigration.data.get('lockpickCurrentMode'),'turnmemory');
console.log('Mode rename compatibility OK — difficulty, missions, story, rewards, nested slots, imports and quota recovery.');
