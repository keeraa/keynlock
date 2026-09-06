/* Pure campaign planning and progress. A job owns stable step IDs so adding
   puzzles does not require changing the journal or its save format. */
(() => {
  'use strict';
  function buildOrders({catalog,places,tiers=[1,2,3],first=['wharf','hillsfar','mass2','museum'],overrides={}}){
    const modes=[...new Set([...first,...places.map(p=>p.mode)])].filter(id=>places.some(p=>p.mode===id));
    const orders=[];
    for(const tier of tiers)for(const mode of modes){
      const game=catalog.get(mode);
      if(!game?.difficulty.levels.includes(tier))continue;
      const id=`${mode}-${tier}`,override=overrides[id]||{};
      orders.push({...override,id,tier,mode,steps:override.steps||[{id:'main',mode,tier}]});
    }
    return validateOrders(orders,catalog);
  }
  function validateOrders(orders,catalog){
    const ids=new Set();
    return Object.freeze(orders.map(order=>{
      if(!order.id||ids.has(order.id)||!order.steps?.length)throw new Error('Invalid campaign order');
      ids.add(order.id);
      const stepIds=new Set();
      const steps=order.steps.map(step=>{
        if(!step.id||stepIds.has(step.id)||!catalog.get(step.mode)?.difficulty.levels.includes(step.tier))throw new Error(`Invalid campaign step in ${order.id}`);
        stepIds.add(step.id);
        return Object.freeze({...step});
      });
      return Object.freeze({...order,steps:Object.freeze(steps)});
    }));
  }
  function createProgress(orders,saved={}){
    const key=(order,step)=>`${order.id}/${step.id}`;
    const valid=new Set(orders.flatMap(order=>order.steps.map(step=>key(order,step))));
    const completed=new Set((Array.isArray(saved?.completedSteps)?saved.completedSteps:[]).filter(id=>valid.has(id)));
    // v1 saved only mode IDs for the four level-one jobs.
    if(saved?.version!==2&&Array.isArray(saved?.completed)){
      for(const mode of saved.completed){
        const order=orders.find(o=>o.id===`${mode}-1`);
        if(order?.steps[0])completed.add(key(order,order.steps[0]));
      }
    }
    let replay=null;
    const done=order=>order.steps.every(step=>completed.has(key(order,step)));
    const next=()=>orders.find(order=>!done(order))||null;
    const step=order=>replay?.orderId===order.id?order.steps[replay.index]:order.steps.find(s=>!completed.has(key(order,s)))||order.steps[0];
    const allowed=order=>order===next()||done(order);
    return {
      done,next,step,allowed,
      beginReplay(order){if(done(order)&&replay?.orderId!==order.id)replay={orderId:order.id,index:0};},
      get replayOrder(){return replay?.orderId||null;},
      stepDone:(order,s)=>completed.has(key(order,s)),
      complete(orderId,stepId,mode,tier){
        const order=orders.find(o=>o.id===orderId);
        if(!order||!allowed(order))return false;
        const expected=step(order);
        if(expected.id!==stepId||expected.mode!==mode||expected.tier!==tier)return false;
        if(done(order)){
          if(replay?.orderId!==order.id)return false;
          replay.index++;if(replay.index===order.steps.length)replay=null;
          return true;
        }
        completed.add(key(order,expected));return true;
      },
      snapshot:()=>({version:2,completedSteps:[...completed]}),
      get completed(){return orders.filter(done).map(order=>order.id);}
    };
  }
  function quantity(value,forms){
    const n=Math.max(0,Math.floor(Number(value)||0)),mod=n%100;
    return `${n} ${forms[mod>=11&&mod<=14?2:n%10===1?0:n%10>=2&&n%10<=4?1:2]}`;
  }
  window.KeynlockCampaignRoute=Object.freeze({buildOrders,validateOrders,createProgress,quantity});
})();
