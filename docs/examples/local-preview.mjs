// Development only. Run from the extracted ORBIT source root after build.
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const root=process.cwd();
const {testDB}=await import(pathToFileURL(resolve(root,'tests/d1.mjs')).href);
const code=await readFile(resolve(root,'dist/server/index.js'),'utf8');
const {default:worker}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const env={DB:testDB(await readFile(resolve(root,'drizzle/0000_orbit_mcp.sql'),'utf8'))};
const server=http.createServer(async(req,res)=>{
 try{
  const chunks=[];for await(const chunk of req)chunks.push(chunk);
  const headers=new Headers(req.headers);headers.set('oai-authenticated-user-id','qa-owner');
  const request=new Request('http://127.0.0.1:8765'+req.url,{method:req.method,headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(chunks)}:{})});
  const response=await worker.fetch(request,env);
  res.writeHead(response.status,Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
 }catch(e){res.writeHead(500,{'content-type':'application/json'});res.end(JSON.stringify({error:e.message}))}
});
server.listen(8765,'127.0.0.1',()=>console.log('Development only: http://127.0.0.1:8765 — Ctrl+C to stop'));
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>server.close(()=>process.exit(0)));
