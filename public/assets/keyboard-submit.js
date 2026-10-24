(() => {
  'use strict';
  const legacy = [
    ['#modalBg','saveModal'],['#v101Capture','quickCaptureTask'],
    ['#v116Composer','v116Save'],['#v117Composer','v117SaveOutcome'],['#v118Composer','v118Save'],
    ['#v115Composer','v115CreateEvent'],
    ['#v1111SpiritualComposer','v1111SaveSpiritual'],['#v1111ReligiousComposer','v1111SaveReligious'],
    ['.v1110-form','v1110AddPerson'],['.v1110-inline-form','v1110AddCommitment'],
    ['.v119-form','v119AddAppointment'],['.v119-custom-grid','v119AddMetric'],
    ['.v119-panel','v119SaveCheckin'],['.v117-hero-actions','v117CreateArea']
  ];
  const pending=new WeakSet();
  const saveButton=(root,name)=>[...root.querySelectorAll('button[onclick]')].find(b=>b.getAttribute('onclick').replace(/\s/g,'')===name+'()');
  for(const [selector,name]of legacy){
    const original=window[name];if(typeof original!=='function')continue;
    window[name]=async function(...args){
      const root=[...document.querySelectorAll(selector)].find(n=>saveButton(n,name));
      if(!root)return original.apply(this,args);
      if(pending.has(root))return;
      const invalid=[...root.querySelectorAll('input,select,textarea')].find(n=>!n.disabled&&!n.checkValidity());if(invalid){invalid.reportValidity();return;}
      const button=saveButton(root,name),disabled=button?.disabled,busy=root.getAttribute('aria-busy');
      pending.add(root);root.setAttribute('aria-busy','true');if(button)button.disabled=true;
      try{return await original.apply(this,args);}
      finally{pending.delete(root);if(button)button.disabled=disabled;busy===null?root.removeAttribute('aria-busy'):root.setAttribute('aria-busy',busy);}
    };
  }
  document.addEventListener('keydown',event=>{
    if(event.defaultPrevented||!(event.key==='Enter'||event.code==='NumpadEnter')||event.isComposing||event.keyCode===229||event.ctrlKey||event.altKey||event.metaKey||event.shiftKey)return;
    const input=event.target;
    if(!(input instanceof HTMLInputElement)||!['text','number','email','url','tel','date','time','datetime-local'].includes(input.type)||input.disabled||input.readOnly||input.list||input.getAttribute('role')==='combobox'||input.closest('.persian-calendar,[inert],.account-screen')||!input.getClientRects().length)return;
    const form=input.form;
    if(form&&form.closest('.app,.modal-bg,.v11-inspector,dialog')){
      const submit=[...form.querySelectorAll('button,input')].find(n=>n.form===form&&n.type==='submit');if(!submit)return;
      // Handle the key itself: browsers/keyboards do not all emit an implicit submit.
      // Stop older global shortcuts and the subsequent implicit submit from firing twice.
      event.preventDefault();event.stopImmediatePropagation();
      if(event.repeat||submit.disabled)return;
      form.requestSubmit(submit);return;
    }
    for(const [selector,name]of legacy){
      const root=input.closest(selector);if(!root||root.closest('.hidden')||root.getAttribute('aria-hidden')==='true')continue;
      const button=saveButton(root,name);if(!button||!button.getClientRects().length)continue;
      event.preventDefault();event.stopImmediatePropagation();if(event.repeat||button.disabled||pending.has(root))return;button.click();return;
    }
  },true);
})();
