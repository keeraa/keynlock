import {cutTolerance} from './logic.js';

// Every inspection must produce actionable feedback, even when the error is
// smaller than the general tolerance but exceeds a shallow tooth's limit.
export function describeKeyInspection(result,targets,method='guided'){
  const source=method==='soap'?'слепку':method==='imprint'?'схеме':'чертежу';
  const prefix=`Проверка по ${source}: `;
  if(result.brokenAt>=0){
    return {ok:false,tooth:result.brokenAt,
      message:`${prefix}зубец ${result.brokenAt+1} пропилен насквозь. Нужна новая заготовка.`};
  }
  if(result.extraOvercut){
    return {ok:false,tooth:-1,
      message:`${prefix}металл снят за пределами профиля ключа. Нужна новая заготовка.`};
  }
  if(result.accurate){
    return {ok:true,tooth:-1,
      message:`${prefix}ключ подходит! Все ${targets.length} пазов соответствуют образцу (точность ${result.score}%).`};
  }
  const mismatches=result.errors.map((error,i)=>({
    i,error,limit:cutTolerance(targets[i])
  })).filter(item=>Math.abs(item.error)>item.limit);
  const overcut=mismatches.filter(item=>item.error>0);
  if(overcut.length){
    const worst=overcut.reduce((a,b)=>b.error/b.limit>a.error/a.limit?b:a);
    return {ok:false,tooth:worst.i,
      message:`${prefix}зубец ${worst.i+1} пропилен слишком глубоко. Нужна новая заготовка.`};
  }
  if(mismatches.length){
    const worst=mismatches.reduce((a,b)=>Math.abs(b.error)/b.limit>Math.abs(a.error)/a.limit?b:a);
    return {ok:false,tooth:worst.i,
      message:`${prefix}зубец ${worst.i+1} ещё недостаточно глубокий. Допилите его и проверьте снова.`};
  }
  return {ok:false,tooth:-1,
    message:`${prefix}профиль пока не совпал с образцом. Проверьте положение и глубину пазов.`};
}
