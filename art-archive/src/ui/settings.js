import {PLACEMENT_EFFECTS} from '../paintings/watercolor-placement.js';
import {PLAYER_DEFAULTS,VISUAL_DEFAULTS} from '../../config/runtime.js';
import {GOUACHE_STYLES} from '../paintings/gouache.js';
import {STORAGE_KEYS,readJson,writeJson} from '../persistence/storage.js';
import {createLifecycle} from '../app/lifecycle.js';
import {setShadowHatch} from '../rendering/shadow-hatch.js';

export function bindPlayerSettings({player,painted,elements,collection,dust,ink,setSkyColor,setWallFinish,setFrameLimit,onModeSelection=()=>{}}) {
  const life=createLifecycle(), saved=readJson(STORAGE_KEYS.player);
  const sensitivity=elements('sensitivity'), toon=elements('toon'), finish=elements('gouache');
  if(Number.isFinite(saved?.sensitivity)) player.state.sensitivity=Math.min(PLAYER_DEFAULTS.maxSensitivity,Math.max(PLAYER_DEFAULTS.minSensitivity,saved.sensitivity));
  const pigment=elements('canvas-pigment'),placement=elements('placement-effect');
  placement.value=PLACEMENT_EFFECTS.includes(saved?.placementEffect)?saved.placementEffect:'classic';
  collection.setPlacementEffect(placement.value);
  life.listen(placement,'change',()=>{collection.setPlacementEffect(placement.value);save();});
  const hard=elements('hard-mode');
  const free=elements('free-placement');
  free.checked=saved?.freePlacement===true;
  collection.setFreePlacement(free.checked);
  life.listen(free,'change',()=>{collection.setFreePlacement(free.checked);save();reportMode('change','placement');});
  hard.checked=saved?.hardMode===true;
  pigment.checked=saved?.canvasPigment === true;
  sensitivity.value=player.state.sensitivity;
  toon.checked=saved?.toon ?? VISUAL_DEFAULTS.toonEnabled;
  const depth=elements('distance-blur');
  const fpsLimit=elements('fps-limit');
  fpsLimit.checked=saved?.limitFps===true;
  setFrameLimit(fpsLimit.checked);
  depth.checked=saved?.distanceBlur ?? VISUAL_DEFAULTS.distanceBlurEnabled;
  finish.value=saved?.frameTextureMode===1&&GOUACHE_STYLES.includes(saved?.gouache) ? saved.gouache : 'mixed';
  const sky=elements('sky-color');
  setWallFinish('white');
  sky.value=/^#[0-9a-f]{6}$/i.test(saved?.skyColor)?saved.skyColor:'#75a3bd';
  setSkyColor(sky.value);
  life.listen(sky,'input',()=>{setSkyColor(sky.value);save();});
  function save() {
    writeJson(STORAGE_KEYS.player,{skyColor:sky.value,sensitivity:player.state.sensitivity,toon:toon.checked,
      distanceBlur:depth.checked,gouache:finish.value,frameTextureMode:1,canvasPigment:pigment.checked,hardMode:hard.checked,
      limitFps:fpsLimit.checked,placementEffect:placement.value,freePlacement:free.checked});
  }
  function lighting() {
    ink.setEnabled(true);
    painted.setSettings({...VISUAL_DEFAULTS,outlineEnabled:true,toonEnabled:toon.checked,distanceBlurEnabled:depth.checked});
  }
  lighting(); collection.setStyle(finish.value); collection.setPigment(pigment.checked);
  collection.setEasyMode(!hard.checked);
  life.listen(hard,'change',()=>{collection.setEasyMode(!hard.checked);save();reportMode('change','difficulty');});
  function reportMode(source,changed){onModeSelection({placement:free.checked?'free':'blocks',difficulty:hard.checked?'hard':'normal',source,changed});}
  reportMode('initial','none');
  life.listen(sensitivity,'input',()=>{player.state.sensitivity=Number(sensitivity.value);save();});
  life.listen(toon,'change',()=>{lighting();save();});
  life.listen(fpsLimit,'change',()=>{setFrameLimit(fpsLimit.checked);save();});
  life.listen(depth,'change',()=>{lighting();save();});
  setShadowHatch(false);dust.setEnabled(true);
  life.listen(pigment,'change',()=>{collection.setPigment(pigment.checked);save();});
  life.listen(finish,'change',()=>{collection.setStyle(finish.value);save();});
  return life;
}
