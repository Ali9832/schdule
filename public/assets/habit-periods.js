(() => {
  'use strict';
  const format=new Intl.DateTimeFormat('en-US-u-ca-persian',{year:'numeric',month:'numeric',day:'numeric',timeZone:'UTC'});
  const shift=(date,n)=>new Date(Date.parse(date+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);
  const parts=date=>Object.fromEntries(format.formatToParts(new Date(date+'T12:00:00Z')).filter(p=>['year','month','day'].includes(p.type)).map(p=>[p.type,Number(p.value)]));
  function iso(year,month,day=1){
    const target=year*10000+month*100+day;
    let lo=Math.floor(Date.UTC(year+621,0,1)/86400000),hi=Math.floor(Date.UTC(year+622,11,31)/86400000);
    while(lo<hi){const mid=Math.floor((lo+hi)/2),p=parts(new Date(mid*86400000).toISOString().slice(0,10));if(p.year*10000+p.month*100+p.day<target)lo=mid+1;else hi=mid;}
    return new Date(lo*86400000).toISOString().slice(0,10);
  }
  const month=(year,m,delta)=>{const total=year*12+m-1+delta;return {year:Math.floor(total/12),month:(total%12+12)%12+1};};
  const dates=(from,to)=>Array.from({length:Math.round((Date.parse(to)-Date.parse(from))/86400000)+1},(_,i)=>shift(from,i));
  function period(mode,anchor){
    const p=parts(anchor);let from=anchor,to=anchor,months=0;
    if(mode==='week'){from=shift(anchor,-((new Date(anchor+'T12:00:00Z').getUTCDay()+1)%7));to=shift(from,6);}
    if(['month','quarter','year'].includes(mode)){
      months=mode==='year'?12:mode==='quarter'?3:1;
      const m=mode==='year'?1:mode==='quarter'?Math.floor((p.month-1)/3)*3+1:p.month;
      from=iso(p.year,m);const next=month(p.year,m,months);to=shift(iso(next.year,next.month),-1);
    }
    let buckets;
    if(months>1){const first=parts(from);buckets=Array.from({length:months},(_,i)=>{const p=month(first.year,first.month,i),next=month(p.year,p.month,1),start=iso(p.year,p.month),end=shift(iso(next.year,next.month),-1);return {from:start,to:end,dates:dates(start,end)};});}
    else buckets=dates(from,to).map(d=>({from:d,to:d,dates:[d]}));
    return {mode,from,to,buckets,aggregate:months>1};
  }
  function move(mode,anchor,direction){
    if(mode==='day'||mode==='week')return shift(anchor,direction*(mode==='week'?7:1));
    const p=parts(anchor),next=month(p.year,p.month,direction*(mode==='year'?12:mode==='quarter'?3:1)),end=month(next.year,next.month,1);
    const last=parts(shift(iso(end.year,end.month),-1)).day;
    return iso(next.year,next.month,Math.min(p.day,last));
  }
  function summary(habits,range,today){
    const elapsed=range.buckets.flatMap(b=>b.dates).filter(d=>d<=today);
    const rows=habits.filter(h=>h.status!=='paused').map(h=>({...h,counts:range.buckets.map(b=>b.dates.filter(d=>d<=today&&h.logs?.[d]).length)}));
    return {rows,total:rows.reduce((n,r)=>n+r.counts.reduce((a,b)=>a+b,0),0),elapsed:elapsed.length,active_days:elapsed.filter(d=>rows.some(h=>h.logs?.[d])).length};
  }
  window.HabitPeriods={parts,iso,shift,period,move,summary};
})();
