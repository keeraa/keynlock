import {keyImprintContours} from './key-imprint-contours.js';
import {createSoapImpression} from './soap-imprint.js';
export {keyImprintContours} from './key-imprint-contours.js';

// A thin paper-like blueprint made from the actual target geometry. Light,
// slightly broken parallel strokes read as pencil marks instead of vector ink.
export function paintKeyBlueprint(ctx,THREE,targets){
  const {width:w,height:h}=ctx.canvas;
  const background=ctx.createLinearGradient(0,0,w,h);
  background.addColorStop(0,'#112942');
  background.addColorStop(.52,'#173856');
  background.addColorStop(1,'#10273e');
  ctx.fillStyle=background;ctx.fillRect(0,0,w,h);

  ctx.lineWidth=1;
  for(let x=38;x<w;x+=48){
    ctx.strokeStyle=x%240<48?'rgba(190,218,232,.105)':'rgba(173,207,227,.040)';
    ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();
  }
  for(let y=34;y<h;y+=48){
    ctx.strokeStyle=y%240<48?'rgba(190,218,232,.105)':'rgba(173,207,227,.040)';
    ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();
  }
  // Subtle deterministic paper grain (repeated renders never shimmer).
  for(let i=0;i<3500;i++){
    const x=(i*2087.13)%w,y=(i*1201.79)%h;
    ctx.fillStyle=i%5===0?'rgba(225,238,248,.035)':'rgba(5,16,34,.052)';
    ctx.fillRect(x,y,1.4+(i%3)*.4,.7);
  }

  const contours=keyImprintContours(THREE,targets);
  const all=contours.flat(),xs=all.map(p=>p[0]),ys=all.map(p=>p[1]);
  const minX=Math.min(...xs),maxX=Math.max(...xs);
  const minY=Math.min(...ys),maxY=Math.max(...ys);
  const scale=Math.min((w-260)/(maxX-minX),(h-225)/(maxY-minY));
  const cx=(minX+maxX)/2,cy=(minY+maxY)/2;
  const project=([x,y])=>[(x-cx)*scale+w/2,(cy-y)*scale+h/2];

  ctx.lineCap='round';ctx.lineJoin='round';
  for(const [contourIndex,contour] of contours.entries()){
    const path=contour.map(project);
    for(let pass=0;pass<3;pass++){
      ctx.strokeStyle=pass===0?'rgba(227,235,242,.18)':
        pass===1?'rgba(221,236,245,.83)':'rgba(177,202,222,.34)';
      ctx.lineWidth=pass===0?5.6:pass===1?3.6:1.9;
      ctx.beginPath();
      let segmentIndex=0;
      for(let i=1;i<path.length;i++){
        const [ax,ay]=path[i-1],[bx,by]=path[i];
        const dx=bx-ax,dy=by-ay,length=Math.hypot(dx,dy);
        if(!length)continue;
        const steps=Math.ceil(length/8);
        for(let j=0;j<=steps;j++){
          const t=j/steps;
          const phase=(segmentIndex+j)*.86+contourIndex*3.7+pass*2.2;
          const jitter=pass===1?1.10:pass===0?1.75:2.6;
          const slip=(Math.sin(phase)*.66+Math.sin(phase*2.31)*.34)*jitter;
          const x=ax+dx*t-dy/length*slip;
          const y=ay+dy*t+dx/length*slip;
          if(i===1&&j===0)ctx.moveTo(x,y);
          else ctx.lineTo(x,y);
        }
        segmentIndex+=steps;
      }
      ctx.stroke();
    }
  }

  // Faint registration ticks reinforce the blueprint material without hiding
  // the one thing the player needs to copy: the shape of the key.
  ctx.strokeStyle='rgba(204,225,237,.23)';ctx.lineWidth=1.5;
  for(const [x,y,sx,sy] of [[56,57,1,1],[w-56,57,-1,1],
    [56,h-57,1,-1],[w-56,h-57,-1,-1]]){
    ctx.beginPath();ctx.moveTo(x+sx*21,y);ctx.lineTo(x,y);
    ctx.lineTo(x,y+sy*21);ctx.stroke();
  }
}

export function createKeyImprintBoard(THREE,parent){
  const board=new THREE.Group();
  // A wooden backplate is fixed flush to the rear workshop wall.
  board.position.set(-.78,1.68,-1.01);
  board.visible=false;parent.add(board);
  const wood=new THREE.Mesh(new THREE.BoxGeometry(3.12,1.04,.060),
    new THREE.MeshStandardMaterial({color:0x6e5039,roughness:.94}));
  wood.castShadow=true;wood.receiveShadow=true;board.add(wood);
  const paperMaterial=new THREE.MeshBasicMaterial({color:0x16314d,side:THREE.DoubleSide});
  const paper=new THREE.Mesh(new THREE.PlaneGeometry(3.015,.936),paperMaterial);
  paper.position.z=.0315;board.add(paper);
  const mounting=new THREE.Group();board.add(mounting);
  const pinMaterial=new THREE.MeshStandardMaterial({color:0xcab889,
    roughness:.48,metalness:.57});
  const screws=[];
  for(const x of [-1.40,1.40])for(const y of [-.403,.403]){
    const pin=new THREE.Mesh(new THREE.SphereGeometry(.024,10,8),pinMaterial);
    pin.position.set(x,y,.045);mounting.add(pin);screws.push(pin);
  }
  // Four small retaining lips hold the thicker soap sample on the plaque.
  const soapMount=new THREE.Group();board.add(soapMount);
  const clipMaterial=new THREE.MeshStandardMaterial({color:0x92734e,
    roughness:.66,metalness:.42});
  const soapClips=[];
  for(const x of [-1.47,1.47])for(const y of [-.30,.30]){
    const clip=new THREE.Mesh(new THREE.BoxGeometry(.115,.16,.09),clipMaterial);
    clip.position.set(x,y,.217);soapMount.add(clip);soapClips.push(clip);
  }
  // Brackets sit behind the plaque, against the masonry rather than floating.
  const brackets=[];
  for(const x of [-1.20,1.20]){
    const bracket=new THREE.Mesh(new THREE.BoxGeometry(.14,.27,.074),
      new THREE.MeshStandardMaterial({color:0x344348,roughness:.68,metalness:.45}));
    bracket.position.set(x,.13,-.051);board.add(bracket);brackets.push(bracket);
  }
  let soap=null;

  function setBlueprint(targets){
    if(soap){board.remove(soap.group);soap.dispose();}
    soap=createSoapImpression(THREE,targets);
    soap.group.scale.y=paper.scale.y;
    soap.group.visible=false;board.add(soap.group);
    // Keep the geometry-only unit tests independent of a browser canvas.
    if(typeof document==='undefined')return;
    const canvas=document.createElement('canvas');
    canvas.width=2048;canvas.height=704;
    const ctx=canvas.getContext('2d');if(!ctx)return;
    paintKeyBlueprint(ctx,THREE,targets);
    const texture=new THREE.CanvasTexture(canvas);
    texture.colorSpace=THREE.SRGBColorSpace;
    texture.anisotropy=8;
    paperMaterial.map?.dispose();
    paperMaterial.map=texture;
    paperMaterial.color.set(0xffffff);
    paperMaterial.needsUpdate=true;
  }
  function setOrientation(next){
    const direction=next==='bottom'?-1:1;
    paper.scale.y=direction;
    if(soap)soap.group.scale.y=direction;
  }
  function setDisplayMode(method){
    board.visible=method==='imprint'||method==='soap';
    paper.visible=method==='imprint';
    mounting.visible=method==='imprint';
    soapMount.visible=method==='soap';
    if(soap)soap.group.visible=method==='soap';
  }
  function dispose(){
    if(soap){board.remove(soap.group);soap.dispose();soap=null;}
    for(const screw of screws)screw.geometry.dispose();pinMaterial.dispose();
    for(const clip of soapClips)clip.geometry.dispose();clipMaterial.dispose();
    for(const bracket of brackets){bracket.geometry.dispose();bracket.material.dispose();}
    wood.geometry.dispose();wood.material.dispose();
    paper.geometry.dispose();paperMaterial.map?.dispose();paperMaterial.dispose();
    parent.remove(board);
  }
  return {group:board,setBlueprint,setOrientation,setDisplayMode,dispose};
}
