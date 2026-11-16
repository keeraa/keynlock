import { createRoundedPanelGeometry } from '../geometry/rounded-panel.js';
import { renderScissorPreview } from './preview-utils.js';
import { createEventScope } from './event-scope.js';

/** Five *real* tension-wrench meshes, cloned from the live lock into one shared-renderer preview. */
export function createWrenchPickerPreview({THREE,canvas,renderer,window,picker,tensionModels,tensionSpecs=[]}) {
  const buttons=[...picker.querySelectorAll('.wrench-choice')];
  const scene=new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xe9e5dd,0x172935,2.1));
  const key=new THREE.DirectionalLight(0xffe7b9,3.6);
  key.position.set(-3,5,9);scene.add(key);
  const rim=new THREE.DirectionalLight(0x95c1d3,2.2);
  rim.position.set(4,-2,5);scene.add(rim);
  const camera=new THREE.OrthographicCamera(-5,5,1.55,-1.55,.1,40);
  camera.position.set(0,0,12);camera.lookAt(0,0,0);
  const panelMaterial=new THREE.MeshBasicMaterial({color:0x15262d,depthTest:false,depthWrite:false,
    toneMapped:false});
  const panel=new THREE.Mesh(new THREE.BufferGeometry(),panelMaterial);
  panel.name='wrench-picker-panel';
  panel.renderOrder=-100;
  panel.position.z=-6;
  scene.add(panel);
  const entries=buttons.map(button=>{
    const source=tensionModels[Number(button.dataset.wrench)];
    const model=source.clone(true);
    model.visible=true;
    const center=new THREE.Box3().setFromObject(model).getCenter(new THREE.Vector3());
    model.position.sub(center);
    const materials=[];
    model.traverse(part=>{
      if(!part.isMesh)return;
      // Independent materials allow hover lighting without modifying a wrench in the actual lock.
      part.material=part.material.clone();
      part.material.metalness=.55;
      part.material.roughness=.33;
      part.material.emissive=new THREE.Color(0x362c1d);
      materials.push(part.material);
      part.castShadow=false;part.receiveShadow=false;
    });
    const tilt=new THREE.Group();
    tilt.add(model);
    // Reverse top/bottom. The working ends now point down, while the shaped
    // rear ends protrude above the screen edge. Align each shaft's endpoints
    // exactly vertically, even when its original path has a gentle diagonal.
    const path=tensionSpecs[Number(button.dataset.wrench)]?.path;
    const first=path?.[0],last=path?.[path.length-1];
    const shaftAngle=first&&last?Math.atan2(last[1]-first[1]+.085,last[0]-first[0]):0;
    tilt.rotation.set(-.72,0,-Math.PI/2-shaftAngle);
    tilt.scale.setScalar(1.65);
    // The geometric middle rests exactly at the lower edge of the 3D window:
    // only the upper half of each complete tool remains inside the viewport.
    const bounds=new THREE.Box3().setFromObject(tilt);
    const visualCenterX=(bounds.min.x+bounds.max.x)*.5;
    const visualCenterY=(bounds.min.y+bounds.max.y)*.5;
    scene.add(tilt);
    return {button,model,tilt,materials,visualCenterX,visualCenterY,baseY:0};
  });
  let hovered=null;
  const events=createEventScope();
  for(const {button} of entries){
    events.listen(button,'pointerenter',()=>{hovered=button;});
    events.listen(button,'pointerleave',()=>{if(hovered===button)hovered=null;});
    events.listen(button,'focus',()=>{hovered=button;});
    events.listen(button,'blur',()=>{if(hovered===button)hovered=null;});
  }
  const viewport={x:0,y:0,width:0,height:0,visible:false};
  let renderWidth=1,renderHeight=1;
  function updatePanel(width,height,radius){
    const geometry=createRoundedPanelGeometry(THREE,{left:-width/2,bottom:-1.55,width,height,radius});
    panel.geometry.dispose();
    panel.geometry=geometry;
  }
  function updateWrenchPickerViewport(){
    if(disposed)return;
    const rect=picker.getBoundingClientRect(),bounds=canvas.getBoundingClientRect();
    viewport.visible=rect.width>0&&rect.height>0&&rect.left<bounds.right&&rect.top<bounds.bottom;
    if(!viewport.visible)return;
    viewport.x=Math.max(0,Math.round(rect.left-bounds.left));
    viewport.y=Math.max(0,Math.round(bounds.bottom-rect.bottom));
    viewport.width=Math.min(Math.round(rect.width),renderWidth-viewport.x);
    // The handles lift out of their shared panel; allow extra pixels above it
    // without zooming out or changing the original button hit areas.
    const headroom=Math.max(0,Math.min(96,Math.floor(rect.top-bounds.top)));
    viewport.height=Math.min(Math.round(rect.height)+headroom,renderHeight-viewport.y);
    if(viewport.width<=0||viewport.height<=0){viewport.visible=false;return;}
    const aspect=rect.width/rect.height,halfHeight=1.55;
    camera.left=-halfHeight*aspect;
    camera.right=halfHeight*aspect;
    camera.top=halfHeight+(viewport.height-rect.height)*2*halfHeight/rect.height;
    camera.bottom=-halfHeight;
    camera.updateProjectionMatrix();
    updatePanel(camera.right-camera.left,2*halfHeight,16*2*halfHeight/rect.height);
    for(const entry of entries){
      const {button,tilt,visualCenterX,visualCenterY}=entry;
      const buttonRect=button.getBoundingClientRect();
      tilt.position.x=((buttonRect.left+buttonRect.width*.5-rect.left)/rect.width-.5)*
        (camera.right-camera.left)-visualCenterX;
      // Bring every protruding handle closer to the top of its button.
      entry.baseY=camera.bottom-visualCenterY+.38;
      tilt.position.y=entry.baseY;
    }
  }
  events.listen(window,'resize',updateWrenchPickerViewport,{passive:true});
  function renderWrenchPickerPreview(){
    if(disposed)return null;
    if(!viewport.visible)return null;
    for(const {button,tilt,materials,baseY} of entries){
      const selected=button.classList.contains('active');
      const hover=hovered===button;
      // A chosen wrench clearly protrudes above its unselected neighbours.
      const target=baseY+(hover ? (selected ? .72 : .60) : selected ? .37 : 0);
      tilt.position.y+=(target-tilt.position.y)*.18;
      for(const metal of materials)metal.emissiveIntensity=hover ? .7 : selected ? .4 : .10;
    }
    return renderScissorPreview({renderer,scene,camera,viewport,renderWidth,renderHeight});
  }
  function setRenderSize(width,height){renderWidth=width;renderHeight=height;}
  let disposed=false;
  function dispose(){
    if(disposed)return;
    disposed=true;
    events.dispose();
    for(const {materials} of entries)for(const metal of materials)metal.dispose();
    panel.geometry.dispose();panelMaterial.dispose();
    for(const {tilt} of entries)scene.remove(tilt);
    scene.remove(panel);
    scene.clear();
    viewport.visible=false;
    hovered=null;
  }
  return {updateWrenchPickerViewport,renderWrenchPickerPreview,setRenderSize,dispose,
    previewScene:scene,previewEntries:entries};
}
