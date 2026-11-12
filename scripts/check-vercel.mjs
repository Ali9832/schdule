import assert from 'node:assert/strict'
import fs from 'node:fs'
import http from 'node:http'
import {once} from 'node:events'
import {spawnSync} from 'node:child_process'
import Fastify from 'fastify'
import {createVercelHandler} from '../api/index.js'
import {startupFailure} from '../server/startup-errors.js'

const config=JSON.parse(fs.readFileSync('vercel.json','utf8'))
assert.equal(config.framework,'vite');assert.equal(config.outputDirectory,'dist')
assert.equal(config.rewrites[0].source,'/api/:path*');assert.equal(config.functions['api/index.js'].includeFiles,'server/**/*.sql')
const app=Fastify({logger:false});let starts=0
app.get('/api/health',async()=>({ok:true,storage:'postgresql'}))
app.post('/api/test',async request=>({received:request.body}))
const server=http.createServer(createVercelHandler(async()=>{starts++;return {default:app}}))
server.listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${server.address().port}`
try{
  let response=await fetch(base+'/api/health');assert.equal(response.status,200);assert.equal(response.headers.get('Cache-Control'),'private, no-store');assert.deepEqual(await response.json(),{ok:true,storage:'postgresql'})
  response=await fetch(base+'/api/test',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:'Test'})});assert.deepEqual(await response.json(),{received:{title:'Test'}})
  response=await fetch(base+'/api/missing');assert.equal(response.status,404);assert.match(response.headers.get('content-type'),/application\/json/);assert.equal(starts,1)
}finally{server.close();await once(server,'close');await app.close()}
for(const code of ['AUTH_SECRET_MISSING','DATABASE_URL_MISSING','DATABASE_CONNECTION_FAILED','DATABASE_SCHEMA_FAILED','UNEXPECTED_PRIVATE_ERROR']){
  const originalLog=console.error;console.error=()=>{};
  const failed=http.createServer(createVercelHandler(async()=>{throw startupFailure(code,'PRIVATE_VALUE_MUST_NOT_REACH_BROWSER',Object.assign(new Error('postgresql://private-user:private-password@private-db/database'),{code:'28P01'}))}));
  try{failed.listen(0,'127.0.0.1');await once(failed,'listening');const response=await fetch(`http://127.0.0.1:${failed.address().port}/api/health`);assert.equal(response.status,503);assert.equal(response.headers.get('Cache-Control'),'private, no-store');const body=await response.json();assert.equal(body.code,code==='UNEXPECTED_PRIVATE_ERROR'?'APP_STARTUP_FAILED':code);assert.ok(body.error);assert.doesNotMatch(JSON.stringify(body),/PRIVATE_VALUE|private-password|private-db|postgresql:\/\//);}
  finally{failed.close();await once(failed,'close');console.error=originalLog;}
}
for(const [secret,database,expected]of [['','','AUTH_SECRET'],['test-secret-for-isolated-process','','DATABASE_URL'],['test-secret-for-isolated-process','postgresql://test:test@127.0.0.1:1/test','refusing temporary production storage']]){
  const result=spawnSync(process.execPath,['--input-type=module','-e',"import './server/index.js'"],{env:{...process.env,VERCEL:'1',NODE_ENV:'production',AUTH_SECRET:secret,DATABASE_URL:database},encoding:'utf8',timeout:10000})
  assert.notEqual(result.status,0);assert.match(result.stderr,new RegExp(expected))
}
console.log('PASS Vercel routing, lazy Fastify handler, JSON requests, no-store responses and required production configuration')
