import assert from 'node:assert/strict';
import {obligationSummary} from '../server/finance-obligations.js';
const finance={commitments:[{status:'open',due_date:'2026-11-13'},{status:'open',due_date:'2026-11-14'},{status:'done',due_date:'2026-11-15'},{status:'cancelled'},{status:'open',paid_at:'2026-11-14'},{status:'open',settlement_id:'tx'},{status:'closed'}],debts:[{status:'active',next_due:'2026-11-28'},{status:'active',next_due:'2026-11-29'},{status:'active'},{status:'done'},{status:'cancelled'}]};
const saved=JSON.stringify(finance);
assert.deepEqual(obligationSummary(finance,'2026-11-14'),{commitments_open:5,commitments_overdue:1,commitments_due_14:2,debt_outstanding:0});
assert.deepEqual(obligationSummary({},'2026-11-14'),{commitments_open:0,commitments_overdue:0,commitments_due_14:0,debt_outstanding:0});
assert.equal(JSON.stringify(finance),saved);
assert.equal(obligationSummary({commitments:[{direction:'pay',amount:500000},{direction:'receive',amount:800000},{direction:'pay',amount:200000,status:'done'},{direction:'pay',amount:300000,status:'cancelled'}],debts:[{amount:1000000,installment:100000},{amount:700000,paid_at:'2026-11-14'}]},'2026-11-14').debt_outstanding,1500000,'Outstanding includes outgoing commitments and full debt amounts, not receivables, instalment amounts or paid/cancelled rows');
console.log('PASS combined commitment/debt counts, settlement/cancel exclusions, overdue and inclusive 14-day boundaries without modifying records.');
