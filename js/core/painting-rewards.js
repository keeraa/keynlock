(function(){
  'use strict';

  const STORAGE_KEY='keynlockOwnedPaintings';
  const store=window.KeynlockSaveStore;
  let owned=[];

  function load(){
    const saved=store.getJSON(STORAGE_KEY,[]);
    owned=Array.isArray(saved)?saved.filter(id=>typeof id==='string'):[];
  }

  function ownedIds(){
    return [...owned];
  }

  function award({run,currentRoundId,currentMode,missionsDone,missionPlaces,paintings,lootTable,random=Math.random}={}){
    if(!run||run.roundId!==currentRoundId||currentMode!==run.mode)return null;
    const place=missionPlaces.find(item=>item.mode===run.mode);
    if(!place)return null;
    const candidates=paintings.filter(painting=>painting.district===place.district&&!owned.includes(painting.id));
    if(!candidates.length)return null;
    const firstClear=!missionsDone[run.id];
    const repeatChance=lootTable?.[run.tier]?.paintingChance??.2;
    if(!firstClear&&random()>=repeatChance)return null;
    const painting=candidates[Math.floor(random()*candidates.length)];
    owned.push(painting.id);
    store.setJSON(STORAGE_KEY,owned);
    return {id:painting.id,title:painting.title,artist:painting.artist,year:painting.year,image:painting.image,district:place.district};
  }

  load();
  window.KeynlockPaintingRewards=Object.freeze({award,ownedIds,reload:load});
})();
