import assert from 'node:assert/strict'
const targets=await(await fetch('http://127.0.0.1:9227/json/list')).json()
const socket=new WebSocket(targets.find(tab=>tab.type==='page').webSocketDebuggerUrl)
await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject})
let sequence=0;const pending=new Map()
socket.onmessage=event=>{const result=JSON.parse(event.data);if(result.id){const item=pending.get(result.id);pending.delete(result.id);result.error?item.reject(result.error):item.resolve(result.result)}}
const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}))})
async function evaluate(expression){const result=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);return result.result.value}
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms))
async function until(expression){for(let i=0;i<60;i++){if(await evaluate(expression))return;await pause(100)}throw Error('Timeout: '+expression)}
let script,previous
try{
  await send('Page.enable');await send('Network.enable');await send('Network.setBypassServiceWorker',{bypass:true})
  previous=await evaluate("Object.fromEntries(['nova_session','nova_user','molibden.account.id'].map(key=>[key,localStorage.getItem(key)]))")
  await evaluate("localStorage.removeItem('nova_session');localStorage.removeItem('nova_user')")
  script=await send('Page.addScriptToEvaluateOnNewDocument',{source:`(() => {
    const original=window.fetch.bind(window);window.authTestRequests=[];
    window.fetch=async(input,options={})=>{const url=new URL(typeof input==='string'?input:input.url,location.href);const json=(body,status=200)=>Promise.resolve(new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}}));
      if(url.pathname==='/api/health')return json({ok:true,storage:'postgresql'});
      if(url.pathname==='/api/auth/login'){const body=JSON.parse(options.body);return body.password==='test-password'?json({token:'test-browser-session',user:{id:'test-account',email:body.email,display_name:'Test'}}):json({error:'Invalid test credentials'},401)}
      if(url.pathname==='/api/auth/me')return json({user:{id:'test-account',email:'test@example.com',display_name:'Test'}});
      if(url.pathname.startsWith('/api/'))window.authTestRequests.push(new Headers(options.headers).get('Authorization'));
      return original(input,options)
    }
  })()`})
  await send('Page.reload',{ignoreCache:true});await pause(500);await until("!!document.getElementById('accountScreen')")
  assert.equal(await evaluate("document.querySelector('.app').inert"),true)
  assert.equal(await evaluate('authTestRequests.length'),0)
  for(const width of [320,390,1440]){await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<700});assert.equal(await evaluate("document.querySelector('.account-screen').scrollWidth<=innerWidth"),true)}
  await evaluate("document.querySelector('.account-switch').click()")
  assert.equal(await evaluate("!!document.querySelector('.account-form input[name=display_name]')"),true)
  await evaluate("document.querySelector('.account-switch').click();document.querySelector('.account-form input[name=email]').value='test@example.com';document.querySelector('.account-form input[name=password]').value='wrong';document.querySelector('.account-form').requestSubmit()")
  await until("document.querySelector('.account-status').textContent==='Invalid test credentials'")
  await evaluate("document.querySelector('.account-form input[name=password]').value='test-password';document.querySelector('.account-form').requestSubmit()")
  await pause(700);await until("!!document.getElementById('accountSettings')")
  assert.equal(await evaluate("document.querySelector('.app').inert"),false)
  await pause(700)
  assert.equal(await evaluate("authTestRequests.length>0 && authTestRequests.every(value=>value==='Bearer test-browser-session')"),true)
  assert.equal(await evaluate("!!document.getElementById('accountScreen')"),false)
  console.log('PASS hosted sign-in gate, registration form, invalid credentials, authenticated API headers, session reload and mobile layout')
}finally{
  if(script)await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:script.identifier})
  if(previous)await evaluate(`for(const [key,value]of Object.entries(${JSON.stringify(previous)})){if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,value)}`)
  await send('Page.reload',{ignoreCache:true});socket.close()
}
