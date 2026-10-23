(() => {
  'use strict';
  const names = { accounts: 'حساب', budgets: 'بودجه', commitments: 'تعهد مالی', debts: 'بدهی', transactions: 'تراکنش' };
  const containers = { accounts: 'v1112Accounts', budgets: 'v1112Budgets', commitments: 'v1112Commitments', debts: 'v1112Debts', transactions: 'v1112Transactions' };
  const esc = value => v1112Esc(String(value ?? ''));
  const money = value => v1112Money(Number(value || 0));
  const settled = row => ['done', 'closed'].includes(row.status) || !!row.paid_at;
  const button = (action, kind, id, label) => `<button type="button" data-finance-action="${action}" data-kind="${kind}" data-id="${esc(id || '')}">${label}</button>`;
  let dialog, busy = false;
  function field(key, label, value = '', type = 'text', extra = '') {
    if (['balance', 'amount', 'limit_amount', 'installment'].includes(key)) {
      type = 'text'; label = label.replace(/ریال/g, 'تومان');
      value = window.NoavaMoney?.format(value) ?? value;
      extra = extra.replace(/(?:min|step)="[^"]*"/g, '') + ' data-money-toman inputmode="decimal" dir="ltr"';
    }
    return `<label>${label}<input name="${key}" type="${type}" value="${esc(value)}" ${extra}></label>`;
  }
  function select(key, label, value, options) {
    return `<label>${label}<select name="${key}">${options.map(([v, title]) => `<option value="${esc(v)}" ${String(value) === String(v) ? 'selected' : ''}>${esc(title)}</option>`).join('')}</select></label>`;
  }
  function accountField(value = '') {
    const options = [['', 'بدون حساب'], ...(V1112_DATA?.finance?.accounts || []).map(a => [a.id, a.name])];
    if (value && !options.some(([v]) => v === value)) {
      const account = (V1112_DATA?.finance?.accounts || []).find(a => a.name === value);
      options.push([value, account?.name || value]);
    }
    return select('account', 'حساب مرتبط', value, options);
  }
  function close() { if (!busy) dialog?.close(); }
  function open(kind, id = '', pay = false) {
    if (!names[kind] || busy) return;
    const row = id ? V1112_DATA?.finance?.[kind]?.find(x => x.id === id) : {};
    if (!row) return showToast('خطا', 'آیتم پیدا نشد؛ صفحه را تازه کنید.');
    window.AppOverlays?.closeAll();
    dialog ||= Object.assign(document.createElement('dialog'), { id: 'financeEditorDialog', className: 'finance-editor' });
    if (!dialog.isConnected) document.body.append(dialog);
    let fields = '';
    if (pay) {
      fields = `<p>${esc(row.title || row.description)} — ${money(row.amount)}</p>` + field('date', 'تاریخ پرداخت / دریافت', window.DateContext?.date || v1112Today(), 'date', 'required');
      if (kind !== 'transactions') fields += accountField(row.account) + '<label class="finance-check"><input type="checkbox" name="record_transaction" checked> ثبت تراکنش مرتبط و به‌روزرسانی مانده حساب</label><p class="finance-hint">اگر تراکنش را قبلاً ثبت کرده‌اید، تیک را بردارید تا مبلغ دوباره محاسبه نشود. این کار فقط ثبت سوابق است؛ انتقال بانکی انجام نمی‌شود. برای بدهی، تسویه کل مانده ثبت می‌شود.</p>';
    } else {
      const titleKey = ['accounts', 'budgets'].includes(kind) ? 'name' : kind === 'transactions' ? 'description' : 'title';
      fields = field(titleKey, kind === 'accounts' ? 'نام حساب' : 'عنوان / شرح', row[titleKey], 'text', 'required maxlength="200"');
      if (kind === 'accounts') fields += field('balance', 'مانده فعلی (ریال)', row.balance ?? 0, 'number', 'required step="any"') + field('masked', 'شماره یا شناسه نمایشی (اختیاری)', row.masked) + select('status', 'وضعیت', row.status || 'active', [['active', 'فعال'], ['closed', 'بسته']]);
      else if (kind === 'budgets') fields += field('limit_amount', 'سقف بودجه (ریال)', row.limit_amount, 'number', 'required min="0.01" step="any"') + field('category', 'دسته هزینه', row.category, 'text', 'required') + field('period', 'ماه بودجه (میلادی، YYYY-MM)', row.period || (window.DateContext?.date || v1112Today()).slice(0, 7), 'month', 'required');
      else {
        const fixed = settled(row) || row.settlement_id;
        fields += field('amount', 'مبلغ (ریال)', row.amount, 'number', `required min="0.01" step="any" ${fixed ? 'readonly' : ''}`);
        fields += accountField(row.account);
        if (kind === 'commitments') fields += select('direction', 'جهت تعهد', row.direction || 'pay', [['pay', 'پرداخت من'], ['receive', 'دریافت من']]) + field('due_date', 'موعد تعهد', id ? row.due_date : window.DateContext?.date || v1112Today(), 'date');
        if (kind === 'debts') fields += field('creditor', 'طلبکار / طرف حساب', row.creditor) + field('installment', 'مبلغ هر قسط (ریال، اختیاری)', row.installment ?? 0, 'number', 'min="0" step="any"') + field('next_due', 'موعد قسط بعدی', id ? row.next_due : window.DateContext?.date || v1112Today(), 'date');
        if (kind === 'transactions') fields += select('type', 'نوع', row.type || 'expense', [['expense', 'هزینه'], ['income', 'درآمد']]) + field('date', 'تاریخ تراکنش', id ? row.date : window.DateContext?.date || v1112Today(), 'date', 'required') + select('status', 'وضعیت', row.status || 'confirmed', [['confirmed', 'پرداخت / دریافت شد'], ['pending', 'در انتظار'], ['cancelled', 'لغوشده']]);
        if (kind !== 'debts') fields += field('category', 'دسته', row.category || 'عمومی');
        if (fixed) fields += '<p class="finance-hint">این مورد تسویه شده است؛ مبلغ، حساب و مشخصات پرداخت قفل هستند. عنوان، دسته و یادداشت قابل ویرایش است.</p>';
      }
      if (kind !== 'transactions') fields += field('note', 'یادداشت (اختیاری)', row.note);
    }
    dialog.innerHTML = `<form id="financeEditorForm" class="record-edit-form"><h2>${pay ? 'ثبت پرداخت / دریافت' : id ? 'ویرایش ' + names[kind] : 'افزودن ' + names[kind]}</h2><div class="record-edit-grid">${fields}</div><div class="record-edit-error" role="alert"></div><div class="record-edit-actions"><button type="submit">${pay ? 'تأیید ثبت' : 'ذخیره'}</button><button type="button" data-close>انصراف</button></div></form>`;
    const form = dialog.querySelector('form');
    if (!pay && (settled(row) || row.settlement_id)) for (const key of ['account', 'direction', 'type', 'date', 'status']) { const input = form.elements.namedItem(key); if (input) input.disabled = true; }
    const draft = window.NoavaDrafts?.bind(form, `finance:${kind}:${id || 'new'}:${pay ? 'pay' : 'edit'}`);
    window.NoavaMoney?.enhance(form);
    form.querySelector('[data-close]').onclick = () => { draft?.clear(); close(); };
    dialog.oncancel = event => { if (busy) event.preventDefault(); };
    form.onsubmit = async event => {
      event.preventDefault(); if (busy || !form.reportValidity()) return;
      const body = Object.fromEntries(new FormData(form));
      // FormData reads the displayed Persian date; the enhanced value getter returns ISO.
      form.querySelectorAll('input[data-persian-type]:not(:disabled)').forEach(input => { body[input.name] = input.value; });
      for (const input of form.querySelectorAll('[data-money-toman]:not(:disabled)')) body[input.name] = NoavaMoney.parse(input.value);
      if (Object.values(body).some(value => typeof value === 'number' && !Number.isFinite(value))) { form.querySelector('[role=alert]').textContent = 'مبلغ معتبر وارد کنید.'; return; }
      if (pay && kind !== 'transactions') body.record_transaction = form.elements.record_transaction.checked;
      busy = true; form.querySelectorAll('button').forEach(b => b.disabled = true);
      try {
        const path = `/api/finance-editor/${kind}${id ? '/' + encodeURIComponent(id) : ''}${pay ? '/settle' : ''}`;
        V1112_DATA = await apiFetch(window.DateContext ? DateContext.query(path) + (DateContext.scoped('finance') ? '' : '&all_dates=1') : path, { method: pay || !id ? 'POST' : 'PATCH', body: JSON.stringify(body) });
        draft?.clear(); v1112Render(); busy = false; dialog.close();
        showToast('ذخیره شد', pay ? 'وضعیت پرداخت ثبت شد.' : names[kind] + ' ذخیره شد.');
      } catch (error) { form.querySelector('[role=alert]').textContent = error.message || 'ذخیره انجام نشد؛ دوباره تلاش کنید.'; }
      finally { busy = false; form.querySelectorAll('button').forEach(b => b.disabled = false); }
    };
    dialog.showModal(); window.PersianUI?.scan?.(dialog);
    form.querySelector('input')?.focus();
  }
  const renderOriginal = window.v1112Render;
  window.v1112Render = function () {
    renderOriginal();
    const f = V1112_DATA?.finance || {};
    for (const [kind, container] of Object.entries(containers)) {
      const root = document.getElementById(container); if (!root) continue;
      const header = root.closest('.v1112-card')?.querySelector('.v1112-head');
      if (header && !header.querySelector('[data-finance-add]')) {
        header.querySelectorAll('button').forEach(b => b.remove());
        header.insertAdjacentHTML('beforeend', button('add', kind, '', '＋ افزودن ' + names[kind]).replace('data-finance-action', 'data-finance-add="true" data-finance-action'));
      }
      if (kind === 'transactions') {
        const table = root.querySelector('table'); if (!table) continue;
        table.querySelector('thead tr').insertAdjacentHTML('beforeend', '<th>وضعیت / عملیات</th>');
        table.querySelectorAll('tbody tr').forEach((tr, index) => {
          const row = (f.transactions || [])[index];
          const cell = document.createElement('td');
          cell.innerHTML = `<div class="v1112-row-actions"><span class="v1112-state ${row.status === 'confirmed' ? 'good' : ''}">${row.status === 'pending' ? 'در انتظار' : row.status === 'cancelled' ? 'لغوشده' : 'پرداخت / دریافت شد'}</span>${button('edit', kind, row.id, 'ویرایش')}${row.status === 'pending' ? button('pay', kind, row.id, row.type === 'income' ? 'دریافت شد' : 'پرداخت شد') : ''}</div>`;
          tr.append(cell);
          const account = (f.accounts || []).find(a => a.id === row.account);
          if (account) tr.children[3].textContent = account.name;
        });
        if (!(f.transactions || []).length) root.insertAdjacentHTML('beforeend', '<div class="v1112-empty">تراکنشی ثبت نشده است.</div>');
        continue;
      }
      const rows = kind === 'budgets' ? V1112_DATA?.summary?.budgets || [] : f[kind] || [];
      if (kind === 'commitments' || kind === 'debts') {
        root.innerHTML = rows.map(row => `<div class="v1112-row"><div><b>${esc(row.title)}</b><small>${money(row.amount)} • ${esc(kind === 'debts' ? row.creditor || '' : row.direction === 'receive' ? 'دریافت' : 'پرداخت')} • ${esc(row.due_date || row.next_due || 'بدون موعد')}</small>${kind === 'debts' ? `<small>قسط: ${money(row.installment)}</small>` : ''}</div><div class="v1112-row-actions"><span class="v1112-state ${settled(row) ? 'good' : ''}">${settled(row) ? (row.direction === 'receive' ? 'دریافت شد' : 'پرداخت شد') : row.status === 'cancelled' ? 'لغوشده' : 'باز'}</span>${button('edit', kind, row.id, 'ویرایش')}${!settled(row) && row.status !== 'cancelled' ? button('pay', kind, row.id, row.direction === 'receive' ? 'دریافت شد' : 'پرداخت شد') : ''}${kind === 'commitments' && !settled(row) && row.status !== 'cancelled' ? button('task', kind, row.id, row.task_id ? 'کار متصل' : '＋ کار') + button('event', kind, row.id, row.event_id ? 'تقویم متصل' : 'تقویم') : ''}</div></div>`).join('') || '<div class="v1112-empty">هنوز موردی ثبت نشده است.</div>';
      } else root.querySelectorAll('.v1112-row').forEach((element, index) => element.insertAdjacentHTML('beforeend', button('edit', kind, rows[index].id, 'ویرایش')));
    }
  };
  window.v1112Toggle = (kind, show) => { if (show) open(({ budget: 'budgets', commit: 'commitments', tx: 'transactions' })[kind] || kind); else close(); };
  window.v1112DoneCommit = id => open('commitments', id, true);
  document.addEventListener('click', event => {
    const target = event.target.closest('[data-finance-action]'); if (!target) return;
    const { financeAction: action, kind, id } = target.dataset;
    if (action === 'task') return window.v1112CommitTask(id);
    if (action === 'event') return window.v1112CommitEvent(id);
    open(kind, action === 'add' ? '' : id, action === 'pay');
  });
  window.FinanceEditor = { open, close, get busy() { return busy; } };
})();
