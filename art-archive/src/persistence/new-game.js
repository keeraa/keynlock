import {STORAGE_KEYS} from './storage.js';

export function resetArchiveProgress(storage,debug=false){
 const suffix=debug?'-debug':'';
 const reset=[
  [STORAGE_KEYS.hanging+suffix,'{}'],
  [STORAGE_KEYS.disposal+suffix,'{}'],
  [STORAGE_KEYS.tutorial+suffix,''],
 ];
 const previous=[];
 try{
  for(const [key,empty] of reset){
   const value=storage.getItem(key);
   storage.setItem(key,empty);
   previous.push([key,value]);
  }
  return true;
 }catch{
  for(const [key,value] of previous.reverse()){
   if(value===null)storage.removeItem(key);
   else storage.setItem(key,value);
  }
  return false;
 }
}
