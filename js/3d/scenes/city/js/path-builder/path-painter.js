import {createPavingSurface} from './paving-art.js';
import {createPavingMaterials} from './paving-shader.js';
import {createTerrainMeshUpdater} from './terrain-mesh.js';

// One world-aligned mesh for the complete painted road network. The final
// mosaic is uploaded once per edit. One auxiliary RGBA atlas carries both
// animation arrival (red) and antialiased stone-interior coverage (green).
// Neither atlas needs uploads during a frame of animation.
export function createPathPainter(THREE,scene,{waterMaskCanvas=null,waterMaskTexture=null}={}){
  const pavement=createPavingSurface({waterMaskCanvas});
  const texture=new THREE.CanvasTexture(pavement.finalCanvas);
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.anisotropy=8;
  const beforeTexture=new THREE.CanvasTexture(pavement.beforeCanvas);
  beforeTexture.colorSpace=THREE.SRGBColorSpace;
  const revealTexture=new THREE.CanvasTexture(pavement.progressCanvas);
  revealTexture.minFilter=THREE.LinearFilter;revealTexture.magFilter=THREE.LinearFilter;
  revealTexture.generateMipmaps=false;
  const stoneTexture=new THREE.CanvasTexture(pavement.stoneCanvas);
  stoneTexture.colorSpace=THREE.SRGBColorSpace;
  stoneTexture.wrapS=THREE.RepeatWrapping;stoneTexture.wrapT=THREE.RepeatWrapping;
  stoneTexture.anisotropy=8;
  const {material,animationMaterial}=createPavingMaterials(THREE,{
    finalTexture:texture,beforeTexture,revealTexture,stoneTexture,waterMaskTexture});
  const terrainMesh=createTerrainMeshUpdater(THREE);
  const plane=new THREE.Mesh(terrainMesh.geometry,material);
  plane.rotation.x=-Math.PI/2;plane.position.y=.065;
  plane.renderOrder=2;plane.userData.noOutline=true;scene.add(plane);
  const setTerrain=(heightAt,landscape,terrainContacts)=>{
    plane.geometry=terrainMesh.update(landscape,heightAt,terrainContacts);
  };
  const setPaths=(paths,options)=>{
    const change=pavement.setPaths(paths,options);
    if(change.finalChanged)texture.needsUpdate=true;
    if(change.beforeChanged)beforeTexture.needsUpdate=true;
    // The green coverage channel changes whenever the street geometry does,
    // including instant placement and deletion without a reveal animation.
    if(change.progressChanged)revealTexture.needsUpdate=true;
    animationMaterial.uniforms.uProgress.value=pavement.getProgress();
    plane.material=pavement.isAnimating()?animationMaterial:material;
  };
  const setPavingStyle=mode=>{
    if(pavement.setStyle(mode)){
      texture.needsUpdate=true;
      revealTexture.needsUpdate=true;
      plane.material=material;
    }
  };
  const refreshWaterMask=()=>{
    const change=pavement.refreshWaterMask();
    texture.needsUpdate=true;
    if(change.beforeChanged)beforeTexture.needsUpdate=true;
  };
  const update=time=>{
    if(!pavement.update(time))return;
    animationMaterial.uniforms.uProgress.value=pavement.getProgress();
    if(!pavement.isAnimating())plane.material=material;
  };
  function dispose(){
    scene.remove(plane);terrainMesh.dispose();material.dispose();animationMaterial.dispose();
    texture.dispose();beforeTexture.dispose();revealTexture.dispose();stoneTexture.dispose();
    pavement.dispose();
  }
  return {setPaths,setTerrain,setPavingStyle,refreshWaterMask,update,dispose,
    mesh:plane,stoneTexture};
}
