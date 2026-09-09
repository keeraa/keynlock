(() => {
  'use strict';
  window.KeynlockContent.campaign={
    tiers:[1,2,3],
    first:['wharf','keyprofile','pairednodes','museum'],
    // Override a job here to introduce multiple puzzles. Keep step IDs stable
    // across edits. Example (not enabled):
    // 'wharf-1': {steps:[{id:'main',mode:'wharf',tier:1},
    //                     {id:'inner',mode:'keyprofile',tier:1}]}
    balance:Object.fromEntries(Object.entries({wharf:8,keyprofile:2,pairednodes:8,museum:3,classic:10,sequence:12,special:10,pipeline:32,timingneedle:5,composite:12}).map(([mode,freeMoves])=>[mode,{freeMoves,rewardFloor:60,movePenalty:2}])),
    overrides:{}
  };
})();
