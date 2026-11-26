import {migrateExhibitionDestination} from './hall-taxonomy.js';
// The curator and gallery use the same browser selection. Migrate the old
// shipped override once so subsequent manual assignments remain authoritative.
export function migrateSelection(storage, seed) {
  const key = 'keynlock-painting-archive-1500-v1';
  const previous = JSON.parse(storage.getItem(key));
  // A saved floor pose in Nature belonged to the old arrangement. Keep the
  // pose and its origin so the hanging session can stage the work in its new hall.
  const place = previous?.placements?.['ART-1539'];
  const oldWater = place === 'nature/water' && (previous.selectionRevision ?? 0) < 1;
  if (!place || oldWater || place === seed.placements['ART-1539']) {
    const hangingKey = 'keynlock-art-hanging-v1';
    const hanging = JSON.parse(storage.getItem(hangingKey));
    const floor = hanging?.['ART-1539'];
    if (floor?.kind === 'floor' && floor.floorRoom === 'nature' && !floor.destination) {
      floor.destination = 'nature/water';
      storage.setItem(hangingKey, JSON.stringify(hanging));
    }
  }
  const revision=previous?.selectionRevision??0;
  if(revision>=seed.selectionRevision)return;
  if(previous){
    if(seed.curatedExclusions?.length)previous.included={...previous.included,...Object.fromEntries(seed.curatedExclusions.map(id=>[id,false]))};
    previous.placements??={};
    if(oldWater && seed.placements['ART-1539'])previous.placements['ART-1539']=seed.placements['ART-1539'];
    for(const [id,destination] of Object.entries(previous.placements))
      previous.placements[id]=migrateExhibitionDestination(destination,id,revision,seed.selectionRevision);
  }
  for(const hangingKey of ['keynlock-art-hanging-v1','keynlock-art-hanging-v1-debug']){
    const hanging=JSON.parse(storage.getItem(hangingKey));
    if(!hanging)continue;
    let changed=false;
    for(const [id,pose] of Object.entries(hanging)){
      if(!pose.destination)continue;
      const destination=migrateExhibitionDestination(pose.destination,id,revision,seed.selectionRevision);
      if(pose.destination!==destination){pose.destination=destination;changed=true;}
    }
    if(changed)storage.setItem(hangingKey,JSON.stringify(hanging));
  }
  if(previous){
    previous.selectionRevision=seed.selectionRevision;
    storage.setItem(key,JSON.stringify(previous));
  }
}

export function prepareSavedSelection(seed) {
  seed.included={...seed.included,...Object.fromEntries((seed.curatedExclusions??[]).map(id=>[id,false]))};
  try { migrateSelection(localStorage, seed); }
  catch { /* Browsers with unavailable storage use the bundled selection. */ }
}
