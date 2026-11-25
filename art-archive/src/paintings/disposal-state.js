import {STORAGE_KEYS,readJson,writeJson} from '../persistence/storage.js';
export const DISPOSAL_KEY=STORAGE_KEYS.disposal;
export const LEGACY_DISPOSAL_SUPPORT='table-disposal';
export const isApprovedKeynlock=painting=>painting.collection==='keynlock'&&painting.censorship?.status==='approved';
export function disposalIds(debug=false){return new Set(readJson(DISPOSAL_KEY+(debug?'-debug':''),{}).destroyed??[]);}
export function createDisposalState({debug=false,read=readJson,write=writeJson}={}){
 const key=DISPOSAL_KEY+(debug?'-debug':''),stored=read(key,{});
 let destroyed=new Set(Array.isArray(stored.destroyed)?stored.destroyed.filter(id=>typeof id==='string'):[]);
 return {
  has:id=>destroyed.has(id),ids:()=>new Set(destroyed),get count(){return destroyed.size;},
  commit(slots){
   const accepted=slots.filter(s=>isApprovedKeynlock(s.painting)&&!destroyed.has(s.painting.id));
   const next=new Set([...destroyed,...accepted.map(s=>s.painting.id)]);
   if(!accepted.length)return {accepted:[],rejected:slots.length};
   if(!write(key,{version:1,destroyed:[...next]}))return null;
   destroyed=next;return {accepted,rejected:slots.length-accepted.length};
  }
 };
}
