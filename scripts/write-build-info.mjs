import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

function git(...args){
  try{
    return execFileSync('git',args,{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();
  }catch{
    return '';
  }
}

const commit=process.env.VERCEL_GIT_COMMIT_SHA || git('rev-parse','HEAD') || 'unknown';
const committedAt=git('show','-s','--format=%cI',commit) || new Date().toISOString();
const buildInfo={commit,committedAt};

writeFileSync(resolve('build-info.json'),`${JSON.stringify(buildInfo,null,2)}\n`,'utf8');
console.log(`Build info: ${commit.slice(0,7)} · ${committedAt}`);
