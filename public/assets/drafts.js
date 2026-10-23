(() => {
  'use strict';
  const prefix = 'noava.draft.v1:';
  const user = () => { try { return JSON.parse(localStorage.getItem('nova_user') || 'null')?.id || localStorage.getItem('molibden.account.id') || 'local-demo'; } catch { return 'local-demo'; } };
  const key = name => prefix + user() + ':' + name;
  function read(name) { try { const row = JSON.parse(localStorage.getItem(key(name)) || 'null'); return row && Date.now() - row.at < 30 * 86400000 ? row.value : null; } catch { return null; } }
  function write(name, value) { try { localStorage.setItem(key(name), JSON.stringify({ at: Date.now(), value })); return true; } catch { return false; } }
  function clear(name) { try { localStorage.removeItem(key(name)); } catch {} }
  function clearUser() { try { const start = prefix + user() + ':'; Object.keys(localStorage).filter(k => k.startsWith(start)).forEach(k => localStorage.removeItem(k)); } catch {} }
  function bind(root, name, options={}) {
    root._noavaDraft?.stop();
    const fields = () => [...root.querySelectorAll('input,textarea,select')].filter(n => (n.name || n.id) && !['password','file','hidden','submit','button'].includes(n.type) && !/password|token|secret/i.test(n.name || n.id));
    const snapshot = () => ({...Object.fromEntries(fields().map(n => [n.name || n.id, n.type === 'checkbox' ? n.checked : n.value])),...(options.extra?{_extra:JSON.parse(JSON.stringify(options.extra()))}:{})});
    const restore = value => { if(value?._extra)options.restoreExtra?.(value._extra);for (const n of fields()) { const v = value?.[n.name || n.id]; if (v === undefined) continue; if (n.type === 'checkbox') n.checked = !!v; else if (n.tagName !== 'SELECT' || [...n.options].some(o => o.value === String(v))) n.value = String(v); } };
    const initial = snapshot(), saved = read(name); if (saved) restore(saved);
    const note = document.createElement('p'); note.className = 'noava-draft-note'; note.setAttribute('role', 'status');
    note.textContent = saved ? 'پیش‌نویس قبلی بازیابی شد.' : 'پیش‌نویس به‌صورت خودکار در این مرورگر نگه داشته می‌شود.';
    const discard = document.createElement('button'); discard.type = 'button'; discard.textContent = 'پاک‌کردن پیش‌نویس';
    const save = () => { note.firstChild.textContent = write(name, snapshot()) ? 'پیش‌نویس ذخیره شد؛ هنوز ثبت نهایی نشده است. ' : 'ذخیرهٔ پیش‌نویس در مرورگر ممکن نیست. '; };
    const controller = { clear: () => clear(name), save, stop: () => { root.removeEventListener('input', save); root.removeEventListener('change', save); note.remove(); }, restore };
    discard.onclick = () => { clear(name); restore(initial); root.dispatchEvent(new Event('input')); clear(name); note.firstChild.textContent = 'پیش‌نویس پاک شد. '; };
    note.append(' ', discard); (root.querySelector('.modal')||root).append(note); root.addEventListener('input', save); root.addEventListener('change', save); root._noavaDraft = controller;
    return controller;
  }
  window.NoavaDrafts = { read, write, clear, clearUser, bind };
})();
