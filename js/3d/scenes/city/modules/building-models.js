import { createHouseModel } from './house-builder/index.js';
import { createLandmarkModel, LANDMARK_CATALOG } from '../js/landmarks/landmark-model.js';

// Uniform interface for placing architectural models in a world scene.
// Every returned model exposes group, update and dispose; the update method
// on hand-authored landmarks intentionally signals that rebuilding is needed.
export function createBuildingModel(THREE, definition, {detail='high'}={}) {
  if(!definition || !['house','landmark'].includes(definition.type)) {
    throw new Error('Ожидался тип здания house или landmark');
  }
  if(definition.type==='house') {
    const model=createHouseModel(THREE,definition.config,{detail});
    return {...model,type:'house',detail};
  }
  if(!LANDMARK_CATALOG.some(item=>item.id===definition.id)) {
    throw new Error(`Неизвестный тип особого здания: ${definition.id}`);
  }
  const model=createLandmarkModel(THREE,definition.id,{detail});
  return {
    ...model,type:'landmark',
    update() {throw new Error('Для особого здания создайте новую модель с нужным LOD');},
  };
}
