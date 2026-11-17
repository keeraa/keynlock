import {createMechanismUI} from '../mechanism-ui.js';

/** The free-form lock has its own renderer, timeline and editing state.
 * Create it only when the player enters this station for the first time. */
export function createMechanismMode({root,isKeyboardActive}){
  let instance=null;
  return {
    open(){
      if(!instance)instance=createMechanismUI({mountRoot:root,isKeyboardActive});
      instance.open();
    },
    close(){instance?.close();},
    dispose(){instance?.dispose();instance=null;}
  };
}
