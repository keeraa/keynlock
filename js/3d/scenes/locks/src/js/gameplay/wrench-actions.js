// @ts-check
import { WRENCH_TO_PLATE_SYMBOL } from '../mechanisms/plate-symbols.js';

/** The same five physical tension wrenches serve both lock mechanisms.
 * @param {{document:Document,state:any,setMode:(mode:import('../types/contracts.js').LockMode)=>void,
 *   setSelectedTension:(index:number)=>void,tensionModels:Array<{visible:boolean}>,
 *   tensionSpecs:Array<{name:string}>,toggleTool:()=>void,status:(message:string)=>void,
 *   platePuzzle:{model:{feedback:string},selectTool:(index:number)=>boolean},
 *   renderPlateUI:()=>void}} deps
 */
export function createWrenchSelector({ document, state, setMode, setSelectedTension,
  tensionModels, tensionSpecs, toggleTool, status, platePuzzle, renderPlateUI }) {
  /** @param {number} index */
  return function selectWrench(index) {
    if (!Number.isInteger(index) || index < 0 || index >= tensionModels.length) return;
    setSelectedTension(index);
    tensionModels.forEach((mesh, i) => { mesh.visible = i === index; });
    document.querySelectorAll('#wrenchPicker .wrench-choice').forEach(option => {
      const active = Number(/** @type {HTMLElement} */ (option).dataset.wrench) === index;
      option.classList.toggle('active', active);
      option.setAttribute('aria-pressed', String(active));
    });
    if (state.mode === 'plate') {
      platePuzzle.selectTool(WRENCH_TO_PLATE_SYMBOL[index]);
      renderPlateUI();
      status(`${tensionSpecs[index].name}: ${platePuzzle.model.feedback}`);
      return;
    }
    if (state.mode !== 'pin') setMode('pin');
    if (!state.picking) toggleTool();
    status(`Натяжной инструмент: ${tensionSpecs[index].name} · угол 22°`);
  };
}
