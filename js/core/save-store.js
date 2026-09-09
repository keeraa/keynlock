(function(){
  'use strict';

  const SCHEMA_KEY='keynlockSaveSchema';
  const CURRENT_SCHEMA=2;
  // Legacy IDs are confined to save compatibility; new game content uses original names.
  const legacyModes=Object.freeze({
    hillsfar:'keyprofile',g1:'turnmemory',skyrim:'workingangle',anach:'signalbalance',
    oblivion:'pinflight',watchmen:'springtumblers',mass2:'pairednodes',thiefds:'ringsecret',
    kingdomcome:'cylinderpath',thief12:'soundlatch',fallout:'torqueangle',masshack:'ringpassage',
    pathologic:'twinbalance',bioshock2:'timingneedle',alphaprotocol:'symbolpins'
  });
  const legacyReference=new RegExp(`(^|[-/:])(${Object.keys(legacyModes).join('|')})(?=$|[-/.:])`,'g');
  function migrateReference(value){
    // Only identifiers and asset paths, never free-form player text.
    return /^[a-zA-Z0-9_./:-]+$/.test(value)?value.replace(legacyReference,(_,prefix,id)=>prefix+legacyModes[id]):value;
  }
  function migrateValue(value){
    if(Array.isArray(value))return value.map(migrateValue);
    if(value&&typeof value==='object'){
      const entries=Object.entries(value);
      // If both forms exist, the already-current key takes precedence.
      entries.sort(([a],[b])=>Number(migrateReference(a)===a)-Number(migrateReference(b)===b));
      return Object.fromEntries(entries.map(([key,item])=>[migrateReference(key),migrateValue(item)]));
    }
    if(typeof value==='string'){
      // Save slots embed a snapshot whose JSON values are themselves serialized.
      if(/^[\s]*[\[{]/.test(value))try{return JSON.stringify(migrateValue(JSON.parse(value)));}catch(_){}
      return migrateReference(value);
    }
    return value;
  }
  function migrateSnapshot(values){
    return Object.fromEntries(Object.entries(values||{}).map(([key,value])=>
      [key,/^(keynlock|lockpick)/.test(key)?migrateValue(value):value]));
  }
  const memory=new Map();
  const removed=new Set();
  let storage=null;
  let persistent=false;
  function readStorage(){
    const entries=[];
    for(let i=0;i<storage.length;i++){
      const key=storage.key(i);
      if(key!==null)entries.push([key,storage.getItem(key)]);
    }
    return entries;
  }
  function notify(){window.dispatchEvent?.(new Event('keynlock-storage-change'));}
  function fail(){
    const changed=persistent;
    persistent=false;
    if(changed)notify();
  }
  try{
    storage=window.localStorage;
    // Read before probing: full storage can still contain a valid old save.
    for(const [key,value] of readStorage())memory.set(key,value);
    const probe='__keynlock_storage_probe__';
    storage.setItem(probe,'1');storage.removeItem(probe);
    persistent=true;
  }catch(_){persistent=false;}

  function sync(){
    if(!persistent)return;
    try{
      const entries=readStorage();
      memory.clear();
      for(const [key,value] of entries)memory.set(key,value);
    }catch(_){fail();}
  }
  const raw={
    getItem(key){
      if(persistent)try{
        const value=storage.getItem(key);
        if(value===null)memory.delete(key);else memory.set(key,value);
        return value;
      }catch(_){fail();}
      return memory.has(key)?memory.get(key):null;
    },
    setItem(key,value){
      const text=String(value);
      memory.set(key,text);removed.delete(key);
      if(persistent)try{if(storage.getItem(key)!==text)storage.setItem(key,text);}catch(_){fail();}
      return persistent;
    },
    removeItem(key){
      memory.delete(key);removed.add(key);
      if(persistent)try{storage.removeItem(key);removed.delete(key);}catch(_){fail();}
      return persistent;
    },
    key(index){sync();return [...memory.keys()][index]??null;},
    get length(){sync();return memory.size;}
  };
  function getJSON(key,fallback=null){
    try{const value=raw.getItem(key);return value===null?fallback:JSON.parse(value);}catch(_){return fallback;}
  }
  function setJSON(key,value){return raw.setItem(key,JSON.stringify(value));}
  function keys(){sync();return [...memory.keys()];}
  function snapshot(predicate=()=>true){
    return Object.fromEntries(keys().filter(predicate).map(key=>[key,raw.getItem(key)]));
  }
  function restore(values,{clear=()=>false}={}){
    keys().filter(clear).forEach(key=>raw.removeItem(key));
    Object.entries(migrateSnapshot(values)).forEach(([key,value])=>raw.setItem(key,value));
    migrate();
    return persistent;
  }
  function retry(){
    if(persistent)return true;
    try{
      storage=window.localStorage;
      for(const key of removed)storage.removeItem(key);
      for(const [key,value] of memory)if(storage.getItem(key)!==value)storage.setItem(key,value);
      removed.clear();persistent=true;notify();return true;
    }catch(_){return false;}
  }

  const migrations={
    1(){
      const resources=getJSON('keynlockResources');
      if(resources&&typeof resources==='object'&&!resources.components)resources.components={};
      if(resources)setJSON('keynlockResources',resources);
    },
    2(){Object.entries(migrateSnapshot(snapshot())).forEach(([key,value])=>raw.setItem(key,value));}
  };
  function migrate(){
    let version=Math.max(0,Number(raw.getItem(SCHEMA_KEY))||0);
    while(version<CURRENT_SCHEMA){version++;migrations[version]?.();raw.setItem(SCHEMA_KEY,String(version));}
  }
  migrate();

  window.KeynlockSaveStore=Object.freeze({
    schemaVersion:CURRENT_SCHEMA,
    get persistent(){return persistent;},
    getItem:raw.getItem,setItem:raw.setItem,removeItem:raw.removeItem,key:raw.key,
    get length(){return raw.length;},
    getJSON,setJSON,keys,snapshot,restore,retry
  });
})();
