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

/* ---- Scan bill: camera / gallery -> OCR -> confirm -> expense with receipt ---- */
let scanKind = 'personal';
function loadImg(file) { return new Promise((res, rej) => { const u = URL.createObjectURL(file), i = new Image(); i.onload = () => { res(i); setTimeout(() => URL.revokeObjectURL(u), 3000); }; i.onerror = () => rej(new Error('img')); i.src = u; }); }
function jpegOf(img, max, q) { const s = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', q); }
function loadTesseract() {
  return new Promise((res, rej) => {
    if (window.Tesseract) return res(window.Tesseract);
    const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
    s.onload = () => window.Tesseract ? res(window.Tesseract) : rej(new Error('ocr')); s.onerror = () => rej(new Error('offline')); document.head.appendChild(s);
  });
}
async function ocrText(dataUrl) {
  const T = await loadTesseract();
  const r = await Promise.race([T.recognize(dataUrl, 'eng'), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 60000))]);
  return r.data.text || '';
}
function parseBillText(txt) {
  const lines = txt.split(/\n/).map(l => l.trim()).filter(Boolean), nums = l => (l.match(/\d[\d,]*\.\d{2}|\d[\d,]{2,}/g) || []).map(numOf).filter(n => n > 0 && n < 1000000);
  let amount = NaN;
  const tot = lines.filter(l => /grand\s*total|net\s*(amount|payable)|total|amount\s*payable|bill\s*amount|\bamt\b/i.test(l)).flatMap(l => nums(l).slice(-1));
  if (tot.length) amount = Math.max(...tot); else { const all = lines.flatMap(nums); if (all.length) amount = Math.max(...all); }
  let date = todayISO(); const dm = txt.match(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/);
  if (dm) { let [, d, m, y] = dm.map(Number); if (y < 100) y += 2000; const iso = `${y}-${pad(m)}-${pad(d)}`; if (m >= 1 && m <= 12 && d >= 1 && d <= 31 && iso <= todayISO()) date = iso; }
  const shop = lines.find(l => (l.match(/[A-Za-z]/g) || []).length >= 4 && !/^(tax\s*)?(invoice|bill|receipt|gst|cash memo)/i.test(l));
  return { amount, date, shop: shop ? shop.replace(/[^\w &.'-]/g, '').slice(0, 40).trim() : '', medical: /pharma|chemist|medical|medico|clinic|hospital|diagnostic|\blab\b|tablet|\btab\b|capsule|syrup|doctor|\bdr\./i.test(txt) };
}
function openScanBill() {
  const kindBtn = (k, label) => `<button type="button" data-k="${k}" class="py-2 rounded-lg text-sm font-semibold border ${scanKind === k ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-slate-600 border-slate-300'}">${label}</button>`;
  openModal('📷 Scan a bill', `<div class="space-y-3">
    <div class="grid grid-cols-2 gap-2" id="scKind">${kindBtn('personal', '🧾 Personal bill')}${kindBtn('medical', '🩺 Medical bill')}</div>
    <div class="grid grid-cols-2 gap-3">
      <button id="scCam" class="rounded-2xl bg-gradient-to-br from-teal-600 to-teal-700 text-white p-4 text-center"><div class="text-3xl">📷</div><p class="font-semibold text-sm mt-1">Take photo</p></button>
      <button id="scGal" class="rounded-2xl bg-slate-100 text-slate-800 p-4 text-center"><div class="text-3xl">🖼️</div><p class="font-semibold text-sm mt-1">Choose photo</p></button></div>
    <p class="text-xs text-slate-500">Reads the total, date and shop name right in your browser. You check everything before it's saved, and the photo is kept as the receipt.</p>
    <div id="scOut"></div></div>`, root => {
    const out = root.querySelector('#scOut');
    const mk = cap => { const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; if (cap) i.capture = 'environment'; i.onchange = () => i.files[0] && handleBillFile(i.files[0], root, out); return i; };
    const cam = mk(true), gal = mk(false);
    root.querySelector('#scCam').onclick = () => cam.click(); root.querySelector('#scGal').onclick = () => gal.click();
    root.querySelectorAll('#scKind [data-k]').forEach(b => b.onclick = () => {
      scanKind = b.dataset.k;
      root.querySelectorAll('#scKind [data-k]').forEach(x => x.className = `py-2 rounded-lg text-sm font-semibold border ${x.dataset.k === scanKind ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-slate-600 border-slate-300'}`);
      const sel = root.querySelector('#scCat'); if (sel) sel.value = scanKind === 'medical' ? 'Health' : autoCategorize(root.querySelector('#scNotes')?.value || '');
    });
  });
}
async function handleBillFile(file, root, out) {
  out.innerHTML = '<p class="text-sm text-slate-600 animate-pulse">🔍 Reading your bill…</p>';
  let img, receipt, parsed = null, note = '';
  try { img = await loadImg(file); } catch { out.innerHTML = '<p class="text-sm text-red-600">Could not open that image.</p>'; return; }
  receipt = jpegOf(img, 900, .6); if (receipt.length > 250000) receipt = jpegOf(img, 900, .4);
  if (receipt.length > 400000) { out.innerHTML = '<p class="text-sm text-red-600">That photo is too large to store. Try a closer crop.</p>'; return; }
  try { parsed = parseBillText(await ocrText(jpegOf(img, 1400, .85))); } catch { note = 'Couldn\'t auto-read this one (offline or blurry). Enter the total below.'; }
  if (parsed && parsed.medical) scanKind = 'medical';
  const notes = parsed ? (parsed.shop || (scanKind === 'medical' ? 'Pharmacy bill' : '')) : '';
  const cat = scanKind === 'medical' ? 'Health' : autoCategorize(notes);
  root.querySelectorAll('#scKind [data-k]').forEach(x => x.className = `py-2 rounded-lg text-sm font-semibold border ${x.dataset.k === scanKind ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-slate-600 border-slate-300'}`);
  out.innerHTML = `<form id="scForm" class="space-y-3"><img src="${esc(receipt)}" alt="Bill" class="w-full max-h-40 object-cover rounded-xl border"/>
    ${note ? `<p class="text-xs text-amber-700">${note}</p>` : '<p class="text-xs text-teal-700">✓ Read your bill. Please double-check the details.</p>'}
    <div class="grid grid-cols-2 gap-3"><label class="block text-sm font-medium">Total (₹)<input name="amount" type="number" step="0.01" min="1" value="${parsed && parsed.amount > 0 ? parsed.amount : ''}" class="${inCls}"/></label>
      <label class="block text-sm font-medium">Date<input name="date" type="date" max="${todayISO()}" value="${parsed ? parsed.date : todayISO()}" class="${inCls}"/></label></div>
    <label class="block text-sm font-medium">Shop / note<input id="scNotes" name="notes" value="${esc(notes)}" class="${inCls}"/></label>
    <label class="block text-sm font-medium">Category<select id="scCat" name="category" class="${inCls}">${catOptions(cat)}</select></label>
    <button class="w-full bg-teal-600 text-white font-semibold py-2.5 rounded-lg">Save expense with receipt</button></form>`;
  out.querySelector('#scForm').onsubmit = ev => {
    ev.preventDefault(); const fd = new FormData(ev.target), amt = Number(fd.get('amount'));
    if (!(amt > 0)) return toast('Enter the bill total', 'error');
    closeModal(); pushExpense({ amount:amt, category:fd.get('category'), notes:String(fd.get('notes')).trim() || (scanKind === 'medical' ? 'Medical bill' : 'Bill'), date:fd.get('date') || todayISO(), receipt });
  };
}
function homeShortcutsHTML() {
  const nb = unpaidBills().map(b => ({ b, d: nextDue(b) })).sort((a, c) => a.d - c.d)[0];
  const sub = nb ? `${esc(nb.b.title)} · ${nb.d.toLocaleDateString('en-IN', { day:'numeric', month:'short' })}` : 'Rent, WiFi…';
  const t = (icon, label, hint, fn, cls) => `<button onclick="${fn}" class="${cls || 'bg-white border border-slate-100 text-slate-900'} rounded-2xl p-3 shadow-sm text-center active:scale-95 transition"><div class="text-2xl">${icon}</div><p class="text-sm font-semibold mt-1">${label}</p><p class="text-[11px] opacity-70 truncate">${hint}</p></button>`;
  return `<div class="grid grid-cols-3 gap-3">${t('✨', 'Smart add', 'type or paste SMS', "openSmartAdd('')")}${t('📷', 'Scan bill', 'camera or photo', 'openScanBill()', 'bg-gradient-to-br from-teal-600 to-teal-700 text-white')}${t('💳', 'Bills', sub, 'openBills()')}</div>`;
}

window.addEventListener('hashchange', render);
window.addEventListener('load', render);
