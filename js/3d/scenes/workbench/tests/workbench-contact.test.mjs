import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorkbenchContact,createTrayContact,TABLE_Z} from '../public/js/lab/physics/workbench-contact.js';

test('tool contacts respect a raised bezel, a screw head and the removed cover',()=>{
  const screw={position:{x:1.57,y:1.09},userData:{removed:false}};
  let attached=true;
  const contact=createWorkbenchContact({screws:[screw],isCoverAttached:()=>attached});
  assert.equal(contact.surfaceAt(1.57,1.09),.90);
  assert.equal(contact.surfaceAt(1.70,0),.82);
  assert.equal(contact.surfaceAt(0,0),.77);
  assert.equal(contact.surfaceAt(3,0),TABLE_Z+.11);
  assert.ok(contact.driverClearance(.55,1.09)>=1.07);
  screw.userData.removed=true;
  attached=false;
  assert.equal(contact.surfaceAt(0,0),.73);
  assert.equal(contact.surfaceAt(1.57,1.09),.73);
});

test('tray physics stays inside its empty cavity',()=>{
  const tray=createTrayContact({x:-3.04,y:1.50,width:1.07,height:.76,wall:.08});
  assert.ok(tray.contains(-3.04,1.50));
  assert.ok(!tray.contains(-2,1.50));
  const p=tray.clamp({x:-9,y:9});
  assert.ok(tray.contains(p.x+.00001,p.y-.00001));
  assert.equal(tray.bounds.w,1.07-.16);
});
