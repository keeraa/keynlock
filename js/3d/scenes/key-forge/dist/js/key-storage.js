import { KEY_TEMPLATES, defaultDesign, normalizeKeyDesign } from './key-data.js';

export const STORAGE_KEY='keynlock-key-forge-1118-v1';
export const DESIGN_PARAMETERS=['shaftLength','headSize','teeth','cutDepth','thickness','rustAmount','breakAngle'];

// All older collections stay readable. Metals stored before the lock-in are
// migrated to the permanent metal assigned to that silhouette.
export function parseCollection(raw) {
  let data;
  try { data=typeof raw==='string'?JSON.parse(raw):raw; }
  catch { return Array(KEY_TEMPLATES.length).fill(null); }
  if(!Array.isArray(data))return Array(KEY_TEMPLATES.length).fill(null);
  return KEY_TEMPLATES.map((_,i)=>{
    const existing=data[i];
    if(!existing||existing.template!==i)return null;
    const base=defaultDesign(i);
    for(const key of [...DESIGN_PARAMETERS,'dirtAmount']) {
      if(['rustAmount','dirtAmount','breakAngle'].includes(key)&&existing[key]===undefined)continue;
      if(!Number.isFinite(existing[key]))return null;
    }
    return normalizeKeyDesign({...base,...existing,template:i});
  });
}

export function loadCollection(storage) {
  try { return parseCollection(storage.getItem(STORAGE_KEY)); }
  catch { return Array(KEY_TEMPLATES.length).fill(null); }
}

export function persistCollection(storage,collection) {
  storage.setItem(STORAGE_KEY,JSON.stringify(collection));
}
