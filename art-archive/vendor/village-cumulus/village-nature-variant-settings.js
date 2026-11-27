const range=(label,min,max,step,value)=>({type:'range',label,min,max,step,value});
const choice=(label,value)=>({type:'select',label,value,options:['low','medium','high']});
export const VILLAGE_NATURE_VARIANTS=Object.freeze({
 meadow:{key:'nature.windMeadow',name:'Ветровая трава',package:'@village/meadow',entry:'createVillageWindMeadow',icon:'nature-grass',group:'nature',description:'Объёмные стебли, направленный ветер, LOD и настраиваемая ночная видимость.',controls:{
  quality:choice('Качество','high'),height:range('Высота травы',.15,1.98,.03,1.98),density:range('Густота',.1,2,.05,2),width:range('Ширина стебля',.015,.12,.005,.065),wind:range('Сила ветра',0,1.2,.05,.35),direction:range('Направление ветра',0,360,5,0),nightBrightness:range('Ночная подсветка',0,.7,.01,.34),softness:range('Мягкость вдали',0,1.5,.05,.8),color:{type:'color',label:'Цвет травы',value:'#85985d'},tipColor:{type:'color',label:'Цвет верхушек',value:'#b9c682'}}},
 cumulus:{key:'atmosphere.windCumulus',name:'Плывущие облака',package:'@village/cumulus',entry:'createVillageCloudField',icon:'cloud',group:'appearance',description:'Объёмные облака с освещением и непрерывным притоком по направлению ветра.',controls:{
  quality:choice('Качество облаков','high'),count:range('Количество облаков',8,96,8,64),height:range('Высота облаков',18,60,1,24),scale:range('Размер облаков',.5,2,.05,1),coverage:range('Облачность',0,1,.05,.8),wind:range('Сила ветра',0,1.2,.05,.35),direction:range('Направление ветра',0,360,5,0),speed:range('Скорость облаков',0,3,.05,1),sunColor:{type:'color',label:'Светлая часть',value:'#fff3dc'},shadeColor:{type:'color',label:'Теневая часть',value:'#778e9a'}}}
});
export function normaliseNatureVariant(kind,input={}){
 const definition=VILLAGE_NATURE_VARIANTS[kind];if(!definition)throw Error('Unknown nature variant');const output={};
 for(const [key,c]of Object.entries(definition.controls)){const v=input[key];output[key]=c.type==='range'?(Number.isFinite(v)?Math.max(c.min,Math.min(c.max,key==='count'?Math.round(v):v)):c.value):c.type==='color'?(typeof v==='string'&&/^#[0-9a-f]{6}$/i.test(v)?v:c.value):(c.options.includes(v)?v:c.value);}
 return output;
}
export function natureVariantPreset(kind,settings){return {schema:1,kind,settings:normaliseNatureVariant(kind,settings)};}
export function readNatureVariantPreset(value){if(value?.schema!==1||!VILLAGE_NATURE_VARIANTS[value.kind]||!value.settings||typeof value.settings!=='object')throw Error('Несовместимый пресет природы');return natureVariantPreset(value.kind,value.settings);}
