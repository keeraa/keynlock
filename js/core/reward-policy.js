/* Pure reward decisions shared by gameplay, previews and scenario checks. */
(() => {
  const opening=['wharf','hillsfar','mass2','museum','classic','sequence','special','pipeline','bioshock2','composite'];
  const guaranteed=new Set([0,1,2,3,4,5,7,9].map(i=>`${opening[i]}-1`));
  function firstClearBonus(id,claimed){
    if(claimed[id])return 0;
    const index=opening.findIndex(mode=>`${mode}-1`===id);
    return index<0?0:75+(index===9?600:0);
  }
  function handleDrop({id,misses=0,claimed={},chance,roll}){
    const milestone=guaranteed.has(id)&&!claimed[id];
    const pity=misses+1>=window.KeynlockContent.economy.handlePity;
    return {drop:milestone||pity||roll<chance,milestone};
  }
  window.KeynlockRewardPolicy=Object.freeze({firstClearBonus,handleDrop,isMilestone:id=>guaranteed.has(id)});
})();
