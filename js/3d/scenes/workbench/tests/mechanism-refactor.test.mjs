import test from 'node:test';
import assert from 'node:assert/strict';
import {demoMechanism,createMechanismRuntime} from '../public/js/mechanism-engine.js';
import {escapeMechanismHtml,mechanismInspectorMarkup} from '../public/js/mechanism-inspector.js';
import {STAGE_MS,transmissionStages,stagedView} from '../public/js/mechanism-playback.js';

test('inspector remains interactive after markup extraction',()=>{
  const parts=demoMechanism(),runtime=createMechanismRuntime();
  const key=parts.find(part=>part.type==='key');
  const markup=mechanismInspectorMarkup({parts,selected:key.id,mode:'build',runtime,
    view:null,effects:{key:'Ключ'}});
  assert.match(markup,/id="mechKeywayProfile"/);
  assert.match(markup,/id="mechRotate"/);
  assert.match(markup,/id="mechRemove"/);
  const attack=mechanismInspectorMarkup({parts,selected:null,mode:'attack',runtime,
    view:null,effects:{}});
  assert.match(attack,/Как открыть этот замок/);
  assert.match(attack,/data-mech-pin-count="true">0 \/ 5/);
  assert.equal(escapeMechanismHtml('<&"\''),'&lt;&amp;&quot;&#39;');
});

test('playback stages reach connected parts only and preserve a delayed bolt',()=>{
  const parts=[{id:'key',type:'key'},{id:'gear',type:'gear'},
    {id:'bolt',type:'bolt'},{id:'detached',type:'lever'}];
  const full={links:[{from:'key',to:'gear'},{from:'gear',to:'bolt'}],
    values:{key:1,gear:1,bolt:1,detached:1},inputs:{key:1,gear:1,bolt:1,detached:1},
    boltTravel:1};
  const stages=transmissionStages(parts,full);
  assert.deepEqual(stages.map(stage=>stage.ids),[['key'],['gear'],['bolt']]);
  const midway=stagedView(full,stages,STAGE_MS*.5,parts);
  assert.ok(midway.values.key>0&&midway.values.key<1);
  assert.equal(midway.values.gear,0);
  assert.equal(midway.values.detached,0);
  assert.equal(midway.boltTravel,0);
  assert.equal(stagedView(full,stages,STAGE_MS*3,parts).boltTravel,1);
});
