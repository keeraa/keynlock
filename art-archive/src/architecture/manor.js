export function buildLowerManor(context){
 const {THREE, layout, m, root, mesh, box, cylinder, shapeMesh}=context;
 // Lower manor and six planted courtyards surround the independent gallery wings.
 const ground=mesh(new THREE.CircleGeometry(80,64),m.garden);ground.rotation.x=-Math.PI/2;ground.position.y=-8;
 for(let i=0;i<layout.halls.length;i++){
  const a=(i+.5)*Math.PI*2/layout.halls.length;
  const court=new THREE.Group();court.rotation.y=a;root.add(court);
  // Continuous lower-storey roof around an open courtyard.
  const terrace=[{x:-6,z:10},{x:6,z:10},{x:7,z:35},{x:-7,z:35}];
  const yard=[{x:-3.8,z:16},{x:3.8,z:16},{x:3.8,z:31},{x:-3.8,z:31}];
  shapeMesh(terrace,[yard],-4.15,.2,m.roof,court);
  box(0,-7.8,23.5,7.5,.22,15,m.stone,court);
  box(0,-7.55,23.5,5,.4,12,m.garden,court);
  for(const x of [-4.0,4.0])box(x,-6,23.5,.32,3.8,15.6,m.exterior,court);
  for(const x of [-4.0,4.0])box(x,-4.0,23.5,.38,.35,15.6,m.stone,court);
  for(const z of [16,31]){box(0,-6,z,8,3.8,.32,m.exterior,court);box(0,-4,z,8,.35,.38,m.stone,court);}
  for(const z of [19,24,29])for(const x of [-2,2]){
   cylinder(x,-6.8,z,.08,.12,1.9,m.wood,court);const tree=mesh(new THREE.IcosahedronGeometry(1,1),m.garden,court);tree.position.set(x,-5.6,z);tree.scale.set(1,1.3,1);
  }
 }

}

export function buildWingTerrace({box,w,len,m}, {g,start}) {
  // Lower-storey manor roofs remain visible in plan and through the glass cupola.
  box(0,-4.1,start+len/2,w+1,.28,len+2,m.roof,g);
  for(const x of [-w/2-.5,w/2+.5])box(x,-4.0,start+len/2,.18,.4,len+2,m.stone,g);
}
