(() => {
  const menu=document.getElementById('v114SavedViews');
  if(!menu)return;
  const summary=menu.querySelector('summary'),panel=menu.querySelector('.saved-filter-popover');
  function close(focus=true){menu.open=false;if(focus)summary.focus();}
  function position(){
    if(!menu.open)return;
    const rect=summary.getBoundingClientRect(),width=Math.min(300,innerWidth-24);
    panel.style.width=width+'px';
    panel.style.left=Math.max(12,Math.min(rect.right-width,innerWidth-width-12))+'px';
    const height=panel.getBoundingClientRect().height;
    panel.style.top=Math.max(12,rect.bottom+6+height>innerHeight?rect.top-height-6:rect.bottom+6)+'px';
  }
  menu.addEventListener('toggle',()=>{if(menu.open){renderV114SavedViews();position();}});
  document.addEventListener('pointerdown',event=>{if(menu.open&&!menu.contains(event.target))close(false);});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&menu.open){event.preventDefault();close();}});
  window.addEventListener('resize',position);
  document.addEventListener('scroll',position,true);
  window.addEventListener('nova:page-open',()=>close(false));
  window.SavedFiltersUI={close,position};
})();
