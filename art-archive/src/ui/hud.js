import {t} from '../localization/i18n.js';
export function createHud({canvas,camera,layout,config,elements}){
 let timer,frames=0,fpsAt=performance.now(),hiddenHelp=false,lastLocation='';
 const el=id=>elements(id);
 function updateLocation(mode,floorY){
  let title='Ротонда',sub='Мировые шедевры · третий этаж',color='#c6a66c';
  if(floorY<-1){title='Лестница в логово';sub='Между вторым и третьим этажами';if(floorY<-4){title='Второй этаж';sub='Площадка перед логовом';}}
  else for(const h of layout.halls){const p=layout.local(h,camera.position.x,camera.position.z);if(p.z>=h.start&&Math.abs(p.x)<h.width/2){title=h.title;sub='Галерея · третий этаж';color=h.color;break;}}
  const key=t(title)+'|'+t(sub)+'|'+color;if(key!==lastLocation){
   lastLocation=key;const badge=el('location');badge.style.setProperty('--department-color',color);
   badge.replaceChildren(document.createTextNode(t(title)),Object.assign(document.createElement('span'),{textContent:t(sub)}));
  }
  const door=layout.lowerDoor;
  const nearDoor=door && Math.abs(floorY-door.y)<.25 && Math.hypot(camera.position.x-door.x,camera.position.z-door.z)<1.75;
  el('prompt').hidden=mode!=='play'||!nearDoor;
 }
 function toast(message){el('toast').textContent=t(message);el('toast').style.opacity=1;clearTimeout(timer);timer=setTimeout(()=>el('toast').style.opacity=0,4000);}
 function refreshMode(mode,{pauseMenu=true}={}){
  for(const [id,visible]of [['intro','intro'],['pause','pause'],['plan-caption','plan'],['crosshair','play']])el(id).hidden=mode!==visible||(id==='pause'&&!pauseMenu);
  el('prompt').hidden=true;document.body.className=mode;
 }
 return {toast,updateLocation,refreshMode,canInteract:()=>!el('prompt').hidden,
  hints(){hiddenHelp=!hiddenHelp;el('help').hidden=hiddenHelp;},
  performance(now,renderer,clouds){frames++;if(now-fpsAt>700){canvas.dataset.clouds=JSON.stringify(clouds.snapshot());el('fps-value').textContent=Math.round(frames*1000/(now-fpsAt));el('triangles-value').textContent=renderer.info.render.triangles.toLocaleString('ru-RU');frames=0;fpsAt=now;}},
  dispose(){clearTimeout(timer);}};
}
