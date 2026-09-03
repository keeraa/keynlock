  const KEYNLOCK_COMPONENTS=Object.freeze([
    {id:'red',name:'Красный',color:'#b9473f'},
    {id:'orange',name:'Оранжевый',color:'#d9853d'},
    {id:'yellow',name:'Жёлтый',color:'#d7bd4a'},
    {id:'green',name:'Зелёный',color:'#55945d'},
    {id:'cyan',name:'Голубой',color:'#59a9b8'},
    {id:'blue',name:'Синий',color:'#506fae'},
    {id:'violet',name:'Фиолетовый',color:'#875c9e'}
  ]);
  const KEYNLOCK_LOCK_LOOT_TABLE=Object.freeze({
    1:Object.freeze({coinMultiplier:1,parts:[1,2],components:[1,1],handleChance:.02}),
    2:Object.freeze({coinMultiplier:1.4,parts:[2,3],components:[1,2],handleChance:.04}),
    3:Object.freeze({coinMultiplier:2,parts:[3,5],components:[2,3],handleChance:.07})
  });

  function loadKeynlockResources(){
    const fallback={picks:3,parts:0,oil:0,oilerCapacity:3,components:Object.fromEntries(KEYNLOCK_COMPONENTS.map(item=>[item.id,0]))};
    try{
      const saved=JSON.parse(STORE.getItem('keynlockResources')||'null');
      if(!saved)return fallback;
      return {
        picks:Math.max(0,Number(saved.picks)||0),
        parts:Math.max(0,Number(saved.parts)||0),
        oil:Math.max(0,Number(saved.oil)||0),
        oilerCapacity:Math.max(1,Number(saved.oilerCapacity)||3),
        components:Object.fromEntries(KEYNLOCK_COMPONENTS.map(item=>[item.id,Math.max(0,Number(saved.components?.[item.id])||0)]))
      };
    }catch{return fallback;}
  }

  const keynlockResources=loadKeynlockResources();
  function saveKeynlockResources(){
    STORE.setItem('keynlockResources',JSON.stringify(keynlockResources));
    renderKeynlockResources();
  }
  function resourceCaseCapacity(){return pickProgress.capacity;}
  function renderKeynlockResources(){
    const picksEl=document.querySelector('#resourcePicks');
    const partsEl=document.querySelector('#resourceParts');
    const oilEl=document.querySelector('#resourceOil');
    if(picksEl)picksEl.textContent=`${keynlockResources.picks}/${resourceCaseCapacity()}`;
    if(partsEl)partsEl.textContent=String(keynlockResources.parts);
    if(oilEl)oilEl.textContent=`${keynlockResources.oil}/${keynlockResources.oilerCapacity}`;
    const picksWorkbench=document.querySelector('#resourcePicksWorkbench');
    const partsWorkbench=document.querySelector('#resourcePartsWorkbench');
    if(picksWorkbench)picksWorkbench.textContent=`${keynlockResources.picks}/${resourceCaseCapacity()}`;
    if(partsWorkbench)partsWorkbench.textContent=String(keynlockResources.parts);
    const colors=document.querySelector('#resourceComponents');
    if(colors)colors.innerHTML=KEYNLOCK_COMPONENTS.map(item=>`<span class="resourceColor" style="--resource-color:${item.color}" title="${item.name}"><i></i><b>${keynlockResources.components[item.id]}</b></span>`).join('');
    const craftPick=document.querySelector('#craftPickButton');
    if(craftPick)craftPick.disabled=keynlockResources.parts<2||keynlockResources.picks>=resourceCaseCapacity();
    const craftAll=document.querySelector('#craftAllPicksButton');
    if(craftAll)craftAll.disabled=keynlockResources.parts<2||keynlockResources.picks>=resourceCaseCapacity();
    const buyPick=document.querySelector('#buyPickButton');
    if(buyPick)buyPick.disabled=balance<30||keynlockResources.picks>=resourceCaseCapacity();
    const craftOil=document.querySelector('#craftOilButton');
    if(craftOil)craftOil.disabled=keynlockResources.components.orange<1||keynlockResources.components.yellow<1||keynlockResources.oil>=keynlockResources.oilerCapacity;
    const upgrade=document.querySelector('#upgradePickCaseButton');
    if(upgrade){
      const next=resourceCaseCapacity()===3?5:7;
      const price=resourceCaseCapacity()===3?250:600;
      upgrade.hidden=resourceCaseCapacity()>=7;
      upgrade.disabled=balance<price;
      upgrade.innerHTML=`Расширить футляр до ${next} <small>${price} монет</small>`;
    }
    const lootPreview=document.querySelector('#lootTablePreview');
    if(lootPreview&&!lootPreview.childElementCount){
      lootPreview.innerHTML=`<table><thead><tr><th>Ур.</th><th>Монеты</th><th>Детали</th><th>Цвета</th><th>Рукоять</th></tr></thead><tbody>${Object.entries(KEYNLOCK_LOCK_LOOT_TABLE).map(([level,row])=>`<tr><td>${level}</td><td>×${String(row.coinMultiplier).replace('.',',')}</td><td>${row.parts.join('–')}</td><td>${row.components.join('–')}</td><td>${Math.round(row.handleChance*100)}%</td></tr>`).join('')}</tbody></table>`;
    }
  }

  function prepareKeynlockRound(){
    let emergency=false;
    if(keynlockResources.picks<=0){
      keynlockResources.picks=1;
      emergency=true;
      saveKeynlockResources();
    }
    return {picks:Math.min(resourceCaseCapacity(),keynlockResources.picks),emergency};
  }
  function consumeKeynlockPicks(count=1){
    const spent=Math.min(keynlockResources.picks,Math.max(0,count));
    keynlockResources.picks-=spent;
    saveKeynlockResources();
    return spent;
  }
  function awardKeynlockResources({tier=1,baseCoins=0}={}){
    const level=clamp(Number(tier)||1,1,3);
    const table=KEYNLOCK_LOCK_LOOT_TABLE[level];
    const coins=Math.round(Math.max(0,baseCoins)*table.coinMultiplier);
    const parts=rand(table.parts[0],table.parts[1]);
    const componentCount=rand(table.components[0],table.components[1]);
    const componentDrops={};
    keynlockResources.parts+=parts;
    for(let roll=0;roll<componentCount;roll++){
      const component=KEYNLOCK_COMPONENTS[rand(0,KEYNLOCK_COMPONENTS.length-1)];
      keynlockResources.components[component.id]++;
      componentDrops[component.id]=(componentDrops[component.id]||0)+1;
    }
    const handle=Math.random()<table.handleChance ? window.KeynlockCollection?.unlockRandomHandle?.()||null : null;
    saveKeynlockResources();
    return {tier:level,coins,parts,components:componentDrops,handle,table};
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
    if(balance<30||keynlockResources.picks>=resourceCaseCapacity())return false;
    balance-=30;
    keynlockResources.picks++;
    STORE.setItem('lockpickBalance',String(balance));
    updateEconomyUI();
    saveKeynlockResources();
    renderInventoryTools();
    toast('Куплена обычная отмычка');
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
    const next=current===3?5:current===5?7:null;
    const price=current===3?250:current===5?600:Infinity;
    if(!next||balance<price)return false;
    balance-=price;
    STORE.setItem('lockpickBalance',String(balance));
    pickProgress.capacity=next;
    STORE.setItem('lockpickProgress',JSON.stringify(pickProgress));
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
    if(event.target.closest('#craftPickButton'))craftKeynlockPick();
    if(event.target.closest('#craftAllPicksButton'))craftAllKeynlockPicks();
    if(event.target.closest('#buyPickButton'))buyKeynlockPick();
    if(event.target.closest('#craftOilButton'))craftKeynlockOil();
    if(event.target.closest('#upgradePickCaseButton'))upgradeKeynlockCase();
  });
  queueMicrotask(renderKeynlockResources);
