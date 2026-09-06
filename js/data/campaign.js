(() => {
  'use strict';
  window.KeynlockContent.campaign={
    tiers:[1,2,3],
    first:['wharf','hillsfar','mass2','museum'],
    // Override a job here to introduce multiple puzzles. Keep step IDs stable
    // across edits. Example (not enabled):
    // 'wharf-1': {steps:[{id:'main',mode:'wharf',tier:1},
    //                     {id:'inner',mode:'hillsfar',tier:1}]}
    overrides:{}
  };
})();
