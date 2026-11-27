import {paintingSections} from './display-sections.js';
import {createRoomIndex} from '../rendering/room-index.js';
import {reproductionFit} from '../../catalog/reproduction-fit.js';
import {frameDimensions,frameOrientation} from '../../catalog/painting-geometry.js';
// One textured mesh covers the active exhibition, including pictures beyond the detail budget.
export function overviewGeometry(THREE, slots, atlas, settings, sections=null, hiddenFaces=null) {
  const positions = [], uvs = [], surface = [], colors = [], indices = [];
  function quad(slot,width,height,depth,u0,v0,u1,v1) {
    const first = positions.length / 3;
    const {x,y,z,normal:n} = slot;
    for (const [side,up] of [[-1,-1],[1,-1],[1,1],[-1,1]]) {
      const {floor,c,s}=frameOrientation(slot);
      if (floor) {
        const sign=slot.faceDown?-1:1;
        positions.push(x+c*side*width/2-sign*s*up*height/2,y+sign*depth,z-s*side*width/2-sign*c*up*height/2);
        continue;
      }
      positions.push(x+n.x*depth+n.z*side*width/2, y+up*height/2, z+n.z*depth-n.x*side*width/2);
    }
    uvs.push(u0,v0,u1,v0,u1,v1,u0,v1);
    const wood = u0 === u1;
    for (const [i,j] of [[-1,-1],[1,-1],[1,1],[-1,1]]) {
      surface.push(i * width * (wood ? .7 : 1), j * height * (wood ? 1.5 : 2), Number(wood));
    }
    indices.push(first,first+1,first+2,first,first+2,first+3);
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
      const frame=frameDimensions(slot,settings),depth=frame.depth, front=positions.length/3;
      quad(slot,frame.width-.0005,frame.height-.0005,.45*depth,woodU,woodV,woodU,woodV);
      const onFloor=frameOrientation(slot).floor;
      const nx=onFloor?0:slot.normal.x,ny=onFloor?(slot.faceDown?-1:1):0,nz=onFloor?0:slot.normal.z;
      for(let i=0;i<4;i++){
        const k=(front+i)*3;
        positions.push(positions[k]-.95*depth*nx,positions[k+1]-.95*depth*ny,positions[k+2]-.95*depth*nz);
        uvs.push(woodU,woodV);
        surface.push(surface[k],surface[k+1] - depth*3,1);
      }
      indices.push(front+4,front+6,front+5,front+4,front+7,front+6);
      for(let i=0;i<4;i++){
        const a=front+i,b=front+(i+1)%4;
        indices.push(a+4,b+4,b,a+4,b,a);
      }
      if(!hiddenFaces?.has(slot))quad(slot,fit.width,fit.height,.49*depth,u-du,v-dv,u+du,v+dv);
      const hall=slot.destination?.split('/')[0]??slot.painting.placement?.hall;
      const color=new THREE.Color(settings.hallColors?.[hall]??(hall==='center'?'#d8b766':'#594335'));
      for(let i=colorStart;i<positions.length/3;i++)colors.push(color.r,color.g,color.b);
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
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export function createOverview(THREE, parent, atlas, settings, gouache, ink, layout, bayCount) {
  const texture = new THREE.TextureLoader().load(atlas.url);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  const material = new THREE.MeshBasicMaterial({map:texture});
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
    entry={mesh,shell,sections:[],active:new Set(),select:null};
    chunks.set(id,entry);
    return entry;
  }
  chunk(null);
  function remove(id,c){
    c.mesh.removeFromParent();c.mesh.geometry.dispose();chunks.delete(id);
  }
  function rebuild(id,slots,hiddenFaces){
    const c=chunk(id);
    c.sections=paintingSections(slots,layout,bayCount);
    c.active=new Set(c.sections);
    c.mesh.geometry.dispose();
    c.mesh.geometry=overviewGeometry(THREE,slots,atlas,settings,c.sections,hiddenFaces);
    c.select=createRoomIndex(THREE,c.mesh.geometry,c.sections.map(s=>({room:s,start:s.start,end:s.end})));
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
        if(changed)c.select(c.active);
      }
    },
    setSlots(slots,hiddenFaces,byRoom=false,changedRoom=null){
      if(changedRoom!==null){rebuild(changedRoom,slots,hiddenFaces);return;}
      const batches=byRoom?Map.groupBy(slots,s=>s.floorRoom??s.wall.hall):new Map([[null,slots]]);
      for(const [id,c] of chunks)if(!batches.has(id))remove(id,c);
      for(const [id,items] of batches)rebuild(id,items,hiddenFaces);
    },
    dispose(){for(const [id,c] of chunks)remove(id,c);material.dispose();texture.dispose();}
  };
}
