/* ---------- Past month spending (Insights) ---------- */
function pastMonthStats(days = 30) {
  const byDay = {};
  for (const e of state.expenses) { const a = myShare(e); if (a > 0) { const k = String(e.date).slice(0, 10); byDay[k] = (byDay[k] || 0) + a; } }
  const cur = [];
  for (let i = days - 1; i >= 0; i--) { const iso = daysAgoISO(i); cur.push({ iso, value: byDay[iso] || 0 }); }
  let prev = 0; for (let i = days; i < days * 2; i++) prev += byDay[daysAgoISO(i)] || 0;
  const total = cur.reduce((t, d) => t + d.value, 0);
  const top = cur.reduce((b, d) => d.value > b.value ? d : b, cur[0]);
  return { cur, total, prev, avg: total / days, top, diff: total - prev, pct: prev > 0 ? (total - prev) / prev * 100 : null };
}
const pmDay = (iso, long) => new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', long ? { weekday:'short', day:'numeric', month:'long' } : { day:'numeric', month:'short' });
function pmSelect(el) {
  document.querySelectorAll('.pm-bar').forEach(b => b.setAttribute('opacity', b === el ? '1' : '0.5'));
  const out = document.getElementById('pmReadout');
  if (out) out.innerHTML = `<b class="text-slate-900">${esc(pmDay(el.dataset.iso, true))}</b> · ${Number(el.dataset.v) > 0 ? fmtINR(Number(el.dataset.v)) : 'no spending'}`;
}
function pastMonthHTML() {
  const st = pastMonthStats(30);
  const head = `<h2 class="font-bold text-slate-900">Past month spending</h2><p class="text-sm text-slate-500">Daily expenses, last 30 days</p>`;
  if (st.total <= 0) return `<div class="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">${head}
    <p class="text-slate-500 text-sm mt-6 mb-2 text-center">No spending recorded in the last 30 days. Add an expense to see your daily pattern.</p></div>`;
  const W = 600, H = 160, base = 150, top = 14, n = st.cur.length, slot = (W - 16) / n, bw = slot * 0.62;
  const max = Math.max(...st.cur.map(d => d.value), 1), y = v => base - (v / max) * (base - top);
  const bars = st.cur.map((d, i) => {
    const x = 8 + i * slot + (slot - bw) / 2, h = Math.max(d.value > 0 ? (d.value / max) * (base - top) : 2, 2), isTop = d.iso === st.top.iso;
    return `<rect class="pm-bar" x="${x.toFixed(1)}" y="${(base - h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="2" fill="${d.value <= 0 ? '#e2e8f0' : isTop ? '#0f766e' : '#14b8a6'}"
      opacity="1" data-iso="${d.iso}" data-v="${Math.round(d.value)}" tabindex="0" role="button" aria-label="${esc(pmDay(d.iso, true))}: ${d.value > 0 ? fmtINR(d.value) : 'no spending'}"
      onclick="pmSelect(this)" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();pmSelect(this)}" style="cursor:pointer"><title>${esc(pmDay(d.iso))}: ${d.value > 0 ? fmtINR(d.value) : 'no spending'}</title></rect>`;
  }).join('');
  const ticks = [0, 6, 12, 18, 24, 29].map(i => `<text x="${(8 + i * slot + slot / 2).toFixed(1)}" y="${H + 14}" font-size="11" fill="#64748b" text-anchor="${i === 0 ? 'start' : i === 29 ? 'end' : 'middle'}">${esc(pmDay(st.cur[i].iso))}</text>`).join('');
  const avgY = y(st.avg).toFixed(1);
  const up = st.diff > 0, flat = Math.abs(st.diff) < 1;
  const cmpColor = flat ? 'text-slate-700' : up ? 'text-red-600' : 'text-teal-700';
  const cmpText = flat ? 'Same' : `${up ? '↑' : '↓'} ${fmtINR(Math.abs(st.diff))}`;
  const summary = st.prev <= 0 ? `You spent <b>${fmtINR(st.total)}</b> in the last 30 days.`
    : flat ? `You spent <b>${fmtINR(st.total)}</b>, about the same as the previous 30 days.`
    : `You spent <b>${fmtINR(st.total)}</b>, <b class="${cmpColor}">${fmtINR(Math.abs(st.diff))} ${up ? 'more' : 'less'}</b> than the previous 30 days${st.pct !== null ? ` (${Math.abs(Math.round(st.pct))}%)` : ''}.`;
  const tile = (label, val, cls = 'text-slate-900') => `<div class="bg-slate-50 rounded-2xl px-2 py-3 text-center"><p class="text-[11px] font-semibold uppercase tracking-wide text-slate-500">${label}</p><p class="text-lg font-extrabold mt-1 ${cls}">${val}</p></div>`;
  return `<div class="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
    ${head}
    <p class="text-sm text-slate-700 mt-3">${summary}</p>
    <p id="pmReadout" aria-live="polite" class="text-sm text-slate-500 mt-3 min-h-[1.25rem]">Tap a bar to see that day's spending.</p>
    <div class="mt-1 overflow-x-auto no-scrollbar"><svg viewBox="0 0 ${W} ${H + 20}" class="w-full min-w-[420px]" role="group" aria-label="Daily spending bar chart for the last 30 days">
      <line x1="8" y1="${base}" x2="${W - 8}" y2="${base}" stroke="#e2e8f0"/>
      <line x1="8" y1="${avgY}" x2="${W - 8}" y2="${avgY}" stroke="#f59e0b" stroke-width="1.5" stroke-dasharray="5 4"/>
      <text x="${W - 8}" y="${Number(avgY) - 4}" font-size="11" fill="#b45309" text-anchor="end">Avg ${fmtINR(st.avg)}/day</text>
      ${bars}${ticks}</svg></div>
    <div class="grid grid-cols-3 gap-3 mt-3">
      ${tile('Total', fmtINR(st.total))}${tile('Daily avg', fmtINR(st.avg))}${tile('vs previous 30 days', cmpText, cmpColor)}
    </div>
    <p class="text-sm text-slate-500 mt-3">Highest day: <b class="text-slate-800">${esc(new Date(st.top.iso + 'T00:00:00').toLocaleDateString('en-IN', { day:'numeric', month:'long' }))}</b> (${fmtINR(st.top.value)})</p>
  </div>`;
}

views['/insights'] = () => {
  const catSpent = categorySpentThisMonth();
  const pieData = CATEGORIES.map(c => ({ label:c, value:catSpent[c], color:catColor(c) })).filter(d => d.value > 0);
  const sixMonths = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(new Date().getFullYear(), new Date().getMonth() - i, 1);
    const key = monthKeyOffset(i);
    sixMonths.push({ label: d.toLocaleDateString('en-IN', { month:'short' }), value: state.expenses.filter(e => monthKey(e.date) === key).reduce((s,e) => s + myShare(e), 0) });
  }

  return `
  <h1 class="text-2xl md:text-3xl font-extrabold text-slate-900 mb-4">Money</h1>
  ${tabBar('/insights', MONEY_TABS)}
  <div class="space-y-4">
    ${pastMonthHTML()}
    <div class="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
      <h2 class="font-bold text-slate-900 mb-3">Category breakdown</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
        <div>${pieChart(pieData)}</div>
        <ul class="space-y-1.5">
          ${pieData.map(d => `<li class="flex items-center justify-between text-sm">
            <span class="flex items-center gap-2"><span class="w-3 h-3 rounded-full" style="background:${d.color}"></span>${d.label}</span>
            <span class="font-semibold">${fmtINR(d.value)}</span>
          </li>`).join('')}
        </ul>
      </div>
    </div>
    <div class="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
      <h2 class="font-bold text-slate-900 mb-3">6-month spend trend</h2>
      ${lineChart(sixMonths)}
    </div>
  </div>`;
};

views['/settings'] = () => `
  <h1 class="text-2xl md:text-3xl font-extrabold text-slate-900 mb-4">Profile &amp; Settings</h1>
  <div class="space-y-4">
    ${profileCardHTML()}
    <div class="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 space-y-4">
      <h2 class="font-bold text-slate-900">Accessibility</h2>
      <label class="flex items-center justify-between gap-3 cursor-pointer">
        <div><p class="font-medium text-slate-900">Large text</p><p class="text-xs text-slate-500">Increase base font size</p></div>
        <input type="checkbox" ${state.user.largeText?'checked':''} onchange="handleToggleLargeText(this)" class="w-12 h-6 appearance-none rounded-full bg-slate-300 checked:bg-teal-600 relative transition-all cursor-pointer before:content-[''] before:absolute before:top-0.5 before:left-0.5 before:w-5 before:h-5 before:bg-white before:rounded-full before:transition-transform checked:before:translate-x-6"/>
      </label>
    </div>
    ${backupCardHTML()}
    ${accountCardHTML()}
    <p class="text-xs text-slate-400 text-center pb-6">Nivora v${APP_VERSION}</p>
  </div>`;

function profileCompletion() {
  const p = getProfile() || blankProfile();
  const c = [p.dob, p.gender, p.phone, p.city, p.bloodGroup, p.emergencyPhone, p.monthlyIncome, (p.goals || []).length];
  return Math.round(c.filter(Boolean).length / c.length * 100);
}
function profileCardHTML() {
  const p = getProfile() || blankProfile();
  const rows = [
    ['Age', p.dob ? `${ageFromDob(p.dob)} yrs · ${fmtDob(p.dob)}` : ''],
    ['Gender', genderLabel(p)], ['Phone', p.phone], ['City', p.city], ['Blood group', p.bloodGroup], ['Allergies', p.allergies],
    ['Conditions', p.conditions.join(', ')],
    ['Emergency contact', [p.emergencyName, p.emergencyRelation && `(${p.emergencyRelation})`, p.emergencyPhone].filter(Boolean).join(' ')],
    ['Monthly income', p.monthlyIncome !== '' && Number(p.monthlyIncome) >= 0 ? fmtINR(Number(p.monthlyIncome)) : ''],
  ].filter(r => r[1]);
  const pct = profileCompletion();
  return `<div class="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
      <div class="flex items-center justify-between mb-3"><h2 class="font-bold text-slate-900">Profile</h2>
        <button onclick="openEditProfile()" class="text-sm font-semibold text-teal-700 hover:underline">Edit</button></div>
      <div class="flex items-center gap-3">
        <div class="w-12 h-12 rounded-full bg-teal-100 text-teal-800 flex items-center justify-center font-bold">${esc(state.user.avatarInitials)}</div>
        <div class="min-w-0"><p class="font-semibold text-slate-900 truncate">${esc(state.user.name)}</p><p class="text-sm text-slate-500 truncate">${isDemo() ? esc(state.user.email) : 'Stored on this phone'}</p></div>
      </div>
      ${rows.length ? `<dl class="mt-4 divide-y divide-slate-100 text-sm">${rows.map(([k, v]) => `<div class="flex justify-between gap-4 py-2"><dt class="text-slate-500 shrink-0">${k}</dt><dd class="text-slate-900 text-right break-words min-w-0">${esc(v)}</dd></div>`).join('')}</dl>` : ''}
      ${p.goals.length ? `<div class="mt-3"><p class="text-xs uppercase font-semibold text-slate-400 tracking-wide mb-2">Goals</p><div class="flex flex-wrap gap-2">${p.goals.map(g => `<span class="px-2.5 py-1 rounded-full bg-teal-50 text-teal-800 text-xs font-medium">${esc(g)}</span>`).join('')}</div></div>` : ''}
      ${pct < 100 ? `<div class="mt-4"><div class="flex justify-between text-xs text-slate-500 mb-1"><span>Profile ${pct}% complete</span><button onclick="openEditProfile()" class="text-teal-700 font-semibold hover:underline">Add details</button></div>
        <div class="h-1.5 bg-slate-100 rounded"><div class="h-full bg-teal-500 rounded" style="width:${pct}%"></div></div></div>` : ''}
    </div>`;
}
function openEditProfile() {
  const p = getProfile() || blankProfile(), inp = 'mt-1 w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:border-teal-500 outline-none';
  const f = (n, label, v, extra = '') => `<label class="block"><span class="text-sm font-medium text-slate-700">${label}</span><input name="${n}" value="${esc(v)}" ${extra} class="${inp}"/></label>`;
  const checks = (n, list, sel) => `<div class="flex flex-wrap gap-x-4 gap-y-2 mt-1">${list.map(o => `<label class="flex items-center gap-2 text-sm"><input type="checkbox" name="${n}" value="${esc(o)}" ${sel.includes(o) ? 'checked' : ''} class="w-4 h-4"/>${esc(o)}</label>`).join('')}</div>`;
  const maxDob = new Date(); maxDob.setFullYear(maxDob.getFullYear() - MIN_AGE);
  openModal('Edit profile', `<form id="profileForm" class="space-y-3">
    ${f('dob', 'Date of birth', p.dob, `type="date" max="${maxDob.toISOString().slice(0, 10)}"`)}
    <label class="block"><span class="text-sm font-medium text-slate-700">Gender</span><select name="gender" class="${inp} bg-white"><option value="">Not set</option>${GENDERS.map(g => `<option ${p.gender === g ? 'selected' : ''}>${g}</option>`).join('')}</select></label>
    ${f('genderOther', 'If other, please specify', p.genderOther, 'maxlength="40"')}
    ${f('phone', 'Phone number', p.phone, 'type="tel" inputmode="tel"')}
    ${f('city', 'City', p.city, 'maxlength="60"')}
    <label class="block"><span class="text-sm font-medium text-slate-700">Blood group</span><select name="bloodGroup" class="${inp} bg-white"><option value="">Not set</option>${BLOOD_GROUPS.map(b => `<option ${p.bloodGroup === b ? 'selected' : ''}>${b}</option>`).join('')}</select></label>
    ${f('allergies', 'Allergies', p.allergies, 'maxlength="120"')}
    <div><span class="text-sm font-medium text-slate-700">Health conditions</span>${checks('conditions', CONDITIONS, p.conditions)}</div>
    ${f('emergencyName', 'Emergency contact name', p.emergencyName, 'maxlength="60"')}
    ${f('emergencyRelation', 'Relationship', p.emergencyRelation, 'maxlength="30"')}
    ${f('emergencyPhone', 'Emergency contact phone', p.emergencyPhone, 'type="tel" inputmode="tel"')}
    ${f('monthlyIncome', 'Monthly income (₹)', p.monthlyIncome, 'type="number" min="0" step="1" inputmode="decimal"')}
    <div><span class="text-sm font-medium text-slate-700">Goals</span>${checks('goals', GOALS, p.goals)}</div>
    <p id="profileErr" role="alert" class="text-sm text-red-600 hidden"></p>
    <div class="flex gap-2 pt-2">
      <button type="button" onclick="closeModal()" class="flex-1 border border-slate-300 text-slate-700 font-medium py-2.5 rounded-lg">Cancel</button>
      <button type="submit" class="flex-1 bg-teal-600 text-white font-semibold py-2.5 rounded-lg hover:bg-teal-700">Save</button>
    </div></form>`, root => {
    root.querySelector('#profileForm').addEventListener('submit', ev => {
      ev.preventDefault();
      const fd = new FormData(ev.target), g = k => String(fd.get(k) || '').trim();
      const data = { dob: g('dob'), gender: g('gender'), genderOther: g('genderOther'), phone: g('phone'), city: g('city'), bloodGroup: g('bloodGroup'),
        allergies: g('allergies'), conditions: fd.getAll('conditions'), emergencyName: g('emergencyName'), emergencyRelation: g('emergencyRelation'),
        emergencyPhone: g('emergencyPhone'), monthlyIncome: g('monthlyIncome'), goals: fd.getAll('goals') };
      if (data.conditions.includes('None') && data.conditions.length > 1) data.conditions = data.conditions.filter(c => c !== 'None');
      let err = data.dob ? validDob(data.dob) : '';
      if (!err && (!phoneOk(data.phone) || !phoneOk(data.emergencyPhone))) err = 'Enter valid phone numbers (10 to 13 digits).';
      if (!err && data.emergencyName && !data.emergencyPhone) err = 'Add a phone number for your emergency contact.';
      if (!err && data.monthlyIncome !== '' && !(Number(data.monthlyIncome) >= 0)) err = 'Monthly income must be a positive number.';
      if (err) { const e = root.querySelector('#profileErr'); e.textContent = err; e.classList.remove('hidden'); return; }
      setProfile({ ...data, onboarded: true });
      closeModal(); render(); toast('Profile updated', 'success');
    });
  });
}

function handleToggleLargeText(el) {
  state.user.largeText = el.checked;
  document.documentElement.classList.toggle('large-text', el.checked);
  saveState();
  toast('Preference saved','success');
}

function openAddExpense(isGroup = false) {
  const title = isGroup ? 'Add Shared Expense' : 'Add Expense';
  openModal(title, `
    <form id="expForm" class="space-y-3">
      <label class="block">
        <span class="text-sm font-medium text-slate-700">Amount (₹)</span>
        <input type="number" name="amount" required min="1" step="0.01" class="mt-1 w-full px-3 py-2.5 border border-slate-300 rounded-lg" placeholder="0"/>
      </label>
      <label class="block">
        <span class="text-sm font-medium text-slate-700">Notes</span>
        <input type="text" name="notes" class="mt-1 w-full px-3 py-2.5 border border-slate-300 rounded-lg" placeholder="What was it for?"/>
      </label>
      <label class="block">
        <span class="text-sm font-medium text-slate-700">Category</span>
        <select name="category" id="expCategory" class="mt-1 w-full px-3 py-2.5 border border-slate-300 rounded-lg">
          ${CATEGORIES.map(c => `<option value="${c}">${CATEGORY_META[c].icon} ${c}</option>`).join('')}
        </select>
      </label>
      <label class="block">
        <span class="text-sm font-medium text-slate-700">Date</span>
        <input type="date" name="date" value="${todayISO()}" class="mt-1 w-full px-3 py-2.5 border border-slate-300 rounded-lg"/>
      </label>
      <label class="block ${isGroup ? '' : 'hidden'}" id="paidByWrap">
        <span class="text-sm font-medium text-slate-700">Paid by</span>
        <select name="paidBy" class="mt-1 w-full px-3 py-2.5 border border-slate-300 rounded-lg">
          ${groupMembers().map(m => `<option>${m}</option>`).join('')}
        </select>
      </label>
      ${!isGroup ? `<label class="flex items-center gap-2 mt-2 cursor-pointer">
        <input type="checkbox" name="split" class="w-4 h-4" onchange="document.getElementById('paidByWrap').classList.toggle('hidden', !this.checked)"/>
        <span class="text-sm font-medium text-slate-700">Split with ${esc(groupName())}</span>
      </label>` : ''}
      <div class="flex gap-2 pt-2">
        <button type="button" onclick="closeModal()" class="flex-1 border border-slate-300 text-slate-700 font-medium py-2.5 rounded-lg">Cancel</button>
        <button type="submit" class="flex-1 bg-teal-600 text-white font-semibold py-2.5 rounded-lg hover:bg-teal-700">Save</button>
      </div>
    </form>`, (root) => {
    const form = root.querySelector('#expForm');
    form.querySelector('[name=notes]').addEventListener('input', (e) => {
      form.querySelector('#expCategory').value = autoCategorize(e.target.value);
    });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const amount = Number(fd.get('amount'));
      const category = fd.get('category');
      const shouldSplit = isGroup || fd.get('split') === 'on';
      if (!(amount > 0)) return toast('Enter an amount greater than 0', 'error');
      
      const exp = { id: 'exp_'+uid(), amount, category, date: fd.get('date') || todayISO(), notes: (fd.get('notes') || '').trim(), paidBy: shouldSplit ? fd.get('paidBy') : ME(), receipt: null, split: null };
      
      if (shouldSplit) {
        const ms = groupMembers(), sh = splitShares(amount, 'equal', ms.map(() => 1)), shares = {};
        ms.forEach((n, i) => shares[n] = sh[i]);
        exp.split = { members: ms.slice(), mode:'equal', shares };
      }
      
      state.expenses.push(exp);
      saveState();
      closeModal();
      
      const newSpentCat = categorySpentThisMonth()[category];
      const newTotalSpent = totalSpentThisMonth();
      if (newSpentCat > state.budgets[category]) {
        toast(`Alert: You have exceeded your ${category} budget by ${fmtINR(newSpentCat - state.budgets[category])}!`, 'error');
      } else if (newTotalSpent > totalBudget()) {
        toast(`Alert: You have exceeded your overall monthly budget!`, 'error');
      } else {
        toast(`Expense added: ${fmtINR(amount)}`, 'success');
      }
      render();
    });
  });
}

function openEditExpense(id) {
  const e = state.expenses.find(x => x.id === id);
  if (!e) return;
  openModal('Edit expense', `
    <form id="editExp" class="space-y-3">
      <label class="block"><span class="text-sm font-medium">Amount (₹)</span>
        <input type="number" name="amount" value="${e.amount}" required class="mt-1 w-full px-3 py-2.5 border rounded-lg"/></label>
      <label class="block"><span class="text-sm font-medium">Notes</span>
        <input type="text" name="notes" value="${esc(e.notes)}" class="mt-1 w-full px-3 py-2.5 border rounded-lg"/></label>
      <div class="flex gap-2 pt-2">
        <button type="button" onclick="closeModal()" class="flex-1 border py-2.5 rounded-lg">Cancel</button>
        <button type="submit" class="flex-1 bg-teal-600 text-white font-semibold py-2.5 rounded-lg">Save</button>
      </div>
    </form>`, (root) => {
    root.querySelector('#editExp').addEventListener('submit', (ev) => {
      ev.preventDefault();
      const fd = new FormData(ev.target);
      e.amount = Number(fd.get('amount'));
      e.notes = fd.get('notes');
      if (e.split) {
        const ms = e.split.members;
        if (e.settlement) {
          const to = ms.find(m => m !== e.paidBy);
          e.split.shares = { [e.paidBy]: 0, [to]: e.amount };
        } else {
          const per = Math.round((e.amount / ms.length) * 100) / 100;
          const shares = {};
          ms.forEach(m => shares[m] = per);
          shares[ms[ms.length-1]] = Math.round((e.amount - per*(ms.length-1)) * 100) / 100;
          e.split.shares = shares;
        }
      }
      saveState(); closeModal(); render(); toast('Expense updated','success');
    });
  });
}

function confirmDeleteExpense(id) {
  openModal('Delete expense?', `
    <p class="text-slate-600 mb-4">This can't be undone.</p>
    <div class="flex gap-2">
      <button onclick="closeModal()" class="flex-1 border py-2.5 rounded-lg">Cancel</button>
      <button onclick="deleteExpense('${id}')" class="flex-1 bg-red-600 text-white font-semibold py-2.5 rounded-lg">Delete</button>
    </div>`);
}

function deleteExpense(id) {
  state.expenses = state.expenses.filter(e => e.id !== id);
  saveState(); closeModal(); render(); toast('Expense deleted','success');
}

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



/* Group = a named list of people to split expenses with. They are just names (no Nivora account needed).
   Names are restricted to letters, digits, space, dot and hyphen so they are always safe inside templates. */
const GROUP_NAME_RE = /^[\p{L}\p{N} .\-]{1,20}$/u;
function openEditGroup() {
  const g = groupInfo(), me = ME();
  openModal('Edit group', `<form id="grpForm" class="space-y-3">
    <label class="block text-sm font-medium">Group name
      <input name="name" maxlength="30" required value="${esc(g.name)}" class="mt-1 w-full px-3 py-2.5 border border-slate-300 rounded-lg" /></label>
    <label class="block text-sm font-medium">Other people (one per line, up to 7)
      <textarea name="members" rows="5" class="mt-1 w-full px-3 py-2.5 border border-slate-300 rounded-lg">${esc(g.members.filter(m => m !== me).join('\n'))}</textarea></label>
    <p class="text-xs text-slate-500">These are only names for splitting expenses; they don't need accounts. Anyone who is part of an existing split can't be removed.</p>
    <button class="w-full bg-teal-600 text-white font-semibold py-2.5 rounded-lg">Save</button>
  </form>`, (root) => {
    root.querySelector('#grpForm').addEventListener('submit', (ev) => {
      ev.preventDefault();
      const fd = new FormData(ev.target);
      const name = String(fd.get('name')).trim().replace(/\s+/g, ' ');
      const others = [...new Set(String(fd.get('members')).split('\n').map(s => s.trim().replace(/\s+/g, ' ')).filter(Boolean))];
      if (!/^[\p{L}\p{N} .\-]{1,30}$/u.test(name)) return toast('Group name: letters, numbers, spaces, . and - only', 'error');
      const badName = others.find(n => !GROUP_NAME_RE.test(n) || n.toLowerCase() === me.toLowerCase() || n.toLowerCase() === 'you');
      if (badName !== undefined) return toast(`"${badName}" is not allowed (letters, numbers, spaces, . and -, max 20, not a duplicate of you)`, 'error');
      if (others.length > 7) return toast('A group can have at most 8 people including you', 'error');
      const removed = g.members.filter(m => m !== me && !others.includes(m));
      const inUse = removed.find(m => state.expenses.some(e => e.split && e.split.members.includes(m)));
      if (inUse !== undefined) return toast(`${inUse} is part of existing split expenses and can't be removed`, 'error');
      state.group = { name, members: [me, ...others] };
      saveState(); closeModal(); render(); toast('Group updated', 'success');
    });
  });
}
