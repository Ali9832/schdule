import assert from 'node:assert/strict'
import Fastify from 'fastify'
import {normalizeTaskTitle,similarTasks,registerTaskSimilarity} from '../server/task-similarity.js'
assert.equal(normalizeTaskTitle('  خَريدِ كِتاب ۱۲ '),normalizeTaskTitle('خرید کتاب 12'))
assert.equal(normalizeTaskTitle('می‌روم'),normalizeTaskTitle('می روم'))
const tasks=[{id:'a',title:'خرید کتاب برنامه نویسی',status:'todo',project_id:'p'},{id:'b',title:'خرید لوازم دفتر',status:'done'},{id:'c',title:'تماس با پزشک',status:'todo'}]
assert.equal(similarTasks(tasks,'خرید ک')[0].id,'a')
assert.equal(similarTasks(tasks,'خرید کتاب برنامه نویسی',{check:true})[0].match,'exact')
assert.equal(similarTasks(tasks,'خرید لوازم دفنر',{check:true})[0].id,'b')
assert.equal(similarTasks(tasks,'نویسی برنامه کتاب خرید',{check:true})[0].id,'a')
assert.deepEqual(similarTasks(tasks,'خرید',{check:true}),[],'a short shared prefix is not a duplicate warning')
assert.deepEqual(similarTasks(tasks,'بررسی گزارش مالی',{check:true}),[])
assert.deepEqual(similarTasks(tasks,'   '),[])
const app=Fastify();app.addHook('preHandler',async r=>{r.user={id:r.headers['test-user']||'one'}})
registerTaskSimilarity(app,{canonical:async id=>({tasks:id==='one'?tasks:[{id:'private',title:'خرید کتاب برنامه نویسی'}],projects:id==='one'?[{id:'p',name:'آموزش'}]:[]})})
try{
 let r=await app.inject('/api/tasks/suggestions?q='+encodeURIComponent('خرید'));assert.equal(r.statusCode,200);assert.ok(r.headers['cache-control'].includes('no-store'));assert.equal(r.json().items.find(t=>t.id==='a').project_name,'آموزش');assert.ok(!r.json().items.some(t=>t.id==='private'))
 r=await app.inject({url:'/api/tasks/a',headers:{'test-user':'two'}});assert.equal(r.statusCode,404)
 r=await app.inject('/api/tasks/a');assert.equal(r.json().title,tasks[0].title)
 r=await app.inject('/api/tasks/suggestions?q='+encodeURIComponent('x'.repeat(301)));assert.equal(r.statusCode,400)
 r=await app.inject('/api/tasks/suggestions?mode=check&q='+encodeURIComponent(tasks[0].title));assert.equal(r.json().items[0].id,'a')
 console.log('PASS task title normalization, prefix/typo/reordered matching, strong duplicate threshold, real task detail and account isolation')
}finally{await app.close()}
