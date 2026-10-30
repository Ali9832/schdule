import fs from 'node:fs'
import crypto from 'node:crypto'
import assert from 'node:assert/strict'
import zlib from 'node:zlib'
const sha=value=>crypto.createHash('sha256').update(value).digest('hex')
const read=file=>fs.readFileSync(file,'utf8')
const source=read('index.html'),output=read('dist/index.html'),manifest=JSON.parse(read('dist/build-integrity.json'))
assert.equal(sha(source),manifest.source,'build is stale relative to source HTML')
assert.equal(sha(output),manifest.output,'output HTML changed after build')
const skeleton=html=>html.replace(/<(script|style)\b([^>]*)>([\s\S]*?)<\/\1>/gi,(_,tag,attrs)=>`<${tag}${attrs}>__COMPACTED__</${tag}>`).replace(/\r\n/g,'\n')
assert.equal(skeleton(source),skeleton(output),'optimized build preserves application markup and script/style positions')
for(const row of manifest.assets){
 assert.equal(sha(read('public/'+row.file)),row.source,row.file+' source is stale')
 assert.equal(sha(read('dist/'+row.file)),row.output,row.file+' output is stale')
}
for(const html of [source,output])for(const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi))if(!/application\/(?:ld\+)?json/.test(match[1]))new Function(match[2])
assert.ok(Buffer.byteLength(output)<Buffer.byteLength(source),'optimized HTML must be smaller than authored source')
for(const file of ['index.html',...manifest.assets.map(a=>a.file),'data/master-items.json']){
 const body=fs.readFileSync('dist/'+file);if(body.length<1024)continue
 assert.deepEqual(zlib.gunzipSync(fs.readFileSync('dist/'+file+'.gz')),body,file+' gzip must decode identically')
 assert.deepEqual(zlib.brotliDecompressSync(fs.readFileSync('dist/'+file+'.br')),body,file+' brotli must decode identically')
}
console.log('PASS optimized build preserves markup, validates inline JavaScript, and fingerprints HTML plus every JS/CSS asset')
