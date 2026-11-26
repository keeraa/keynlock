import {PLAYTEST_EVENTS} from '../src/playtest/schema.js';
const names=new Set(PLAYTEST_EVENTS),idPattern=/^[a-zA-Z0-9_-]{8,80}$/;
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
const validId=id=>typeof id==='string'&&idPattern.test(id);
const text=(value,max)=>typeof value==='string'&&value.length<=max&&!value.includes('\u0000');
const integer=(value,max=604800000)=>Number.isInteger(value)&&value>=0&&value<=max;
function payload(value){
 if(!value||Array.isArray(value)||typeof value!=='object')return false;
 const entries=Object.entries(value);
 return entries.length<=16&&entries.every(([k,v])=>/^[a-zA-Z][a-zA-Z0-9_]{0,35}$/.test(k)&&
  (typeof v==='boolean'||(typeof v==='number'&&Number.isFinite(v))||(typeof v==='string'&&v.length<=300)));
}
export async function handlePlaytest(request,env){
 if(request.method!=='POST')return json({error:'Method not allowed'},405);
 const url=new URL(request.url);
 if(request.headers.get('Origin')!==url.origin)return json({error:'Origin not allowed'},403);
 if(!request.headers.get('Content-Type')?.startsWith('application/json'))return json({error:'JSON required'},415);
 if(Number(request.headers.get('Content-Length')||0)>64000)return json({error:'Too large'},413);
 let body;
 try{
  const reader=request.body?.getReader();if(!reader)return json({error:'Empty request'},400);
  const decoder=new TextDecoder();let raw='',size=0;
  while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>64000){await reader.cancel();return json({error:'Too large'},413);}raw+=decoder.decode(value,{stream:true});}
  raw+=decoder.decode();body=JSON.parse(raw);
 }catch{return json({error:'Invalid JSON'},400);}
 if(!body||typeof body!=='object'||Array.isArray(body))return json({error:'Invalid payload'},400);
 if(!env.DB)return json({error:'Collection unavailable'},503);
 if(!validId(body.sessionId)||!text(body.build,80))return json({error:'Invalid session'},400);
 if(url.pathname==='/api/playtest/events'){
  if(!Array.isArray(body.events)||!body.events.length||body.events.length>50)return json({error:'Invalid batch'},400);
  if(!body.events.every(e=>validId(e.id)&&names.has(e.name)&&text(e.at,40)&&Number.isFinite(Date.parse(e.at))&&integer(e.elapsedMs)&&integer(e.activeMs)&&e.activeMs<=e.elapsedMs&&payload(e.data)))return json({error:'Invalid event'},400);
  try{
   await env.DB.batch(body.events.map(e=>env.DB.prepare('INSERT OR IGNORE INTO playtest_events (id,session_id,build,name,occurred_at,elapsed_ms,active_ms,payload) VALUES (?,?,?,?,?,?,?,?)').bind(e.id,body.sessionId,body.build,e.name,e.at,e.elapsedMs,e.activeMs,JSON.stringify(e.data))));
   return json({accepted:body.events.map(e=>e.id)});
  }catch{return json({error:'Try again later'},503);}
 }
 if(url.pathname==='/api/playtest/feedback'){
  if(!validId(body.id)||!text(body.unclear,2000)||!text(body.frustrating,2000)||!text(body.bug,3000)||!['yes','no','unsure'].includes(body.continuePlaying)||!integer(body.elapsedMs))return json({error:'Invalid feedback'},400);
  try{
   await env.DB.prepare('INSERT OR IGNORE INTO playtest_feedback (id,session_id,build,unclear,frustrating,continue_playing,bug,elapsed_ms) VALUES (?,?,?,?,?,?,?,?)').bind(body.id,body.sessionId,body.build,body.unclear,body.frustrating,body.continuePlaying,body.bug,body.elapsedMs).run();
   return json({accepted:true});
  }catch{return json({error:'Try again later'},503);}
 }
 return json({error:'Not found'},404);
}
