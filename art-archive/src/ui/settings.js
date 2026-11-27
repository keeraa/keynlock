import {PLAYER_DEFAULTS,VISUAL_DEFAULTS} from '../../config/runtime.js';
import {GOUACHE_STYLES} from '../paintings/gouache.js';
import {STORAGE_KEYS,readJson,writeJson} from '../persistence/storage.js';
import {createLifecycle} from '../app/lifecycle.js';

export function bindPlayerSettings({player,painted,elements,collection,ink,setSkyColor}) {
  const life=createLifecycle(), saved=readJson(STORAGE_KEYS.player);
  const sensitivity=elements('sensitivity'), outline=elements('outline'), toon=elements('toon'), finish=elements('gouache');
  if(Number.isFinite(saved?.sensitivity)) player.state.sensitivity=Math.min(PLAYER_DEFAULTS.maxSensitivity,Math.max(PLAYER_DEFAULTS.minSensitivity,saved.sensitivity));
  const pigment=elements('canvas-pigment');
  const easy=elements('easy-mode');
  easy.checked=saved?.easyMode===true;
  pigment.checked=saved?.canvasPigment === true;
  sensitivity.value=player.state.sensitivity;
  outline.checked=saved?.outline ?? VISUAL_DEFAULTS.outlineEnabled;
  toon.checked=saved?.toon ?? VISUAL_DEFAULTS.toonEnabled;
  finish.value=GOUACHE_STYLES.includes(saved?.gouache) ? saved.gouache : GOUACHE_STYLES[0];
  const sky=elements('sky-color');
  sky.value=/^#[0-9a-f]{6}$/i.test(saved?.skyColor)?saved.skyColor:'#75a3bd';
  setSkyColor(sky.value);
  life.listen(sky,'input',()=>{setSkyColor(sky.value);save();});
  function save() {
    writeJson(STORAGE_KEYS.player,{skyColor:sky.value,sensitivity:player.state.sensitivity,outline:outline.checked,toon:toon.checked,gouache:finish.value,canvasPigment:pigment.checked,easyMode:easy.checked});
  }
  function lighting() {
    ink.setEnabled(outline.checked);
    painted.setSettings({...VISUAL_DEFAULTS,outlineEnabled:outline.checked,toonEnabled:toon.checked});
  }
  lighting(); collection.setStyle(finish.value); collection.setPigment(pigment.checked);
  collection.setEasyMode(easy.checked);
  life.listen(easy,'change',()=>{collection.setEasyMode(easy.checked);save();});
  life.listen(sensitivity,'input',()=>{player.state.sensitivity=Number(sensitivity.value);save();});
  life.listen(outline,'change',()=>{lighting();save();});
  life.listen(toon,'change',()=>{lighting();save();});
  life.listen(pigment,'change',()=>{collection.setPigment(pigment.checked);save();});
  life.listen(finish,'change',()=>{collection.setStyle(finish.value);save();});
  return life;
}
