/* ---------- Duplicate medicine detection + beep alert ---------- */
function beepAlert(times = 3) {
  try {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const ctx = new AC(); if (ctx.state === 'suspended') ctx.resume();
    for (let i = 0; i < times; i++) {
      const t = ctx.currentTime + i * 0.35, o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'square'; o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
      o.connect(g); g.connect(ctx.destination); o.start(t); o.stop(t + 0.27);
    }
    setTimeout(() => { try { ctx.close(); } catch {} }, times * 350 + 400);
  } catch {}
  try { navigator.vibrate && navigator.vibrate([200, 100, 200, 100, 200]); } catch {}
}
/* "Common drug name" = same brand name or same active ingredient, ignoring strength and form (e.g. 500mg, tablet). */
function drugKey(v) {
  return String(v || '').toLowerCase()
    .replace(/\d+(\.\d+)?\s*(mg|mcg|µg|g|ml|iu|%)/g, ' ')
    .replace(/\b(tablets?|tabs?|capsules?|caps?|syrup|inhaler|injection|cream|drops?|sr|er|ip)\b/g, ' ')
    .replace(/[^a-z]+/g, ' ').trim();
}
function findDuplicateMeds(med, list = state.medicines) {
  const keys = [drugKey(med.name), drugKey(med.salt)].filter(Boolean);
  return list.filter(m => m !== med && m.id !== med.id && [drugKey(m.name), drugKey(m.salt)].some(k => k && keys.includes(k)));
}
function duplicateGroups() {
  const seen = new Set(), groups = [];
  for (const m of state.medicines) {
    if (seen.has(m.id)) continue;
    const dups = findDuplicateMeds(m);
    if (dups.length) { [m, ...dups].forEach(x => seen.add(x.id)); groups.push([m, ...dups]); }
  }
  return groups;
}
function duplicateBannerHTML() {
  const g = duplicateGroups(); if (!g.length) return '';
  return `<div role="alert" class="bg-red-50 border border-red-200 text-red-800 rounded-2xl p-4">
    <p class="font-bold">⚠️ Duplicate medicine</p>
    ${g.map(grp => `<p class="text-sm mt-1">You have ${grp.length} entries for the same drug: <b>${grp.map(m => esc(m.name)).join(', ')}</b>. Taking both may mean a double dose. Check with your doctor or pharmacist.</p>`).join('')}
  </div>`;
}
let pendingMed = null;
function commitMedicine(med) {
  state.medicines.push(med);
  saveState(); closeModal(); render(); toast('Medicine added', 'success');
}
function showDuplicateAlert(med, dups) {
  pendingMed = med; beepAlert(3);
  openModal('⚠️ Duplicate medicine alert', `
    <div role="alert" class="text-center">
      <div class="text-6xl mb-3" aria-hidden="true">🚨</div>
      <p class="text-lg font-bold text-red-700">"${esc(med.name)}" is already in your list</p>
      <p class="text-slate-600 mt-2 text-sm">Same drug name or active ingredient as: <b>${dups.map(m => esc(m.name) + (m.salt ? ` (${esc(m.salt)})` : '')).join(', ')}</b>.</p>
      <p class="text-slate-600 mt-2 text-sm">Taking two of the same medicine can cause an overdose. Please confirm with your doctor or pharmacist.</p>
    </div>
    <div class="flex gap-2 pt-5">
      <button onclick="closeModal(); pendingMed = null" class="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-3 rounded-lg">Cancel</button>
      <button onclick="commitMedicine(pendingMed); pendingMed = null" class="flex-1 border border-slate-300 text-slate-700 font-medium py-3 rounded-lg">Add anyway</button>
    </div>`);
}

function openAddMedicine() {
  openModal('Add Medicine', `
    <form id="medForm" class="space-y-4">
      <div class="grid grid-cols-2 gap-3">
        <label class="block"><span class="text-sm font-medium">Name</span>
          <input name="name" required class="mt-1 w-full px-3 py-2.5 border rounded-lg" placeholder="e.g. Paracetamol"/></label>
        <label class="block"><span class="text-sm font-medium">Dosage</span>
          <input name="dosage" class="mt-1 w-full px-3 py-2.5 border rounded-lg" placeholder="e.g. 1 tablet" value="1 tablet"/></label>
      </div>
      <label class="block"><span class="text-sm font-medium">Salt / Composition</span>
        <input name="salt" class="mt-1 w-full px-3 py-2.5 border rounded-lg" placeholder="e.g. Paracetamol 500mg"/></label>
      
      <div class="border-t pt-3 mt-3">
        <p class="text-sm font-medium text-slate-700 mb-2">Schedule times</p>
        <div class="grid grid-cols-2 gap-2">
          <label class="flex items-center gap-2 p-2 border rounded-lg bg-slate-50 cursor-pointer">
            <input type="checkbox" name="time_m" value="08:00" class="w-4 h-4 rounded text-teal-600"/>
            <span class="text-sm">🌅 Morning (8 AM)</span>
          </label>
          <label class="flex items-center gap-2 p-2 border rounded-lg bg-slate-50 cursor-pointer">
            <input type="checkbox" name="time_a" value="14:00" class="w-4 h-4 rounded text-teal-600"/>
            <span class="text-sm">☀️ Afternoon (2 PM)</span>
          </label>
          <label class="flex items-center gap-2 p-2 border rounded-lg bg-slate-50 cursor-pointer">
            <input type="checkbox" name="time_e" value="18:00" class="w-4 h-4 rounded text-teal-600"/>
            <span class="text-sm">🌇 Evening (6 PM)</span>
          </label>
          <label class="flex items-center gap-2 p-2 border rounded-lg bg-slate-50 cursor-pointer">
            <input type="checkbox" name="time_n" value="21:00" class="w-4 h-4 rounded text-teal-600" checked/>
            <span class="text-sm">🌙 Night (9 PM)</span>
          </label>
        </div>
      </div>

      <div class="flex gap-2 pt-4">
        <button type="button" onclick="closeModal()" class="flex-1 border py-2.5 rounded-lg">Cancel</button>
        <button type="submit" class="flex-1 bg-teal-600 text-white font-semibold py-2.5 rounded-lg">Save</button>
      </div>
    </form>`, (root) => {
    root.querySelector('#medForm').addEventListener('submit', (ev) => {
      ev.preventDefault();
      const fd = new FormData(ev.target);
      const times = [];
      ['time_m', 'time_a', 'time_e', 'time_n'].forEach(field => {
        if (fd.get(field)) times.push(fd.get(field));
      });
      if (!times.length) return toast('Select at least one time', 'error');
      
      const med = {
        id: 'med_'+uid(), name: String(fd.get('name') || '').trim(), salt: String(fd.get('salt') || '').trim(), dosage: fd.get('dosage'),
        frequency: 'daily', times: times.sort(), startDate: todayISO(), endDate: null,
        refillDate: daysAgoISO(-30), stock: 15, active: true, log: {}
      };
      const dups = findDuplicateMeds(med);
      if (dups.length) return showDuplicateAlert(med, dups);
      commitMedicine(med);
    });
  });
}

function confirmDeleteMedicine(id) {
  openModal('Delete medicine?', `
    <p class="text-slate-600 mb-4">Remove this from your schedule?</p>
    <div class="flex gap-2">
      <button onclick="closeModal()" class="flex-1 border py-2.5 rounded-lg">Cancel</button>
      <button onclick="deleteMedicine('${id}')" class="flex-1 bg-red-600 text-white font-semibold py-2.5 rounded-lg">Delete</button>
    </div>`);
}

function deleteMedicine(id) {
  state.medicines = state.medicines.filter(m => m.id !== id);
  saveState(); closeModal(); render(); toast('Medicine removed','success');
}

async function testReminder() {
  if (NativeAlarms.isNative) {   // real OS alarm: lets the user verify it rings with the app closed
    const r = await NativeAlarms.test(10);
    if (!r.ok) return toast('Notifications are blocked. Allow them in Android Settings → Apps → Nivora.', 'warning');
    toast('Test sent. Close the app: a reminder arrives in about 10 seconds.', 'success');
    if (r.exact === 'denied') {
      toast('For on-time alarms, allow "Alarms & reminders" for Nivora on the next screen.', 'warning');
      setTimeout(NativeAlarms.openExactAlarmSettings, 1500);
    }
    return;
  }
  const ok = await ensureNotificationPerm();
  const med = state.medicines.length > 0 ? state.medicines[0] : null;
  const name = med ? med.name : 'your medicine';
  const time = med && med.times.length > 0 ? med.times[0] : '21:00';
  fireReminder('💊 Medicine reminder', `Time to take ${name} (${fmtTime12(time)})`);
  if (!ok) toast('Browser notifications are blocked. Allow them in your browser site settings to get alerts.','warning');
}

function openNotifications() {
  openModal('Notifications', `
    ${state.notifications.length ? `<ul class="space-y-2">${state.notifications.map(n => `
      <li class="p-3 bg-slate-50 rounded-lg border border-slate-100">
        <p class="font-medium text-slate-900 text-sm">${esc(n.title)}</p>
        <p class="text-xs text-slate-600">${esc(n.body)}</p>
        <p class="text-[10px] text-slate-400 mt-1">${new Date(n.at).toLocaleString('en-IN')}</p>
      </li>`).join('')}</ul>` : '<p class="text-slate-500 text-center py-6">No notifications yet.</p>'}
  `);
}

function openEditTotalBudget() {
  openModal('Set total monthly budget', `
    <form id="totalBudgetForm" class="space-y-3">
      <label class="block">
        <span class="text-sm font-medium">Your total budget for this month (₹)</span>
        <input type="number" name="amount" value="${totalBudget()}" min="0" step="1" required
          inputmode="numeric" class="mt-1 w-full px-3 py-2.5 border rounded-lg"
          placeholder="Enter your total budget"/>
      </label>
      <p class="text-xs text-slate-500">This total is set by you and is tracked separately from the individual category limits.</p>
      <div class="flex gap-2 pt-2">
        <button type="button" onclick="closeModal()" class="flex-1 border py-2.5 rounded-lg">Cancel</button>
        <button type="submit" class="flex-1 bg-teal-600 text-white font-semibold py-2.5 rounded-lg">Save budget</button>
      </div>
    </form>`, (root) => {
    root.querySelector('#totalBudgetForm').addEventListener('submit', (ev) => {
      ev.preventDefault();
      const amount = Number(new FormData(ev.target).get('amount'));
      if (!Number.isFinite(amount) || amount < 0) {
        toast('Enter a valid budget amount', 'error');
        return;
      }
      state.totalBudgetMonthly = amount;
      distributeTotalBudget(amount);
      saveState();
      closeModal();
      render();
      toast('Budget split automatically across all expense categories', 'success');
    });
  });
}

function openEditBudget(cat) {
  openModal(`Budget for ${cat}`, `
    <form id="budgetForm" class="space-y-3">
      <label class="block"><span class="text-sm font-medium">Monthly limit (₹)</span>
        <input type="number" name="amount" value="${state.budgets[cat] || 0}" min="0" required class="mt-1 w-full px-3 py-2.5 border rounded-lg"/></label>
      <div class="flex gap-2 pt-2">
        <button type="button" onclick="closeModal()" class="flex-1 border py-2.5 rounded-lg">Cancel</button>
        <button type="submit" class="flex-1 bg-teal-600 text-white font-semibold py-2.5 rounded-lg">Save</button>
      </div>
    </form>`, (root) => {
    root.querySelector('#budgetForm').addEventListener('submit', (ev) => {
      ev.preventDefault();
      state.budgets[cat] = Number(new FormData(ev.target).get('amount'));
      saveState(); closeModal(); render(); toast('Budget updated','success');
    });
  });
}

function confirmReset() {
  openModal('Reset demo data?', `
    <p class="text-slate-600 mb-4">This will erase all expenses and medicines.</p>
    <div class="flex gap-2">
      <button onclick="closeModal()" class="flex-1 border py-2.5 rounded-lg">Cancel</button>
      <button onclick="resetDemo();closeModal()" class="flex-1 bg-red-600 text-white font-semibold py-2.5 rounded-lg">Reset</button>
    </div>`);
}

function refreshExpenseList() { const box = $('#expList'); if (box) box.innerHTML = expenseListHTML(); }
function handleExpenseSearch(el) { expenseFilter.search = el.value; refreshExpenseList(); }
function handleCatFilter(el) { expenseFilter.cat = el.value; refreshExpenseList(); }

function render() {
  const path = (window.location.hash.replace(/^#/, '') || '/dashboard');
  if (!currentUser && !['/login','/signup','/forgot'].includes(path)) return navigate('/login');
  if (currentUser && ['/login','/signup','/forgot'].includes(path)) return navigate('/dashboard');

  const app = $('#app');
  if (['/login','/signup','/forgot','/onboarding'].includes(path)) {
    app.innerHTML = views[path]();
    return;
  }

  app.innerHTML = `
    ${topNav(path)}
    <main class="max-w-6xl mx-auto px-4 py-5 pb-24 md:pb-8">${(views[path] || views['/dashboard'])()}</main>
    ${bottomNav(path)}
  `;
  document.documentElement.classList.toggle('large-text', state.user.largeText);
}

/* Dose reminders fire only during the exact scheduled clock minute.
   Fired keys are persisted per day so a reload does not re-fire them.
   Browser/OS background throttling can delay or suppress reminders while the page is inactive. */
const FIRED_KEY = 'nivora_fired';
const firedReminders = (() => {
  try { const o = JSON.parse(store.get(FIRED_KEY) || '{}'); return new Set(o.day === todayISO() ? o.keys : []); }
  catch { return new Set(); }
})();
function persistFired() {
  const today = todayISO();
  for (const k of firedReminders) if (!k.startsWith(today)) firedReminders.delete(k);
  store.set(FIRED_KEY, JSON.stringify({ day: today, keys: [...firedReminders] }));
}
function checkDoseReminders() {
  if (!currentUser || !state.user.notifications) return;
  const now = new Date(), nowMin = now.getHours() * 60 + now.getMinutes(), today = todayISO();
  for (const d of todaysDoses()) {
    if (d.status !== 'pending') continue;
    const [h, m] = d.time.split(':').map(Number);
    if (nowMin !== h * 60 + (m || 0)) continue;
    const key = `${today}|${d.med.id}|${d.time}`;
    if (firedReminders.has(key)) continue;
    firedReminders.add(key); persistFired();
    fireReminder('💊 Medicine reminder', `It is time to take ${d.med.name} (${fmtTime12(d.time)}).`);
  }
}
