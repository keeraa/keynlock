import {execFileSync} from 'node:child_process';
const cwd=new URL('../',import.meta.url);
export function resolveBuildId(){
 try{
  const git=args=>execFileSync('git',args,{cwd,encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();
  const sha=git(['rev-parse','HEAD']);
  const dirty=git(['status','--porcelain','--','src','config','styles','assets','catalog','vendor','scripts','server','index.html','package.json','package-lock.json','../js/3d/core/audio','../js/3d/scenes/key-archive/dist/assets/music']);
  return sha+(dirty?'-dirty':'');
 }catch{return 'development';}
}
