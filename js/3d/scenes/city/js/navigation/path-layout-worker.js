import {planBuildingPaths} from './path-layout.js';

// Route searches can visit up to 125,000 grid cells. Keep them off the UI
// thread, while sending only structured-cloneable network data to the editor.
self.onmessage=({data})=>{
  const {id,buildings,landscape,bounds}=data;
  try{
    const {network,...layout}=planBuildingPaths(buildings,{landscape,bounds});
    self.postMessage({id,layout:{...layout,network:{nodes:network.nodes,
      edges:network.edges,anchors:network.anchors}}});
  }catch(error){
    self.postMessage({id,error:String(error?.message||error)});
  }
};
