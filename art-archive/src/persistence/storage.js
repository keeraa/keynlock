// These keys are stable: refactoring must not discard a user's settings.
export const STORAGE_KEYS=Object.freeze({player:'keynlock-art-archive-controls-v1',clouds:'keynlock-art-clouds-v1',language:'keynlock-art-language',hanging:'keynlock-art-hanging-v1',disposal:'keynlock-art-disposal-v1',tutorial:'keynlock-art-tutorial-v1'});
export function readJson(key,fallback={}){try{if(typeof window==='undefined')return fallback;const value=JSON.parse(localStorage.getItem(key)||'null');return value&&typeof value==='object'&&!Array.isArray(value)?value:fallback;}catch{return fallback;}}
export function writeJson(key,value){try{if(typeof window==='undefined')return false;localStorage.setItem(key,JSON.stringify(value));return true;}catch{return false;}}

export function readText(key,fallback=''){try{return typeof window==='undefined'?fallback:localStorage.getItem(key)??fallback;}catch{return fallback;}}
export function writeText(key,value){try{if(typeof window==='undefined')return false;localStorage.setItem(key,value);return true;}catch{return false;}}
