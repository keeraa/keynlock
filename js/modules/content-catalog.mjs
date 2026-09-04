import { content, requireService } from './runtime.mjs';

function catalog(){
  return requireService('content',content);
}

export function getPaintings(){
  return catalog().paintings;
}

export function getPainting(id){
  return getPaintings().find(painting=>painting.id===id)??null;
}

export function getDistricts(){
  return Object.values(catalog().world.districts);
}

export function getDistrict(id){
  return catalog().world.districts[id]??null;
}

export function getMissions(){
  return catalog().world.missionPlaces;
}

export function getMission(mode){
  return getMissions().find(mission=>mission.mode===mode)??null;
}

export function getComponents(){
  return catalog().economy.components;
}

export function getLockLoot(){
  return catalog().economy.lockLoot;
}
