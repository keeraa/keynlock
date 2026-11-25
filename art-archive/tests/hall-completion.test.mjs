import test from 'node:test';
import assert from 'node:assert/strict';
import {createHallCompletion} from '../src/paintings/hall-completion.js';

const work=(id,hall,collection='museum')=>({painting:{id,collection},destination:hall+'/theme',wall:{hall}});

test('the last mounted work starts the gallery pulse and only the arch stays lit',()=>{
 const arches=new Map(),frames=new Map();
 const completion=createHallCompletion([{id:'east'},{id:'portrait'}],(id,value)=>arches.set(id,value),(id,value)=>frames.set(id,value));
 const a=work('a','east'),b=work('b','east'),c=work('c','portrait'),approved=work('approved','east','keynlock');
 const page=[a,b,c,approved];
 completion.sync(page,[a,c],{reset:true});
 assert.equal(arches.get('east'),0);
 assert(arches.get('portrait')>0);
 assert(completion.sync(page,[a,b,c],{celebrate:'east',now:100}));
 completion.update(1300);
 assert.equal(frames.get(1),1);
 assert.equal(frames.get(2),0);
 assert(arches.get('east')>arches.get('portrait'));
 completion.update(2600);
 assert(Math.abs(frames.get(1))<1e-6);
 assert.equal(arches.get('east'),arches.get('portrait'));
 completion.sync(page,[a,c]);
 assert.equal(arches.get('east'),0);
 completion.sync(page,[a,b,c],{reset:true});
 assert(arches.get('east')>0);
 assert.equal(frames.get(1),0);
});
