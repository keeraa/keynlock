import {overviewGeometry} from './overview.js';
import {createDisposalState,isApprovedKeynlock} from './disposal-state.js';
import {frameDimensions} from '../../catalog/painting-geometry.js';
import {getLanguage} from '../localization/i18n.js';
const text=(ru,en)=>getLanguage()==='en'?en:ru;

export function createDisposalStation({THREE,world,config,display=null,debug=false,total,notify=()=>{},playSound=()=>{},onDisposed=()=>{}}){
 const state=createDisposalState({debug}),receiver=world.layout.disposalStation;
 if(!receiver)return {has:state.has,update(){return null;},interact(){return false;},dispose(){}};
 const root=new THREE.Group();root.name='wall-disposal-receiver';
 root.position.set(receiver.x,config.building.floorElevation+receiver.y,receiver.z);
 root.rotation.y=receiver.angle;world.scene.add(root);root.updateMatrixWorld(true);
 const metal=new THREE.MeshStandardMaterial({color:0x424b43,roughness:.82});
 const trim=new THREE.MeshStandardMaterial({color:0x987847,roughness:.77});
 const dark=new THREE.MeshBasicMaterial({color:0x141712});
 const lamp=new THREE.MeshBasicMaterial({color:0x829b66});
 const face=new THREE.MeshBasicMaterial({map:display?.texture??null});
 display?.gouache?.apply(face);
 function box(x,y,z,w,h,d,material){
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);
  mesh.position.set(x,y,z);root.add(mesh);
 }
 const {width,height}=receiver;
 // The opening in the plaster has a recessed lining, sill and narrow brass rim.
 box(0,0,-.63,width,height,.05,dark);
 for(const side of [-1,1]){
  box(side*(width/2-.025),0,-.31,.05,height,.65,dark);
  box(0,side*(height/2+.065),-.32,width+.29,.13,.75,metal);
  box(side*(width/2+.07),0,-.32,.14,height+.26,.75,metal);
  box(0,side*(height/2+.015),.067,width+.19,.032,.035,trim);
  box(side*(width/2+.018),0,.067,.033,height+.034,.035,trim);
 }
 box(width/2-.15,height/2+.077,.063,.095,.043,.028,lamp);
 world.ink?.add(root);
 let busy=null;
 const origin=new THREE.Vector3(),direction=new THREE.Vector3(),entry=new THREE.Vector3();
 const inverse=root.quaternion.clone().invert();
 const feedingRotation=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-Math.PI/2);
 function targeted(){
  origin.copy(world.camera.position).sub(root.position).applyQuaternion(inverse);
  if(origin.z<=0 || Math.abs(origin.y)>1.2)return false;
  world.camera.getWorldDirection(direction).applyQuaternion(inverse);
  if(direction.z>=-.01)return false;
  const distance=-origin.z/direction.z;
  entry.copy(origin).addScaledVector(direction,distance);
  return distance<=2.45 && Math.abs(entry.x)<=width/2+.09 && Math.abs(entry.y)<=height/2+.09;
 }
 function sound(){
  playSound('disposal');playSound('disposalScrape');
 }
 function clearPainting(){
  busy.mesh.removeFromParent();busy.mesh.geometry.dispose();busy=null;lamp.color.setHex(0x829b66);
 }
 function update(now,playing,carrying){
  if(busy){
   const elapsed=Math.max(0,now-busy.start);
   const approach=Math.min(1,elapsed/260),feed=Math.min(1,Math.max(0,(elapsed-260)/590));
   const slide=feed*feed*(3-2*feed);
   busy.mesh.position.lerpVectors(busy.from,busy.mouth,approach*approach*(3-2*approach));
   busy.mesh.position.z-=slide*(busy.length+.45);
   busy.mesh.quaternion.slerpQuaternions(busy.rotation,feedingRotation,approach);
   if(feed===1)clearPainting();
  }
  if(!playing||!targeted())return null;
  if(busy)return text('Картина уходит в приёмник…','Feeding painting…');
  if(!carrying)return text('Поднесите картину с золотым ключом','Bring a golden-key painting');
  return isApprovedKeynlock(carrying.painting)
   ?text('E или клик — вставить картину','E or click — insert painting')
   :text('Приёмник принимает только картины Кеййнлока','The receiver accepts only Keynlock paintings');
 }
 function interact(slot,pose,onInsert){
  if(!slot || !targeted())return false;
  if(busy)return true;
  if(!isApprovedKeynlock(slot.painting)){
   playSound('deny');
   notify(text('Эту картину приёмник не принимает','This painting cannot be inserted'));return true;
  }
  const result=state.commit([slot]);
  if(!result){notify(text('Не удалось сохранить утилизацию. Картина осталась у вас.','Could not save disposal. You are still carrying the painting.'));return true;}
  if(!result.accepted.length)return true;
  const settings=display?.renderSettings??config.paintings,dimensions=frameDimensions(slot,settings);
  const detailed=Boolean(display?.atlas);
  const geometry=detailed
   ?overviewGeometry(THREE,[{...slot,x:0,y:0,z:0,normal:{x:0,z:1},floorAngle:undefined}],display.atlas,settings)
   :new THREE.BoxGeometry(dimensions.width,dimensions.height,dimensions.depth);
  const mesh=new THREE.Mesh(geometry,detailed?face:trim);
  const mouth=new THREE.Vector3(0,0,.25+dimensions.height/2);
  const from=pose?root.worldToLocal(pose.position.clone()):mouth.clone();
  const rotation=pose?pose.quaternion.clone().premultiply(inverse):feedingRotation;
  mesh.position.copy(from);mesh.quaternion.copy(rotation);root.add(mesh);
  busy={start:performance.now(),mesh,length:dimensions.height,from,mouth,rotation};lamp.color.setHex(0xc89244);
  onInsert();onDisposed([slot.painting.id]);sound();
  notify(text('✓ Утилизировано: ','✓ Disposed: ')+(total===undefined?state.count:state.count+'/'+total));
  return true;
 }
 return {has:state.has,update,interact,dispose(){
  if(busy)clearPainting();root.removeFromParent();
  root.traverse(mesh=>{if(!mesh.userData.inkOutlineShell)mesh.geometry?.dispose();});
  for(const material of [metal,trim,dark,lamp,face])material.dispose();
 }};
}
