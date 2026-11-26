import {PLAYTEST_EVENTS,PLAYTEST_BUILD} from './schema.js';
const KEY='keynlock-art-playtest-outbox-v1',PREF='keynlock-art-playtest-enabled-v1',allowed=new Set(PLAYTEST_EVENTS);
const noop=()=>{};
export function createPlaytestCollector({storage,send=globalThis.fetch?.bind(globalThis),now=()=>performance.now(),date=()=>new Date().toISOString(),uuid=()=>crypto.randomUUID(),build=PLAYTEST_BUILD}={}){
 let enabled=true,outbox={events:[],feedback:[]},session=null,mode='intro',mark=now(),active=0,persisted=true,flushing=null;
 try{storage??=globalThis.localStorage;enabled=storage.getItem(PREF)!=='false';const saved=JSON.parse(storage.getItem(KEY));if(saved&&Array.isArray(saved.events)&&Array.isArray(saved.feedback))outbox=saved;}catch{}
 outbox.events=outbox.events.slice(-1000);outbox.feedback=outbox.feedback.slice(-10);
 const save=()=>{try{storage.setItem(KEY,JSON.stringify(outbox));persisted=true;return true;}catch{persisted=false;return false;}};
 const tally=()=>{const time=now();if(session&&mode==='play')active+=Math.max(0,time-mark);mark=time;return time;};
 function track(name,data={}){
  if(!enabled||!session||session.ended||!allowed.has(name))return;
  const time=tally(),safe={};
  for(const [key,value]of Object.entries(data).slice(0,16)){
   if(!/^[a-zA-Z][a-zA-Z0-9_]{0,35}$/.test(key))continue;
   if(typeof value==='string')safe[key]=value.slice(0,300);
   else if(typeof value==='boolean'||(typeof value==='number'&&Number.isFinite(value)))safe[key]=value;
  }
  outbox.events.push({sessionId:session.id,build,event:{id:uuid(),name,at:date(),elapsedMs:Math.min(604800000,Math.max(0,Math.round(time-session.start))),activeMs:Math.min(604800000,Math.max(0,Math.round(active))),data:safe}});
  outbox.events=outbox.events.slice(-1000);save();
 }
 async function post(path,body){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),6000);
  try{return await send(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),keepalive:true,signal:controller.signal});}finally{clearTimeout(timer);}
 }
 async function drain(){
  if(!send)return false;
  // Bounded work per flush, so offline retries never block gameplay.
  for(let n=0;n<5;n++){
   const first=enabled&&outbox.events[0];if(!first)break;
   const events=[];
   for(const entry of outbox.events){
    if(entry.sessionId!==first.sessionId||entry.build!==first.build)continue;
    if(events.length>=25||JSON.stringify([...events,entry.event]).length>48000)break;
    events.push(entry.event);
   }
   if(!events.length)break;
   try{
    const response=await post('/api/playtest/events',{sessionId:first.sessionId,build:first.build,events});
    if(!response.ok)break;
    const answer=await response.json(),ids=new Set(Array.isArray(answer.accepted)?answer.accepted:[]);
    if(!events.some(e=>ids.has(e.id)))break;
    outbox.events=outbox.events.filter(e=>!ids.has(e.event.id));save();
   }catch{break;}
  }
  for(const item of [...outbox.feedback]){
   try{
    const response=await post('/api/playtest/feedback',item);
    if(response.ok&&(await response.json()).accepted===true){outbox.feedback=outbox.feedback.filter(f=>f.id!==item.id);save();}
    else break;
   }catch{break;}
  }
  return !outbox.events.length&&!outbox.feedback.length;
 }
 function flush(){if(!flushing)flushing=drain().finally(()=>{flushing=null;});return flushing;}
 function start(data={}){
  if(session&&!session.ended)return false;
  session={id:uuid(),start:now(),ended:false};active=0;mark=now();
  track('session_start',data);void flush();return true;
 }
 function end(reason='feedback'){if(!session||session.ended)return;track('session_end',{reason});session.ended=true;void flush();}
 return {
  track,start,end,flush,
  get pendingSaved(){return persisted;},get enabled(){return enabled;},get sessionId(){return session?.id??null;},
  setEnabled(value){enabled=Boolean(value);try{storage.setItem(PREF,String(enabled));}catch{}if(!enabled){outbox.events=[];save();}else if(session&&!session.ended)track('session_start',{reason:'collection_enabled'});},
  setMode(next){tally();mode=next;track('mode_change',{mode:next});},
  checkpoint(data={}){track('session_checkpoint',data);void flush();},
  async feedback(answers){
   if(!session)start();
   const existing=outbox.feedback.find(f=>f.sessionId===session.id),item={id:existing?.id??uuid(),sessionId:session.id,build,unclear:String(answers.unclear??'').slice(0,2000),frustrating:String(answers.frustrating??'').slice(0,2000),bug:String(answers.bug??'').slice(0,3000),continuePlaying:answers.continuePlaying,elapsedMs:Math.min(604800000,Math.max(0,Math.round(now()-session.start)))};
   outbox.feedback=outbox.feedback.filter(f=>f.id!==item.id);outbox.feedback.push(item);outbox.feedback=outbox.feedback.slice(-10);save();end();await flush();return !outbox.feedback.some(f=>f.id===item.id);
  },
  unload(beacon=noop){
   end('pagehide');const first=enabled&&outbox.events[0];if(!first)return;
   const events=outbox.events.filter(e=>e.sessionId===first.sessionId&&e.build===first.build).slice(0,15).map(e=>e.event);
   const body=JSON.stringify({sessionId:first.sessionId,build:first.build,events});
   if(body.length<60000)try{beacon('/api/playtest/events',new Blob([body],{type:'application/json'}));}catch{}
  },
 };
}
