import crypto from 'node:crypto'
export const ATTACHMENT_LIMIT=2*1024*1024
export function decodeAttachment(body){
 const fail=message=>{throw Object.assign(new Error(message),{statusCode:400})}
 if(!body||typeof body.name!=='string'||!body.name.trim()||body.name.length>200)fail('نام ضمیمه معتبر نیست.')
 if(body?.type==='audio/x-m4a')body={...body,type:'audio/mp4'}
 const types=['image/jpeg','image/png','image/gif','image/webp','audio/mpeg','audio/wav','audio/x-wav','audio/ogg','audio/webm','audio/mp4']
 if(!types.includes(body.type))fail('فقط عکس PNG، JPEG، GIF، WebP یا صوت MP3، WAV، OGG، WebM و M4A مجاز است.')
 if(typeof body.data!=='string'||body.data.length>Math.ceil(ATTACHMENT_LIMIT/3)*4||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(body.data))fail('دادهٔ ضمیمه معتبر نیست یا از ۲ مگابایت بیشتر است.')
 const bytes=Buffer.from(body.data,'base64');if(!bytes.length||bytes.length>ATTACHMENT_LIMIT)fail('حداکثر حجم هر ضمیمه ۲ مگابایت است.')
 const ascii=(start,end)=>bytes.toString('ascii',start,end),hex=bytes.subarray(0,4).toString('hex')
 const signatures={'image/jpeg':hex.startsWith('ffd8ff'),'image/png':bytes.subarray(0,8).toString('hex')==='89504e470d0a1a0a','image/gif':['GIF87a','GIF89a'].includes(ascii(0,6)),'image/webp':ascii(0,4)==='RIFF'&&ascii(8,12)==='WEBP','audio/wav':ascii(0,4)==='RIFF'&&ascii(8,12)==='WAVE','audio/x-wav':ascii(0,4)==='RIFF'&&ascii(8,12)==='WAVE','audio/ogg':ascii(0,4)==='OggS','audio/webm':hex==='1a45dfa3','audio/mp4':ascii(4,8)==='ftyp','audio/mpeg':ascii(0,3)==='ID3'||bytes[0]===255&&(bytes[1]&224)===224}
 if(!signatures[body.type])fail('محتوای فایل با نوع اعلام‌شده مطابقت ندارد.')
 return {name:body.name.replace(/[\u0000-\u001f/\\]/g,'_'),type:body.type,bytes,size:bytes.length}
}
export function registerCalendarAttachments(app,{canonical,store}){
 async function entity(request){const data=await canonical(request.user.id),collection={task:'tasks',event:'events',project:'projects',outcome:'outcomes'}[request.params.source];if(!collection||!data[collection]?.some(row=>row.id===request.params.id))throw Object.assign(new Error('آیتم پیدا نشد.'),{statusCode:404})}
 const publicRow=row=>({id:row.id,name:row.name,type:row.type,size:Number(row.size),created_at:row.created_at})
 app.get('/api/calendar/:source/:id/attachments',async request=>{await entity(request);return {attachments:(await store.list(request.user.id,request.params.source,request.params.id)).map(publicRow)}})
 app.post('/api/calendar/:source/:id/attachments',{bodyLimit:3*1024*1024},async(request,reply)=>{
  await entity(request);const attachment=decodeAttachment(request.body),rows=await store.list(request.user.id,request.params.source,request.params.id)
  if(rows.length>=5)throw Object.assign(new Error('برای هر آیتم حداکثر ۵ ضمیمه می‌توانید ثبت کنید.'),{statusCode:400})
  const row={...attachment,id:crypto.randomUUID(),user_id:request.user.id,source:request.params.source,entity_id:request.params.id,created_at:new Date().toISOString()}
  await store.put(row);return reply.code(201).send(publicRow(row))
 })
 app.get('/api/calendar/:source/:id/attachments/:attachmentId',async(request,reply)=>{
  await entity(request);const row=await store.get(request.user.id,request.params.source,request.params.id,request.params.attachmentId)
  if(!row)return reply.code(404).send({error:'ضمیمه پیدا نشد.'})
  return reply.header('Cache-Control','private, no-store').header('X-Content-Type-Options','nosniff').header('Content-Disposition',`inline; filename*=UTF-8''${encodeURIComponent(row.name)}`).type(row.type).send(row.bytes)
 })
 app.delete('/api/calendar/:source/:id/attachments/:attachmentId',async request=>{await entity(request);await store.remove(request.user.id,request.params.source,request.params.id,request.params.attachmentId);return {ok:true}})
}
