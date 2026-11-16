import { renderScissorPreview, disposeOwnedPreviewScene } from './preview-utils.js';
import { createEventScope } from './event-scope.js';

/** Render the miniature oil can in a cached scissor rectangle. */
export function createOilToolPreview({canvas,renderer,window,button,
  oilPreviewScene,oilPreviewCamera,oilPreviewCan}) {
  const viewport={x:0,y:0,width:0,height:0,visible:false};
  let renderWidth=1,renderHeight=1;
  function updateOilPreviewViewport() {
    if(disposed)return;
    const rect=button.getBoundingClientRect();
    const canvasRect=canvas.getBoundingClientRect();
    viewport.visible=Boolean(rect.width&&rect.height&&rect.left<canvasRect.right);
    if(!viewport.visible)return;
    viewport.x=Math.round(rect.left-canvasRect.left);
    viewport.y=Math.round(canvasRect.bottom-rect.bottom);
    viewport.width=Math.round(rect.width);
    viewport.height=Math.round(rect.height);
    oilPreviewCamera.aspect=rect.width/rect.height;
    oilPreviewCamera.updateProjectionMatrix();
    const panel=oilPreviewScene.getObjectByName?.('oil-preview-panel');
    if(panel)panel.scale.x=oilPreviewCamera.aspect/panel.userData.baseAspect;
  }
  const events=createEventScope();
  events.listen(window,'resize',updateOilPreviewViewport,{passive:true});
  function renderOilToolPreview(now) {
    if(disposed)return null;
    if(!viewport.visible)return null;
    oilPreviewCan.rotation.y=-.37+Math.sin(now*.00042)*.11;
    return renderScissorPreview({renderer,scene:oilPreviewScene,camera:oilPreviewCamera,
      viewport,renderWidth,renderHeight});
  }
  function setRenderSize(width,height){renderWidth=width;renderHeight=height;}
  let disposed=false;
  function dispose(){
    if(disposed)return;
    disposed=true;
    events.dispose();
    if(oilPreviewScene.traverse)disposeOwnedPreviewScene(oilPreviewScene);
    viewport.visible=false;
  }
  return {updateOilPreviewViewport,renderOilToolPreview,setRenderSize,dispose};
}
