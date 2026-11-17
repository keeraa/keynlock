import test from 'node:test';
import assert from 'node:assert/strict';
import {PARTS,PALETTE,PIN_CODES,demoMechanism,makePart,validateParts,portsFor,buildContacts,
  inspectLayout,stepMechanism,createMechanismRuntime,canPick,analyzePicking,
  checkTensionFit,keywayWrenchProfile,MECHANISM_PRESETS,mechanismPreset,identifyMechanismPreset} from '../public/js/mechanism-engine.js';
import {STANDARD_TENSION_TOOLS,checkTensionProfile} from '../public/js/mechanism-lockpicks.js';

test('every keyed entrance fits only the matching real bend, including after import',()=>{
  for(let shape=0;shape<STANDARD_TENSION_TOOLS.length;shape++){
    const parts=demoMechanism();parts[0].wrenchProfile=shape;
    assert.equal(keywayWrenchProfile(validateParts(parts)),shape);
    for(let candidate=0;candidate<STANDARD_TENSION_TOOLS.length;candidate++){
      const fits=candidate===shape;
      assert.equal(checkTensionFit(parts,candidate).fits,fits,
        `profile ${shape}, physical wrench ${candidate}`);
      assert.equal(checkTensionProfile(shape,candidate).fits,fits);
    }
    assert.equal(stepMechanism(parts,createMechanismRuntime(),{key:1,tension:true},.9).open,true,
      'a correctly cut key does not need a picking wrench');
  }
  const parts=demoMechanism();
  parts[0].wrenchProfile=91;
  assert.equal(validateParts(parts)[0].wrenchProfile,2,'bad imported profile resets safely');
});

test('an incompatible tension wrench cannot hold pin stacks or open the bolt',()=>{
  const parts=demoMechanism();
  let runtime=createMechanismRuntime();
  for(let i=0;i<PIN_CODES.length;i++)for(let n=0;n<PIN_CODES[i];n++){
    const attempt=stepMechanism(parts,runtime,{tension:true,wrenchIndex:4,
      picks:{[`secret:${i}`]:1}},.5);
    runtime=stepMechanism(parts,attempt.runtime,{tension:true,wrenchIndex:4},.2).runtime;
  }
  assert.equal(runtime.pinBanks.secret.pins.filter(pin=>pin.set).length,0);
  assert.equal(stepMechanism(parts,runtime,{tension:true,wrenchIndex:4},.9).open,false);
  runtime=createMechanismRuntime();
  for(let i=0;i<PIN_CODES.length;i++)for(let n=0;n<PIN_CODES[i];n++){
    runtime=stepMechanism(parts,runtime,{tension:true,wrenchIndex:2,
      picks:{[`secret:${i}`]:1}},.5).runtime;
    runtime=stepMechanism(parts,runtime,{tension:true,wrenchIndex:2},.2).runtime;
  }
  assert.equal(stepMechanism(parts,runtime,{tension:true,wrenchIndex:2},.9).open,true);
});

test('classic side-key lock has one real secret-to-shackle chain with no filler',()=>{
  const parts=demoMechanism();
  assert.deepEqual(parts.map(part=>part.type),['key','pinbank','cam','latch','bolt']);
  assert.equal(PALETTE.length,9,'the spring is built into the pin bank');
  assert.equal(PARTS.key.fixed,true);
  assert.equal(buildContacts(parts).length,4);
  const layout=inspectLayout(parts);
  assert.equal(layout.connected,true);
  assert.equal(layout.boltGates,1);
  assert.deepEqual(layout.issues,[]);
  assert.deepEqual(portsFor(parts[0]).outputs.map(port=>Math.round(port.y)),[305]);
  assert.equal(stepMechanism(parts,createMechanismRuntime(),{key:1,tension:true},.9).open,true);
});

test('a freely placed splitter and double interlock form a real AND gate',()=>{
  const parts=[
    makePart('key','key',120,305),
    makePart('splitter','fork',211,305),
    makePart('lever','upper',306,245),
    makePart('lever','lower',306,365),
    makePart('interlock','gate',403,305)
  ];
  assert.equal(buildContacts(parts).length,5);
  const good=stepMechanism(parts,createMechanismRuntime(),{key:1},.3);
  assert.equal(good.values.gate,1,'both branches simultaneously release the gate');
  parts.find(part=>part.id==='lower').y+=35;
  assert.equal(buildContacts(parts).length,3);
  assert.equal(stepMechanism(parts,createMechanismRuntime(),{key:1},.3).values.gate,0);
  parts.find(part=>part.id==='lower').y-=35;
  parts.find(part=>part.id==='lower').flip=true;
  assert.equal(stepMechanism(parts,createMechanismRuntime(),{key:1},.3).values.gate,0,
    'opposite motion on one arm blocks the mechanical interlock');
});

test('optional ratchet really needs three separate rising key edges',()=>{
  const parts=[makePart('key','key',120,305),makePart('pinbank','secret',278,305),
    makePart('ratchet','counter',424,305),makePart('cam','drive',499,305),
    makePart('latch','catch',583,305),makePart('bolt','bolt',678,305)];
  let state=createMechanismRuntime();
  for(let turn=1;turn<=3;turn++){
    const first=stepMechanism(parts,state,{key:1,tension:true},.9);
    const held=stepMechanism(parts,first.runtime,{key:1,tension:true},.9);
    assert.equal(held.runtime.pawls.counter.steps,turn,'holding a key cannot count as multiple clicks');
    assert.equal(first.values.catch,turn===3?1:0);
    assert.equal(first.open,turn===3);
    state=stepMechanism(parts,held.runtime,{key:0,tension:false},.9).runtime;
  }
});

test('four guided examples have touching parts and a distinct mechanical reason',()=>{
  assert.deepEqual(Object.keys(MECHANISM_PRESETS),['basic','ratchet','guarded','dual']);
  for(const [id,preset] of Object.entries(MECHANISM_PRESETS)){
    assert.ok(preset.effect.length>40&&preset.value.length>40);
    const parts=mechanismPreset(id),layout=inspectLayout(parts);
    assert.equal(layout.connected,true,`${id}: working path to bolt`);
    assert.deepEqual(layout.issues,[],`${id}: no overlapping parts or unconnected stops`);
    assert.equal(identifyMechanismPreset(parts),id);
    const first=stepMechanism(parts,createMechanismRuntime(),{key:1,tension:true},.9);
    assert.equal(first.open,id!=='ratchet',`${id}: the stated number of turns`);
    if(id==='guarded')assert.equal(analyzePicking(parts).status,'guarded',
      'cover blocks hook but not the original key');
    if(id==='dual'){
      assert.equal(layout.connections.length,8,'two individual linkages converge on the interlock');
      const broken=mechanismPreset('dual');broken.find(part=>part.id==='lower').y+=35;
      assert.equal(inspectLayout(broken).connected,false,
        'a visibly disconnected stop arm is diagnosed instead of reported as a working lock');
      assert.match(inspectLayout(broken).issues.join(' '),/два присоединённых рычага/);
      assert.equal(stepMechanism(broken,createMechanismRuntime(),{key:1,tension:true},.9).open,false,
        'a missing lower arm physically prevents the AND stop from opening');
    }
  }
  const edited=mechanismPreset('basic');edited[1].y-=20;
  assert.equal(identifyMechanismPreset(edited),null,'custom work must never be overwritten as a preset');
});

test('breaking contact or changing motion direction prevents unlocking',()=>{
  const disconnected=demoMechanism();
  disconnected.find(part=>part.id==='secret').y-=40;
  assert.equal(inspectLayout(disconnected).connected,false,
    'the secret must physically touch the drive');
  assert.match(inspectLayout(disconnected).issues[0],/Не все стопоры/);
  assert.equal(analyzePicking(disconnected).status,'invalid',
    'an unopenable lock must not be presented as a secure lock');
  let state=createMechanismRuntime();
  state=stepMechanism(disconnected,state,{key:1,tension:true},.5).runtime;
  assert.equal(stepMechanism(disconnected,state,{key:1,tension:true},.5).open,false);
  const wrongDirection=demoMechanism();
  wrongDirection.find(part=>part.id==='drive').polarity=-1;
  assert.equal(stepMechanism(wrongDirection,createMechanismRuntime(),{key:1,tension:true},.5).values.drive,0);
});

test('five independent pin lifts, not one magic tap, determine lockpicking',()=>{
  const parts=demoMechanism();
  const secret=parts.find(part=>part.id==='secret');
  const catchPart=parts.find(part=>part.id==='catch');
  assert.equal(canPick(secret,parts),true);
  assert.equal(canPick(catchPart,parts),false,'hook does not pass through the whole lock');
  const exploit=analyzePicking(parts);
  assert.equal(exploit.status,'pickable');
  assert.equal(exploit.moves,PIN_CODES.reduce((a,b)=>a+b,0));
  let state=createMechanismRuntime();
  for(let i=0;i<PIN_CODES.length;i++)for(let step=0;step<PIN_CODES[i];step++){
    const held=stepMechanism(parts,state,{picks:{[`secret:${i}`]:1},tension:true},.6);
    state=stepMechanism(parts,held.runtime,{picks:{},tension:true},.25).runtime;
  }
  assert.equal(stepMechanism(parts,state,{tension:true},.9).open,true);
  const guarded=[...parts,makePart('shield','guard',200,305)];
  assert.equal(canPick(secret,guarded),false);
  assert.equal(analyzePicking(guarded).status,'guarded');
});

test('pin overset and releasing tension both block a picking attack',()=>{
  const parts=demoMechanism();
  let runtime=createMechanismRuntime();
  for(let i=0;i<PIN_CODES[0]+1;i++){
    runtime=stepMechanism(parts,runtime,{picks:{'secret:0':1},tension:true},.4).runtime;
    runtime=stepMechanism(parts,runtime,{tension:true},.3).runtime;
  }
  assert.equal(runtime.pinBanks.secret.pins[0].set,false,'overlift crosses the shear line');
  runtime=stepMechanism(parts,runtime,{tension:false},.3).runtime;
  assert.equal(runtime.pinBanks.secret.pins[0].lift,0,'spring resets without tension');
});

test('empty bolt can be pulled directly and is diagnosed as exposed',()=>{
  const parts=demoMechanism().filter(part=>['key','bolt'].includes(part.type));
  assert.equal(inspectLayout(parts).boltGates,0);
  assert.equal(analyzePicking(parts).status,'trivial');
  assert.equal(stepMechanism(parts,createMechanismRuntime(),{tension:true},.9).open,true);
});

test('overlapping metal mechanisms jam instead of passing through each other',()=>{
  const parts=demoMechanism();
  const overlapping=parts.find(part=>part.id==='drive');
  const upper=parts.find(part=>part.id==='catch');
  overlapping.x=upper.x;overlapping.y=upper.y;
  const diagnosis=inspectLayout(parts);
  assert.equal(diagnosis.jammed,true);
  assert.ok(diagnosis.collisions.length>0);
  assert.equal(analyzePicking(parts).status,'jammed');
});

test('import validates types, positions, unique IDs and bounded parameters',()=>{
  const parts=demoMechanism();
  assert.deepEqual(validateParts(parts),parts);
  assert.throws(()=>validateParts([...parts,parts[0]]),/повторяющаяся/);
  assert.throws(()=>validateParts([{type:'motor',id:'motor'}]),/Некорректная/);
  const clipped=validateParts([makePart('gear','g',-500,900,{setting:999,rot:42})])[0];
  assert.equal(clipped.x,28);assert.equal(clipped.y,578);
  assert.equal(clipped.rot,0);assert.equal(clipped.setting,1.4);
});
