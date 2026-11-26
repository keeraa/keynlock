import {STORAGE_KEYS,readJson,writeJson} from '../persistence/storage.js';
import {LEGACY_DISPOSAL_SUPPORT} from './disposal-state.js';
import {placedSlot,wallRange} from './hanging.js';
import {settleTrolley} from './floor-drop.js';

export function createPlacementSave({debug,layout,config,wallSettings,onError}){
  const key=STORAGE_KEYS.hanging+(debug?'-debug':'');
  const legacyFreeKey=STORAGE_KEYS.hanging+'-free'+(debug?'-debug':'');
  const fallback=debug?readJson(STORAGE_KEYS.hanging,{}):{};
  const walls=new Map(layout.hangingWalls.map(wall=>[wall.id,wall]));
  const legacyWalls=new Map(layout.walls.map(wall=>[wall.id,wall]));
  const tables=new Map(layout.storageTables?.map(table=>[table.id,table]));
  // Keep older free-mode placements when no shared record exists for that work.
  let records={...readJson(legacyFreeKey,{}),...readJson(key,fallback)};

  function lookup(id){return records[id];}

  function save(id,record){
    const latest={...records,...readJson(key,{}),[id]:{version:3,...record}};
    if(!writeJson(key,latest)){onError();return false;}
    records=latest;
    return true;
  }

  function physicalWall(wall){
    return walls.get(wall.id)??walls.get(wall.hall+'/side/'+wall.id.split('/')[1]);
  }

  function restoreWall(slot,occupied){
    const saved=lookup(slot.painting.id);
    if(!saved?.wall)return null;
    const legacy=saved.version!==3&&legacyWalls.get(saved.wall);
    const wall=legacy?physicalWall(legacy):walls.get(saved.wall);
    // Mode rules apply to new placements, never to paintings already installed.
    if(!wall)return null;
    const limits=wallSettings(wall);
    let along=saved.along;
    if(legacy){
      along+=(saved.version===2?0:legacy.legacyAlongShift??0)+
        ((legacy.a.x-wall.a.x)*(wall.b.x-wall.a.x)+(legacy.a.z-wall.a.z)*(wall.b.z-wall.a.z))/wall.length;
    }
    if(Number.isFinite(along)){
      const range=wallRange(wall,limits);
      const min=range.min+slot.width/2,max=range.max-slot.width/2;
      along=max>=min?Math.max(min,Math.min(max,along)):(min+max)/2;
    }
    return placedSlot(slot,wall,along,saved.y,limits,occupied);
  }

  function restorePortable(slot){
    const saved=lookup(slot.painting.id);
    if(!saved || (saved.destination && saved.destination!==slot.destination))return null;
    const {kind,yaw,floorAngle,faceDown,floorRoom}=saved;
    let {x,y,z,supportId}=saved;
    if(![x,y,z].every(Number.isFinite))return null;
    if(kind==='trolley'&&Number.isFinite(yaw)){
      const normal={x:Math.sin(yaw),z:Math.cos(yaw)};
      return settleTrolley({...slot,trolley:true,x,z,y,normal,floorRoom},layout,config);
    }
    if(kind!=='floor'||!Number.isFinite(floorAngle))return null;
    const table=tables.get(supportId);
    if(table){
      // Early table saves used world coordinates when the tables stood at 4.25 m.
      const [dx,dz]=saved.tableOffset??[x-4.25*Math.sin(table.angle),z-4.25*Math.cos(table.angle)];
      x=table.x+dx;z=table.z+dz;
    }
    if(supportId===LEGACY_DISPOSAL_SUPPORT){
      y=-config.building.stair.depth;supportId='lower-landing';
    }
    return {...slot,x,z,y,floorAngle,leanPitch:undefined,faceDown:faceDown===true,floorRoom,supportId};
  }

  return {
    has:id=>Boolean(lookup(id)),
    wasOnLegacyReceiver:id=>lookup(id)?.supportId===LEGACY_DISPOSAL_SUPPORT,
    physicalWall,restoreWall,restorePortable,
    mount(slot,position=slot){
      return save(slot.painting.id,{wall:position.wall.id,along:position.along,y:position.y});
    },
    park(slot,yaw){
      const {x,y,z,floorRoom,destination}=slot;
      return save(slot.painting.id,{kind:'trolley',destination,x,y,z,yaw,floorRoom});
    },
    placeOnFloor(slot){
      const {x,y,z,floorRoom,floorAngle,supportId,faceDown,destination}=slot;
      const table=tables.get(supportId),tableOffset=table?[x-table.x,z-table.z]:undefined;
      return save(slot.painting.id,{kind:'floor',destination,x,y,z,floorRoom,floorAngle,supportId,faceDown,tableOffset});
    },
  };
}
