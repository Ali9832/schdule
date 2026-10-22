const base=(process.env.NOVA_BASE_URL || 'http://127.0.0.1:3001').replace(/\/$/,'')
const token=process.env.NOVA_TOKEN || ''
const headers=token?{Authorization:`Bearer ${token}`}:{ }
const endpoints=[
  '/api/health','/api/release','/api/v11/health','/api/v11.2/dashboard','/api/v11.3/planning',
  '/api/v11.5/schedule','/api/v11.6/meetings','/api/v11.7/control','/api/v11.8/learning',
  '/api/v11.9/health-system','/api/v11.10/relationships','/api/v11.11/integration','/api/v11.12/finance'
]
let failed=0
console.log(`NOVA runtime smoke test: ${base}`)
for(const endpoint of endpoints){
  try{
    const res=await fetch(base+endpoint,{headers})
    const text=await res.text()
    if(res.ok){console.log(`PASS ${res.status} ${endpoint}`)}
    else {failed++; console.log(`FAIL ${res.status} ${endpoint} ${text.slice(0,160)}`)}
  }catch(err){failed++; console.log(`FAIL ERR ${endpoint} ${err.message}`)}
}
if(failed){console.error(`Smoke test failed: ${failed} endpoint(s)`);process.exit(1)}
console.log('Smoke test passed.')
