/* =====================================================================
   bills.js - bills, safe-to-spend, balance forecast, low-balance alerts.
   ===================================================================== */


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
  state.expenses.push({ id:'exp_'+uid(), amount:b.amount, category:autoCategorize(b.title), date:todayISO(), notes:b.title, paidBy:ME, receipt:null, split:null });
  saveState(); render(); openBills();
}

function deleteBill(id) { ext().bills = ext().bills.filter(x => x.id !== id); saveState(); render(); openBills(); }

function checkLowBalance() {
  if (!isOnboarded()) return; const f = balanceForecast(), t = todayISO();
  if (!f || !f.breach || ext().alerted[t]) return;
  ext().alerted = { [t]: 1 }; saveState();
  const msg = `After ${f.breach.title} your balance may drop to about ${fmtINR(f.breach.bal)}.`;
  toast('⚠️ ' + msg, 'warning'); if (state.user.notifications) fireReminder('⚠️ Low balance ahead', msg);
}

setInterval(checkLowBalance, 60000); setTimeout(checkLowBalance, 1500);
