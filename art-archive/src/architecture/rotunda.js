import {entranceJunction,rotundaPlasterU} from './entrance-junction.js';
import {createDrumGeometry} from './rotunda-drum.js';
export function buildRotunda(context){
 const {THREE, config, layout, m, upper, r, ceilingHeight, domeBase, mesh, shapeMesh, disposable}=context;
 // Six flat hanging panels between the radial gallery entrances.
 for(const s of layout.centerSegments){
  const [right,left]=s.entrances.map(id=>layout.halls.find(h=>h.id===id));
  const a=entranceJunction(layout,right,1),b=entranceJunction(layout,left,-1);
  const world=(hall,p)=>layout.world(hall,p.x,p.z);
  const panel=shapeMesh([world(right,a.inside),world(right,a.outside),world(left,b.outside),world(left,b.inside)],[],0,ceilingHeight,m.plaster);
  panel.name='rotunda-hanging-wall';
  const {position,uv}=panel.geometry.attributes;
  for(let i=0;i<position.count;i++)uv.setXY(i,rotundaPlasterU(s,position.getX(i),position.getZ(i)),position.getY(i)/4);
 }
 // The circular drum has a closed lower edge fitted to every entrance vault.
 const reveal=new THREE.MeshBasicMaterial({vertexColors:true});
 disposable.add(reveal);
 mesh(createDrumGeometry(THREE,config,layout),[m.plaster,reveal],upper).name='rotunda-upper-drum';
 for(const y of [domeBase-.3,domeBase]){
  const ring=mesh(new THREE.TorusGeometry(r+.02,.095,8,192),m.ivory,upper);ring.rotation.x=Math.PI/2;ring.position.y=y;
 }
}
