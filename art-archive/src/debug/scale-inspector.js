import {t,getLanguage,localizeDocument} from '../localization/i18n.js';
// Optional measurement overlay. Rays inspect the rendered, batched building.
export function createScaleInspector({THREE,scene,camera,building,layout,config}){
 const group=new THREE.Group();group.name='scale-reference';group.position.y=config.building.floorElevation;group.visible=false;scene.add(group);
 const resources=new Set(),labels=new Map(),labelUpdates=[];let built=false,enabled=false,lastUpdate=0;
 const panel=document.createElement('aside');panel.id='scale-inspector';panel.hidden=true;panel.setAttribute('aria-label','Проверка масштаба');document.body.append(panel);
 function label(text){
  if(!labels.has(text)){
   const c=document.createElement('canvas');c.width=512;c.height=96;const ctx=c.getContext('2d');ctx.fillStyle='#15332f';ctx.fillRect(0,0,512,96);ctx.fillStyle='#fff0bc';ctx.font='bold 46px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';const draw=()=>{ctx.fillStyle='#15332f';ctx.fillRect(0,0,512,96);ctx.fillStyle='#fff0bc';ctx.fillText(getLanguage()==='en'?text.replace('Стена','Wall').replace('глаза','eye level').replace(/ м/g,' m'):text,256,48);if(texture)texture.needsUpdate=true;};
   let texture;draw();labelUpdates.push(draw);
   texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;const material=new THREE.SpriteMaterial({map:texture,depthTest:true,transparent:true});labels.set(text,material);resources.add(texture);resources.add(material);
  }
  const sprite=new THREE.Sprite(labels.get(text));sprite.scale.set(1.3,.245,1);return sprite;
 }
 function build(){
  if(built)return;built=true;const lineMaterial=new THREE.LineBasicMaterial({color:0xffd575});resources.add(lineMaterial);
  for(const h of layout.halls){
   const hall=new THREE.Group();hall.rotation.y=h.angle;group.add(hall);const z=h.start+h.length-.34;
   // One vertical ruler at the crown, using the configured ceiling height.
   const points=[0,0,z,0,config.building.height,z];
   for(let metre=0;metre<=config.building.height;metre++){
    points.push(-.14,metre,z,.14,metre,z);const sprite=label(metre+' м');sprite.position.set(.75,metre===0?.13:metre===config.building.height?metre-.16:metre,z);hall.add(sprite);
   }
   // A horizontal eye-level stripe lets a level camera be checked against the wall.
   points.push(-h.width/2+.3,1.78,z,h.width/2-.3,1.78,z);
   const eye=label('1,78 м · глаза');eye.scale.set(2.1,.28,1);eye.position.set(-1.35,1.78,z);hall.add(eye);
   const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(points,3));resources.add(geometry);hall.add(new THREE.LineSegments(geometry,lineMaterial));
   // Side-wall rulers explicitly show the lower spring line of the barrel vault.
   for(const side of [-1,1]){
    const x=side*(h.width/2-.2),p=[x,0,z-4,x,config.building.height-config.building.vaultRise,z-4];
    for(let metre=0;metre<=config.building.height-config.building.vaultRise;metre++)p.push(x,metre,z-4-.14,x,metre,z-4+.14);
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));resources.add(g);hall.add(new THREE.LineSegments(g,lineMaterial));
    const wallHeight=config.building.height-config.building.vaultRise;
    const text=label('Стена '+String(wallHeight).replace('.',',')+' м');text.scale.set(1.65,.28,1);text.position.set(side*(h.width/2-1.1),wallHeight-.14,z-4);hall.add(text);
   }
  }
 }
 const ray=new THREE.Raycaster(),origin=new THREE.Vector3(),normal=new THREE.Vector3(),down=new THREE.Vector3(0,-1,0);
 const deg=r=>THREE.MathUtils.radToDeg(r).toFixed(1).replace('.',',');
 const metres=n=>n.toFixed(2).replace('.',',');
 function update(now){
  if(!enabled||now-lastUpdate<150)return;lastUpdate=now;camera.updateMatrixWorld(true);building.root.updateMatrixWorld(true);
  camera.getWorldPosition(origin);ray.set(origin,down);ray.far=15;const floor=ray.intersectObject(building.root,true)[0];
  ray.setFromCamera(new THREE.Vector2(0,0),camera);ray.far=100;const hit=ray.intersectObject(building.root,true)[0];
  const direction=camera.getWorldDirection(new THREE.Vector3()),pitch=Math.asin(THREE.MathUtils.clamp(direction.y,-1,1));
  let target='нет поверхности';if(hit){normal.copy(hit.face.normal).transformDirection(hit.object.matrixWorld);const type=Math.abs(normal.y)<.4?'стена':normal.y>.4?'пол':'потолок';target=type+' · '+metres(hit.point.y-(floor?.point.y??config.building.floorElevation))+' м';}
  panel.innerHTML='<strong>Проверка масштаба · F2</strong><br>Камера над полом: '+(floor?metres(origin.y-floor.point.y):'—')+' м<br>Наклон взгляда: '+deg(pitch)+'°<br>Прицел: '+target+'<br>FOV: '+camera.fov+'° по вертикали<br><small>L — выровнять взгляд. Линейки — на торцах залов.</small>';
  localizeDocument(panel);
  if(getLanguage()==='en'){for(const node of [...panel.childNodes])if(node.nodeType===3)node.textContent=node.textContent.replace('Камера над полом:','Camera above floor:').replace('Наклон взгляда:','View pitch:').replace('Прицел:','Aim:').replace('стена','wall').replace('потолок','ceiling').replace('пол','floor').replace('по вертикали','vertical').replace(/ м/g,' m');}
  panel.dataset.measurement=JSON.stringify({eyeAboveFloor:floor?origin.y-floor.point.y:null,pitchDeg:THREE.MathUtils.radToDeg(pitch),aimAboveFloor:hit?hit.point.y-(floor?.point.y??config.building.floorElevation):null,aimType:hit?target:null,fov:camera.fov});
 }
 return {update,refreshLanguage(){for(const draw of labelUpdates)draw();},toggle(){enabled=!enabled;if(enabled)build();group.visible=enabled;panel.hidden=!enabled;lastUpdate=0;return enabled;},dispose(){group.removeFromParent();panel.remove();for(const r of resources)r.dispose();}};
}
