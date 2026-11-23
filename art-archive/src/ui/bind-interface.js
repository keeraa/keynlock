import {createLifecycle} from '../app/lifecycle.js';
import {t,getLanguage,setLanguage,localizeDocument} from '../localization/i18n.js';
export function bindInterface({elements,actions,world,inspector,plan,hud,player,getMode}){
 const life=createLifecycle();
 const clicks={'start-btn':actions.play,'resume-btn':actions.play,'pause-btn':()=>getMode()==='intro'?actions.play():actions.pause(),
  'plan-btn':actions.plan,'intro-plan':actions.plan,'pause-plan':actions.plan,'return-btn':actions.play,
  'scale-btn':()=>{actions.scale();actions.play();},'level-camera':()=>{player.level();actions.play();},'reset-camera':()=>{player.reset();actions.play();}};
 for(const [id,handler]of Object.entries(clicks))life.listen(elements(id),'click',handler);
 const languageButton=elements('language-btn');languageButton.textContent=getLanguage()==='ru'?'EN':'RU';
 life.listen(languageButton,'click',()=>{
  setLanguage(getLanguage()==='ru'?'en':'ru');localizeDocument();world.building.refreshLanguage();inspector.refreshLanguage();plan.refreshLanguage();
  elements('plan-btn').textContent=t(getMode()==='plan'?'Вернуться к прогулке':'План этажа');languageButton.textContent=getLanguage()==='ru'?'EN':'RU';hud.updateLocation(getMode(),player.state.floorY);
 });return life;
}
