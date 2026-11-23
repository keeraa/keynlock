import {createVillageCumulus} from './village-cumulus.js';
import {normaliseNatureVariant} from './village-nature-variant-settings.js';
// Generic wind-aligned sky field. The host supplies its center and existing clock.
export function createVillageCloudField(THREE,{scene,camera,tsl=null,settings={},center={x:0,z:0},seed=37}={}){
 if(!scene||!camera)throw Error('Cloud field needs an existing scene and camera');
 if(!Number.isFinite(center?.x)||!Number.isFinite(center?.z)||!Number.isFinite(seed))throw Error('Invalid cloud field origin or seed');center={x:center.x,z:center.z};
 const group=new THREE.Group();group.name='Wind-driven cumulus field';scene.add(group);
 const wind=new THREE.Vector2(1,0),fadeCache=new WeakMap();let config=normaliseNatureVariant('cumulus',settings),layers=[],arrivals=0,disposed=false,elapsed=0,lighting={};
 function populate(){for(const layer of layers)layer.dispose();layers=[];
  const side=Math.ceil(Math.sqrt(config.count)),spacing=210/Math.max(1,side-1);
  for(let i=0;i<config.count;i++){
   const x=(i%side-(side-1)/2)*spacing+Math.sin(i*1.7)*10,z=(Math.floor(i/side)-(side-1)/2)*spacing+Math.cos(i*.9)*7;
   const layer=createVillageCumulus(THREE,{scene:group,camera,tsl,height:config.height-2+i%4*2,seed:seed+i*31,speed:0,quality:config.quality});
   layer.group.position.set(center.x+x,0,center.z+z);layer.group.children[0].scale.set((18+i%5*3.5)*config.scale,(7+i%3*1.5)*config.scale,(12+i%4*2.5)*config.scale);layers.push(layer);
  }
  apply();
 }
 function apply(){const angle=config.direction*Math.PI/180;wind.set(Math.cos(angle),Math.sin(angle));for(const layer of layers)layer.configure({quality:config.quality,coverage:config.coverage*.8,sunColor:config.sunColor,shadeColor:config.shadeColor,...lighting});}
 function configure(next={}){if(disposed)return;const previous=config;config=normaliseNatureVariant('cumulus',{...config,...next});if(['count','height','scale'].some(k=>config[k]!==previous[k]))populate();else apply();}
 function update(dt=0){if(disposed)return;dt=Number.isFinite(dt)?Math.max(0,dt):0;elapsed+=dt;const travel=dt*config.wind*config.speed*1.8;
  for(const layer of layers){const p=layer.group.position,dx=p.x-center.x,dz=p.z-center.z,along=dx*wind.x+dz*wind.y+travel,cross=-dx*wind.y+dz*wind.x;let next=along,lane=cross;
   if(next>126||next< -126){arrivals+=Math.abs(Math.floor((next+126)/252));next=((next+126)%252+252)%252-126;}
   if(lane>126||lane< -126)lane=((lane+126)%252+252)%252-126;
   if(travel>0||next!==along||lane!==cross){p.x=center.x+next*wind.x-lane*wind.y;p.z=center.z+next*wind.y+lane*wind.x;}
   const fade=Math.min(1,Math.max(0,(126-Math.abs(next))/18),Math.max(0,(126-Math.abs(lane))/18));
   if(Math.abs((fadeCache.get(layer)??-1)-fade)>.001){layer.configure({extinction:12*fade});fadeCache.set(layer,fade);}layer.update(dt);
  }
 }
 populate();
 return {group,configure,setCenter(next){if(Number.isFinite(next?.x)&&Number.isFinite(next?.z)){center.x=next.x;center.z=next.z;}},setLighting(next={}){lighting={...lighting,...next};apply();},update,
  snapshot(){return {...layers[0]?.snapshot(),time:elapsed,count:layers.length,arrivals,windDirection:wind.toArray(),settings:{...config},positions:layers.map(layer=>layer.group.position.toArray()),totalFieldBytes:layers.reduce((n,layer)=>n+layer.snapshot().fieldBytes,0)};},
  dispose(){if(disposed)return;disposed=true;for(const layer of layers)layer.dispose();layers=[];group.removeFromParent();}};
}
