/**
 * Read-only, origin-checked bridge between the original atelier's browser save
 * and the lair. No artwork, storage value or identifier is written by this page.
 * The connection intentionally stays in the same browser profile.
 */
import { paintings } from './atelier-config.js';
import { chooseDemoWallPaintings } from './wall-demo.js';
import { layoutWallPaintings } from './wall-layout.js';
import { createIndexedDBAdapter } from './restoration-store.js';

const LAIR_ORIGIN='https://keynlock-lair-1116.k1r11111.chatgpt.site';
const PLAYER_KEY='atelier-restoration:player:v1';
const REVISION_KEY='atelier-restoration:surface-revision';
const bridgeName='keynlock:atelier-bridge:v1';
const byId=new Map(paintings.map(art=>[art.id,art]));
const store=createIndexedDBAdapter();
const aspectCache=new Map();
const aspectRequests=new Set();
let aspectRefreshTimer=null;
let activeImageLoads=0;
const imageQueue=[];
// The same demo algorithm as the original gallery, with a repeatable seed so
// the two scenes do not reshuffle whenever the bridge is reloaded.
let randomState=20261116;
const random=()=>((randomState=(1664525*randomState+1013904223)>>>0)/4294967296);
const demo=chooseDemoWallPaintings(paintings,random);
let lastSignature='';
let busy=false;
let needsAnotherPass=false;

function readSave() {
  try{return JSON.parse(localStorage.getItem(PLAYER_KEY)||'null');}
  catch{return null;}
}
function marker() {
  try{return (localStorage.getItem(PLAYER_KEY)||'')+'|'+(localStorage.getItem(REVISION_KEY)||'');}
  catch{return 'storage-unavailable';}
}
function post(payload) {
  if(window.parent===window)return;
  window.parent.postMessage({bridge:bridgeName,...payload},LAIR_ORIGIN);
}
function resolveImage(art) {
  return new URL(art.image,location.origin).href;
}
function source(art) {
  return {id:art.id,title:art.title,artist:art.artist,year:art.year,
    image:resolveImage(art),category:art.category,
    hue:art.hue??0,saturation:art.saturation??1,brightness:art.brightness??1,
    aspect:aspectCache.get(art.id)||art.aspect||1};
}

function queueAspects(arts) {
  for(const art of arts) {
    if(aspectCache.has(art.id)||aspectRequests.has(art.id))continue;
    aspectRequests.add(art.id);
    imageQueue.push(art);
  }
  pumpImages();
}
function pumpImages() {
  while(activeImageLoads<5&&imageQueue.length){
    const art=imageQueue.shift();
    activeImageLoads++;
    const image=new Image();
    image.onload=()=>{
      aspectCache.set(art.id,image.naturalWidth/Math.max(1,image.naturalHeight));
      aspectRequests.delete(art.id);
      activeImageLoads--;
      clearTimeout(aspectRefreshTimer);
      aspectRefreshTimer=setTimeout(()=>void refresh(true),180);
      pumpImages();
    };
    image.onerror=()=>{aspectRequests.delete(art.id);activeImageLoads--;pumpImages();};
    image.src=resolveImage(art);
  }
}

async function refresh(force=false) {
  const signature=marker();
  if(!force && signature===lastSignature)return;
  if(busy){needsAnotherPass=true;return;}
  busy=true;
  lastSignature=signature;
  try {
    const data=readSave();
    const pinned=(Array.isArray(data?.wallIds)?data.wallIds:[])
      .slice(0,30).map(id=>byId.get(id)).filter(Boolean);
    const selected=pinned.length?pinned:demo;
    const originals=selected.map(source);
    const layout=layoutWallPaintings(originals);
    const activePainting=byId.get(data?.selectedId)||paintings[0];
    const activeSource=source(activePainting);
    post({type:'state',mode:pinned.length?'player':'demo',
      selectedId:activePainting.id,
      activePainting:activeSource,
      paintings:originals,settings:data?.settings||{},
      placements:layout.placements,columns:layout.columns});
    queueAspects([...selected,activePainting]);
    const snapshot=await store.get(activePainting.id);
    post({type:'snapshot',id:activePainting.id,snapshot:
      snapshot?.version===1?snapshot:null});
  }catch(error) {
    post({type:'error',message:'Не удалось прочитать сохранение мастерской'});
    console.warn('Atelier bridge:',error);
  }finally {
    busy=false;
    if(needsAnotherPass){needsAnotherPass=false;void refresh(true);}
  }
}

window.addEventListener('message',event=>{
  if(event.origin!==LAIR_ORIGIN||event.source!==window.parent)return;
  if(event.data?.bridge===bridgeName&&event.data.type==='request')void refresh(true);
});
window.addEventListener('storage',event=>{
  if(event.key===PLAYER_KEY||event.key===REVISION_KEY)void refresh(true);
});
setInterval(()=>{void refresh();},1550);
void refresh(true);
