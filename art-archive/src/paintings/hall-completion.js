const DURATION=2400;
const STEADY_GLOW=.46;

export function createHallCompletion(halls,setArchGlow,setFrameFlash){
 const rooms=new Map(halls.map((hall,i)=>[hall.id,{index:i+1,complete:false,started:null,size:0}]));
 function present(id,state,arch,frames){
  setArchGlow(id,arch);setFrameFlash(state.index,frames);
 }
 function update(now){
  for(const [id,state] of rooms){
   if(state.started===null)continue;
   const t=Math.max(0,Math.min(1,(now-state.started)/DURATION));
   const pulse=Math.sin(Math.PI*t)**2;
   present(id,state,STEADY_GLOW*t*t*(3-2*t)+pulse*.85,pulse);
   if(t===1)state.started=null;
  }
 }
 function sync(page,hung,{celebrate=null,now=0,reset=false}={}){
  const expected=new Map(),placed=new Map();
  for(const slot of page){
   if(slot.painting.collection==='keynlock')continue;
   const id=slot.destination?.split('/')[0];
   if(!rooms.has(id))continue;
   expected.set(slot.painting.id,id);
  }
  for(const state of rooms.values())state.size=0;
  for(const id of expected.values())rooms.get(id).size++;
  for(const slot of hung){
   const id=expected.get(slot.painting.id);
   if(id&&id===slot.wall.hall)placed.set(id,(placed.get(id)??0)+1);
  }
  let celebrated=false;
  for(const [id,state] of rooms){
   const complete=state.size>0&&state.size===placed.get(id);
   if(!reset&&complete===state.complete)continue;
   state.complete=complete;
   const animate=!reset&&complete&&id===celebrate;
   state.started=animate?now:null;
   present(id,state,complete&&!animate?STEADY_GLOW:0,0);
   celebrated||=animate;
  }
  return celebrated;
 }
 return {sync,update,clear(){for(const [id,state] of rooms){state.started=null;state.complete=false;present(id,state,0,0);}}};
}
