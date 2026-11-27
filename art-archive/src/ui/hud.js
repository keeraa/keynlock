import {t} from '../localization/i18n.js';
export function createHud({canvas,camera,layout,config,elements}){
 let timer,frames=0,fpsAt=performance.now(),hiddenHelp=false,lastLocation='';
 const el=id=>elements(id);
 function updateLocation(mode,floorY){
  let title='Ротонда',sub='Мировые шедевры · третий этаж';
  if(floorY<-1){title='Лестница в логово';sub='Между вторым и третьим этажами';if(floorY<-4){title='Второй этаж';sub='Площадка перед логовом';}}
  else for(const h of layout.halls){const p=layout.local(h,camera.position.x,camera.position.z);if(p.z>config.building.radius+.3&&Math.abs(p.x)<h.width/2){title=h.title;sub='Галерея · третий этаж';break;}}
  const key=t(title)+'|'+t(sub);if(key!==lastLocation){lastLocation=key;el('location').replaceChildren(document.createTextNode(t(title)),Object.assign(document.createElement('span'),{textContent:t(sub)}));}
  el('prompt').hidden=mode!=='play'||floorY>-4||camera.position.z>-3.5;
 }
 function toast(message){el('toast').textContent=t(message);el('toast').style.opacity=1;clearTimeout(timer);timer=setTimeout(()=>el('toast').style.opacity=0,4000);}
 function refreshMode(mode){
  for(const [id,visible]of [['intro','intro'],['pause','pause'],['plan-caption','plan'],['crosshair','play']])el(id).hidden=mode!==visible;
  el('prompt').hidden=true;document.body.className=mode;el('plan-btn').textContent=t(mode==='plan'?'Вернуться к прогулке':'План этажа');
 }
 return {toast,updateLocation,refreshMode,canInteract:()=>!el('prompt').hidden,
  hints(){hiddenHelp=!hiddenHelp;el('help').hidden=hiddenHelp;},
  performance(now,renderer,clouds){frames++;if(now-fpsAt>700){canvas.dataset.clouds=JSON.stringify(clouds.snapshot());el('fps-value').textContent=Math.round(frames*1000/(now-fpsAt));el('triangles-value').textContent=renderer.info.render.triangles.toLocaleString('ru-RU');frames=0;fpsAt=now;}},
  dispose(){clearTimeout(timer);}};
}
