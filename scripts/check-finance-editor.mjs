import assert from 'node:assert/strict'
import Fastify from 'fastify'
import { registerFinanceEditor } from '../server/finance-editor.js'

const app = Fastify(), people = new Map(); let sequence = 0
const life = async user => structuredClone(people.get(user) || { finance: {} })
const payload = async user => (await life(user)).finance
app.addHook('preHandler', async request => { request.user = { id: request.headers['test-user'] || 'one' } })
app.setErrorHandler((error, request, reply) => reply.code(error.statusCode || 500).send({ error: error.message }))
registerFinanceEditor(app, { life, saveLife: async (user, data) => people.set(user, data), payload, id: () => `finance-${++sequence}`, today: () => '2026-10-23' })
async function req(method, path, data, status = 200, user = 'one') {
  const result = await app.inject({ method, url: '/api/finance-editor/' + path, payload: data, headers: { 'test-user': user } })
  assert.equal(result.statusCode, status, result.body); return result.json()
}
try {
  let f = await req('POST', 'accounts', { name: 'Bank', balance: 1000 }, 201)
  const account = f.accounts[0].id
  await req('POST', 'accounts', { name: 'Bank', balance: 1 }, 400)
  await req('POST', 'accounts', { name: 'NaN', balance: 'abc' }, 400)
  f = await req('POST', 'budgets', { name: 'Food', category: 'Food', limit_amount: 500, period: '2026-10' }, 201)
  const budget = f.budgets[0].id
  f = await req('PATCH', `budgets/${budget}`, { limit_amount: 600 }); assert.equal(f.budgets[0].limit_amount, 600)
  await req('PATCH', `budgets/${budget}`, { limit_amount: -1 }, 400)
  await req('POST', 'debts', { title: 'Bad date', amount: 10, next_due: '2026-02-30' }, 400)
  await req('POST', 'transactions', { description: 'Bad account', amount: 10, account: 'missing' }, 400)
  f = await req('POST', 'transactions', { description: 'Expense', amount: 100, account, type: 'expense' }, 201)
  const tx = f.transactions[0].id; assert.equal(f.accounts[0].balance, 900)
  f = await req('PATCH', `transactions/${tx}`, { amount: 150 }); assert.equal(f.accounts[0].balance, 850)
  f = await req('PATCH', `transactions/${tx}`, { status: 'pending' }); assert.equal(f.accounts[0].balance, 1000)
  await req('POST', `transactions/${tx}/settle`, { date: '2026-10-24' })
  f = await req('POST', `transactions/${tx}/settle`, {}); assert.equal(f.accounts[0].balance, 850)
  assert.equal(f.transactions[0].date, '2026-10-24')
  f = await req('POST', 'commitments', { title: 'Bill', amount: 200, account, due_date: '2026-10-24' }, 201)
  const commitment = f.commitments[0].id
  const calls = await Promise.all([req('POST', `commitments/${commitment}/settle`, {}), req('POST', `commitments/${commitment}/settle`, {})])
  f = calls[1]; assert.equal(f.accounts[0].balance, 650); assert.equal(f.transactions.length, 2); assert.equal(f.commitments[0].status, 'done')
  await req('PATCH', `commitments/${commitment}`, { amount: 300 }, 409)
  f = await req('PATCH', `commitments/${commitment}`, { note: 'Receipt retained' }); assert.equal(f.commitments[0].note, 'Receipt retained')
  await req('PATCH', `transactions/${f.transactions[1].id}`, { amount: 300 }, 409)
  f = await req('POST', 'debts', { title: 'Loan', amount: 400, installment: 40, creditor: 'Friend' }, 201)
  const debt = f.debts[0].id
  f = await req('PATCH', `debts/${debt}`, { title: 'Updated loan', installment: 50 }); assert.equal(f.debts[0].installment, 50)
  f = await req('POST', `debts/${debt}/settle`, { record_transaction: false }); assert.equal(f.accounts[0].balance, 650); assert.equal(f.transactions.length, 2); assert.equal(f.debts[0].status, 'done')
  f = await req('PATCH', `accounts/${account}`, { name: 'Renamed' }); assert.equal(f.accounts[0].name, 'Renamed')
  await req('PATCH', `accounts/${account}`, { name: 'Intruder' }, 404, 'two')
  await req('POST', `commitments/${commitment}/settle`, {}, 404, 'two')
  assert.deepEqual(await payload('two'), {})
  f = await req('POST', 'commitments', { title: 'Receive', amount: 50, direction: 'receive', account }, 201)
  f = await req('POST', `commitments/${f.commitments[1].id}/settle`, {}); assert.equal(f.accounts[0].balance, 700)
  await req('POST', 'unknown', {}, 404)
  console.log('Finance passed: five box CRUD, validation, edit balance reversal, pending settlement, duplicate-click protection, debt settlement, income, settled-record protection, user isolation.')
} finally { await app.close() }
