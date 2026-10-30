import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../dist/server/index.js',import.meta.url),'utf8');
const {default:worker}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
assert.equal(typeof worker.fetch,'function');
const response=await worker.fetch(new Request('https://orbit.test/mcp',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/list'})}),{});
const data=await response.json();assert.equal(data.result.tools.length,15);
assert.equal((await worker.fetch(new Request('https://orbit.test/'),{})).status,200);
console.log('Validated Worker entrypoint, static studio and 15 MCP tools.');
