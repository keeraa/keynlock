import {STORAGE_KEYS} from '../persistence/storage.js';
import {PLAYTEST_BUILD} from './schema.js';
export const STATISTICS_KEY=STORAGE_KEYS.statistics;
const modeTotals=()=>({blocks_normal:0,blocks_hard:0,free_normal:0,free_hard:0});
const defaults=()=>({schemaVersion:2,game:'art-archive',build:PLAYTEST_BUILD,activeMs:0,pausedMs:0,trackedFromProcessed:null,stage:'wrong',modes:{placement:'blocks',difficulty:'normal'},modeSelections:modeTotals(),modeActiveMs:modeTotals(),lastProgress:null,counts:{pickedUp:0,throws:0,placed:0,takenFromWall:0,wrongHall:0,noSpace:0,collisions:0,throwRepicks:0,quickRepicks:0,pauses:0,excluded:0,inspected:0,disposed:0,recovered:0,missingPictures:0},failures:{},milestones:{},completionMs:null,walkedM:0,carriedM:0,placementTimes:[],hallTimes:{},performance:[],errors:[],_recentThrows:{},_lastPlaceMs:null});
export function createPlaytestStatistics({storage,now=()=>performance.now(),free=false,debug=false,uuid=()=>crypto.randomUUID()}={}){
 try{storage??=globalThis.localStorage;}catch{}
 let key,stats,mode='intro',last=now(),lastSave=last,lastPlace=null,lastThrow=new Map(),frames=[],frameMs=0;
 function select(isFree){
  save();key=STATISTICS_KEY+(isFree?'-free':'')+(debug?'-debug':'');
  const initial=defaults();let stored;
  try{stored=JSON.parse(storage.getItem(key));}catch{}
  stats=stored?.schemaVersion===2&&stored.game==='art-archive'?{...initial,...stored,counts:{...initial.counts,...stored.counts},modeSelections:{...initial.modeSelections,...stored.modeSelections},modeActiveMs:{...initial.modeActiveMs,...stored.modeActiveMs},failures:{...stored.failures},milestones:{...stored.milestones},hallTimes:{...stored.hallTimes},placementTimes:Array.isArray(stored.placementTimes)?stored.placementTimes.slice(-1000):[],performance:Array.isArray(stored.performance)?stored.performance.slice(-120):[],errors:Array.isArray(stored.errors)?stored.errors.slice(-20):[]}:initial;
  stats.playthroughId??=uuid();stats.build=PLAYTEST_BUILD;stats.modes.placement=isFree?'free':'blocks';
  for(const key of ['activeMs','pausedMs','walkedM','carriedM'])if(!Number.isFinite(stats[key])||stats[key]<0)stats[key]=0;last=now();lastPlace=Number.isFinite(stats._lastPlaceMs)?stats._lastPlaceMs:null;lastThrow=new Map(Object.entries(stats._recentThrows??{}).filter(([,value])=>Number.isFinite(value)).slice(-1000));frames=[];frameMs=0;
 }
 function tally(){const at=now(),delta=Math.max(0,at-last);if(stats){if(mode==='play'){stats.activeMs+=delta;const modeKey=stats.modes.placement+'_'+stats.modes.difficulty;stats.modeActiveMs[modeKey]=(stats.modeActiveMs[modeKey]??0)+delta;}else if(mode==='pause'||mode==='plan')stats.pausedMs+=delta;}last=at;}
 function save(){if(!stats)return;tally();stats._recentThrows=Object.fromEntries(lastThrow);stats._lastPlaceMs=lastPlace;try{storage.setItem(key,JSON.stringify(stats));}catch{}lastSave=now();}
 function milestone(name){stats.milestones[name]??=Math.round(stats.activeMs);}
 function track(name,data={}){
  tally();const c=stats.counts;
  if(name==='mode_selected'){stats.modes={placement:data.placement,difficulty:data.difficulty};const modeKey=data.placement+'_'+data.difficulty;stats.modeSelections[modeKey]=(stats.modeSelections[modeKey]??0)+1;}
  if(name==='painting_pickup'||name==='painting_unmount'){
   c.pickedUp++;milestone('firstPickup');if(name==='painting_unmount')c.takenFromWall++;
   const thrown=lastThrow.get(data.paintingId);if(thrown!==undefined){c.throwRepicks++;if(stats.activeMs-thrown<=5000)c.quickRepicks++;lastThrow.delete(data.paintingId);}
  }
  if(name==='painting_throw'){c.throws++;lastThrow.set(data.paintingId,stats.activeMs);}
  if(name==='painting_mount'){c.placed++;milestone('firstPlace');if(lastPlace!==null)stats.placementTimes.push(Math.round(stats.activeMs-lastPlace));lastPlace=stats.activeMs;stats.placementTimes=stats.placementTimes.slice(-1000);}
  if(name==='placement_failed'){
   const reason=data.reason??'unknown';stats.failures[reason]=(stats.failures[reason]??0)+1;
   if(reason==='wrong_hall')c.wrongHall++;
   if(reason==='occupied_or_too_large')c.noSpace++;
   if(['collision','pickup_blocked'].includes(reason))c.collisions++;
  }
  if(name==='painting_excluded')c.excluded++;
  if(name==='painting_inspect')c.inspected++;
  if(name==='painting_disposed')c.disposed+=data.count??0;
  if(name==='painting_recovered')c.recovered++;
  if(name==='painting_missing')c.missingPictures+=data.count??0;
  if(name==='hall_complete'){milestone('firstHall');stats.hallTimes[data.hall]??=Math.round(stats.activeMs);}
  if(name==='technical_error'){stats.errors.push({...data,activeMs:Math.round(stats.activeMs)});stats.errors=stats.errors.slice(-20);}
  if(name==='tutorial_step')stats.stage=data.stage==='complete'?'hanging':data.stage;
  save();
 }
 function progress(value){
  tally();if(!value||!Number.isFinite(value.total)||value.total<=0)return;
  const processed=Math.min(value.total,Math.max(0,(value.hung??0)+(value.disposed??0))),previous=stats.lastProgress;
  stats.lastProgress={processed,total:value.total,placed:value.hung??0,disposed:value.disposed??0,completedHalls:value.completedHalls??0,catalogSelected:value.catalogSelected??value.total};
  if(stats.trackedFromProcessed===null)stats.trackedFromProcessed=processed;
  if(previous){for(const [name,fraction]of [['quarter',.25],['half',.5],['threeQuarters',.75],['complete',1]])if(previous.processed/previous.total<fraction&&processed/value.total>=fraction)milestone(name);}
  if(stats.milestones.complete!==undefined)stats.completionMs=stats.milestones.complete;
  stats.stage=processed>=value.total?'complete':value.tutorial&&value.tutorial!=='complete'?value.tutorial:'hanging';
  if(now()-lastSave>5000)save();
 }
 select(free);
 return {
  track,progress,save,setModes(value){tally();stats.modes={placement:value.placement,difficulty:value.difficulty};save();},get playthroughId(){return stats.playthroughId;},get activeMs(){tally();return Math.round(stats.activeMs);},
  setFreePlacement(value){select(Boolean(value));},
  setMode(next){tally();if(next==='pause'&&mode==='play')stats.counts.pauses++;mode=next;save();},
  walk(distance,carrying=false){if(mode!=='play'||!Number.isFinite(distance)||distance<0)return;stats.walkedM+=distance;if(carrying)stats.carriedM+=distance;if(now()-lastSave>5000)save();},
  frame(ms){
   if(mode!=='play'||!Number.isFinite(ms)||ms<=0||ms>10000)return null;
   frames.push(ms);frameMs+=ms;if(frameMs<30000)return null;
   const sorted=[...frames].sort((a,b)=>a-b),sample={fps:Math.round(1000*frames.length/frameMs),p95Ms:Math.round(sorted[Math.floor(sorted.length*.95)]),slowFrames:frames.filter(v=>v>50).length,frames:frames.length};
   tally();stats.performance.push({...sample,activeMs:Math.round(stats.activeMs)});stats.performance=stats.performance.slice(-120);frames=[];frameMs=0;save();return sample;
  },
  report(){save();const {_recentThrows,_lastPlaceMs,...report}=stats;return JSON.parse(JSON.stringify({...report,activeMs:Math.round(stats.activeMs),pausedMs:Math.round(stats.pausedMs),walkedM:Math.round(stats.walkedM*10)/10,carriedM:Math.round(stats.carriedM*10)/10}));},
 };
}
