import assert from 'node:assert/strict'
import fs from 'node:fs'
function check(html){
 const start=html.indexOf('<div class="topbar">'),end=html.indexOf('<div class="today-strip"',start)
 assert.ok(start>=0&&end>start,'application header and day strip must exist')
 const header=html.slice(start,end),opens=[...header.matchAll(/<div\b[^>]*>/g)].length,closes=[...header.matchAll(/<\/div\s*>/g)].length
 assert.equal(opens,closes,'topbar must close before the day strip and page sections')
 assert.equal([...header.matchAll(/class="top-actions"/g)].length,1,'header action container must not be nested twice')
 const sharedStart=html.indexOf('<header class="noava-page-header"'),sharedEnd=html.indexOf('</header>',sharedStart),pages=html.indexOf('<!-- DASHBOARD -->');
 assert.ok(sharedStart>=0&&sharedEnd>sharedStart&&sharedEnd<pages,'shared header must close before page content');
 const shared=html.slice(sharedStart,sharedEnd);
 assert.ok(shared.includes('id="todayStrip"')&&shared.includes('id="pageDateControls"'),'summary and contextual date controls belong to the shared header');
 assert.equal([...shared.matchAll(/<div\b[^>]*>/g)].length,[...shared.matchAll(/<\/div\s*>/g)].length,'shared header containers must balance');
}
for(const file of ['index.html','dist/index.html'])check(fs.readFileSync(file,'utf8'))
const source=fs.readFileSync('index.html','utf8')
assert.throws(()=>check(source.replace('<div class="top-actions">','<div class="top-actions"><div class="top-actions">')))
console.log('PASS header containers close before page content; reproduced duplicate-container regression is rejected.')
