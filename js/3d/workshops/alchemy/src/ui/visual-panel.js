// @ts-check
import { t } from '../i18n.js';
/** DOM adapter for the reusable alchemy look. No scene creation here. */
export function createVisualPanel({$, queryAll, visuals, woodAssets, selectWallFinish,
  selectWoodFinish, setLightDirection, setLightStrength, setSunbeam,
  setBackgroundBlur, isSunbeamVisible, isBlurred, resetCamera, onResize,
  viewportWidth = () => innerWidth}) {
  function updateAvailability() {
    $('toon-card').classList[visuals.state.drawing ? 'remove' : 'add']('muted');
    $('outline-card').classList[visuals.state.drawing ? 'remove' : 'add']('muted');
    $('paint-content').classList[visuals.state.painted ? 'remove' : 'add']('muted');
  }

  function setOpen(open) {
    $('experience').classList[open ? 'add' : 'remove']('visual-open');
    $('alchemy-visual-toggle').setAttribute('aria-expanded', String(open));
    onResize();
  }

  function bind() {
    for (const [id,key] of [
      ['draw-master','drawing'],['toon-switch','toon'],
      ['outline-switch','outline'],['paint-master','painted'],
    ]) {
      $(id).addEventListener('click',()=>{
        const next = !visuals.state[key];
        visuals.set(key,next);
        $(id).classList[next ? 'add' : 'remove']('active');
        $(id).setAttribute('aria-checked',String(next));
        updateAvailability();
      });
    }
    for (const [id,key,unit] of [
      ['toon-strength','toonStrength','%'],['toon-steps','toonSteps',` ${t('ступ.')}`],
      ['outline-saturation','outlineSaturation','%'],['outline-width','outlineWidth',' px'],
      ['brush-expression','brushExpression','%'],['cartoon-material','cartoonMaterial','%'],
    ]) {
      const slider = $(id);
      const updateFill = () => {
        const value=Number(slider.value),min=Number(slider.min),max=Number(slider.max);
        if(Number.isFinite(value)&&max>min)
          slider.style.setProperty('--fill',`${(value-min)/(max-min)*100}%`);
      };
      updateFill();
      slider.addEventListener('input',event=>{
        const value=Number(event.target.value);
        visuals.set(key,value);
        $(id+'-output').textContent=`${value}${unit}`;
        updateFill();
      });
    }
    for (const button of queryAll('.metal-choice')) {
      button.addEventListener('click',()=>{
        const {group,finish}=button.dataset;
        if(!visuals.set(group,finish))return;
        for(const other of queryAll(`.metal-choice[data-group="${group}"]`)){
          const active=other===button;
          other.classList[active?'add':'remove']('active');
          other.setAttribute('aria-pressed',String(active));
        }
      });
    }
    for(const button of queryAll('.wall-choice'))
      button.addEventListener('click',()=>selectWallFinish(button.dataset.wall));
    for(const button of queryAll('.wood-choice')){
      button.addEventListener('click',()=>selectWoodFinish(button.dataset.wood));
      const asset=woodAssets[button.dataset.wood];
      if(asset)button.querySelector('.wood-swatch').style.backgroundImage=`url("${asset}")`;
    }
    for(const button of queryAll('.light-choice'))
      button.addEventListener('click',()=>setLightDirection(button.dataset.light));
    $('key-light-strength').addEventListener('input',event=>setLightStrength(Number(event.target.value)));
    for(const side of ['left','right'])
      $(`sunbeam-${side}`).addEventListener('click',()=>setSunbeam(side,!isSunbeamVisible(side)));
    $('background-blur').addEventListener('click',()=>setBackgroundBlur(!isBlurred()));
    $('camera-reset').addEventListener('click',resetCamera);
    $('alchemy-visual-toggle').addEventListener('click',()=>setOpen(!$('experience').classList.contains('visual-open')));

    selectWallFinish('sage');selectWoodFinish('walnut');
    setLightDirection('right');setLightStrength(100);
    setSunbeam('left',false);setSunbeam('right',true);
    setBackgroundBlur(true);setOpen(viewportWidth()>1040);
    updateAvailability();
  }
  return {bind,setOpen,updateAvailability};
}
