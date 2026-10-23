import assert from 'node:assert/strict'
import fs from 'node:fs'
import http from 'node:http'

// Exercise the real serverless entry point with a disposable local workspace.
process.env.VERCEL='1'
process.env.NODE_ENV='production'
process.env.AUTH_SECRET='test-only-not-a-deployment-secret'
process.env.DATABASE_URL=''
const {default:handler,createVercelHandler}=await import('../api/index.js')
const config=JSON.parse(fs.readFileSync('vercel.json','utf8'))
assert.ok(config.rewrites.some(rule=>rule.source==='/api/:path*'&&rule.destination==='/api/index'))
assert.equal(config.outputDirectory,'dist')
const server=http.createServer(handler)
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
const base=`http://127.0.0.1:${server.address().port}`
try{
 for(const path of ['/api/health','/api/v11.2/dashboard','/api/bootstrap','/api/modules']){
  const response=await fetch(base+path)
  assert.equal(response.status,200,path)
  assert.match(response.headers.get('content-type'),/application\/json/)
  assert.equal(response.headers.get('cache-control'),'private, no-store')
  const payload=await response.json()
  if(path==='/api/health')assert.equal(payload.ok,true)
 }
 const missing=await fetch(base+'/api/does-not-exist')
 assert.equal(missing.status,404)
 assert.match(missing.headers.get('content-type'),/application\/json/)
 console.log('PASS Vercel entry: health, dashboard, bootstrap, modules, JSON 404 and private cache headers')
}finally{
 server.closeAllConnections()
 await new Promise(resolve=>server.close(resolve))
 const {default:app}=await import('../server/index.js')
 await app.close()
}
let attempts=0
const recovery=createVercelHandler(async()=>{
 attempts++
 if(attempts===1)throw new Error('simulated initialization failure')
 return {default:{ready:async()=>{},server:{emit(){}}}}
})
const response={setHeader(){},end(){}}
await recovery({},response)
assert.equal(response.statusCode,503)
await recovery({},response)
assert.equal(attempts,2)
console.log('PASS failed startup can recover on the next request')
