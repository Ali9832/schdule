import assert from 'node:assert/strict';
import {obligationSummary} from '../server/finance-obligations.js';
const finance={commitments:[{status:'open',due_date:'2026-11-13'},{status:'open',due_date:'2026-11-14'},{status:'done',due_date:'2026-11-15'},{status:'cancelled'},{status:'open',paid_at:'2026-11-14'},{status:'open',settlement_id:'tx'},{status:'closed'}],debts:[{status:'active',next_due:'2026-11-28'},{status:'active',next_due:'2026-11-29'},{status:'active'},{status:'done'},{status:'cancelled'}]};
const saved=JSON.stringify(finance);
assert.deepEqual(obligationSummary(finance,'2026-11-14'),{commitments_open:5,commitments_overdue:1,commitments_due_14:2});
assert.deepEqual(obligationSummary({},'2026-11-14'),{commitments_open:0,commitments_overdue:0,commitments_due_14:0});
assert.equal(JSON.stringify(finance),saved);
console.log('PASS combined commitment/debt counts, settlement/cancel exclusions, overdue and inclusive 14-day boundaries without modifying records.');
