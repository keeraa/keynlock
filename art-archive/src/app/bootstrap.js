import {prepareSavedSelection} from '../../catalog/selection-migrations.js';
import * as THREE from '../../vendor/three.js';
import {startArchiveApplication} from './application.js';
import {loadSceneCatalog} from '../../catalog/load-catalog.js';
import {getLanguage} from '../localization/i18n.js';
const element=id=>document.getElementById(id);
const progress=value=>{element('load-progress').value=value;};

const english=getLanguage()==='en';
if(english)element('load-title').textContent='Loading the archive';
try{
 progress(3);
 const response=await fetch(new URL('../../config/scene.json',import.meta.url));
 if(!response.ok)throw Error('Не найдена конфигурация здания');
 const [config,catalog,initialSelection] = await Promise.all([
   response.json(),
   loadSceneCatalog(new URL('../../catalog/manifest.json',import.meta.url)),
   fetch(new URL('../../catalog/initial-selection.json',import.meta.url)).then(r=>{
     if(!r.ok)throw Error('Не найдена исходная подборка');
     return r.json();
   })
 ]);
 prepareSavedSelection(initialSelection);
 progress(12);
 await startArchiveApplication({THREE,config,catalog,initialSelection,onProgress:progress});
 progress(100);
 element('archive-content').hidden=false;element('archive-content').inert=false;
 element('load-screen').hidden=true;
}catch(error){
 console.error(error);
 element('load-screen').hidden=true;
 element('error').hidden=false;
 element('error').textContent=(english?'Could not open the archive. ':'Не удалось открыть архив. ')+error.message;
}
