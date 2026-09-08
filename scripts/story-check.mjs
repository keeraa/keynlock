import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const dataContext={window:{KeynlockContent:{}}};
runInNewContext(read('js/data/chapter-story.js'),dataContext);
const chapter=dataContext.window.KeynlockContent.chapterStory;
assert.equal(Object.keys(chapter.orders).length,10);
for(const entry of Object.values(chapter.orders))for(const phase of ['before','after']){
  assert(entry[phase].length>=2);
  for(const [speaker,line] of entry[phase]){assert(['sai','kai','tik'].includes(speaker));assert(line.length>20);}
}
function harness(values={},completed=[]){
  const events={},classes=new Set(['lair-open']),state={values:structuredClone(values),shown:[],runs:[],completed:[...completed],modal:false,module:false};
  const store={getJSON:(k,f=null)=>structuredClone(state.values[k]??f),setJSON:(k,v)=>state.values[k]=structuredClone(v)};
  const window={KeynlockSaveStore:store,KeynlockContent:{chapterStory:chapter},KeynlockCampaign:{progress:{completed:state.completed}},
    KeynlockMissions:{start:(mode,tier,options)=>state.runs.push({mode,tier,...options})},
    KeynlockPaintingRewards:{ownedIds:()=>['first-painting']},
    KeynlockDialogs:{scene(scene){if(state.modal)return false;state.modal=true;state.scene=scene;state.shown.push(scene);scene.onPage(scene.page||0);return true;}},
    KeynlockLair:{open(){classes.add('lair-open');}},addEventListener:(name,fn)=>events[name]=fn};
  const document={body:{classList:{contains:name=>classes.has(name)}},querySelector:s=>s==='dialog[open]'?state.modal?{}:null:{hidden:!state.module}};
  runInNewContext(read('js/world/chapter-story.js'),{window,document,queueMicrotask:fn=>fn()});
  return {...state,window,classes,store,state,emit:(name,detail={})=>events[name]?.({detail}),finish(){const s=state.scene;state.modal=false;s.done();}};
}
const h=harness();
for(const id of Object.keys(chapter.orders)){
  const run={orderId:id,mode:chapter.orders[id].mode,tier:1,stepId:'main'};
  const n=h.state.shown.length,r=h.state.runs.length;
  h.window.KeynlockChapterStory.before(run);
  assert.equal(h.state.runs.length,r,'Puzzle must wait for its scene');
  h.window.KeynlockChapterStory.before(run);
  assert.equal(h.state.shown.length,n+1,'Double click must not stack scenes');
  h.finish();assert.equal(h.state.runs.length,r+1);
  h.state.completed.push(id);h.classes.add('solved-notice-visible');
  h.emit('keynlock-mission-cleared',{guided:true,orderId:id});
  h.emit('keynlock-lair-opened');assert.equal(h.state.shown.length,n+1,'Loot stays before story');
  h.classes.delete('solved-notice-visible');h.emit('keynlock-lair-opened');
  if(id==='wharf-1'){
    assert.equal(h.state.shown.length,n+1,'First discovery waits for restoration');
    h.emit('keynlock-restored',{id:'other'});assert.equal(h.state.shown.length,n+1);
    h.emit('keynlock-restored',{id:'first-painting'});
  }
  assert.equal(h.state.shown.length,n+2);assert.equal(h.state.scene.lines,chapter.orders[id].after);h.finish();
  h.window.KeynlockChapterStory.before(run);assert.equal(h.state.shown.length,n+2,'Replay skips read scenes');
  h.emit('keynlock-mission-cleared',{guided:true,orderId:id});h.emit('keynlock-lair-opened');assert.equal(h.state.shown.length,n+2);
}
assert.equal(Object.keys(h.state.values.keynlockChapterStory.seen).length,20);
const saved=harness();
saved.window.KeynlockChapterStory.before({orderId:'hillsfar-1',mode:'hillsfar',tier:1,stepId:'main'});
saved.state.scene.onPage(1);
const loaded=harness(saved.state.values);loaded.emit('keynlock:play');
assert.equal(loaded.state.scene.page,1);loaded.finish();assert.equal(loaded.state.runs[0].mode,'hillsfar');
const old=harness({},['hillsfar-1']);old.window.KeynlockChapterStory.before({orderId:'hillsfar-1',mode:'hillsfar',tier:1,stepId:'main'});assert.equal(old.state.shown.length,0,'Old saves have no backlog');
const blocked=harness();blocked.state.completed.push('hillsfar-1');blocked.emit('keynlock-mission-cleared',{guided:false,orderId:'hillsfar-1'});blocked.emit('keynlock-lair-opened');assert.equal(blocked.state.shown.length,0,'Free map does not advance story');
blocked.emit('keynlock-mission-cleared',{guided:true,orderId:'hillsfar-1'});blocked.state.module=true;blocked.emit('keynlock-lair-opened');assert.equal(blocked.state.shown.length,0,'Modules must not be covered');blocked.state.module=false;blocked.emit('keynlock-lair-opened');assert.equal(blocked.state.shown.length,1);
blocked.state.scene.onPage(1);const postLoaded=harness(blocked.state.values,['hillsfar-1']);postLoaded.emit('keynlock:play');assert.equal(postLoaded.state.scene.page,1);postLoaded.finish();assert.equal(postLoaded.state.runs.length,0,'Post-scene load stays home');
console.log('Chapter story OK — 20 scenes, replay, reload, old saves, loot order, restoration and module isolation.');
