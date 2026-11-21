/* =====================================================================
   splits.js - shared expenses: balances, settle-up, flatmates/group, UPI pay & remind.
   ===================================================================== */


function computeBalances(expenses, members) {
  // Union with everyone who actually appears in a historical split, so a flatmate who was
  // later removed from the group doesn't silently vanish from (or corrupt) past balances.
  const all = new Set(members);
  for (const e of expenses) if (e.split) for (const m of e.split.members) all.add(m);
  const bal = Object.fromEntries([...all].map(m => [m, 0]));
  for (const e of expenses) {
    if (!e.split) continue;
    for (const m of e.split.members) bal[m] = (bal[m] || 0) - (e.split.shares[m] || 0);
    bal[e.paidBy] = (bal[e.paidBy] || 0) + e.amount;
  }
  for (const k of Object.keys(bal)) bal[k] = Number(bal[k].toFixed(2));
  return bal;
}

function settleUp(balances) {
  const creds = Object.entries(balances).filter(([,v]) => v > 0.01).map(([n,v]) => ({ n, v })).sort((a,b) => b.v - a.v);
  const debts = Object.entries(balances).filter(([,v]) => v < -0.01).map(([n,v]) => ({ n, v: -v })).sort((a,b) => b.v - a.v);
  const txns = [];
  let i = 0, j = 0;
  while (i < creds.length && j < debts.length) {
    const amt = Math.min(creds[i].v, debts[j].v);
    if (amt > 0.01) txns.push({ from: debts[j].n, to: creds[i].n, amount: Number(amt.toFixed(2)) });
    creds[i].v -= amt; debts[j].v -= amt;
    if (creds[i].v < 0.01) i++;
    if (debts[j].v < 0.01) j++;
  }
  return txns;
}


views['/splits'] = () => {
  if (!state.flatmates.length) {
    return `
    <h1 class="text-2xl md:text-3xl font-extrabold text-slate-900 mb-4">Money</h1>
    ${tabBar('/splits', MONEY_TABS)}
    <div class="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 text-center space-y-3">
      <p class="text-4xl">🏠</p>
      <h2 class="font-bold text-slate-900">Add your flatmates to start splitting bills</h2>
      <p class="text-sm text-slate-500">Once you add the people you share expenses with, you can split rent, groceries and bills and keep track of who owes whom.</p>
      <button onclick="openManageGroup()" class="bg-teal-600 hover:bg-teal-700 text-white font-semibold px-5 py-2.5 rounded-xl">+ Add flatmates</button>
    </div>`;
  }

  const gExps = state.expenses.filter(e => e.split).sort((a,b) => b.date.localeCompare(a.date));
  const balances = computeBalances(gExps, membersList());
  const settlements = settleUp(balances);
  const myBalance = balances[ME] || 0;

  return `
  <h1 class="text-2xl md:text-3xl font-extrabold text-slate-900 mb-4">Money</h1>
  ${tabBar('/splits', MONEY_TABS)}
  <div class="space-y-4">
    <div class="bg-gradient-to-br from-indigo-600 to-indigo-700 text-white rounded-2xl p-5">
      <div class="flex items-center justify-between mb-3">
        <div>
          <p class="text-xs uppercase opacity-80 font-semibold tracking-wide">Group</p>
          <h2 class="text-xl font-extrabold">🏠 ${esc(state.groupName || 'Shared expenses')}</h2>
        </div>
        <button onclick="openManageGroup()" class="text-xs font-medium bg-white/20 hover:bg-white/30 rounded-lg px-2.5 py-1.5">Manage</button>
      </div>
      <p class="text-sm opacity-90">${myBalance >= 0 ? 'You are owed' : 'You owe'}</p>
      <p class="text-3xl font-extrabold mt-1">${fmtINR2(Math.abs(myBalance))}</p>
    </div>

    <div class="grid grid-cols-3 gap-3">
      ${membersList().map(m => {
        const b = balances[m] || 0;
        const isMe = m === ME;
        const color = b > 0.01 ? 'text-teal-700' : b < -0.01 ? 'text-red-600' : 'text-slate-500';
        return `<div class="bg-white rounded-xl p-3 shadow-sm border ${isMe ? 'border-teal-300' : 'border-slate-100'} text-center">
          <p class="text-xs font-semibold text-slate-500">${esc(nameOf(m))}</p>
          <p class="font-extrabold text-lg ${color} mt-1">${b > 0 ? '+' : ''}${fmtINR(Math.abs(b))}</p>
          <p class="text-[10px] text-slate-400">${b > 0 ? 'owed' : b < 0 ? 'owes' : 'settled'}</p>
        </div>`;
      }).join('')}
    </div>

    ${settlements.length ? `<div class="bg-white rounded-2xl shadow-sm border border-slate-100">
      <div class="p-4 border-b border-slate-100">
        <h2 class="font-bold text-slate-900">Settle up</h2>
      </div>
      <ul class="divide-y divide-slate-100">
        ${settlements.map((s,i) => `<li class="p-4 flex flex-wrap items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            <div class="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold">${esc(nameOf(s.from)[0])}</div>
            <span class="text-slate-500 text-sm">→</span>
            <div class="w-7 h-7 rounded-full bg-teal-200 flex items-center justify-center text-xs font-bold text-teal-800">${esc(nameOf(s.to)[0])}</div>
            <span class="text-sm text-slate-700 ml-1">${esc(nameOf(s.from))} pays ${esc(nameOf(s.to))}</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="font-bold text-slate-900">${fmtINR2(s.amount)}</span>
            ${settleExtraHTML(s)}<button onclick="markSettled('${esc(s.from)}','${esc(s.to)}',${s.amount})" class="text-xs font-medium bg-teal-600 text-white px-2 py-1 rounded">Mark paid</button>
          </div>
        </li>`).join('')}
      </ul>
    </div>` : `<div class="bg-teal-50 border border-teal-200 rounded-2xl p-4 text-center text-teal-800 font-medium">✓ All settled up</div>`}

    <button onclick="openSplitExpense()" class="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold py-3 rounded-xl">+ Add shared expense</button>
  </div>`;
};


function markSettled(from, to, amount) {
  openModal('Mark settled?', `
    <p class="text-slate-600 mb-4">${from} pays ${to} <strong>${fmtINR2(amount)}</strong>.</p>
    <div class="flex gap-2">
      <button onclick="closeModal()" class="flex-1 border py-2.5 rounded-lg">Cancel</button>
      <button onclick="confirmSettle('${from}','${to}',${amount})" class="flex-1 bg-teal-600 text-white font-semibold py-2.5 rounded-lg">Confirm</button>
    </div>`);
}


function confirmSettle(from, to, amount) {
  state.expenses.push({
    id: 'exp_'+uid(), amount, category:'Other', date:todayISO(),
    notes:`Settlement: ${from} → ${to}`, paidBy: from, receipt:null, settlement:true,
    split: { members: [from, to], mode:'exact', shares: { [from]: 0, [to]: amount } }
  });
  saveState(); closeModal(); render(); toast('Settlement recorded ✓','success');
}


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
  if (!state.flatmates.length) return openManageGroup();
  const members = membersList();
  openModal('Add shared expense', `<form id="spForm" class="space-y-3">
    <label class="block text-sm font-medium">Amount (₹)<input name="amount" type="number" step="0.01" min="1" required class="${inCls}"/></label>
    <label class="block text-sm font-medium">Notes<input name="notes" class="${inCls}" placeholder="e.g. Electricity bill"/></label>
    <div class="grid grid-cols-2 gap-3">
      <label class="block text-sm font-medium">Category<select name="category" class="${inCls}">${catOptions('Other')}</select></label>
      <label class="block text-sm font-medium">Paid by<select name="paidBy" class="${inCls}">${members.map(m => `<option value="${esc(m)}">${esc(nameOf(m))}</option>`).join('')}</select></label>
    </div>
    <label class="block text-sm font-medium">Split<select name="mode" id="spMode" class="${inCls}">
      <option value="equal">Equally</option><option value="percent">By percentage</option><option value="shares">By shares</option></select></label>
    <div id="spRows" class="hidden grid grid-cols-3 gap-2">${members.map(m => `<label class="text-xs font-medium">${esc(nameOf(m))}<input data-w type="number" step="0.01" min="0" class="${inCls}"/></label>`).join('')}</div>
    <p id="spHint" class="text-xs text-slate-500"></p>
    <button class="w-full bg-teal-600 text-white font-semibold py-2.5 rounded-lg">Save shared expense</button></form>`, root => {
    const mode = root.querySelector('#spMode'), rows = root.querySelector('#spRows'), hint = root.querySelector('#spHint');
    const sync = () => {
      rows.classList.toggle('hidden', mode.value === 'equal');
      root.querySelectorAll('[data-w]').forEach(i => i.value = mode.value === 'percent' ? (100 / members.length).toFixed(2) : mode.value === 'shares' ? 1 : '');
      hint.textContent = mode.value === 'percent' ? 'Percentages must add up to 100.' : mode.value === 'shares' ? 'e.g. 2 shares for someone who uses twice as much.' : '';
    };
    mode.onchange = sync; sync();
    root.querySelector('#spForm').onsubmit = ev => {
      ev.preventDefault(); const fd = new FormData(ev.target), amount = Number(fd.get('amount')), m = fd.get('mode');
      const w = m === 'equal' ? members.map(() => 1) : [...root.querySelectorAll('[data-w]')].map(i => Number(i.value) || 0);
      if (!(amount > 0)) return toast('Enter an amount greater than 0', 'error');
      if (m === 'percent' && Math.abs(w.reduce((s, x) => s + x, 0) - 100) > 0.01) return toast('Percentages must add up to 100', 'error');
      if (m === 'shares' && !(w.reduce((s, x) => s + x, 0) > 0)) return toast('Give at least one person a share', 'error');
      const sh = splitShares(amount, m, w), shares = {}; members.forEach((n, i) => shares[n] = sh[i]);
      if (Object.values(shares).some(v => v < 0)) return toast('Shares cannot be negative', 'error');
      const notes = String(fd.get('notes')).trim();
      closeModal();
      state.expenses.push({ id:'exp_'+uid(), amount, category:fd.get('category'), date:todayISO(), notes, paidBy:fd.get('paidBy'), receipt:null, split:{ members, mode:m, shares } });
      saveState(); render(); toast('Shared expense added', 'success');
    };
  });
}


/* ---------- Manage group: group name + flatmates (Splits screen "Manage" button) ---------- */
function flatmateRowsHTML() {
  if (!state.flatmates.length) return `<p class="text-xs text-slate-400">No flatmates added yet.</p>`;
  return `<ul class="space-y-1.5">${state.flatmates.map((m, i) => `
    <li class="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2">
      <span class="text-sm text-slate-800">${esc(m)}</span>
      <button type="button" onclick="removeFlatmate(${i})" class="text-xs font-medium text-red-600 hover:text-red-700">Remove</button>
    </li>`).join('')}</ul>`;
}

function openManageGroup() {
  openModal('Manage group', `
    <label class="block text-sm font-medium mb-3">Group name<input id="groupNameInput" value="${esc(state.groupName || '')}" placeholder="e.g. Flat 302" class="${inCls}"/></label>
    <div class="mb-3">
      <span class="text-sm font-medium">Flatmates</span>
      <div id="flatmateList" class="mt-1.5 mb-2">${flatmateRowsHTML()}</div>
      <form id="addFlatmateForm" class="flex gap-2">
        <input id="newFlatmateName" placeholder="Add a flatmate's name" maxlength="30" class="${inCls} flex-1"/>
        <button type="submit" class="bg-teal-600 text-white font-semibold px-4 rounded-lg">Add</button>
      </form>
    </div>
    <button type="button" onclick="saveGroupName()" class="w-full bg-teal-600 text-white font-semibold py-2.5 rounded-lg">Done</button>
  `, root => {
    root.querySelector('#addFlatmateForm').addEventListener('submit', ev => {
      ev.preventDefault();
      addFlatmate(root.querySelector('#newFlatmateName').value);
      root.querySelector('#flatmateList').innerHTML = flatmateRowsHTML();
      root.querySelector('#newFlatmateName').value = '';
    });
  });
}

function addFlatmate(rawName) {
  const name = rawName.trim().replace(/['"\\]/g, '');
  if (!name) return toast('Enter a name', 'error');
  if (name.toLowerCase() === 'you' || name === ME) return toast('That name is reserved — try something else', 'error');
  if (state.flatmates.some(m => m.toLowerCase() === name.toLowerCase())) return toast('That flatmate is already in the group', 'error');
  state.flatmates.push(name);
  saveState();
}

function removeFlatmate(index) {
  const name = state.flatmates[index];
  if (name === undefined) return;
  const gExps = state.expenses.filter(e => e.split);
  const balances = computeBalances(gExps, membersList());
  if (Math.abs(balances[name] || 0) > 0.01) {
    return toast(`Settle up with ${name} before removing them`, 'error');
  }
  state.flatmates.splice(index, 1);
  saveState();
  const list = document.getElementById('flatmateList');
  if (list) list.innerHTML = flatmateRowsHTML();
}

function saveGroupName() {
  const el = document.getElementById('groupNameInput');
  state.groupName = el ? el.value.trim() : state.groupName;
  saveState(); closeModal(); render();
}

function settleExtraHTML(s) {
  const b = 'class="text-xs font-medium border border-slate-300 text-slate-700 px-2 py-1 rounded"';
  if (s.from === ME) return `<button onclick="payUPI('${esc(s.to)}',${s.amount})" ${b}>Pay via UPI</button>`;
  if (s.to === ME) return `<button onclick="remindOwes('${esc(s.from)}',${s.amount})" ${b}>Remind</button>`;
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
  location.href = `upi://pay?pa=${encodeURIComponent(id)}&pn=${encodeURIComponent(to)}&am=${amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent((state.groupName || 'Shared expense') + ' split')}`;
}

function remindOwes(from, amount) {
  const text = `Hi ${from}! Friendly nudge: ${fmtINR2(amount)} is pending for our flat expenses. No rush, pay whenever convenient 🙂`;
  if (navigator.share) navigator.share({ text }).catch(() => {});
  else window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
}
