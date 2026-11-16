/** Original metal finishes and the single reproducible roughness texture. */
export function createLockMaterials({THREE,document,rand}) {
  const c=document.createElement('canvas');c.width=c.height=256;
  const ctx=c.getContext('2d');const image=ctx.createImageData(256,256);
  for(let i=0;i<image.data.length;i+=4){
    const grain=Math.floor(138+rand()*85);
    image.data[i]=grain;image.data[i+1]=grain;image.data[i+2]=grain;image.data[i+3]=255;
  }
  ctx.putImageData(image,0,0);
  for(let i=0;i<340;i++){
    const x=rand()*256,y=rand()*256;
    ctx.strokeStyle=`rgba(235,235,235,${.06+rand()*.09})`;
    ctx.lineWidth=.35+rand()*.5;
    ctx.beginPath();ctx.moveTo(x,y);
    ctx.lineTo(x+(rand()-.5)*8,y+(rand()-.5)*1.5);ctx.stroke();
  }
  const grainMap=new THREE.CanvasTexture(c);
  grainMap.wrapS=grainMap.wrapT=THREE.RepeatWrapping;
  grainMap.repeat.set(2,2);
  grainMap.colorSpace=THREE.NoColorSpace;
  grainMap.anisotropy=4;
  const material=(color,metalness=.7,roughness=.4,extras={})=>
    new THREE.MeshStandardMaterial({color,metalness,roughness,roughnessMap:grainMap,...extras});
  const mat={
    case:material(0x75898c,.78,.49),
    edge:material(0x283a41,.72,.47),
    dark:material(0x1b3039,.54,.62),
    inner:material(0x43525a,.68,.51),
    pinManifoldTop:material(0x37434b,.64,.63),
    steel:material(0xb5c5c7,.85,.33),
    chromed:material(0xdce3df,.94,.26),
    brass:material(0xd9ac6b,.82,.34),
    copper:material(0xb88157,.78,.4),
    spring:material(0xc0d3d3,.83,.33),
    key:material(0xe7c687,.84,.32),
    glass:material(0x75898c,.78,.49,{transparent:true,opacity:.24,
      depthWrite:false,side:THREE.DoubleSide}),
    ghost:material(0x92a7ab,.4,.47,{transparent:true,opacity:.16,
      depthWrite:false,side:THREE.DoubleSide}),
  };
  return {grainMap,material,mat};
}
