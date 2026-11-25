(() => {
  'use strict';
  const clock=document.getElementById('headerClockTime'),date=document.getElementById('headerClockDate'),weekday=document.getElementById('headerClockWeekday');
  if(!clock||!date||!weekday)return;
  const zone={timeZone:'Asia/Tehran'},timeFormat=new Intl.DateTimeFormat('fa-IR',{...zone,hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
  const dateFormat=new Intl.DateTimeFormat('fa-IR',{...zone,calendar:'persian',year:'numeric',month:'long',day:'numeric'}),weekdayFormat=new Intl.DateTimeFormat('fa-IR',{...zone,weekday:'long'}),dayFormat=new Intl.DateTimeFormat('en-CA',{...zone,year:'numeric',month:'2-digit',day:'2-digit'});
  let timer,lastDay;
  function render(){
    const now=new Date(),day=dayFormat.format(now);clock.textContent=timeFormat.format(now);clock.dateTime=now.toISOString();
    if(day!==lastDay){date.textContent=dateFormat.format(now);date.dateTime=day;weekday.textContent=weekdayFormat.format(now);lastDay=day;}
  }
  function start(){clearInterval(timer);render();if(!document.hidden)timer=setInterval(render,1000);}
  document.addEventListener('visibilitychange',start);window.addEventListener('focus',start);window.addEventListener('pageshow',start);window.addEventListener('pagehide',()=>clearInterval(timer));start();
})();
