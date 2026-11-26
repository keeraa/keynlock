import {handlePlaytest} from './playtest.js';
export default {
 async fetch(request,env){
  if(new URL(request.url).pathname.startsWith('/api/playtest/'))return handlePlaytest(request,env);
  return env.ASSETS.fetch(request);
 },
};
