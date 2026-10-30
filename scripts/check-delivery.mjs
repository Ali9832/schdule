import assert from 'node:assert/strict'
const base=process.env.NOVA_BASE_URL||'http://127.0.0.1:3033'
assert.ok(['127.0.0.1','localhost'].includes(new URL(base).hostname),'Use a local build server')
const gzip=await fetch(base+'/',{headers:{'Accept-Encoding':'gzip'}}),html=await gzip.text()
assert.equal(gzip.status,200);assert.equal(gzip.headers.get('content-encoding'),'gzip');assert.match(gzip.headers.get('vary'),/accept-encoding/i)
assert.ok(Number(gzip.headers.get('content-length'))<Buffer.byteLength(html)*.4)
const brotli=await fetch(base+'/',{headers:{'Accept-Encoding':'br'}});assert.equal(brotli.headers.get('content-encoding'),'br');assert.equal(await brotli.text(),html)
const icon=await fetch(base+'/favicon.svg');assert.equal(icon.status,200);assert.match(icon.headers.get('content-type'),/image\/svg\+xml/);assert.ok((await icon.text()).length<1000)
for(const missing of ['/favicon.ico','/assets/no-such-file.js','/api/no-such-route'])assert.equal((await fetch(base+missing)).status,404,missing+' must not return the application HTML')
assert.equal((await fetch(base+'/workspace/deep-link')).status,200,'page route fallback is retained')
const font=await fetch(base+'/fonts/vazirmatn-v33.003-variable.woff2');assert.equal(font.status,200);assert.equal(Buffer.from(await font.arrayBuffer()).subarray(0,4).toString(),'wOF2')
const bank=await fetch(base+'/data/master-items.json',{headers:{'Accept-Encoding':'gzip'}});assert.equal(bank.headers.get('content-encoding'),'gzip');assert.ok((await bank.json()).items.length>0)
console.log('PASS local delivery: gzip/brotli negotiation, cache Vary, real favicon/font, missing-file 404, page fallback and compressed bank')
