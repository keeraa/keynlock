import { getHouseDimensions, normalizeHouseConfig } from './house-config.js';
import { windowLayout } from './house-layout.js';

// A small canvas preview for browsers with WebGL disabled. It follows the
// same blueprint as the Three.js model and supports drag rotation / zoom.
// WebGL-capable browsers always use the fully modelled Three.js version.
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const lerp=(a,b,t)=>a+(b-a)*t;

function tone(hex, amount) {
  const values=hex.startsWith('#')
    ? (()=>{const num=parseInt(hex.slice(1),16);return [(num>>16)&255,(num>>8)&255,num&255];})()
    : (hex.match(/[\d.]+/g)||[180,180,180]).slice(0,3).map(Number);
  return `rgb(${values.map(c=>clamp(Math.round(c*amount),0,255)).join(',')})`;
}

export function createHouseFallback(canvas, initial) {
  const context=canvas.getContext('2d');
  if(!context) return {update(){},setView(){},dispose(){}};
  let config=normalizeHouseConfig(initial);
  let azimuth=.59, elevation=.49,zoom=1;
  let pointer=null;
  let disposed=false;
  let project,paint;
  const paintedImages={};
  for (const [key,file] of [
    ['plaster','gouache-plaster.webp'],
    ['roof','gouache-roof-tiles.webp'],
    ['damage','gouache-plaster-chipped.webp'],
  ]) {
    const image=new Image();
    image.onload=()=>{paintedImages[key]=image;if(!disposed)draw();};
    image.src=new URL(`../../assets/house-textures/${file}`,import.meta.url).href;
  }
  const p=(x,y,z)=>project(x,y,z);
  const path=(coords,fill,stroke='#6d6556',lineWidth=1,painted=null)=>{
    context.beginPath();
    coords.forEach((pt,i)=>{const v=p(...pt);if(i===0)context.moveTo(v.x,v.y);else context.lineTo(v.x,v.y);});
    context.closePath();
    context.fillStyle=fill;context.fill();
    if(painted&&paintedImages[painted]){
      context.save();context.clip();
      context.globalCompositeOperation='multiply';
      const pattern=context.createPattern(paintedImages[painted],'repeat');
      if(pattern){
        if(typeof DOMMatrix!=='undefined'&&pattern.setTransform) pattern.setTransform(new DOMMatrix().scale(.38));
        context.fillStyle=pattern;context.fillRect(0,0,canvas.clientWidth,canvas.clientHeight);
      }
      context.restore();
    }
    if(painted==='plaster'&&config.plasterDamage&&config.damageAmount>0&&paintedImages.damage){
      context.save();context.clip();
      context.globalAlpha=Math.min(.97,.18+config.damageAmount*.008);
      const damagePattern=context.createPattern(paintedImages.damage,'repeat');
      if(damagePattern){
        if(typeof DOMMatrix!=='undefined'&&damagePattern.setTransform) {
          damagePattern.setTransform(new DOMMatrix().scale(.24*config.damageScale));
        }
        context.fillStyle=damagePattern;
        context.fillRect(0,0,canvas.clientWidth,canvas.clientHeight);
      }
      context.restore();
    }
    if(stroke){context.strokeStyle=stroke;context.lineWidth=lineWidth;context.stroke();}
  };
  const line=(coords,color,width=1.4)=>{
    context.beginPath();coords.forEach((pt,i)=>{const v=p(...pt);if(!i)context.moveTo(v.x,v.y);else context.lineTo(v.x,v.y);});
    context.strokeStyle=color;context.lineWidth=width;context.stroke();
  };
  const box=(x1,x2,y1,y2,z1,z2,color)=>{
    path([[x1,y1,z2],[x2,y1,z2],[x2,y2,z2],[x1,y2,z2]],color);
    path([[x2,y1,z2],[x2,y1,z1],[x2,y2,z1],[x2,y2,z2]],tone(color,.82));
    path([[x1,y2,z2],[x2,y2,z2],[x2,y2,z1],[x1,y2,z1]],tone(color,1.13));
  };
  const wallRect=(face,a,y,w,h,inset=0)=>{
    const hw=w/2,hh=h/2,top=y+hh,bottom=y-hh;
    if(face==='front')return [[a-hw,bottom,config.depth/2+inset],[a+hw,bottom,config.depth/2+inset],[a+hw,top,config.depth/2+inset],[a-hw,top,config.depth/2+inset]];
    if(face==='back')return [[a+hw,bottom,-config.depth/2-inset],[a-hw,bottom,-config.depth/2-inset],[a-hw,top,-config.depth/2-inset],[a+hw,top,-config.depth/2-inset]];
    const x=face==='right'?config.width/2+inset:-config.width/2-inset;
    return [[x,bottom,a+hw],[x,bottom,a-hw],[x,top,a-hw],[x,top,a+hw]];
  };
  const surface=(face,a,y,w,h,fill,border)=>path(wallRect(face,a,y,w,h,.06),fill,border);
  const archedFront=(x,bottom,width,springHeight,rise,inset,fill,stroke)=>{
    const z=config.depth/2+inset;
    const coords=[[x-width/2,bottom,z],[x+width/2,bottom,z],[x+width/2,bottom+springHeight,z]];
    for(let i=1;i<=22;i++){
      const angle=Math.PI*i/22;
      coords.push([x+Math.cos(angle)*width/2,bottom+springHeight+Math.sin(angle)*rise,z]);
    }
    path(coords,fill,stroke,1.8);
  };

  function window(face,a,y,w) {
    const h=1.25;
    surface(face,a,y,w+.18,h+.18,'#c3b7a4','#706955');
    surface(face,a,y,w,h,'#304c57','#716a56');
    surface(face,a,y,w-.15,h-.16,'#769aa2','#304751');
    line(face==='front'?[[a,y-h/2+.1,config.depth/2+.16],[a,y+h/2-.1,config.depth/2+.16]]:
      face==='right'?[[config.width/2+.16,y-h/2+.1,a],[config.width/2+.16,y+h/2-.1,a]]:
        [[-config.width/2-.16,y-h/2+.1,a],[-config.width/2-.16,y+h/2-.1,a]],'#e6d4ae',1.8);
    if(config.windowStyle==='arched') {
      const top=y+h/2;
      const arch=[];
      for(let i=0;i<=12;i++){
        const theta=Math.PI*i/12;
        const horizontal=Math.cos(theta)*w*.53;
        const v=top+Math.sin(theta)*w*.34;
        arch.push(face==='front'?[a+horizontal,v,config.depth/2+.14]:[face==='right'?config.width/2+.14:-config.width/2-.14,v,a+horizontal]);
      }
      line(arch,'#eadbc0',3.3);
    } else {
      surface(face,a,y+h/2+.09,w+.3,.13,'#e2d2b5','#9b917b');
    }
    if(config.shutters){
      for(const sign of [-1,1]) {
        surface(face,a+sign*(w*.68),y,w*.3,h,tone(config.woodColor,sign===1?.95:1.1),'#403b33');
        for(let j=-2;j<=2;j++){
          const part=wallRect(face,a+sign*(w*.68),y+j*h/7,w*.25,.02,.15);
          path(part,tone(config.woodColor,.68),null);
        }
      }
    }
    const sill=wallRect(face,a,y-h*.52,w+.31,.12,.15);
    path(sill,'#e6d6b6','#a39a82');
  }

  function entrance(y) {
    const w=1.36,h=config.doorStyle==='arched'?1.84:2.22;
    if(config.doorStyle==='arched'){
      archedFront(0,y,w+.23,h,.405,.09,'#ddd1b4','#746c55');
      archedFront(0,y,w,h,.33,.14,tone(config.woodColor,.85),'#51483b');
    }else{
      surface('front',0,y+h/2,w+.23,h+.15,'#ddd1b4','#746c55');
      surface('front',0,y+h/2,w,h,tone(config.woodColor,.85),'#51483b');
    }
    surface('front',-w*.24,y+h*.44,w*.37,h*.5,tone(config.woodColor,1.13),'#493f35');
    surface('front',w*.24,y+h*.44,w*.37,h*.5,tone(config.woodColor,1.04),'#493f35');
    line([[0,y+.1,config.depth/2+.2],[0,y+h-.1,config.depth/2+.2]],'#3a3430',1.9);
    if(config.doorStyle==='arched') {
      const points=[];for(let i=0;i<=14;i++){
        const a=Math.PI*i/14;points.push([Math.cos(a)*(w*.54),y+h+Math.sin(a)*.33,config.depth/2+.14]);
      }
      line(points,'#ebe0bf',4);
    }
    const dot=p(.16,y+h*.5,config.depth/2+.21);
    context.beginPath();context.arc(dot.x,dot.y,3.3,0,Math.PI*2);context.fillStyle='#e1be83';context.fill();
  }

  function walls(layout, top) {
    const w=config.width/2,d=config.depth/2;
    const faces=[
      {name:'back',points:[[-w,.32,-d],[w,.32,-d],[w,top,-d],[-w,top,-d]],depth:-d*Math.cos(azimuth)},
      {name:'left',points:[[-w,.32,d],[-w,.32,-d],[-w,top,-d],[-w,top,d]],depth:-w*Math.sin(azimuth)},
      {name:'right',points:[[w,.32,-d],[w,.32,d],[w,top,d],[w,top,-d]],depth:w*Math.sin(azimuth)},
      {name:'front',points:[[-w,.32,d],[w,.32,d],[w,top,d],[-w,top,d]],depth:d*Math.cos(azimuth)},
    ].sort((a,b)=>a.depth-b.depth);
    for(const face of faces) {
      const name=face.name;
      const intensity=name==='front'?1:name==='right'?.83:name==='left'?.89:.73;
      path(face.points,tone(config.plasterColor,intensity),'#968771',1.4,'plaster');
      for(let i=0;i<=config.floors;i++){
        const y=.32+i*config.floorHeight;
        if(name==='front')line([[-w,y,d+.05],[w,y,d+.05]],'#cfb9a0',2.4);
        if(name==='back')line([[-w,y,-d-.05],[w,y,-d-.05]],'#af9e83',2);
        if(name==='right'||name==='left')line([[name==='right'?w+.05:-w-.05,y,-d],[name==='right'?w+.05:-w-.05,y,d]],'#b2a18a',2);
      }
      if(config.timberFrame){
        const timber=tone(config.woodColor,.85);
        for(let i=0;i<=config.floors;i++){
          const y=.32+i*config.floorHeight;
          if(name==='front'||name==='back')line([[-w,y,name==='front'?d+.10:-d-.10],[w,y,name==='front'?d+.10:-d-.10]],timber,4);
          else line([[name==='right'?w+.10:-w-.10,y,-d],[name==='right'?w+.10:-w-.10,y,d]],timber,4);
        }
      }
      if(name==='front') {
        layout.front.forEach(win=>window('front',win.x,win.y,win.width));
        entrance(.35);
        if(config.balcony&&config.floors>1) {
          const y=.32+config.floorHeight+.20;
          path([[-1.25,y,d],[1.25,y,d],[1.25,y,d+1.1],[-1.25,y,d+1.1]],'#a89c84','#776852');
          const rail=tone(config.woodColor,.82);
          for(let x=-1.1;x<=1.11;x+=.55)line([[x,y+.08,d+1],[x,y+.95,d+1]],rail,3);
          line([[-1.2,y+.95,d+1],[1.2,y+.95,d+1]],rail,4);
          const doorBottom=y+.31;
          if(config.doorStyle==='arched'){
            archedFront(0,doorBottom,1.28,1.74,.355,.09,'#e4d6b7','#9d917a');
            archedFront(0,doorBottom,1.1,1.74,.28,.15,'#425967','#e4d6b7');
            line([[0,doorBottom+.1,d+.20],[0,doorBottom+1.94,d+.20]],'#a9a38b',2);
          }else{
            surface('front',0,y+1.18,1.1,1.9,'#425967','#e4d6b7');
          }
        }
      } else if(name==='right'||name==='left') layout.sides.forEach(win=>window(name,win.z,win.y,win.width));
    }
  }

  function roof(top) {
    const w=config.width/2,d=config.depth/2;
    const ew=w+.35,ed=d+.35;
    const height=config.roofType==='flat'?.24:config.roofHeight;
    if(config.roofType==='flat'){
      box(-ew,ew,top,top+.28,-ed,ed,tone(config.roofColor,.89));
      return;
    }
    const roofPlanes=[];
    const eaveY=top-height*.35/w;
    if(config.roofType==='gable'){
      for(const z of [-d,d])path([[-w,top,z],[w,top,z],[0,top+height,z]],tone(config.plasterColor,.86),'#8c7562',1,'plaster');
      roofPlanes.push([[-ew,eaveY,ed],[-ew,eaveY,-ed],[0,top+height,-ed],[0,top+height,ed]]);
      roofPlanes.push([[ew,eaveY,-ed],[ew,eaveY,ed],[0,top+height,ed],[0,top+height,-ed]]);
    } else {
      const ridge=Math.max(.4,d-w*.75);
      roofPlanes.push([[-ew,eaveY,ed],[-ew,eaveY,-ed],[0,top+height,-ridge],[0,top+height,ridge]]);
      roofPlanes.push([[ew,eaveY,-ed],[ew,eaveY,ed],[0,top+height,ridge],[0,top+height,-ridge]]);
      roofPlanes.push([[-ew,eaveY,ed],[ew,eaveY,ed],[0,top+height,ridge]]);
      roofPlanes.push([[ew,eaveY,-ed],[-ew,eaveY,-ed],[0,top+height,-ridge]]);
    }
    roofPlanes.sort((a,b)=>{
      const depth=v=>v.reduce((sum,t)=>sum+t[0]*Math.sin(azimuth)+t[2]*Math.cos(azimuth),0)/v.length;
      return depth(a)-depth(b);
    });
    roofPlanes.forEach((quad,index)=>{
      path(quad,tone(config.roofColor,index%2?.95:1.09),'#694b44',2,'roof');
      // Tile courses follow the sloping cross-section.
      if(quad.length<4)return;
      for(let row=1;row<9;row++) {
        const k=row/9;
        const a=[0,1,2].map(j=>lerp(quad[0][j],quad[3][j],k));
        const b=[0,1,2].map(j=>lerp(quad[1][j],quad[2][j],k));
        line([a,b],tone(config.roofColor,.68),1.15);
      }
      for(let col=0;col<8;col++)for(let row=0;row<8;row++) {
        const k=(col+.5*(row%2))/8,t=row/9,u=(row+.82)/9;
        const at=(r)=>{
          const a=[0,1,2].map(j=>lerp(quad[0][j],quad[1][j],k));
          const b=[0,1,2].map(j=>lerp(quad[3][j],quad[2][j],k));
          return [0,1,2].map(j=>lerp(a[j],b[j],r));
        };
        line([at(t),at(u)],tone(config.roofColor,.77),.7);
      }
    });
    if(config.chimney) {
      const x=w*.27,z=-d*.17;
      const base=top+height*.66;
      box(x-.34,x+.34,base,top+height+.88,z-.34,z+.34,'#a08779');
      box(x-.46,x+.46,top+height+.84,top+height+1,z-.43,z+.43,'#a99d8d');
    }
  }

  function draw() {
    config=normalizeHouseConfig(config);
    const w=canvas.clientWidth,h=canvas.clientHeight;
    if(!w||!h)return;
    const dpr=Math.min(window.devicePixelRatio||1,2);
    if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){
      canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);
    }
    context.setTransform(dpr,0,0,dpr,0,0);context.clearRect(0,0,w,h);
    const size=getHouseDimensions(config);
    const scale=Math.min((w-90)/Math.max(10,size.width+size.depth*.9),
      (h-200)/Math.max(10,size.totalHeight*.96+size.depth*.65))*zoom;
    const cos=Math.cos(azimuth),sin=Math.sin(azimuth),rise=Math.cos(elevation),depth=Math.sin(elevation);
    project=(x,y,z)=>{
      const horizontal=x*cos-z*sin,back=x*sin+z*cos;
      return {x:w*.5+horizontal*scale,y:h*.58+(size.totalHeight*.45-y)*rise*scale+back*depth*scale};
    };
    const center=p(0,-.05,0);
    context.save();context.translate(center.x,center.y+10);context.scale(1,.33);
    context.beginPath();context.ellipse(0,0,scale*10,scale*9,0,0,Math.PI*2);
    context.fillStyle='#89806d36';context.filter='blur(16px)';context.fill();context.restore();
    box(-config.width/2-.25,config.width/2+.25,0,.31,-config.depth/2-.25,config.depth/2+.25,'#a6a18f');
    const layout=windowLayout(config);
    const top=.32+config.floorHeight*config.floors;
    walls(layout,top);
    roof(top);
  }

  function update(next) {config=normalizeHouseConfig(next);draw();}
  function setView(view) {
    if(view==='front'){azimuth=0;elevation=.16;}
    else if(view==='side'){azimuth=Math.PI/2;elevation=.19;}
    else if(view==='top'){azimuth=.45;elevation=1.35;}
    else {azimuth=.59;elevation=.49;}
    draw();
  }
  function down(event) {pointer={x:event.clientX,y:event.clientY};canvas.setPointerCapture(event.pointerId);}
  function move(event) {
    if(!pointer)return;
    azimuth+=(event.clientX-pointer.x)*.01;
    elevation=clamp(elevation+(event.clientY-pointer.y)*.006,.05,1.38);
    pointer={x:event.clientX,y:event.clientY};draw();
  }
  function up(){pointer=null;}
  function wheel(event){event.preventDefault();zoom=clamp(zoom*(event.deltaY>0?.92:1.08),.55,2);draw();}
  canvas.addEventListener('pointerdown',down);
  canvas.addEventListener('pointermove',move);
  canvas.addEventListener('pointerup',up);
  canvas.addEventListener('pointercancel',up);
  canvas.addEventListener('wheel',wheel,{passive:false});
  const observer=new ResizeObserver(draw);observer.observe(canvas.parentElement);
  draw();
  return {update,setView,dispose(){disposed=true;observer.disconnect();canvas.removeEventListener('pointerdown',down);canvas.removeEventListener('pointermove',move);canvas.removeEventListener('pointerup',up);canvas.removeEventListener('pointercancel',up);canvas.removeEventListener('wheel',wheel);}};
}
