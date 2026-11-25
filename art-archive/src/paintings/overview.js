import {paintingSections} from './display-sections.js';
import {createRoomIndex} from '../rendering/room-index.js';
import {reproductionFit} from '../../catalog/reproduction-fit.js';
import {frameDimensions,frameOrientation,mountedFrame,frameCornerCut,clippedFrameCorners} from '../../catalog/painting-geometry.js';
import {createDecalGeometry,createDecalMaterial} from '../rendering/surface-decals.js';
// One textured mesh covers the active exhibition, including pictures beyond the detail budget.
export function overviewGeometry(THREE, slots, atlas, settings, sections=null, hiddenFaces=null) {
  const positions = [], uvs = [], surface = [], back = [], colors = [], halls = [], indices = [];
  function face(slot,corners,width,height,depth,u0,v0,u1,v1,grain=0,rear=false){
    const first=positions.length/3,{x,y,z}=slot,{c,s,cp,sp}=frameOrientation(slot);
    for(const [across,vertical] of corners){
      const u=.5+across/width,v=.5+vertical/height,along=sp*vertical+cp*depth;
      positions.push(x+c*across+s*along,y+cp*vertical-sp*depth,z-s*across+c*along);
      uvs.push(u0+(u1-u0)*u,v0+(v1-v0)*v);
      surface.push(across*(grain?1.84:2),vertical*(grain?3.6:4),grain);
      back.push(u,v,Number(rear));
    }
    for(let i=1;i<corners.length-1;i++)indices.push(first,first+(rear?i+1:i),first+(rear?i:i+1));
  }
  for (const section of sections ?? [{slots}]) {
    section.start=indices.length;
    const firstVertex=positions.length;
    for (const slot of section.slots) {
      const colorStart=positions.length/3;
      const {image,physicalSizeM:size} = slot.painting;
      const cell = image.overviewCell;
      if (!Number.isInteger(cell) || cell < 1 || cell >= atlas.columns*atlas.rows) continue;
      const u = (cell % atlas.columns + .5)/atlas.columns;
      const v = 1 - (Math.floor(cell/atlas.columns)+.5)/atlas.rows;
      const fit = reproductionFit(image,size);
      const extent = .5 - (atlas.gutter+.5)/atlas.cellSize;
      const du = extent*fit.u/atlas.columns;
      const dv = extent*fit.v/atlas.rows;
      const woodU = .5/atlas.columns, woodV = 1-.5/atlas.rows;
      // Tuck the atlas mesh just inside the detailed wooden profile. Both LODs
      // keep four solid edges, including when a frame is seen from the side.
      // Both wooden faces must sit inside the detailed backing (±.45 depth)
      // and rails (±.5 depth), also when the painting is face down.
      const frame=frameDimensions(slot,settings),depth=frame.depth,front=positions.length/3;
      const corners=clippedFrameCorners(frame.width/2-.00025,frame.height/2-.00025,
        frameCornerCut(frame.width,frame.height,settings.frameWidthM));
      face(slot,corners,frame.width,frame.height,.40*depth,woodU,woodV,woodU,woodV,1);
      const rear=positions.length/3;
      face(slot,corners,frame.width,frame.height,-.40*depth,woodU,woodV,woodU,woodV,.72,true);
      for(let i=0;i<corners.length;i++){
        const j=(i+1)%corners.length;
        indices.push(rear+i,rear+j,front+j,rear+i,front+j,front+i);
      }
      if(!hiddenFaces?.has(slot)){
        const x=fit.width/2,y=fit.height/2;
        face(slot,[[-x,-y],[x,-y],[x,y],[-x,y]],fit.width,fit.height,.49*depth,u-du,v-dv,u+du,v+dv);
      }
      const hall=slot.destination?.split('/')[0]??slot.painting.placement?.hall;
      const color=new THREE.Color(settings.hallColors?.[hall]??(hall==='center'?'#d8b766':'#594335'));
      const frameHall=mountedFrame(slot)?settings.hallIndices?.[slot.wall?.hall]??0:0;
      for(let i=colorStart;i<positions.length/3;i++){colors.push(color.r,color.g,color.b);halls.push(frameHall);}
    }
    section.end=indices.length;
    if(sections){
      section.bounds=new THREE.Box3();
      const vertex=new THREE.Vector3();
      for(let i=firstVertex;i<positions.length;i+=3)section.bounds.expandByPoint(vertex.fromArray(positions,i));
      section.bounds.expandByScalar(.12);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  geometry.setAttribute('archiveSurface',new THREE.Float32BufferAttribute(surface,3));
  geometry.setAttribute('archiveHallColor',new THREE.Float32BufferAttribute(colors,3));
  geometry.setAttribute('archiveFrameHall',new THREE.Float32BufferAttribute(halls,1));
  geometry.setAttribute('archiveBack',new THREE.Float32BufferAttribute(back,3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export function createOverview(THREE, parent, atlas, settings, gouache, ink, layout, bayCount, loadingManager) {
  const texture = new THREE.TextureLoader(loadingManager).load(atlas.url);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  const material = new THREE.MeshBasicMaterial({map:texture});
  const shadowMaterial=createDecalMaterial(THREE,{color:0x302622});
  gouache.apply(material);
  const chunks=new Map();
  const matrix=new THREE.Matrix4(), frustum=new THREE.Frustum();
  function chunk(id){
    let entry=chunks.get(id);
    if(entry)return entry;
    const mesh=new THREE.Mesh(new THREE.BufferGeometry(),material);
    mesh.name='painting-overview';
    const shell=ink?.shell(mesh.geometry);
    if(shell)mesh.add(shell);
    parent.add(mesh);
    const shadow=new THREE.Mesh(new THREE.BufferGeometry(),shadowMaterial);
    shadow.name='frame-contact-shadows';shadow.raycast=()=>{};shadow.renderOrder=1;
    mesh.add(shadow);
    entry={mesh,shell,shadow,sections:[],active:new Set(),select:null,selectShadows:null};
    chunks.set(id,entry);
    return entry;
  }
  chunk(null);
  function remove(id,c){
    c.mesh.removeFromParent();c.mesh.geometry.dispose();c.shadow.geometry.dispose();chunks.delete(id);
  }
  function rebuild(id,slots,hiddenFaces){
    const c=chunk(id);
    c.sections=paintingSections(slots,layout,bayCount);
    c.active=new Set(c.sections);
    c.mesh.geometry.dispose();
    c.mesh.geometry=overviewGeometry(THREE,slots,atlas,settings,c.sections,hiddenFaces);
    c.select=createRoomIndex(THREE,c.mesh.geometry,c.sections.map(s=>({room:s,start:s.start,end:s.end})));
    const shadows=createDecalGeometry(THREE),spans=[];
    for(const section of c.sections){
      const start=shadows.count;
      for(const slot of section.slots){
        if(!mountedFrame(slot))continue;
        const size=frameDimensions(slot,settings),n=slot.normal;
        const back=size.depth/2+settings.wallClearanceM-.003;
        shadows.add({x:slot.x-back*n.x,y:slot.y-.02,z:slot.z-back*n.z,
          u:[n.z,0,-n.x],v:[0,1,0],width:size.width,height:size.height,feather:.085,opacity:.20});
      }
      spans.push({room:section,start,end:shadows.count});
    }
    c.shadow.geometry.dispose();c.shadow.geometry=shadows.build();c.shadow.visible=shadows.count>0;
    c.selectShadows=createRoomIndex(THREE,c.shadow.geometry,spans);
    if(c.shell)c.shell.geometry=c.mesh.geometry;
    c.mesh.visible=slots.length>0;
  }
  return {texture,
    updateVisibility(camera,rooms){
      camera.updateWorldMatrix(true,false);
      parent.updateWorldMatrix(true,false);
      frustum.setFromProjectionMatrix(matrix.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse).multiply(parent.matrixWorld));
      for(const c of chunks.values()){
        let changed=false;
        for(const section of c.sections){
          const visible=(!rooms || rooms.has(section.room)) && frustum.intersectsBox(section.bounds);
          if(visible===c.active.has(section))continue;
          if(visible)c.active.add(section);else c.active.delete(section);
          changed=true;
        }
        if(changed){c.select(c.active);c.selectShadows(c.active);}
      }
    },
    setSlots(slots,hiddenFaces,byRoom=false,changedRoom=null){
      if(changedRoom!==null){rebuild(changedRoom,slots,hiddenFaces);return;}
      const batches=byRoom?Map.groupBy(slots,s=>s.floorRoom??s.wall.hall):new Map([[null,slots]]);
      for(const [id,c] of chunks)if(!batches.has(id))remove(id,c);
      for(const [id,items] of batches)rebuild(id,items,hiddenFaces);
    },
    dispose(){for(const [id,c] of chunks)remove(id,c);shadowMaterial.dispose();material.dispose();texture.dispose();}
  };
}
