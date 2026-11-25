import {messages as pairs} from './messages.js';
import {STORAGE_KEYS,readText,writeText} from '../persistence/storage.js';

const reverse=Object.fromEntries(Object.entries(pairs).map(([a,b])=>[b,a]));
let language=readText(STORAGE_KEYS.language)==='en'?'en':'ru';
export const getLanguage=()=>language;
export const paintingTitle=painting=>language==='ru'?(painting.titleRu||painting.title):painting.title;
export const paintingArtist=painting=>language==='ru'?(painting.artistRu||painting.artist):painting.artist;
export function t(value){const canonical=reverse[value]??value;return language==='en'?(pairs[canonical]??canonical):canonical;}
export function setLanguage(value){language=value==='en'?'en':'ru';writeText(STORAGE_KEYS.language,language);}
const originals=new WeakMap();
export function localizeDocument(root=document.body){
 const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node;
 while(node=walker.nextNode()){
  if(['SCRIPT','STYLE'].includes(node.parentElement?.tagName))continue;
  if(!originals.has(node))originals.set(node,reverse[node.textContent.trim()]??node.textContent.trim());
  const source=originals.get(node);if(source)node.textContent=node.textContent.replace(node.textContent.trim(),t(source));
 }
 document.documentElement.lang=language;document.title=t('Кейнлок — Архив Картин');
 for(const el of root.querySelectorAll('[title]')){const key=el.dataset.titleOriginal??el.getAttribute('title');el.dataset.titleOriginal=key;el.setAttribute('title',t(key));}
 for(const el of root.querySelectorAll('[aria-label]')){const key=el.dataset.ariaOriginal??el.getAttribute('aria-label');el.dataset.ariaOriginal=key;el.setAttribute('aria-label',t(key));}
}
