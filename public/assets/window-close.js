(() => {
  'use strict';
  const surfaces='dialog,#v11Inspector,.v116-composer,.v117-composer,.v118-composer,#v115Composer,.v1110-composer,.v1111-composer,.v1112-composer,.modal-bg>.modal,.command-box,.reading-reminder-toast';
  const actions=new Map([
    ['#v11Inspector',()=>closeV11Inspector()],['#genericAddForm',()=>closeGenericAdd()],['#modalBg>.modal',()=>closeModal()],['.command-box',()=>closeCommandPalette()],
    ['.v116-composer',()=>v116CloseComposer()],['.v117-composer',()=>v117CloseOutcome()],['.v118-composer',()=>v118CloseComposer()],['#v115Composer',()=>v115ToggleComposer(false)]
  ]);
  function decorate(host){
    if(!host.isConnected||host.querySelector(':scope>.window-close-button'))return;
    const owned=[...host.querySelectorAll('button')].filter(b=>b.closest(surfaces)===host);
    let close=owned.find(b=>b.matches('.uc-close,.v11-inspector-close,.overdue-close')||b.textContent.trim()==='بستن'||/^[×✕✖]$/.test(b.textContent.trim())&&/close|Toggle.*false/i.test(b.getAttribute('onclick')||''));
    if(!close){
      const cancel=owned.find(b=>b.textContent.trim()==='انصراف'),action=[...actions].find(([selector])=>host.matches(selector))?.[1]||(!host.matches('dialog')&&cancel?()=>cancel.click():null);
      if(!host.matches('dialog')&&!action)return;
      close=document.createElement('button');
      close.onclick=()=>{
        if(action){action();return;}
        // Use the existing cancel lifecycle, including busy guards and focus restoration.
        if(host.dispatchEvent(new Event('cancel',{cancelable:true}))&&host.open)host.close();
      };
    }
    close.type='button';close.classList.add('window-close-button');close.title='بستن';close.setAttribute('aria-label','بستن پنجره');
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.8');svg.setAttribute('stroke-linecap','round');svg.setAttribute('aria-hidden','true');const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d','m6 6 12 12M18 6 6 18');svg.append(path);close.replaceChildren(svg);
    host.classList.add('window-close-surface');host.prepend(close);
  }
  function scan(root){if(root.nodeType!==1)return;if(root.matches(surfaces))decorate(root);root.querySelectorAll(surfaces).forEach(decorate);const host=root.closest(surfaces);if(host)decorate(host);}
  scan(document.body);
  new MutationObserver(records=>{
    const pending=new Set();for(const record of records){if(record.type==='attributes')pending.add(record.target);else{pending.add(record.target);for(const node of record.addedNodes)if(node.nodeType===1)pending.add(node);}}
    pending.forEach(scan);
  }).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['open']});
  window.WindowCloseUI={scan};
})();
