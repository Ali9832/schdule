export function obligationSummary(finance, day) {
  const open = [...(finance.commitments || []).map(row => ({...row, due: row.due_date})), ...(finance.debts || []).map(row => ({...row, direction:'pay', due: row.next_due}))]
    .filter(row => !['done','closed','cancelled'].includes(row.status) && !row.paid_at && !row.settlement_id)
  const due14 = open.filter(row => {if(!row.due)return false;const days=(Date.parse(row.due+'T12:00:00Z')-Date.parse(day+'T12:00:00Z'))/86400000;return days>=0&&days<=14})
  const debt_outstanding=open.filter(row=>row.direction!=='receive').reduce((sum,row)=>sum+(Number.isFinite(Number(row.amount))?Number(row.amount):0),0)
  return {commitments_open:open.length,commitments_overdue:open.filter(row=>row.due&&row.due<day).length,commitments_due_14:due14.length,debt_outstanding}
}
