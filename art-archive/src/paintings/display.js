import {createPaintingProps} from './props.js';
import {createDetailStream} from '../rendering/detail-stream.js';
import {hiddenFloorFaces} from './floor-drop.js';
import {createGouache} from './gouache.js';
import {wallAtRay,frameAtRay} from './hanging.js';
import {createOverview} from './overview.js';
import {createPaintingObject, PaintingTexturePool} from '../../catalog/three-painting.js';
import {frameDimensions,frameOrientation} from '../../catalog/painting-geometry.js';

export function createPaintingDisplay({THREE, world, renderer, catalog, config,onAim}) {
  const settings = {...config.paintings,hallColors:{center:'#d8b766',...Object.fromEntries((config.halls??[]).map(h=>[h.id,h.color]))}}, camera = world.camera;
  const group = new THREE.Group();
  group.position.y = config.building.floorElevation;
  world.scene.add(group);
  const rooms = new Map(),props=createPaintingProps(THREE,settings),extras=new Map();
  const roomOf = slot=>slot.floorRoom ?? slot.wall.hall;
  const isVisible = id=>!world.visibleHalls || world.visibleHalls.has(id);
  function roomGroup(id) {
    if (!rooms.has(id)) {
      const room = new THREE.Group();
      room.visible = isVisible(id);
      group.add(room); rooms.set(id,room);
    }
    return rooms.get(id);
  }
  function syncVisibility(viewCamera=camera) {
    overview?.updateVisibility(viewCamera,world.visibleHalls);
    for (const [id,room] of rooms) room.visible=isVisible(id);
  }
  const gouache = createGouache(THREE);
  const overview = catalog.overviewAtlas && createOverview(THREE,group,catalog.overviewAtlas,settings,gouache,world.ink,world.layout,config.building.wallBays);
  const stream=createDetailStream(THREE,renderer);
  const pool = new PaintingTexturePool({idleBytes:64*1024*1024}), resident = new Map();
  const direction = new THREE.Vector3();
  const frustum = new THREE.Frustum(), projection = new THREE.Matrix4(), center = new THREE.Vector3();
  let slots = [], last = -Infinity, focusId = null;
  let queue = [], nextPreview = 0, loadingPreview = false;
  let highPriority = [];
  const loadingHigh = {local:0,remote:0};
  function discard(entry) {
    entry.view?.object.removeFromParent();
    entry.view?.dispose();
  }
  function position(view, slot) {
    (slot.painting.id===focusId ? group : roomGroup(roomOf(slot))).add(view.object);
    view.object.position.set(slot.x,slot.y,slot.z);
    const {pitch,yaw}=frameOrientation(slot);view.object.rotation.set(pitch,yaw,0,'YXZ');
    view.object.userData.hall = slot.wall.hall;
    view.object.userData.wall = slot.wall.theme;
  }
  let hiddenFaces = new Set();
  function setSlots(next,byRoom=false,changedRoom=null) {
    const affected=changedRoom===null?next:next.filter(s=>roomOf(s)===changedRoom);
    const hidden=hiddenFloorFaces(affected,settings);
    if(changedRoom===null)hiddenFaces=hidden;
    else {
      for(const slot of hiddenFaces)if(roomOf(slot)===changedRoom)hiddenFaces.delete(slot);
      for(const slot of hidden)hiddenFaces.add(slot);
    }
    overview?.setSlots(affected,hiddenFaces,byRoom,changedRoom);
    syncVisibility();
    slots = next; last = -Infinity;
    world.navigation?.setPaintingObstacles(next);
    const byId = new Map(next.map(slot=>[slot.painting.id, slot]));
    for(const [id,entry] of extras)if(byId.get(id)!==entry.slot){entry.object.removeFromParent();extras.delete(id);}
    for(const slot of next){
      const id=slot.painting.id;
      if(extras.has(id) || (!slot.trolley && slot.destination?.split('/')[0]!=='center'))continue;
      const object=new THREE.Group();
      if(slot.trolley)object.add(props.cart(slot));
      if(slot.destination?.split('/')[0]==='center')object.add(props.badge(slot));
      position({object},slot);extras.set(id,{slot,object});
    }
    for (const [id,entry] of resident) {
      const slot = byId.get(id);
      if (!slot || hiddenFaces.has(slot) || slot.height !== entry.slot.height) {
        discard(entry); resident.delete(id);
      } else {
        if(entry.slot===slot)continue;
        entry.slot = slot;
        if (entry.view) position(entry.view,slot);
      }
    }
  }
  function aimedSlot(){
    camera.getWorldDirection(direction);
    const origin={x:camera.position.x,y:camera.position.y-group.position.y,z:camera.position.z};
    const hit=wallAtRay(origin,direction,world.layout?.walls??[],config.building.height,camera.far);
    return frameAtRay(origin,direction,slots,settings,hit?.distance??camera.far);
  }
  async function detail(painting, highResolution=true,destination=null){
    const view = await createPaintingObject({THREE, painting, imageUrl:catalog.imageUrl(painting.id),detailUrl:catalog.detailUrl?.(painting.id),pool,gouache,loadDetail:stream?.load,
      frameWidthM:settings.frameWidthM,frameDepthM:settings.frameDepthM,
      frameHallColor:settings.hallColors[destination?.split('/')[0]??painting.placement.hall]});
    if(highResolution) view.setDetail(true);
    return view;
  }
  function rank(now, gameplayAim) {
    camera.updateWorldMatrix(true,false);
    frustum.setFromProjectionMatrix(projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
    last = now;
    const aimed = gameplayAim ? gameplayAim() : aimedSlot();
    if ((aimed?.painting.id ?? null) !== focusId) {
      focusId = aimed?.painting.id ?? null;
    }
    const pixelHeight = (globalThis.innerHeight || 800) * Math.min(globalThis.devicePixelRatio || 1, 1.5);
    const focalPixels = pixelHeight / (2 * Math.tan(camera.fov * Math.PI / 360));
    const nearby = [];
    for (const slot of slots) {
      const focused=slot===aimed;
      if (!focused && (!isVisible(roomOf(slot)) || hiddenFaces.has(slot))) continue;
      const dx = slot.x - camera.position.x, dz = slot.z - camera.position.z;
      const existing = resident.has(slot.painting.id);
      const dy = slot.y + group.position.y - camera.position.y;
      const {floor,c,s}=frameOrientation(slot),size=frameDimensions(slot,settings);
      const halfWidth = size.width/2, halfHeight = size.height/2;
      const visibleSide = floor ? dy < 0 : dx*s + dz*c < .1;
      if (!focused && !visibleSide) continue;
      const across = Math.max(0,Math.abs(dx*c-dz*s)-halfWidth);
      const along = dx*s+dz*c;
      const depth = floor ? dy : along;
      const above = Math.max(0,Math.abs(floor ? along : dy)-halfHeight);
      const distance = Math.max(.1,Math.hypot(across,above,depth));
      if (focused || distance <= settings.loadRadiusM + (existing ? 1 : 0)) {
        center.set(slot.x,slot.y+group.position.y,slot.z);
        // Test the entire oriented canvas, including a visible edge whose centre is off screen.
        const inFrame = frustum.planes.every(plane=>{
          const n=plane.normal;
          const extent=halfWidth*Math.abs(n.x*c-n.z*s)+halfHeight*Math.abs(floor ? n.x*s+n.z*c : n.y);
          return plane.distanceToPoint(center)+extent+.02>=0;
        });
        if(!focused && !inFrame)continue;
        const image=slot.painting.image;
        const density=focalPixels/distance*Math.max(slot.width/image.widthPx,slot.height/image.heightPx);
        const detailPriority=image.detail?.path ? (focused ? Infinity : density*(highPriority.includes(slot.painting.id)?1.12:1)) : 0;
        nearby.push({slot,priority:focused ? -1 : distance,detailPriority});
      }
    }
    nearby.sort((a,b) => a.priority-b.priority);
    const wanted = new Map(nearby.slice(0,settings.maxLoaded).map(({slot})=>[slot.painting.id,slot]));
    for (const [id,entry] of resident) {
      if (!wanted.has(id)) { discard(entry); resident.delete(id); }
    }
    highPriority = nearby.filter(item=>item.detailPriority >= .48 && wanted.has(item.slot.painting.id))
      .sort((a,b)=>b.detailPriority-a.detailPriority).slice(0,3).map(item=>item.slot.painting.id);
    for (const [id,entry] of resident) {
      if(entry.view){
        const parent=id===focusId ? group : roomGroup(roomOf(entry.slot));
        if(entry.view.object.parent!==parent)parent.add(entry.view.object);
      }
      if (!highPriority.includes(id) && entry.high) {
        entry.view.setDetail(false); entry.high=false;
      }
    }
    const prioritized=new Set(highPriority);
    queue = Array.from(wanted.values()).filter(slot=>{
      const entry=resident.get(slot.painting.id);
      return !entry || (entry.attempts<4 && entry.retryAt<=now);
    })
      .sort((a,b)=>Number(prioritized.has(b.painting.id))-Number(prioritized.has(a.painting.id)));
    nextPreview = 0;
    onAim(aimed);
  }

  function update(now, gameplayAim) {
    stream?.update();
    if (now-last >= 90) rank(now,gameplayAim);
    // Start detail as soon as the preview exists, with separate local and network budgets.
    for (const id of highPriority) {
      const entry = resident.get(id);
      if (!entry?.view || (id!==focusId && !isVisible(roomOf(entry.slot))) || (entry.high && now < entry.recheck)) continue;
      // A slow museum server must not block works that are available locally.
      const source = entry.slot.painting.image.detail?.path?.startsWith('detail/') ? 'local' : 'remote';
      if (loadingHigh[source]>=2) continue;
      entry.high = true;
      entry.recheck = now + 121000;
      const job = entry.view.setDetail(true);
      if (job) {
        loadingHigh[source]++;
        job.finally(()=>loadingHigh[source]--);
      }
    }
    if (loadingPreview || nextPreview >= queue.length) return;
    const slot = queue[nextPreview++], id = slot.painting.id;
    if (id!==focusId && !isVisible(roomOf(slot))) return;
    const entry = {slot, high:false,attempts:(resident.get(id)?.attempts??0)+1};
    resident.set(id,entry);
    loadingPreview = true;
    detail(slot.painting,false,slot.destination).then(view=>{
      if (resident.get(id)!==entry) { view.dispose(); return; }
      entry.view=view;
      position(view,entry.slot);
    }).catch(error=>{entry.retryAt=performance.now()+500*2**(entry.attempts-1);console.warn('Painting unavailable',id,error);}).finally(()=>{loadingPreview=false;});
  }
  return {gouache,renderSettings:settings,syncVisibility,setSlots,update,aimedSlot,detail,atlas:catalog.overviewAtlas,texture:overview?.texture,dispose(){setSlots([]); stream?.dispose(); pool.disposeAll(); overview?.dispose(); gouache.dispose(); props.dispose(); group.removeFromParent();}};
}
