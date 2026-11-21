/* =====================================================================
   profile.js - profile data, the onboarding wizard (+ its view), and the profile settings card/editor.
   ===================================================================== */


/* ---------- Profile data + onboarding wizard ---------- */
function blankProfile() {
  return { name:'', dob:'', gender:'', genderOther:'', phone:'', city:'', bloodGroup:'', allergies:'', conditions:[],
           emergencyName:'', emergencyRelation:'', emergencyPhone:'', monthlyIncome:'', monthlyBudget:'', goals:[], onboarded:false };
}

const profileKey = () => String(state.user.email || LOCAL_USER_EMAIL).toLowerCase();

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
  { id:'name',      icon:'🙂', title:'What should we call you?', hint:'Shown on your dashboard. You can change it later in Settings.' },
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

const OB_FIELDS = { obName:'name', obPhone:'phone', obCity:'city', obAllergies:'allergies', obEmName:'emergencyName', obEmRel:'emergencyRelation',
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
  setUserName(ob.d.name || state.user.name || 'Nivora User');
  applyBudget(ob.d.monthlyBudget); saveState();
  toast('Profile saved. Welcome to Nivora!', 'success'); navigate('/dashboard');
}

function obSkipAll() {
  const cur = getProfile() || blankProfile();
  setProfile({ ...cur, onboarded: true });
  setUserName(ob.d.name || state.user.name || 'Nivora User');
  navigate('/dashboard');
}

function obField(id, label, value, extra = '') {
  return `<label class="block"><span class="text-sm font-medium text-slate-700">${label}</span>
    <input id="${id}" value="${esc(value)}" ${extra} class="mt-1 w-full px-3 py-3 border border-slate-300 rounded-xl focus:border-teal-500 outline-none"/></label>`;
}

const obRow = (label, on, click) => `<button type="button" onclick="${click}" aria-pressed="${on}" class="w-full text-left px-4 py-4 rounded-xl border-b border-slate-200 transition ${on ? 'bg-teal-500 text-white border-transparent' : 'text-slate-800 hover:bg-slate-50'}">${esc(label)}</button>`;

const obChip = (label, on, click) => `<button type="button" onclick="${click}" aria-pressed="${on}" class="px-3 py-2 rounded-full border text-sm font-medium transition ${on ? 'bg-teal-600 border-teal-600 text-white' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}">${esc(label)}</button>`;

function obStepBody(id, d) {
  if (id === 'name') return `<div class="space-y-4">${obField('obName', 'Your name', d.name, 'maxlength="40" placeholder="e.g. Asha Verma" autocomplete="name"')}</div>`;
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


views['/onboarding'] = () => {
  if (ob.email !== profileKey()) obReset();
  const step = OB_STEPS[ob.step], d = ob.d, last = ob.step === OB_STEPS.length - 1;
  if (step.id === 'intro') return `<div class="min-h-screen bg-white flex flex-col max-w-md mx-auto px-6">
    <div class="pt-5"><button onclick="obSkipAll()" aria-label="Skip profile setup" class="w-10 h-10 rounded-lg hover:bg-slate-100 text-slate-700 text-xl">✕</button></div>
    <div class="flex-1 flex flex-col items-center justify-center text-center">
      ${LOGO_SVG.replace('w-10 h-10', 'w-24 h-24')}
      <h1 class="text-3xl font-extrabold text-teal-700 mt-8">Your journey starts here</h1>
      <p class="text-slate-600 mt-3 text-lg leading-relaxed">Staying on top of your money and health is only a few taps away. Answer a few quick questions to personalise your experience. You can skip any of them.</p>
    </div>
    <div class="pb-8 space-y-3">
      <button onclick="obNext()" class="w-full border-2 border-teal-700 text-teal-800 hover:bg-teal-50 font-semibold py-4 rounded-full">Create my profile</button>
      <button onclick="obSkipAll()" class="w-full border-2 border-teal-700 text-teal-800 hover:bg-teal-50 font-semibold py-4 rounded-full">Skip for now</button>
    </div></div>`;
  const pct = Math.round(ob.step / (OB_STEPS.length - 1) * 100);
  return `<div class="min-h-screen bg-gradient-to-b from-teal-600 to-teal-700">
    <form onsubmit="event.preventDefault(); obNext()" class="max-w-md mx-auto min-h-screen flex flex-col">
      <div class="px-6 pt-5 pb-5 text-white">
        <button type="button" onclick="obBack()" aria-label="Back" class="w-10 h-10 -ml-2 rounded-lg hover:bg-white/10 text-2xl">←</button>
        <div class="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-2xl mt-6" aria-hidden="true">${step.icon}</div>
        <h1 class="text-2xl font-bold mt-4 leading-snug">${esc(step.title)}</h1>
      </div>
      <div class="mx-6 h-1.5 rounded bg-teal-900/30" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><div class="h-full rounded bg-teal-200 transition-all" style="width:${pct}%"></div></div>
      <div class="flex-1 bg-white rounded-t-3xl mt-4 flex flex-col overflow-hidden">
        ${step.hint ? `<p class="bg-slate-100 text-slate-600 px-6 py-4 text-base">${esc(step.hint)}</p>` : ''}
        <div class="flex-1 px-6 py-5 overflow-y-auto">
          ${obStepBody(step.id, d)}
          ${ob.err ? `<p role="alert" class="text-sm text-red-600 mt-4">${esc(ob.err)}</p>` : ''}
        </div>
        <div class="px-6 pb-6 pt-3 bg-white">
          <button type="submit" class="w-full bg-teal-800 hover:bg-teal-900 text-white font-semibold py-4 rounded-full flex items-center justify-center gap-2">${last ? 'Done' : 'Next'} <span aria-hidden="true">›</span></button>
          ${step.required ? '' : `<button type="button" onclick="obSkip()" class="w-full text-slate-500 hover:text-slate-700 font-medium py-3">Skip</button>`}
        </div>
      </div>
    </form></div>`;
};


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
        <div class="min-w-0"><p class="font-semibold text-slate-900 truncate">${esc(state.user.name)}</p><p class="text-sm text-slate-500 truncate">${esc(state.user.email)}</p></div>
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
