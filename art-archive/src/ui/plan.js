import {t} from '../localization/i18n.js';
export function createFloorPlan({THREE,config,layout,parent=document.body}){
 const extent=config.building.radius+config.building.wingLength+1;
 const camera=new THREE.OrthographicCamera(-extent,extent,extent,-extent,.1,300);
 camera.position.set(0,150,0);camera.up.set(0,0,-1);camera.lookAt(0,config.building.floorElevation,0);
 let zoom=1,width=1,height=1;
 const labels=document.createElement('div');labels.id='plan-labels';labels.hidden=true;parent.append(labels);
 const tags=layout.halls.map(h=>{const el=document.createElement('span');el.className='hall-tag';el.style.borderLeft='8px solid '+h.color;labels.append(el);return {h,el};});
 const center=document.createElement('span');center.className='hall-tag';center.style.borderLeft='8px solid #d8b766';labels.append(center);tags.push({h:null,el:center});
 function place(){camera.updateMatrixWorld(true);for(const {h,el}of tags){const p=h?layout.world(h,0,h.start+h.length*.55):{x:0,z:0},v=new THREE.Vector3(p.x,config.building.floorElevation,p.z).project(camera);el.style.left=(v.x*.5+.5)*width+'px';el.style.top=(-v.y*.5+.5)*height+'px';}}
 function resize(w,h){width=w;height=h;const aspect=w/h,half=extent/zoom;camera.left=-half*Math.max(1,aspect);camera.right=-camera.left;camera.top=half*Math.max(1,1/aspect);camera.bottom=-camera.top;camera.updateProjectionMatrix();place();}
 function refreshLanguage(){for(const {h,el}of tags)el.textContent=t(h?.title??'Ротонда');}
 refreshLanguage();return {camera,resize,refreshLanguage,setVisible(value){labels.hidden=!value;},zoom(delta){zoom=THREE.MathUtils.clamp(zoom*Math.exp(-delta*.001),.55,3);resize(width,height);},dispose(){labels.remove();}};
}
