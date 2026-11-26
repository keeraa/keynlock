import {readFile,writeFile,mkdir,rm,cp} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {build} from './build.mjs';
const project=fileURLToPath(new URL('../',import.meta.url));
export async function buildHosted(output=resolve(project,'dist'),{buildId}={}){
 if(!buildId)try{buildId=execFileSync('git',['rev-parse','HEAD'],{cwd:project,encoding:'utf8'}).trim();}catch{buildId='2026-11-26-playtest-1';}
 await rm(output,{recursive:true,force:true});await mkdir(output,{recursive:true});
 await build(join(output,'client'));
 const schemaPath=join(output,'client/js/playtest/schema.js');
 let schema=await readFile(schemaPath,'utf8');schema=schema.replace(/export const PLAYTEST_BUILD=.*?;/,'export const PLAYTEST_BUILD='+JSON.stringify(buildId)+';');await writeFile(schemaPath,schema);
 const handler=(await readFile(join(project,'server/playtest.js'),'utf8')).replace(/^import .*?;\n/,'').replace('export async function handlePlaytest','async function handlePlaytest');
 const worker=(await readFile(join(project,'server/worker.js'),'utf8')).replace(/^import .*?;\n/,'');
 await mkdir(join(output,'server'),{recursive:true});
 await writeFile(join(output,'server/index.js'),schema.replaceAll('export const ','const ')+'\n'+handler+'\n'+worker);
 await writeFile(join(output,'server/wrangler.json'),JSON.stringify({name:'keynlock-art-archive',main:'index.js',compatibility_date:'2026-11-26',assets:{directory:'../client',binding:'ASSETS',run_worker_first:['/api/playtest/*']},d1_databases:[{binding:'DB',database_name:'site-creator-d1',database_id:'00000000-0000-4000-8000-000000000000'}]}));
 await mkdir(join(output,'.openai'),{recursive:true});await cp(join(project,'.openai/hosting.json'),join(output,'.openai/hosting.json'));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){await buildHosted();console.log('Built hosted archive with playtest collection');}
