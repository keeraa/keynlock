import { HOUSE_PALETTES, getHouseDimensions, maxFrontWindows, maxSideWindows } from '../house-config.js';
import { windowLayout } from '../house-layout.js';

const $ = id => document.getElementById(id);
const roofLabels = {gable:'Двускатная',hip:'Вальмовая',flat:'Плоская'};
const roofSubtitles = {gable:'двускатная',hip:'вальмовая',flat:'плоская'};
const colorGroups = [
  {property:'roofColor',palette:'roof',container:'roofPalette'},
  {property:'plasterColor',palette:'plaster',container:'plasterPalette'},
  {property:'woodColor',palette:'wood',container:'woodPalette'},
];
const rangeIds=['width','depth','roofHeight','frontWindows','sideWindows','damageAmount','damageScale'];
const toggleIds=['shutters','chimney','balcony','timberFrame','plasterDamage'];
export function decimal(value) {return String(value).replace('.',',');}
export function formatFloors(value) {return `${value} ${value===1?'этаж':value<5?'этажа':'этажей'}`;}
export function syncPolygonCount(metrics) {$('polygonValue').textContent=Number(metrics?.polygons??0).toLocaleString('ru-RU');}


export function createHouseEditorUI({getConfig,onChange}) {
function buildPalettes() {
  colorGroups.forEach(({property,palette,container})=>{
    const parent=$(container);
    HOUSE_PALETTES[palette].forEach(color=>{
      const button=document.createElement('button');
      button.type='button';
      button.className='palette-swatch';
      button.style.setProperty('--swatch',color);
      button.dataset.color=color;
      button.setAttribute('aria-label',`Выбрать цвет ${color}`);
      button.addEventListener('click',()=>onChange(property,color));
      parent.append(button);
    });
  });
}

function syncControls() {
  const config=getConfig();
  $('frontWindows').max=maxFrontWindows(getConfig().width,getConfig().shutters);
  $('sideWindows').max=maxSideWindows(getConfig().depth,getConfig().shutters);
  rangeIds.forEach(key=>{$(key).value=config[key];});
  toggleIds.forEach(key=>{$(key).checked=config[key];});
  colorGroups.forEach(({property,container})=>{
    $(property).value=config[property];
    $(`${property}Value`).textContent=config[property].toUpperCase();
    $(container).querySelectorAll('[data-color]').forEach(button=>{
      const selected=button.dataset.color.toLowerCase()===config[property];
      button.classList.toggle('active',selected);
      button.setAttribute('aria-pressed',String(selected));
    });
  });
  $('floorsValue').textContent=formatFloors(getConfig().floors);
  $('widthValue').textContent=`${decimal(getConfig().width)} м`;
  $('depthValue').textContent=`${decimal(getConfig().depth)} м`;
  $('roofHeightValue').textContent=`${decimal(getConfig().roofHeight)} м`;
  $('damageAmountValue').textContent=`${getConfig().damageAmount}%`;
  $('damageScaleValue').textContent=`×${decimal(getConfig().damageScale)}`;
  $('frontWindowsValue').textContent=`${getConfig().frontWindows} / ряд`;
  $('sideWindowsValue').textContent=`${getConfig().sideWindows} / этаж`;
  const flat=getConfig().roofType==='flat';
  $('roofHeight').disabled=flat;
  $('roofHeightField').classList.toggle('disabled',flat);
  $('roofHeightValue').textContent=flat?'—':`${decimal(getConfig().roofHeight)} м`;
  $('balcony').disabled=getConfig().floors===1;
  $('balconyRow').classList.toggle('is-disabled',getConfig().floors===1);
  $('damageOptions').classList.toggle('is-disabled',!getConfig().plasterDamage);
  $('damageAmount').disabled=!getConfig().plasterDamage;
  $('damageScale').disabled=!getConfig().plasterDamage;
  document.querySelectorAll('[data-roof-type]').forEach(button=>{
    const selected=button.dataset.roofType===getConfig().roofType;
    button.classList.toggle('selected',selected);
    button.setAttribute('aria-pressed',String(selected));
  });
  document.querySelectorAll('[data-floors]').forEach(button=>{
    const selected=Number(button.dataset.floors)===config.floors;
    button.classList.toggle('selected',selected);
    button.setAttribute('aria-pressed',String(selected));
  });
  document.querySelectorAll('[data-house-option]').forEach(button=>{
    const selected=button.dataset.value===config[button.dataset.houseOption];
    button.classList.toggle('selected',selected);
    button.setAttribute('aria-pressed',String(selected));
  });
  rangeIds.forEach(key=>{
    const slider=$(key);
    const percent=(+slider.value - +slider.min)/(+slider.max - +slider.min)*100;
    slider.style.backgroundSize=`${percent}% 100%`;
  });
}

function syncSummary() {
  const config=getConfig();
  const dims=getHouseDimensions(config);
  const layout=windowLayout(config);
  $('summaryFloors').textContent=String(getConfig().floors).padStart(2,'0');
  $('summaryWindows').textContent=String(layout.totalWindows).padStart(2,'0');
  $('summaryHeight').textContent=decimal(dims.totalHeight.toFixed(1));
  $('summaryArea').textContent=`${decimal((getConfig().width*getConfig().depth).toFixed(1))} м²`;
  $('summaryRoof').textContent=roofLabels[getConfig().roofType];
  $('modelSubtitle').textContent=`${roofSubtitles[getConfig().roofType][0].toUpperCase()+roofSubtitles[getConfig().roofType].slice(1)} крыша · ${formatFloors(getConfig().floors)}`;
}


  return {buildPalettes,syncControls,syncSummary,rangeIds,toggleIds,colorGroups};
}
