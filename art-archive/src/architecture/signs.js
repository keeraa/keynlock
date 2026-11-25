export function createSignBuilder({THREE,labels,mesh,disposable,signUpdates,translate}){
 function sign(text,x,y,z,angle=0,scale=1,parent=labels,curveRadius=null,paint=null){
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=160;
  const c=canvas.getContext('2d'),tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;
  const background=paint?'#'+paint.getHexString():'#273c36';
  const border=paint?'#'+paint.clone().multiplyScalar(.72).getHexString():'#b99b64';
  const luminance=paint?paint.r*.2126+paint.g*.7152+paint.b*.0722:0;
  const draw=()=>{
   c.fillStyle=background;c.fillRect(0,0,1024,160);
   c.strokeStyle=border;c.lineWidth=5;c.strokeRect(10,10,1004,140);
   c.fillStyle=luminance>.21?'#211c16':'#fff1cd';
   c.font='bold 64px Georgia';c.textAlign='center';c.textBaseline='middle';c.fillText(translate(text),512,82,920);tex.needsUpdate=true;
  };draw();signUpdates.push(draw);
  const mat=new THREE.MeshBasicMaterial({map:tex});disposable.add(tex);disposable.add(mat);
  const geometry=new THREE.PlaneGeometry(3.5*scale,.55*scale,32,1);
  if(curveRadius){const p=geometry.attributes.position;for(let i=0;i<p.count;i++){const a=p.getX(i)/curveRadius;p.setXYZ(i,Math.sin(a)*curveRadius,p.getY(i),curveRadius*(1-Math.cos(a)));}geometry.computeVertexNormals();}
  const o=mesh(geometry,mat,parent);o.position.set(x,y,z);o.rotation.y=angle;return o;
 }
 return sign;
}
