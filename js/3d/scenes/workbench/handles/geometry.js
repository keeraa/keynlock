import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

export const HANDLE_HEIGHT=5.4;
export const defs=[
 ['Мраморная прямая','Спокойный цилиндр, лёгкий скос и округление снизу',[[0,.57],[.06,.67],[.18,.70],[.56,.70],[.86,.69],[.97,.62],[1,.52]],'plain'],
 ['Узкая округлая','Узкий плавный цилиндр, мягкий торец без металлических ободов',[[0,.25],[.06,.52],[.13,.60],[.84,.60],[.95,.47],[1,.25]],'round'],
 ['Гранёная ромбическая','Восемь граней, плечики и зауженная нижняя часть',[[0,.43],[.03,.56],[.13,.65],[.52,.78],[.82,.75],[.97,.66],[1,.53]],'faceted'],
 ['Тигровая','Мощный прямой корпус, широкие торцевые металлические кольца',[[0,.66],[.035,.72],[.09,.76],[.13,.72],[.86,.72],[.91,.78],[.97,.78],[1,.66]],'tiger'],
 ['Чёрная лаковая','Стройный вытянутый овал, сильное скругление сверху и снизу',[[0,.17],[.07,.43],[.17,.56],[.51,.61],[.83,.55],[.95,.38],[1,.13]],'slender'],
 ['Лесная','Вытянутый восьмигранный профиль со скошенными окончаниями',[[0,.37],[.055,.55],[.16,.66],[.78,.67],[.93,.58],[1,.37]],'forest'],
 ['Сакура','Тонкая цилиндрическая форма с округлой пяткой и плечом',[[0,.18],[.065,.43],[.16,.51],[.82,.51],[.96,.41],[1,.23]],'sakura'],
 ['Прямоугольная','Прямоугольное сечение, ровные плоскости и слегка смягчённые рёбра',[[0,.70],[1,.70]],'rect']
];

export function createClosedLathe(points,segments=48){
 const curve=new THREE.CatmullRomCurve3(points.map(([y,r])=>new THREE.Vector3(r,y*HANDLE_HEIGHT,0)),false,'centripetal');
 const smooth=curve.getPoints(points.length*6);
 // Cap rims align with the side-wall rings; their normals stay flat for a clean edge.
 smooth[0].set(points[0][1],0,0);
 smooth[smooth.length-1].set(points.at(-1)[1],HANDLE_HEIGHT,0);
 const shell=new THREE.LatheGeometry(smooth.map(p=>new THREE.Vector2(p.x,p.y)),segments);
 const bottom=new THREE.CircleGeometry(points[0][1],segments);bottom.rotateX(Math.PI/2);
 const top=new THREE.CircleGeometry(points.at(-1)[1],segments);top.rotateX(-Math.PI/2);top.translate(0,HANDLE_HEIGHT,0);
 const geometry=mergeGeometries([shell,bottom,top],false);
 shell.dispose();bottom.dispose();top.dispose();
 if(!geometry)throw new Error('Cannot merge handle geometry');
 geometry.computeBoundingSphere();
 return geometry;
}

export function createHandles({clay,edge,base}){
 function torus(group,r,y,thick=.045){
   const mesh=new THREE.Mesh(new THREE.TorusGeometry(r,thick,8,48),edge);
   mesh.rotation.x=Math.PI/2;mesh.position.y=y;group.add(mesh);
 }
 return defs.map(([name,description,profile,kind])=>{
   const root=new THREE.Group();
   const facets=['faceted','forest'].includes(kind)?32:48;
   const mesh=new THREE.Mesh(kind==='rect'?new THREE.BoxGeometry(1.8,HANDLE_HEIGHT,.88):createClosedLathe(profile,facets),clay);
   if(kind==='rect')mesh.position.y=HANDLE_HEIGHT/2;
   mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.handleBody=true;root.add(mesh);
   if(kind==='tiger')for(const y of [.09,.25,.44,4.88,5.09,5.28])torus(root,.73,y,.05);
   if(kind==='faceted')for(const y of [.11,5.3])torus(root,.58,y,.024);
   if(kind==='forest')for(const y of [.10,5.31])torus(root,.49,y,.028);
   if(kind==='tiger'){
     const cap=new THREE.Mesh(new THREE.CylinderGeometry(profile.at(-1)[1]*.94,profile.at(-1)[1]*.94,.09,64),edge);
     cap.position.y=5.39;root.add(cap);
   }
   const pedestal=new THREE.Mesh(new THREE.CylinderGeometry(.98,1.02,.12,64),base);
   pedestal.position.y=-.14;root.add(pedestal);
   return root;
 });
}
