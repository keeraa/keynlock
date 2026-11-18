import {createWideEdgeGeometry,createWideEdgeMaterial,
  fadeOutline} from './hover-outline.js';

// Owns all detachable-part hover ribbons and their GPU resources. The lock
// assembly provides only game-state queries; rendering remains self-contained.
export function createAssemblyHover({THREE,coverFrame,canRemoveCover,
  getAssemblyGuidance,canDetachPart,getPortable,screws}){
  const viewport=new THREE.Vector2(1200,800);
  const guides=new Map(),edgeGeometries=[];
  let coverOpacity=0,coverTarget=0,hoveredShape=null;

  function shapeGuides(object){
    if(guides.has(object))return guides.get(object);
    const outlines=[];
    const material=createWideEdgeMaterial(THREE,viewport);
    object.traverse(mesh=>{
      if(!mesh.isMesh||!mesh.geometry||mesh.userData.hoverGuide||
        ['loose','cover','dust','screw'].includes(mesh.userData.kind))return;
      const edges=mesh.geometry.type==='TubeGeometry'?
        new THREE.WireframeGeometry(mesh.geometry):
        new THREE.EdgesGeometry(mesh.geometry,33);
      const wideGeometry=createWideEdgeGeometry(THREE,edges);
      edges.dispose();
      const outline=new THREE.Mesh(wideGeometry,material);
      outline.userData.hoverGuide=true;outline.visible=false;
      outline.renderOrder=19;outline.raycast=()=>{};
      outline.castShadow=false;outline.receiveShadow=false;mesh.add(outline);
      outlines.push(outline);edgeGeometries.push(wideGeometry);
    });
    const entry={guides:outlines,material,opacity:0,target:0};
    guides.set(object,entry);
    return entry;
  }

  function setHoveredDetachable(hit){
    const guide=getAssemblyGuidance();
    coverTarget=Number(Boolean(canRemoveCover()||
      (hit?.kind==='loose'&&hit.index==='cover')));
    if(coverTarget)coverFrame.visible=true;
    const portable=getPortable();
    let object=null;
    if(hit?.kind==='internal'&&canDetachPart(hit.id).allowed)
      object=portable[hit.id];
    if(hit?.kind==='shackle'&&canDetachPart('shackle-0').allowed)
      object=portable['shackle-0'];
    if(hit?.kind==='loose'&&hit.index!=='cover')
      object=typeof hit.index==='number'?screws[hit.index]:
        portable[hit.index?.replace?.(/^part:/,'')];
    if(!object&&guide?.id)object=portable[guide.id];
    if(hoveredShape!==object){
      if(hoveredShape)shapeGuides(hoveredShape).target=0;
      hoveredShape=object;
      if(object){
        const entry=shapeGuides(object);entry.target=1;
        for(const item of entry.guides)item.visible=true;
      }
    }
  }

  function animateHover(dt){
    coverOpacity=fadeOutline(coverOpacity,coverTarget,dt);
    coverFrame.material.opacity=coverOpacity;
    coverFrame.visible=coverOpacity>.004||coverTarget>0;
    for(const entry of guides.values()){
      entry.opacity=fadeOutline(entry.opacity,entry.target,dt);
      entry.material.uniforms.uOpacity.value=entry.opacity*.96;
      for(const guide of entry.guides)guide.visible=entry.opacity>.004||entry.target>0;
    }
  }

  return {
    setHoveredDetachable,
    setHoverViewport:(width,height)=>viewport.set(Math.max(1,width),Math.max(1,height)),
    animateHover,
    dispose(){
      for(const entry of guides.values()){
        for(const outline of entry.guides)outline.removeFromParent();
        entry.material.dispose();
      }
      for(const geometry of edgeGeometries)geometry.dispose();
      guides.clear();
      // The cover frame remains in the parent scene graph; its owner disposes
      // its geometry and material together with the other lock hardware.
    }
  };
}
