const collections = ['accounts', 'transactions', 'debts', 'budgets', 'commitments']

function numeric(value) {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

export function normalizeFinanceAmounts(finance = {}) {
  const normalized = Object.fromEntries(collections.map((key) => [key, Array.isArray(finance[key]) ? finance[key] : []]))
  if (String(finance.currency_unit || '').toUpperCase() === 'TOMAN') {
    return { ...finance, ...normalized, currency_unit: 'TOMAN' }
  }

  normalized.accounts = normalized.accounts.map((row) => ({ ...row, balance: numeric(row.balance) / 10, currency: 'TOMAN' }))
  normalized.transactions = normalized.transactions.map((row) => ({ ...row, amount: numeric(row.amount) / 10, currency: 'TOMAN' }))
  normalized.debts = normalized.debts.map((row) => ({ ...row, amount: numeric(row.amount) / 10, installment: numeric(row.installment) / 10 }))
  normalized.budgets = normalized.budgets.map((row) => ({ ...row, limit_amount: numeric(row.limit_amount) / 10 }))
  normalized.commitments = normalized.commitments.map((row) => ({ ...row, amount: numeric(row.amount) / 10 }))
  return { ...finance, ...normalized, currency_unit: 'TOMAN' }
}
