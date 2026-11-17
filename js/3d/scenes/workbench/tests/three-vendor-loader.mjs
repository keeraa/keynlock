// Node smoke tests resolve the same r187 files that the browser import map uses.
const base=new URL('../public/vendor/',import.meta.url);
const imports=new Map([
  ['three','three.js'],['three/core','three-core.js'],
  ['three/addons/controls/OrbitControls.js','OrbitControls.js'],
  ['three/addons/geometries/RoundedBoxGeometry.js','RoundedBoxGeometry.js']
]);
export async function resolve(specifier,context,nextResolve){
  if(imports.has(specifier))return {url:new URL(imports.get(specifier),base).href,
    shortCircuit:true};
  return nextResolve(specifier,context);
}
