class OrbitHttpError extends Error{constructor(status,message,code='REQUEST_FAILED'){super(message);this.status=status;this.code=code}}
const orbitJSON=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const orbitResult=(value,isError=false)=>({content:[{type:'text',text:JSON.stringify(value)}],isError});
const orbitNow=()=>Date.now();
const ORBIT_ORIGIN='https://orbit-keyboard-studio-29oct.druidbeat.chatgpt.site';
function orbitUser(request){const id=request.headers.get('oai-authenticated-user-id');if(!id||id.length>200)throw new OrbitHttpError(401,'Войдите в ORBIT через ChatGPT.','AUTH_REQUIRED');return id}
function orbitDB(env){if(!env.DB)throw new OrbitHttpError(503,'Хранилище MCP пока недоступно.','STORAGE_UNAVAILABLE');return env.DB}
async function orbitBody(request){
 if(!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))throw new OrbitHttpError(415,'Ожидается application/json.');
 if(Number(request.headers.get('content-length'))>524288)throw new OrbitHttpError(413,'Максимальный размер команды — 512 КБ.');
 const text=await request.text();if(new TextEncoder().encode(text).byteLength>524288)throw new OrbitHttpError(413,'Максимальный размер команды — 512 КБ.');
 try{return JSON.parse(text)}catch{throw new OrbitHttpError(400,'Неверный JSON.','INVALID_JSON')}
}
function orbitSnapshot(snapshot){mcpValidate(mcpObject({project:{type:'object'},state:{type:'object'}},['project','state']),snapshot,'snapshot');return JSON.stringify(snapshot)}
async function orbitSession(db,user,id){const s=await db.prepare('SELECT * FROM orbit_mcp_sessions WHERE id = ? AND user_id = ?').bind(id,user).first();if(!s)throw new OrbitHttpError(404,'Сессия ORBIT не найдена.','SESSION_NOT_FOUND');return s}
async function orbitResolveSession(db,user,id){
 if(id){const s=await orbitSession(db,user,id);if(s.updated_at<orbitNow()-90000)throw new OrbitHttpError(409,'Вкладка студии отключена. Откройте веб-версию ORBIT.','SESSION_OFFLINE');return s}
 const rows=(await db.prepare('SELECT * FROM orbit_mcp_sessions WHERE user_id = ? AND updated_at > ? ORDER BY updated_at DESC').bind(user,orbitNow()-90000).all()).results;
 if(!rows.length)throw new OrbitHttpError(409,'Нет подключённой веб-студии. Откройте '+ORBIT_ORIGIN+' и дождитесь индикатора «MCP подключён». Для звука нажмите Start Audio.','NO_SESSION');
 if(rows.length>1)throw new OrbitHttpError(409,'Открыто несколько студий. Вызовите orbit_list_sessions и укажите session_id.','SESSION_REQUIRED');return rows[0]
}
function orbitCommandValue(row){if(row.status==='pending'&&row.expires_at<orbitNow())return {command_id:row.id,status:'expired',error:'Время команды истекло; она не будет воспроизведена позже.'};return {command_id:row.id,status:row.status,...(row.result?JSON.parse(row.result):{})}}
async function orbitAPI(request,env,path){
 if(request.method!=='POST')return orbitJSON({error:'Используйте POST.'},405);
 const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin&&origin!==ORBIT_ORIGIN)throw new OrbitHttpError(403,'Запрос должен исходить из этой студии.','ORIGIN_MISMATCH');
 const user=orbitUser(request),db=orbitDB(env),body=await orbitBody(request);
 if(path==='connect'){
  mcpValidate(mcpObject({label:mcpString,snapshot:{type:'object'}},['label','snapshot']),body);
  const id=crypto.randomUUID(),now=orbitNow(),snapshot=orbitSnapshot(body.snapshot);
  await db.batch([
   db.prepare('DELETE FROM orbit_mcp_commands WHERE expires_at < ?').bind(now-86400000),
   db.prepare('DELETE FROM orbit_mcp_sessions WHERE updated_at < ?').bind(now-86400000),
   db.prepare('INSERT INTO orbit_mcp_sessions (id,user_id,label,snapshot,updated_at) VALUES (?,?,?,?,?)').bind(id,user,body.label,snapshot,now)
  ]);return orbitJSON({session_id:id})
 }
 if(path==='poll'){
  mcpValidate(mcpObject({session_id:mcpSession,snapshot:{type:'object'}},['session_id','snapshot']),body);await orbitSession(db,user,body.session_id);
  await db.prepare('UPDATE orbit_mcp_sessions SET snapshot = ?, updated_at = ? WHERE id = ? AND user_id = ?').bind(orbitSnapshot(body.snapshot),orbitNow(),body.session_id,user).run();
  const rows=(await db.prepare("SELECT id,tool,arguments FROM orbit_mcp_commands WHERE session_id = ? AND user_id = ? AND status = 'pending' AND expires_at > ? ORDER BY created_at, rowid LIMIT 16").bind(body.session_id,user,orbitNow()).all()).results;
  return orbitJSON({commands:rows.map(row=>({id:row.id,tool:row.tool,arguments:JSON.parse(row.arguments)}))})
 }
 if(path==='ack'){
  mcpValidate(mcpObject({session_id:mcpSession,command_id:mcpString,result:mcpObject({ok:mcpBoolean,value:{},error:{type:'string',maxLength:2000}},['ok']),snapshot:{type:'object'}},['session_id','command_id','result','snapshot']),body);
  await orbitSession(db,user,body.session_id);
  const command=await db.prepare('SELECT * FROM orbit_mcp_commands WHERE id = ? AND session_id = ? AND user_id = ?').bind(body.command_id,body.session_id,user).first();
  if(!command)throw new OrbitHttpError(404,'Команда не найдена.','COMMAND_NOT_FOUND');
  if(command.status!=='pending')return orbitJSON({acknowledged:true});
  if(command.expires_at<orbitNow())throw new OrbitHttpError(409,'Время команды истекло.','COMMAND_EXPIRED');
  await db.batch([
   db.prepare("UPDATE orbit_mcp_commands SET status = ?, result = ? WHERE id = ? AND user_id = ? AND status = 'pending'").bind(body.result.ok?'done':'error',JSON.stringify(body.result),body.command_id,user),
   db.prepare('UPDATE orbit_mcp_sessions SET snapshot = ?, updated_at = ? WHERE id = ? AND user_id = ?').bind(orbitSnapshot(body.snapshot),orbitNow(),body.session_id,user)
  ]);return orbitJSON({acknowledged:true})
 }
 if(path==='disconnect'){
  mcpValidate(mcpObject({session_id:mcpSession},['session_id']),body);await orbitSession(db,user,body.session_id);
  await db.batch([
   db.prepare('UPDATE orbit_mcp_sessions SET updated_at = 0 WHERE id = ? AND user_id = ?').bind(body.session_id,user),
   db.prepare("UPDATE orbit_mcp_commands SET expires_at = 0 WHERE session_id = ? AND user_id = ? AND status = 'pending'").bind(body.session_id,user)
  ]);return orbitJSON({disconnected:true})
 }
 throw new OrbitHttpError(404,'Неизвестный endpoint.','NOT_FOUND')
}
async function orbitCallTool(request,env,name,args){
 mcpValidateCall(name,args);
 if(name==='orbit_list_instruments')return {instruments:MCP_CATALOG,id_format:'zero-based',studio_url:ORBIT_ORIGIN};
 const user=orbitUser(request),db=orbitDB(env);
 if(name==='orbit_list_sessions'){
  const rows=(await db.prepare('SELECT id,label,snapshot,updated_at FROM orbit_mcp_sessions WHERE user_id = ? AND updated_at > ? ORDER BY updated_at DESC').bind(user,orbitNow()-90000).all()).results;
  return {sessions:rows.map(s=>({session_id:s.id,label:s.label,audio_ready:JSON.parse(s.snapshot).state.audio_ready,updated_at:s.updated_at})),studio_url:ORBIT_ORIGIN}
 }
 if(name==='orbit_command_status'){
  const row=await db.prepare('SELECT * FROM orbit_mcp_commands WHERE id = ? AND user_id = ?').bind(args.command_id,user).first();
  if(!row)throw new OrbitHttpError(404,'Команда не найдена.','COMMAND_NOT_FOUND');return orbitCommandValue(row)
 }
 const session=await orbitResolveSession(db,user,args.session_id),snapshot=JSON.parse(session.snapshot);
 if(name==='orbit_get_state')return {session_id:session.id,snapshot_age_ms:orbitNow()-session.updated_at,...snapshot.state};
 if(name==='orbit_get_project')return {session_id:session.id,snapshot_age_ms:orbitNow()-session.updated_at,project:snapshot.project,sample_audio_included:false};
 const queued=await db.prepare("SELECT count(*) AS n FROM orbit_mcp_commands WHERE session_id = ? AND user_id = ? AND status = 'pending' AND expires_at > ?").bind(session.id,user,orbitNow()).first();
 if(queued.n>=64)throw new OrbitHttpError(429,'Очередь переполнена. Дождитесь выполнения предыдущих команд.','QUEUE_FULL');
 const id=crypto.randomUUID(),now=orbitNow(),ttl=['orbit_play_notes','orbit_trigger_pad','orbit_transport'].includes(name)?15000:90000;
 await db.prepare('INSERT INTO orbit_mcp_commands (id,user_id,session_id,tool,arguments,created_at,expires_at,status) VALUES (?,?,?,?,?,?,?,?)').bind(id,user,session.id,name,JSON.stringify(args),now,now+ttl,'pending').run();
 for(let i=0;i<12;i++){
  await new Promise(resolve=>setTimeout(resolve,250));
  const row=await db.prepare('SELECT * FROM orbit_mcp_commands WHERE id = ? AND user_id = ?').bind(id,user).first();
  if(row.status!=='pending')return {...orbitCommandValue(row),session_id:session.id}
 }
 return {command_id:id,session_id:session.id,status:'pending',expires_at:now+ttl,next_step:'Вызовите orbit_command_status с command_id; не отправляйте ту же команду повторно.'}
}
async function orbitMCP(request,env){
 if(request.method!=='POST')return new Response('MCP requires POST',{status:405,headers:{Allow:'POST','Cache-Control':'no-store'}});
 let body;try{body=await orbitBody(request)}catch(e){return orbitJSON({jsonrpc:'2.0',id:null,error:{code:-32700,message:e.message}},e.status||400)}
 if(!body||Array.isArray(body)||body.jsonrpc!=='2.0'||typeof body.method!=='string')return orbitJSON({jsonrpc:'2.0',id:body?.id??null,error:{code:-32600,message:'Invalid JSON-RPC request'}},400);
 const id=body.id??null,reply=result=>orbitJSON({jsonrpc:'2.0',id,result});
 if(body.method.startsWith('notifications/'))return new Response(null,{status:202});
 if(body.method==='server/discover')return reply({supportedVersions:[MCP_PROTOCOL],capabilities:{tools:{}}});
 if(body.method==='initialize')return reply({protocolVersion:body.params?.protocolVersion===MCP_PROTOCOL?MCP_PROTOCOL:'2025-11-25',capabilities:{tools:{}},serverInfo:{name:'orbit-music-studio',version:'2.0.0'},instructions:'Control the authenticated user’s connected ORBIT web studio. List sessions first; select an explicit session when several are open. Sound requires the user to click Start Audio. Pending commands must be checked with orbit_command_status before retrying.'});
 if(body.method==='ping')return reply({});
 if(body.method==='tools/list')return reply({tools:MCP_TOOLS});
 if(body.method==='tools/call'){
  if(typeof body.params?.name!=='string')return orbitJSON({jsonrpc:'2.0',id,error:{code:-32602,message:'Tool name is required'}},400);
  try{const value=await orbitCallTool(request,env,body.params.name,body.params.arguments??{});return reply(orbitResult(value,value.status==='error'||value.status==='expired'))}
  catch(e){return reply(orbitResult({error:e.message,code:e.code||'INVALID_ARGUMENT'},true))}
 }
 return orbitJSON({jsonrpc:'2.0',id,error:{code:-32601,message:'Method not found'}},404)
}
export default {
 async fetch(request,env){
  const url=new URL(request.url),path=url.pathname;
  try{
   if(path==='/mcp')return await orbitMCP(request,env);
   if(path.startsWith('/api/orbit/'))return await orbitAPI(request,env,path.slice('/api/orbit/'.length));
   if(request.method!=='GET'&&request.method!=='HEAD')return orbitJSON({error:'Method not allowed'},405);
   let body,type;
   if(path==='/'||path==='/index.html'){body=ORBIT_HTML;type='text/html; charset=utf-8'}
   else if(path==='/tone.js'){body=ORBIT_TONE;type='text/javascript; charset=utf-8'}
   else if(path==='/Tone.js.LICENSE.txt'){body=ORBIT_LICENSE;type='text/plain; charset=utf-8'}
   else if(path==='/download/music-keyboard-studio.html')return new Response(request.method==='HEAD'?null:ORBIT_HTML.replace('<script src="tone.js"></script>','<script>\n'+ORBIT_LICENSE+'\n'+ORBIT_TONE.replaceAll('</script','<\\/script')+'\n</script>'),{headers:{'Content-Type':'text/html; charset=utf-8','Content-Disposition':'attachment; filename="music-keyboard-studio.html"','Cache-Control':'no-store'}});
   else return orbitJSON({error:'Not found'},404);
   return new Response(request.method==='HEAD'?null:body,{headers:{'Content-Type':type,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'}})
  }catch(e){return orbitJSON({error:e.message,code:e.code||'REQUEST_FAILED'},e.status||400)}
 }
};
