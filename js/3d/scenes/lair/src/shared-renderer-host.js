import * as THREE from 'three';
import {createWorldStationRegistry} from './world-stations.js';

/**
 * The three preserved workshops use their exact source files and their own
 * controls and UI. All GPU work is submitted to the one WebGLRenderer/canvas
 * owned by the Keynlock room. No embedded document can create a GPU context.
 */
export function createSharedRendererHost({renderer,canvas,worldScene}) {
  const instances = new Map();
  const stationSettings = new Map();
  const workshops = new Map();
  let activeWorkshop = null;
  const world = worldScene ? createWorldStationRegistry(worldScene) : null;
  let active = null;
  const captureSettings = () => ({
    outputColorSpace:renderer.outputColorSpace,
    toneMapping:renderer.toneMapping,
    toneMappingExposure:renderer.toneMappingExposure,
    shadowEnabled:renderer.shadowMap.enabled,
    shadowType:renderer.shadowMap.type,
    shadowAutoUpdate:renderer.shadowMap.autoUpdate,
    autoClear:renderer.autoClear,
    autoReset:renderer.info.autoReset,
    clearColor:renderer.getClearColor(new THREE.Color()).clone(),
    clearAlpha:renderer.getClearAlpha(),
  });
  const hostSettings = captureSettings();
  const snapshot = settings => ({...settings,clearColor:settings.clearColor.clone()});

  function applySettings(settings) {
    renderer.outputColorSpace=settings.outputColorSpace;
    renderer.toneMapping=settings.toneMapping;
    renderer.toneMappingExposure=settings.toneMappingExposure;
    renderer.shadowMap.enabled=settings.shadowEnabled;
    renderer.shadowMap.type=settings.shadowType;
    renderer.shadowMap.autoUpdate=settings.shadowAutoUpdate;
    renderer.shadowMap.needsUpdate=true;
    renderer.autoClear=settings.autoClear;
    renderer.info.autoReset=settings.autoReset;
    renderer.setClearColor(settings.clearColor,settings.clearAlpha);
  }

  function viewportFor(localCanvas) {
    const frame=localCanvas.ownerDocument.defaultView.frameElement;
    if (!frame) return {x:0,y:0,w:canvas.clientWidth,h:canvas.clientHeight};
    const frameRect=frame.getBoundingClientRect();
    const localRect=localCanvas.getBoundingClientRect();
    const parentRect=canvas.getBoundingClientRect();
    const pixelRatio=renderer.getPixelRatio();
    const x=Math.max(0,Math.round((frameRect.left+localRect.left-parentRect.left)*pixelRatio));
    const w=Math.max(1,Math.round(localRect.width*pixelRatio));
    const h=Math.max(1,Math.round(localRect.height*pixelRatio));
    const top=Math.round((frameRect.top+localRect.top-parentRect.top)*pixelRatio);
    const canvasHeight=renderer.getDrawingBufferSize(new THREE.Vector2()).y;
    return {x,y:Math.max(0,canvasHeight-top-h),w,h};
  }

  function makeRenderer(station,localCanvas) {
    if (!['restoration','alchemy','workbench'].includes(station))
      throw new Error('Unknown KEYNLOCK station');
    const local = {
      canvas:localCanvas, pixelRatio:Math.min(localCanvas.ownerDocument.defaultView.devicePixelRatio||1,1.65),
      width:localCanvas.clientWidth||1, height:localCanvas.clientHeight||1,
      loop:null,raf:0,scene:null,camera:null,settings:snapshot(stationSettings.get(station)||hostSettings),
    };
    instances.set(station,local);
    const shadowMap = new Proxy(renderer.shadowMap,{
      get(target,key){
        if(key==='enabled')return local.settings.shadowEnabled;
        if(key==='type')return local.settings.shadowType;
        if(key==='autoUpdate')return local.settings.shadowAutoUpdate;
        return Reflect.get(target,key,target);
      },
      set(target,key,value){
        const setting = key==='enabled'?'shadowEnabled':key==='type'?'shadowType':
          key==='autoUpdate'?'shadowAutoUpdate':null;
        if(setting)local.settings[setting]=value;
        if(active===station||!setting)Reflect.set(target,key,value,target);
        return true;
      },
    });
    const overrides = {
      domElement:()=>local.canvas,
      shadowMap:()=>shadowMap,
      getPixelRatio:()=>()=>local.pixelRatio,
      getSize:()=>(target)=>target.set(local.width,local.height),
      getDrawingBufferSize:()=>(target)=>target.set(
        Math.round(local.width*local.pixelRatio),Math.round(local.height*local.pixelRatio)),
      setPixelRatio:()=>(next)=>{local.pixelRatio=next;},
      setSize:()=>(w,h,updateStyle=true)=>{
        local.width=w;local.height=h;
        local.canvas.width=Math.round(w*local.pixelRatio);
        local.canvas.height=Math.round(h*local.pixelRatio);
        if(updateStyle){local.canvas.style.width=`${w}px`;local.canvas.style.height=`${h}px`;}
      },
      setClearColor:()=>(color,alpha=1)=>{
        local.settings.clearColor.set(color);
        local.settings.clearAlpha=alpha;
        if(active===station)renderer.setClearColor(color,alpha);
      },
      getClearColor:()=>(target)=>target.copy(local.settings.clearColor),
      getClearAlpha:()=>()=>local.settings.clearAlpha,
      clear:()=> (...args)=>{
        if(active!==station)return;
        if(renderer.getRenderTarget()){renderer.clear(...args);return;}
        const oldScissor=renderer.getScissor(new THREE.Vector4()).clone();
        const oldEnabled=renderer.getScissorTest();
        const {x,y,w,h}=viewportFor(localCanvas);
        renderer.setScissor(x,y,w,h);
        renderer.setScissorTest(true);
        renderer.clear(...args);
        renderer.setScissorTest(oldEnabled);
        renderer.setScissor(oldScissor);
      },
      clearDepth:()=>()=>{
        if(active!==station)return;
        if(renderer.getRenderTarget()){renderer.clearDepth();return;}
        const oldScissor=renderer.getScissor(new THREE.Vector4()).clone();
        const oldEnabled=renderer.getScissorTest();
        const {x,y,w,h}=viewportFor(localCanvas);
        renderer.setScissor(x,y,w,h);
        renderer.setScissorTest(true);
        renderer.clearDepth();
        renderer.setScissorTest(oldEnabled);
        renderer.setScissor(oldScissor);
      },
      dispose:()=>()=>{},
      setAnimationLoop:()=>fn=>{
        if(local.raf)cancelAnimationFrame(local.raf);
        local.loop=fn;
        if(!fn)return;
        const tick=now=>{
          if(!local.loop)return;
          if(active===station || activeWorkshop===station)local.loop(now);
          local.raf=requestAnimationFrame(tick);
        };
        local.raf=requestAnimationFrame(tick);
      },
      render:()=> (scene,camera)=>{
        if(active!==station)return;
        local.scene=scene;local.camera=camera;
        world?.update();
        const target=renderer.getRenderTarget();
        if(target){renderer.render(scene,camera);return;}
        if(!localCanvas.isConnected||!localCanvas.clientWidth||!localCanvas.clientHeight)return;
        const oldViewport=renderer.getViewport(new THREE.Vector4()).clone();
        const oldScissor=renderer.getScissor(new THREE.Vector4()).clone();
        const oldEnabled=renderer.getScissorTest();
        const {x,y,w,h}=viewportFor(localCanvas);
        renderer.setViewport(x,y,w,h);
        renderer.setScissor(x,y,w,h);
        renderer.setScissorTest(true);
        try{renderer.render(scene,camera);}
        finally{
          renderer.setScissorTest(oldEnabled);
          renderer.setViewport(oldViewport);
          renderer.setScissor(oldScissor);
        }
      },
    };
    return new Proxy(renderer,{
      get(target,key) {
        if(Object.hasOwn(overrides,key))return overrides[key]();
        if(key==='outputColorSpace'||key==='toneMapping'||key==='toneMappingExposure'||key==='autoClear')
          return local.settings[key];
        const value=Reflect.get(target,key,target);
        return typeof value==='function'?value.bind(target):value;
      },
      set(target,key,value){
        if(key==='outputColorSpace'||key==='toneMapping'||key==='toneMappingExposure'||key==='autoClear'){
          local.settings[key]=value;
          if(active===station)Reflect.set(target,key,value,target);
          return true;
        }
        Reflect.set(target,key,value,target);
        return true;
      },
    });
  }

  function activate(station) {
    active=station;
    world?.setLighting(station);
    const local=instances.get(station);
    applySettings(stationSettings.get(station)||local?.settings||hostSettings);
    // Stop carrying the former station's stencil / render target into this one.
    renderer.setRenderTarget(null);
    renderer.setScissorTest(false);
    renderer.setViewport(0,0,canvas.width,canvas.height);
    renderer.shadowMap.needsUpdate=true;
    renderer.clear();
  }
  function deactivate(station) {
    if(active!==station)return;
    stationSettings.set(station,captureSettings());
    const local=instances.get(station);
    if(local)local.settings=snapshot(stationSettings.get(station));
    active=null;
    world?.setLighting(null);
    // Keep the original workshop application alive in its document. On return,
    // the same state and simulation loop resume with no new WebGL context.
    renderer.setRenderTarget(null);
    renderer.setScissorTest(false);
    applySettings(hostSettings);
    renderer.setViewport(0,0,canvas.width,canvas.height);
  }

  // An in-room workshop implements enter(), exit(), and update(now).
  // Its geometry stays mounted, including while the workshop is inactive.
  function registerWorldWorkshop(station, lifecycle, { interval = 0 } = {}) {
    workshops.set(station, { lifecycle, interval, nextAt: 0 });
    if (activeWorkshop === station) lifecycle.enter();
    return () => {
      if (workshops.get(station)?.lifecycle !== lifecycle) return;
      if (activeWorkshop === station) setWorldWorkshop(null);
      workshops.delete(station);
    };
  }

  function setWorldWorkshop(station) {
    if (activeWorkshop === station) return;
    const previous = workshops.get(activeWorkshop);
    activeWorkshop = station;
    previous?.lifecycle.exit();
    const next = workshops.get(station);
    if (!next) return; // The source module may still be loading.
    next.nextAt = 0;
    next.lifecycle.enter();
  }

  function stepWorldRuntime(now) {
    const station = activeWorkshop;
    const state = workshops.get(station);
    if (!state || now < state.nextAt) return;
    const started = performance.now();
    try {
      state.lifecycle.update(now);
    } catch (error) {
      setWorldWorkshop(null);
      console.error(`KEYNLOCK ${station} simulation failed`, error);
      const event = station === 'restoration' ? 'keynlock:atelier' : 'keynlock:alchemy:v1';
      window.dispatchEvent(new CustomEvent(event, {
        detail: { type: 'error', message: error?.message || String(error) },
      }));
      return;
    }
    if (state.interval) state.nextAt = now + Math.max(state.interval, (performance.now() - started) * 1.6);
  }

  return {createRenderer:makeRenderer,activate,deactivate,
    registerWorldWorkshop,setWorldWorkshop,stepWorldRuntime,
    registerWorldScene:(station,options)=>world?.register(station,options),
    getWorldPose:station=>world?.pose(station)||null,
    setWorldSlotActive:(station,slot)=>world?.selectSlot(station,slot),
    setWorldLighting:station=>world?.setLighting(station),
    prepareWorldLightsForRender:()=>world?.prepareLightsForRender(),
    restoreWorldLightsAfterRender:()=>world?.restoreLightsAfterRender(),
    // The preserved Atelier postprocessor renders this same THREE.Scene,
    // including the Lair architecture and original art meshes.
    getUnifiedScene:()=>worldScene,
    updateWorld:()=>world?.update(),
    hasWorldScene:station=>Boolean(world?.has(station)),
    world,
    current:()=>active,stats:()=>[...instances.keys()]};
}
