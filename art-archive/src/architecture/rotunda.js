import {createDrumGeometry} from './rotunda-drum.js';
export function buildRotunda(context){
 const {THREE, config, layout, m, upper, r, ceilingHeight, domeBase, mesh, cylinder, shapeMesh, segment}=context;
 // Six flat hanging panels between the radial gallery entrances.
 for(const s of layout.centerSegments){
  segment(s.a,s.b,ceilingHeight/2,ceilingHeight,.3,m.plaster).name='rotunda-hanging-wall';
  segment(s.a,s.b,.38,.76,.36,m.wood);
  segment(s.a,s.b,.80,.08,.44,m.ivory);
  segment(s.a,s.b,ceilingHeight-.02,.20,.58,m.ivory).name='hanging-wall-crown';
 }
 // The circular drum has a closed lower edge fitted to every entrance vault.
 mesh(createDrumGeometry(THREE,config,layout),m.plaster,upper).name='rotunda-upper-drum';
 for(const y of [domeBase-.3,domeBase]){
  const ring=mesh(new THREE.TorusGeometry(r+.02,.095,8,192),m.ivory,upper);ring.rotation.x=Math.PI/2;ring.position.y=y;
 }
 // Narrow shoulders join each flat hanging panel to the circular drum.
 for(const panel of layout.centerSegments){
  const a=Math.atan2(panel.a.z,panel.a.x),delta=Math.atan2(Math.sin(Math.atan2(panel.b.z,panel.b.x)-a),Math.cos(Math.atan2(panel.b.z,panel.b.x)-a));
  const points=Array.from({length:25},(_,i)=>({x:Math.cos(a+delta*i/24)*(r+.24),z:Math.sin(a+delta*i/24)*(r+.24)}));
  points.push(panel.b,panel.a);shapeMesh(points,[],ceilingHeight-.08,.08,m.plaster,upper);
  // Slim end pilasters leave the middle of every painting wall unobstructed.
  for(const p of [panel.a,panel.b])cylinder(p.x-panel.normal.x*.16,ceilingHeight/2,p.z-panel.normal.z*.16,.10,.12,ceilingHeight,m.ivory);
 }

}
