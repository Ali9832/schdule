import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { normalizeFinanceAmounts } from '../server/finance-units.js'
const old={accounts:[{balance:-12345,currency:'IRR'}],transactions:[{amount:20000000}],debts:[{amount:100000,installment:1001}],budgets:[{limit_amount:999}],commitments:[{amount:500}],custom:'preserved'}
const copy=structuredClone(old),converted=normalizeFinanceAmounts(old)
assert.deepEqual(old,copy,'conversion must not mutate stored legacy data during reads')
assert.equal(converted.accounts[0].balance,-1234.5);assert.equal(converted.transactions[0].amount,2000000)
assert.equal(converted.debts[0].installment,100.1);assert.equal(converted.budgets[0].limit_amount,99.9)
assert.equal(converted.commitments[0].amount,50);assert.equal(converted.currency_unit,'TOMAN');assert.equal(converted.custom,'preserved')
assert.deepEqual(normalizeFinanceAmounts(converted),converted,'persisted TOMAN marker prevents repeated division')
const window={},document={readyState:'complete',addEventListener(){},querySelectorAll(){return []}}
vm.runInNewContext(fs.readFileSync('public/assets/money-input.js','utf8'),{window,document})
for(const [value,formatted,number]of [['2000000','2,000,000',2000000],['۲٬۰۰۰٬۰۰۰','2,000,000',2000000],['-1234.5','-1,234.5',-1234.5],['100.1','100.1',100.1]]){assert.equal(window.NoavaMoney.format(value),formatted);assert.equal(window.NoavaMoney.parse(value),number)}
assert.ok(Number.isNaN(window.NoavaMoney.parse('12x3')))
let cursor;const input={value:'2,000,000.',selectionStart:10,setSelectionRange(value){cursor=value}}
// Currency input must retain the decimal point and cursor while typing.
window.NoavaMoney.enhance({querySelectorAll:()=>[input]});assert.equal(input.value,'2,000,000.')
console.log('PASS legacy rial conversion, immutable reads, TOMAN migration marker, signed/decimal amounts and Persian/Arabic separators')
