import assert from 'node:assert/strict'
const base = process.env.NOVA_BASE_URL || 'http://127.0.0.1:3009'
const tabs = await (await fetch('http://127.0.0.1:9228/json/list')).json()
const socket = new WebSocket(tabs.find(tab => tab.type === 'page').webSocketDebuggerUrl)
await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject })
let sequence = 0
const pending = new Map(), errors = []
socket.onmessage = event => { const message = JSON.parse(event.data); if (message.id) { const task = pending.get(message.id); pending.delete(message.id); message.error ? task.reject(message.error) : task.resolve(message.result) } if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails) }
const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++sequence; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })) })
async function evaluate(expression) { const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text); return result.result.value }
const pause = ms => new Promise(resolve => setTimeout(resolve, ms))
async function until(expression) { for (let i = 0; i < 100; i++) { if (await evaluate(expression)) return; await pause(100) } throw Error('Timeout: ' + expression) }
async function save(values) {
  await evaluate(`(()=>{const form=document.getElementById('financeEditorForm');for(const [key,value] of Object.entries(${JSON.stringify(values)})){const input=form.elements.namedItem(key);input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));}form.requestSubmit()})()`)
  await until(`!FinanceEditor.busy && !document.getElementById('financeEditorDialog').open`)
}
const title = 'Finance audit ' + Date.now()
try {
  await send('Runtime.enable'); await send('Page.enable'); await send('Network.enable')
  await send('Network.setCacheDisabled', { cacheDisabled: true }); await send('Network.setBypassServiceWorker', { bypass: true })
  await send('Page.navigate', { url: base + '/?page=finance' }); await pause(400)
  await until('typeof FinanceEditor!=="undefined" && typeof v1112Load==="function"')
  await evaluate('goPage("finance");v1112Load(true)')
  await until('typeof V1112_DATA!=="undefined" && !!V1112_DATA')
  assert.equal(await evaluate('document.querySelectorAll("[data-finance-add]").length'), 5)
  await evaluate('FinanceEditor.open("accounts")')
  await save({ name: title, balance: '1000' })
  const account = await evaluate(`V1112_DATA.finance.accounts.find(x=>x.name===${JSON.stringify(title)}).id`)
  await evaluate(`FinanceEditor.open('accounts',${JSON.stringify(account)})`)
  await save({ note: 'Edited account' })
  assert.equal(await evaluate(`V1112_DATA.finance.accounts.find(x=>x.id===${JSON.stringify(account)}).note`), 'Edited account')
  await evaluate('FinanceEditor.open("budgets")'); await save({ name: title + ' budget', category: title, limit_amount: '500' })
  const budget = await evaluate(`V1112_DATA.finance.budgets.find(x=>x.name===${JSON.stringify(title + ' budget')}).id`)
  await evaluate(`FinanceEditor.open('budgets',${JSON.stringify(budget)})`); await save({ limit_amount: '700' })
  await evaluate('FinanceEditor.open("commitments")'); await save({ title: title + ' bill', amount: '100', account })
  const commitment = await evaluate(`V1112_DATA.finance.commitments.find(x=>x.title===${JSON.stringify(title + ' bill')}).id`)
  await evaluate(`FinanceEditor.open('commitments',${JSON.stringify(commitment)},true)`); await save({})
  assert.equal(await evaluate(`V1112_DATA.finance.accounts.find(x=>x.id===${JSON.stringify(account)}).balance`), 900)
  assert.equal(await evaluate(`V1112_DATA.finance.commitments.find(x=>x.id===${JSON.stringify(commitment)}).status`), 'done')
  assert.equal(await evaluate(`document.getElementById('v1112Commitments').innerText.includes('پرداخت شد')`), true)
  await evaluate('FinanceEditor.open("debts")'); await save({ title: title + ' loan', amount: '200', creditor: 'Test', account })
  const debt = await evaluate(`V1112_DATA.finance.debts.find(x=>x.title===${JSON.stringify(title + ' loan')}).id`)
  await evaluate(`FinanceEditor.open('debts',${JSON.stringify(debt)},true)`)
  await evaluate('document.getElementById("financeEditorForm").elements.record_transaction.checked=false'); await save({})
  assert.equal(await evaluate(`V1112_DATA.finance.accounts.find(x=>x.id===${JSON.stringify(account)}).balance`), 900)
  await evaluate('FinanceEditor.open("transactions")'); await save({ description: title + ' tx', amount: '50', account, status: 'pending' })
  const tx = await evaluate(`V1112_DATA.finance.transactions.find(x=>x.description===${JSON.stringify(title + ' tx')}).id`)
  await evaluate(`FinanceEditor.open('transactions',${JSON.stringify(tx)})`); await save({ amount: '60' })
  await evaluate(`FinanceEditor.open('transactions',${JSON.stringify(tx)},true)`); await save({})
  assert.equal(await evaluate(`V1112_DATA.finance.accounts.find(x=>x.id===${JSON.stringify(account)}).balance`), 840)
  // A failed request must keep the dialog open and never create preview-only data.
  await evaluate('FinanceEditor.open("accounts")')
  await evaluate(`window.__financeFetch=window.apiFetch;window.apiFetch=async()=>{throw new Error('Offline test')};const form=document.getElementById('financeEditorForm');form.elements.name.value='Unsaved';form.requestSubmit()`)
  await until(`!FinanceEditor.busy && document.querySelector('#financeEditorForm [role=alert]').textContent==='Offline test'`)
  assert.equal(await evaluate('document.getElementById("financeEditorDialog").open'), true)
  await evaluate('window.apiFetch=window.__financeFetch;FinanceEditor.close()')
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true })
  await evaluate('FinanceEditor.open("debts")')
  assert.equal(await evaluate('document.getElementById("financeEditorDialog").getBoundingClientRect().width<=390'), true)
  await evaluate('FinanceEditor.close()')
  assert.equal(errors.length, 0, JSON.stringify(errors))
  console.log('Finance browser passed: all five add forms, account/budget/transaction editing, paid commitment/debt, account balances, offline errors and mobile dialog.')
} finally {
  await evaluate(`if(window.__financeFetch)window.apiFetch=window.__financeFetch;window.FinanceEditor?.close()`)
  await send('Emulation.clearDeviceMetricsOverride'); socket.close()
}
