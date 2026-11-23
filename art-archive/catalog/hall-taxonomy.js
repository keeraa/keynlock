// Physical wing IDs remain stable for saved positions and color settings.
// Only obsolete thematic destinations are translated; current manual choices win.
const leisure = new Set(('ART-0022 ART-0063 ART-0090 ART-0095 ART-0105 ART-0284 ART-0364 ART-0381 ART-0406 ART-0410 ART-0454 ART-0466 ART-0473 ART-0476 ART-0524 ART-0541 ART-0560 ART-0577 ART-0632 ART-0638 ART-0639 ART-0809 ART-0836 ART-0849 ART-0862 ART-0893 ART-0898 ART-0913 ART-0919 ART-0943 ART-0946 ART-0986 ART-1035 ART-1042 ART-1080 ART-1081 ART-1094 ART-1112 ART-1116 ART-1134 ART-1135 ART-1183 ART-1194 ART-1195 ART-1209 ART-1240 ART-1325 ART-1412 ART-1422 ART-1451 ART-1469 ART-1470 ART-1546 ART-1551 ART-1555 ART-1559 ART-1577 ART-1591 ART-1592 ART-1593 ART-1604 ART-1623 ART-1651 ART-1654 ART-1667 ART-1670 ART-1672 ART-1677 ART-1681 ART-1749 ART-1751 ART-1755 ART-1766').split(' '));
const events = new Set(['ART-0269','ART-0551','ART-1649','ART-1716','ART-1750']);
const interiors = new Set(['ART-0322','ART-0342','ART-0347','ART-0755']);
export function migrateDestination(destination,id){
 if(destination==='jp/nature')return 'cn/nature';
 if(destination==='jp/figures')return 'cn/figures';
 if(destination==='world/still')return 'jp/still';
 if(destination==='world/buildings')return interiors.has(id)?'jp/interiors':'jp/buildings';
 if(destination==='stories/history')return 'world/history';
 if(destination==='world/life')return events.has(id)?'world/history':leisure.has(id)?'world/leisure':destination;
 return destination;
}
