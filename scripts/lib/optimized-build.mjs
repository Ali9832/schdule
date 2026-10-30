import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import zlib from 'node:zlib'
import { transformWithEsbuild } from 'vite'
const sha=value=>crypto.createHash('sha256').update(value).digest('hex')
async function compact(code,filename,loader){
  if(!code.trim())return code
  const result=await transformWithEsbuild(code,filename,{loader,minify:true,charset:'utf8',target:'es2022',legalComments:'none'})
  return result.code.trim()
}
export function optimizedBuild(){
  let root,outDir
  return {name:'noava-optimized-static-assets',apply:'build',configResolved(config){root=config.root;outDir=path.resolve(root,config.build.outDir)},async closeBundle(){
    const source=fs.readFileSync(path.join(root,'index.html'),'utf8'),file=path.join(outDir,'index.html')
    let html=fs.readFileSync(file,'utf8')
    const blocks=[...html.matchAll(/<(script|style)\b([^>]*)>([\s\S]*?)<\/\1>/gi)]
    for(const [index,match]of blocks.entries()){
      const [original,tag,attrs,body]=match
      if(tag==='script'&&(/\bsrc\s*=/.test(attrs)||/application\/(?:ld\+)?json/.test(attrs)))continue
      const code=await compact(body,`inline-${index}.${tag==='style'?'css':'js'}`,tag==='style'?'css':'js')
      html=html.replace(original,()=>`<${tag}${attrs}>${code}</${tag}>`)
    }
    fs.writeFileSync(file,html)
    const assets=[]
    for(const name of fs.readdirSync(path.join(root,'public/assets'))){
      const extension=path.extname(name);if(!['.js','.css'].includes(extension))continue
      const input=fs.readFileSync(path.join(root,'public/assets',name),'utf8'),output=await compact(input,name,extension.slice(1))
      fs.writeFileSync(path.join(outDir,'assets',name),output)
      assets.push({file:'assets/'+name,source:sha(input),output:sha(output)})
    }
    fs.writeFileSync(path.join(outDir,'build-integrity.json'),JSON.stringify({source:sha(source),output:sha(html),assets}))
    function compress(directory){
      for(const entry of fs.readdirSync(directory,{withFileTypes:true})){
        const name=path.join(directory,entry.name)
        if(entry.isDirectory()){compress(name);continue}
        if(!/\.(?:html|css|js|json)$/.test(name))continue
        const body=fs.readFileSync(name);if(body.length<1024)continue
        fs.writeFileSync(name+'.gz',zlib.gzipSync(body,{level:9}))
        fs.writeFileSync(name+'.br',zlib.brotliCompressSync(body,{params:{[zlib.constants.BROTLI_PARAM_QUALITY]:5}}))
      }
    }
    compress(outDir)
    console.log(`NOAVA optimized HTML: ${Buffer.byteLength(html)} bytes; gzip: ${fs.statSync(file+'.gz').size} bytes`)
  }}
}
