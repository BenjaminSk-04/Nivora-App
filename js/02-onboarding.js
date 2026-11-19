/* ---------- Profile data + onboarding wizard ---------- */
const profileKey = () => String(currentUser?.email || state.user.email || '').toLowerCase();
function getProfile() { return state.profiles?.[profileKey()] || null; }
function setProfile(patch) {
  state.profiles = state.profiles || {};
  state.profiles[profileKey()] = { ...blankProfile(), ...(state.profiles[profileKey()] || {}), ...patch };
  saveState();
}
const MIN_AGE = 13;
const GENDERS = ['Female', 'Male', 'Non-binary', 'Other (please specify)', 'Prefer not to say'];
const BLOOD_GROUPS = ['A+', 'A−', 'B+', 'B−', 'AB+', 'AB−', 'O+', 'O−', 'Not sure'];
const CONDITIONS = ['Diabetes', 'Hypertension', 'Asthma', 'Thyroid', 'Heart condition', 'Arthritis', 'None'];
const GOALS = ['Track daily expenses', 'Stay within my monthly budget', 'Get medicine reminders', 'Split flat expenses', 'Build my savings'];
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const genderLabel = p => p.gender === 'Other (please specify)' ? (p.genderOther || 'Other') : p.gender;
const digitsOf = v => String(v || '').replace(/\D/g, '');
const phoneOk = v => !v || (/^[+\d\s()-]+$/.test(v) && digitsOf(v).length >= 10 && digitsOf(v).length <= 13);
function ageFromDob(iso) {
  const [y, m, d] = String(iso).split('-').map(Number); if (!y) return null;
  const t = new Date(); let a = t.getFullYear() - y;
  if (t.getMonth() + 1 < m || (t.getMonth() + 1 === m && t.getDate() < d)) a--;
  return a;
}
function fmtDob(iso) { const d = new Date(iso + 'T00:00:00'); return isNaN(d) ? '' : d.toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' }); }
function validDob(iso) {
  const [y, m, d] = String(iso).split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  if (!y || dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return 'That date does not exist.';
  if (ageFromDob(iso) < MIN_AGE) return `You must be at least ${MIN_AGE} years old to use Nivora.`;
  if (ageFromDob(iso) > 110) return 'Please check the year of birth.';
  return '';
}
function applyBudget(amount) {
  const b = Number(amount);
  if (amount === '' || !Number.isFinite(b) || b < 0 || b === totalBudget()) return;
  state.totalBudgetMonthly = b; distributeTotalBudget(b);
}

const OB_STEPS = [
  { id:'intro' },
  { id:'dob',       icon:'🎂', title:'What is your date of birth?', hint:`You must be at least ${MIN_AGE} years old to use Nivora.`, required:true },
  { id:'gender',    icon:'🧑', title:'How do you identify?' },
  { id:'contact',   icon:'📱', title:'How can we reach you?', hint:'Used for account recovery and reminders. Optional.' },
  { id:'health',    icon:'🩺', title:'Tell us about your health', hint:'Helps personalise medicine tools. Optional.' },
  { id:'emergency', icon:'🚨', title:'Who should we call in an emergency?', hint:'Optional. Stored only in this browser.' },
  { id:'money',     icon:'💰', title:'Your monthly money picture', hint:'Your budget is split across categories automatically.' },
  { id:'goals',     icon:'🎯', title:'What do you hope to achieve with Nivora?', hint:'You can choose more than one.' },
];
let ob = { step: 0, d: blankProfile(), err: '', email: null };
function obReset() {
  const p = getProfile() || blankProfile();
  ob = { step: 0, err: '', email: profileKey(), d: { ...blankProfile(), ...p, conditions: [...(p.conditions || [])], goals: [...(p.goals || [])], monthlyBudget: p.monthlyBudget || String(totalBudget()) } };
}
const OB_FIELDS = { obPhone:'phone', obCity:'city', obAllergies:'allergies', obEmName:'emergencyName', obEmRel:'emergencyRelation',
                    obEmPhone:'emergencyPhone', obIncome:'monthlyIncome', obBudget:'monthlyBudget', obGenderOther:'genderOther' };
function obRead() { // copy whatever inputs are on screen into the draft (no validation)
  for (const [id, key] of Object.entries(OB_FIELDS)) { const el = document.getElementById(id); if (el) ob.d[key] = el.value.trim(); }
  const dd = document.getElementById('obDay');
  if (dd) {
    const day = dd.value, mon = document.getElementById('obMonth').value, yr = document.getElementById('obYear').value;
    ob.d.dob = (day && mon && yr) ? `${yr}-${String(mon).padStart(2,'0')}-${String(day).padStart(2,'0')}` : '';
    ob.dobPartial = { day, mon, yr };
  }
}
function obValidate() {
  const id = OB_STEPS[ob.step].id, d = ob.d;
  if (id === 'dob') return d.dob ? validDob(d.dob) : 'Please select your full date of birth.';
  if (id === 'gender' && d.gender === 'Other (please specify)' && !d.genderOther) return 'Please tell us how you identify, or choose another option.';
  if (id === 'contact' && !phoneOk(d.phone)) return 'Enter a valid phone number (10 to 13 digits).';
  if (id === 'emergency') {
    if (!phoneOk(d.emergencyPhone)) return 'Enter a valid phone number (10 to 13 digits).';
    if (d.emergencyName && !d.emergencyPhone) return 'Add a phone number for your emergency contact.';
  }
  if (id === 'money') for (const k of ['monthlyIncome', 'monthlyBudget']) if (d[k] !== '' && !(Number(d[k]) >= 0)) return 'Enter amounts as positive numbers.';
  return '';
}
function obGo(delta) { ob.step = Math.max(0, Math.min(OB_STEPS.length - 1, ob.step + delta)); ob.err = ''; render(); window.scrollTo(0, 0); }
function obNext() {
  obRead(); ob.err = obValidate();
  if (ob.err) return render();
  if (ob.step === OB_STEPS.length - 1) return obFinish();
  obGo(1);
}
function obSkip() { obRead(); if (ob.step === OB_STEPS.length - 1) return obFinish(); obGo(1); }
function obBack() { obRead(); obGo(-1); }
function obSetGender(v) { obRead(); ob.d.gender = v; ob.err = ''; if (v === 'Other (please specify)') return render(); obNext(); }
function obPickBlood(v) { obRead(); ob.d.bloodGroup = ob.d.bloodGroup === v ? '' : v; render(); }
function obToggle(key, v) {
  obRead(); const a = ob.d[key], i = a.indexOf(v);
  if (i >= 0) a.splice(i, 1); else { if (key === 'conditions') { if (v === 'None') a.length = 0; else { const n = a.indexOf('None'); if (n >= 0) a.splice(n, 1); } } a.push(v); }
  render();
}
function obFinish() {
  setProfile({ ...ob.d, onboarded: true });
  applyBudget(ob.d.monthlyBudget); saveState();
  ob.email = null; toast('Profile saved. Welcome to Nivora!', 'success'); navigate('/dashboard');
}
function obSkipAll() {
  const cur = getProfile() || blankProfile();
  setProfile({ ...cur, onboarded: true });
  ob.email = null; navigate('/dashboard');
}
function obField(id, label, value, extra = '') {
  return `<label class="block"><span class="text-sm font-medium text-slate-700">${label}</span>
    <input id="${id}" value="${esc(value)}" ${extra} class="mt-1 w-full px-3 py-3 border border-slate-300 rounded-xl focus:border-teal-500 outline-none"/></label>`;
}
const obRow = (label, on, click) => `<button type="button" onclick="${click}" aria-pressed="${on}" class="w-full text-left px-4 py-4 rounded-xl border-b border-slate-200 transition ${on ? 'bg-teal-500 text-white border-transparent' : 'text-slate-800 hover:bg-slate-50'}">${esc(label)}</button>`;
const obChip = (label, on, click) => `<button type="button" onclick="${click}" aria-pressed="${on}" class="px-3 py-2 rounded-full border text-sm font-medium transition ${on ? 'bg-teal-600 border-teal-600 text-white' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}">${esc(label)}</button>`;
function obStepBody(id, d) {
  if (id === 'dob') {
    const [y, m, dd] = (d.dob || '').split('-'); const cy = new Date().getFullYear();
    const sel = (cls, idn, ph, opts, val) => `<select id="${idn}" aria-label="${ph}" class="flex-1 px-3 py-3 border border-slate-300 rounded-xl bg-white focus:border-teal-500 outline-none"><option value="">${ph}</option>${opts.map(([v, t]) => `<option value="${v}" ${String(Number(val)) === String(v) ? 'selected' : ''}>${t}</option>`).join('')}</select>`;
    return `<div class="flex gap-3 pt-2">
      ${sel('', 'obDay', 'Day', Array.from({ length: 31 }, (_, i) => [i + 1, i + 1]), dd)}
      ${sel('', 'obMonth', 'Month', MONTHS.map((t, i) => [i + 1, t]), m)}
      ${sel('', 'obYear', 'Year', Array.from({ length: 101 - MIN_AGE }, (_, i) => [cy - MIN_AGE - i, cy - MIN_AGE - i]), y)}
    </div>`;
  }
  if (id === 'gender') return `<div class="space-y-1">${GENDERS.map(g => obRow(g, d.gender === g, `obSetGender('${g}')`)).join('')}</div>
    ${d.gender === 'Other (please specify)' ? `<div class="mt-3">${obField('obGenderOther', 'Please specify', d.genderOther, 'maxlength="40" placeholder="How do you identify?"')}</div>` : ''}`;
  if (id === 'contact') return `<div class="space-y-4">${obField('obPhone', 'Phone number', d.phone, 'type="tel" inputmode="tel" autocomplete="tel" placeholder="+91 98765 43210"')}
    ${obField('obCity', 'City', d.city, 'autocomplete="address-level2" maxlength="60" placeholder="Pune"')}</div>`;
  if (id === 'health') return `<div class="space-y-5">
    <div><p class="text-sm font-medium text-slate-700 mb-2">Blood group</p><div class="flex flex-wrap gap-2">${BLOOD_GROUPS.map(b => obChip(b, d.bloodGroup === b, `obPickBlood('${b}')`)).join('')}</div></div>
    ${obField('obAllergies', 'Allergies', d.allergies, 'maxlength="120" placeholder="e.g. Penicillin, peanuts"')}
    <div><p class="text-sm font-medium text-slate-700 mb-2">Health conditions</p><div class="flex flex-wrap gap-2">${CONDITIONS.map(c => obChip(c, d.conditions.includes(c), `obToggle('conditions','${c}')`)).join('')}</div></div></div>`;
  if (id === 'emergency') return `<div class="space-y-4">${obField('obEmName', 'Contact name', d.emergencyName, 'maxlength="60" autocomplete="off"')}
    ${obField('obEmRel', 'Relationship', d.emergencyRelation, 'maxlength="30" placeholder="e.g. Mother, Friend"')}
    ${obField('obEmPhone', 'Contact phone', d.emergencyPhone, 'type="tel" inputmode="tel" placeholder="+91 98765 43210"')}</div>`;
  if (id === 'money') return `<div class="space-y-4">${obField('obIncome', 'Monthly income (₹)', d.monthlyIncome, 'type="number" inputmode="decimal" min="0" step="1" placeholder="e.g. 45000"')}
    ${obField('obBudget', 'Monthly spending budget (₹)', d.monthlyBudget, 'type="number" inputmode="decimal" min="0" step="1"')}</div>`;
  if (id === 'goals') return `<div class="space-y-1">${GOALS.map(g => obRow(g, d.goals.includes(g), `obToggle('goals','${g}')`)).join('')}</div>`;
  return '';
}

function togglePasswordVisibility(btn) {
  const input = btn.parentElement.querySelector('input');
  const isPw = input.type === 'password';
  input.type = isPw ? 'text' : 'password';
  btn.innerHTML = isPw ? ICONS.eyeOff : ICONS.eye;
}

function toast(msg, type='info') {
  const colors = { info:'bg-slate-800', success:'bg-teal-600', error:'bg-red-600', warning:'bg-amber-500' };
  const el = document.createElement('div');
  el.className = `toast-in ${colors[type]} text-white px-4 py-3 rounded-xl shadow-lg max-w-sm text-sm font-medium pointer-events-auto flex items-start gap-2`;
  el.innerHTML = `<span class="mt-0.5">${type==='error'||type==='warning'?'⚠️':type==='success'?'✅':'ℹ️'}</span> <span>${esc(msg)}</span>`;
  $('#toast-container').appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

function openModal(title, bodyHTML, onMount) {
  const root = $('#modal-root');
  root.innerHTML = `
    <div class="fixed inset-0 bg-slate-900/50 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4" data-modal-backdrop>
      <div class="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto" role="dialog" aria-modal="true">
        <div class="sticky top-0 bg-white border-b border-slate-100 px-5 py-4 flex items-center justify-between rounded-t-2xl">
          <h2 class="text-lg font-bold text-slate-900">${esc(title)}</h2>
          <button data-close-modal aria-label="Close" class="p-2 hover:bg-slate-100 rounded-lg text-slate-500">✕</button>
        </div>
        <div class="p-5">${bodyHTML}</div>
      </div>
    </div>`;
  root.querySelectorAll('[data-close-modal]').forEach(b => b.addEventListener('click', closeModal));
  root.querySelector('[data-modal-backdrop]').addEventListener('click', e => { if (e.target.dataset.modalBackdrop !== undefined) closeModal(); });
  
  const focusables = root.querySelectorAll('button, input, select, textarea, a[href]');
  if (focusables.length) focusables[0].focus();
  root.onkeydown = e => {
    if (e.key === 'Escape') { closeModal(); return; }
    if (e.key === 'Tab') {
      if (e.shiftKey && document.activeElement === focusables[0]) { e.preventDefault(); focusables[focusables.length-1].focus(); }
      else if (!e.shiftKey && document.activeElement === focusables[focusables.length-1]) { e.preventDefault(); focusables[0].focus(); }
    }
  };

  if (onMount) onMount(root);
}
function closeModal() { const r = $('#modal-root'); r.innerHTML = ''; r.onkeydown = null; }

async function ensureNotificationPerm() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  return (await Notification.requestPermission()) === 'granted';
}
function fireReminder(title, body) {
  state.notifications.unshift({ id: uid(), title, body, at: new Date().toISOString() });
  state.notifications = state.notifications.slice(0, 50);
  saveState(); toast(`${title}: ${body}`, 'info');
  if ('Notification' in window && Notification.permission === 'granted') {
    try { new Notification(title, { body, tag: 'nivora-' + uid() }); } catch {}
  }
  const dot = $('#notifDot'); if (dot) dot.classList.remove('hidden');
}

function computeBalances(expenses, members) {
  const bal = Object.fromEntries(members.map(m => [m, 0]));
  for (const e of expenses) {
    if (!e.split) continue;
    for (const m of e.split.members) bal[m] -= (e.split.shares[m] || 0);
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

function isDoseDue(med, dateISO) {
  if (!med.active) return false;
  if (med.startDate && dateISO < med.startDate) return false;
  if (med.endDate && dateISO > med.endDate) return false;
  const diffDays = Math.floor((new Date(dateISO) - new Date(med.startDate)) / 86400000);
  if (med.frequency === 'daily') return true;
  if (med.frequency === 'alternate') return diffDays % 2 === 0;
  if (med.frequency === 'weekly') return new Date(dateISO).getDay() === new Date(med.startDate).getDay();
  return true;
}
function todaysDoses() {
  const today = todayISO();
  const out = [];
  for (const med of state.medicines) {
    if (!isDoseDue(med, today)) continue;
    for (const t of med.times) {
      out.push({ med, time: t, status: med.log?.[today]?.[t] || 'pending' });
    }
  }
  return out.sort((a,b) => a.time.localeCompare(b.time));
}
function markDose(medId, time, status) {
  const med = state.medicines.find(m => m.id === medId);
  if (!med) return;
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const [doseHour, doseMinute] = time.split(':').map(Number);
  if (nowMin < doseHour * 60 + doseMinute) {
    return toast('This medicine is not due yet', 'warning');
  }
  med.log = med.log || {}; med.log[todayISO()] = med.log[todayISO()] || {};
  if (med.log[todayISO()][time] === status) return;
  const wasTaken = med.log[todayISO()][time] === 'taken';
  med.log[todayISO()][time] = status;
  if (status === 'taken') med.stock = Math.max(0, med.stock - 1);
  else if (wasTaken) med.stock += 1;
  saveState(); toast(status === 'taken' ? 'Dose taken' : 'Dose skipped', status === 'taken' ? 'success' : 'warning'); render();
  if (status === 'skipped') setTimeout(() => caregiverPrompt(med, time), 60);
}
function adherence() {
  let taken = 0, total = 0;
  for (let i = 0; i < 30; i++) {
    const d = daysAgoISO(i);
    for (const med of state.medicines) {
      if (!isDoseDue(med, d)) continue;
      for (const t of med.times) { total++; if (med.log?.[d]?.[t] === 'taken') taken++; }
    }
  }
  return total ? Math.round((taken / total) * 100) : 0;
}

function myShare(e) { if (e.settlement) return 0; if (e.split) return e.split.shares[ME()] || 0; return (e.paidBy && e.paidBy !== ME()) ? 0 : e.amount; }
function expensesThisMonth() { return state.expenses.filter(e => monthKey(e.date) === thisMonthKey()); }
function expensesPrevMonth() { return state.expenses.filter(e => monthKey(e.date) === prevMonthKey()); }
function totalSpentThisMonth() { return expensesThisMonth().reduce((s,e) => s + myShare(e), 0); }
function totalBudget() {
  const savedTotal = Number(state.totalBudgetMonthly);
  return Number.isFinite(savedTotal) && savedTotal >= 0
    ? savedTotal
    : Object.values(state.budgets).reduce((s,v) => s+Number(v || 0), 0);
}
function distributeTotalBudget(total) {
  const weights = CATEGORIES.map(c => Math.max(0, Number(state.budgets?.[c] || 0)));
  const weightSum = weights.reduce((sum, value) => sum + value, 0);
  const effectiveWeights = weightSum > 0 ? weights : CATEGORIES.map(() => 1);
  const denominator = effectiveWeights.reduce((sum, value) => sum + value, 0);
  let allocated = 0;
  state.budgets = {};
  CATEGORIES.forEach((category, index) => {
    const amount = index === CATEGORIES.length - 1
      ? Math.max(0, total - allocated)
      : Math.round(total * effectiveWeights[index] / denominator);
    state.budgets[category] = amount;
    allocated += amount;
  });
}
function categorySpentThisMonth() {
  const map = Object.fromEntries(CATEGORIES.map(c => [c, 0]));
  for (const e of expensesThisMonth()) map[e.category] = (map[e.category] || 0) + myShare(e);
  return map;
}
function categorySpentPrevMonth() {
  const map = Object.fromEntries(CATEGORIES.map(c => [c, 0]));
  for (const e of expensesPrevMonth()) map[e.category] = (map[e.category] || 0) + myShare(e);
  return map;
}

function progressBar(pct, color) {
  return `<div class="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden"><div class="h-full rounded-full transition-all duration-500" style="width:${Math.min(pct,100)}%;background:${color}"></div></div>`;
}
function budgetColor(pct) { return pct < 70 ? '#0d9488' : pct < 90 ? '#f59e0b' : '#dc2626'; }
function pieChart(data) {
  const total = data.reduce((s,d) => s + d.value, 0);
  if (!total) return '<p class="text-sm text-slate-500 text-center">No data</p>';
  let angle = -Math.PI/2, cx=100, cy=100, r=76;
  const live = data.filter(d => d.value > 0);
  if (live.length === 1) return `<svg viewBox="0 0 200 200" class="w-full max-w-[220px] mx-auto"><circle cx="100" cy="100" r="76" fill="${live[0].color}" stroke="white" stroke-width="2"><title>${live[0].label}: ${fmtINR(live[0].value)}</title></circle><circle cx="100" cy="100" r="42" fill="white"/></svg>`;
  const slices = live.map(d => {
    const frac = d.value / total, next = angle + frac * 2 * Math.PI;
    const x1 = cx + r*Math.cos(angle), y1 = cy + r*Math.sin(angle);
    const x2 = cx + r*Math.cos(next), y2 = cy + r*Math.sin(next);
    const large = frac > 0.5 ? 1 : 0;
    const path = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
    angle = next;
    return `<path d="${path}" fill="${d.color}" stroke="white" stroke-width="2"><title>${d.label}: ${fmtINR(d.value)}</title></path>`;
  }).join('');
  return `<svg viewBox="0 0 200 200" class="w-full max-w-[220px] mx-auto">${slices}<circle cx="100" cy="100" r="42" fill="white"/></svg>`;
}
function lineChart(points) {
  if (!points.length) return '';
  const w=400, h=160, padX=24, padY=24, max = Math.max(...points.map(p => p.value), 1);
  const step = (w - 2*padX) / Math.max(points.length - 1, 1);
  const coords = points.map((p,i) => ({ x: padX + i*step, y: h - padY - (p.value/max)*(h - 2*padY), ...p }));
  const pts = coords.map(c => `${c.x},${c.y}`).join(' ');
  return `<svg viewBox="0 0 ${w} ${h}" class="w-full">
    <defs><linearGradient id="grad-teal" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#0d9488" stop-opacity="0.25"/><stop offset="100%" stop-color="#0d9488" stop-opacity="0"/></linearGradient></defs>
    <path d="M ${coords[0].x} ${h-padY} L ${pts.split(' ').join(' L ')} L ${coords[coords.length-1].x} ${h-padY} Z" fill="url(#grad-teal)"/>
    <polyline points="${pts}" fill="none" stroke="#0d9488" stroke-width="2.5" stroke-linecap="round"/>
    ${coords.map(c => `<circle cx="${c.x}" cy="${c.y}" r="3.5" fill="white" stroke="#0d9488" stroke-width="2"><title>${c.label}: ${fmtINR(c.value)}</title></circle>`).join('')}
    ${coords.map(c => `<text x="${c.x}" y="${h-4}" text-anchor="middle" font-size="9" fill="#64748b">${c.label}</text>`).join('')}
  </svg>`;
}

