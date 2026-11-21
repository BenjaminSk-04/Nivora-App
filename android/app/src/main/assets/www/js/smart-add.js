/* =====================================================================
   smart-add.js - quick-add parsing ("250 swiggy") and bank-SMS parsing.
   ===================================================================== */


/* ---- 1. Quick add, SMS paste, receipts ---- */
function parseQuick(t) {
  const m = String(t).match(/(?:₹|rs\.?\s*)?(\d[\d,]*(?:\.\d{1,2})?)/i);
  if (!m) return null;
  const amount = numOf(m[1]); if (!(amount > 0)) return null;
  const notes = String(t).replace(m[0], '').replace(/\s+/g, ' ').trim();
  return { amount, notes, category: autoCategorize(notes) };
}

function quickAddHTML() {
  return `<div class="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 space-y-2">
    <label class="text-sm font-semibold text-slate-700" for="qaInput">⚡ Quick add</label>
    <div class="flex gap-2">
      <input id="qaInput" placeholder="250 swiggy" onkeydown="if(event.key==='Enter'){event.preventDefault();quickAddSubmit()}" class="flex-1 min-w-0 px-3 py-2.5 border border-slate-300 rounded-lg"/>
      <button onclick="quickAddSubmit()" class="bg-teal-600 text-white font-semibold px-4 rounded-lg">Add</button>
    </div>
    <p class="text-xs text-slate-500">Type "250 swiggy" or paste a bank SMS. I pick the category.</p>
  </div>`;
}

function quickAddSubmit() {
  const el = $('#qaInput'); if (el && looksLikeSMS(el.value)) return openSmartAdd(el.value);
  const p = parseQuick(el ? el.value : '');
  if (!p) return toast('Start with an amount, e.g. "250 swiggy"', 'error');
  closeModal(); pushExpense({ amount:p.amount, category:p.category, notes:p.notes || p.category });
}

function parseSMS(t) {
  const debit = /\b(debited|spent|paid|sent|withdrawn|purchase|txn)\b/i.test(t);
  const credit = /\b(credited|received|deposited)\b/i.test(t) && !debit;
  const parts = t.split(/\b(?:avl|available|bal(?:ance)?)\b/i);
  const a = parts[0].match(/(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)/i);
  const b = t.match(/\b(?:avl\.?|available)?\s*bal(?:ance)?\.?\s*(?:is|:)?\s*(?:rs\.?|inr|₹)?\s*([\d,]+(?:\.\d{1,2})?)/i);
  const mer = t.match(/(?:\bat\b|\bto\b|\btowards\b|\binfo[:\-]?)\s+([A-Za-z0-9@._&\- ]{2,28}?)(?=\s+(?:on|ref|upi|avl|bal|using|via)\b|[.,]|$)/i);
  return { credit, amount: a ? numOf(a[1]) : NaN, balance: b ? numOf(b[1]) : NaN, notes: mer ? mer[1].trim() : '' };
}


/* ---- Smart add: one box for "250 swiggy" or a pasted bank SMS ---- */
function looksLikeSMS(t) { return /(debited|credited|a\/c|avl\.? ?bal|upi ref|\btxn\b)/i.test(t) || t.trim().length > 60; }

function smartParse(t) {
  t = String(t).trim(); if (!t) return null;
  if (looksLikeSMS(t)) {
    const r = parseSMS(t); if (!(r.amount > 0)) return null;
    const notes = r.notes || 'Bank SMS expense';
    return { amount:r.amount, notes, category:autoCategorize(notes), balance:r.balance, credit:r.credit, sms:true };
  }
  const q = parseQuick(t); return q ? { ...q, balance:NaN, credit:false, sms:false } : null;
}

function openSmartAdd(initial) {
  openModal('✨ Smart add', `<textarea id="smAdd" rows="3" class="${inCls}" placeholder="250 swiggy  —  or paste your bank SMS">${esc(initial || '')}</textarea>
    <div id="smPrev" class="mt-3"></div>
    <button id="smSave" disabled class="mt-3 w-full bg-teal-600 disabled:bg-slate-300 text-white font-semibold py-2.5 rounded-lg">Add expense</button>`, root => {
    const ta = root.querySelector('#smAdd'), prev = root.querySelector('#smPrev'), save = root.querySelector('#smSave'); let cat = null, last = null;
    const draw = () => {
      const p = last = smartParse(ta.value); save.disabled = true;
      if (!ta.value.trim()) { prev.innerHTML = '<p class="text-xs text-slate-500">Type an amount and what it was, or paste a bank message. I\'ll fill in the rest and you confirm.</p>'; return; }
      if (!p) { prev.innerHTML = '<p class="text-xs text-amber-700">Couldn\'t find an amount yet. Start with a number, like 250 swiggy.</p>'; return; }
      if (p.credit) { prev.innerHTML = '<p class="text-xs text-amber-700">This looks like money received, so it won\'t be added as an expense.</p>'; return; }
      const c = cat || p.category; save.disabled = false;
      prev.innerHTML = `<div class="rounded-xl bg-teal-50 border border-teal-200 p-3"><p class="text-2xl font-extrabold text-teal-800">${fmtINR2(p.amount)}</p>
        <p class="text-sm text-slate-700">${esc(p.notes || c)} ${p.sms ? '<span class="text-[10px] bg-white border rounded-full px-2 py-0.5 ml-1">from SMS</span>' : ''}</p>
        <div class="flex flex-wrap gap-1.5 mt-2">${CATEGORIES.map(k => `<button type="button" data-c="${k}" class="text-xs px-2.5 py-1 rounded-full border ${k === c ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-slate-600 border-slate-300'}">${CATEGORY_META[k].icon} ${k}</button>`).join('')}</div>
        ${p.sms && p.balance >= 0 ? `<label class="flex gap-2 items-center text-xs mt-2"><input type="checkbox" id="smBal" checked/> Also set my balance to ${fmtINR(p.balance)}</label>` : ''}</div>`;
      prev.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { cat = b.dataset.c; draw(); });
    };
    ta.oninput = draw; draw();
    save.onclick = () => {
      const p = last; if (!p || p.credit) return; const bal = root.querySelector('#smBal');
      if (bal && bal.checked) ext().balance = p.balance;
      closeModal(); pushExpense({ amount:p.amount, category:cat || p.category, notes:p.notes || p.category });
    };
    if (!initial) ta.focus();
  });
}
