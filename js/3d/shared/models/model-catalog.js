/** Central model registry. Keep version-pinned URLs stable between scene builds. */
import catalog from './catalog.json' with {type:'json'};

export const MODELS=catalog.models;
export function getModel(id){
  const item=MODELS.find(model=>model.id===id);
  if(!item)throw new RangeError(`Unknown KEYNLOCK model: ${id}`);
  return item;
}
export function modelUrl(id,lod=0){
  const model=getModel(id);
  const file=model.lods.find(item=>item.level===lod);
  if(!file)throw new RangeError(`Unavailable LOD ${lod} for ${id}`);
  return file.url;
}
/** Pass a Three.js GLTFLoader instance. Loads on demand, never at app bootstrap. */
export async function loadModel(id,{loader,lod=0}={}){
  if(!loader?.loadAsync)throw new TypeError('A Three.js GLTFLoader instance is required');
  return loader.loadAsync(modelUrl(id,lod));
}
