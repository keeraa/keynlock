import fs from 'node:fs';
import {sceneCatalog} from '../catalog/load-catalog.js';
import {makeLayout} from '../src/architecture/layout.js';
import {arrangeExhibition} from '../src/paintings/exhibition.js';
const root=new URL('../',import.meta.url);
const read=path=>JSON.parse(fs.readFileSync(new URL(path,root)));
const plan=read('catalog/atelier-import.json'),manifest=read('catalog/manifest.json');
const audit=read('catalog/atelier-dimensions.json'),config=read('config/scene.json');
const catalog=sceneCatalog(manifest,new URL('catalog/manifest.json',root));
const exhibition=arrangeExhibition(catalog,read('catalog/initial-selection.json'),makeLayout(config),config.paintings);
const paintings=plan.additions.map(entry=>({...entry,status:exhibition.byId.has(entry.id)?'available':exhibition.reserveReasons.get(entry.id)}));
const reasons={};for(const p of paintings)reasons[p.status]=(reasons[p.status]||0)+1;
const total=Object.keys(plan.links).length,reused=Object.values(plan.links).filter(v=>v.status==='existing').length;
const report={date:audit.checkedAt,total,reused,added:plan.additions.length,reasons,paintings};
fs.writeFileSync(new URL('docs/atelier-import/report.json',root),JSON.stringify(report,null,2)+'\n');
const labels={source_checked:'Музей / научный источник',secondary_checked:'Вторичный источник',edition_reference:'Размер музейного оттиска; экземпляр не установлен',imported_source:'Ранее импортированный размер; источник сохранён',unresolved:'Не подтверждено'};
const unresolved=paintings.filter(p=>!p.physicalSizeM);
const lines=[
 '# Размеры коллекции ателье', '',
 `Дата: ${audit.checkedAt}. Связано ${total} работ: ${reused} уже были в архиве и ${plan.additions.length} добавлены.`, '',
 `У ${paintings.length-unresolved.length} новых записей есть размеры, у ${unresolved.length} — нет подтверждённых размеров. Ранее импортированные значения не объявляются заново проверенными.`, '',
 'Все пары ниже — **высота × ширина в сантиметрах**, без игровой рамы. Для графики отдельно указан размер листа / исторического оттиска. Пиксели изображения не используются как физические размеры.', '',
 '## Не удалось подтвердить', '',
 ...unresolved.map(p=>`- **${p.id} · ${p.titleRu}**. ${audit.works[p.atelierId].note} [Источник](${audit.works[p.atelierId].source}).`), '',
 '## Замечания о репродукциях', '',
 ...paintings.filter(p=>p.imageReview).map(p=>`- **${p.id} · ${p.titleRu}**: ${p.imageReview}`), '',
 'Карточка ART-1885 исправлена: файл ателье с ID rex показывает «Сонату моря. Анданте» 1908 года, а не «Короля». ART-1875 соответствует первой базельской версии «Острова мёртвых» 1880 года. Лакшми и Муруган обозначены как исторические хромолитографии: размеры их листов не выдаются за размеры масляных оригиналов.', '',
 `## Все ${total} связанных работ`, '',
 '| ID | Работа | Высота × ширина, см | Основание | Источник |',
 '|---|---|---|---|---|',
];
const safe=s=>String(s??'').replaceAll('|',' / ').replaceAll('\n',' ');
for(const [atelierId,link]of Object.entries(plan.links)){
 const p=catalog.get(link.archiveId),a=audit.works[atelierId],s=p.physicalSizeM;
 const size=s?`${+(s.height*100).toFixed(4)} × ${+(s.width*100).toFixed(4)}`:'—';
 const basis=a?labels[a.status]:'Существующая запись архива';
 lines.push(`| ${p.id} | ${safe(p.titleRu||p.title)} | ${size} | ${basis}${s?.basis==='sheet'?' · лист':''} | [Карточка](${s?.source||a?.source||p.sourceUrl}) |`);
}
lines.push('','## Проверяемые примечания по новым записям','');
for(const p of paintings){const a=audit.works[p.atelierId];if(a.status!=='imported_source')lines.push(`- **${p.id} · ${p.titleRu}**: ${a.note||labels[a.status]}`);}
fs.writeFileSync(new URL('docs/atelier-import/dimensions.md',root),lines.join('\n')+'\n');
console.log(JSON.stringify({dimensions:audit.summary,exhibition:reasons},null,2));
