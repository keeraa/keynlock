import {createWallPlacement} from './wall-placement.js';
import {showPaintingControls} from '../ui/painting-controls.js';
import {createWallCompositions} from './wall-compositions.js';
import {createHallCompletion} from './hall-completion.js';
import {createDisposalStation} from './disposal-station.js';
import {createPlacementSave} from './placement-save.js';
import {createPaintingInteraction} from './interaction-state.js';
import {frameDimensions,mountedFrame} from '../../catalog/painting-geometry.js';
import {acceptsHall,adjacentPosition,aimedFrameAtRay, floorSlots, placedSlot, wallAtRay} from './hanging.js';
import {createPlacementFeedback} from './placement-feedback.js';
import {createFrameMotion} from './frame-motion.js';
import {findDrop,throwTargets,aimedSupport,settleFloor,settleTrolley,covered} from './floor-drop.js';
import {createPlacementPreview} from './placement-preview.js';
import {createTablePreview} from './table-preview.js';
import {getLanguage,t,paintingTitle} from '../localization/i18n.js';
import {createPaintingMotionAudio,createFrameFitAudio,heaviestPaintingIds} from '../audio/painting-motion-audio.js';

const text=(ru,en)=>getLanguage()==='en'?en:ru;
export function createHangingSession({debugSelection=false,THREE,world,config,display,renderer,label,showLabel=value=>{label.textContent=value?.painting?.title??value??'';},controls=null,notify=()=>{},playSound=()=>{},setSoundMotion=()=>{},onMount=()=>{},onThrow=()=>{},getCarryYaw=()=>null,disposalTotal,onDisposed=()=>{},onEvent=()=>{}}) {
  const settings=config.paintings,layout=world.layout;
  const motion=createFrameMotion(THREE,config,layout);
  const wallPlacement=createWallPlacement(config,motion,{isFree:()=>freePlacement,occupied:()=>hung});
  const wallSettings=wallPlacement.limits;
  const compositions=createWallCompositions(THREE,world,config);
  const completion=createHallCompletion(layout.halls,(id,value)=>world.building?.setHallGlow?.(id,value),
    (index,value)=>display.gouache?.setFrameFlash?.(index,value));
  const interaction=createPaintingInteraction();
  const usesTrolley=slot=>Math.max(slot.height,slot.painting.physicalSizeM.width)>=settings.hoistFromM;
  const motionAudio=createPaintingMotionAudio(setSoundMotion);
  const fitAudio=createFrameFitAudio(playSound);
  let wallPreviewArmed=true;
  let aimedPlace=null,freePlacement=false,placementFailure='no_wall',lastIntegrity=-Infinity,lastMissing='';
  let heavyIds=new Set();
  let cursor=null,coveredPick=false;
  const clamp=(x,min,max)=>max>=min?Math.max(min,Math.min(max,x)):(min+max)/2;
  const placements=createPlacementSave({debug:debugSelection,layout,config,wallSettings,
    onError:()=>notify(text('Не удалось сохранить положение','Could not save placement'))});
  const origin=new THREE.Vector3(),dir=new THREE.Vector3();
  const feedback=createPlacementFeedback(THREE,world.scene,config,world.camera,renderer);
  const preview=createPlacementPreview(THREE,{...world,carryYaw:getCarryYaw},display,config,motion);
  let storedPage=[],active=false,page=[],hung=[],floor=[],target=null,picked=null,room='center',hall=null,pausedAt=null;
  const disposal=createDisposalStation({THREE,world,config,display,debug:debugSelection,notify,playSound,total:disposalTotal,onDisposed(ids){
    for(const slot of [...visible])if(ids.includes(slot.painting.id))changeSlot(slot,false);
    onDisposed(ids);
  }});
  let visible=[];
  const tablePreview=createTablePreview(THREE,layout,config,motion);
  const floorByRoom = new Map(), emptyRoom = [];
  function rebuild() {
    tablePreview.reset();
    if(interaction.carrying)interaction.carry();
    preview.select(interaction.carrying??interaction.landing?.slot??null);
    preview.hide();preview.resetHover();cursor=null;target=null;picked=null;
    floorByRoom.clear();
    if(!active){
      const exhibited=page.filter(s=>!disposal.has(s.painting.id)),restored=[];
      for(const slot of exhibited){
        const installed=placements.restoreWall(slot,restored);
        if(installed)restored.push(installed);
      }
      completion.sync(exhibited,restored,{reset:true});
      compositions.clear();display.setSlots(exhibited);return;
    }
    hung=[];floor=[];
    const hidden=(interaction.carrying??interaction.landing?.slot)?.painting.id,restored=[];
    for(const slot of [...floorSlots(page,layout,config),...storedPage]){
      const id=slot.painting.id;
      if(id===hidden || disposal.has(id))continue;
      const portable=placements.restorePortable(slot);
      if(portable?.trolley){floor.push(portable);continue;}
      const installed=placements.restoreWall(slot,hung);
      if(installed)hung.push(installed);
      else if(portable)restored.push(portable);
      else floor.push(slot);
    }
    // Player-placed paintings rest on the existing piles, in saved bottom-to-top order.
    floor=[...settleFloor(floor.filter(s=>!s.trolley),layout,config,restored),...floor.filter(s=>s.trolley)];
    for (const slot of floor) {
      const id = slot.floorRoom ?? slot.wall.hall;
      if (!floorByRoom.has(id)) floorByRoom.set(id,[]);
      floorByRoom.get(id).push(slot);
    }
    visible=[...hung,...floor];
    compositions.rebuild(freePlacement?[]:page,slot=>slot.wall?.id?placements.physicalWall(slot.wall):null);compositions.refresh(hung);
    if(freePlacement)completion.clear();else completion.sync(page,hung,{reset:true});
    motion.setObstacles(visible);display.setSlots(visible,true);
  }
  function changeSlot(slot,add,celebrate=false){
    tablePreview.reset();
    const id=slot.floorRoom??slot.wall.hall;
    let completedHall=false;
    if(mountedFrame(slot)){
      hung=add?[...hung,slot]:hung.filter(s=>s!==slot);
      compositions.refresh(hung);
      if(!freePlacement)completedHall=completion.sync(page,hung,celebrate?{celebrate:id,now:performance.now()}:undefined);
    }
    else {
      floor=add?[...floor,slot]:floor.filter(s=>s!==slot);
      floorByRoom.set(id,floor.filter(s=>(s.floorRoom??s.wall.hall)===id));
    }
    visible=[...hung,...floor];
    motion.setObstacles(visible);display.setSlots(visible,true,id);
    return completedHall;
  }
  function aim(){
    world.camera.getWorldDirection(dir);origin.copy(world.camera.position);origin.y-=config.building.floorElevation;
    hall=layout.halls.find(h=>{
      const p=layout.local(h,origin.x,origin.z);return Math.abs(p.x)<=h.width/2 && p.z>=h.start && p.z<=h.start+h.length;
    });
    room=hall?.id??'center';
    return origin.y>0 && wallAtRay(origin,dir,layout.hangingWalls,config.building.height,Math.max(12,config.building.wingLength));
  }
  function update(playing,now=performance.now()){
    updateScene(playing,now);
    if(playing&&active&&now-lastIntegrity>10000){
      lastIntegrity=now;const present=new Set(visible.map(s=>s.painting.id));
      for(const slot of [interaction.carrying,interaction.landing?.slot])if(slot)present.add(slot.painting.id);
      const missing=page.filter(s=>!disposal.has(s.painting.id)&&!present.has(s.painting.id)).map(s=>s.painting.id);
      const signature=missing.join(',');if(signature&&signature!==lastMissing)onEvent('painting_missing',{count:missing.length,paintingIds:missing.slice(0,10).join(',')});lastMissing=signature;
    }
    const slot=active&&!interaction.landing?interaction.carrying:null;
    motionAudio.update({playing,slot,large:slot&&usesTrolley(slot),heavy:slot&&heavyIds.has(slot.painting.id),
      placing:interaction.placing,raised:interaction.raised,position:world.camera.position,
      wallPosition:cursor?{x:target?.along??cursor.x,y:target?.y??cursor.y}:null,now});
    fitAudio.update(playing?aimedPlace:null);
  }
  function updateScene(playing,now) {
    aimedPlace=null;placementFailure='no_wall';
    completion.update(now);
    compositions.updateVisibility(active&&!freePlacement);
    feedback.update(now);
    const disposalHint=disposal.update(now,playing&&active&&!interaction.landing,interaction.carrying);
    if(!playing){pausedAt??=now;preview.resetHover();return;}
    if(pausedAt!==null){
      const elapsed=Math.max(0,now-pausedAt);
      preview.resumeAfterPause(elapsed);
      if(cursor)cursor.time+=elapsed;
      if(interaction.landing)interaction.landing.start+=elapsed;
      pausedAt=null;
    }
    preview.hide();target=null;picked=null;
    if(!active){preview.resetHover();return;}
    if(interaction.landing){
      const p=Math.min(1,Math.max(0,now-interaction.landing.start)/interaction.landing.duration);
      const {slot,path,ballistic}=interaction.landing;
      if(ballistic&&!interaction.landing.impactPlayed&&now>=interaction.landing.start+interaction.landing.duration-100){
        interaction.landing.impactPlayed=true;playSound('drop');
      }
      if(p<1){preview.lowering(path,p,ballistic,slot.trolley);return;}
      if(mountedFrame(slot))finishMount(slot,now);
      else {completePlacement(slot);if(ballistic)onThrow(slot);}

    }
    const hit=aim(),reachable=hit && hit.distance<=(settings.placementReachM??6),action=text('E / ЛКМ','E / LMB');
    let message,description=null,commands='';
    if(interaction.carrying){
      const destHall=layout.halls.find(h=>h.id===interaction.carrying.wall.hall);
      const theme=destHall?.walls.find(([id])=>destHall.id+'/'+id===interaction.carrying.destination);
      const dest=freePlacement?text('Свободное размещение · любая стена','Free placement · any wall'):interaction.carrying.destination.split('/')[0]==='center'?text('✦ Шедевр · Центральная ротонда','✦ Masterpiece · Central rotunda'):[t(destHall?.title??'Ротонда'),theme&&t(theme[1])].filter(Boolean).join(' · ');
      const large=usesTrolley(interaction.carrying);
      let hint=text('Наведите на стену','Aim at a wall');
      if(!reachable)cursor=null;
      const carryView=interaction.carryView(large);
      preview.follow(interaction.carrying,large,hall,origin,dir,interaction.source,now,carryView.raised,carryView.inspectHeavy);
      if(preview.takeLiftFailure()){
        onEvent('placement_failed',{reason:'pickup_blocked',paintingId:interaction.carrying.painting.id,hall:room});
        notify(text('Рама упирается в препятствие. Отойдите немного назад — картина остаётся у вас.','The frame is blocked. Step back a little — you are still holding the painting.'));
      }
      if(!interaction.placing)hint=text('E / ЛКМ — повесить, положить на стол или отпустить · удерживайте ПКМ — рассмотреть','E / LMB — hang, place on table or release · hold RMB — inspect');
      if(hit&&!reachable)placementFailure='out_of_reach';
      if(hit && !reachable)hint=interaction.placing?text('Подойдите ближе · установка до 6 м','Move closer · placement within 6 m'):large?text('E / ЛКМ — оставить картину на тележке','E / LMB — leave the painting on its trolley'):text('E / ЛКМ — короткий бросок в этом направлении','E / LMB — short throw in this direction');
      if(interaction.canAimAtWall && reachable){
        const w=hit.wall,limits=wallSettings(w),half=frameDimensions(interaction.carrying,settings).height/2;
        const aimX=hit.along;
        const aimY=clamp(hit.y,limits.minBottomM+half,limits.maxTopM-half);
        if(cursor?.wall!==w)cursor={wall:w,x:aimX,y:aimY,time:now};
        const k=1-Math.exp(-24*Math.max(0,now-cursor.time)/1000);
        cursor.x+=(aimX-cursor.x)*k;cursor.y+=(aimY-cursor.y)*k;cursor.time=now;
        const correctHall=wallPlacement.accepts(interaction.carrying,w);
        placementFailure=correctHall?'occupied_or_too_large':'wrong_hall';
        if(correctHall){
          const tryPosition=(x,y)=>{
            const result=wallPlacement.evaluate(interaction.carrying,w,x,y);
            if(result.reason)placementFailure=result.reason;
            return result.slot;
          };
          const snap=freePlacement?null:adjacentPosition(interaction.carrying,w,cursor.x,cursor.y,hung,settings.frameWidthM);
          const fitted=freePlacement?null:compositions.snap(interaction.carrying,w,hit.along,hit.y,tryPosition);
          if(fitted)aimedPlace=interaction.carrying.painting.id+'/'+w.id+'/'+fitted.along.toFixed(3)+'/'+fitted.y.toFixed(3);
          target=fitted
            ??(snap?tryPosition(snap.x,snap.y):null)??tryPosition(cursor.x,cursor.y);
        }
        hint=target?action+text(' — повесить',' — hang'):text('Рама не помещается или место занято','Frame does not fit or the space is occupied');
        if(!freePlacement&&interaction.carrying.painting.collection==='keynlock')
          hint=text('Эту работу можно оставить на столе или отнести к приёмнику','Leave this work on a table or take it to the receiver');
        else if(!correctHall)hint=text('Нужен зал «','Required hall “')+t(destHall?.title??'Ротонда')+text('»','”');
      }
      if(!target||!reachable)wallPreviewArmed=true;
      const wallPreview=wallPreviewArmed&&target&&interaction.canAimAtWall&&!aimedSupport(origin,dir,layout,config,hit?.distance,settings.placementReachM??6);
      if(wallPreview){
        if(!interaction.placing){preview.beginWall(now);interaction.place();}
        preview.wall(interaction.carrying,hit.wall,target.along,target.y,true,large,now);
      }else if(interaction.placing){
        if(!interaction.inspecting)preview.beginReturn(now);
        interaction.carry();
      }
      let tablePlan=null;
      if(!interaction.inspecting&&!interaction.placing){
        const plan=tablePlan=tablePreview.update({origin,dir,carrying:interaction.carrying,floor,room,wallDistance:hit?.distance,now});
        if(plan){preview.table(plan.slot,now,plan.valid);hint=plan.valid?text('E / ЛКМ — положить на стол','E / LMB — place on the table'):text('Место занято · сдвиньте прицел','Space occupied · move the reticle');}
      }
      // A red hint may indicate the wrong hall or an occupied place, but it
      // still needs a complete wall face behind the frame, including at arches.
      const invalidHint=!target&&reachable&&interaction.canAimAtWall&&cursor&&!tablePlan&&
        Boolean(wallPlacement.surface(interaction.carrying,hit.wall,cursor.x,cursor.y));
      if(invalidHint)preview.wall(interaction.carrying,hit.wall,cursor.x,cursor.y,false,large,now,true);
      if(!interaction.placing)preview.returnToCarry(now,interaction.inspecting||Boolean(tablePlan)||Boolean(invalidHint));
      description=interaction.carrying;
      commands=hint;
      message=[paintingTitle(interaction.carrying.painting),large?text('Тележка и подъёмник','Trolley and hoist'):null,dest,hint].filter(Boolean).join(' · ');
    }else{
      picked=aimedFrameAtRay(origin,dir,visible,settings,hit?.distance);
      const pickFloor=picked && !mountedFrame(picked) ? picked : null;
      coveredPick=pickFloor && pickFloor.floorAngle!==undefined && covered(pickFloor,floorByRoom.get(pickFloor.floorRoom??pickFloor.wall.hall)??emptyRoom,settings);
      preview.hover(pickFloor,now);
      description=picked;
      commands=picked?[(pickFloor?action+text(' — взять',' — pick up'):text('Удерживайте E / ЛКМ — снять','Hold E / LMB to take down')),text('удерживайте ПКМ — рассмотреть','hold RMB — inspect')].filter(Boolean).join(' · '):text('Наведите на картину · E / ЛКМ — взять','Aim at a painting · E / LMB — pick up');
      message=picked?paintingTitle(picked.painting)+(picked.destination.split('/')[0]==='center'?text(' · ✦ Шедевр · Центральная ротонда',' · ✦ Masterpiece · Central rotunda'):'')+' · '+(pickFloor?action+text(' — взять',' — pick up'):text('Удерживайте E / ЛКМ — снять','Hold E / LMB to take down'))+text(' · удерживайте ПКМ — рассмотреть',' · hold RMB — inspect'):
        page.length===0?text('Выберите картины в подборке','Select paintings in the collection'):hung.length===page.length?text('Эта экспозиция развешена','This exhibition is hung'):
        text('Наведите прицел на картину на полу · E / ЛКМ — взять','Aim at a painting on the floor · E / LMB — pick up');
    }
    if(!interaction.carrying && coveredPick)message=text('Сначала поднимите картину сверху','Lift the painting above this one first');
    if(coveredPick)commands=text('Сначала поднимите картину сверху','Lift the painting above this one first');
    if(disposalHint){description=text('Приёмник утилизации · второй этаж','Disposal receiver · second floor');commands=disposalHint;}
    const wallProgress=reachable&&compositions.summary(hit.wall,hit.along,hit.y);
    if(wallProgress&&!disposalHint){
      const {group,filled,total}=wallProgress;
      commands+=' · '+text('Группа ','Group ')+group.filled+'/'+group.places.length+' · '+text('Стена ','Wall ')+filled+'/'+total;
    }
    if(controls?.dataset){
      const canPark=Boolean(interaction.carrying&&usesTrolley(interaction.carrying)&&preview.parkPose());
      if(controls.dataset.canPark!==String(canPark))controls.dataset.canPark=String(canPark);
    }
    if(controls){showLabel(description);showPaintingControls(controls,commands);return;}
    if(label.textContent!==message)label.textContent=message;
  }
  function completePlacement(slot){
    changeSlot(slot,true);interaction.reset();cursor=null;preview.select(null);
  }
  function finishMount(slot,now){
    motionAudio.reset();
    playSound('mount');
    onEvent('painting_mount',{paintingId:slot.painting.id,hall:slot.wall.hall,freePlacement});
    if(!freePlacement)playSound('correctPlace');
    feedback.show(slot,now,display.renderSettings?.hallColors?.[slot.wall.hall]);
    const before=compositions.summary(slot.wall,slot.along,slot.y);
    const groupFilled=before?.group.filled;
    const completedHall=changeSlot(slot,true,true);
    onMount(slot);
    const after=compositions.summary(slot.wall,slot.along,slot.y);
    const completedWall=after&&after.filled===after.total&&before.filled<after.filled;
    const completedGroup=after&&after.group.filled===after.group.places.length&&groupFilled<after.group.filled;
    if(completedHall){onEvent('hall_complete',{hall:slot.wall.hall});playSound('hallComplete',undefined,{after:'correctPlace'});notify(text('✓ Зал оформлен','✓ Gallery complete'));}
    else if(completedWall)notify(text('✓ Стена оформлена','✓ Wall complete'));
    else if(completedGroup)notify(text('✓ Композиция собрана','✓ Composition complete'));
    interaction.reset();cursor=null;preview.select(null);
  }
  function animateSettle(slot,offset,duration){
    if(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return false;
    const end=motion.pose(slot),position=end.position.clone().add(offset);
    const start={position,quaternion:end.quaternion};
    if(motion.blocked(slot,position,start.quaternion)||motion.advance(slot,start,end)<1)return false;
    interaction.lower({slot,path:[start,end],start:performance.now(),duration});
    cursor=null;return true;
  }
  function interact(heldId=null){
    if(!active)return false;
    if(disposal.interact(interaction.carrying,preview.carriedPose(),()=>{
      interaction.reset();cursor=null;preview.select(null);preview.hide();
    }))return true;
    tablePreview.reset();update(true);
    if(interaction.landing)return true;
    if(interaction.carrying){
      const hit=aim(),support=aimedSupport(origin,dir,layout,config,hit?.distance,settings.placementReachM??6);
      const reachable=hit && hit.distance<=(settings.placementReachM??6);
      if(support||!hit||(!reachable&&!interaction.placing)){
        if(interaction.placing){interaction.carry();cursor=null;update(true);}
        if((!support||support.kind==='floor')&&!usesTrolley(interaction.carrying))drop({throwing:true,surface:'floor'});
        else if(support?.kind==='table')drop({surface:'table'});
        else drop();
        return true;
      }
      const mountTarget=target&&wallPlacement.evaluate(target,target.wall,target.along,target.y);
      if(mountTarget?.reason)placementFailure=mountTarget.reason;
      if(mountTarget?.slot && placements.mount(mountTarget.slot)){
        const {normal}=target.wall;
        const animated=usesTrolley(interaction.carrying)&&
          (animateSettle(target,new THREE.Vector3(normal.x*.19,.065,normal.z*.19),180)||
           animateSettle(target,new THREE.Vector3(normal.x*.095,0,normal.z*.095),140));
        if(!animated)finishMount(target,performance.now());
        update(true);
      }else{playSound('deny');onEvent('placement_failed',{reason:mountTarget?.slot?'save_failed':placementFailure,paintingId:interaction.carrying.painting.id,hall:room});}
      return true;
    }
    if(!picked || coveredPick){if(coveredPick)onEvent('placement_failed',{reason:'covered',paintingId:picked?.painting.id??'',hall:room});return false;}
    if(mountedFrame(picked) && heldId!==picked.painting.id)return true;
    motionAudio.reset();
    playSound(mountedFrame(picked)?'unmount':'pickup');
    onEvent(mountedFrame(picked)?'painting_unmount':'painting_pickup',{paintingId:picked.painting.id,hall:room,trolley:usesTrolley(picked)});
    wallPreviewArmed=!mountedFrame(picked);
    interaction.pick(page.find(s=>s.painting.id===picked.painting.id)??storedPage.find(s=>s.painting.id===picked.painting.id)??picked,picked);
    changeSlot(interaction.source,false);preview.resetHover();preview.select(interaction.carrying);preview.beginLift(interaction.source,performance.now());update(true);return true;
  }
  function restoreCarrySource(){
    const source=interaction.source;
    if(!source)return false;
    onEvent('painting_recovered',{paintingId:source.painting.id,reason:'no_drop_path'});
    interaction.reset();cursor=null;preview.select(null);changeSlot(source,true);update(true);
    notify(text('Картина возвращена на место, откуда вы её взяли','Painting returned to its pickup location'));
    return true;
  }
  function drop({throwing=false,surface=null}={}){
    if(!interaction.carrying)return;
    if(interaction.placing){interaction.carry();cursor=null;update(true);return;}
    if(usesTrolley(interaction.carrying) && !throwing && surface!=='table'){
      const pose=preview.parkPose();
      if(!pose){restoreCarrySource();return;}
      const yaw=new THREE.Euler().setFromQuaternion(pose.quaternion,'YXZ').y;
      const parked=settleTrolley({...interaction.carrying,trolley:true,x:pose.position.x,z:pose.position.z,
        normal:{x:Math.sin(yaw),z:Math.cos(yaw)}},layout,config);
      if(!placements.park(parked,yaw))return;
      onEvent('painting_drop',{paintingId:parked.painting.id,hall:room,surface:'trolley'});
      if(!animateSettle(parked,new THREE.Vector3(-Math.sin(yaw)*.075,0,-Math.cos(yaw)*.075),230))completePlacement(parked);
      update(true);return;
    }
    const hit=aim();
    let slot=findDrop(interaction.carrying,origin,dir,room,layout,config,floor,hit?.distance);
    if(slot && ((surface==='table' && !slot.supportId?.startsWith('table-')) || (throwing && slot.supportId?.startsWith('table-'))))slot=null;
    let flight=null,weakThrow=false,path=throwing?null:slot&&preview.dropPath(slot);
    if(throwing){for(const candidate of throwTargets(interaction.carrying,origin,dir,room,layout,config,floor,hit?.distance)){
      const arc=preview.throwPath(candidate.slot);if(arc){slot=candidate.slot;flight=arc;path=arc.path;weakThrow=candidate.weak;break;}
    }}
    if(!throwing&&!path && surface!=='table'){
      // If the reticle hits a crowded spot, find a nearby supported free surface.
      const yaw=Math.atan2(dir.x,dir.z);
      search:for(const radius of [.8,1.3,1.9,2.6,3.4])for(const offset of [0,.35,-.35,.7,-.7,1.2,-1.2,Math.PI]){
        const angle=yaw+offset;
        const ray=new THREE.Vector3(Math.sin(angle)*radius,-Math.max(.2,origin.y),Math.cos(angle)*radius).normalize();
        const candidate=findDrop(interaction.carrying,origin,ray,room,layout,config,floor);
        if(!candidate || (throwing && candidate.supportId?.startsWith('table-')))continue;
        const candidateFlight=throwing && preview.throwPath(candidate);
        const route=throwing?candidateFlight?.path:preview.dropPath(candidate);
        if(route){slot=candidate;path=route;flight=candidateFlight;break search;}
      }
    }
    if(!slot || !path){
      onEvent('placement_failed',{reason:'no_drop_path',paintingId:interaction.carrying.painting.id,hall:room});
      playSound('deny');
      if(!surface && restoreCarrySource())return;
      notify(text('Нет свободного пути. Отойдите от препятствия и попробуйте положить картину ещё раз.','No clear path. Step away from the obstacle and try placing the painting again.'));return;
    }
    if(!placements.placeOnFloor(slot))return;
    const travel=path.slice(1).reduce((d,b,i)=>d+b.position.distanceTo(path[i].position),0);
    onEvent(throwing?'painting_throw':'painting_drop',{paintingId:slot.painting.id,hall:room,surface:slot.supportId?.startsWith('table-')?'table':'floor',weakThrow});
    interaction.lower({slot,path,start:performance.now(),ballistic:throwing,duration:flight?.duration??Math.min(1600,360+travel*80)});cursor=null;update(true);
  }
  function aimed(){
    if(!active || interaction.landing)return null;
    const hit=aim();
    if(interaction.carrying)return hit?interaction.source:null;
    return aimedFrameAtRay(origin,dir,visible,settings,hit?.distance);
  }
  function wallPick(){
    if(!active || interaction.carrying || interaction.landing)return null;
    const slot=aimed();return slot && mountedFrame(slot)?slot.painting.id:null;
  }
  function updateMode(value){
    active=value;
    showLabel(null);
    if(controls)controls.textContent='';
  }
  function setPage(slots,allSlots=slots,hanging=active){
    motionAudio.reset();
    heavyIds=heaviestPaintingIds(allSlots,usesTrolley);
    if(hanging!==active)updateMode(hanging);
    page=slots;
    const ids=new Set(slots.map(s=>s.painting.id));
    storedPage=allSlots.filter(s=>!ids.has(s.painting.id)&&placements.wasOnLegacyReceiver(s.painting.id));
    interaction.reset();
    rebuild();
  }
  return {
    constrainMovement(from,to){return interaction.carrying&&!interaction.placing?preview.constrainMovement(from,to):1;},
    get freePlacement(){return freePlacement;},
    setFreePlacement(value){
      if(freePlacement===Boolean(value))return;
      freePlacement=Boolean(value);motionAudio.reset();fitAudio.update(null);
      interaction.reset();placements.setFreePlacement(freePlacement);rebuild();
    },
    wallPick,setPlacementEffect:feedback.setEffect,
    canSprint(){
      const slot=interaction.carrying??interaction.landing?.slot;
      return !slot||!usesTrolley(slot);
    },
    get carriedId(){return interaction.carrying?.painting.id;},
    get phase(){return interaction.phase;},
    canRaise:()=>Boolean(interaction.carrying&&!interaction.placing),
    raise:value=>interaction.raise(value),
    get active(){return active;},
    setActive(value){updateMode(value);interaction.reset();rebuild();},
    setPage,update,interact,drop,setInspecting(value){interaction.inspect(value);if(interaction.inspecting)update(true);},
    playtestSnapshot:()=>({hall:room,carrying:interaction.carrying?.painting.id??'',hung:hung.filter(s=>page.some(p=>p.painting.id===s.painting.id)).length,floor:floor.length,total:page.length,disposed:page.filter(s=>disposal.has(s.painting.id)).length,completedHalls:completion.completedCount,freePlacement}),
    inspectionTarget(){
      const slot=interaction.carrying,pose=preview.carriedPose();
      return slot&&usesTrolley(slot)&&pose?{position:pose.position,height:slot.height}:null;
    },
    aimed,inspectSlot(){return interaction.carrying ?? interaction.landing?.slot ?? aimed();},
    fillVacancy(slot,replacement){
      const occupied=hung.filter(s=>s!==slot);
      const available=floor.filter(s=>s.destination===slot.destination && !placements.has(s.painting.id))
        .sort((a,b)=>Math.abs(a.width-slot.width)+Math.abs(a.height-slot.height)-
          Math.abs(b.width-slot.width)-Math.abs(b.height-slot.height));
      for(const candidate of [replacement,...available]){
        if(!candidate || placements.has(candidate.painting.id) || !acceptsHall(candidate,slot.wall))continue;
        const position=placedSlot(candidate,slot.wall,slot.along,slot.y,wallSettings(slot.wall),occupied);
        if(position && placements.mount(candidate,position))return candidate;
      }
    },
    find(id){return active?[...hung,...floor].find(s=>s.painting.id===id):null;},
    dispose(){motionAudio.reset();completion.clear();feedback.dispose();preview.dispose();disposal.dispose();compositions.dispose();}};
}
