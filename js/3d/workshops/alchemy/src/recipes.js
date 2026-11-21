// @ts-check
// Three increasingly demanding alchemical recipes. Their doses fit the right
// receiver's 160 ml capacity and the quantities in the source vessels.
export const PIGMENT_SWATCHES = Object.freeze({
  red: '#d94d4c', blue: '#477db8', yellow: '#efd06a', white: '#eee8d8'
});

// Traditional planetary signs, used on the parchment and in the recipe book.
export const PLANETARY_METALS = Object.freeze({
  aurum: Object.freeze({ glyph: '☉', planet: 'Солнце', atomicNumber: 79 }),
  argentum: Object.freeze({ glyph: '☽', planet: 'Луна', atomicNumber: 47 }),
  cuprum: Object.freeze({ glyph: '♀', planet: 'Венера', atomicNumber: 29 }),
  ferrum: Object.freeze({ glyph: '♂', planet: 'Марс', atomicNumber: 26 }),
  stannum: Object.freeze({ glyph: '♃', planet: 'Юпитер', atomicNumber: 50 }),
  hydrargyrum: Object.freeze({ glyph: '☿', planet: 'Меркурий', atomicNumber: 80 }),
  plumbum: Object.freeze({ glyph: '♄', planet: 'Сатурн', atomicNumber: 82 })
});
export const METAL_REFERENCE_ORDER = Object.freeze([
  'aurum', 'argentum', 'cuprum', 'ferrum', 'stannum', 'hydrargyrum', 'plumbum'
]);
export const RECIPE_LEVELS = Object.freeze({
  1: Object.freeze({ title: 'Начальный', caption: 'Один цвет · один металл · один нагрев' }),
  2: Object.freeze({ title: 'Смешение', caption: 'Два цвета · один металл · один нагрев' }),
  3: Object.freeze({ title: 'Мастерство', caption: 'Два этапа · два металла · промежуточный нагрев' })
});

const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));
const pick = (items, random) => items[Math.min(items.length - 1, Math.floor(clamp(random(), 0, .99999999) * items.length))];
const accuracy = (got, needed) => clamp(1 - Math.abs(got - needed) / needed, 0, 1);

function unique(items, count, random) {
  const available = [...items];
  const result = [];
  while (result.length < count) result.push(...available.splice(available.indexOf(pick(available, random)), 1));
  return result;
}

function stage(ingredients, heatSeconds) {
  return Object.freeze({
    ingredients: Object.freeze(ingredients.map(([reagent, count]) => Object.freeze({ id: reagent.id, count }))),
    heatSeconds
  });
}

export function generateRecipe(reagents, random = Math.random, number = 1, level = 1) {
  if (!RECIPE_LEVELS[level]) throw new RangeError('Unknown alchemy recipe level');
  const pigments = reagents.filter(reagent => reagent.kind === 'tube');
  const metals = reagents.filter(reagent => reagent.kind === 'bottle');
  if (pigments.length < (level === 1 ? 1 : 2) || metals.length < (level === 3 ? 2 : 1)) {
    throw new Error('Not enough pigments and metals for a recipe');
  }

  let stages;
  if (level === 1) {
    stages = [stage([
      [pick(pigments, random), pick([1, 2, 3], random)],
      [pick(metals, random), pick([1, 2, 3], random)]
    ], pick([5, 10, 15, 20], random))];
  } else if (level === 2) {
    const colors = unique(pigments, 2, random);
    stages = [stage([
      [colors[0], pick([1, 2], random)],
      [colors[1], pick([1, 2], random)],
      [pick(metals, random), pick([1, 2], random)]
    ], pick([8, 12, 15, 20], random))];
  } else {
    const colors = unique(pigments, 2, random);
    const selectedMetals = unique(metals, 2, random);
    const chosen = [colors[0], selectedMetals[0], colors[1], selectedMetals[1]];
    const counts = chosen.map(() => pick([1, 2], random));
    const totalVolume = () => counts.reduce((sum, count, index) => sum + count * chosen[index].dose, 0);
    while (totalVolume() > 160) {
      const reducible = counts.map((count, index) => count > 1 ? index : -1).filter(index => index >= 0);
      counts[pick(reducible, random)]--;
    }
    stages = [
      stage([[colors[0], counts[0]], [selectedMetals[0], counts[1]]], pick([5, 8, 10], random)),
      stage([[colors[1], counts[2]], [selectedMetals[1], counts[3]]], pick([6, 10, 12, 15], random))
    ];
  }

  for (const ingredient of stages.flatMap(entry => entry.ingredients)) {
    const source = reagents.find(reagent => reagent.id === ingredient.id);
    if (ingredient.count * source.dose > source.amount) throw new Error('Recipe exceeds source capacity');
  }
  const volume = stages.reduce((sum, entry) => sum + entry.ingredients.reduce((part, ingredient) => {
    return part + reagents.find(reagent => reagent.id === ingredient.id).dose * ingredient.count;
  }, 0), 0);
  if (volume > 160) throw new Error('Recipe exceeds right receiver capacity');

  const first = stages[0];
  const mainPigment = first.ingredients.find(item => pigments.some(source => source.id === item.id));
  const mainMetal = first.ingredients.find(item => metals.some(source => source.id === item.id));
  return Object.freeze({
    number, level, stages: Object.freeze(stages), volume,
    // Legacy aliases are useful to scene consumers; the stages are canonical.
    pigmentId: mainPigment.id, pigmentCount: mainPigment.count,
    metalId: mainMetal.id, metalCount: mainMetal.count,
    heatSeconds: stages.reduce((sum, entry) => sum + entry.heatSeconds, 0)
  });
}

// One observed stage contains additions followed by one or more heating
// intervals. Adding a new reagent after heat starts the next stage.
export function observeRecipeStages(timeline, reagents) {
  const sourceById = new Map(reagents.map(reagent => [reagent.id, reagent]));
  const stages = [{ doses: {}, heatSeconds: 0 }];
  for (const event of timeline) {
    if (event.kind === 'heat' && Number.isFinite(event.seconds) && event.seconds > 0) {
      stages.at(-1).heatSeconds += event.seconds;
    } else if (event.kind === 'add' && event.amount > 0 && sourceById.has(event.id)) {
      if (stages.at(-1).heatSeconds > 0) stages.push({ doses: {}, heatSeconds: 0 });
      const observed = stages.at(-1).doses;
      observed[event.id] = (observed[event.id] || 0) + event.amount / sourceById.get(event.id).dose;
    }
  }
  return stages;
}

export function evaluateRecipe(recipe, mixture, heatSeconds, reagents, timeline = null) {
  const reference = new Map(reagents.map(reagent => [reagent.id, reagent]));
  const overallDoses = Object.fromEntries(reagents.map(reagent => [reagent.id, 0]));
  for (const addition of mixture.additions) {
    if (reference.has(addition.id)) overallDoses[addition.id] += addition.amount / reference.get(addition.id).dose;
  }

  const stageRecipes = recipe.stages || [{
    ingredients: [{ id: recipe.pigmentId, count: recipe.pigmentCount }, { id: recipe.metalId, count: recipe.metalCount }],
    heatSeconds: recipe.heatSeconds
  }];
  const chronological = recipe.level === 3 && Array.isArray(timeline);
  const observed = chronological ? observeRecipeStages(timeline, reagents)
    : [{ doses: overallDoses, heatSeconds: Math.max(0, heatSeconds) }];
  const expectedIds = new Set(stageRecipes.flatMap(entry => entry.ingredients.map(ingredient => ingredient.id)));
  const stageDetails = stageRecipes.map((expected, index) => {
    const actual = observed[index] || { doses: {}, heatSeconds: 0 };
    const ingredients = expected.ingredients.map(ingredient => ({
      id: ingredient.id, expected: ingredient.count, actual: actual.doses[ingredient.id] || 0,
      accuracy: accuracy(actual.doses[ingredient.id] || 0, ingredient.count)
    }));
    const localIds = new Set(expected.ingredients.map(item => item.id));
    const extras = Object.entries(actual.doses).reduce((sum, [id, count]) => sum + (localIds.has(id) ? 0 : count), 0);
    return {
      ingredients, extras, expectedHeatSeconds: expected.heatSeconds,
      heatSeconds: actual.heatSeconds,
      heatAccuracy: accuracy(actual.heatSeconds, expected.heatSeconds)
    };
  });
  const extraStages = observed.slice(stageRecipes.length);
  const stagedExtras = stageDetails.reduce((sum, entry) => sum + entry.extras, 0)
    + extraStages.reduce((sum, entry) => sum + Object.values(entry.doses).reduce((a, b) => a + b, 0) + entry.heatSeconds / 10, 0);
  const extras = chronological ? stagedExtras : Object.entries(overallDoses).reduce((sum, [id, count]) => sum + (expectedIds.has(id) ? 0 : count), 0);
  const ingredientAccuracies = stageDetails.flatMap(entry => entry.ingredients.map(item => item.accuracy));
  const ingredientAccuracy = ingredientAccuracies.reduce((sum, value) => sum + value, 0) / ingredientAccuracies.length;
  const heatAccuracy = stageDetails.reduce((sum, entry) => sum + entry.heatAccuracy, 0) / stageDetails.length;
  const purity = clamp(1 - extras * .28, 0, 1);
  const score = Math.round(100 * (ingredientAccuracy * .74 + heatAccuracy * .26) * purity);
  const grade = score >= 98 ? 'Идеальное зелье' : score >= 80 ? 'Отличное зелье'
    : score >= 60 ? 'Хорошая варка' : score >= 35 ? 'Нестабильное зелье' : 'Неудачная варка';
  return {
    score, grade, extras, heatSeconds, ingredientAccuracy, heatAccuracy, purity, stageDetails,
    pigment: overallDoses[recipe.pigmentId], metal: overallDoses[recipe.metalId],
    pigmentAccuracy: accuracy(overallDoses[recipe.pigmentId], recipe.pigmentCount),
    metalAccuracy: accuracy(overallDoses[recipe.metalId], recipe.metalCount)
  };
}
