// @ts-check
import { PIGMENT_SWATCHES, PLANETARY_METALS, RECIPE_LEVELS } from './recipes.js';

// High-resolution parchment, kept sharp as the camera moves. All layout
// coordinates use a 1024 × 626 virtual page rendered at double resolution.
export function createRecipeSheetTexture(THREE, document) {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 1252;
  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = 8;

  function paintGlyph(value, x, y, height, color) {
    ctx.save();
    ctx.font = '100px "DejaVu Sans", "Noto Sans Symbols 2", "Segoe UI Symbol", sans-serif';
    const metrics = ctx.measureText(String(value));
    const ascent = metrics.actualBoundingBoxAscent || 75;
    const descent = metrics.actualBoundingBoxDescent || 8;
    const ratio = height / (ascent + descent);
    ctx.translate(x, y);
    ctx.scale(ratio, ratio);
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(String(value), 0, (ascent - descent) / 2);
    ctx.restore();
  }

  function paintIcon(item, x, y, height) {
    const heightSmall = height * .85;
    if (item.kind === 'pigment') {
      ctx.beginPath();
      ctx.arc(x, y, heightSmall / 2, 0, Math.PI * 2);
      ctx.fillStyle = PIGMENT_SWATCHES[item.id];
      ctx.fill();
      ctx.strokeStyle = '#654b3d';
      ctx.lineWidth = 5;
      ctx.stroke();
    } else if (item.kind === 'metal') {
      paintGlyph(PLANETARY_METALS[item.id].glyph, x, y, height, '#5a4431');
    } else {
      ctx.strokeStyle = '#8e4625';
      ctx.lineWidth = 9;
      ctx.beginPath();
      ctx.moveTo(x, y - heightSmall / 2);
      ctx.lineTo(x - heightSmall / 2, y + heightSmall / 2);
      ctx.lineTo(x + heightSmall / 2, y + heightSmall / 2);
      ctx.closePath();
      ctx.stroke();
    }
  }

  function paintStage(stage, y, height) {
    const items = [...stage.ingredients.map(ingredient => ({
      kind: PLANETARY_METALS[ingredient.id] ? 'metal' : 'pigment',
      id: ingredient.id,
      count: ingredient.count
    })), { kind: 'fire', count: stage.heatSeconds }];
    const unit = height / 92;
    const group = item => {
      const digitWidth = height * (String(item.count).length > 1 ? .9 : .65);
      return { digitWidth, width: digitWidth + height * .92 + 13 * unit };
    };
    const gaps = (height * .68 + 32 * unit) * (items.length - 1);
    const width = items.reduce((sum, item) => sum + group(item).width, 0) + gaps;
    let x = (1024 - width) / 2;
    for (const [index, item] of items.entries()) {
      const { digitWidth, width: itemWidth } = group(item);
      paintGlyph(item.count, x + digitWidth / 2, y, height, '#462e1e');
      paintIcon(item, x + digitWidth + 13 * unit + height * .46, y, height);
      x += itemWidth;
      if (index !== items.length - 1) {
        paintGlyph('+', x + (height * .68 + 32 * unit) / 2, y, height * .85, '#89603a');
        x += height * .68 + 32 * unit;
      }
    }
  }

  function paint(recipe) {
    const level = recipe.level || 1;
    const stages = recipe.stages || [{
      ingredients: [{ id: recipe.pigmentId, count: recipe.pigmentCount }, { id: recipe.metalId, count: recipe.metalCount }],
      heatSeconds: recipe.heatSeconds
    }];
    ctx.save();
    ctx.scale(2, 2);
    const grain = (x, y) => (Math.sin(x * 19.5 + y * 13.7) * 10294.91) % 1;
    const paper = ctx.createLinearGradient(0, 0, 1024, 626);
    paper.addColorStop(0, '#e6cf9d');
    paper.addColorStop(.55, '#f2dfb5');
    paper.addColorStop(1, '#cdb384');
    ctx.fillStyle = paper;
    ctx.fillRect(0, 0, 1024, 626);
    for (let i = 0; i < 760; i++) {
      const x = (i * 61.761) % 1024;
      const y = (i * 97.243) % 626;
      ctx.fillStyle = grain(x, y) > 0 ? 'rgba(117,80,40,.10)' : 'rgba(255,248,211,.20)';
      ctx.fillRect(x, y, 3 + i % 7, 2 + i % 5);
    }
    ctx.strokeStyle = '#8b6a3e';
    ctx.lineWidth = 3;
    ctx.strokeRect(31, 29, 962, 568);
    ctx.lineWidth = 1;
    ctx.strokeRect(42, 40, 940, 546);
    ctx.fillStyle = '#6e4c2b';
    ctx.textAlign = 'center';
    ctx.font = '26px Georgia, serif';
    ctx.fillText(`ALCHEMIA · ${String(recipe.number).padStart(2, '0')}`, 512, 96);
    ctx.font = 'bold 58px Georgia, serif';
    ctx.fillText('РЕЦЕПТ ЗЕЛЬЯ', 512, 171);
    ctx.font = '25px Georgia, serif';
    ctx.fillText(`ЛИСТ ${level} ИЗ 3 · ${RECIPE_LEVELS[level].title.toUpperCase()}`, 512, 215);
    ctx.strokeStyle = 'rgba(103,67,36,.57)';
    ctx.beginPath();
    ctx.moveTo(140, 229);
    ctx.lineTo(884, 229);
    ctx.stroke();

    if (stages.length === 1) {
      paintStage(stages[0], 360, 92);
    } else {
      ctx.fillStyle = '#865c36';
      ctx.font = 'bold 24px Georgia, serif';
      ctx.fillText('I · СМЕШАТЬ И НАГРЕТЬ', 512, 268);
      paintStage(stages[0], 335, 72);
      ctx.strokeStyle = 'rgba(103,67,36,.33)';
      ctx.beginPath();
      ctx.moveTo(242, 400);
      ctx.lineTo(782, 400);
      ctx.stroke();
      ctx.fillStyle = '#865c36';
      ctx.fillText('II · ДОБАВИТЬ И НАГРЕТЬ', 512, 438);
      paintStage(stages[1], 502, 72);
    }
    ctx.fillStyle = '#875435';
    ctx.font = '26px Georgia, serif';
    ctx.fillText('нажми на лист · открыть книгу', 512, 569);
    ctx.restore();
    texture.needsUpdate = true;
  }

  return { texture, paint };
}
