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
 const mounts=[{element:elements('archive-music'),volume:false},{element:elements('archive-music-panel'),volume:true}];
 let views=[];
 function render(){
  for(const unmount of views)unmount();views=[];
  const en=getLanguage()==='en';
  const labels=en?{region:'Music',previous:'Previous track',next:'Next track',play:'Play music',pause:'Pause music',volume:'Music volume'}
   :{region:'Музыка',previous:'Предыдущий трек',next:'Следующий трек',play:'Включить музыку',pause:'Пауза музыки',volume:'Громкость музыки'};
  for(const {element,volume} of mounts)if(element)views.push(mountMusicControls(element,music,{labels,language:getLanguage(),volume}));
 }
 render();
 const begin=event=>{
  if(event.target?.closest?.('.music-controls'))return;
  music.start();removeGesture();
 };
 function removeGesture(){browserWindow.removeEventListener('pointerdown',begin,true);browserWindow.removeEventListener('keydown',begin,true);}
 browserWindow.addEventListener('pointerdown',begin,true);browserWindow.addEventListener('keydown',begin,true);
 const language=elements('language-select');language?.addEventListener('change',render);
 return {player:music,setPaused:value=>music.setPaused(value),dispose(){
  removeGesture();language?.removeEventListener('change',render);for(const unmount of views)unmount();views=[];
  // The player belongs to the page/host. Leaving a scene must not stop its music.
 }};
}
