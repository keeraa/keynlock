import assert from 'node:assert/strict';
import {buildStreetSmokeParticles} from '../js/street/street-smoke.js';
import {houseChimneyOutlet} from '../modules/house-builder/core/house-atmosphere.js';

const config={floors:2,width:6,depth:5,chimney:true};
const chimney=houseChimneyOutlet(config);
const particles=buildStreetSmokeParticles([
  {x:10,z:5,rotation:0,config},
  {x:20,z:8,rotation:Math.PI/2,config},
  {x:30,z:0,rotation:0,config:{...config,chimney:false}},
]);
assert.equal(particles.length,6,'One batch should contain three puffs per chimney');
assert(Math.abs(particles[0].x-(10+chimney.x))<1e-8);
assert(Math.abs(particles[0].z-(5+chimney.z))<1e-8);
assert(Math.abs(particles[3].x-(20+chimney.z))<1e-8);
assert(Math.abs(particles[3].z-(8-chimney.x))<1e-8);
assert.equal(particles[0].phase,0);
console.log('Quarter smoke: rotated chimney outlets and one shared emitter list OK');
