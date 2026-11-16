import fs from 'node:fs';
import path from 'node:path';
const source=path.resolve('public');
const output=path.resolve('dist');
// Recreate only the generated directory: removed scene modules must never
// linger in a deployment from a previous build.
if(fs.existsSync(output)){
  const info=fs.lstatSync(output);
  if(!info.isDirectory()||info.isSymbolicLink())
    throw new Error('Refusing to overwrite a non-directory build output');
  fs.rmSync(output,{recursive:true});
}
fs.mkdirSync(output,{recursive:true});
fs.cpSync(source,output,{recursive:true,force:true});
console.log('Static workbench built in dist/');
