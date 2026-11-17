import {createCodeLockUI} from '../code-lock-ui.js';

/** Six-dial casket manages its own puzzle progress and lazy WebGL scene. */
export function createCodeMode({canvas,$,toast,isKeyboardActive}){
  return createCodeLockUI({canvas,$,toast,isActive:isKeyboardActive});
}
