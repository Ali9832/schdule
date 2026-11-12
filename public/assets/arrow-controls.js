(() => {
  'use strict';
  const directions={'→':'right','←':'left','⌃':'up','⌄':'down','↑':'up','↓':'down','‹':'left','›':'right','❮':'left','❯':'right'};
  const labels={right:'قبلی',left:'بعدی',up:'جمع‌کردن',down:'بازکردن'};
  function decorate(button){
    if(button.matches('.sidebar-toggle,.module-toggle'))return;
    const icon=button.querySelector(':scope>.picker-arrow');
    const direction=icon?['right','left','up','down'].find(d=>icon.classList.contains('picker-arrow-'+d)):directions[button.textContent.trim()];
    button.classList.toggle('menu-arrow-control',!!direction);
    if(!direction){delete button.dataset.arrowDirection;return;}
    button.dataset.arrowDirection=direction;
    if(!button.hasAttribute('aria-label'))button.setAttribute('aria-label',button.title||labels[direction]);
  }
  function scan(root){
    if(root.nodeType===3)root=root.parentElement;
    if(!root?.querySelectorAll)return;
    if(root.matches('button'))decorate(root);
    root.querySelectorAll('button').forEach(decorate);
    const button=root.closest('button');if(button&&button!==root)decorate(button);
  }
  scan(document.body);
  new MutationObserver(records=>{
    const roots=new Set();for(const record of records){roots.add(record.target);for(const node of record.addedNodes||[])roots.add(node);}roots.forEach(scan);
  }).observe(document.body,{subtree:true,childList:true,characterData:true});
})();
