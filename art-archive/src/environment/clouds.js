import {shapeCumulus} from './cumulus-shape.js';
import {createVillageCloudField} from '../../vendor/village-cumulus/village-cloud-field.js';
import {normaliseNatureVariant} from '../../vendor/village-cumulus/village-nature-variant-settings.js';
import {CLOUD_DEFAULTS} from '../../config/clouds.js';
export {CLOUD_DEFAULTS} from '../../config/clouds.js';
export function cloudSettings(input={}){
 for(const key of ['sunColor','shadeColor'])if(input[key]!==undefined && !/^#[0-9a-f]{6}$/i.test(input[key]))input={...input,[key]:CLOUD_DEFAULTS[key]};
 if(input.shadeColor==='#778e9a')input={...input,shadeColor:CLOUD_DEFAULTS.shadeColor};
 if(input.sunColor==='#fff3dc')input={...input,sunColor:CLOUD_DEFAULTS.sunColor};
 return {...normaliseNatureVariant('cumulus',{...CLOUD_DEFAULTS,...input}),enabled:typeof input.enabled==='boolean'?input.enabled:CLOUD_DEFAULTS.enabled};}
export function createArchiveClouds({THREE,scene,camera,config,settings={}}){
 let current=cloudSettings(settings),field=null,disposed=false,visible=true;
 const domeTop=config.building.floorElevation+config.building.domeBaseHeight+config.building.radius*.45;
 function apply(){
  if(!current.enabled){field?.dispose();field=null;return;}
  if(!field){field=createVillageCloudField(THREE,{scene,camera,settings:current,center:{x:0,z:0},seed:37});field.group.position.y=domeTop;field.setLighting({sunDirection:new THREE.Vector3(-28,65,24).normalize()});}
  else field.configure(current);
  let index=0;const volumes=[];
  field.group.traverse(o=>{
    if(!o.isMesh)return;
    if(!o.userData.archiveCumulus){shapeCumulus(o,37+index*31);o.userData.archiveCumulus=true;}
    volumes.push(o);index++;
  });
  // The player remains below this sky layer. Composite its upper volumes first.
  // Distinct world-stable orders prevent transparent object sorting from swapping
  // overlapping volumes whenever their camera-space centres exchange depth.
  volumes.sort((a,b)=>(b.position.y-b.scale.y/2)-(a.position.y-a.scale.y/2) || b.id-a.id);
  volumes.forEach((mesh,i)=>{mesh.renderOrder=-1000+i;});
  field.group.visible=visible;
 }
 apply();
 return {setVisible(value){visible=Boolean(value);if(field)field.group.visible=visible;},configure(next){if(disposed)return;current=cloudSettings({...current,...next});apply();},update(dt){if(!disposed&&field)field.update(dt);},
  snapshot(){return {enabled:current.enabled,settings:{...current},domeTop,...(field?.snapshot()??{count:0,totalFieldBytes:0})};},
  dispose(){if(disposed)return;disposed=true;field?.dispose();field=null;}};
}
