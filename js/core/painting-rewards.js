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

  function createQuiz(painting,paintings,{random=Math.random}={}){
    const titles=new Set([painting.title]);
    const others=paintings.filter(item=>{
      if(titles.has(item.title))return false;
      titles.add(item.title);return true;
    });
    const shuffle=items=>{
      for(let i=items.length-1;i>0;i--){
        const j=Math.floor(random()*(i+1));
        [items[i],items[j]]=[items[j],items[i]];
      }
      return items;
    };
    const choices=shuffle([painting,...shuffle(others).slice(0,3)])
      .map(({id,title})=>({id,title}));
    let answered=false;
    return {choices,answer(id){
      if(answered||!choices.some(item=>item.id===id))return null;
      answered=true;
      const correct=id===painting.id;
      return {correct,coins:correct?50:0};
    }};
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
  window.KeynlockPaintingRewards=Object.freeze({award,ownedIds,createQuiz,reload:load});
})();
