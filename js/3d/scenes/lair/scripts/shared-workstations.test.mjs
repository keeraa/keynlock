import test from 'node:test';
import assert from 'node:assert/strict';
import { REAGENTS, emptyMixture, addDose } from '../../../workshops/alchemy/src/mixing.js';
import { generateRecipe, evaluateRecipe } from '../../../workshops/alchemy/src/recipes.js';
import { assistedFilingStroke, cutLayout, generateBlueprint,
  inspectKey, keyTopOutline, targetGuideSegments } from '../public/stations/workbench/js/logic.js';

test('all three original alchemy difficulties can achieve perfect scores on the shared table',()=>{
  for(const level of [1,2,3]){
    const recipe=generateRecipe(REAGENTS,()=>.27,37+level,level);
    const mixture=emptyMixture(), timeline=[];
    for(const stage of recipe.stages){
      for(const ingredient of stage.ingredients){
        const reagent=REAGENTS.find(entry=>entry.id===ingredient.id);
        const added=addDose(mixture,reagent,reagent.dose*ingredient.count);
        assert.equal(added,reagent.dose*ingredient.count);
        timeline.push({kind:'add',id:reagent.id,amount:added});
      }
      timeline.push({kind:'heat',seconds:stage.heatSeconds});
    }
    const result=evaluateRecipe(recipe,mixture,recipe.heatSeconds,REAGENTS,timeline);
    assert.equal(result.score,100,`level ${level} retains the original recipe evaluation`);
  }
});

test('workbench geometry and key inspection reuse the exact source cutting rules',()=>{
  for(const count of [4,6,8]){
    const blueprint=generateBlueprint(count,'',()=>.36);
    const cuts=Array(count).fill(0);
    const layout=cutLayout(count);
    assert.equal(layout.length,count);
    for(let i=0;i<cuts.length;i++){
      cuts[i]=assistedFilingStroke(0,blueprint.targets[i]*1800,blueprint.targets[i]);
      if(cuts[i]!==blueprint.targets[i])cuts[i]=blueprint.targets[i];
    }
    assert.equal(inspectKey(cuts,blueprint.targets).accurate,true);
    assert.ok(keyTopOutline(cuts,layout).length>count*2);
    assert.ok(Array.isArray(targetGuideSegments(cuts,blueprint.targets,layout)));
  }
});
