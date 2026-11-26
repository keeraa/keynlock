import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {summarizePlaytests,renderPlaytestSummary} from './analysis/playtest-summary.mjs';
export {summarizePlaytests,renderPlaytestSummary};
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const files=[];let output=null,includeQA=false;
 const args=process.argv.slice(2);
 for(let i=0;i<args.length;i++){if(args[i]==='--output'){output=args[++i];if(!output)throw Error('Missing --output path');}else if(args[i]==='--include-qa')includeQA=true;else if(args[i].startsWith('--'))throw Error('Unknown option: '+args[i]);else files.push(args[i]);}
 if(!files.length)throw Error('Usage: npm run report:playtest -- report.json [events.json feedback.json ...] [--output reports/summary.md] [--include-qa]');
 const documents=await Promise.all(files.map(async file=>JSON.parse(await readFile(file,'utf8'))));
 const report=summarizePlaytests(documents,{includeQA}),markdown=renderPlaytestSummary(report);
 if(output){output=resolve(output);if(!/\.md$/i.test(output))throw Error('Use a .md output path');const json=output.replace(/\.md$/i,'')+'.json';if(files.some(file=>[output,json].includes(resolve(file))))throw Error('Output would overwrite an input report');await mkdir(dirname(output),{recursive:true});await writeFile(output,markdown);await writeFile(json,JSON.stringify(report,null,2)+'\n');console.log(output+'\n'+json);}
 else process.stdout.write(markdown);
}
