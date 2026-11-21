import * as THREE from 'three';
import {OrbitControls} from '../../vendor/OrbitControls.js';
import {createHouseModel,createHouseAtmosphere,createHouseGlass} from '../../modules/house-builder/index.js';
import {batchHouseGeometry} from '../../modules/house-builder/core/house-batch.js';
import {createLandmarkModel} from '../landmarks/landmark-model.js';
import {createCartoonFilter} from '../effects/cartoon-filter.js';
import {createPathPainter} from './path-painter.js';
import {createTerrainMeshUpdater} from './terrain-mesh.js';
import {attachOpaqueWaterSurface,attachWaterbedCutout} from './water-bed-cutout.js';
import {KEYNLOCK_WATER_LEVEL} from './keynlock-geography.js';
import {createGroundSurface} from './ground-art.js';
import {BUILDING_GHOST_RENDER_ORDER,createFoundationShadedMaterial,
  createPlacementRoadCutout,setFoundationBase} from './building-ground-contact.js';
import {MODEL_TYPES,referenceFootprint} from './model-types.js';
import {createLandscapeSampler,LANDSCAPE_BOUNDS} from './landscape-model.js';
import {createStoneBridge,loadBridgeStoneTexture} from './stone-bridge.js';
import {createGrandBridge} from './grand-bridge.js';
import {KEYNLOCK_FIXED_BRIDGES} from './keynlock-fixed-bridges.js';
import {createCityTrees} from './tree-art.js';

export {MODEL_TYPES} from './model-types.js';

const WIDTH=LANDSCAPE_BOUNDS.width,DEPTH=LANDSCAPE_BOUNDS.depth;
const snap=n=>Math.round(n*2)/2;

function createBuilding(houseGlass,type,customConfig=null,customAtmosphere=null){
  const def=MODEL_TYPES[type];if(!def)throw Error(`Неизвестное здание: ${type}`);
  const model=def.kind==='landmark'?createLandmarkModel(THREE,type,{detail:'low'}):
    createHouseModel(THREE,customConfig||def.config,{detail:'low',glass:houseGlass});
  // The models still use their real painted geometry. Merge static pieces by
  // material here to keep hundreds of houses/landmark details from becoming
  // thousands of GPU draw calls in this continuously edited scene.
  batchHouseGeometry(THREE,model.group);
  const group=model.group;group.scale.setScalar(def.scale);group.updateMatrixWorld(true);
  const atmosphere=type==='custom-house'?createHouseAtmosphere(THREE,customConfig,
    {detail:'low',settings:customAtmosphere||{}}):null;
  if(atmosphere)group.add(atmosphere.group);
  // Dimensions and real staircase access were measured from THIS model's
  // approved geometry, then shared with the fallback. No per-object Box3 scan.
  const {width,depth,pathAccess}=referenceFootprint(type,customConfig);
  const foundationMaterials=new Map();
  group.traverse(object=>{
    if(!object.isMesh||object.userData.houseMoss)return;
    object.castShadow=object.geometry?.type!=='PlaneGeometry';
    object.receiveShadow=true;
    const paint=material=>{
      // House windows sit above the foundation wash and share scene lighting.
      if(material===houseGlass.material)return material;
      if(!foundationMaterials.has(material))
        foundationMaterials.set(material,createFoundationShadedMaterial(material));
      return foundationMaterials.get(material);
    };
    object.material=Array.isArray(object.material)?object.material.map(paint):paint(object.material);
  });
  return {model,group,width,depth,pathAccess,kind:def.kind,type,
    configKey:JSON.stringify([customConfig||null,customAtmosphere||null]),atmosphere,
    foundationMaterials:new Set(foundationMaterials.values())};
}

function footprintOutline(width,depth){
  const hw=width/2+.28,hd=depth/2+.28,y=.22;
  const p=[[-hw,-hd],[hw,-hd],[hw,hd],[-hw,hd],[-hw,-hd]];
  const curve=new THREE.CurvePath();
  for(let i=1;i<p.length;i++)curve.add(new THREE.LineCurve3(
    new THREE.Vector3(p[i-1][0],y,p[i-1][1]),new THREE.Vector3(p[i][0],y,p[i][1])));
  const mesh=new THREE.Mesh(new THREE.TubeGeometry(curve,48,.12,6,false),new THREE.MeshBasicMaterial({color:'#fff4d6',depthWrite:false}));
  mesh.userData.noOutline=true;mesh.renderOrder=5;return mesh;
}

export function createPathBuilderScene(canvas,callbacks={}){
  const root=canvas.parentElement;
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.3;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate=false;
  const scene=new THREE.Scene();scene.background=new THREE.Color('#d4d6c4');
  const houseGlass=createHouseGlass(THREE);
  const camera=new THREE.OrthographicCamera(-64,64,45,-45,.1,10000);
  camera.position.set(42,89,91);camera.lookAt(0,0,0);
  const controls=new OrbitControls(camera,canvas);controls.target.set(0,0,0);
  controls.enableDamping=true;controls.dampingFactor=.095;
  controls.minPolarAngle=.09;controls.maxPolarAngle=1.42;
  controls.minZoom=.008;controls.maxZoom=4.5;controls.panSpeed=.75;
  controls.mouseButtons.LEFT=THREE.MOUSE.ROTATE;
  controls.mouseButtons.RIGHT=THREE.MOUSE.PAN;
  scene.add(new THREE.HemisphereLight('#fff2d3','#64866d',2.35));
  const sun=new THREE.DirectionalLight('#fff0c9',3.0);sun.position.set(-33,79,52);sun.castShadow=true;
  sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-92;sun.shadow.camera.right=92;
  sun.shadow.camera.top=92;sun.shadow.camera.bottom=-92;sun.shadow.camera.far=320;
  sun.shadow.normalBias=.037;scene.add(sun);
  const fill=new THREE.DirectionalLight('#adc9bf',.6);fill.position.set(43,39,-51);scene.add(fill);
  let groundTexture,decalsTexture,waterTexture,painter=null;
  const groundSurface=createGroundSurface({composeFor2D:false,onUpdate:({baseChanged,decalsChanged,waterChanged})=>{
    if(baseChanged&&groundTexture)groundTexture.needsUpdate=true;
    if(decalsChanged&&decalsTexture)decalsTexture.needsUpdate=true;
    if(waterChanged&&waterTexture){
      waterTexture.needsUpdate=true;
      painter?.refreshWaterMask();
    }
  }});
  groundTexture=new THREE.CanvasTexture(groundSurface.baseCanvas);
  groundTexture.colorSpace=THREE.SRGBColorSpace;groundTexture.anisotropy=4;
  decalsTexture=new THREE.CanvasTexture(groundSurface.decalsCanvas);
  decalsTexture.colorSpace=THREE.SRGBColorSpace;decalsTexture.anisotropy=4;
  waterTexture=new THREE.CanvasTexture(groundSurface.waterCanvas);
  waterTexture.colorSpace=THREE.SRGBColorSpace;waterTexture.anisotropy=4;
  const terrainMesh=createTerrainMeshUpdater(THREE);
  let groundGeometry=terrainMesh.geometry;
  // From the low camera angles near deep canals, steep bank triangles can be
  // seen from behind. Render both sides so the sky cannot show through them.
  const groundMaterial=new THREE.MeshStandardMaterial({map:groundTexture,roughness:1,
    metalness:0,side:THREE.DoubleSide});
  attachWaterbedCutout(groundMaterial,waterTexture);
  const ground=new THREE.Mesh(groundGeometry,groundMaterial);ground.rotation.x=-Math.PI/2;ground.position.y=-.034;
  ground.receiveShadow=true;ground.userData.noOutline=true;scene.add(ground);
  // One lightweight overlay plane holds ALL foundation shadows and road edge
  // washes. A dragged building never causes a full base texture GPU upload.
  const decalsMaterial=new THREE.MeshStandardMaterial({map:decalsTexture,transparent:true,
    roughness:1,metalness:0,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1});
  attachWaterbedCutout(decalsMaterial,waterTexture);
  const groundDecals=new THREE.Mesh(groundGeometry,decalsMaterial);
  groundDecals.rotation.x=-Math.PI/2;groundDecals.position.y=-.031;
  groundDecals.userData.noOutline=true;groundDecals.renderOrder=1;scene.add(groundDecals);
  // One world-aligned alpha-cutout for the UNION of every river. Individual
  // ribbons used to fold into huge triangles at bends and overlap at joins.
  // Two stable triangles remain correct from every camera angle.
  const waterGeometry=new THREE.PlaneGeometry(WIDTH,DEPTH);
  const waterMaterial=new THREE.MeshBasicMaterial({map:waterTexture,
    toneMapped:false,opacity:1,
    side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1});
  attachOpaqueWaterSurface(waterMaterial);
  const waterPlane=new THREE.Mesh(waterGeometry,waterMaterial);
  waterPlane.rotation.x=-Math.PI/2;waterPlane.position.y=KEYNLOCK_WATER_LEVEL;
  waterPlane.renderOrder=2;waterPlane.visible=false;waterPlane.userData.noOutline=true;
  scene.add(waterPlane);
  // Only the four perimeter rails: an old full-area slab sat ABOVE the river
  // bed and occluded the excavated channels and their water surface.
  const borderMaterial=new THREE.MeshStandardMaterial({color:'#8d9c82',roughness:1});
  const border=new THREE.Group();
  for(const [w,d,x,z] of [[WIDTH+.75,.65,0,-DEPTH/2],[WIDTH+.75,.65,0,DEPTH/2],
    [.65,DEPTH+.75,-WIDTH/2,0],[.65,DEPTH+.75,WIDTH/2,0]]){
    const rail=new THREE.Mesh(new THREE.BoxGeometry(w,.22,d),borderMaterial);
    rail.position.set(x,-.18,z);rail.userData.noOutline=true;border.add(rail);
  }
  scene.add(border);
  const gridVertices=[];
  for(let x=-WIDTH/2+2;x<=WIDTH/2-2;x+=4)gridVertices.push(x,.058,-DEPTH/2+2,x,.058,DEPTH/2-2);
  for(let z=-DEPTH/2+2;z<=DEPTH/2-2;z+=4)gridVertices.push(-WIDTH/2+2,.058,z,WIDTH/2-2,.058,z);
  const gridGeometry=new THREE.BufferGeometry();gridGeometry.setAttribute('position',new THREE.Float32BufferAttribute(gridVertices,3));
  const grid=new THREE.LineSegments(gridGeometry,new THREE.LineBasicMaterial({color:'#385f4c',transparent:true,opacity:.19,depthWrite:false}));
  grid.visible=false;grid.renderOrder=3;grid.userData.noOutline=true;scene.add(grid);
  let gridDirty=true;
  painter=createPathPainter(THREE,scene,{waterMaskCanvas:groundSurface.waterCanvas,
    waterMaskTexture:waterTexture});
  const cityTrees=createCityTrees(THREE,scene);
  let terrain=createLandscapeSampler({rivers:[],hills:[],bridges:[]});
  let lastLandscape=null;
  const bridgeStoneTexture=loadBridgeStoneTexture(THREE);
  const bridgeRoadMaterial=new THREE.MeshBasicMaterial({map:painter.stoneTexture,
    color:'#f9efd9',toneMapped:true,side:THREE.DoubleSide,depthWrite:true});
  const fixedBridgeModels=KEYNLOCK_FIXED_BRIDGES.map(profile=>{
    const model=createGrandBridge(THREE,profile,bridgeStoneTexture,bridgeRoadMaterial);
    scene.add(model.group);return model;
  });
  let bridgeModels=[],waterTriangles=0;
  const filter=createCartoonFilter({THREE,renderer,scene,camera});
  filter.setOptions({toon:true,toonStrength:.28,bands:5,outline:true,outlineStrength:.32,outlineWidth:1});

  const records=new Map(),raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2(),point=new THREE.Vector3();
  const floorPlane=new THREE.Plane(new THREE.Vector3(0,1,0),0);
  const tooltip=document.getElementById('objectTooltip');
  let selected=null,tool=null,landscapeTool=null,landscapeDrag=null,ghost=null,outline=null,drag=null,viewTween=null;
  const markerGeometry=new THREE.CylinderGeometry(.25,.25,.065,12);
  const markerMaterial=new THREE.MeshBasicMaterial({color:'#fff3d6'});
  let markers=null,frames=0,fpsStart=0;
  let running=true,active=true,frameHandle=0;
  const eventController=new AbortController();
  const draftMaterial=new THREE.LineBasicMaterial({color:'#4a8890',transparent:true,opacity:.9,depthTest:false});
  let draftLine=null;

  const screenPoint=event=>{
    const rect=canvas.getBoundingClientRect();
    pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);
    raycaster.setFromCamera(pointer,camera);
    // Raycasting every 24-metre terrain tile (up to 68K triangles) per mouse
    // event made dragging and river drawing stall. Intersect the flat plane,
    // then converge onto the same height sampler used by the mesh instead.
    if(!raycaster.ray.intersectPlane(floorPlane,point))return null;
    if(Math.abs(raycaster.ray.direction.y)>.01)for(let i=0;i<3;i++){
      const height=terrain.heightAt(point.x,point.z)-.034;
      point.addScaledVector(raycaster.ray.direction,(height-point.y)/raycaster.ray.direction.y);
    }
    return {x:snap(point.x),z:snap(point.z)};
  };
  const findPick=event=>{
    const rect=canvas.getBoundingClientRect();
    pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);
    raycaster.setFromCamera(pointer,camera);
    const hit=raycaster.intersectObjects([...records.values()].map(record=>record.group),true)[0];
    if(!hit)return null;
    let object=hit.object;
    while(object&&!object.userData.builderId)object=object.parent;
    return object?.userData.builderId||null;
  };
  const findBridgePick=event=>{
    if(!bridgeModels.length)return null;
    const rect=canvas.getBoundingClientRect();
    pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);
    raycaster.setFromCamera(pointer,camera);
    const hit=raycaster.intersectObjects(bridgeModels.map(model=>model.group),true)[0];
    for(let object=hit?.object;object;object=object.parent)
      if(object.userData.type==='stone-bridge'||
        object.userData.type==='fixed-grand-bridge'&&!object.userData.fixed)
        return object.userData.id;
    return null;
  };
  const meta=(placement,record)=>({id:placement.id,type:placement.type,kind:record.kind,
    x:placement.x,z:placement.z,rotation:placement.rotation||0,
    width:record.width,depth:record.depth,pathAccess:record.pathAccess});
  const position=(record,placement)=>{
    const y=terrain.hillHeightAt(placement.x,placement.z);
    record.group.position.set(placement.x,y,placement.z);
    record.foundationMaterials.forEach(material=>setFoundationBase(material,y));
    record.group.rotation.y=placement.rotation||0;
    record.group.updateMatrixWorld();
  };
  const refreshSelection=()=>{
    if(outline){scene.remove(outline);outline.geometry.dispose();outline.material.dispose();outline=null;}
    const record=records.get(selected);if(!record)return;
    outline=footprintOutline(record.width,record.depth);
    outline.position.copy(record.group.position);
    outline.rotation.y=record.group.rotation.y;scene.add(outline);
  };
  const disposeRecord=record=>{
    scene.remove(record.group);
    record.foundationMaterials.forEach(material=>material.dispose());
    record.atmosphere?.dispose();
    record.model.dispose();
  };
  function syncBuildings(placements){
    const wanted=new Set(placements.map(item=>item.id));
    for(const [id,record] of records)if(!wanted.has(id)){disposeRecord(record);records.delete(id);}
    const descriptors=[];
    for(const placement of placements){
      let record=records.get(placement.id);
      if(record&&(record.type!==placement.type||record.configKey!==JSON.stringify([
        placement.config||null,placement.atmosphere||null]))){
        disposeRecord(record);records.delete(placement.id);record=null;
      }
      if(!record){record=createBuilding(houseGlass,placement.type,placement.config,placement.atmosphere);
        record.group.userData.builderId=placement.id;
        scene.add(record.group);records.set(placement.id,record);}
      position(record,placement);descriptors.push(meta(placement,record));
    }
    refreshSelection();renderer.shadowMap.needsUpdate=true;
    return descriptors;
  }
  let lastPreviewShadow=0;
  function previewMove(id,placement){
    const record=records.get(id);if(!record)return;
    position(record,placement);
    if(selected===id&&outline){
      outline.position.copy(record.group.position);
      outline.rotation.y=record.group.rotation.y;
    }
    const now=performance.now();
    if(now-lastPreviewShadow>110){renderer.shadowMap.needsUpdate=true;lastPreviewShadow=now;}
  }
  const describeExisting=(id,placement)=>{
    const record=records.get(id);return record&&meta(placement,record);
  };
  const setSelected=id=>{selected=records.has(id)?id:null;refreshSelection();};
  function setTool(type,config=null,atmosphere=null){
    if(ghost){
      scene.remove(ghost.group,ghost.roadCutout);
      ghost.roadCutout.geometry.dispose();ghost.roadCutout.material.dispose();
      ghost.transparentMaterials.forEach(mat=>mat.dispose());
      ghost.foundationMaterials.forEach(mat=>mat.dispose());
      ghost.atmosphere?.dispose();ghost.model.dispose();ghost=null;
    }
    tool=MODEL_TYPES[type]?type:null;
    canvas.classList.toggle('is-placing',Boolean(tool));
    if(!tool)return;
    ghost=createBuilding(houseGlass,tool,config,atmosphere);
    ghost.config=config;ghost.atmosphereSettings=atmosphere;
    ghost.group.visible=false;ghost.transparentMaterials=new Set();
    ghost.roadCutout=createPlacementRoadCutout(THREE,ghost.width,ghost.depth);
    ghost.roadCutout.visible=false;
    ghost.colors=new Map();
    ghost.group.traverse(o=>{
      if(!o.isMesh)return;
      const transparent=material=>{
        const mat=material.clone();mat.transparent=true;mat.opacity=.56;mat.depthWrite=false;
        ghost.transparentMaterials.add(mat);
        if(mat.color)ghost.colors.set(mat,mat.color.clone());
        return mat;
      };
      o.material=Array.isArray(o.material)?o.material.map(transparent):transparent(o.material);
      o.castShadow=false;o.renderOrder=BUILDING_GHOST_RENDER_ORDER;
    });
    scene.add(ghost.roadCutout,ghost.group);
  }
  function setLandscapeTool(mode){
    setTool(null);landscapeTool=mode;
    canvas.classList.toggle('is-placing',Boolean(mode));
  }
  function preview(candidate){
    if(!ghost)return;
    ghost.group.visible=true;
    const base=terrain.hillHeightAt(candidate.x,candidate.z);
    ghost.group.position.set(candidate.x,base+.14,candidate.z);
    ghost.foundationMaterials.forEach(material=>setFoundationBase(material,base));
    ghost.roadCutout.visible=true;
    ghost.roadCutout.position.x=candidate.x;
    ghost.roadCutout.position.z=candidate.z;
    ghost.roadCutout.position.y=base+.09;
    const ok=callbacks.isPlacementValid?.(candidate)??true;
    for(const [mat,color] of ghost.colors){mat.color.copy(color);
      if(!ok)mat.color.lerp(new THREE.Color('#d35743'),.68);}
  }
  function previewDescriptor(point){
    if(!ghost||!point)return null;
    return {id:'__ghost',type:tool,kind:ghost.kind,
      x:point.x,z:point.z,rotation:0,width:ghost.width,depth:ghost.depth,
      pathAccess:ghost.pathAccess,config:ghost.config||null,
      atmosphere:ghost.atmosphereSettings||null};
  }
  function setPathPlan(layout,{animate=true}={}){
    painter.setPaths(layout.paths,{animate,forecourts:layout.plazas,
      landscape:terrain.landscape,bridges:terrain.bridges});
    if(!markers||markers.count!==layout.anchors.length){
      if(markers){scene.remove(markers);markers.dispose?.();}
      markers=new THREE.InstancedMesh(markerGeometry,markerMaterial,layout.anchors.length);
      markers.frustumCulled=false;markers.userData.noOutline=true;scene.add(markers);
    }
    const dummy=new THREE.Object3D();
    for(const [i,anchor] of layout.anchors.entries()){
      dummy.position.set(anchor.x,terrain.roadHeightAt(anchor.x,anchor.z)+.135,anchor.z);
      dummy.updateMatrix();markers.setMatrixAt(i,dummy.matrix);
    }
    markers.instanceMatrix.needsUpdate=true;
    markers.visible=grid.visible&&painter.mesh.visible;
  }
  function setGroundPlan(buildings,layout,settings,pavingMode,landscape){
    const changes=groundSurface.setPlan(buildings,layout,settings,pavingMode,landscape);
    if(changes.baseChanged)groundTexture.needsUpdate=true;
    if(changes.decalsChanged)decalsTexture.needsUpdate=true;
    if(changes.waterChanged)waterTexture.needsUpdate=true;
  }
  function setLandscapePlan(landscape,buildings){
    const landscapeChanged=landscape!==lastLandscape;
    terrain=createLandscapeSampler(landscape,buildings);
    if(landscapeChanged)cityTrees.setTrees(terrain.landscape.trees,terrain.heightAt);
    groundGeometry=terrainMesh.update(landscape,terrain.heightAt,buildings);
    ground.geometry=groundGeometry;groundDecals.geometry=groundGeometry;
    // The paving geometry only changes around moved buildings and bridge
    // approaches. Updating all 2.6 km of paving geometry after every drop
    // caused the visible main-thread pause even when dragging was fluid.
    const roadContacts=[...buildings,...terrain.bridges.map(bridge=>({
      id:`road-bridge:${bridge.id}`,x:bridge.x,z:bridge.z,
      width:bridge.span+9,depth:bridge.deckWidth+7,
      rotation:Math.atan2(bridge.dirZ,bridge.dirX),
    }))];
    painter.setTerrain(terrain.roadHeightAt,landscape,roadContacts);
    const placements=new Map(buildings.map(item=>[item.id,item]));
    for(const record of records.values()){
      const placement=placements.get(record.group.userData.builderId);
      if(placement)position(record,placement);
    }
    refreshSelection();
    // The optional construction grid is hidden most of the time. Sampling
    // thousands of terrain points on each building edit is wasted work.
    gridDirty=true;
    if(grid.visible)updateGridHeight();
    waterPlane.visible=true;
    waterTriangles=waterPlane.visible?2:0;
    if(landscapeChanged){
      for(const bridge of bridgeModels)bridge.dispose();bridgeModels=[];
      for(const profile of terrain.bridges.filter(item=>!item.fixed)){
        const model=profile.major?createGrandBridge(THREE,profile,bridgeStoneTexture,bridgeRoadMaterial):
          createStoneBridge(THREE,profile,bridgeStoneTexture,bridgeRoadMaterial);
        scene.add(model.group);bridgeModels.push(model);
      }
    }
    lastLandscape=landscape;
    renderer.shadowMap.needsUpdate=true;
  }
  function updateGridHeight(){
    if(!gridDirty)return;
    // Grid follows painted elevation when it becomes visible.
    const gridPos=gridGeometry.attributes.position;
    for(let i=0;i<gridPos.count;i++)gridPos.setY(i,terrain.heightAt(gridPos.getX(i),gridPos.getZ(i))+.065);
    gridPos.needsUpdate=true;
    gridDirty=false;
  }
  // Trees do not reshape the ground or alter the pedestrian network. Updating
  // their instance matrices directly avoids rebuilding the large terrain mesh.
  function setTrees(trees){
    terrain.landscape.trees=trees;
    cityTrees.setTrees(trees,terrain.heightAt);
    renderer.shadowMap.needsUpdate=true;
  }
  const setGridVisible=visible=>{
    grid.visible=Boolean(visible);
    if(grid.visible)updateGridHeight();
    if(markers)markers.visible=grid.visible&&painter.mesh.visible;
  };
  const setPathsVisible=visible=>{painter.mesh.visible=Boolean(visible);if(markers)markers.visible=grid.visible&&painter.mesh.visible;};
  const setPavingStyle=mode=>painter.setPavingStyle(mode);
  // Fit all four corners in screen space, accounting for the isometric tilt.
  // A fixed overview zoom cropped the lower half after the map grew.
  function fittedMapZoom(position){
    const probe=camera.clone();probe.position.copy(position);probe.lookAt(0,0,0);probe.updateMatrixWorld();
    let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
    for(const x of [-WIDTH/2,WIDTH/2])for(const z of [-DEPTH/2,DEPTH/2])
      for(const y of [-10,22]){
        const p=new THREE.Vector3(x,y,z).applyMatrix4(probe.matrixWorldInverse);
        minX=Math.min(minX,p.x);maxX=Math.max(maxX,p.x);
        minY=Math.min(minY,p.y);maxY=Math.max(maxY,p.y);
      }
    return Math.min((camera.right-camera.left)/(maxX-minX),
      (camera.top-camera.bottom)/(maxY-minY))*.91;
  }
  const overviewPosition=new THREE.Vector3(.39,.73,.57).normalize().multiplyScalar(WIDTH*2);
  camera.position.copy(overviewPosition);camera.lookAt(0,0,0);
  let activeView='overview';
  function setView(view){
    activeView=view;
    viewTween={start:performance.now(),from:camera.position.clone(),
      to:view==='top'?new THREE.Vector3(.15,124,16):view==='overview'?
        overviewPosition:new THREE.Vector3(42,89,91),
      fromTarget:controls.target.clone(),toTarget:new THREE.Vector3(0,0,0),
      fromZoom:camera.zoom,toZoom:view==='overview'?fittedMapZoom(overviewPosition):
        Math.min(1.2,Math.max(.73,root.clientWidth/110))};
  }
  function showTooltip(event,id){
    const record=records.get(id);
    if(!record||tool||drag){tooltip.hidden=true;return;}
    tooltip.textContent=MODEL_TYPES[record.type].label;
    const rect=canvas.getBoundingClientRect();
    tooltip.style.left=`${Math.min(rect.width-145,Math.max(8,event.clientX-rect.left+15))}px`;
    tooltip.style.top=`${Math.max(8,event.clientY-rect.top+15)}px`;tooltip.hidden=false;
  }
  function clearLandscapeDraft(){
    if(draftLine){scene.remove(draftLine);draftLine.geometry.dispose();draftLine=null;}
  }
  function cancelInteraction(){
    const hadMove=Boolean(drag?.moved);
    const pointerIds=[landscapeDrag?.pointerId,drag?.pointerId];
    landscapeDrag=null;drag=null;
    clearLandscapeDraft();controls.enabled=true;
    canvas.classList.remove('is-dragging');
    for(const id of pointerIds)if(id!==undefined&&canvas.hasPointerCapture(id))
      canvas.releasePointerCapture(id);
    if(hadMove)callbacks.onMoveCancel?.();
  }
  function showLandscapeDraft(points){
    clearLandscapeDraft();if(points.length<2)return;
    const geometry=new THREE.BufferGeometry().setFromPoints(points.map(p=>
      new THREE.Vector3(p[0],terrain.heightAt(p[0],p[1])+.65,p[1])));
    draftLine=new THREE.Line(geometry,draftMaterial);
    draftLine.renderOrder=7;draftLine.userData.noOutline=true;scene.add(draftLine);
  }
  function pointerDown(event){
    if(event.button!==0)return;
    if(landscapeTool){
      if(landscapeTool==='erase'){
        const bridgeId=findBridgePick(event);
        if(bridgeId){callbacks.onEraseBridge?.(bridgeId);
          event.preventDefault();event.stopImmediatePropagation();return;}
      }
      const location=screenPoint(event);if(!location)return;
      tooltip.hidden=true;
      if(landscapeTool==='river'){
        landscapeDrag={points:[[location.x,location.z]],pointerId:event.pointerId};
        controls.enabled=false;canvas.setPointerCapture(event.pointerId);
      }else callbacks.onLandscapeAction?.(landscapeTool,location);
      event.preventDefault();event.stopImmediatePropagation();return;
    }
    if(tool){
      const location=screenPoint(event),candidate=previewDescriptor(location);
      if(candidate)callbacks.onPlace?.(candidate);
      event.preventDefault();event.stopImmediatePropagation();return;
    }
    const id=findPick(event);
    if(!id){tooltip.hidden=true;callbacks.onSelect?.(null);return;}
    const location=screenPoint(event);
    if(!location)return;
    const record=records.get(id);
    drag={id,startX:event.clientX,startY:event.clientY,
      offsetX:record.group.position.x-location.x,offsetZ:record.group.position.z-location.z,
      pointerId:event.pointerId,moved:false};
    callbacks.onSelect?.(id);tooltip.hidden=true;
    controls.enabled=false;canvas.classList.add('is-dragging');canvas.setPointerCapture(event.pointerId);
    event.preventDefault();event.stopImmediatePropagation();
  }
  function pointerMove(event){
    if(landscapeDrag){
      const at=screenPoint(event);
      if(at){const points=landscapeDrag.points,last=points.at(-1);
        if(Math.hypot(at.x-last[0],at.z-last[1])>=.8){points.push([at.x,at.z]);showLandscapeDraft(points);}}
      event.preventDefault();event.stopImmediatePropagation();return;
    }
    if(drag){
      if(Math.hypot(event.clientX-drag.startX,event.clientY-drag.startY)<3&&!drag.moved)return;
      const location=screenPoint(event);if(!location)return;
      const x=snap(location.x+drag.offsetX),z=snap(location.z+drag.offsetZ);
      drag.moved=callbacks.onMove?.(drag.id,x,z)||drag.moved;
      event.preventDefault();event.stopImmediatePropagation();return;
    }
    if(tool){const location=screenPoint(event);preview(previewDescriptor(location)||{x:0,z:0});tooltip.hidden=true;return;}
    showTooltip(event,findPick(event));
  }
  function pointerUp(event){
    if(event.type==='pointercancel'){cancelInteraction();return;}
    if(landscapeDrag){
      const stroke=landscapeDrag.points;
      landscapeDrag=null;controls.enabled=true;clearLandscapeDraft();
      if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);
      callbacks.onLandscapeStroke?.(stroke);
      event.preventDefault();event.stopImmediatePropagation();return;
    }
    if(!drag)return;
    const hadMoved=drag.moved;
    drag=null;controls.enabled=true;canvas.classList.remove('is-dragging');
    if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);
    if(hadMoved)callbacks.onMoveEnd?.();
    event.preventDefault();event.stopImmediatePropagation();
  }
  const pointerOptions={capture:true,signal:eventController.signal};
  canvas.addEventListener('pointerdown',pointerDown,pointerOptions);
  canvas.addEventListener('pointermove',pointerMove,pointerOptions);
  canvas.addEventListener('pointerup',pointerUp,pointerOptions);
  canvas.addEventListener('pointercancel',pointerUp,pointerOptions);
  canvas.addEventListener('pointerleave',()=>{
    tooltip.hidden=true;
    if(ghost&&!drag){ghost.group.visible=false;ghost.roadCutout.visible=false;}
  },{signal:eventController.signal});
  canvas.addEventListener('contextmenu',event=>event.preventDefault(),{signal:eventController.signal});
  const resize=()=>{
    const rect=canvas.getBoundingClientRect(),width=Math.max(1,rect.width),height=Math.max(1,rect.height);
    const half=51,aspect=width/height;
    camera.left=-half*aspect;camera.right=half*aspect;camera.top=half;camera.bottom=-half;
    camera.zoom=activeView==='overview'?fittedMapZoom(camera.position):
      Math.min(1.2,Math.max(.73,width/110));camera.updateProjectionMatrix();
    renderer.setSize(width,height,false);filter.resize(width,height,renderer.getPixelRatio());
  };
  const observer=new ResizeObserver(resize);observer.observe(root);resize();
  function frame(time){
    if(!running)return;frameHandle=requestAnimationFrame(frame);
    if(!active){fpsStart=time;frames=0;return;}
    if(viewTween){const t=Math.min(1,(time-viewTween.start)/650),ease=1-Math.pow(1-t,3);
      camera.position.copy(viewTween.from).lerp(viewTween.to,ease);
      controls.target.copy(viewTween.fromTarget).lerp(viewTween.toTarget,ease);
      camera.zoom=viewTween.fromZoom+(viewTween.toZoom-viewTween.fromZoom)*ease;
      camera.updateProjectionMatrix();if(t>=1)viewTween=null;}
    controls.update();painter.update(time);
    for(const record of records.values())record.atmosphere?.update(time*.001);
    if(sun.target.position.distanceToSquared(controls.target)>16){
      sun.position.x=controls.target.x-33;sun.position.z=controls.target.z+52;
      sun.target.position.copy(controls.target);sun.target.updateMatrixWorld();
      renderer.shadowMap.needsUpdate=true;
    }
    const render=filter.render();frames++;
    if(time-fpsStart>=960){
      const fps=Math.round(frames*1000/(time-fpsStart));fpsStart=time;frames=0;
      callbacks.onMetrics?.({fps,waterTriangles,triangles:Math.round(render.sceneTriangles??render.triangles??0)});
    }
  }
  frameHandle=requestAnimationFrame(frame);
  function dispose(){
    running=false;cancelAnimationFrame(frameHandle);eventController.abort();
    observer.disconnect();controls.dispose();filter.dispose();painter.dispose();setTool(null);
    cityTrees.dispose();
    clearLandscapeDraft();draftMaterial.dispose();bridgeStoneTexture.dispose();
    bridgeRoadMaterial.dispose();
    scene.remove(waterPlane);waterGeometry.dispose();waterMaterial.dispose();waterTexture.dispose();
    for(const bridge of bridgeModels)bridge.dispose();
    for(const bridge of fixedBridgeModels)bridge.dispose();
    for(const record of records.values())disposeRecord(record);records.clear();
    houseGlass.dispose();
    if(outline){scene.remove(outline);outline.geometry.dispose();outline.material.dispose();}
    if(markers){scene.remove(markers);markers.dispose?.();}
    markerGeometry.dispose();markerMaterial.dispose();
    groundSurface.dispose();terrainMesh.dispose();groundTexture.dispose();groundMaterial.dispose();
    decalsTexture.dispose();decalsMaterial.dispose();
    border.children.forEach(rail=>rail.geometry.dispose());borderMaterial.dispose();
    gridGeometry.dispose();grid.material.dispose();renderer.dispose();
  }
  return {syncBuildings,previewMove,cancelInteraction,describeExisting,setSelected,setTool,setLandscapeTool,setLandscapePlan,setTrees,previewDescriptor,setPathPlan,setGroundPlan,
    setGridVisible,setPathsVisible,setPavingStyle,setView,setActive(value){active=Boolean(value);},dispose,mode:'webgl'};
}
