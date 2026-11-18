// Dedicated procedural woven-rag texture. Geometry and physics live elsewhere.
export function createClothTexture({THREE,document,rand}){
  const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;
  const context=canvas.getContext('2d');
  context.fillStyle='#b7a68d';context.fillRect(0,0,128,128);
  for(let i=0;i<128;i+=5){
    context.strokeStyle=i%10?'#c9bba2':'#8d8171';
    context.globalAlpha=.21;context.beginPath();context.moveTo(i,0);
    context.lineTo(i+9,128);context.stroke();
  }
  context.globalAlpha=1;
  for(let i=0;i<145;i++){
    const x=rand()*128,y=rand()*128,r=1+rand()*9;
    context.fillStyle=`rgba(86,73,58,${.025+rand()*.055})`;
    context.beginPath();context.ellipse(x,y,r,r*.55,rand()*6.28,0,Math.PI*2);
    context.fill();
  }
  context.globalCompositeOperation='destination-out';
  for(let i=0;i<80;i++){
    const edge=Math.floor(rand()*4),v=rand()*128,cut=rand()*5;
    context.fillRect(edge===0?0:edge===1?128-cut:v,
      edge===2?0:edge===3?128-cut:v,edge<2?cut:1,edge>=2?cut:1);
  }
  context.globalCompositeOperation='source-over';
  const texture=new THREE.CanvasTexture(canvas);
  texture.colorSpace=THREE.SRGBColorSpace;
  return texture;
}
