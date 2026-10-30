const MCP_PROTOCOL='2026-07-28';
const mcpObject=(properties,required=[])=>({type:'object',properties,required,additionalProperties:false});
const mcpNumber=(minimum,maximum)=>({type:'number',minimum,maximum});
const mcpInteger=(minimum,maximum)=>({type:'integer',minimum,maximum});
const mcpString={type:'string',minLength:1,maxLength:120};
const mcpBoolean={type:'boolean'};
const mcpSession={type:'string',description:'Session ID returned by orbit_list_sessions. Optional only when exactly one session is connected.',minLength:1,maxLength:80};
const mcpSoundSchema=mcpObject({attack:mcpNumber(.001,2),decay:mcpNumber(.01,3),sustain:mcpNumber(0,1),release:mcpNumber(.03,5),cutoff:mcpNumber(100,16000),resonance:mcpNumber(.1,12),volume:mcpNumber(-30,0),pan:mcpNumber(-1,1)});
const mcpFxLimits={reverb:[.3,6,0,.8],delay:[.05,.75,0,.8],distortion:[0,.95,0,.8],chorus:[.1,8,0,1],phaser:[.1,6,0,1],filter:[100,16000,.1,12],tremolo:[.5,14,0,1],compressor:[-45,0,1,12]};
const mcpFxSchema=mcpObject(Object.fromEntries(Object.entries(mcpFxLimits).map(([key,[a,b,c,d]])=>[key,mcpObject({on:mcpBoolean,a:mcpNumber(a,b),b:mcpNumber(c,d)})])));
const mcpNoteSchema=mcpObject({note:mcpInteger(0,127),start_step:mcpNumber(0,31.99),duration_steps:mcpNumber(.1,32),velocity:mcpNumber(.05,1)},['note','start_step','duration_steps']);
const MCP_TOOLS=[
 ['orbit_list_instruments','List all 36 playable instruments with zero-based IDs, categories and descriptions. Works without an open studio.',mcpObject({}),true],
 ['orbit_list_sessions','List your connected ORBIT browser sessions. If more than one is connected, pass an explicit session_id to other tools.',mcpObject({}),true],
 ['orbit_get_state','Read the latest studio state, audio readiness, tempo, current instrument, transport and effects. Includes snapshot age.',mcpObject({session_id:mcpSession}),true],
 ['orbit_get_project','Read the current project JSON from a connected studio. Audio sample bytes are excluded; sample names remain. Use orbit_export for a complete downloadable JSON with sample audio.',mcpObject({session_id:mcpSession}),true],
 ['orbit_configure','Change instrument, tempo, key, sound, effects, arpeggiator or favorite status. Partial updates preserve other settings. Instrument IDs are zero-based; root 0=C, 9=A; velocity is 0.1–1. Effect a/b follow the panel: reverb decay/mix, delay feedback/mix, distortion drive/mix, chorus/phaser/tremolo rate/mix, filter cutoff/Q, compressor threshold/ratio.',mcpObject({session_id:mcpSession,instrument_id:mcpInteger(0,MCP_CATALOG.length-1),bpm:mcpNumber(40,240),root:mcpInteger(0,11),scale:{enum:['minor','major','dorian','pentatonic','chromatic']},scale_lock:mcpBoolean,loop:mcpBoolean,metronome:mcpBoolean,humanize:mcpBoolean,octave:mcpInteger(1,6),velocity:mcpNumber(.1,1),favorite:mcpBoolean,sound:mcpSoundSchema,fx:mcpFxSchema,arp:mcpObject({on:mcpBoolean,mode:{enum:['up','down','updown','random','played']},rate:{enum:['4n','8n','16n','32n']},oct:mcpInteger(1,3),gate:mcpNumber(.1,.95)}),swing:mcpNumber(0,.65)}),false],
 ['orbit_transport','Play, pause, stop, start recording or stop recording. Sound and record_start require the user to click Start Audio in the web studio first.',mcpObject({session_id:mcpSession,action:{enum:['play','pause','stop','record_start','record_stop']}},['action']),false],
 ['orbit_play_notes','Play a short chord or note in the selected instrument with automatic release. MIDI note 60=C4. Duration is in quarter-note beats, not seconds. Requires Start Audio. Respects the requested pitches unless respect_scale=true.',mcpObject({session_id:mcpSession,notes:{type:'array',items:mcpInteger(0,127),minItems:1,maxItems:12},duration_beats:mcpNumber(.0625,4),velocity:mcpNumber(.05,1),respect_scale:mcpBoolean},['notes']),false],
 ['orbit_trigger_pad','Trigger one of 16 zero-based pads as a chord, drum, scale note or local sample. A sample must already be loaded in that browser. Loop/gate samples automatically stop after duration_beats. Requires Start Audio.',mcpObject({session_id:mcpSession,pad:mcpInteger(0,15),mode:{enum:['chord','drum','scale','sample']},duration_beats:mcpNumber(.0625,4),velocity:mcpNumber(.05,1)},['pad']),false],
 ['orbit_set_pattern','Edit the 16/32-step sequencer. Each step is a sixteenth note. replace=true clears the current sequencer before applying the supplied rows; false patches only supplied steps/rows. A drum row lists all its active steps. Editing is undoable.',mcpObject({session_id:mcpSession,length:{enum:[16,32]},replace:mcpBoolean,melody:{type:'array',maxItems:32,items:mcpObject({step:mcpInteger(0,31),note:mcpInteger(0,127),on:mcpBoolean,velocity:mcpNumber(.05,1),duration_steps:mcpNumber(.1,32)},['step','note'])},drums:{type:'array',maxItems:4,items:mcpObject({drum:{enum:['kick','snare','hat','clap']},steps:{type:'array',maxItems:32,items:mcpInteger(0,31)}},['drum','steps'])}}),false],
 ['orbit_edit_notes','Add MIDI-like notes to the Piano Roll, or replace its full recording with replace=true. Times and durations are in sixteenth-note steps. Notes must fit within the current pattern length. Editing is undoable.',mcpObject({session_id:mcpSession,replace:mcpBoolean,notes:{type:'array',maxItems:512,items:mcpNoteSchema}},['notes']),false],
 ['orbit_generate_progression','Create a complete melodic/drum pattern in the current key for a musical style. Replaces the sequencer; the edit is undoable.',mcpObject({session_id:mcpSession,genre:{enum:['House','Techno','Trance','Ambient','Synthwave','Lo-fi']}},['genre']),false],
 ['orbit_history','Undo or redo the last pattern/Piano Roll edit.',mcpObject({session_id:mcpSession,action:{enum:['undo','redo']}},['action']),false],
 ['orbit_export','Start a browser download of JSON, MIDI or WAV. JSON includes local sample audio. WAV renders one pattern cycle and effect tails in the browser, requires Start Audio, and stops transport. Returns download initiation, not a filesystem path.',mcpObject({session_id:mcpSession,format:{enum:['json','midi','wav']}},['format']),false],
 ['orbit_load_project','Load a project JSON into a connected browser. Replaces the current session. Save/export first if needed. Maximum tool payload is 512 KB; larger projects can be opened with the studio file picker.',mcpObject({session_id:mcpSession,project:{type:'object'}},['project']),false],
 ['orbit_command_status','Read the completion or failure of an earlier queued command. Do not resend a timed-out command before checking this status.',mcpObject({command_id:mcpString},['command_id']),true]
].map(([name,description,inputSchema,readOnlyHint])=>({name,description,inputSchema,annotations:{readOnlyHint,destructiveHint:name==='orbit_load_project',idempotentHint:readOnlyHint||['orbit_configure','orbit_set_pattern'].includes(name),openWorldHint:false}}));
function mcpValidate(schema,value,path='arguments'){
 if(schema.enum&&!schema.enum.includes(value))throw Error(path+': expected one of '+schema.enum.join(', '));
 if(schema.type==='object'){
  if(value===null||typeof value!=='object'||Array.isArray(value))throw Error(path+': expected object');
  for(const key of schema.required||[])if(!(key in value))throw Error(path+'.'+key+': required');
  for(const [key,item]of Object.entries(value)){if(schema.properties?.[key])mcpValidate(schema.properties[key],item,path+'.'+key);else if(schema.additionalProperties===false)throw Error(path+'.'+key+': unknown field')}
 }
 if(schema.type==='array'){
  if(!Array.isArray(value))throw Error(path+': expected array');
  if(value.length<(schema.minItems||0)||value.length>(schema.maxItems??Infinity))throw Error(path+': invalid number of items');
  value.forEach((v,i)=>mcpValidate(schema.items,v,path+'['+i+']'))
 }
 if(schema.type==='number'||schema.type==='integer'){
  if(typeof value!=='number'||!Number.isFinite(value)||schema.type==='integer'&&!Number.isInteger(value))throw Error(path+': expected '+schema.type);
  if(value<schema.minimum||value>schema.maximum)throw Error(path+': out of range')
 }
 if(schema.type==='string'&&(typeof value!=='string'||value.length<(schema.minLength||0)||value.length>(schema.maxLength??Infinity)))throw Error(path+': invalid string');
 if(schema.type==='boolean'&&typeof value!=='boolean')throw Error(path+': expected boolean')
}
function mcpValidateCall(name,args){const tool=MCP_TOOLS.find(t=>t.name===name);if(!tool)throw Error('Unknown ORBIT tool: '+name);mcpValidate(tool.inputSchema,args);return tool}
