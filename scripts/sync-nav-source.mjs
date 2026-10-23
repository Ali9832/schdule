import fs from 'node:fs'
let html=fs.readFileSync('index.html','utf8')
html=html.replace(/set\('(focusNavBadge|v11TaskBadge|waitingNavBadge|meetingNavBadge|v115ScheduleBadge|v11AreaBadge|v11ResourceBadge)',[^;]*;/g,'')
for(const code of [
 "const badge=document.getElementById('meetingNavBadge');if(badge)badge.textContent=toFaNum(list.length);",
 "const nav=document.getElementById('meetingNavBadge');if(nav)nav.textContent=toFaNum(s.open_actions||s.today||0);",
 "const fb=document.getElementById('focusNavBadge');if(fb)fb.textContent=d.execution?.current_focus?'●':'0';",
 "const fb=document.getElementById('focusNavBadge');if(fb)fb.textContent=active?'●':'0';",
 "const badge=document.getElementById('v11ResourceBadge');if(badge)badge.textContent=toFaNum((s.inbox||0)+(s.backlog||0)+(s.active||0)+(s.processing||0))",
 "const b=document.getElementById('v1110DueBadge');if(b)b.textContent=toFaNum((V1110_DATA.summary?.followups_due||0)+(V1110_DATA.summary?.commitments_overdue||0));",
 "const badge=document.getElementById('v119EnergyBadge'),e=(V119_DATA.metrics||[]).find(m=>m.slug==='energy');if(badge)badge.textContent=e?.latest_value??'—';"
])html=html.replace(code,'')
html=html.replace("['waitingNavBadge','v102WaitingInline','v102WaitingCount']","['v102WaitingInline','v102WaitingCount']")
html=html.replace(/(<span class="nav-badge"[^>]*>)0(<\/span>)/g,'$1—$2')
html=html.replace('دانلود Excel کامل ۳٬۲۴۸ آیتم','دانلود Excel اولیه (پیش از بازبینی دسته‌بندی)')
fs.writeFileSync('index.html',html)
// Parse every inline script before the production build.
for(const [,script] of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g))new Function(script)
console.log('Navigation writers consolidated; inline scripts parse successfully.')
