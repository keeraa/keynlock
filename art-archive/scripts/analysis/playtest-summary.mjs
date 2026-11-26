import {createHash} from 'node:crypto';
const number=value=>Number.isFinite(value)&&value>=0?value:0;
const add=(map,key,amount=1)=>{Object.defineProperty(map,key,{value:(Object.hasOwn(map,key)?map[key]:0)+amount,enumerable:true,writable:true,configurable:true});};
const median=values=>{if(!values.length)return null;const a=[...values].sort((x,y)=>x-y),i=Math.floor(a.length/2);return a.length%2?a[i]:(a[i-1]+a[i])/2;};
const sum=(items,key)=>items.reduce((total,item)=>total+number(item[key]),0);
function performance(samples){
 const valid=samples.filter(s=>Number.isFinite(s.fps)&&s.fps>0);
 return {samples:valid.length,medianFps:median(valid.map(s=>s.fps)),medianSampleP95Ms:median(valid.map(s=>number(s.p95Ms))),slowFrames:sum(valid,'slowFrames'),sampledFrames:sum(valid,'frames')};
}
export function summarizePlaytests(documents,{includeQA=false}={}){
 const events=new Map(),feedback=new Map(),reports=new Map();let unidentifiedReports=0;
 function ingest(value){
  if(Array.isArray(value)){value.forEach(ingest);return;}
  if(!value||typeof value!=='object')throw Error('Expected a JSON report or exported table rows');
  if(value.game==='art-archive'&&value.schemaVersion===2){
   const id=value.playthroughId??createHash('sha256').update(JSON.stringify(value)).digest('hex');
   if(!value.playthroughId)unidentifiedReports++;
   const key=id+'/'+(value.modes?.placement??'unknown'),previous=reports.get(key);
   if(!previous||number(value.activeMs)>=number(previous.activeMs))reports.set(key,value);
  }else if(value.session_id&&value.name){
   if(typeof value.id!=='string'||!value.id)throw Error('Event row has no stable ID');
   const data=typeof value.payload==='string'?JSON.parse(value.payload):value.payload??{};
   events.set((value.build??'unknown')+'/'+value.id,{...value,build:value.build??'unknown',data});
  }else if(value.session_id&&value.continue_playing){feedback.set((value.build??'unknown')+'/'+value.id,value);}
  else if(['events','feedback','reports','rows','results'].some(key=>Array.isArray(value[key]))){for(const key of ['events','feedback','reports','rows','results'])if(Array.isArray(value[key]))ingest(value[key]);}
  else throw Error('Unsupported report format; use schemaVersion 2 statistics or playtest_events/playtest_feedback rows');
 }
 documents.forEach(ingest);
 const qa=new Set();
 for(const e of events.values())if(e.name==='session_start'&&e.data.test===true)qa.add(e.session_id);
 for(const f of feedback.values())if([f.unclear,f.frustrating,f.bug].some(v=>typeof v==='string'&&v.startsWith('[QA]')))qa.add(f.session_id);
 const sessions=new Map();let excludedEvents=0;
 for(const e of events.values()){
  if(!includeQA&&qa.has(e.session_id)){excludedEvents++;continue;}
  const key=e.session_id+'/'+e.build;
  if(!sessions.has(key))sessions.set(key,{build:e.build,activeMs:0,elapsedMs:0,events:[],started:false});
  const session=sessions.get(key);session.activeMs=Math.max(session.activeMs,number(e.active_ms));session.elapsedMs=Math.max(session.elapsedMs,number(e.elapsed_ms));session.events.push(e);session.started ||= e.name==='session_start';
 }
 const failures={},errors={},modeSelections={},observedTutorialStages={},lastTutorialStages={},builds=Object.create(null),samples=[],stepDurations={};
 let mounts=0,missing=0,recovered=0,tutorialSessions=0;
 for(const session of sessions.values()){
  const stages=new Set();let last=null;
  session.events.sort((a,b)=>number(a.elapsed_ms)-number(b.elapsed_ms));
  const build=builds[session.build]??={sessions:0,activeMs:0,mounts:0,failures:0,technicalErrors:0};build.sessions++;build.activeMs+=session.activeMs;
  for(const e of session.events){
   if(e.name==='painting_mount'){mounts++;build.mounts++;}
   if(e.name==='placement_failed'){add(failures,e.data.reason??'unknown');build.failures++;}
   if(e.name==='technical_error'){add(errors,e.data.kind??'unknown');build.technicalErrors++;}
   if(e.name==='painting_missing')missing+=number(e.data.count);
   if(e.name==='painting_recovered')recovered++;
   if(e.name==='performance_sample')samples.push(e.data);
   if(e.name==='mode_selected')add(modeSelections,(e.data.placement??'unknown')+'_'+(e.data.difficulty??'unknown')+'/'+(e.data.source??'unknown'));
   if(e.name==='tutorial_step'&&typeof e.data.stage==='string'){stages.add(e.data.stage);last=e.data.stage;if(e.data.previous&&Number.isFinite(e.data.stepElapsedMs)){const key=e.data.previous;if(!Object.hasOwn(stepDurations,key))Object.defineProperty(stepDurations,key,{value:[],enumerable:true});stepDurations[key].push(e.data.stepElapsedMs);}}
  }
  if(stages.size){tutorialSessions++;for(const stage of stages)add(observedTutorialStages,stage);add(lastTutorialStages,last);}
 }
 const local=[...reports.values()],localFailures={},localCounts={},localModes={},localSamples=[];
 for(const r of local){for(const [key,value]of Object.entries(r.failures??{}))add(localFailures,key,number(value));for(const [key,value]of Object.entries(r.counts??{}))add(localCounts,key,number(value));for(const [key,value]of Object.entries(r.modeActiveMs??{}))add(localModes,key,number(value));localSamples.push(...(r.performance??[]));}
 const answers={yes:0,no:0,unsure:0};let feedbackCount=0,excludedFeedback=0;
 for(const f of feedback.values()){if(!includeQA&&qa.has(f.session_id)){excludedFeedback++;continue;}feedbackCount++;add(answers,f.continue_playing);}
 return {schemaVersion:1,includeQA,server:{sessions:sessions.size,sessionsWithoutStart:[...sessions.values()].filter(s=>!s.started).length,totalActiveMs:[...sessions.values()].reduce((a,s)=>a+s.activeMs,0),medianActiveMs:median([...sessions.values()].map(s=>s.activeMs)),mounts,failures,technicalErrors:errors,missingPictures:missing,recoveries:recovered,modeSelections,tutorial:{sessionsWithObservedSteps:tutorialSessions,observedStages:observedTutorialStages,lastObservedStages:lastTutorialStages,stepTimes:Object.fromEntries(Object.entries(stepDurations).map(([stage,times])=>[stage,{samples:times.length,medianMs:median(times)}]))},performance:performance(samples),builds},local:{reports:local.length,unidentifiedReports,totalActiveMs:sum(local,'activeMs'),medianActiveMs:median(local.map(r=>number(r.activeMs))),failures:localFailures,counts:localCounts,modeActiveMs:localModes,performance:performance(localSamples),builds:[...new Set(local.map(r=>r.build??'unknown'))]},feedback:{count:feedbackCount,continuePlaying:answers},excluded:{qaSessions:includeQA?0:qa.size,events:excludedEvents,feedback:excludedFeedback}};
}
export function renderPlaytestSummary(report){
 const minutes=ms=>ms===null?'нет данных':(ms/60000).toFixed(1)+' мин';
 const table=map=>Object.entries(map).sort((a,b)=>b[1]-a[1]).map(([k,v])=>'| '+String(k).replaceAll('|','\\|').replaceAll('\n',' ')+' | '+v+' |').join('\n')||'| Нет данных | — |';
 const s=report.server,l=report.local;
 return `# Сводка плейтестов архива картин

Сессии и локальные прохождения показаны отдельно: их суммы нельзя складывать — они могут описывать одну игру. Это не число уникальных людей.

## Серверные события

Сессий: **${s.sessions}**. Медиана активного времени: **${minutes(s.medianActiveMs)}**. Установок: **${s.mounts}**. Пропавших картин по событиям: **${s.missingPictures}**.
Сессий без начала в выгрузке: ${s.sessionsWithoutStart}; время берётся по последней контрольной точке, наличие session_end не требуется.

### Причины неудачной установки

| Причина | Событий |
|---|---:|
${table(s.failures)}

### Наблюдавшиеся этапы обучения

Этапы считаются только по полученным событиям. Возобновлённому прохождению не приписываются пропущенные этапы.

| Этап | Сессий |
|---|---:|
${table(s.tutorial.observedStages)}

### Выбор режимов

Ключ включает сочетание режимов и источник выбора; старт и изменения различаются.

| Режим / источник | Выборов |
|---|---:|
${table(s.modeSelections)}

### Производительность и ошибки

Медиана FPS по замерам: ${s.performance.medianFps??'нет данных'}. Медиана p95 отдельных замеров: ${s.performance.medianSampleP95Ms??'нет данных'} мс. Это не общий p95 всех кадров.

| Тип ошибки | Событий |
|---|---:|
${table(s.technicalErrors)}

## Локальные отчёты

Прохождений: **${l.reports}**. Медиана активного времени: **${minutes(l.medianActiveMs)}**. Повторные выгрузки одного прохождения заменены самой продолжительной.
Отчётов без ID во входных файлах: ${l.unidentifiedReports}; разные выгрузки без ID автоматически связать нельзя.

| Причина неудачи | Событий |
|---|---:|
${table(l.failures)}

## Отзывы

Всего: **${report.feedback.count}**. Хотят продолжать: ${report.feedback.continuePlaying.yes}; не хотят: ${report.feedback.continuePlaying.no}; не уверены: ${report.feedback.continuePlaying.unsure}.

Исключено проверочных сессий: ${report.excluded.qaSessions}. Локальный JSON не содержит достоверного признака QA — передавайте в анализ только отчёты игроков.

Подробности по сборкам, режимам и счётчикам — в JSON рядом с этим отчётом.
`;
}
