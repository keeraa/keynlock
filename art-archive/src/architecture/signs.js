export function createSignBuilder({THREE,labels,mesh,disposable,signUpdates,translate}){
 function sign(text,x,y,z,angle=0,scale=1,parent=labels,curveRadius=null,accent=null){
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=160;
  const c=canvas.getContext('2d'),tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;
  const draw=()=>{c.fillStyle='#273c36';c.fillRect(0,0,1024,160);c.strokeStyle=accent??'#b99b64';c.lineWidth=5;c.strokeRect(10,10,1004,140);if(accent){c.fillStyle=accent;c.fillRect(18,18,22,124);c.fillRect(984,18,22,124);}c.fillStyle='#ede1bd';c.font='bold 64px Georgia';c.textAlign='center';c.textBaseline='middle';c.fillText(translate(text),512,82,920);tex.needsUpdate=true;};draw();signUpdates.push(draw);
  const mat=new THREE.MeshBasicMaterial({map:tex});disposable.add(tex);disposable.add(mat);
  const geometry=new THREE.PlaneGeometry(3.5*scale,.55*scale,32,1);
  if(curveRadius){const p=geometry.attributes.position;for(let i=0;i<p.count;i++){const a=p.getX(i)/curveRadius;p.setXYZ(i,Math.sin(a)*curveRadius,p.getY(i),curveRadius*(1-Math.cos(a)));}geometry.computeVertexNormals();}
  const o=mesh(geometry,mat,parent);o.position.set(x,y,z);o.rotation.y=angle;return o;
 }
 return sign;
}
