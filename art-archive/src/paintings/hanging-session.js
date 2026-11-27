import {createPaintingInteraction} from './interaction-state.js';
import {frameDimensions} from '../../catalog/painting-geometry.js';
import {adjacentPosition,frameAtRay, floorSlots, placedSlot, wallAtRay} from './hanging.js';
import {createPlacementFeedback} from './placement-feedback.js';
import {createFrameMotion} from './frame-motion.js';
import {findDrop,settleFloor,settleTrolley,covered} from './floor-drop.js';
import {createPlacementPreview} from './placement-preview.js';
import {readJson,writeJson} from '../persistence/storage.js';
import {getLanguage,t} from '../localization/i18n.js';

const KEY='keynlock-art-hanging-v1';
const text=(ru,en)=>getLanguage()==='en'?en:ru;
export function createHangingSession({debugSelection=false,THREE,world,config,display,label,controls=null,notify=()=>{}}) {
  const settings=config.paintings,layout=world.layout;
  const walls=new Map(layout.hangingWalls.map(w=>[w.id,w]));
  const oldWalls=new Map(layout.walls.map(w=>[w.id,w]));
  const motion=createFrameMotion(THREE,config,layout);
  const wallSettings=w=>({...settings,edgeMarginM:0,horizontalGapM:0,verticalGapM:0,minBottomM:.84,
    maxTopM:config.building.height-(w.hall==='center' ? .13 : config.building.vaultRise+.03)});
  const interaction=createPaintingInteraction();
  let cursor=null,coveredPick=false;
  const clamp=(x,min,max)=>max>=min?Math.max(min,Math.min(max,x)):(min+max)/2;
  const saveKey=debugSelection ? KEY+'-debug' : KEY;
  const progress=readJson(saveKey,debugSelection?readJson(KEY,{}):{}), origin=new THREE.Vector3(), dir=new THREE.Vector3();
  const feedback=createPlacementFeedback(THREE,world.scene,config);
  const preview=createPlacementPreview(THREE,world,display,config,motion);
  let active=false,page=[],hung=[],floor=[],target=null,picked=null,room='center',hall=null;
  let visible=[];
  const floorByRoom = new Map(), emptyRoom = [];
  function save(id,value){
    const latest={...readJson(saveKey,progress),[id]:value};
    if(!writeJson(saveKey,latest)){notify(text('Не удалось сохранить положение','Could not save placement'));return false;}
    Object.assign(progress,latest);return true;
  }
  function fitsHall(slot,wall){
    return slot.destination.split('/')[0]===wall.hall;
  }
  function rebuild() {
    if(interaction.carrying)interaction.carry();
    preview.select(interaction.carrying??interaction.landing?.slot??null);
    preview.hide();preview.resetHover();cursor=null;target=null;picked=null;
    floorByRoom.clear();
    if(!active){display.setSlots(page);return;}
    hung=[];floor=[];
    const hidden=(interaction.carrying??interaction.landing?.slot)?.painting.id,restored=[];
    for(const slot of floorSlots(page,layout,config)){
      const id=slot.painting.id;
      if(id===hidden)continue;
      const saved=progress[id];
      const legacy=saved?.version!==3 && oldWalls.get(saved?.wall);
      const wall=legacy?walls.get(legacy.id)??walls.get(legacy.hall+'/side/'+legacy.id.split('/')[1]):walls.get(saved?.wall);
      let along=saved?.along;
      if(legacy && wall){
        along+=(saved.version===2?0:legacy.legacyAlongShift??0)+
          ((legacy.a.x-wall.a.x)*(wall.b.x-wall.a.x)+(legacy.a.z-wall.a.z)*(wall.b.z-wall.a.z))/wall.length;
      }
      const installed=wall && fitsHall(slot,wall) && placedSlot({...slot,floorAngle:undefined},wall,along,saved.y,wallSettings(wall),hung);
      if(saved?.kind==='trolley' && (!saved.destination || saved.destination===slot.destination) &&
          [saved.x,saved.z,saved.y,saved.yaw].every(Number.isFinite)){
        floor.push(settleTrolley({...slot,trolley:true,x:saved.x,z:saved.z,y:saved.y,
          normal:{x:Math.sin(saved.yaw),z:Math.cos(saved.yaw)},floorRoom:saved.floorRoom},layout,config));
      }else if(installed)hung.push(installed);
      else if(saved?.kind==='floor' && (!saved.destination || saved.destination===slot.destination) && [saved.x,saved.z,saved.y,saved.floorAngle].every(Number.isFinite))
        restored.push({...slot,x:saved.x,z:saved.z,y:saved.y,floorAngle:saved.floorAngle,faceDown:saved.faceDown===true,floorRoom:saved.floorRoom,supportId:saved.supportId});
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
    motion.setObstacles(visible);display.setSlots(visible,true);
  }
  function changeSlot(slot,add){
    const id=slot.floorRoom??slot.wall.hall;
    if(slot.floorAngle===undefined && !slot.trolley)hung=add?[...hung,slot]:hung.filter(s=>s!==slot);
    else {
      floor=add?[...floor,slot]:floor.filter(s=>s!==slot);
      floorByRoom.set(id,floor.filter(s=>(s.floorRoom??s.wall.hall)===id));
    }
    visible=[...hung,...floor];
    motion.setObstacles(visible);display.setSlots(visible,true,id);
  }
  function aim(){
    world.camera.getWorldDirection(dir);origin.copy(world.camera.position);origin.y-=config.building.floorElevation;
    hall=layout.halls.find(h=>{
      const p=layout.local(h,origin.x,origin.z);return Math.abs(p.x)<=h.width/2 && p.z>=h.start && p.z<=h.start+h.length;
    });
    room=hall?.id??'center';
    return origin.y>0 && wallAtRay(origin,dir,layout.hangingWalls,config.building.height,Math.max(12,config.building.wingLength));
  }
  function update(playing,now=performance.now(),exhibitionFocus=null) {
    feedback.update(now);preview.hide();target=null;picked=null;
    if(!playing){interaction.raise(false);preview.resetHover();cursor=null;return;}
    if(!active){preview.resetHover();return;}
    if(interaction.landing){
      const p=Math.min(1,Math.max(0,now-interaction.landing.start)/interaction.landing.duration);
      if(p<1){preview.lowering(interaction.landing.path,p);return;}
      changeSlot(interaction.landing.slot,true);interaction.reset();preview.select(null);
    }
    const hit=aim(),action=text('E или клик','E or click');
    let message,description='',commands='';
    if(interaction.carrying){
      const destHall=layout.halls.find(h=>h.id===interaction.carrying.wall.hall);
      const theme=destHall?.walls.find(([id])=>destHall.id+'/'+id===interaction.carrying.destination);
      const dest=interaction.carrying.destination.split('/')[0]==='center'?text('✦ Шедевр · Центральная ротонда','✦ Masterpiece · Central rotunda'):[t(destHall?.title??'Ротонда'),theme&&t(theme[1])].filter(Boolean).join(' · ');
      const large=Math.max(interaction.carrying.height,interaction.carrying.painting.physicalSizeM.width)>=settings.hoistFromM;
      let hint=text('Наведите на стену','Aim at a wall');
      if(!hit && interaction.placing && cursor){preview.retainWall();hint=text('Наведите на доступную стену','Aim at a wall');}
      if(!interaction.placing)preview.follow(interaction.carrying,large,hall,origin,dir,interaction.source,now,interaction.raised);
      if(!interaction.placing)hint=text('E у стены — примерить · удерживайте E или ПКМ — рассмотреть','E at wall — preview · hold E or RMB — examine');
      if(interaction.placing && hit){
        const w=hit.wall,limits=wallSettings(w),half=frameDimensions(interaction.carrying,settings).height/2;
        const aimX=clamp(hit.along,interaction.carrying.width/2,w.length-interaction.carrying.width/2);
        const aimY=clamp(hit.y,limits.minBottomM+half,limits.maxTopM-half);
        if(cursor?.wall!==w)cursor={wall:w,x:aimX,y:aimY,time:now};
        const k=1-Math.exp(-24*Math.max(0,now-cursor.time)/1000);
        cursor.x+=(aimX-cursor.x)*k;cursor.y+=(aimY-cursor.y)*k;cursor.time=now;
        const correctHall=fitsHall(interaction.carrying,w);
        if(correctHall){
          const tryPosition=(x,y)=>{
            const slot=placedSlot(interaction.carrying,w,x,y,limits,hung);
            if(!slot)return null;
            if(Math.hypot(slot.x-origin.x,slot.y-origin.y,slot.z-origin.z)>(settings.placementReachM??6))return null;
            const pose=motion.pose(slot);
            return motion.blocked(slot,pose.position,pose.quaternion)?null:slot;
          };
          const snap=adjacentPosition(interaction.carrying,w,cursor.x,cursor.y,hung,settings.frameWidthM);
          target=(snap?tryPosition(snap.x,snap.y):null)??tryPosition(cursor.x,cursor.y);
        }
        preview.wall(interaction.carrying,w,target?.along??cursor.x,target?.y??cursor.y,Boolean(target),large,now);
        hint=target?action+text(' — повесить',' — hang'):text('Рама не помещается или место занято','Frame does not fit or the space is occupied');
        if(!target && hit.distance>(settings.placementReachM??6))hint=text('Подойдите ближе · установка до 6 м','Move closer · placement within 6 m');
        if(!correctHall)hint=text('Нужен зал «','Required hall “')+t(destHall?.title??'Ротонда')+text('»','”');
      }
      description=[interaction.carrying.painting.title,interaction.carrying.painting.artist,dest].filter(Boolean).join(' · ');
      commands=[hint,interaction.placing?text('R — вернуться к переносу','R — return to carrying'):large?text('R — оставить на тележке','R — park trolley'):text('R — положить','R — set down')].join(' · ');
      message=[interaction.carrying.painting.title,large?text('Тележка и подъёмник','Trolley and hoist'):null,dest,hint,large?text('R — оставить на тележке','R — park trolley'):text('R — положить','R — set down')].filter(Boolean).join(' · ');
    }else{
      picked=frameAtRay(origin,dir,visible,settings,hit?.distance??world.camera.far);
      const pickFloor=picked && (picked.floorAngle!==undefined || picked.trolley) ? picked : null;
      coveredPick=pickFloor && !pickFloor.trolley && covered(pickFloor,floorByRoom.get(pickFloor.floorRoom??pickFloor.wall.hall)??emptyRoom,settings);
      preview.hover(pickFloor,now);
      description=picked?[picked.painting.title,picked.painting.artist,picked.destination.split('/')[0]==='center'?text('✦ Шедевр · Центральная ротонда','✦ Masterpiece · Central rotunda'):null].filter(Boolean).join(' · '):'';
      commands=picked?[(pickFloor?action+text(' — взять',' — pick up'):text('Удерживайте E или ЛКМ — снять','Hold E or LMB to take down')),text('F — рассмотреть','F — inspect'),text('Q — исключить из подборки','Q — exclude from selection')].filter(Boolean).join(' · '):text('Наведите на картину · E или клик — взять','Aim at a painting · E or click to pick up');
      message=picked?picked.painting.title+(picked.destination.split('/')[0]==='center'?text(' · ✦ Шедевр · Центральная ротонда',' · ✦ Masterpiece · Central rotunda'):'')+' · '+(pickFloor?action+text(' — взять',' — pick up'):text('Удерживайте E или ЛКМ — снять','Hold E or LMB to take down'))+text(' · F — рассмотреть',' · F — inspect')+text(' · Q — исключить из подборки',' · Q — exclude from selection'):
        page.length===0?text('Выберите картины в подборке','Select paintings in the collection'):hung.length===page.length?text('Эта экспозиция развешена','This exhibition is hung'):
        text('Наведите прицел на картину на полу · E или клик — взять','Aim at a painting on the floor · E or click to pick up');
    }
    if(!interaction.carrying && coveredPick)message=text('Сначала поднимите картину сверху','Lift the painting above this one first');
    if(coveredPick)commands=text('Сначала поднимите картину сверху','Lift the painting above this one first');
    if(controls){label.textContent=description;controls.textContent=commands+' · '+text('Развешено ','Hung ')+hung.length+'/'+page.length+text(' в этой экспозиции',' in this exhibition');return;}
    const caption=message+' · '+hung.length+'/'+page.length;
    if(label.textContent!==caption)label.textContent=caption;
  }
  function interact(heldId=null){
    if(!active)return false;
    update(true);
    if(interaction.landing)return true;
    if(interaction.carrying){
      if(!interaction.placing){if(aim()){preview.beginWall(performance.now());interaction.place();update(true);}return true;}
      if(target && save(interaction.carrying.painting.id,{version:3,wall:target.wall.id,along:target.along,y:target.y})){
        feedback.show(target,performance.now());
        notify(text('✓ Картина на своём месте · ','✓ Painting in place · ')+t(layout.halls.find(h=>h.id===target.wall.hall)?.title??'Ротонда'));
        changeSlot(target,true);interaction.reset();cursor=null;preview.select(null);update(true);
      }
      return true;
    }
    if(!picked || coveredPick)return false;
    if(picked.floorAngle===undefined && !picked.trolley && heldId!==picked.painting.id)return true;
    interaction.pick(page.find(s=>s.painting.id===picked.painting.id),picked);
    changeSlot(interaction.source,false);preview.resetHover();preview.select(interaction.carrying);preview.beginLift(interaction.source,performance.now());update(true);return true;
  }
  function drop(){
    if(!interaction.carrying)return;
    if(interaction.placing){interaction.carry();cursor=null;update(true);return;}
    const hit=aim();
    const large=Math.max(interaction.carrying.height,interaction.carrying.painting.physicalSizeM.width)>=settings.hoistFromM;
    const floorTarget=findDrop(interaction.carrying,origin,dir,room,layout,config,floor,hit?.distance);
    if(large && !floorTarget?.supportId?.startsWith('table-')){
      const pose=preview.parkPose();
      if(!pose){notify(text('Опустите картину на тележку и дождитесь окончания подъёма','Lower the painting onto the trolley and wait for the lift'));return;}
      const yaw=new THREE.Euler().setFromQuaternion(pose.quaternion,'YXZ').y;
      const {x,z}=pose.position,y=pose.position.y-config.building.floorElevation;
      const actualHall=layout.halls.find(h=>{const p=layout.local(h,x,z);return Math.abs(p.x)<=h.width/2 && p.z>=h.start && p.z<=h.start+h.length;});
      const floorRoom=actualHall?.id??'center';
      if(!save(interaction.carrying.painting.id,{version:3,kind:'trolley',destination:interaction.carrying.destination,x,y,z,yaw,floorRoom}))return;
      const parked={...interaction.carrying,trolley:true,floorAngle:undefined,x,y,z,normal:{x:Math.sin(yaw),z:Math.cos(yaw)},floorRoom};
      interaction.reset();preview.select(null);changeSlot(parked,true);update(true);return;
    }
    const slot=floorTarget;
    if(!slot){notify(text('Перед вами мало места. Развернитесь к свободному полу.','Face a clear area of floor to set this work down.'));return;}
    const path=preview.dropPath(slot);
    if(!path){notify(text('Путь перекрыт другой рамой. Выберите свободное место.','Another frame blocks the path. Aim at a clear spot.'));return;}
    const {x,y,z,floorRoom,floorAngle,supportId,faceDown}=slot;
    if(!save(slot.painting.id,{version:3,kind:'floor',destination:slot.destination,x,y,z,floorRoom,floorAngle,supportId,faceDown}))return;
    const travel=path.slice(1).reduce((d,b,i)=>d+b.position.distanceTo(path[i].position),0);
    interaction.lower({slot,path,start:performance.now(),duration:Math.min(1600,360+travel*80)});cursor=null;update(true);
  }
  function aimed(){
    if(!active || interaction.landing)return null;
    const hit=aim();
    if(interaction.carrying)return hit?interaction.source:null;
    return frameAtRay(origin,dir,visible,settings,hit?.distance??world.camera.far);
  }
  function wallPick(){
    if(!active || interaction.carrying || interaction.landing)return null;
    const slot=aimed();return slot && slot.floorAngle===undefined && !slot.trolley?slot.painting.id:null;
  }
  return {wallPick,get phase(){return interaction.phase;},canRaise:()=>Boolean(interaction.carrying && !interaction.placing),raise(value){interaction.raise(value);},get active(){return active;},setActive(value){active=value;interaction.reset();label.textContent='';if(controls)controls.textContent='';rebuild();},
    setPage(slots){page=slots;interaction.reset();rebuild();},update,interact,drop,
    aimed,inspectSlot(){return interaction.carrying ?? interaction.landing?.slot ?? aimed();},
    fillVacancy(slot,replacement){
      const occupied=hung.filter(s=>s!==slot);
      const available=floor.filter(s=>s.destination===slot.destination && !progress[s.painting.id])
        .sort((a,b)=>Math.abs(a.width-slot.width)+Math.abs(a.height-slot.height)-
          Math.abs(b.width-slot.width)-Math.abs(b.height-slot.height));
      for(const candidate of [replacement,...available]){
        if(!candidate || progress[candidate.painting.id] || !fitsHall(candidate,slot.wall))continue;
        const position=placedSlot(candidate,slot.wall,slot.along,slot.y,wallSettings(slot.wall),occupied);
        if(position && save(candidate.painting.id,{version:3,wall:slot.wall.id,along:slot.along,y:slot.y}))return candidate;
      }
    },
    find(id){return active?[...hung,...floor].find(s=>s.painting.id===id):null;},
    dispose(){feedback.dispose();preview.dispose();}};
}
