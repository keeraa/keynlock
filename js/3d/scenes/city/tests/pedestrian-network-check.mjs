import assert from 'node:assert/strict';
import {buildPedestrianNetwork} from '../js/navigation/pedestrian-network.js';

const network=buildPedestrianNetwork({
  roads:[
    {id:'horizontal',p:[[0,0],[10,0]]},
    {id:'vertical',p:[[5,-5],[5,5]]},
    {id:'shared',p:[[5,0],[10,0]]},
  ],
  paths:[
    {id:'doorway',kind:'house',p:[[1,-3],[1,0]]},
    {id:'gallery',kind:'landmark',p:[[9,3],[9,0]]},
  ],
  anchors:[
    {id:'house',x:1,z:-3},
    {id:'gallery',x:9,z:3},
    {id:'junction',x:5,z:0},
  ],
});
assert.ok(network.nodes.some(node=>node.x===5&&node.z===0&&node.edges.length>=4),
  'Crossing streets must create a shared intersection node');
assert.ok(network.nodes.some(node=>node.x===1&&node.z===0&&node.edges.length===3),
  'A house path must meet the street at a T-junction');
assert.ok(network.edges.every(edge=>edge.length>0),'Overlapping street segments cannot add zero-length edges');
assert.ok(Math.abs(network.findRoute('house','gallery').reduce((total,point,index,points)=>
  total+(index?Math.hypot(point[0]-points[index-1][0],point[1]-points[index-1][1]):0),0)-14)<1e-6,
  'Routes must follow the shortest connected street and pedestrian edges');
assert.equal(network.findRoute('house','unknown'),null,'Unknown destinations are unreachable');

const isolated=buildPedestrianNetwork({roads:[{p:[[0,0],[1,0]]},{p:[[20,0],[21,0]]}],
  anchors:[{id:'first',x:0,z:0},{id:'second',x:20,z:0}]});
assert.equal(isolated.findRoute('first','second'),null,'Disconnected streets must stay disconnected');
