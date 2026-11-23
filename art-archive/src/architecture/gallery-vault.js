export function buildGalleryVault(context, {roof,start,end}){
 const {THREE, layout, m, w, len, ceilingHeight, vaultRise, wallBays, height, lampBottom, disposable, mesh, box, cylinder, tube}=context;
  // Shallow barrel vault, cut away with the plan-view control.
  const n=24,verts=[],indices=[];
  for(let row=0;row<2;row++)for(let j=0;j<=n;j++){const a=j/n*Math.PI;const x=Math.cos(a)*w/2;verts.push(x,height+Math.sin(a)*vaultRise,row?end:Math.sqrt(layout.ringRadius**2-x*x));}
  for(let j=0;j<n;j++){const k=n+1;indices.push(j,j+1,j+k,j+1,j+k+1,j+k);}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));geo.setIndex(indices);geo.computeVertexNormals();
  const uv=[];for(let row=0;row<2;row++)for(let j=0;j<=n;j++)uv.push(j/n*w/4,row*len/4);geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  const vaultMat=m.ivory.clone();vaultMat.side=THREE.DoubleSide;disposable.add(vaultMat);mesh(geo,vaultMat,roof).name='gallery-vault';
  for(let i=0;i<=wallBays;i++){
   const z=start+(len/wallBays)*i;
   const points=Array.from({length:25},(_,j)=>{const a=j/24*Math.PI;return new THREE.Vector3(Math.cos(a)*(w/2-.03),height+Math.sin(a)*vaultRise-.04,i===0?Math.sqrt(layout.ringRadius**2-(Math.cos(a)*(w/2-.03))**2):z);});
   tube(points,.055,m.darkWood,roof);
   if(i>0&&i<wallBays){
    const rim=mesh(new THREE.TorusGeometry(.49,.047,6,24),m.gold,roof);
    rim.rotation.x=Math.PI/2;rim.position.set(0,lampBottom+.05,z);
    for(let k=0;k<4;k++){
     const angle=k*Math.PI/2,x=Math.sin(angle)*.49,zz=z+Math.cos(angle)*.49;
     tube([new THREE.Vector3(0,lampBottom+.43,z),new THREE.Vector3(x,lampBottom+.05,zz)],.025,m.gold,roof);
     cylinder(x,lampBottom+.12,zz,.09,.055,.09,m.gold,roof,8);
     cylinder(x,lampBottom+.23,zz,.065,.085,.18,m.glow,roof,8);
    }
    const hangerBottom=lampBottom+.43,hangerTop=ceilingHeight-.06;
    box(0,(hangerBottom+hangerTop)/2,z,.035,hangerTop-hangerBottom,.035,m.gold,roof);
   }
  }

}
