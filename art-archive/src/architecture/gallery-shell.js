export function buildGalleryShell(context, {g,roof,start,end}){
 const {THREE, layout, m, w, len, vaultRise, wallBays, height, mesh, box, tube, shapeMesh}=context;
  box(0,-.12,start+len/2,w,.24,len,m.floor,g).name='gallery-floor';
  box(0,.015,start+len/2,2.15,.035,len-1.6,m.rug,g);
  for(const x of [-1.09,1.09])box(x,.04,start+len/2,.035,.014,len-1.6,m.gold,g);
  for(const side of [-1,1]){
   // Side walls overlap the shared entrance boundary inside their thickness.
   const edge=start-.09;
   const length=end-edge;

   // Wide uninterrupted plaster fields for the three-row hanging layout.
   box(side*w/2,(height+.25)/2,edge+length/2,.28,height+.25,length,m.plaster,g).name='gallery-wall';

   for(let i=0;i<=wallBays;i++){
    const z=i===0?edge+.08:edge+i*length/wallBays;
    // Inlaid vertical trim stays behind the backs of the frames.
    box(side*(w/2-.14),(height+.18)/2,z,.008,height+.18,.16,m.ivory,g);
   }
  }
  // One continuous arched end wall. No detached cap or raised floor strip.
  const endShape=new THREE.Shape();endShape.moveTo(-w/2,0);endShape.lineTo(w/2,0);endShape.lineTo(w/2,height);
  for(let j=0;j<=24;j++){const a=j/24*Math.PI;endShape.lineTo(Math.cos(a)*w/2,height+Math.sin(a)*vaultRise);}endShape.closePath();
  const endGeometry=new THREE.ExtrudeGeometry(endShape,{depth:.3,bevelEnabled:false});
  const endUV=endGeometry.attributes.uv;for(let i=0;i<endUV.count;i++)endUV.setXY(i,endUV.getX(i)/3.5,endUV.getY(i)/3.5);
  const endWall=mesh(endGeometry,m.plaster,g);endWall.name='gallery-end-wall';endWall.position.z=end-.15;
  // Continuous U-shaped skirting and cap: one mesh, no overlapping corner bars.
  function uStrip(outerX,innerX,outerZ,innerZ,y,depth,material){
   return shapeMesh([{x:-outerX,z:start-.15},{x:-outerX,z:outerZ},{x:outerX,z:outerZ},{x:outerX,z:start-.15},{x:innerX,z:start-.15},{x:innerX,z:innerZ},{x:-innerX,z:innerZ},{x:-innerX,z:start-.15}],[],y,depth,material,g);
  }
  uStrip(w/2+.08,w/2-.20,end+.08,end-.22,0,.76,m.wood).name='gallery-wainscot';
  uStrip(w/2+.10,w/2-.24,end+.10,end-.26,.76,.08,m.ivory).name='gallery-wainscot-cap';
  for(const side of [-1,1])box(side*(w/2-.137),(height+.18)/2,end-.12,.008,height+.18,.06,m.ivory,g);
  // Cove moulding follows the actual ceiling intersection, around both end corners.
  const tx=w/2-.18,ty=height+vaultRise*Math.sqrt(1-(tx/(w/2))**2)-.06;
  for(const side of [-1,1])tube([new THREE.Vector3(side*tx,ty,start),new THREE.Vector3(side*tx,ty,end-.23)],.065,m.ivory,roof);
  const arch=Array.from({length:49},(_,i)=>{const x=-tx+2*tx*i/48;return new THREE.Vector3(x,height+vaultRise*Math.sqrt(1-(x/(w/2))**2)-.06,end-.23);});tube(arch,.065,m.ivory,roof);

}
