(function(){
  'use strict';

  const SCHEMA_KEY='keynlockSaveSchema';
  const CURRENT_SCHEMA=1;
  const memory=new Map();
  let storage=null;
  try{
    storage=window.localStorage;
    const probe='__keynlock_storage_probe__';
    storage.setItem(probe,'1');
    storage.removeItem(probe);
  }catch(_){storage=null;}

  const raw={
    getItem:key=>storage?storage.getItem(key):(memory.has(key)?memory.get(key):null),
    setItem:(key,value)=>storage?storage.setItem(key,String(value)):memory.set(key,String(value)),
    removeItem:key=>storage?storage.removeItem(key):memory.delete(key),
    key:index=>storage?storage.key(index):[...memory.keys()][index]??null,
    get length(){return storage?storage.length:memory.size;}
  };

  function getJSON(key,fallback=null){
    try{
      const value=raw.getItem(key);
      return value===null?fallback:JSON.parse(value);
    }catch(_){return fallback;}
  }
  function setJSON(key,value){raw.setItem(key,JSON.stringify(value));}
  function keys(){return Array.from({length:raw.length},(_,index)=>raw.key(index)).filter(Boolean);}
  function snapshot(predicate=()=>true){
    return Object.fromEntries(keys().filter(predicate).map(key=>[key,raw.getItem(key)]));
  }
  function restore(values,{clear=()=>false}={}){
    keys().filter(clear).forEach(key=>raw.removeItem(key));
    Object.entries(values||{}).forEach(([key,value])=>raw.setItem(key,value));
  }

  const migrations={
    1(){
      const resources=getJSON('keynlockResources');
      if(resources&&typeof resources==='object'&&!resources.components)resources.components={};
      if(resources)setJSON('keynlockResources',resources);
    }
  };
  let version=Math.max(0,Number(raw.getItem(SCHEMA_KEY))||0);
  while(version<CURRENT_SCHEMA){
    version++;
    migrations[version]?.();
    raw.setItem(SCHEMA_KEY,String(version));
  }

  window.KeynlockSaveStore=Object.freeze({
    schemaVersion:CURRENT_SCHEMA,
    persistent:!!storage,
    getItem:raw.getItem,
    setItem:raw.setItem,
    removeItem:raw.removeItem,
    key:raw.key,
    get length(){return raw.length;},
    getJSON,setJSON,keys,snapshot,restore
  });
})();
