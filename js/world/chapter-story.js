/* Story scenes never award loot or complete puzzles. Guided orders own the
   narrative; free map replays keep their existing independent lifecycle. */
(() => {
  'use strict';
  const store=window.KeynlockSaveStore,key='keynlockChapterStory';
  const chapter=window.KeynlockContent.chapterStory;
  const saved=store.getJSON(key);
  const state=saved||{seen:{},pending:[],active:null,firstPaintingId:null,restored:false};
  // Existing players keep their progress without receiving a backlog of scenes.
  if(!saved)for(const id of window.KeynlockCampaign.progress.completed){state.seen[`${id}:before`]=true;state.seen[`${id}:after`]=true;}
  function persist(){store.setJSON(key,state);}
  persist();
  let showing=false;
  function launch(run){window.KeynlockMissions.start(run.mode,run.tier,{guided:true,orderId:run.orderId,stepId:run.stepId});}
  function play(scene,done){
    if(showing)return;
    const entry=chapter.orders[scene.id];
    if(!entry)return;
    showing=true;
    const opened=window.KeynlockDialogs.scene({
      heading:`${chapter.title} · ${entry.title}`,lines:entry[scene.phase],page:scene.page,
      action:scene.phase==='before'?'К заказу':'В логово',
      onPage(page){state.active={...scene,page};persist();},
      done(){
        state.seen[`${scene.id}:${scene.phase}`]=true;
        if(scene.phase==='after')state.pending=state.pending.filter(id=>id!==scene.id);
        state.active=null;persist();showing=false;done?.();
      }
    });
    if(!opened)showing=false;
  }
  function flush(){
    if(showing||!document.body.classList.contains('lair-open')||document.body.classList.contains('solved-notice-visible')||document.body.classList.contains('main-menu-open')||document.querySelector('dialog[open]'))return;
    if(!document.querySelector('#lairModuleWindow').hidden||!document.querySelector('#lairWorkbenchModal').hidden)return;
    if(state.active){
      const scene=state.active;
      play(scene,scene.phase==='before'?()=>launch(scene.run):flush);return;
    }
    const id=state.pending.find(id=>id!=='wharf-1'||state.restored);
    if(id)play({id,phase:'after',page:0},flush);
  }
  window.KeynlockChapterStory={
    before(run){
      const id=run.orderId;
      if(!chapter.orders[id]||state.seen[`${id}:before`]){launch(run);return;}
      play({id,phase:'before',page:0,run},()=>launch(run));
    }
  };
  window.addEventListener('keynlock-mission-cleared',event=>{
    const {guided,orderId:id}=event.detail;
    if(!guided||!chapter.orders[id]||!window.KeynlockCampaign.progress.completed.includes(id)||state.seen[`${id}:after`])return;
    if(!state.pending.includes(id))state.pending.push(id);
    if(id==='wharf-1'&&!state.firstPaintingId)state.firstPaintingId=window.KeynlockPaintingRewards.ownedIds().at(-1);
    persist();
  });
  window.addEventListener('keynlock-restored',event=>{
    if(event.detail.id===state.firstPaintingId){state.restored=true;persist();queueMicrotask(flush);}
  });
  window.addEventListener('keynlock-lair-opened',()=>queueMicrotask(flush));
  window.addEventListener('keynlock:play',()=>{
    if(state.active||state.pending.some(id=>id!=='wharf-1'||state.restored)){
      if(!document.body.classList.contains('solved-notice-visible'))window.KeynlockLair.open();
      queueMicrotask(flush);
    }
  });
})();
