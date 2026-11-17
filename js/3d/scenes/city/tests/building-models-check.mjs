import assert from 'node:assert/strict';
import * as THREE from '../vendor/three.js';
import { createBuildingModel } from '../modules/building-models.js';
import { HOUSE_DEFAULTS } from '../modules/house-builder/index.js';

const house=createBuildingModel(THREE,{type:'house',config:HOUSE_DEFAULTS},{detail:'low'});
assert.equal(house.type,'house');
assert.ok(house.group.isGroup);
assert.ok(house.update(HOUSE_DEFAULTS).polygons>0);
house.dispose();
const landmark=createBuildingModel(THREE,{type:'landmark',id:'church'},{detail:'low'});
assert.equal(landmark.type,'landmark');
assert.ok(landmark.group.isGroup);
assert.throws(()=>landmark.update(),/новую модель/);
landmark.dispose();
console.log('Building models: house and landmark have a shared create/dispose contract');
