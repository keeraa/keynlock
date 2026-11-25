import {getLanguage} from '../localization/i18n.js';

// Like the key archive's first-route guide: project the current objective,
// then keep a direction cue on screen when the player looks away.
export function createTutorialGuide({THREE,camera,layout,floorElevation,parent=document.body}){
 const marker=document.createElement('div');marker.id='tutorial-marker';marker.hidden=true;
 marker.setAttribute('aria-hidden','true');
 const symbol=document.createElement('span'),caption=document.createElement('span');
 symbol.className='tutorial-marker-symbol';caption.className='tutorial-marker-caption';
 marker.append(symbol,caption);parent.append(marker);
 const point=new THREE.Vector3(),local=new THREE.Vector3();
 return {
  update(target,playing){
   marker.hidden=!target||!playing;
   if(marker.hidden)return;
   const en=getLanguage()==='en';let label=target.label;
   if(target.kind==='drop'){
    camera.getWorldDirection(point);point.y=0;point.normalize().multiplyScalar(1.2).add(camera.position);
    point.y=floorElevation;label=en?'Look down · E / LMB':'Посмотрите вниз · E / ЛКМ';
   }else if(target.kind==='hall'){
    const h=target.hall,p=layout.local(h,camera.position.x,camera.position.z);
    const inside=p.z>=h.start&&Math.abs(p.x)<h.width/2;
    const at=layout.world(h,0,inside?h.start+h.length-.3:h.start+1.5);
    point.set(at.x,floorElevation+2,at.z);
    label=(en?'Gallery: ':'Зал «')+label+(en?'':'»');
   }else{
    const s=target.slot;
    point.set(s.x,floorElevation+s.y+.25,s.z);
   }
   camera.updateMatrixWorld(true);
   const distance=point.distanceTo(camera.position);
   local.copy(point).applyMatrix4(camera.matrixWorldInverse);point.project(camera);
   const inView=local.z<0&&Math.abs(point.x)<.82&&Math.abs(point.y)<.65;
   let x=point.x,y=-point.y;
   if(!inView){
    // Camera space gives a stable turn direction even directly behind us.
    x=local.x/(Math.abs(local.z)||.01);y=-local.y/(Math.abs(local.z)||.01);
    if(local.z>=0)x=local.x<0?-1:1;
    const scale=Math.max(Math.abs(x)/.82,Math.abs(y)/.65,1);
    x/=scale;y/=scale;
    if(local.z>=0)x=local.x<0?-.82:.82;
    const direction=local.z>=0?(en?'Turn around':'Развернитесь'):
      Math.abs(x)>.7?(x<0?(en?'To the left':'Слева'):(en?'To the right':'Справа')):
      y>0?(en?'Look down':'Посмотрите вниз'):(en?'Look up':'Посмотрите вверх');
    label=direction+' · '+label;
   }
   marker.style.left=(50+x*50)+'%';marker.style.top=(50+y*50)+'%';
   marker.dataset.edge=String(!inView);marker.dataset.kind=target.kind;
   symbol.textContent=inView?'▼':'➤';
   symbol.style.transform=inView?'':`rotate(${Math.atan2(y,x)}rad)`;
   caption.textContent=label+' · '+Math.round(distance)+(en?' m':' м');
  },
  dispose(){marker.remove();},
 };
}
