// Ported from keeraa/village-engine/src/modules/ink-outlines.js (shared Three.js renderer)
// Selective woodblock-style contours. Static buildings use one merged hull;
// animated instanced actors and forest batches share their original GPU
// instance matrices with low-cost outline shells.

const OUTLINE_NAME='Ukiyo-e ink silhouette';
const MAX_HULL_TRIANGLES=45000;

export function createInkOutlines(THREE,{enabled=true,color=0x17191a,screenWidth=.0042}={}){
 if(!enabled){
  const noop=()=>{};
  return {attach:()=>false,attachInstanced:()=>null,attachCanopyBand:()=>null,
   detachInstanced:noop,syncInstanced:noop,setAnimatedEnabled:noop,
   shade:noop,shadeMaterial:noop,dispose:noop};
 }
 const shaded=new WeakSet();
 const outlined=new WeakSet();
 const shellMaterials=new Set();
 const animatedShells=new Map();
 let animatedEnabled=true;
 // An explicit shader avoids relying on internal material chunks that differ
 // between the Basic and lit Three.js materials.
 const shellMaterial=new THREE.ShaderMaterial({
  uniforms:{inkColor:{value:new THREE.Color(color)},maxExtrusion:{value:1},
   inkShift:{value:new THREE.Vector2()},strokeScale:{value:1}},
  vertexShader:`
   uniform float maxExtrusion;
   uniform vec2 inkShift;
   uniform float strokeScale;
   void main(){
    vec4 eye = modelViewMatrix * vec4(position,1.0);
    vec3 outward = normalize(normalMatrix * normal);
    vec4 projected = projectionMatrix * eye;
    // Keep the silhouette exactly beside the visible edge in screen space.
    // Moving along a 3D roof normal also changes depth and creates a detached
    // black stripe above inclined tiles at oblique camera angles.
    vec2 screenNormal = vec2(outward.x*projectionMatrix[0][0],
                             outward.y*projectionMatrix[1][1]);
    float screenLength = length(screenNormal);
    if(screenLength>0.0001){
     float pixelBreadth = min(${screenWidth.toFixed(6)},
      maxExtrusion*projectionMatrix[1][1]/max(1.0,-eye.z));
     projected.xy += screenNormal/screenLength * projected.w * pixelBreadth * strokeScale;
    }
    // Small deliberate ukiyo-e registration mismatch, configured per model.
    projected.xy += projected.w * inkShift;
    gl_Position = projected;
   }
  `,
  fragmentShader:`uniform vec3 inkColor;
   void main(){gl_FragColor=vec4(inkColor,1.0);}`,
  side:THREE.BackSide,depthTest:true,depthWrite:false,toneMapped:false
 });
 shellMaterial.userData.inkOutlineShell=true;

 const markMaterial=material=>{
  if(!material||shaded.has(material)||material.transparent||
     !(material.isMeshStandardMaterial||material.isMeshLambertMaterial||material.isMeshPhongMaterial))return;
  shaded.add(material);
  const previousCompile=material.onBeforeCompile;
  const previousKey=material.customProgramCacheKey;
  material.onBeforeCompile=function(shader,...args){
   previousCompile.call(this,shader,...args);
   shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',
    `#include <normal_fragment_maps>
     float inkFacing = abs(dot(normalize(normal), normalize(vViewPosition)));
     float inkRim = 1.0 - smoothstep(0.12, 0.37, inkFacing);
     diffuseColor.rgb = mix(diffuseColor.rgb,vec3(0.055,0.046,0.042),inkRim * 0.78);`);
  };
  material.customProgramCacheKey=function(){
   return `${previousKey.call(this)}|ukiyoe-rim-v1`;
  };
  material.userData.inkRim=true;
  material.needsUpdate=true;
 };

 const shade=root=>{
  if(!root)return;
  root.traverse?.(mesh=>{
   if(!mesh.isMesh||mesh.userData.inkOutlineShell)return;
   for(const material of [].concat(mesh.material||[]))markMaterial(material);
  });
 };

 const attach=(root,{includeInstanced=false,registrationOffset=[0,0],strokeScale=1}={})=>{
  if(!root||outlined.has(root)||root.userData.inkOutlineAttached)return false;
  root.updateWorldMatrix(true,true);
  const toLocal=root.matrixWorld.clone().invert();
  const pieces=[],candidates=[],roofBounds=[];
  let triangles=0,vertices=0;
  root.traverse(mesh=>{
   if(!mesh.isMesh||mesh.isSkinnedMesh||mesh.userData.inkOutlineShell||
      Array.isArray(mesh.material)||mesh.material?.transparent||mesh.material?.opacity<.98||
      mesh.material?.userData?.inkSkipOutline)return;
   const geometry=mesh.geometry;
   if(!geometry?.getAttribute('position'))return;
   if(mesh.isInstancedMesh){
    // The pagoda batches its steps, walls and wooden beams into instanced
    // boxes. They are structural outlines and must not disappear.
    if(!includeInstanced||geometry.type!=='BoxGeometry')return;
    const instance=new THREE.Matrix4(),base=toLocal.clone().multiply(mesh.matrixWorld);
    for(let i=0;i<mesh.count;i++){
     mesh.getMatrixAt(i,instance);
     candidates.push({geometry,matrix:base.clone().multiply(instance),instanced:true});
    }
   }else candidates.push({geometry,matrix:toLocal.clone().multiply(mesh.matrixWorld),instanced:false});
  });
  // Prioritize structural instances (footings, stairs, frames) over the very
  // fine roof tessellation when a complex building reaches the triangle cap.
  candidates.sort((a,b)=>Number(b.instanced)-Number(a.instanced));
  for(const {geometry,matrix,instanced} of candidates){
   const count=(geometry.index?.count??geometry.getAttribute('position').count)/3;
   if(triangles+count>MAX_HULL_TRIANGLES)continue;
   if(!instanced&&count>1000){
    geometry.computeBoundingBox();
    const box=geometry.boundingBox.clone().applyMatrix4(matrix);
    const previous=roofBounds.find(other=>
     box.min.distanceTo(other.min)<.055&&box.max.distanceTo(other.max)<.055);
    // Pagoda roof undersides duplicate the top roof shape 3.2 cm lower;
    // outlining both costs 19k triangles without changing the silhouette.
    if(previous)continue;
    roofBounds.push(box);
   }
   triangles+=count;
   const copy=geometry.index?geometry.toNonIndexed():geometry.clone();
   copy.applyMatrix4(matrix);
   for(const key of Object.keys(copy.attributes))if(!['position','normal'].includes(key))copy.deleteAttribute(key);
   if(!copy.getAttribute('normal'))copy.computeVertexNormals();
   pieces.push(copy);vertices+=copy.getAttribute('position').count;
  }
  if(!pieces.length)return false;
  // Concat only positions and normals: garden geometry can use a mix of
  // indexed/nonindexed and unusual UV attributes, which generic merge helpers
  // may reject or silently omit.
  const positions=new Float32Array(vertices*3),normals=new Float32Array(vertices*3);
  let cursor=0;
  for(const piece of pieces){
   const pos=piece.getAttribute('position'),normal=piece.getAttribute('normal');
   for(let i=0;i<pos.count;i++){
    const at=cursor++*3;
    positions[at]=pos.getX(i);positions[at+1]=pos.getY(i);positions[at+2]=pos.getZ(i);
    normals[at]=normal.getX(i);normals[at+1]=normal.getY(i);normals[at+2]=normal.getZ(i);
   }
   piece.dispose();
  }
  const combined=new THREE.BufferGeometry();
  combined.setAttribute('position',new THREE.BufferAttribute(positions,3));
  combined.setAttribute('normal',new THREE.BufferAttribute(normals,3));
  combined.computeBoundingBox();combined.computeBoundingSphere();
  const height=combined.boundingBox.max.y-combined.boundingBox.min.y;
  const worldScale=root.getWorldScale(new THREE.Vector3());
  // A distant stone lantern used to receive the same world-space extrusion
  // as an entire shrine, causing spiky roof corners and black antennae.
  const maxExtrusion=Math.max(.006,Math.min(.20,height*Math.abs(worldScale.y)*.025));
  const material=shellMaterial.clone();
  material.uniforms.maxExtrusion.value=maxExtrusion;
  material.uniforms.inkShift.value.set(...registrationOffset);
  material.uniforms.strokeScale.value=strokeScale;
  shellMaterials.add(material);
  const shell=new THREE.Mesh(combined,material);
  shell.name=OUTLINE_NAME;
  shell.userData.inkOutlineShell=true;
  shell.castShadow=false;shell.receiveShadow=false;
  shell.renderOrder=1;
  shell.raycast=()=>{};
  root.add(shell);
  root.userData.inkOutlineAttached=true;
  outlined.add(root);
  shade(root);
  return true;
 };
 // A static merged building hull cannot follow moving hands, knees or tree
 // crowns. These shells reuse each source InstancedMesh's matrix buffer, so
 // outlines follow animation without another CPU upload per person or tree.
 const animatedMaterial=new THREE.ShaderMaterial({
  uniforms:{inkColor:{value:new THREE.Color(color)},strokeScale:{value:1},
   edgeOnly:{value:0},inkOpacity:{value:1}},
  vertexShader:`
   uniform float strokeScale;
   varying float vEdgeFacing;
   void main(){
    vec4 localPosition=vec4(position,1.0);
    vec3 localNormal=normal;
    #ifdef USE_INSTANCING
      localPosition=instanceMatrix*localPosition;
      localNormal=mat3(instanceMatrix)*localNormal;
    #endif
    vec4 eye=modelViewMatrix*localPosition;
    vec3 outward=normalize(normalMatrix*localNormal);
    vEdgeFacing=abs(dot(outward,normalize(-eye.xyz)));
    vec4 projected=projectionMatrix*eye;
    vec2 screenNormal=vec2(outward.x*projectionMatrix[0][0],
                           outward.y*projectionMatrix[1][1]);
    float screenLength=length(screenNormal);
    if(screenLength>0.0001){
     float breadth=min(${screenWidth.toFixed(6)},
      0.09*projectionMatrix[1][1]/max(1.0,-eye.z));
     projected.xy+=screenNormal/screenLength*projected.w*breadth*strokeScale;
    }
    gl_Position=projected;
   }
  `,
  fragmentShader:`uniform vec3 inkColor;
   uniform float edgeOnly;
   uniform float inkOpacity;
   varying float vEdgeFacing;
   void main(){
    if(edgeOnly>.5&&vEdgeFacing>.30)discard;
    gl_FragColor=vec4(inkColor,inkOpacity);
   }`,
  side:THREE.BackSide,depthTest:true,depthWrite:false,toneMapped:false
 });
 animatedMaterial.userData.inkOutlineShell=true;
 // A real back-face hull cuts through the gaps between individual leaves and
 // paints giant dark polygons inside the crown. Use a thin irregular contour
 // in camera space instead: it has no filled interior, at any camera angle.
 const ringPositions=[],ringIndices=[];
 const ringSegments=48;
 for(let i=0;i<=ringSegments;i++){
  const angle=i*Math.PI*2/ringSegments;
  const distortion=1+.036*Math.sin(angle*5+.8)+.027*Math.sin(angle*11+1.7);
  for(const side of [-1,1])ringPositions.push(
   Math.cos(angle)*distortion,Math.sin(angle)*distortion,side);
  if(i<ringSegments){const at=i*2;
   ringIndices.push(at,at+1,at+2,at+1,at+3,at+2)}
 }
 const canopyRingGeometry=new THREE.BufferGeometry();
 canopyRingGeometry.setAttribute('position',new THREE.Float32BufferAttribute(ringPositions,3));
 canopyRingGeometry.setIndex(ringIndices);
 const canopyRingMaterial=new THREE.ShaderMaterial({
  uniforms:{inkColor:{value:new THREE.Color(color)},inkOpacity:{value:.72},
   canopyCenter:{value:new THREE.Vector3()},canopyRadius:{value:new THREE.Vector2(1,1)}},
  vertexShader:`
   uniform vec3 canopyCenter;
   uniform vec2 canopyRadius;
   void main(){
    vec4 center=vec4(canopyCenter,1.0);
    float treeScale=1.0;
    #ifdef USE_INSTANCING
      center=instanceMatrix*center;
      treeScale=length(instanceMatrix[0].xyz);
    #endif
    vec4 eye=modelViewMatrix*center;
    // Place the contour behind the foliage: its colored leaves naturally
    // hide any parts of the ring that cross the crown's painted edge.
    eye.z-=.65*treeScale;
    vec4 projected=projectionMatrix*eye;
    vec2 projectedRadius=canopyRadius*treeScale*
     vec2(projectionMatrix[0][0],projectionMatrix[1][1])/max(1.0,-eye.z);
    vec2 direction=normalize(position.xy);
    vec2 inkOffset=direction*position.z*.00165;
    projected.xy+=projected.w*(position.xy*projectedRadius+inkOffset);
    gl_Position=projected;
   }`,
  fragmentShader:`uniform vec3 inkColor;
   uniform float inkOpacity;
   void main(){gl_FragColor=vec4(inkColor,inkOpacity);}`,
  side:THREE.DoubleSide,transparent:true,depthTest:true,depthWrite:false,toneMapped:false
 });
 canopyRingMaterial.userData.inkOutlineShell=true;
 const makeInstancedShell=(source,geometry,material,renderOrder)=>{
  const shell=new THREE.InstancedMesh(geometry,material,source.instanceMatrix.count);
  shell.instanceMatrix=source.instanceMatrix;
  shell.count=source.count;
  shell.name='Ukiyo-e animated ink silhouette';
  shell.userData.inkOutlineShell=true;
  shell.castShadow=false;shell.receiveShadow=false;
  shell.frustumCulled=source.frustumCulled;
  shell.renderOrder=renderOrder;
  shell.raycast=()=>{};
  shell.position.copy(source.position);shell.quaternion.copy(source.quaternion);
  shell.scale.copy(source.scale);
  source.parent.add(shell);
  animatedShells.set(source,shell);
  return shell;
 };
 const attachInstanced=(source,{geometry=source?.geometry,strokeScale=.7,
  edgeOnly=false,opacity=1}={})=>{
  if(!source?.isInstancedMesh||!source.parent)return null;
  if(animatedShells.has(source))return animatedShells.get(source);
  const material=animatedMaterial.clone();
  material.uniforms.strokeScale.value=strokeScale;
  material.uniforms.edgeOnly.value=Number(edgeOnly);
  material.uniforms.inkOpacity.value=opacity;
  material.transparent=opacity<1;
  return makeInstancedShell(source,geometry,material,edgeOnly?2.2:1);
 };
 const attachCanopyBand=(source,{center,radius,opacity=.72}={})=>{
  if(!source?.isInstancedMesh||!source.parent)return null;
  if(animatedShells.has(source))return animatedShells.get(source);
  const material=canopyRingMaterial.clone();
  material.uniforms.canopyCenter.value.copy(center);
  material.uniforms.canopyRadius.value.copy(radius);
  material.uniforms.inkOpacity.value=opacity;
  // syncInstanced supplies the visible source crown's conservative bounds.
  return makeInstancedShell(source,canopyRingGeometry,material,2.2);
 };
 const detachInstanced=source=>{
  const shell=animatedShells.get(source);
  if(!shell)return;
  animatedShells.delete(source);shell.parent?.remove(shell);
  shell.material.dispose();
  // The outline's geometry and instance matrix are owned by the source.
 };
 const syncInstanced=()=>{
  for(const [source,shell] of animatedShells){
   shell.count=source.count;
   shell.visible=animatedEnabled&&source.visible&&source.parent?.visible!==false;
   // Stockpiles may move with their buildings after an outline was attached.
   // Their instanced shells must follow the same local transform each frame.
   shell.position.copy(source.position);shell.quaternion.copy(source.quaternion);
   shell.scale.copy(source.scale);
   if(source.boundingSphere) shell.boundingSphere=source.boundingSphere;
  }
 };
 const setAnimatedEnabled=enabled=>{
  animatedEnabled=Boolean(enabled);syncInstanced();
 };
 return {attach,attachInstanced,attachCanopyBand,detachInstanced,syncInstanced,setAnimatedEnabled,
  shade,shadeMaterial:markMaterial,dispose(){
  for(const source of [...animatedShells.keys()])detachInstanced(source);
  animatedMaterial.dispose();canopyRingMaterial.dispose();canopyRingGeometry.dispose();
  for(const material of shellMaterials)material.dispose();
  shellMaterial.dispose();
 }};
}
