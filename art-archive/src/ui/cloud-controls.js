import {CLOUD_DEFAULTS,cloudSettings} from '../environment/clouds.js';
import {VILLAGE_NATURE_VARIANTS} from '../../vendor/village-cumulus/village-nature-variant-settings.js';
import {t,localizeDocument} from '../localization/i18n.js';
import {STORAGE_KEYS,readJson,writeJson} from '../persistence/storage.js';
export function readCloudSettings(){return cloudSettings(readJson(STORAGE_KEYS.clouds));}
export function bindCloudControls(clouds){
 const parent=document.getElementById('cloud-controls');let current=readCloudSettings(),timer;
 const inputs=new Map();
 function save(){writeJson(STORAGE_KEYS.clouds,current);}
 const details=document.createElement('details');details.id='cloud-settings';const summary=document.createElement('summary');summary.textContent=t('Небо');details.append(summary);
 const sky=document.createElement('input');sky.id='sky-color';sky.type='color';
 const skyLabel=document.createElement('label');skyLabel.htmlFor=sky.id;skyLabel.append(document.createTextNode(t('Цвет неба')),sky);details.append(skyLabel);
 const enabled=document.createElement('input');enabled.type='checkbox';enabled.checked=current.enabled;enabled.id='cloud-enabled';const onLabel=document.createElement('label');onLabel.className='check';onLabel.append(enabled,document.createTextNode(t('Показывать облака')));details.append(onLabel);
 function apply(key,value){current=cloudSettings({...current,[key]:value});save();clearTimeout(timer);
  if(['count','height','scale'].includes(key))timer=setTimeout(()=>clouds.configure(current),180);else clouds.configure(current);
 }
 enabled.onchange=()=>apply('enabled',enabled.checked);
 const labels={quality:'Качество облаков',count:'Количество облаков',height:'Высота над куполом',scale:'Размер облаков',coverage:'Облачность',wind:'Сила ветра',direction:'Направление ветра',speed:'Скорость облаков',sunColor:'Светлая часть',shadeColor:'Теневая часть'};
 for(const [key,c]of Object.entries(VILLAGE_NATURE_VARIANTS.cumulus.controls)){
  const row=document.createElement('label');row.htmlFor='cloud-'+key;const name=document.createElement('span');name.textContent=t(labels[key]);row.append(name);
  const input=document.createElement(c.type==='select'?'select':'input');input.id='cloud-'+key;
  if(c.type==='select'){for(const value of c.options){const option=document.createElement('option');option.value=value;option.textContent=t({low:'Низкое',medium:'Среднее',high:'Высокое'}[value]);input.append(option);}}
  else{input.type=c.type==='color'?'color':'range';if(c.type==='range'){input.min=c.min;input.max=c.max;input.step=c.step;}}
  input.value=current[key];inputs.set(key,input);row.append(input);
  const output=document.createElement('output');output.htmlFor=input.id;
  const show=()=>{output.textContent=c.type==='range'?(key==='coverage'?Math.round(Number(input.value)*100)+'%':input.value):'';};show();if(c.type==='range')row.append(output);
  input.oninput=()=>{show();apply(key,c.type==='range'?Number(input.value):input.value);};details.append(row);
 }
 const reset=document.createElement('button');reset.type='button';reset.textContent=t('Сбросить облака');reset.onclick=()=>{clearTimeout(timer);current=cloudSettings(CLOUD_DEFAULTS);enabled.checked=current.enabled;for(const [key,input]of inputs){input.value=current[key];input.dispatchEvent(new Event('input'));}save();clearTimeout(timer);clouds.configure(current);};details.append(reset);
 parent.append(details);localizeDocument(details);
 return {dispose(){clearTimeout(timer);details.remove();}};
}
