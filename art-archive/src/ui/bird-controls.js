import {getLanguage} from '../localization/i18n.js';
import {readText,writeText} from '../persistence/storage.js';
export function bindBirdControls(birds){
  const en=getLanguage()==='en',key='keynlock-art-birds-v1';
  const details=document.createElement('details'),summary=document.createElement('summary');
  summary.textContent=en?'Birds above the dome':'Птицы над куполом';details.append(summary);
  const select=document.createElement('select');select.id='bird-model';
  for(const [value,ru,english] of [['both','Обе модели · по 3 птицы','Both models · 3 each'],['crow','Серая ворона · tevy','Hooded crow · tevy'],['afk','Птица · afk.ai','Bird · afk.ai'],['off','Выключены','Off']]){
    const option=document.createElement('option');option.value=value;option.textContent=en?english:ru;select.append(option);
  }
  const label=document.createElement('label');label.htmlFor=select.id;label.textContent=en?'Model comparison':'Сравнение моделей';
  const status=document.createElement('output');
  details.append(label,select,status);document.getElementById('cloud-controls').append(details);
  const saved=readText(key,'both');select.value=['crow','afk','both','off'].includes(saved)?saved:'both';
  async function apply(){
    const value=select.value;writeText(key,value);status.textContent=en?'Loading…':'Загрузка…';
    try{await birds.configure(value);if(select.value===value)status.textContent='';}
    catch(error){status.textContent=en?'Bird model could not be loaded':'Не удалось загрузить птиц';console.error(error);}
  }
  select.onchange=apply;void apply();
  return {dispose(){details.remove();}};
}
