import * as THREE from '../vendor/three-core.js';
import {createSpurGear} from './lock-profiles.js';
import {createHousingGeometries} from './lab/geometry/housing.js';
import {createSymmetricShackleCurve} from './lab/geometry/shackle.js';
import {PIN_DRIVE_TEETH} from './lab/mechanisms/pin-drive.js';
import {GEAR_TRAIN_SPECS} from './lab/mechanisms/gear-lock.js';
import {DISASSEMBLY_PART_IDS} from './lab/mechanisms/disassembly-order.js';

// Printed workshop reference. The casing, gear teeth, shackle profile and
// inventory are derived from the physical 3D factories and disassembly list.
const OX=164,OY=151,UNIT=59;
const xy=(x,y)=>[OX+x*UNIT,OY-y*UNIT];
const f=value=>Number(value.toFixed(2));
const line=(x,y,x2,y2,style='')=>
  `<path d="M${f(x)} ${f(y)}L${f(x2)} ${f(y2)}" ${style}/>`;
const circle=(x,y,r,style='')=>
  `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" ${style}/>`;
const path=points=>points.map(([x,y],i)=>
  `${i?'L':'M'}${f(x)} ${f(y)}`).join('');

function geometryLines(geometry,x,y){
  const edges=new THREE.EdgesGeometry(geometry,28);
  const p=edges.getAttribute('position'),pieces=[];
  for(let i=0;i<p.count;i+=2){
    const a=[x+p.getX(i)*UNIT,y-p.getY(i)*UNIT];
    const b=[x+p.getX(i+1)*UNIT,y-p.getY(i+1)*UNIT];
    if(Math.hypot(a[0]-b[0],a[1]-b[1])>.15)
      pieces.push(`M${f(a[0])} ${f(a[1])}L${f(b[0])} ${f(b[1])}`);
  }
  edges.dispose();geometry.dispose();
  return pieces.join('');
}
function gear(teeth,r,x,y){
  const [gx,gy]=xy(x,y);
  const mesh=createSpurGear(THREE,teeth,r,.13,new THREE.MeshBasicMaterial());
  const contour=geometryLines(mesh.geometry,gx,gy);mesh.material.dispose();
  return `<g data-gear-teeth="${teeth}"><path d="${contour}" fill="none"
    stroke="#304d53" stroke-width=".92"/>
    ${circle(gx,gy,4,'fill="#f5f3e9" stroke="#304d53" stroke-width="1.3"')}
    ${line(gx-2.5,gy,gx+2.5,gy,'stroke="#304d53" stroke-width=".8"')}
  </g>`;
}
function shackle(){
  const d=path(createSymmetricShackleCurve(THREE).getSpacedPoints(65)
    .map(p=>xy(p.x+1.52,p.y-.64)));
  return `<g data-part="shackle-0">
    <path d="${d}" fill="none" stroke="#52666b" stroke-width="18"
      stroke-linejoin="round" stroke-linecap="round"/>
    <path d="${d}" fill="none" stroke="#f3f1e9" stroke-width="14"
      stroke-linejoin="round" stroke-linecap="round"/>
    <path d="${d}" fill="none" stroke="#b6c6c0" stroke-width=".7"/>
  </g>`;
}
function caseOutline(){
  const geometry=createHousingGeometries({THREE,depthRatio:.7}).createFrontBezel();
  const contour=geometryLines(geometry,OX,OY),[bx,by]=xy(-1.845,1.415);
  const fittings=[-1,1].flatMap(ix=>[-1,1].map(iy=>{
    const [x,y]=xy(ix*1.55,iy*1.08);
    return `<g data-part="fastener">
      ${circle(x,y,7.3,'fill="#f4f2e9" stroke="#415c60" stroke-width="1.1"')}
      ${circle(x,y,4.8,'fill="none" stroke="#415c60" stroke-width=".8"')}
      ${line(x-3.1,y-1.3,x+3.1,y+1.3,'stroke="#415c60" stroke-width="1.35"')}
    </g>`;
  })).join('');
  return `<rect data-part="rear-fixed" x="${f(bx)}" y="${f(by)}"
      width="${f(3.69*UNIT)}" height="${f(2.83*UNIT)}" rx="9.5"
      fill="#e9ece4" fill-opacity=".26" stroke="#9ba8a4"
      stroke-dasharray="3 3" stroke-width=".9"/>
    <path d="${contour}" fill="none" stroke="#344e52" stroke-width="1.25"/>
    ${fittings}`;
}
function spring(x){
  const coil=Array.from({length:57},(_,i)=>{
    const t=i/56;return xy(x+Math.sin(t*8*Math.PI)*.083,.59+t*.58);
  });
  return `<path data-part="spring" d="${path(coil)}" fill="none"
    stroke="#46666b" stroke-width="1.4" stroke-linecap="round"/>`;
}
function pinTrain(pinOrder){
  const roman=['I','II','III','IV'],xs=[-1.16,-.68,-.20,.28];
  const order=Array.isArray(pinOrder)&&pinOrder.length===4?pinOrder:[2,0,3,1];
  const [coreX,coreY]=xy(-1.81,-.31);
  const core=`<g data-part="core-0">
    <rect x="${f(coreX)}" y="${f(coreY-18)}" width="${f(2.42*UNIT)}"
      height="36" rx="14" fill="#e2d5be" fill-opacity=".46"
      stroke="#776953" stroke-width="1.4"/>
    ${circle(coreX+7,coreY,14,'fill="none" stroke="#776953" stroke-width="1"')}
    ${circle(coreX+2,coreY,6,'fill="none" stroke="#776953" stroke-width="1"')}
  </g>`;
  const pins=xs.map((x,i)=>{
    const [px,top]=xy(x,.56),seam=xy(x,.16)[1],bottom=xy(x,-.32)[1];
    return `<g data-pin-index="${i}" data-part="pin-${i} driver-${i} spring-${i}">
      ${spring(x)}
      <rect x="${f(px-5)}" y="${f(top)}" width="10" height="${f(seam-top)}"
        rx="4.8" fill="#d4dcd6" fill-opacity=".66" stroke="#3c5e64" stroke-width="1"/>
      <rect x="${f(px-5)}" y="${f(seam)}" width="10" height="${f(bottom-seam)}"
        rx="4.8" fill="#e7d7b7" fill-opacity=".7" stroke="#735e44" stroke-width="1"/>
      ${line(px-5,seam,px+5,seam,'stroke="#6a7773" stroke-dasharray="2 2" stroke-width="1"')}
      <text x="${f(px)}" y="${f(bottom+10)}" text-anchor="middle"
        font-size="9" font-weight="700" fill="#506669">${roman[order[i]]||'—'}</text>
    </g>`;
  }).join('');
  const [barX,barY]=xy(-.575,1.335);
  return `${core}${pins}
    <rect data-part="cover-0" x="${f(barX-2.11*UNIT/2)}"
      y="${f(barY-.12*UNIT/2)}" width="${f(2.11*UNIT)}"
      height="${f(.12*UNIT)}" rx="2" fill="#e4e6df"
      stroke="#304e55" stroke-width="1.7"/>`;
}
function pinGears(ratio){
  const reversed=ratio==='16:12';
  const input=reversed?PIN_DRIVE_TEETH.output:PIN_DRIVE_TEETH.input;
  const output=reversed?PIN_DRIVE_TEETH.input:PIN_DRIVE_TEETH.output;
  const r1=PIN_DRIVE_TEETH.pitch*input/PIN_DRIVE_TEETH.input;
  const r2=PIN_DRIVE_TEETH.pitch*output/PIN_DRIVE_TEETH.input;
  const next=.8+r1+r2;
  const [camX,camY]=xy(1.10,-.39),[boltX,boltY]=xy(1.48,-.60);
  return `<g data-part="gear-0 gear-1 rod-0 cam-0 bolt-0">
    ${gear(input,r1,.8,.68)}${gear(output,r2,next,.68)}
    ${line(...xy(next,.68),camX,camY,'stroke="#7b866c" stroke-width="1.4" stroke-dasharray="3 2"')}
    ${circle(camX,camY,9,'fill="none" stroke="#425e63" stroke-width="1.3"')}
    ${circle(camX+4,camY-3,2,'fill="#b1844f"')}
    ${line(camX+4,camY-3,boltX,boltY,'stroke="#456b70" stroke-width="2"')}
    <rect x="${f(boltX-9)}" y="${f(boltY-5)}" width="19" height="10"
      rx="2" fill="#d2dbd5" stroke="#41575a" stroke-width="1.2"/>
  </g>`;
}
function fiveGears(){
  const wheels=GEAR_TRAIN_SPECS.map(s=>gear(s.teeth,s.r,s.x,s.y)).join('');
  const last=GEAR_TRAIN_SPECS.at(-1);
  const [lx,ly]=xy(last.x,last.y),[bx,by]=xy(1.35,-.59);
  const oil=GEAR_TRAIN_SPECS.map(s=>{
    const [x,y]=xy(s.x,s.y+s.r+.17);
    return `<path d="M${f(x)} ${f(y-4)}q-3 4 0 7q3 -3 0 -7Z"
      fill="#b2894d" fill-opacity=".65" stroke="#997548" stroke-width=".5"/>`;
  }).join('');
  return `<g data-part="five-wheel-transmission">${wheels}
    <path d="M${f(lx+10)} ${f(ly+4)}Q${f(lx+31)} ${f(ly+30)} ${f(bx-9)} ${f(by)}"
      fill="none" stroke="#506d72" stroke-width="2" stroke-linecap="round"/>
    ${circle(lx+10,ly+4,3,'fill="#b38545" stroke="#455c60" stroke-width=".9"')}
    <rect x="${f(bx-12)}" y="${f(by-6)}" width="27" height="12" rx="2"
      fill="#e3e7dd" stroke="#3a595e" stroke-width="1.4"/>
    ${line(bx+15,by,bx+33,by,'stroke="#3a595e" stroke-width="2"')}
    ${oil}
  </g>`;
}
function callouts(gears){
  const points=gears?
    [[1,57,76],[2,95,117],[3,144,166],[4,231,133],[5,247,178],
      [6,287,195],[7,328,112],[8,177,93]]:
    [[1,58,224],[2,70,85],[3,138,66],[4,172,173],[5,185,102],
      [6,254,88],[7,96,181],[8,242,108],[9,234,179],[10,333,112],[11,57,150]];
  return points.map(([id,x,y])=>`<g>
    ${circle(x,y,7.3,'fill="#f7f5ed" stroke="#537075" stroke-width="1"')}
    <text x="${x}" y="${f(y+2.5)}" fill="#314b50" font-size="7.4"
      font-weight="700" text-anchor="middle">${String(id).padStart(2,'0')}</text>
  </g>`).join('');
}
function specification(gears,ratio){
  const rows=gears?[
    ['Корпус SIKISI','общий'],['Ведущая · 16 зубьев','1'],
    ['Промежуточные · 16/14/16','3'],['Ведомая · 14 зубьев','1'],
    ['Эксцентрик · шатун','2'],['Ригель выдвижной','1'],
    ['Дужка · две втулки','1+2'],['Маслёнка · точки смазки','5']
  ]:[
    ['Задняя стенка','фикс.'],['Крышка · винты','1+4'],
    ['Верхняя планка','1'],['Штифты нижн. / верхн.','4+4'],
    ['Пружины в лунках','4'],['Стойка с кольцом','4'],
    ['Цилиндр · стопорные скобы','1+2'],[`Шестерни ${ratio}`,'2'],
    ['Кулачок · шатун · ригель','3'],['Дужка · втулки','1+2'],
    ['Рамка · обечайка','2']
  ];
  return `<g data-specification="${gears?'gears':'pins'}" font-family="Arial,sans-serif">
    <text x="362" y="71" fill="#617577" font-size="8.5" font-weight="700"
      letter-spacing="1">СОСТАВ МЕХАНИЗМА</text>
    ${rows.map(([name,count],i)=>{
      const y=f(86+i*13.9),id=String(i+1).padStart(2,'0');
      return `<g data-item-number="${id}">
        <text x="362" y="${y}" fill="#9c865f" font-size="8.5" font-weight="700">${id}</text>
        <text x="380" y="${y}" fill="#344b4e" font-size="9">${name}</text>
        <text x="535" y="${y}" fill="#4b686b" font-size="8.5"
          font-weight="700" text-anchor="end">${count}</text>
      </g>`;
    }).join('')}
  </g>`;
}

export function manualIllustration(pinOrder=[2,0,3,1],
  {ratio='12:16',hardware=false,mode='pins'}={}){
  const gears=mode==='gears',physicalRatio=ratio==='16:12'?'16:12':'12:16';
  const physicalCount=DISASSEMBLY_PART_IDS.length;
  const removableCount=physicalCount+5; // Four corner screws + the outer plate.
  const title=gears?'ШЕСТЕРЁНЧАТЫЙ ПРИВОД':'ШТИФТОВЫЙ МЕХАНИЗМ';
  const internals=gears?fiveGears():`${pinTrain(pinOrder)}${pinGears(physicalRatio)}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 560 310"
    role="img" aria-label="Сборочный лист: ${title}"
    data-drawing-mode="${gears?'gears':'pins'}"
    data-real-part-count="${physicalCount}" data-removable-count="${removableCount}">
    <rect width="560" height="310" fill="#f5f3e9"/>
    <rect x="9" y="9" width="542" height="292" fill="none"
      stroke="#b4c0b8" stroke-width="1.1"/>
    <path d="M24 41H536M24 260H536" stroke="#a7b8af" stroke-width="1"/>
    <text x="24" y="25" font-family="Arial,sans-serif" font-size="12.2"
      font-weight="700" letter-spacing=".6" fill="#34494b">SIKISI · СБОРОЧНЫЙ ЛИСТ</text>
    <text x="536" y="25" font-family="Arial,sans-serif" font-size="9"
      text-anchor="end" fill="#6b7d7a">${gears?'02 / 02':'01 / 02'}</text>
    <text x="24" y="37" font-family="Arial,sans-serif" font-size="8.7"
      fill="#667772" letter-spacing=".5">${title} / ВИД СО СНЯТОЙ КРЫШКОЙ</text>
    <g data-assembly-view="physical-lock">
      ${shackle()}${internals}${caseOutline()}${callouts(gears)}
    </g>
    <path d="M353 51V251" stroke="#b7c2bd" stroke-width="1"/>
    ${specification(gears,physicalRatio)}
    <text x="24" y="274" font-family="Arial,sans-serif" font-size="10"
      font-weight="700" fill="#445d60">${gears?
        `5 ЗАЦЕПЛЕННЫХ ШЕСТЕРЁНОК · ${GEAR_TRAIN_SPECS.map(s=>s.teeth).join('–')} ЗУБЬЕВ`:
        `${removableCount} СЪЁМНЫХ УЗЛОВ · 4 ШТИФТОВЫХ КАНАЛА · ПЕРЕДАЧА ${physicalRatio}`}</text>
    <text x="24" y="289" font-family="Arial,sans-serif" font-size="8.9" fill="#63736f">${gears?
      'Ведущая слева · усилие проходит через все колёса · масло наносится на оси.':
      'Задняя стенка остаётся. Детали вынимаются по порядку, через доступные отверстия.'}</text>
    <text x="535" y="291" text-anchor="end" font-family="Arial,sans-serif"
      font-size="8" fill="#89968f">${gears?'ЗУБЧАТЫЙ ЗАМОК':hardware?
      'РАСШИРЕННАЯ СБОРКА':'БАЗОВАЯ СХЕМА'} · 001</text>
  </svg>`;
}
