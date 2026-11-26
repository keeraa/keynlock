import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {handlePlaytest} from '../server/playtest.js';
export function createLocalPlaytest(root){
 mkdirSync(join(root,'.playtest'),{recursive:true});
 const db=new DatabaseSync(join(root,'.playtest/analytics.sqlite'));
 db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS _playtest_migrations (tag TEXT PRIMARY KEY);');
 const journal=JSON.parse(readFileSync(join(root,'drizzle/meta/_journal.json'),'utf8'));
 for(const {tag}of journal.entries){
  if(db.prepare('SELECT tag FROM _playtest_migrations WHERE tag=?').get(tag))continue;
  db.exec('BEGIN');try{db.exec(readFileSync(join(root,'drizzle',tag+'.sql'),'utf8'));db.prepare('INSERT INTO _playtest_migrations VALUES (?)').run(tag);db.exec('COMMIT');}catch(error){db.exec('ROLLBACK');throw error;}
 }
 const env={DB:{prepare(sql){return {bind(...values){return {run:()=>db.prepare(sql).run(...values)};}};},async batch(statements){db.exec('BEGIN');try{const result=statements.map(s=>s.run());db.exec('COMMIT');return result;}catch(error){db.exec('ROLLBACK');throw error;}}}};
 return async(req,res)=>{
  let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>64000){res.writeHead(413).end();return;}chunks.push(chunk);}const body=Buffer.concat(chunks).toString('utf8');
  try{
   const response=await handlePlaytest(new Request('http://'+req.headers.host+req.url,{method:req.method,headers:req.headers,...(req.method==='POST'?{body}: {})}),env);
   res.writeHead(response.status,Object.fromEntries(response.headers));res.end(await response.text());
  }catch{res.writeHead(503).end();}
 };
}
