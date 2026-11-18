import test from 'node:test';
import assert from 'node:assert/strict';
import {dustCleaningStrength,createDustCleaningBrush}
  from '../public/js/lab/effects/dust-cleaning.js';

test('dust removal increases strongly with real cloth movement speed',()=>{
  assert.ok(dustCleaningStrength(3.5)>dustCleaningStrength(0)*10);
  assert.equal(dustCleaningStrength(-30),dustCleaningStrength(0));
  assert.equal(dustCleaningStrength(300),dustCleaningStrength(3.5));
});

test('dust brush stamps broken polygons with independent irregular borders',()=>{
  const traced=[];
  let alpha;
  const context={
    save(){},restore(){},beginPath(){},closePath(){},fill(){},
    moveTo(x,y){traced.push(['move',x,y]);},
    lineTo(x,y){traced.push(['line',x,y]);},
    createRadialGradient(){const stops=[];return {
      stops,addColorStop(offset,color){stops.push([offset,color]);
        if(offset===0)alpha=Number(color.match(/,([\d.]+)\)$/)?.[1]);}
    };}
  };
  let seed=123;
  const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/2**32);
  let revisions=0;
  const brush=createDustCleaningBrush({context,random,onChange:()=>{revisions++;}});
  brush.stamp(230,190,0);
  const slowAlpha=alpha;
  brush.stamp(250,200,3.5);
  assert.ok(alpha>slowAlpha*5);
  assert.equal(revisions,2);
  assert.equal(traced.filter(point=>point[0]==='move').length,4);
  const firstPatch=traced.slice(0,27).map(([,x,y])=>Math.hypot(x-230,y-190));
  assert.ok(Math.max(...firstPatch)-Math.min(...firstPatch)>8,
    'irregular perimeter must not be a smooth circle');
});
