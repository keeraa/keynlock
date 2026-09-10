  const KEYNLOCK_COMPONENTS=window.KeynlockContent.economy.components;
  const KEYNLOCK_LOCK_LOOT_TABLE=window.KeynlockContent.economy.lockLoot;

  function loadKeynlockResources(){
    const fallback={picks:3,parts:0,oil:0,oilerCapacity:3,components:Object.fromEntries(KEYNLOCK_COMPONENTS.map(item=>[item.id,0]))};
    try{
      const saved=STORE.getJSON('keynlockResources');
      if(!saved)return fallback;
      return {
        picks:saved.picks===undefined?3:Math.max(0,Math.floor(Number(saved.picks)||0)),
        parts:Math.max(0,Number(saved.parts)||0),
        oil:Math.max(0,Number(saved.oil)||0),
        oilerCapacity:Math.max(1,Number(saved.oilerCapacity)||3),
        components:Object.fromEntries(KEYNLOCK_COMPONENTS.map(item=>[item.id,Math.max(0,Number(saved.components?.[item.id])||0)]))
      };
    }catch{return fallback;}
  }

  const keynlockResources=loadKeynlockResources();
  function saveKeynlockResources(){
    STORE.setJSON('keynlockResources',keynlockResources);
    renderKeynlockResources();
    window.dispatchEvent(new CustomEvent('keynlock-resources-change',{detail:{picks:keynlockResources.picks,parts:keynlockResources.parts,oil:keynlockResources.oil}}));
  }
  function resourceCaseCapacity(){return pickProgress.capacity;}
  function renderKeynlockResources(){
    const picksEl=document.querySelector('#resourcePicks');
    const partsEl=document.querySelector('#resourceParts');
    const oilEl=document.querySelector('#resourceOil');
    if(picksEl)picksEl.textContent=`${Math.min(keynlockResources.picks,resourceCaseCapacity())}/${resourceCaseCapacity()}${keynlockResources.picks>resourceCaseCapacity()?` + ${keynlockResources.picks-resourceCaseCapacity()} в запасе`:''}`;
    if(partsEl)partsEl.textContent=String(keynlockResources.parts);
    if(oilEl)oilEl.textContent=`${keynlockResources.oil}/${keynlockResources.oilerCapacity}`;
    const colors=document.querySelector('#resourceComponents');
    if(colors)colors.innerHTML=KEYNLOCK_COMPONENTS.map(item=>`<span class="resourceColor" tabindex="0" data-tip="${item.material} · ${item.name} компонент"><img class="componentIcon" src="${item.image}" alt="" draggable="false"><b>${keynlockResources.components[item.id]}</b></span>`).join('');
    const salvage=document.querySelector('#salvagePickButton');
    if(salvage)salvage.hidden=!(keynlockResources.picks===0&&keynlockResources.parts<2&&balance<30);
    const craftPick=document.querySelector('#craftPickButton');
    if(craftPick)craftPick.disabled=window.KeynlockOnboarding?.step==='buy'||keynlockResources.parts<2||keynlockResources.picks>=resourceCaseCapacity();
    const craftAll=document.querySelector('#craftAllPicksButton');
    if(craftAll)craftAll.disabled=!!window.KeynlockOnboarding?.active||keynlockResources.parts<2||keynlockResources.picks>=resourceCaseCapacity();
    const buyPick=document.querySelector('#buyPickButton');
    if(buyPick)buyPick.disabled=window.KeynlockOnboarding?.step==='craft'||balance<30||(keynlockResources.picks>=resourceCaseCapacity()&&window.KeynlockOnboarding?.step!=='buy');
    const craftOil=document.querySelector('#craftOilButton');
    if(craftOil)craftOil.disabled=keynlockResources.components.orange<1||keynlockResources.components.yellow<1||keynlockResources.oil>=keynlockResources.oilerCapacity;
    const upgrade=document.querySelector('#upgradePickCaseButton');
    if(upgrade){
      const next=Math.min(6,resourceCaseCapacity()+1);
      const price=window.KeynlockContent.economy.caseUpgradePrice;
      upgrade.hidden=resourceCaseCapacity()>=6;
      upgrade.disabled=balance<price;
      upgrade.innerHTML=`Расширить футляр до ${next} <small>${price} монет</small>`;
    }

  }

  function prepareKeynlockRound(){
    return {picks:Math.min(resourceCaseCapacity(),keynlockResources.picks)};
  }
  function consumeKeynlockPicks(count=1){
    const reserve=window.KeynlockMissions?.protectsLastPick?.()?1:0;
    const spent=Math.min(Math.max(0,keynlockResources.picks-reserve),Math.max(0,count));
    keynlockResources.picks-=spent;
    saveKeynlockResources();
    return spent;
  }
  function awardKeynlockResources({tier=1,baseCoins=0}={}){
    const level=clamp(Number(tier)||1,1,3);
    const table=KEYNLOCK_LOCK_LOOT_TABLE[level];
    const run=window.KeynlockMissions?.active;
    const claimed=STORE.getJSON('keynlockFirstClearBonuses',STORE.getJSON('lockpickMissions',{}));
    const firstClearBonus=run?window.KeynlockRewardPolicy.firstClearBonus(run.id,claimed):0;
    if(firstClearBonus){claimed[run.id]=true;STORE.setJSON('keynlockFirstClearBonuses',claimed);}
    const coins=Math.round(Math.max(0,baseCoins)*table.coinMultiplier)+firstClearBonus;
    const parts=window.KeynlockCampaign?.balance?.(mode)?2:rand(table.parts[0],table.parts[1]);
    const componentCount=rand(table.components[0],table.components[1]);
    const componentDrops={};
    keynlockResources.parts+=parts;
    for(let roll=0;roll<componentCount;roll++){
      const component=KEYNLOCK_COMPONENTS[rand(0,KEYNLOCK_COMPONENTS.length-1)];
      keynlockResources.components[component.id]++;
      componentDrops[component.id]=(componentDrops[component.id]||0)+1;
    }
    const handle=window.KeynlockCollection?.awardMissionHandle?.(run?.id,level)||null;
    saveKeynlockResources();
    return {tier:level,coins,firstClearBonus,parts,components:componentDrops,handle,table};
  }
  function awardRestoration({coins=50,componentCount=2,preferredColors=[]}={}){
    const palette=preferredColors.filter(id=>KEYNLOCK_COMPONENTS.some(item=>item.id===id));
    const pool=palette.length?palette:KEYNLOCK_COMPONENTS.map(item=>item.id);
    const componentDrops={};
    for(let roll=0;roll<Math.max(0,componentCount);roll++){
      const id=pool[rand(0,pool.length-1)];
      keynlockResources.components[id]++;
      componentDrops[id]=(componentDrops[id]||0)+1;
    }
    balance+=Math.max(0,Number(coins)||0);
    STORE.setItem('lockpickBalance',String(balance));
    saveKeynlockResources();
    updateEconomyUI();
    return {coins,components:componentDrops};
  }
  function craftKeynlockPick(){
    if(keynlockResources.parts<2||keynlockResources.picks>=resourceCaseCapacity())return false;
    keynlockResources.parts-=2;
    keynlockResources.picks++;
    saveKeynlockResources();
    renderInventoryTools();
    toast('Создана новая отмычка');
    window.dispatchEvent(new CustomEvent('keynlock-pick-acquired',{detail:{source:'craft'}}));
    return true;
  }
  function craftAllKeynlockPicks(){
    const missing=resourceCaseCapacity()-keynlockResources.picks;
    const amount=Math.min(missing,Math.floor(keynlockResources.parts/2));
    if(amount<=0)return false;
    keynlockResources.parts-=amount*2;
    keynlockResources.picks+=amount;
    saveKeynlockResources();
    renderInventoryTools();
    toast(`Создано отмычек: ${amount}`);
    return true;
  }
  function buyKeynlockPick(){
    if(balance<30||(keynlockResources.picks>=resourceCaseCapacity()&&window.KeynlockOnboarding?.step!=='buy'))return false;
    balance-=30;
    keynlockResources.picks++;
    STORE.setItem('lockpickBalance',String(balance));
    updateEconomyUI();
    saveKeynlockResources();
    renderInventoryTools();
    toast('Куплена обычная отмычка');
    window.dispatchEvent(new CustomEvent('keynlock-pick-acquired',{detail:{source:'buy'}}));
    return true;
  }
  function craftKeynlockOil(){
    if(keynlockResources.components.orange<1||keynlockResources.components.yellow<1||keynlockResources.oil>=keynlockResources.oilerCapacity)return false;
    keynlockResources.components.orange--;
    keynlockResources.components.yellow--;
    keynlockResources.oil++;
    saveKeynlockResources();
    toast('Маслёнка получила один заряд');
    return true;
  }
  function upgradeKeynlockCase(){
    const current=resourceCaseCapacity();
    const next=current>=3&&current<6?current+1:null;
    const price=next?window.KeynlockContent.economy.caseUpgradePrice:Infinity;
    if(!next||balance<price)return false;
    balance-=price;
    STORE.setItem('lockpickBalance',String(balance));
    pickProgress.capacity=next;
    STORE.setJSON('lockpickProgress',pickProgress);
    updateEconomyUI();
    saveKeynlockResources();
    renderInventoryTools();
    toast(`Футляр расширен до ${next} отмычек`);
    return true;
  }

  window.KeynlockResources={
    components:KEYNLOCK_COMPONENTS,
    lootTable:KEYNLOCK_LOCK_LOOT_TABLE,
    state:keynlockResources,
    prepareRound:prepareKeynlockRound,
    consumePicks:consumeKeynlockPicks,
    awardLock:awardKeynlockResources,
    awardRestoration,
    render:renderKeynlockResources
  };
  document.addEventListener('click',event=>{
    if(event.target.closest('#salvagePickButton')&&lairOpen&&keynlockResources.picks===0&&keynlockResources.parts<2&&balance<30){
      keynlockResources.parts=6;
      saveKeynlockResources();
      toast('Разобраны старые заготовки: 6 деталей. Нажми «Заполнить футляр», чтобы создать 3 отмычки.');
    }
    if(event.target.closest('#craftPickButton'))craftKeynlockPick();
    if(event.target.closest('#craftAllPicksButton'))craftAllKeynlockPicks();
    if(event.target.closest('#buyPickButton'))buyKeynlockPick();
    if(event.target.closest('#craftOilButton'))craftKeynlockOil();
    if(event.target.closest('#upgradePickCaseButton'))upgradeKeynlockCase();
  });
  queueMicrotask(renderKeynlockResources);
