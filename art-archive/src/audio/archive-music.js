import {getSharedMusicPlayer} from '../../vendor/shared-music/music-player.js';
import {mountMusicControls} from '../../vendor/shared-music/music-controls.js';
import {musicTracksWithUrls} from '../../vendor/shared-music/music-tracks.js';
import {getLanguage} from '../localization/i18n.js';

// A scene adapter only: player, catalogue and UI are the canonical core/audio modules.
export function mountArchiveMusic({window:browserWindow,elements}){
 let storage=null;
 try{storage=browserWindow.localStorage;}catch{}
 const music=getSharedMusicPlayer(browserWindow,storage,{
  tracks:musicTracksWithUrls(file=>new URL('../../assets/music/'+file,import.meta.url).href),
 });
 const toggle=elements('archive-music-toggle'),panel=elements('archive-music-panel');
 let unmountPanel=()=>{};
 function toggleMusic(){
  const {stopped,volume}=music.getState();
  if(!volume){music.setVolume(25);music.play();}
  else if(stopped)music.play();
  else music.pause();
 }
 function renderToggle({stopped,volume}){
  if(!toggle)return;
  const on=!stopped&&volume>0,en=getLanguage()==='en';
  toggle.setAttribute('aria-label',en?'Music':'Музыка');
  toggle.setAttribute('aria-pressed',String(on));
  toggle.title=on?(en?'Pause music':'Пауза музыки'):(en?'Play music':'Включить музыку');
 }
 toggle?.addEventListener('click',toggleMusic);
 const unsubscribe=music.subscribe(renderToggle);
 function render(){
  unmountPanel();
  renderToggle(music.getState());
  const en=getLanguage()==='en';
  const labels=en?{region:'Music',previous:'Previous track',next:'Next track',play:'Play music',pause:'Pause music',volume:'Music volume'}
   :{region:'Музыка',previous:'Предыдущий трек',next:'Следующий трек',play:'Включить музыку',pause:'Пауза музыки',volume:'Громкость музыки'};
  if(panel)unmountPanel=mountMusicControls(panel,music,{labels,language:getLanguage(),volume:true});
 }
 render();
 const begin=event=>{
  if(event.target?.closest?.('.music-controls, #archive-music-toggle'))return;
  music.start();removeGesture();
 };
 function removeGesture(){browserWindow.removeEventListener('pointerdown',begin,true);browserWindow.removeEventListener('keydown',begin,true);}
 browserWindow.addEventListener('pointerdown',begin,true);browserWindow.addEventListener('keydown',begin,true);
 const language=elements('language-select');language?.addEventListener('change',render);
 return {player:music,setPaused:value=>music.setPaused(value),dispose(){
  removeGesture();language?.removeEventListener('change',render);
  toggle?.removeEventListener('click',toggleMusic);unsubscribe();unmountPanel();
  // The player belongs to the page/host. Leaving a scene must not stop its music.
 }};
}
