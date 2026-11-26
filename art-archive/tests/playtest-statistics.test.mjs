import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlaytestStatistics,STATISTICS_KEY} from '../src/playtest/statistics.js';
function setup(){const data=new Map();let time=0,id=0;const options={storage:{getItem:key=>data.get(key),setItem:(key,value)=>data.set(key,value)},now:()=>time,uuid:()=>`playthrough_${++id}`};return {options,data,advance:ms=>time+=ms};}
test('the downloadable report counts active time, pauses, repicks, failures and progress milestones',()=>{
 const {options,advance}=setup(),stats=createPlaytestStatistics(options);stats.progress({total:4,hung:0,tutorial:'complete'});stats.setMode('play');
 advance(1000);stats.track('painting_pickup',{paintingId:'ART-0001'});stats.walk(12,true);stats.track('painting_throw',{paintingId:'ART-0001'});
 advance(1000);stats.track('painting_pickup',{paintingId:'ART-0001'});stats.track('painting_mount');stats.progress({total:4,hung:1,tutorial:'complete'});
 stats.setMode('pause');advance(4000);stats.setMode('play');advance(1000);stats.track('placement_failed',{reason:'wrong_hall'});stats.track('painting_mount');stats.progress({total:4,hung:2,tutorial:'complete'});
 advance(1000);stats.track('painting_mount');stats.progress({total:4,hung:3,tutorial:'complete'});stats.track('hall_complete',{hall:'nature'});
 advance(1000);stats.track('painting_mount');stats.progress({total:4,hung:4,tutorial:'complete',completedHalls:1});
 const report=stats.report();assert.equal(report.schemaVersion,2);assert.equal(report.activeMs,5000);assert.equal(report.pausedMs,4000);assert.equal(report.walkedM,12);assert.equal(report.carriedM,12);
 assert.equal(report.counts.pickedUp,2);assert.equal(report.counts.throwRepicks,1);assert.equal(report.counts.quickRepicks,1);assert.equal(report.counts.pauses,1);assert.equal(report.counts.wrongHall,1);
 assert.equal(report.milestones.quarter,2000);assert.equal(report.milestones.half,3000);assert.equal(report.completionMs,5000);assert.equal(report.stage,'complete');assert.equal(report.hallTimes.nature,4000);assert.equal(report.lastProgress.processed,4);
});
test('cumulative statistics survive reload and normal/free playthroughs keep separate reports',()=>{
 const {options,data,advance}=setup();const first=createPlaytestStatistics(options);first.setMode('play');advance(1000);first.track('painting_pickup');const original=first.report();
 const restored=createPlaytestStatistics(options);assert.equal(restored.report().activeMs,1000);assert.equal(restored.report().counts.pickedUp,1);assert.equal(restored.playthroughId,original.playthroughId);
 restored.setFreePlacement(true);assert.equal(restored.report().counts.pickedUp,0);assert.notEqual(restored.playthroughId,original.playthroughId);
 restored.track('painting_throw');restored.setFreePlacement(false);assert.equal(restored.report().counts.pickedUp,1);assert.equal(restored.report().counts.throws,0);assert(data.has(STATISTICS_KEY+'-free'));
});
test('a save already in progress states the starting count without inventing a full-playthrough completion time',()=>{
 const {options}=setup(),stats=createPlaytestStatistics(options);stats.progress({total:10,hung:10,tutorial:'complete'});const report=stats.report();assert.equal(report.trackedFromProcessed,10);assert.equal(report.stage,'complete');assert.equal(report.completionMs,null);assert.deepEqual(report.milestones,{});
});
