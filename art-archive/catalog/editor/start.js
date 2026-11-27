import {migrateDestination} from '../hall-taxonomy.js';
import {prepareSavedSelection} from '../selection-migrations.js';
import {loadSceneCatalog} from '../load-catalog.js';

async function json(path) {
  const response = await fetch(new URL(path,import.meta.url));
  if (!response.ok) throw Error('Не удалось загрузить '+path);
  return response.json();
}
function loadScript(name) {
  return new Promise((resolve,reject)=>{
    const script = document.createElement('script');
    script.src = new URL(name+'.js',import.meta.url);
    script.onload = resolve;
    script.onerror = ()=>reject(Error('Не удалось открыть редактор'));
    document.body.append(script);
  });
}
try {
  const [catalog, config, seed] = await Promise.all([
    loadSceneCatalog(new URL('../manifest.json',import.meta.url)), json('../../config/scene.json'), json('../initial-selection.json')
  ]);
  prepareSavedSelection(seed);
  document.title=`Кейнлок · Архив картин · ${catalog.paintings.length}`;
  window.initialSelection = seed;
  window.migrateDestination = migrateDestination;
  const special = id => {
    const hall=catalog.halls.find(h=>h.id===id);
    return {...hall,walls:hall.walls.map(w=>[w.id,w.title])};
  };
  window.GAME_HALLS = [special('center'),...config.halls.map(h=>({...h,walls:h.walls||[]})),special('reserve')];
  window.editorCatalog = catalog.paintings.map(p=>({...p,
    sizeMatch:p.image.sizeMatch,gamePlacement:p.placement,image:catalog.imageUrl(p.id),detail:catalog.detailUrl(p.id),hd:p.image.detail?.originalUrl || p.image.hdUrl || catalog.detailUrl(p.id) || catalog.imageUrl(p.id),page:p.sourceUrl,
    subjectMethod:p.subjectMethod,license:p.rights.license,licenseSource:p.rights.licenseUrl,
    dateSource:p.dateSource,rights:p.rights.status
  }));
  for(const name of ['options','core','icons','filters','cards','preview','import-export','events']) await loadScript(name);
} catch(error) {
  document.getElementById('result').textContent=error.message;
}
