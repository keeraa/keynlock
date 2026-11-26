import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizePlaytests,renderPlaytestSummary} from '../scripts/playtest-report.mjs';
const event=(id,session_id,name,data={},active_ms=0,build='build-a')=>({id,session_id,name,payload:JSON.stringify(data),active_ms,elapsed_ms:active_ms+1000,build});
test('summary deduplicates deliveries, removes QA regardless of row order and counts checkpoint time without session_end',()=>{
 const checkpoint=event('checkpoint','player','session_checkpoint',{},12000);
 const result=summarizePlaytests([{events:[event('qa-mount','qa','painting_mount'),checkpoint,event('mount','player','painting_mount'),checkpoint,event('qa-start','qa','session_start',{test:true}),event('start','player','session_start'),event('failure','player','placement_failed',{reason:'collision'})],feedback:[{id:'feedback',session_id:'player',build:'build-a',continue_playing:'yes'}]}]);
 assert.equal(result.server.sessions,1);assert.equal(result.server.totalActiveMs,12000);assert.equal(result.server.mounts,1);assert.equal(result.server.failures.collision,1);assert.equal(result.excluded.events,2);assert.equal(result.feedback.continuePlaying.yes,1);
});
test('resumed tutorial records only observed stages and separates modes, builds and performance samples',()=>{
 const events=[event('1','resume','session_start'),event('2','resume','tutorial_step',{stage:'second',previous:'first',stepElapsedMs:5000},2000),event('3','resume','mode_selected',{placement:'free',difficulty:'hard',source:'change'}),event('4','resume','performance_sample',{fps:60,p95Ms:22,frames:1800,slowFrames:3}),event('5','other','session_checkpoint',{},9000,'build-b')];
 const report=summarizePlaytests([events]);assert.deepEqual(report.server.tutorial.observedStages,{second:1});assert.equal(report.server.tutorial.stepTimes.first.medianMs,5000);assert.equal(report.server.sessionsWithoutStart,1);assert.equal(report.server.modeSelections['free_hard/change'],1);assert.equal(report.server.builds['build-b'].sessions,1);assert.equal(report.server.performance.medianFps,60);
});
test('repeated local exports keep the longest snapshot and remain separate from server sessions',()=>{
 const base={game:'art-archive',schemaVersion:2,playthroughId:'run',build:'build-a',modes:{placement:'blocks'},activeMs:1000,counts:{placed:1},failures:{collision:1}};
 const report=summarizePlaytests([base,{...base,activeMs:4000,counts:{placed:3}},[event('1','session','session_checkpoint',{},4000)]]);
 assert.equal(report.local.reports,1);assert.equal(report.local.counts.placed,3);assert.equal(report.local.totalActiveMs,4000);assert.equal(report.server.totalActiveMs,4000);
 assert.match(renderPlaytestSummary(report),/нельзя складывать/);
});
test('QA can be explicitly included and unrecognized input fails instead of producing a misleading empty report',()=>{
 const rows=[event('1','qa','session_start',{test:true}),event('2','qa','painting_mount')];
 assert.equal(summarizePlaytests([rows],{includeQA:true}).server.mounts,1);
 assert.throws(()=>summarizePlaytests([{unknown:'format'}]),/Unsupported report format/);
});
