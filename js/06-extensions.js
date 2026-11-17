/* ===================== Nivora extensions (v1.6) ===================== */
state.ext = Object.assign({ balance:null, lowAt:1000, bills:[], caregiver:{name:'',phone:''}, upi:{}, alerted:{} }, state.ext || {});
const ext = () => state.ext;
const numOf = v => { const n = Number(String(v).replace(/,/g,'')); return Number.isFinite(n) ? n : NaN; };
const catOptions = sel => CATEGORIES.map(c => `<option value="${c}" ${c===sel?'selected':''}>${CATEGORY_META[c].icon} ${c}</option>`).join('');
const inCls = 'mt-1 w-full px-3 py-2.5 border border-slate-300 rounded-lg';
function pushExpense(o) {
  state.expenses.push({ id:'exp_'+uid(), receipt:null, split:null, paidBy:'Aarav', date:todayISO(), ...o });
  saveState();
  const over = categorySpentThisMonth()[o.category] > (state.budgets[o.category] || Infinity);
  toast(over ? `Added ${fmtINR(o.amount)} — over your ${o.category} budget` : `Added ${fmtINR(o.amount)} · ${o.category}`, over ? 'warning' : 'success');
  render();
}

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
function receiptBtnHTML(e) {
  return e.receipt ? `<button onclick="viewReceipt('${e.id}')" class="p-1.5 rounded hover:bg-slate-100" aria-label="View receipt">🧾</button>`
                   : `<button onclick="attachReceipt('${e.id}')" class="p-1.5 rounded hover:bg-slate-100" aria-label="Attach receipt">📎</button>`;
}
function attachReceipt(id) {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
  inp.onchange = () => {
    const f = inp.files[0]; if (!f) return;
    const img = new Image(), url = URL.createObjectURL(f);
    img.onload = () => {
      const s = Math.min(1, 900 / Math.max(img.width, img.height)), c = document.createElement('canvas');
      c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
      let d = c.toDataURL('image/jpeg', .6); if (d.length > 250000) d = c.toDataURL('image/jpeg', .4);
      if (d.length > 400000) return toast('Image is too large to store. Try a closer crop', 'error');
      const e = state.expenses.find(x => x.id === id); if (!e) return;
      e.receipt = d; saveState(); render(); toast('Receipt attached', 'success');
    };
    img.onerror = () => toast('Could not read that image', 'error'); img.src = url;
  };
  inp.click();
}
function viewReceipt(id) {
  const e = state.expenses.find(x => x.id === id); if (!e || !e.receipt) return;
  openModal('Receipt', `<img src="${esc(e.receipt)}" alt="Receipt" class="w-full rounded-lg border"/>
    <button onclick="removeReceipt('${id}')" class="mt-3 w-full border border-red-300 text-red-600 py-2.5 rounded-lg">Remove receipt</button>`);
}
function removeReceipt(id) { const e = state.expenses.find(x => x.id === id); if (e) { e.receipt = null; saveState(); closeModal(); render(); } }

/* ---- 2. Safe to spend + low-balance forecast ---- */
function unpaidBills() { const mk = thisMonthKey(); return ext().bills.filter(b => b.paidMonth !== mk); }
function safeToSpend() {
  const b = totalBudget(); if (!(b > 0)) return null;
  const now = new Date(), left = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate() + 1;
  const today = state.expenses.filter(e => e.date === todayISO()).reduce((s, e) => s + myShare(e), 0);
  const pool = b - totalSpentThisMonth() - unpaidBills().reduce((s, x) => s + x.amount, 0);
  const perDay = Math.max(0, pool + today) / left;
  return { pool, perDay, left, remainingToday: Math.max(0, perDay - today), over: pool < 0 };
}
function nextDue(b) {
  const now = new Date(), y = now.getFullYear(), m = now.getMonth();
  const at = (yy, mm) => new Date(yy, mm, Math.min(b.dueDay, new Date(yy, mm + 1, 0).getDate()));
  return b.paidMonth === thisMonthKey() ? at(y, m + 1) : at(y, m);
}
function balanceForecast() {
  const e = ext(); if (e.balance == null) return null;
  const end = new Date(); end.setDate(end.getDate() + 30);
  const due = e.bills.map(b => ({ b, d: nextDue(b) })).filter(x => x.d <= end).sort((a, b) => a.d - b.d);
  let run = e.balance, breach = null;
  for (const x of due) { run -= x.b.amount; if (run < e.lowAt && !breach) breach = { title:x.b.title, date:x.d, bal:run }; }
  return { projected: run, breach };
}
function moneyCardsHTML() {
  const s = safeToSpend(), f = balanceForecast(), e = ext();
  const dm = d => d.toLocaleDateString('en-IN', { day:'numeric', month:'short' });
  const safe = s ? `<div class="rounded-2xl p-5 border ${s.over ? 'bg-red-50 border-red-200' : 'bg-white border-slate-100'} shadow-sm">
      <p class="text-sm font-semibold text-slate-500 uppercase tracking-wide">Safe to spend today</p>
      <p class="text-3xl font-extrabold mt-1 ${s.over ? 'text-red-600' : 'text-teal-700'}">${fmtINR(s.remainingToday)}</p>
      <p class="text-xs text-slate-500 mt-1">${s.over ? 'Budget and unpaid bills already exceed your limit.' : `≈ ${fmtINR(s.perDay)}/day for ${s.left} day${s.left > 1 ? 's' : ''}, after unpaid bills`}</p></div>` : '';
  const bal = f ? `<div class="rounded-2xl p-4 border ${f.breach ? 'bg-amber-50 border-amber-300' : 'bg-white border-slate-100'} shadow-sm flex items-start justify-between gap-3">
      <div><p class="font-bold text-slate-900">${f.breach ? '⚠️ Balance may run low' : '✓ Balance looks fine'}</p>
      <p class="text-xs text-slate-600 mt-1">${f.breach ? `After ${esc(f.breach.title)} on ${dm(f.breach.date)} you'd have about ${fmtINR(f.breach.bal)} (alert level ${fmtINR(e.lowAt)}).` : `About ${fmtINR(f.projected)} left after bills due in the next 30 days.`}</p></div>
      <button onclick="openBills()" class="text-xs font-semibold text-teal-700 whitespace-nowrap">Edit</button></div>`
    : `<button onclick="openBills()" class="w-full text-left rounded-2xl p-4 border border-dashed border-slate-300 bg-white text-sm text-slate-600">💳 Add your balance and bills (rent, WiFi…) to get low-balance warnings <span class="text-teal-700 font-semibold">→</span></button>`;
  return `<div class="space-y-3">${safe}${bal}</div>`;
}
function openBills() {
  const e = ext();
  openModal('Balance & bills', `<form id="billForm" class="space-y-3">
    <div class="grid grid-cols-2 gap-3">
      <label class="block text-sm font-medium">Current balance (₹)<input name="balance" type="number" step="0.01" value="${e.balance ?? ''}" class="${inCls}"/></label>
      <label class="block text-sm font-medium">Warn below (₹)<input name="lowAt" type="number" min="0" value="${e.lowAt}" class="${inCls}"/></label>
    </div>
    <p class="text-sm font-semibold text-slate-700 pt-1">Recurring bills</p>
    ${e.bills.length ? `<ul class="divide-y border rounded-lg">${e.bills.map(b => `<li class="p-3 flex items-center justify-between gap-2 text-sm">
      <span class="min-w-0"><strong>${esc(b.title)}</strong> · ${fmtINR(b.amount)} · day ${b.dueDay}</span>
      <span class="flex gap-1 flex-shrink-0">${b.paidMonth === thisMonthKey() ? '<span class="text-xs text-teal-700 px-2">Paid ✓</span>' : `<button type="button" onclick="markBillPaid('${b.id}')" class="text-xs bg-teal-600 text-white px-2 py-1 rounded">Paid</button>`}
      <button type="button" onclick="deleteBill('${b.id}')" class="text-xs px-1" aria-label="Delete bill">🗑️</button></span></li>`).join('')}</ul>` : '<p class="text-xs text-slate-500">No bills yet.</p>'}
    <div class="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
      <p class="text-sm font-semibold text-slate-700">➕ Add a bill</p>
      <div class="flex gap-2 flex-wrap">${['Rent','WiFi','Electricity','Water'].map(n => `<button type="button" onclick="document.getElementById('billName').value='${n}'" class="text-xs px-3 py-1 rounded-full bg-white border border-slate-300">${n}</button>`).join('')}</div>
      <label class="block text-sm font-medium">Bill name<input id="billName" name="bt" placeholder="e.g. Rent" class="${inCls}"/></label>
      <div class="grid grid-cols-2 gap-3">
        <label class="block text-sm font-medium">Amount (₹)<input name="ba" type="number" min="1" placeholder="e.g. 8000" class="${inCls}"/></label>
        <label class="block text-sm font-medium">Due date (day of month)<input name="bd" type="number" min="1" max="31" placeholder="e.g. 5" class="${inCls}"/></label>
      </div>
      <p class="text-xs text-slate-500">Repeats every month on that day.</p>
    </div>
    <button class="w-full bg-teal-600 text-white font-semibold py-2.5 rounded-lg">Save</button></form>`, root => {
    root.querySelector('#billForm').onsubmit = ev => {
      ev.preventDefault(); const fd = new FormData(ev.target);
      const bal = fd.get('balance'); e.balance = bal === '' ? null : numOf(bal);
      e.lowAt = Math.max(0, numOf(fd.get('lowAt')) || 0);
      const t = String(fd.get('bt')).trim(), a = numOf(fd.get('ba')), d = Math.round(numOf(fd.get('bd')));
      if (t || fd.get('ba') || fd.get('bd')) {
        if (!t || !(a > 0) || !(d >= 1 && d <= 31)) return toast('Bill needs a name, amount and due day (1–31)', 'error');
        e.bills.push({ id:'bill_'+uid(), title:t, amount:a, dueDay:d, paidMonth:null });
      }
      saveState(); closeModal(); render(); toast('Saved', 'success');
    };
  });
}
function markBillPaid(id) {
  const b = ext().bills.find(x => x.id === id); if (!b) return;
  b.paidMonth = thisMonthKey();
  if (ext().balance != null) ext().balance -= b.amount;
  state.expenses.push({ id:'exp_'+uid(), amount:b.amount, category:autoCategorize(b.title), date:todayISO(), notes:b.title, paidBy:'Aarav', receipt:null, split:null });
  saveState(); render(); openBills();
}
function deleteBill(id) { ext().bills = ext().bills.filter(x => x.id !== id); saveState(); render(); openBills(); }
function checkLowBalance() {
  if (!currentUser) return; const f = balanceForecast(), t = todayISO();
  if (!f || !f.breach || ext().alerted[t]) return;
  ext().alerted = { [t]: 1 }; saveState();
  const msg = `After ${f.breach.title} your balance may drop to about ${fmtINR(f.breach.bal)}.`;
  toast('⚠️ ' + msg, 'warning'); if (state.user.notifications) fireReminder('⚠️ Low balance ahead', msg);
}
setInterval(checkLowBalance, 60000); setTimeout(checkLowBalance, 1500);

/* ---- 3. Roommate splits: percent / shares, UPI link, reminders ---- */
function splitShares(amount, mode, w) {
  const n = w.length, tot = mode === 'equal' ? n : w.reduce((s, x) => s + x, 0), out = [];
  let used = 0;
  w.forEach((x, i) => {
    const v = i === n - 1 ? Math.round((amount - used) * 100) / 100 : Math.round(amount * (mode === 'equal' ? 1 : x) / tot * 100) / 100;
    out.push(v); used += v;
  });
  return out;
}
function openSplitExpense() {
  openModal('Add shared expense', `<form id="spForm" class="space-y-3">
    <label class="block text-sm font-medium">Amount (₹)<input name="amount" type="number" step="0.01" min="1" required class="${inCls}"/></label>
    <label class="block text-sm font-medium">Notes<input name="notes" class="${inCls}" placeholder="e.g. Electricity bill"/></label>
    <div class="grid grid-cols-2 gap-3">
      <label class="block text-sm font-medium">Category<select name="category" class="${inCls}">${catOptions('Other')}</select></label>
      <label class="block text-sm font-medium">Paid by<select name="paidBy" class="${inCls}">${FLAT_MEMBERS.map(m => `<option>${m}</option>`).join('')}</select></label>
    </div>
    <label class="block text-sm font-medium">Split<select name="mode" id="spMode" class="${inCls}">
      <option value="equal">Equally</option><option value="percent">By percentage</option><option value="shares">By shares</option></select></label>
    <div id="spRows" class="hidden grid grid-cols-3 gap-2">${FLAT_MEMBERS.map(m => `<label class="text-xs font-medium">${m}<input data-w type="number" step="0.01" min="0" class="${inCls}"/></label>`).join('')}</div>
    <p id="spHint" class="text-xs text-slate-500"></p>
    <button class="w-full bg-teal-600 text-white font-semibold py-2.5 rounded-lg">Save shared expense</button></form>`, root => {
    const mode = root.querySelector('#spMode'), rows = root.querySelector('#spRows'), hint = root.querySelector('#spHint');
    const sync = () => {
      rows.classList.toggle('hidden', mode.value === 'equal');
      root.querySelectorAll('[data-w]').forEach(i => i.value = mode.value === 'percent' ? (100 / FLAT_MEMBERS.length).toFixed(2) : mode.value === 'shares' ? 1 : '');
      hint.textContent = mode.value === 'percent' ? 'Percentages must add up to 100.' : mode.value === 'shares' ? 'e.g. 2 shares for someone who uses twice as much.' : '';
    };
    mode.onchange = sync; sync();
    root.querySelector('#spForm').onsubmit = ev => {
      ev.preventDefault(); const fd = new FormData(ev.target), amount = Number(fd.get('amount')), m = fd.get('mode');
      const w = m === 'equal' ? FLAT_MEMBERS.map(() => 1) : [...root.querySelectorAll('[data-w]')].map(i => Number(i.value) || 0);
      if (!(amount > 0)) return toast('Enter an amount greater than 0', 'error');
      if (m === 'percent' && Math.abs(w.reduce((s, x) => s + x, 0) - 100) > 0.01) return toast('Percentages must add up to 100', 'error');
      if (m === 'shares' && !(w.reduce((s, x) => s + x, 0) > 0)) return toast('Give at least one person a share', 'error');
      const sh = splitShares(amount, m, w), shares = {}; FLAT_MEMBERS.forEach((n, i) => shares[n] = sh[i]);
      if (Object.values(shares).some(v => v < 0)) return toast('Shares cannot be negative', 'error');
      const notes = String(fd.get('notes')).trim();
      closeModal();
      state.expenses.push({ id:'exp_'+uid(), amount, category:fd.get('category'), date:todayISO(), notes, paidBy:fd.get('paidBy'), receipt:null, split:{ members:FLAT_MEMBERS, mode:m, shares } });
      saveState(); render(); toast('Shared expense added', 'success');
    };
  });
}
function settleExtraHTML(s) {
  const b = 'class="text-xs font-medium border border-slate-300 text-slate-700 px-2 py-1 rounded"';
  if (s.from === 'Aarav') return `<button onclick="payUPI('${s.to}',${s.amount})" ${b}>Pay via UPI</button>`;
  if (s.to === 'Aarav') return `<button onclick="remindOwes('${s.from}',${s.amount})" ${b}>Remind</button>`;
  return '';
}
function openUpiId(name, cb) {
  openModal(`${name}'s UPI ID`, `<form id="upiForm" class="space-y-3"><input name="u" value="${esc(ext().upi[name] || '')}" placeholder="name@bank" class="${inCls}"/>
    <button class="w-full bg-teal-600 text-white font-semibold py-2.5 rounded-lg">Save</button></form>`, root => {
    root.querySelector('#upiForm').onsubmit = ev => {
      ev.preventDefault(); const u = String(new FormData(ev.target).get('u')).trim();
      if (!/^[\w.\-]{2,}@[\w.\-]{2,}$/.test(u)) return toast('Enter a valid UPI ID like name@bank', 'error');
      ext().upi[name] = u; saveState(); closeModal(); if (cb) cb();
    };
  });
}
function payUPI(to, amount) {
  const id = ext().upi[to]; if (!id) return openUpiId(to, () => payUPI(to, amount));
  toast('Opening your UPI app. Tap "Mark paid" after paying.', 'info');
  location.href = `upi://pay?pa=${encodeURIComponent(id)}&pn=${encodeURIComponent(to)}&am=${amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent('Flat 302 split')}`;
}
function remindOwes(from, amount) {
  const text = `Hi ${from}! Friendly nudge: ${fmtINR2(amount)} is pending for our flat expenses. No rush, pay whenever convenient 🙂`;
  if (navigator.share) navigator.share({ text }).catch(() => {});
  else window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
}

/* ---- 4. Medicines: stock countdown, caregiver alerts, doctor report ---- */
const dosesPerDay = m => (m.times || []).length * (m.frequency === 'alternate' ? .5 : m.frequency === 'weekly' ? 1 / 7 : 1);
function stockLineHTML(m) {
  const pd = dosesPerDay(m), days = pd ? Math.floor(m.stock / pd) : null;
  const low = days !== null && days <= 5;
  return `<p class="text-xs mt-1 ${low ? 'text-amber-700 font-semibold' : 'text-slate-500'}">📦 ${m.stock} left${days !== null ? ` · lasts about ${days} day${days === 1 ? '' : 's'} (to ${fmtDay(daysAgoISO(-days))})` : ''}
    <button onclick="restockMed('${m.id}')" class="ml-1 text-teal-700 font-semibold">+ Restock</button></p>`;
}
function restockMed(id) {
  const m = state.medicines.find(x => x.id === id); if (!m) return;
  openModal(`Restock ${m.name}`, `<form id="rsForm" class="space-y-3"><label class="block text-sm font-medium">Units added<input name="n" type="number" min="1" value="30" class="${inCls}"/></label>
    <button class="w-full bg-teal-600 text-white font-semibold py-2.5 rounded-lg">Add stock</button></form>`, root => {
    root.querySelector('#rsForm').onsubmit = ev => {
      ev.preventDefault(); const n = Math.floor(numOf(new FormData(ev.target).get('n')));
      if (!(n > 0)) return toast('Enter a number above 0', 'error');
      m.stock += n; saveState(); closeModal(); render(); toast('Stock updated', 'success');
    };
  });
}
function lateDoses() {
  const now = new Date(), nm = now.getHours() * 60 + now.getMinutes();
  return todaysDoses().filter(d => { const [h, mi] = d.time.split(':').map(Number); return d.status === 'pending' && nm - (h * 60 + mi) >= 60; });
}
function caregiverCardHTML() {
  const c = ext().caregiver, late = lateDoses();
  return `<div class="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 space-y-2">
    <div class="flex items-center justify-between"><h3 class="font-semibold text-slate-900">👨‍👩‍👧 Caregiver alerts</h3>
      <button onclick="openCaregiver()" class="text-xs font-semibold text-teal-700">${c.phone ? 'Edit' : 'Set up'}</button></div>
    <p class="text-xs text-slate-500">${c.phone ? `Alerts go to ${esc(c.name || 'your caregiver')}. You tap send, as browsers can't text in the background.` : 'Add a contact to message when a dose is skipped or very late.'}</p>
    ${c.phone && late.length ? `<button onclick="caregiverPrompt(null,null)" class="w-full bg-amber-100 text-amber-900 text-sm font-semibold py-2 rounded-lg">${late.length} dose${late.length > 1 ? 's' : ''} over 1 hour late · Notify</button>` : ''}
    <button onclick="openAdherenceReport()" class="w-full border border-slate-300 text-slate-700 text-sm font-semibold py-2 rounded-lg">📄 Doctor-ready adherence report</button></div>`;
}
function openCaregiver() {
  const c = ext().caregiver;
  openModal('Caregiver contact', `<form id="cgForm" class="space-y-3">
    <label class="block text-sm font-medium">Name<input name="n" value="${esc(c.name)}" class="${inCls}"/></label>
    <label class="block text-sm font-medium">Phone (with country code)<input name="p" type="tel" value="${esc(c.phone)}" placeholder="+919876543210" class="${inCls}"/></label>
    <button class="w-full bg-teal-600 text-white font-semibold py-2.5 rounded-lg">Save</button></form>`, root => {
    root.querySelector('#cgForm').onsubmit = ev => {
      ev.preventDefault(); const fd = new FormData(ev.target), p = String(fd.get('p')).replace(/[\s\-()]/g, '');
      if (p && !/^\+?\d{8,15}$/.test(p)) return toast('Enter a valid phone number', 'error');
      ext().caregiver = { name:String(fd.get('n')).trim(), phone:p }; saveState(); closeModal(); render();
    };
  });
}
function caregiverPrompt(med, time) {
  const c = ext().caregiver;
  if (!c.phone) return toast('Tip: add a caregiver in Health to get skip alerts', 'info');
  const items = med ? [`${med.name} (${fmtTime12(time)})`] : lateDoses().map(d => `${d.med.name} (${fmtTime12(d.time)})`);
  const msg = `Hi ${c.name || ''}, ${state.user.name} has ${med ? 'skipped' : 'not yet taken'}: ${items.join(', ')}. Could you check in? (via Nivora)`;
  openModal('Notify caregiver?', `<p class="text-sm text-slate-600 mb-3">${esc(msg)}</p><div class="grid grid-cols-2 gap-2">
    <a href="sms:${esc(c.phone)}?body=${encodeURIComponent(msg)}" onclick="closeModal()" class="text-center bg-teal-600 text-white font-semibold py-2.5 rounded-lg">SMS</a>
    <a href="https://wa.me/${esc(c.phone.replace('+', ''))}?text=${encodeURIComponent(msg)}" target="_blank" rel="noopener" onclick="closeModal()" class="text-center bg-green-600 text-white font-semibold py-2.5 rounded-lg">WhatsApp</a></div>
    <button onclick="closeModal()" class="mt-2 w-full border py-2.5 rounded-lg">Not now</button>`);
}
function openAdherenceReport() {
  const now = new Date(), nm = now.getHours() * 60 + now.getMinutes();
  const rows = state.medicines.map(m => {
    let due = 0, taken = 0, skipped = 0;
    for (let i = 0; i < 30; i++) {
      const d = daysAgoISO(i); if (!isDoseDue(m, d)) continue;
      for (const t of m.times) {
        const [h, mi] = t.split(':').map(Number); if (i === 0 && nm < h * 60 + mi) continue;
        due++; const s = m.log?.[d]?.[t]; if (s === 'taken') taken++; else if (s === 'skipped') skipped++;
      }
    }
    return `<tr><td>${esc(m.name)}<br><small>${esc(m.salt || '')} · ${esc(m.dosage || '')}</small></td><td>${m.times.map(fmtTime12).join(', ')}</td><td>${taken}/${due}</td><td>${skipped}</td><td>${due - taken - skipped}</td><td><b>${due ? Math.round(taken / due * 100) : 0}%</b></td></tr>`;
  }).join('');
  const w = window.open('', '_blank'); if (!w) return toast('Allow pop-ups to open the report', 'warning');
  w.document.write(`<!doctype html><title>Adherence report</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font:14px Inter,system-ui,sans-serif;margin:24px;color:#0f172a}table{border-collapse:collapse;width:100%}td,th{border:1px solid #cbd5e1;padding:6px 8px;text-align:left;vertical-align:top}th{background:#f1f5f9}small{color:#64748b}</style>
    <h2>Medication adherence report</h2><p>${esc(state.user.name)} · last 30 days · generated ${now.toLocaleDateString('en-IN')}</p>
    <table><tr><th>Medicine</th><th>Schedule</th><th>Taken</th><th>Skipped</th><th>Missed</th><th>Adherence</th></tr>${rows || '<tr><td colspan=6>No medicines</td></tr>'}</table>
    <p><small>Self-reported in Nivora. Not a medical record. Please discuss any changes with your doctor.</small></p>`);
  w.document.close(); w.focus(); setTimeout(() => w.print(), 400);
}

/* ---- 5. Generic comparison helpers ---- */
function genMatch(g, q) { const hay = `${g.salt} ${g.brand} ${g.jakBrand}`.toLowerCase(); return q.split(/\s+/).every(w => hay.includes(w)); }
function monthlySavingHTML(g, savings) {
  const w = g.salt.toLowerCase().split(/\s+/)[0];
  const med = state.medicines.find(m => `${m.salt} ${m.name}`.toLowerCase().includes(w));
  const pd = med ? dosesPerDay(med) || 1 : 1, qty = parseInt(g.pack);
  const packs = /inhaler|bottle|syrup|tube|drop/i.test(g.pack) || !qty ? 1 : Math.ceil(pd * 30 / qty);
  return `<div><p class="text-xs text-teal-700 font-semibold">Save ${fmtINR(savings)} / pack</p>
    <p class="text-xs text-teal-800">≈ ${fmtINR(savings * packs)}/month${med ? ` on your ${esc(med.name)}` : ' if taken once daily'}</p>
    <p class="text-[10px] text-amber-700 mt-0.5">Confirm with your doctor or pharmacist before switching.</p></div>`;
}


