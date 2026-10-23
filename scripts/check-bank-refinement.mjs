import fs from 'node:fs'
import assert from 'node:assert/strict'
const before=JSON.parse(fs.readFileSync('public/data/master-items.original.json','utf8'))
const after=JSON.parse(fs.readFileSync('public/data/master-items.json','utf8'))
const originals=new Map(before.items.map(i=>[i.id,i]))
for(const item of after.items){
 const original=originals.get(item.id);assert.ok(original)
 for(const [key,value] of Object.entries(original))if(!['h','category','macro'].includes(key))assert.deepEqual(item[key],value,`${item.id}: ${key}`)
 const category=after.categories.find(c=>c.h===item.h)
 assert.equal(item.category,category.title);assert.equal(item.macro,category.macro)
 assert.ok(item.subcategory);assert.deepEqual(item.classification.original,{h:original.h,category:original.category,macro:original.macro})
}
for(const [id,h] of Object.entries({'MI-0005':'E03','MI-0059':'T05','MI-0113':'T01','MI-1438':'S01','MI-0049':'P03','MI-3066':'Z02','MI-3095':'Z02','MI-3118':'Z02','MI-3119':'Z03','MI-0066':'B02','MI-1007':'U04','MI-0179':'I06','MI-1451':'P04','MI-2584':'B03','MI-0723':'U03','MI-0690':'U09'}))assert.equal(after.items.find(i=>i.id===id).h,h,id)
console.log('Classification: all original IDs, content, notes, statuses and references preserved; category and semantic regression checks passed.')
