/* =====================================================================
   medicines.js - dose scheduling, Medicines screen, stock, duplicate detection, caregiver alerts, adherence report.
   ===================================================================== */


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


views['/medicines'] = () => {
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const doses = todaysDoses();
  const pending = doses.filter(d => d.status === 'pending');
  return `
  <h1 class="text-2xl md:text-3xl font-extrabold text-slate-900 mb-4">Health</h1>
  <div class="space-y-4">
    ${duplicateBannerHTML()}
    <div class="bg-gradient-to-br from-teal-600 to-teal-700 text-white rounded-2xl p-5 flex justify-between items-center">
      <div>
        <p class="text-xs opacity-80 uppercase tracking-wide font-semibold">30-day adherence</p>
        <p class="text-3xl font-extrabold mt-1">${adherence()}%</p>
        <p class="text-xs opacity-80 mt-1">${pending.length} dose${pending.length!==1?'s':''} due today</p>
      </div>
      <button onclick="openAddMedicine()" class="bg-white/20 hover:bg-white/30 border border-white/30 rounded-xl px-4 py-2 text-sm font-semibold flex items-center gap-1">
        ${ICONS.plus.replace('w-6 h-6','w-4 h-4')} Add
      </button>
    </div>

    <div class="bg-white rounded-2xl shadow-sm border border-slate-100">
      <div class="p-4 border-b border-slate-100">
        <h2 class="font-bold text-slate-900">Today's doses</h2>
        <p class="text-xs text-slate-500">${new Date().toLocaleDateString('en-IN',{weekday:'long', day:'numeric', month:'short'})}</p>
      </div>
      <ul class="divide-y divide-slate-100">
        ${doses.length ? groupedDosesHTML() : '<li class="p-8 text-center text-slate-500 text-sm">No doses scheduled today 🎉</li>'}
      </ul>
    </div>

    ${caregiverCardHTML()}

    <div class="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex items-start gap-3">
      <div class="text-2xl text-teal-600 mt-1">${ICONS.bell}</div>
      <div class="flex-1">
        <h3 class="font-semibold text-slate-900">Reminder test</h3>
        <p class="text-xs text-slate-500 mt-0.5">Fire a test browser notification so you know it works.</p>
        <button onclick="testReminder()" class="mt-2 bg-slate-900 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-slate-800">Send test reminder</button>
      </div>
    </div>

    <div class="bg-white rounded-2xl shadow-sm border border-slate-100">
      <div class="p-4 border-b border-slate-100"><h2 class="font-bold text-slate-900">All Medicines</h2></div>
      <ul class="divide-y divide-slate-100">
        ${[...state.medicines].sort((a,b) => (a.times || []).slice().sort()[0]?.localeCompare((b.times || []).slice().sort()[0] || '') || 0).map(m => {
          const refillSoon = m.refillDate && daysUntil(m.refillDate) <= 7;
          return `<li class="p-4">
            <div class="flex items-center justify-between mb-1">
              <div>
                <p class="font-semibold text-slate-900">${esc(m.name)}</p>
                <p class="text-xs text-slate-500">${esc(m.salt)} · ${esc(m.dosage)} · ${m.frequency}</p>
                <p class="text-xs text-slate-500 mt-1 font-medium">⏰ ${m.times.map(fmtTime12).join(', ')}</p>${stockLineHTML(m)}
              </div>
              <button onclick="confirmDeleteMedicine('${m.id}')" class="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-600" aria-label="Delete medicine">🗑️</button>
            </div>
            ${refillSoon ? `<div class="mt-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-900">
              ${refillSoon ? `📅 Refill on ${fmtDay(m.refillDate)}` : ''}
            </div>` : ''}
          </li>`;
        }).join('')}
      </ul>
    </div>
    <p class="text-xs text-slate-400 text-center">⚠️ Not medical advice. Always consult your doctor.</p>
  </div>`;
};


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


/* ===================== v1.7: grouped doses, Smart add, Scan bill ===================== */
function groupDoses(doses) {
  const map = new Map();
  doses.forEach(d => { if (!map.has(d.med.id)) map.set(d.med.id, { med:d.med, slots:[] }); map.get(d.med.id).slots.push({ time:d.time, status:d.status }); });
  return [...map.values()];
}

function doseSummaryLI(g) {
  const taken = g.slots.filter(s => s.status === 'taken').length, all = taken === g.slots.length;
  return `<li class="flex items-center justify-between text-sm gap-2"><span class="text-slate-700 truncate">${esc(g.med.name)} · ${g.slots.map(s => fmtTime12(s.time)).join(', ')}</span>
    <span class="text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${all ? 'bg-teal-50 text-teal-700' : 'bg-amber-50 text-amber-700'}">${taken}/${g.slots.length} taken</span></li>`;
}

function groupedDosesHTML() {
  const now = new Date(), nm = now.getHours() * 60 + now.getMinutes();
  return groupDoses(todaysDoses()).map(g => `<li class="p-4">
    <div class="flex items-center gap-3 mb-2"><div class="w-10 h-10 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center">${ICONS.pill}</div>
      <div class="min-w-0"><p class="font-semibold text-slate-900">${esc(g.med.name)}</p><p class="text-xs text-slate-500">${esc(g.med.dosage)} · ${g.slots.length}× today</p></div></div>
    <div class="space-y-2">${g.slots.map(s => {
      const [h, m] = s.time.split(':').map(Number), up = s.status === 'pending' && nm < h * 60 + m;
      const cls = s.status === 'taken' ? 'bg-teal-50 text-teal-700' : s.status === 'skipped' ? 'bg-slate-100 text-slate-500' : up ? 'bg-slate-100 text-slate-600' : 'bg-amber-50 text-amber-700';
      return `<div class="flex items-center justify-between gap-2 bg-slate-50 rounded-lg px-3 py-2"><span class="text-sm font-medium text-slate-700">${fmtTime12(s.time)}</span>
        ${s.status === 'pending' && !up ? `<span class="flex gap-2"><button onclick="markDose('${g.med.id}','${s.time}','taken')" class="text-xs bg-teal-600 text-white font-medium px-3 py-1.5 rounded-lg">✓ Taken</button><button onclick="markDose('${g.med.id}','${s.time}','skipped')" class="text-xs bg-white border border-slate-300 text-slate-600 px-3 py-1.5 rounded-lg">Skip</button></span>`
        : `<span class="text-xs font-medium px-2.5 py-1 rounded-full ${cls}">${s.status === 'pending' ? 'Upcoming' : s.status}</span>`}</div>`;
    }).join('')}</div></li>`).join('');
}
