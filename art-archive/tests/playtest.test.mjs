import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {createPlaytestCollector} from '../src/playtest/collector.js';
import {createPlaytestStatistics} from '../src/playtest/statistics.js';
import {handlePlaytest} from '../server/playtest.js';
function memory(){const map=new Map();return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),map};}
function fixture(t){
 const db=new DatabaseSync(':memory:');db.exec(readFileSync(new URL('../drizzle/0000_playtest.sql',import.meta.url),'utf8'));t.after(()=>db.close());
 const env={DB:{prepare(sql){return {bind(...values){return {run:()=>db.prepare(sql).run(...values)};}};},async batch(statements){db.exec('BEGIN');try{const result=statements.map(s=>s.run());db.exec('COMMIT');return result;}catch(error){db.exec('ROLLBACK');throw error;}}}};
 const request=(path,body,origin='https://archive.example')=>handlePlaytest(new Request('https://archive.example'+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)}),env);
 return {db,request};
}
test('offline events survive reload, retain the original session/build and retry without duplicates',async t=>{
 const {db,request}=fixture(t),storage=memory();let time=1000,serial=0,online=false;
 const send=async(path,options)=>{if(!online)throw Error('offline');return request(path,JSON.parse(options.body));};
 const options={storage,send,now:()=>time,uuid:()=>`random_id_${++serial}`,build:'test-build'};
 const first=createPlaytestCollector(options);first.start();first.setMode('play');time+=3000;first.track('painting_pickup',{paintingId:'ART-1278'});first.setMode('pause');time+=7000;first.track('session_checkpoint',{tutorial:'wrong'});
 await first.flush();assert.equal(db.prepare('SELECT count(*) AS n FROM playtest_events').get().n,0);
 const originalQueue=JSON.parse(storage.getItem('keynlock-art-playtest-outbox-v1'));
 online=true;const next=createPlaytestCollector({...options,build:'next-build'});await next.flush();await next.flush();
 const rows=db.prepare('SELECT * FROM playtest_events ORDER BY elapsed_ms').all();
 assert.equal(rows.length,originalQueue.events.length);assert(rows.every(r=>r.build==='test-build'&&r.session_id===first.sessionId));
 const checkpoint=rows.find(r=>r.name==='session_checkpoint');assert.equal(checkpoint.elapsed_ms,10000);assert.equal(checkpoint.active_ms,3000,'paused time is not active playtime');
 const duplicate=originalQueue.events[0];assert.equal((await request('/api/playtest/events',{sessionId:duplicate.sessionId,build:duplicate.build,events:[duplicate.event]})).status,200);
 assert.equal(db.prepare('SELECT count(*) AS n FROM playtest_events').get().n,rows.length);
});
test('opting out clears unsent metrics while a deliberately submitted survey still reaches the server',async t=>{
 const {db,request}=fixture(t),storage=memory();let serial=0,online=false;
 const collector=createPlaytestCollector({storage,uuid:()=>`random_id_${++serial}`,send:async(path,options)=>{if(!online)throw Error('offline');return request(path,JSON.parse(options.body));}});
 collector.start();await collector.flush();collector.setEnabled(false);collector.track('painting_throw',{paintingId:'ART-1278'});
 const answers={unclear:'Where to hang it',frustrating:'Movement',continuePlaying:'yes',bug:'A picture vanished'};
 assert.equal(await collector.feedback(answers),false);assert.equal(JSON.parse(storage.getItem('keynlock-art-playtest-outbox-v1')).events.length,0);
 online=true;await collector.flush();assert.equal(db.prepare('SELECT count(*) AS n FROM playtest_events').get().n,0);
 const feedback=db.prepare('SELECT * FROM playtest_feedback').all();assert.equal(feedback.length,1);assert.equal(feedback[0].unclear,answers.unclear);assert.equal(feedback[0].continue_playing,'yes');assert.equal(feedback[0].session_id,collector.sessionId);
});
test('the ingestion API rejects other origins and malformed batches atomically',async t=>{
 const {db,request}=fixture(t),event={id:'random_event_1',name:'session_start',at:new Date().toISOString(),elapsedMs:0,activeMs:0,data:{language:'ru'}},body={sessionId:'random_session_1',build:'build',events:[event]};
 assert.equal((await request('/api/playtest/events',body,'https://elsewhere.example')).status,403);
 assert.equal((await request('/api/playtest/events',{...body,events:[event,{...event,id:'random_event_2',name:'not_allowed'}]})).status,400);
 assert.equal((await request('/api/playtest/events',{...body,events:[{...event,activeMs:20}]})).status,400);
 assert.equal(db.prepare('SELECT count(*) AS n FROM playtest_events').get().n,0);
 assert.equal((await request('/api/playtest/events',body)).status,200);
 assert.equal(db.prepare('SELECT count(*) AS n FROM playtest_events').get().n,1);
});
test('a performance summary records stalls and the elapsed tutorial stage, not per-frame uploads',async()=>{
 let time=0,serial=0;const bodies=[];
 const collector=createPlaytestCollector({storage:memory(),now:()=>time,uuid:()=>`random_id_${++serial}`,send:async(_path,options)=>{const b=JSON.parse(options.body);bodies.push(b);return {ok:true,json:async()=>({accepted:b.events.map(e=>e.id)})};}});
 const statistics=createPlaytestStatistics({storage:memory(),now:()=>time});statistics.setMode('play');collector.start();collector.setMode('play');for(let i=0;i<600;i++){const ms=i%60===0?120:50;time+=ms;const sample=statistics.frame(ms);if(sample)collector.track('performance_sample',sample);}collector.track('tutorial_step',{stage:'drop',previous:'wrong',stepElapsedMs:time});await collector.flush();
 const events=bodies.flatMap(b=>b.events);assert.equal(events.filter(e=>e.name==='performance_sample').length,1);
 assert(events.find(e=>e.name==='performance_sample').data.slowFrames>0);assert.equal(events.find(e=>e.name==='tutorial_step').data.previous,'wrong');assert(events.length<10);
});
test('a blocked browser store never claims the offline survey is saved on the device',async()=>{
 let serial=0;const collector=createPlaytestCollector({storage:{getItem(){throw Error('blocked');},setItem(){throw Error('quota');}},uuid:()=>`random_id_${++serial}`,send:async()=>{throw Error('offline');}});
 collector.start();assert.equal(await collector.feedback({continuePlaying:'unsure'}),false);assert.equal(collector.pendingSaved,false);
});
