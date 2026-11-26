import {PLAYTEST_BUILD} from '../playtest/schema.js';
import {t} from '../localization/i18n.js';
export function showBuildInfo(node,build=PLAYTEST_BUILD){
 if(!node)return;
 const short=build==='development'?build:build.slice(0,8)+(build.endsWith('-dirty')?' · '+t('локальные изменения'):'');
 node.textContent=t('Сборка')+': '+short;node.title=build;node.dataset.build=build;
}
