function mcpAudioReady(){return audio.started&&Tone.getContext().state==='running'}
function mcpRequireAudio(){if(!mcpAudioReady())throw Error('AUDIO_NOT_READY: Нажмите Start Audio в открытой веб-студии ORBIT, затем повторите команду.')}
function mcpSnapshot(){return {project:ProjectStorage.snapshot(false),state:{instrument_id:state.instrument,instrument:presets[state.instrument].name,bpm:state.bpm,root:state.root,scale:state.scale,scale_lock:state.scaleLock,loop:state.loop,playing:audio.playing,recording:recording.recording,audio_ready:mcpAudioReady(),pattern_length:state.length,recorded_events:state.events.length,position:$('#position').textContent,sound:structuredClone(state.sound),fx:structuredClone(state.fx),arp:structuredClone(state.arp),favorites:[...favoriteInstruments]}}}
function mcpPlayNotes(notes,beats,velocity,respectScale=false){
 mcpRequireAudio();const selected=[...new Set(notes.map(n=>respectScale?MusicTheoryEngine.lock(n):n))],time=Tone.now(),duration=beats*60/state.bpm;
 for(const note of selected){audio.instruments.remote.triggerAttackRelease(freq(note),duration,time,velocity);if(recording.recording)recording.add({kind:'note',note,start:recording.position()%state.length,duration:Math.min(state.length,beats*4),velocity})}
 KeyboardController.pulse(selected,time,duration);return {notes:selected,duration_beats:beats,scheduled:true}
}
const OrbitControl={
 snapshot:mcpSnapshot,
 async invoke(name,args={}){
  mcpValidateCall(name,args);
  if(audio.exporting&&!['orbit_get_state','orbit_get_project','orbit_list_instruments'].includes(name))throw Error('BUSY: дождитесь окончания экспорта WAV.');
  switch(name){
   case'orbit_list_instruments':return MCP_CATALOG;
   case'orbit_get_state':return mcpSnapshot().state;
   case'orbit_get_project':return ProjectStorage.snapshot(false);
   case'orbit_configure':{
    if(audio.pending)throw Error('AUDIO_STARTING: аудиодвижок запускается; повторите команду через секунду.');
    if(args.instrument_id!==undefined&&args.instrument_id!==state.instrument){
     audio.panic();state.instrument=args.instrument_id;setPresetDefaults();if(audio.started){audio.instruments.dispose();audio.instruments=new InstrumentManager(audio.channels)}$('#mod').value=0
    }
    if(['root','scale','scale_lock','arp'].some(k=>args[k]!==undefined))audio.panic();
    for(const [key,target]of Object.entries({bpm:'bpm',root:'root',scale:'scale',scale_lock:'scaleLock',loop:'loop',metronome:'metronome',humanize:'humanize',octave:'octave',velocity:'velocity',swing:'swing'}))if(args[key]!==undefined)state[target]=args[key];
    if(args.sound)Object.assign(state.sound,args.sound);
    if(args.fx)for(const [key,value]of Object.entries(args.fx))Object.assign(state.fx[key],value);
    if(args.arp){Object.assign(state.arp,args.arp);Arpeggiator.counter=0}
    if(args.favorite!==undefined){args.favorite?favoriteInstruments.add(state.instrument):favoriteInstruments.delete(state.instrument);try{localStorage.setItem('orbit-favorites-v1',JSON.stringify([...favoriteInstruments]))}catch{toast('Избранное изменено, но браузер не разрешил его сохранить')}}
    if(audio.started){audio.instruments.update();audio.fx.route();for(const key of Object.keys(state.fx))audio.fx.update(key)}
    sequencer.resetTiming();renderInstrumentPicker();syncAll();ProjectStorage.persist();return mcpSnapshot().state
   }
   case'orbit_transport':{
    if(['play','record_start'].includes(args.action))mcpRequireAudio();
    if(args.action==='play')await audio.play();
    if(args.action==='pause'&&audio.started)audio.pause();
    if(args.action==='stop')audio.stop();
    if(args.action==='record_start'&&!recording.recording)await recording.toggle();
    if(args.action==='record_stop')recording.finish();
    return mcpSnapshot().state
   }
   case'orbit_play_notes':return mcpPlayNotes(args.notes,args.duration_beats??.5,args.velocity??state.velocity,args.respect_scale??false);
   case'orbit_trigger_pad':{
    mcpRequireAudio();const mode=args.mode??state.padMode,beats=args.duration_beats??.5,velocity=args.velocity??state.velocity,index=args.pad;
    if(state.padMode!==mode){state.padMode=mode;PadController.render()}
    let result;
    if(mode==='chord'||mode==='scale')result=mcpPlayNotes(mode==='chord'?MusicTheoryEngine.chord(index):[MusicTheoryEngine.degree(index,3)],beats,velocity);
    if(mode==='drum'){audio.hit(index,Tone.now(),velocity);result={drum:drumNames[index],scheduled:true}}
    if(mode==='sample'){
     const source='mcp-sample:'+crypto.randomUUID(),time=Tone.now();audio.sampleOn(index,source,time,false);
     if(state.samplePlayback!=='one')audio.samplePlayers.get(source)?.stop(time+beats*60/state.bpm);
     if(recording.recording)recording.add({kind:'sample',note:index,start:recording.position()%state.length,duration:Math.min(state.length,state.samplePlayback==='one'?audio.sampleBuffers[index].duration*state.bpm/60*4:beats*4),velocity:state.sampleVolume});
     result={sample:state.samples[index]?.name||'built-in '+index,scheduled:true}
    }
    PadController.flash(index);ProjectStorage.autosave();return {pad:index,mode,...result}
   }
   case'orbit_set_pattern':{
    const length=args.length??state.length;
    for(const p of args.melody||[])if(p.step>=length)throw Error('Шаг мелодии выходит за длину паттерна.');
    for(const row of args.drums||[])if(row.steps.some(s=>s>=length))throw Error('Шаг ударных выходит за длину паттерна.');
    history.capture();if(length!==state.length)audio.stop();state.length=length;
    if(args.replace){state.pattern.melody.forEach(p=>p.on=false);state.pattern.drums.forEach(r=>r.fill(false))}
    for(const p of args.melody||[])Object.assign(state.pattern.melody[p.step],{on:p.on??true,note:p.note,velocity:p.velocity??state.velocity,duration:p.duration_steps??1});
    for(const row of args.drums||[]){const target=state.pattern.drums[['kick','snare','hat','clap'].indexOf(row.drum)];target.fill(false);row.steps.forEach(s=>target[s]=true)}
    sequencer.resetTiming();renderSequence();renderRoll();recording.reschedule();ProjectStorage.persist();return {length:state.length,pattern:structuredClone(state.pattern)}
   }
   case'orbit_edit_notes':{
    for(const n of args.notes)if(n.start_step+n.duration_steps>state.length)throw Error('Ноты должны помещаться в текущую длину паттерна.');
    if((args.replace?0:state.events.length)+args.notes.length>4096)throw Error('Достигнут лимит 4096 событий.');
    history.capture();if(args.replace)state.events=[];
    state.events.push(...args.notes.map(n=>({kind:'note',note:n.note,start:n.start_step,duration:n.duration_steps,velocity:n.velocity??state.velocity})));
    renderRoll();recording.reschedule();ProjectStorage.persist();return {recorded_events:state.events.length}
   }
   case'orbit_generate_progression':$('#genre').value=args.genre;generateProgression();return {genre:args.genre,pattern:structuredClone(state.pattern)};
   case'orbit_history':{
    const undo=args.action==='undo';if(!(undo?history.past:history.future).length)throw Error('Нет изменений для '+(undo?'отмены':'повтора')+'.');
    history.apply(undo?history.past:history.future,undo?history.future:history.past);return mcpSnapshot().state
   }
   case'orbit_export':{
    if(args.format==='wav'){mcpRequireAudio();return await exportWav({throwOnError:true})}
    if(args.format==='json'){ProjectStorage.save();return {file_name:'orbit-session.json',download_started:true,includes_sample_audio:true}}
    ProjectStorage.download(midiBlob(),'orbit-session.mid');return {file_name:'orbit-session.mid',download_started:true}
   }
   case'orbit_load_project':{
    const data=ProjectStorage.validate(structuredClone(args.project));
    mcpValidate(mcpSoundSchema,data.sound,'project.sound');mcpValidate(mcpFxSchema,data.fx,'project.fx');mcpValidate(MCP_TOOLS.find(t=>t.name==='orbit_configure').inputSchema.properties.arp,data.arp,'project.arp');
    if(data.samples.length>16)throw Error('Проект может содержать не больше 16 сэмплов.');
    for(const key of ['loop','metronome','humanize','scaleLock'])data[key]=!!data[key];data.sustain=false;data.name=typeof data.name==='string'?data.name.slice(0,120):'Новая сессия';data.velocity=clamp(Number(data.velocity)||.78,.1,1);data.swing=clamp(Number(data.swing)||0,0,.65);data.sampleVolume=clamp(Number(data.sampleVolume)||.8,0,1);if(!['one','gate','loop'].includes(data.samplePlayback))data.samplePlayback='one';
    for(let i=0;i<data.samples.length;i++){
     const sample=data.samples[i];if(!sample)continue;
     if(sample.data&&!/^data:audio\//.test(sample.data))throw Error('Аудиосэмплы проекта должны быть встроенными data:audio файлами.');
     if(!sample.data&&sample.name===state.samples[i]?.name&&state.samples[i]?.data)sample.data=state.samples[i].data
    }
    audio.stop();state=data;history.clear();if(audio.started)await audio.rebuild();syncAll();ProjectStorage.persist();return {loaded:true,instrument_id:state.instrument,missing_sample_audio:state.samples.filter(s=>s&&!s.data).map(s=>s.name)}
   }
   default:throw Error('Команда не поддерживается браузером: '+name)
  }
 }
};
window.OrbitControl=OrbitControl;
const OrbitMcpBridge={
 session:null,enabled:false,completed:new Map(),timer:null,
 status(text,on=false){const b=$('#mcpConnection');b.textContent=text;b.classList.toggle('connected',on);b.title=this.session?'MCP-сессия '+this.session+'. Нажмите, чтобы отключить.':'Управление ORBIT из чата через MCP'},
 async post(path,data){const response=await fetch('/api/orbit/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),signal:AbortSignal.timeout(12000)});const result=await response.json().catch(()=>({error:'Сервер MCP недоступен'}));if(!response.ok){const error=Error(result.error||'MCP '+response.status);error.status=response.status;throw error}return result},
 async connect(){
  if(location.protocol==='file:'){window.open('https://orbit-keyboard-studio-29oct.druidbeat.chatgpt.site/','_blank','noopener');return}
  if(this.enabled)return;this.enabled=true;this.status('MCP · подключение…');
  try{const data=await this.post('connect',{label:'ORBIT · '+(innerWidth<700?'планшет / телефон':'браузер'),snapshot:mcpSnapshot()});if(!this.enabled)return;this.session=data.session_id;this.status('MCP ● подключён',true);this.poll()}
  catch(e){this.enabled=false;this.status(e.status===401?'MCP · войдите в студию':'MCP · недоступен')}
 },
 async poll(){
  if(!this.enabled||!this.session)return;
  try{
   const data=await this.post('poll',{session_id:this.session,snapshot:mcpSnapshot()});
   for(const command of data.commands){
    if(!this.enabled)break;let result=this.completed.get(command.id);
    if(!result){try{result={ok:true,value:await OrbitControl.invoke(command.tool,command.arguments)}}catch(e){result={ok:false,error:e.message}}this.completed.set(command.id,result);if(this.completed.size>128)this.completed.delete(this.completed.keys().next().value)}
    await this.post('ack',{session_id:this.session,command_id:command.id,result,snapshot:mcpSnapshot()});
    $('#mcpLastCommand').textContent=(result.ok?'✓ ':'! ')+command.tool
   }
   this.status('MCP ● подключён',true)
  }catch(e){if(e.status===401||e.status===403){this.enabled=false;this.status('MCP · войдите в студию')}else if(e.status===404){this.session=null;this.enabled=false;this.status('MCP · переподключить')}else this.status('MCP · восстанавливаем связь…')}
  if(this.enabled)this.timer=setTimeout(()=>this.poll(),900)
 },
 async disconnect(){this.enabled=false;clearTimeout(this.timer);const id=this.session;this.session=null;audio.panic();this.status('MCP ○ отключён');if(id)try{await this.post('disconnect',{session_id:id})}catch{}},
 init(){
  $('#mcpConnection').onclick=()=>this.enabled?this.disconnect():this.connect();window.addEventListener('pagehide',()=>{this.enabled=false;clearTimeout(this.timer);if(this.session)navigator.sendBeacon('/api/orbit/disconnect',new Blob([JSON.stringify({session_id:this.session})],{type:'application/json'}))});
  if(location.protocol==='file:'){this.status('MCP · веб-версия ↗');return}
  if(location.origin==='https://orbit-keyboard-studio-29oct.druidbeat.chatgpt.site'||['localhost','127.0.0.1'].includes(location.hostname))this.connect();else this.status('MCP ○ подключить')
 }
};
OrbitMcpBridge.init();
