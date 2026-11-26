import {createServer} from 'node:http';
import {createReadStream,existsSync,statSync} from 'node:fs';
import {resolve,extname,sep} from 'node:path';
import {createAuthorExclusions} from './scripts/author-exclusions.mjs';
const root=resolve(new URL('./dist',import.meta.url).pathname);
const authorExclusions=createAuthorExclusions({selectionFile:resolve(root,'../catalog/initial-selection.json'),manifestFile:resolve(root,'../catalog/manifest.json'),builtSelectionFile:resolve(root,'catalog/initial-selection.json')});
const types={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.webp':'image/webp','.wav':'audio/wav','.mp3':'audio/mpeg'};
const server=createServer((req,res)=>{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(pathname==='/__authoring/exclusions'){void authorExclusions(req,res);return;}let f=resolve(root,'.'+pathname);if(f!==root&&!f.startsWith(root+sep)){res.writeHead(403).end();return;}if(existsSync(f)&&statSync(f).isDirectory())f=resolve(f,'index.html');if(!existsSync(f)){res.writeHead(404).end();return;}res.writeHead(200,{'Content-Type':types[extname(f)]||'application/octet-stream','Cache-Control':'no-store'});createReadStream(f).pipe(res);});
server.listen(Number(process.env.PORT||4186),'127.0.0.1',()=>console.log('http://127.0.0.1:'+server.address().port));
