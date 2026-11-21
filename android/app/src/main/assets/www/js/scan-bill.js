/* =====================================================================
   scan-bill.js - scan a bill (camera/gallery), OCR with Tesseract.js, create expense.
   ===================================================================== */


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
