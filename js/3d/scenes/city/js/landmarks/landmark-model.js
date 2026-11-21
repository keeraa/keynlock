// KEYNLOCK landmarks: reusable world-space meshes, front entrances face +Z.
// All dimensions are in metres; LODs retain their major architectural masses.
import {createLandmarkGeometry} from './landmark-geometry.js';
import {createLandmarkMaterials} from './landmark-materials.js';
import {buildChurch} from './buildings/church.js';
import {buildTheater} from './buildings/theater.js';
import {buildMuseum} from './buildings/museum.js';
import {buildTownhall} from './buildings/townhall.js';
import {buildPalace} from './buildings/palace.js';
import {buildTower} from './buildings/tower.js';

export const LANDMARK_CATALOG = Object.freeze([
  {id:'church',name:'Церковь главной площади',short:'Церковь',district:'Старый город',role:'Духовный центр',subtitle:'Каменный неф · колокольня · витражи',description:'Высокая колокольня, старый каменный неф с контрфорсами, цветные витражи и ступени у парадного входа.',footprint:'11 × 24 м'},
  {id:'theater',name:'Королевский театр',short:'Театр',district:'Богемный квартал',role:'Культура',subtitle:'Портик · фронтон · сцена',description:'Небольшой городской театр с глубокой сценической коробкой, классическим портиком и красной черепичной кровлей.',footprint:'21 × 25 м'},
  {id:'museum',name:'Городской музей искусств',short:'Музей',district:'Квартал искусств',role:'Культура и коллекции',subtitle:'Колоннада · медный купол · скульптуры',description:'Светлое каменное здание с шестиколонным портиком, медным куполом и парадной лестницей.',footprint:'25 × 19 м'},
  {id:'townhall',name:'Ратуша Кийенлока',short:'Ратуша',district:'Старый город',role:'Городская власть',subtitle:'Часовая башня · балкон · аркады',description:'Городская ратуша с большими часами, торговой аркадой первого этажа и галереей под башней.',footprint:'19 × 15 м'},
  {id:'palace',name:'Дворец Кийенлока',short:'Дворец',district:'Дворцовый холм',role:'Резиденция',subtitle:'Крылья · павильоны · парадный двор',description:'Симметричная резиденция с высоким центральным ризалитом, двумя крыльями и четырьмя угловыми башенками.',footprint:'44 × 24 м'},
  {id:'tower',name:'Высокая башня Кийенлока',short:'Высокая башня',district:'Верхний город',role:'Городской ориентир',subtitle:'Каменная башня · часы · медный шпиль',description:'Самая высокая постройка над крышами Кийенлока: многоярусная каменная башня с четырьмя циферблатами, открытой смотровой галереей и узким медным шпилем. Видна из порта и с дальних мостов.',footprint:'12 × 12 м'},
]);

const DETAILS=['high','medium','low'];
export const LANDMARK_CHIMNEY_DEFAULTS=Object.freeze({
  church:false,theater:false,museum:false,townhall:false,palace:true,tower:false,
});
export function landmarkTriangleCount(root) {
  let triangles=0,meshes=0;
  root.traverse(object=>{
    if(!object.isMesh)return;
    meshes++;
    const geometry=object.geometry;
    triangles+=(geometry.index?.count??geometry.getAttribute('position')?.count??0)/3;
  });
  return {triangles:Math.round(triangles),meshes};
}

export function createLandmarkModel(T,id,{detail='high',chimneys=LANDMARK_CHIMNEY_DEFAULTS[id]}={}) {
  if(!DETAILS.includes(detail))throw new Error(`Неизвестный LOD: ${detail}`);
  if(!LANDMARK_CATALOG.some(item=>item.id===id))throw new Error(`Неизвестный памятник: ${id}`);
  const hi=detail==='high',lo=detail==='low',mid=!hi&&!lo;
  const root=new T.Group();root.name=`KEYNLOCK · ${id} · ${detail}`;
  const {m,textureLease,paintedSurfaces}=createLandmarkMaterials(T);
  const primitives=createLandmarkGeometry(T,root,m,{hi,lo,paintedSurfaces});
  const builders={church:buildChurch,theater:buildTheater,museum:buildMuseum,townhall:buildTownhall,palace:buildPalace,tower:buildTower};
  builders[id]({T,root,m,hi,lo,mid,chimneys,...primitives});
  const stats=landmarkTriangleCount(root);
  const setWindowAppearance=({gloss=72,reflection=46,night=false,glow=64,envMap=null}={})=>{
    const g=T.MathUtils.clamp(gloss/100,0,1),r=T.MathUtils.clamp(reflection/100,0,1);
    for(const mat of [m.glass,m.glassLight]){
      if(mat.envMap!==envMap){mat.envMap=envMap;mat.needsUpdate=true;}
      mat.roughness=.55-g*.5;
      mat.metalness=.025+r*.25;
      mat.clearcoat=.2+g*.8;
      mat.clearcoatRoughness=.3-g*.26;
      mat.envMapIntensity=.18+r*1.75;
      mat.emissive.set(night?'#e49753':'#000000');
      mat.emissiveIntensity=night?(.35+T.MathUtils.clamp(glow/100,0,1)*1.16):0;
    }
  };
  setWindowAppearance();
  // Model-level resources are owned by this instance only; never dispose
  // imported city or house materials when changing the inspector's model.
  const dispose=()=>{
    const geos=new Set();root.traverse(o=>{if(o.isMesh)geos.add(o.geometry);});
    geos.forEach(g=>g.dispose());textureLease.release();Object.values(m).forEach(mat=>mat.dispose());
  };
  return {group:root,dispose,stats,detail,id,setWindowAppearance,textureMaps:textureLease.maps,
    entranceCount:(()=>{let count=0;root.traverse(o=>{if(o.userData.entrance)count++;});return count;})()};
}
