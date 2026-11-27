import {frameDimensions,frameCornerCut,clippedFrameCorners} from '../../catalog/painting-geometry.js';

const distance = (a, x, y) => Math.hypot(a.along - x, a.y - y);
const sizeFits = (piece, place, settings) => {
  const {width,height}=frameDimensions(piece,settings);
  return Math.abs(width-place.width)<=1e-6 && Math.abs(height-place.height)<=1e-6;
};

export function createWallCompositions(THREE, world, config) {
  const settings=config.paintings, groups=new Map(), places=new Map(), drawings=new Map();
  const root=new THREE.Group();
  root.name='painting-compositions';
  world.scene.add(root);
  // Blend a warm tint over the plaster so the original wall texture shows through.
  const material=new THREE.MeshBasicMaterial({
    color:0xffefd1,transparent:true,opacity:.38,depthWrite:false,
    side:THREE.DoubleSide,toneMapped:false,
  });
  const meshes=new Map();
  function clear(){
    for(const mesh of meshes.values()){mesh.removeFromParent();mesh.geometry.dispose();}
    meshes.clear();
  }
  function rebuild(slots, wallFor){
    groups.clear();places.clear();
    const rows=new Map();
    for(const slot of slots){
      if(slot.painting.collection==='keynlock')continue;
      const wall=wallFor(slot);
      if(!wall)continue;
      const dx=(wall.b.x-wall.a.x)/wall.length,dz=(wall.b.z-wall.a.z)/wall.length;
      const along=(slot.x-wall.a.x)*dx+(slot.z-wall.a.z)*dz;
      if(!Number.isFinite(along)||!Number.isFinite(slot.y))continue;
      const {width,height}=frameDimensions(slot,settings);
      const place={wall,along,y:slot.y,width,height,dx,dz,filled:false};
      const rowKey=slot.wall.id+'/'+slot.tier;
      if(!rows.has(rowKey))rows.set(rowKey,[]);
      rows.get(rowKey).push(place);
    }
    for(const row of rows.values()){
      row.sort((a,b)=>a.along-b.along);
      const count=Math.ceil(row.length/6), size=Math.ceil(row.length/count);
      for(let i=0;i<row.length;i+=size){
        const group={places:row.slice(i,i+size),filled:0};
        const {id}=row[i].wall;
        if(!groups.has(id)){groups.set(id,[]);places.set(id,[]);}
        groups.get(id).push(group);
        places.get(id).push(...group.places);
      }
    }
  }
  function refresh(hung){
    drawings.clear();
    for(const row of places.values())for(const place of row)place.filled=false;
    for(const slot of hung){
      if(slot.painting.collection==='keynlock')continue;
      const place=places.get(slot.wall.id)?.find(p=>!p.filled&&distance(p,slot.along,slot.y)<.045&&sizeFits(slot,p,settings));
      if(place)place.filled=true;
    }
    for(const wallGroups of groups.values())for(const group of wallGroups){
      group.filled=group.places.filter(p=>p.filled).length;
      for(const p of group.places){
        if(p.filled)continue;
        const {wall,dx,dz}=p;
        const x=wall.a.x+dx*p.along+wall.normal.x*.008,z=wall.a.z+dz*p.along+wall.normal.z*.008;
        const y=config.building.floorElevation+p.y;
        if(!drawings.has(wall.hall))drawings.set(wall.hall,{vertices:[],indices:[]});
        const {vertices,indices}=drawings.get(wall.hall);
        const first=vertices.length/3;
        const corners=clippedFrameCorners(p.width/2,p.height/2,frameCornerCut(p.width,p.height,settings.frameWidthM));
        for(const [u,v] of corners)vertices.push(x+dx*u,y+v,z+dz*u);
        for(let i=1;i<corners.length-1;i++)indices.push(first,first+i,first+i+1);
      }
    }
    for(const [hall,mesh] of meshes)if(!drawings.has(hall)){
      mesh.removeFromParent();mesh.geometry.dispose();meshes.delete(hall);
    }
    for(const [hall,{vertices,indices}] of drawings){
      const geometry=new THREE.BufferGeometry();
      geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
      geometry.setIndex(indices);
      const existing=meshes.get(hall);
      if(existing){existing.geometry.dispose();existing.geometry=geometry;}
      else {
        const mesh=new THREE.Mesh(geometry,material);
        mesh.renderOrder=-1; // Draw the wall tint underneath the placement preview.
        meshes.set(hall,mesh);root.add(mesh);
      }
    }
  }
  function summary(wall,along,y){
    const wallGroups=groups.get(wall.id);
    if(!wallGroups?.length)return null;
    let nearest=null,best=Infinity,filled=0,total=0;
    for(const group of wallGroups){
      filled+=group.filled;total+=group.places.length;
      for(const p of group.places){
        const score=distance(p,along,y);
        if(score<best){nearest=group;best=score;}
      }
    }
    return {group:nearest,filled,total};
  }
  // Every marked footprint stays available for its exact frame size. Identical
  // sizes are interchangeable; a smaller work cannot consume a larger place.
  function acceptsPlacement(slot){
    const {width,height}=frameDimensions(slot,settings);
    return (places.get(slot.wall.id)??[]).every(p=>{
      if(Math.abs(slot.along-p.along)>=(width+p.width)/2-1e-6 ||
         Math.abs(slot.y-p.y)>=(height+p.height)/2-1e-6)return true;
      return sizeFits(slot,p,settings)&&distance(p,slot.along,slot.y)<1e-6;
    });
  }
  function snap(slot,wall,x,y,tryPosition){
    if(slot.painting.collection==='keynlock')return null;
    const nearby=(places.get(wall.id)??[]).filter(p=>!p.filled&&distance(p,x,y)<.24&&sizeFits(slot,p,settings));
    nearby.sort((a,b)=>distance(a,x,y)-distance(b,x,y));
    for(const p of nearby){
      const target=tryPosition(p.along,p.y);
      if(target)return target;
    }
    return null;
  }
  return {
    rebuild,refresh,summary,snap,acceptsPlacement,clear,
    updateVisibility(active){
      root.visible=active;
      for(const [hall,mesh] of meshes)mesh.visible=!world.visibleHalls||world.visibleHalls.has(hall);
    },
    dispose(){clear();root.removeFromParent();material.dispose();},
  };
}
