(() => {
  const originalFetch=window.fetch.bind(window)
  let release,mode='login',required=false,sessionUser=null
  const gate=new Promise(resolve=>{release=resolve})
  const readToken=()=>localStorage.getItem('nova_session')||''
  const whenReady=action=>document.readyState==='loading'?document.addEventListener('DOMContentLoaded',action,{once:true}):action()
  const node=(tag,className,text)=>{const e=document.createElement(tag);if(className)e.className=className;if(text!==undefined)e.textContent=text;return e}
  function show(error=''){
    required=true
    whenReady(()=>{
      document.querySelector('.app').inert=true
      let screen=document.getElementById('accountScreen');if(!screen){screen=node('section','account-screen');screen.id='accountScreen';screen.dir='rtl';screen.setAttribute('aria-label','ورود به حساب');document.body.append(screen)}
      screen.replaceChildren();const card=node('div','account-card'),brand=node('div','account-brand','NOAVA — آوای نو'),heading=node('h1','',mode==='register'?'حساب خودت را بساز':'به فضای خودت وارد شو'),hint=node('p','','تقویم، برنامه‌ها و اطلاعاتت را در حساب شخصی خود نگه دار.');card.append(brand,heading,hint)
      const form=node('form','account-form');const fields={}
      function field(key,label,type){const wrap=node('label','',label),input=node('input');input.name=key;input.type=type;input.required=true;input.autocomplete=key==='email'?'username':key==='display_name'?'name':mode==='register'?'new-password':'current-password';if(key==='password')input.minLength=mode==='register'?8:1;if(key==='display_name'){input.minLength=2;input.maxLength=80}wrap.append(input);form.append(wrap);fields[key]=input}
      if(mode==='register')field('display_name','نام نمایشی','text');field('email','ایمیل','email');field('password','رمز عبور','password')
      const status=node('p','account-status',error);status.setAttribute('role','status');status.setAttribute('aria-live','polite');const submit=node('button','account-submit',mode==='register'?'ساخت حساب':'ورود');submit.type='submit';const change=node('button','account-switch',mode==='register'?'حساب داری؟ وارد شو':'حساب نداری؟ ثبت‌نام کن');change.type='button';change.onclick=()=>{mode=mode==='login'?'register':'login';show()};form.append(status,submit,change);card.append(form);screen.append(card)
      form.onsubmit=async event=>{
        event.preventDefault();if(!form.reportValidity()||submit.disabled)return;submit.disabled=change.disabled=true;status.textContent='در حال بررسی…'
        try{const response=await originalFetch('/api/auth/'+mode,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(Object.entries(fields).map(([key,input])=>[key,key==='password'?input.value:input.value.trim()])))})
          const result=await response.json();if(!response.ok||!result.token)throw Error(result.error||'ورود انجام نشد.')
          const previous=localStorage.getItem('molibden.account.id');if(previous&&previous!==result.user?.id){await clearOfflineQueue()}
          localStorage.setItem('nova_session',result.token);localStorage.setItem('nova_user',JSON.stringify(result.user));localStorage.setItem('molibden.account.id',result.user.id);location.reload()
        }catch(failure){status.textContent=failure.message||'اتصال برقرار نشد. دوباره تلاش کنید.';submit.disabled=change.disabled=false}
      };fields.email.focus()
    })
  }
  async function clearOfflineQueue(){
    await new Promise(resolve=>{const request=indexedDB.deleteDatabase('nova-v111-cache');request.onsuccess=request.onerror=request.onblocked=resolve})
  }
  function accountSettings(){whenReady(()=>{
    const settings=document.getElementById('settings');if(!settings||document.getElementById('accountSettings'))return
    const panel=node('div','account-settings');panel.id='accountSettings';panel.append(node('strong','','حساب کاربری'),node('span','',sessionUser?.email||''));const logout=node('button','','خروج از حساب');logout.type='button';logout.onclick=async()=>{window.NoavaDrafts?.clearUser();localStorage.removeItem('nova_session');localStorage.removeItem('nova_user');await clearOfflineQueue();location.reload()};panel.append(logout);settings.prepend(panel)
  })}
  window.fetch=async function(input,options={}){
    const target=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url,location.href)
    if(target.origin!==location.origin||!target.pathname.startsWith('/api/'))return originalFetch(input,options)
    if(['/api/health','/api/release','/api/auth/login','/api/auth/register'].includes(target.pathname))return originalFetch(input,options)
    await gate
    const headers=new Headers(options.headers||(input instanceof Request?input.headers:undefined));const token=readToken();if(token)headers.set('Authorization','Bearer '+token)
    const response=await originalFetch(input,{...options,headers});if(response.status===401){localStorage.removeItem('nova_session');show('نشست شما پایان یافته است؛ دوباره وارد شوید.')}return response
  }
  originalFetch('/api/health').then(async response=>{
    if(!response.ok)throw Error('سرویس موقتاً در دسترس نیست. اتصال سرور و تنظیمات استقرار را بررسی کنید.')
    const health=await response.json();if(health.storage!=='postgresql'){release();return}
    if(!readToken()){show();return}
    const result=await originalFetch('/api/auth/me',{headers:{Authorization:'Bearer '+readToken()}})
    if(!result.ok){localStorage.removeItem('nova_session');show();return}
    sessionUser=(await result.json()).user;localStorage.setItem('nova_user',JSON.stringify(sessionUser));accountSettings();release()
  }).catch(error=>{show(error.message);whenReady(()=>{const form=document.querySelector('.account-form');if(form){const retry=node('button','account-switch','تلاش دوباره');retry.type='button';retry.onclick=()=>location.reload();form.append(retry)}})})
})();
