import {mountedFrame} from '../../catalog/painting-geometry.js';
import {tutorialWork} from '../paintings/floor-scatter.js';
import {getLanguage,paintingTitle,t} from '../localization/i18n.js';
import {STORAGE_KEYS,readText,writeText} from '../persistence/storage.js';

export function createHangingTutorial(node,archiveTask,layout,settings,debug=false){
  const key=STORAGE_KEYS.tutorial+(debug?'-debug':'');
  let completed=readText(key)==='done',active=false,work,carrying=false;
  function refresh(){
    const inTutorial=active&&!completed&&Boolean(work);
    node.hidden=!inTutorial;
    archiveTask.hidden=!active||inTutorial;
    if(!active)return;
    const en=getLanguage()==='en';
    if(inTutorial){
      const name=paintingTitle(work.painting),hall=t(layout.halls.find(h=>h.id===work.wall.hall).title);
      const message=en
        ? (carrying?'Hang “'+name+'” in a spot it fits in the '+hall+' gallery.':'Pick up “'+name+'” from the floor near you and take it to the '+hall+' gallery.')
        : (carrying?'Повесьте «'+name+'» на подходящее по размеру место в зале «'+hall+'».':'Поднимите с пола рядом с вами «'+name+'» и отнесите в зал «'+hall+'».');
      if(node.textContent!==message)node.textContent=message;
      return;
    }
    const message=en?'Hang the remaining paintings in their galleries. Masterpieces have a star on the frame and belong in the rotunda.':
      'Развесьте остальные картины по залам. Шедевры отмечены звездой на раме. Их место в ротонде.';
    if(archiveTask.textContent!==message)archiveTask.textContent=message;
  }
  function complete(){completed=true;writeText(key,'done');refresh();}
  return {
    setPage(slots,find){active=slots.length>0;work=tutorialWork(slots,settings);carrying=false;
      const placed=work&&find(work.painting.id);
      if(placed&&mountedFrame(placed)&&!completed)complete();
      else refresh();
    },
    update(id){const held=Boolean(id&&id===work?.painting.id);if(held!==carrying){carrying=held;refresh();}},
    mounted(slot){if(!completed&&slot.painting.id===work?.painting.id)complete();},
    refresh,
  };
}
