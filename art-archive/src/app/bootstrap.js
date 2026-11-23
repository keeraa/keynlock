import {prepareSavedSelection} from '../../catalog/selection-migrations.js';
import * as THREE from '../../vendor/three.js';
import {startArchiveApplication} from './application.js';
import {loadSceneCatalog} from '../../catalog/load-catalog.js';
const element=id=>document.getElementById(id);
element('start-btn').disabled=true;element('intro-plan').disabled=true;
try{
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
 startArchiveApplication({THREE,config,catalog,initialSelection});
}catch(error){console.error(error);element('error').hidden=false;element('error').textContent='Не удалось открыть архив. Требуется браузер с WebGL 2. '+error.message;element('intro').hidden=true;}
