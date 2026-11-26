import {readFile,writeFile,rename,open,unlink} from 'node:fs/promises';

// Local authoring only. The static publication keeps its browser-local saves.
export function createAuthorExclusions({selectionFile,manifestFile,builtSelectionFile}) {
  async function exclude(id) {
    const manifest=JSON.parse(await readFile(manifestFile,'utf8'));
    if(!manifest.paintings.some(p=>p.id===id))throw Error('Unknown painting');
    const lockFile=selectionFile+'.lock';let lock;
    for(let n=0;n<50;n++){
      try{lock=await open(lockFile,'wx');break;}
      catch(error){if(error.code!=='EEXIST')throw error;await new Promise(resolve=>setTimeout(resolve,10));}
    }
    if(!lock)throw Error('Selection is busy');
    try{
      const seed=JSON.parse(await readFile(selectionFile,'utf8'));
      if(!seed.curatedExclusions?.includes(id)){
        seed.curatedExclusions=[...new Set([...(seed.curatedExclusions??[]),id])].sort();
        seed.selectionRevision=(seed.selectionRevision??0)+1;
      }
      const json=JSON.stringify(seed)+'\n';
      async function replace(file){const temp=file+'.'+process.pid+'.tmp';await writeFile(temp,json);await rename(temp,file);}
      await replace(selectionFile);
      await replace(builtSelectionFile);
      return {id,selectionRevision:seed.selectionRevision};
    }finally{await lock.close();await unlink(lockFile);}
  }
  return async function handle(req,res){
    if(req.method!=='POST'){res.writeHead(405).end();return;}
    if(req.headers.origin!=='http://'+req.headers.host){res.writeHead(403).end();return;}
    try{
      let body='';for await(const chunk of req){body+=chunk;if(body.length>1024){res.writeHead(413).end();return;}}
      const {id}=JSON.parse(body);
      if(typeof id!=='string'||! /^(ART|KNL)-\d{4}$/.test(id)){res.writeHead(400).end();return;}
      const result=await exclude(id);
      res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'}).end(JSON.stringify(result));
    }catch(error){console.error('Could not preserve author exclusion:',error.message);res.writeHead(500).end();}
  };
}
