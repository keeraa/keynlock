import {createLifecycle} from '../app/lifecycle.js';
import {getLanguage,setLanguage,localizeDocument} from '../localization/i18n.js';
export function bindInterface({elements,actions,world,plan,hud,player,getMode}){
 const life=createLifecycle();
 const clicks={'start-btn':actions.play,'resume-btn':actions.play,'pause-btn':actions.openMenu,
  'return-btn':actions.play,'new-game-btn':actions.newGame};
 for(const [id,handler]of Object.entries(clicks))life.listen(elements(id),'click',handler);
 const language=elements('language-select');language.value=getLanguage();
 life.listen(language,'change',()=>{
  setLanguage(language.value);localizeDocument();world.building.refreshLanguage();plan.refreshLanguage();
  hud.updateLocation(getMode(),player.state.floorY);
 });return life;
}
