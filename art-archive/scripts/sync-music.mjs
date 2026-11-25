import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {MUSIC_TRACKS} from '../../js/3d/core/audio/music-tracks.js';

const root=new URL('../',import.meta.url);
const canonical=new URL('../../js/3d/core/audio/',import.meta.url);
const recordings=new URL('../../js/3d/scenes/key-archive/dist/assets/music/',import.meta.url);
async function mirror(source,target){
 const bytes=await readFile(source);
 try{if(bytes.equals(await readFile(target)))return;}catch(error){if(error.code!=='ENOENT')throw error;}
 await mkdir(new URL('./',target),{recursive:true});await writeFile(target,bytes);
}
export async function syncArchiveMusic(){
 const manifest=JSON.parse(await readFile(new URL('manifest.json',canonical),'utf8'));
 for(const file of [...manifest.modules,'music-controls.css'])
  await mirror(new URL(file,canonical),new URL('vendor/shared-music/'+file,root));
 for(const {file} of MUSIC_TRACKS)
  await mirror(new URL(file,recordings),new URL('assets/music/'+file,root));
}
if(process.argv[1]&&new URL('file://'+process.argv[1]).href===import.meta.url)await syncArchiveMusic();
