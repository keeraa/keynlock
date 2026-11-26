// Author deletions must survive switching preview tabs and publishing a build.
export async function preserveAuthorExclusion(id){
  if(!['localhost','127.0.0.1'].includes(globalThis.location?.hostname))return null;
  try{
    const response=await fetch('/__authoring/exclusions',{
      method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id}),keepalive:true,
    });
    return response.ok;
  }catch{return false;}
}
