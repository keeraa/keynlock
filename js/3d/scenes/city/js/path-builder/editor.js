import {createPathBuilderScene} from './scene.js';
import {populateLandmarkPreviews} from './landmark-previews.js';
import {createMapEditor} from './editor-controller.js';
import {createEditorView} from './editor-view.js';

const view=createEditorView();
async function bootstrap(){
  const editor=createMapEditor({view});
  const callbacks={
    isPlacementValid:editor.isValid,onPlace:editor.place,onMove:editor.move,
    onMoveEnd:editor.endMove,onMoveCancel:editor.cancelMove,onSelect:editor.setSelected,
    onLandscapeStroke:points=>editor.landscapeStroke(points,view.brushSettings()),
    onLandscapeAction:(mode,at)=>editor.landscapeAction(mode,at,view.brushSettings()),
    onEraseBridge:editor.eraseBridge,onMetrics:view.metrics,
  };
  let scene;
  try{scene=createPathBuilderScene(view.canvas,callbacks);}
  catch(error){
    console.warn('WebGL unavailable, opening the editable 2D construction plan:',error);
    const {createPathBuilderFallback}=await import('./fallback.js');
    scene=createPathBuilderFallback(view.canvas,callbacks);
    view.setModeText('План участка · 2D-режим (WebGL недоступен)');
  }
  view.bind(editor);
  editor.start(scene,{pathsVisible:view.pathsVisible});
  const stop=new AbortController();
  const startPreview=()=>populateLandmarkPreviews().catch(error=>
    console.warn('Special building previews not available:',error));
  const supportsIdle='requestIdleCallback' in window;
  const previewTask=supportsIdle?window.requestIdleCallback(startPreview,{timeout:1600}):
    window.setTimeout(startPreview,500);
  window.addEventListener('pagehide',event=>{
    if(event.persisted)return;
    stop.abort();
    if(supportsIdle)window.cancelIdleCallback(previewTask);else window.clearTimeout(previewTask);
    view.dispose();
    editor.dispose();
  },{signal:stop.signal});
  window.__keynlockPathBuilder={
    getState:editor.getState,getLandscape:editor.getLandscape,getLayout:editor.getLayout,
    getMetrics:editor.getMetrics,getMode:editor.getMode,getActiveTab:view.getActiveTab,
  };
}
bootstrap().catch(error=>{
  console.error('KEYNLOCK path builder failed to initialize:',error);
  view.showError();
});
