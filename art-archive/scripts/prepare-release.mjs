import {mkdtemp,readFile,rm,cp,mkdir,stat} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {resolve,join,dirname,sep} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath,pathToFileURL} from 'node:url';
const project=fileURLToPath(new URL('../',import.meta.url)),repository=resolve(project,'..');
export async function prepareRelease({commit='HEAD',output}={}){
 const git=args=>execFileSync('git',args,{cwd:repository,encoding:'utf8'}).trim();
 const sha=git(['rev-parse','--verify','--end-of-options',commit+'^{commit}']);
 if(!/^[0-9a-f]{40}$/.test(sha))throw Error('Invalid source commit');
 output=resolve(output??join(project,'.releases',sha));
 if(output===repository||output.startsWith(repository+sep)&&!output.startsWith(join(project,'.releases')+sep))throw Error('Use .releases/<name> or an output outside the source repository');
 const inputs=JSON.parse(git(['show',sha+':art-archive/config/release.json']));
 try{
  await stat(output);
  const previous=JSON.parse(await readFile(join(output,'release.json'),'utf8'));
  if(previous.game!=='art-archive')throw Error('Output is not an archive release');
 }catch(error){if(error.code!=='ENOENT')throw error;if(await stat(output).catch(()=>null))throw Error('Output directory already exists and is not a generated release');}
 const work=await mkdtemp(join(tmpdir(),'art-release-'));
 try{
  const archive=join(work,'source.tar');
  execFileSync('git',['archive','--format=tar','--output='+archive,sha,...inputs.sourcePaths],{cwd:repository});
  execFileSync('tar',['-xf',archive,'-C',work]);
  const {buildRelease,verifyRelease}=await import(pathToFileURL(join(work,'art-archive/scripts/release-build.mjs')).href);
  const stage=join(work,'release');await buildRelease(stage,{buildId:sha});const verification=await verifyRelease(stage);
  await mkdir(dirname(output),{recursive:true});await rm(output,{recursive:true,force:true});await cp(stage,output,{recursive:true});await verifyRelease(output);
  const bundle=output+'.tar.gz';execFileSync('tar',['-czf',bundle,'-C',output,'.']);
  return {...verification,output,archive:bundle};
 }finally{await rm(work,{recursive:true,force:true});}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2),options={};
 for(let i=0;i<args.length;i+=2){if(!['--commit','--output'].includes(args[i])||!args[i+1])throw Error('Usage: npm run release -- [--commit SHA] [--output DIR]');options[args[i].slice(2)]=args[i+1];}
 console.log(JSON.stringify(await prepareRelease(options)));
}
