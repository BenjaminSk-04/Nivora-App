/* Backup & restore. All data lives on this device, so a backup file is the user's only safety net
   (uninstall, factory reset, lost phone, new phone).
   - Export: one JSON file, optionally encrypted with a password (PBKDF2 -> AES-256-GCM).
     On Android it opens the share sheet (save to Drive / Files / WhatsApp...); on the web it downloads.
   - Import: files are untrusted input, so every field is validated and rebuilt (clean()) before use.
     The previous data is kept for one-tap undo. */
const b64enc = buf => { const a = new Uint8Array(buf); let s = ''; for (let i = 0; i < a.length; i += 0x8000) s += String.fromCharCode.apply(null, a.subarray(i, i + 0x8000)); return btoa(s); };
const b64dec = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

const Backup = (() => {
  const FORMAT = 1, KDF_ITER = 600000, MAX_FILE = 25 * 1024 * 1024, NUDGE_DAYS = 30;
  const NOT_BACKUP = 'This is not a Nivora backup file.';
  const subtle = (typeof crypto !== 'undefined' && crypto.subtle) || null;
  const te = new TextEncoder(), td = new TextDecoder();
  const cap = window.Capacitor;
  const native = !!(cap && cap.isNativePlatform && cap.isNativePlatform());
  const plugin = n => { try { return native ? cap.registerPlugin(n) : null; } catch { return null; } };   // a missing plugin must never break the app
  const FS = plugin('Filesystem'), SH = plugin('Share');

  /* ---------- crypto ---------- */
  async function sha256(str) {
    if (!subtle) return null;
    return [...new Uint8Array(await subtle.digest('SHA-256', te.encode(str)))].map(x => x.toString(16).padStart(2, '0')).join('');
  }
  async function deriveKey(pass, salt, iter) {
    const km = await subtle.importKey('raw', te.encode(pass), 'PBKDF2', false, ['deriveKey']);
    return subtle.deriveKey({ name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' }, km, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }

  /* ---------- build the file ---------- */
  async function build(password) {
    const data = JSON.parse(JSON.stringify(state));
    const env = { app: 'nivora', format: FORMAT, schemaVersion: SCHEMA_VERSION, appVersion: APP_VERSION, exportedAt: new Date().toISOString() };
    const json = JSON.stringify(data);
    if (password) {
      const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
      const key = await deriveKey(password, salt, KDF_ITER);
      const ct = await subtle.encrypt({ name: 'AES-GCM', iv }, key, te.encode(json));
      Object.assign(env, { encrypted: true, kdf: { name: 'PBKDF2-SHA256', iterations: KDF_ITER, salt: b64enc(salt) },
                           cipher: { name: 'AES-256-GCM', iv: b64enc(iv) }, ciphertext: b64enc(ct) });
    } else {
      Object.assign(env, { encrypted: false, counts: { expenses: data.expenses.length, medicines: data.medicines.length }, checksum: await sha256(json), data });
    }
    return JSON.stringify(env);
  }
  async function decrypt(env, password) {
    const it = env.kdf && env.kdf.iterations;
    if (!(Number.isInteger(it) && it >= 100000 && it <= 2000000)) throw new Error('bad kdf');
    const key = await deriveKey(password, b64dec(env.kdf.salt), it);
    return td.decode(await subtle.decrypt({ name: 'AES-GCM', iv: b64dec(env.cipher.iv) }, key, b64dec(env.ciphertext)));
  }

  /* ---------- validation: rebuild a clean state from untrusted data ---------- */
  class BackupError extends Error {}
  const must = (c, msg) => { if (!c) throw new BackupError(msg); };
  const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
  const num = (v, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
  const txt = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  const SAFE_ID = /^[A-Za-z0-9_.:\-]{1,64}$/, ISO_DATE = /^\d{4}-\d{2}-\d{2}$/, HHMM = /^([01]?\d|2[0-3]):[0-5]\d$/;
  const safeName = n => typeof n === 'string' && GROUP_NAME_RE.test(n);
  const maybeDate = v => (v === null || v === undefined ? null : (must(typeof v === 'string' && ISO_DATE.test(v), 'a date is invalid'), v));
  const arr = (v, max, what) => { if (v === undefined || v === null) return []; must(Array.isArray(v) && v.length <= max, `${what} is invalid or too large`); return v; };

  function clean(raw) {
    must(isObj(raw), 'the file contains no data');
    let s;
    try { s = migrateState(JSON.parse(JSON.stringify(raw))); } catch { throw new BackupError('the data format is not supported'); }
    must(isObj(s.user), 'profile information is missing');
    must((Number(s.schemaVersion) || 1) <= SCHEMA_VERSION, 'it was made by a newer version of Nivora');
    const base = blankState({ name: '', email: '' });
    const out = { schemaVersion: SCHEMA_VERSION };

    const u = s.user, name = txt(u.name, 40) || 'Friend';
    out.user = { name, email: txt(u.email, 100), avatarInitials: initialsOf(name), largeText: !!u.largeText, notifications: u.notifications !== false,
                 lowBalanceThreshold: Math.max(0, num(u.lowBalanceThreshold, 1000)) };
    if (u.meKey !== undefined) { must(safeName(u.meKey), 'a name is invalid'); out.user.meKey = u.meKey; }

    out.budgets = {}; for (const c of CATEGORIES) out.budgets[c] = Math.max(0, num(s.budgets && s.budgets[c], base.budgets[c]));
    out.totalBudgetMonthly = Math.max(0, num(s.totalBudgetMonthly, base.totalBudgetMonthly));

    if (s.group !== undefined && s.group !== null) {
      must(isObj(s.group) && typeof s.group.name === 'string' && /^[\p{L}\p{N} .\-]{1,30}$/u.test(s.group.name), 'the group name is invalid');
      const ms = arr(s.group.members, 8, 'the group'); must(ms.length >= 1 && ms.every(safeName) && new Set(ms).size === ms.length, 'a group member name is invalid');
      out.group = { name: s.group.name, members: ms.slice() };
    }
    const members = out.group ? out.group.members : ['Aarav', 'Rohan', 'Priya'];
    must(members.includes(out.user.meKey || 'Aarav'), 'the group does not include you');

    out.expenses = arr(s.expenses, 100000, 'the expense list').map(e => {
      must(isObj(e) && SAFE_ID.test(e.id) && Number.isFinite(e.amount) && Math.abs(e.amount) <= 1e9 && typeof e.date === 'string' && ISO_DATE.test(e.date), 'an expense is invalid');
      must(safeName(e.paidBy), 'an expense has an invalid name');
      // category must be a known one: it is used for icon lookups and printed in screens
      const x = { id: e.id, amount: e.amount, category: CATEGORIES.includes(e.category) ? e.category : 'Other', date: e.date, notes: txt(e.notes, 1000), paidBy: e.paidBy,
                  receipt: typeof e.receipt === 'string' && /^data:image\/(jpeg|png|webp|gif);base64,[A-Za-z0-9+\/=]+$/.test(e.receipt) && e.receipt.length <= 3000000 ? e.receipt : null, split: null };
      if (e.settlement === true) x.settlement = true;
      if (e.split !== null && e.split !== undefined) {
        const sp = e.split; must(isObj(sp) && isObj(sp.shares), 'a split is invalid');
        const ms = arr(sp.members, 8, 'a split'); must(ms.every(m => safeName(m) && members.includes(m)), 'a split uses a person who is not in the group');
        const shares = {}; for (const [k, v] of Object.entries(sp.shares)) { must(ms.includes(k) && Number.isFinite(v), 'a split amount is invalid'); shares[k] = v; }
        x.split = { members: ms.slice(), mode: ['equal', 'exact', 'percent', 'shares'].includes(sp.mode) ? sp.mode : 'equal', shares };
      }
      return x;
    });

    out.medicines = arr(s.medicines, 500, 'the medicine list').map(m => {
      must(isObj(m) && SAFE_ID.test(m.id) && txt(m.name, 100), 'a medicine is invalid');
      const times = arr(m.times, 12, 'medicine times'); must(times.length >= 1 && times.every(t => typeof t === 'string' && HHMM.test(t)), 'a medicine time is invalid');
      const log = {};
      if (m.log !== undefined && m.log !== null) {
        must(isObj(m.log), 'a medicine log is invalid');
        for (const [d, day] of Object.entries(m.log)) {
          must(ISO_DATE.test(d) && isObj(day), 'a medicine log is invalid'); log[d] = {};
          for (const [t, st] of Object.entries(day)) { must(HHMM.test(t) && (st === 'taken' || st === 'skipped'), 'a medicine log entry is invalid'); log[d][t] = st; }
        }
      }
      return { id: m.id, name: txt(m.name, 100), salt: txt(m.salt, 150), dosage: txt(m.dosage, 60),
               frequency: ['daily', 'alternate', 'weekly'].includes(m.frequency) ? m.frequency : 'daily', times: times.slice(),
               startDate: maybeDate(m.startDate) || todayISO(), endDate: maybeDate(m.endDate), refillDate: maybeDate(m.refillDate),
               stock: Math.max(0, num(m.stock, 0)), active: m.active !== false, log };
    });

    out.notifications = arr(s.notifications, 500, 'the notification list').slice(0, 50).map(n => {
      must(isObj(n), 'a notification is invalid');
      return { id: txt(n.id, 64).replace(/[^A-Za-z0-9_.:\-]/g, '_') || 'n', title: txt(n.title, 200), body: txt(n.body, 500), at: txt(n.at, 40) };
    });

    out.profiles = {};
    if (isObj(s.profiles)) {
      const first = Object.values(s.profiles).find(isObj);
      if (first) {
        const p = {}, d = blankProfile();
        for (const k of Object.keys(d)) {
          if (Array.isArray(d[k])) p[k] = arr(first[k], 20, 'a profile list').filter(v => typeof v === 'string').map(v => v.slice(0, 60));
          else if (typeof d[k] === 'boolean') p[k] = !!first[k]; else p[k] = txt(first[k], 200);
        }
        out.profiles = { [profileKeyFor(out.user)]: p };
      }
    }

    const x = isObj(s.ext) ? s.ext : {}, upi = {}, alerted = {};
    if (isObj(x.upi)) for (const [k, v] of Object.entries(x.upi)) if (safeName(k) && typeof v === 'string') upi[k] = v.slice(0, 100);
    if (isObj(x.alerted)) for (const [k, v] of Object.entries(x.alerted)) if (typeof v === 'boolean' || Number.isFinite(v)) alerted[String(k).slice(0, 80)] = v;
    out.ext = { balance: Number.isFinite(x.balance) ? x.balance : null, lowAt: Math.max(0, num(x.lowAt, 1000)),
      bills: arr(x.bills, 200, 'the bills list').map(b => {
        must(isObj(b) && typeof b.id === 'string' && SAFE_ID.test(b.id) && Number.isFinite(b.amount), 'a bill is invalid');
        return { id: b.id, title: txt(b.title, 100), amount: b.amount, dueDay: Math.min(31, Math.max(1, Math.round(num(b.dueDay, 1)))), paidMonth: b.paidMonth ? txt(b.paidMonth, 10) : null };
      }),
      caregiver: { name: txt(x.caregiver && x.caregiver.name, 100), phone: txt(x.caregiver && x.caregiver.phone, 30) }, upi, alerted };

    return out;
  }

  /* ---------- parse a file's text ---------- */
  async function parse(text, password) {
    let env; try { env = JSON.parse(text); } catch { return { error: NOT_BACKUP }; }
    if (!isObj(env) || env.app !== 'nivora' || typeof env.format !== 'number') return { error: NOT_BACKUP };
    if (env.format > FORMAT) return { error: 'This backup was made by a newer version of Nivora. Please update the app first.' };
    let data;
    if (env.encrypted) {
      if (!subtle) return { error: 'Encrypted backups can only be opened in the Android app or a secure (https) page.' };
      if (!password) return { needsPassword: true };
      try { data = JSON.parse(await decrypt(env, password)); } catch { return { wrongPassword: true }; }
    } else {
      data = env.data;
      if (subtle && (await sha256(JSON.stringify(data))) !== env.checksum) return { error: 'This backup file is damaged or was edited, so it cannot be imported.' };
    }
    try { return { data: clean(data), meta: { exportedAt: env.exportedAt, encrypted: !!env.encrypted } }; }
    catch (e) { return { error: e instanceof BackupError ? `This backup cannot be imported: ${e.message}.` : 'This backup could not be read.' }; }
  }

  /* ---------- on-device bookkeeping ---------- */
  const mkey = () => 'nivora_backup_' + (currentUser ? currentUser.id : '');
  const ukey = () => 'nivora_undo_' + (currentUser ? currentUser.id : '');
  const getMeta = () => { try { return JSON.parse(store.get(mkey()) || '{}'); } catch { return {}; } };
  const setMeta = m => store.set(mkey(), JSON.stringify({ ...getMeta(), ...m }));
  const hasData = () => state.expenses.length + state.medicines.length > 0;
  const daysSince = iso => (Date.now() - new Date(iso).getTime()) / 864e5;
  const needsBackup = () => { if (!currentUser || isDemo() || !hasData()) return false; const b = getMeta().lastBackupAt; return !b || daysSince(b) > NUDGE_DAYS; };
  const statusText = () => { const b = getMeta().lastBackupAt;
    if (!b) return hasData() ? '⚠️ Not backed up yet' : 'No backup yet (nothing to back up)';
    return `Last backup: ${new Date(b).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}` + (daysSince(b) > NUDGE_DAYS ? ' — over a month ago, back up again' : ''); };

  /* ---------- save / share the file ---------- */
  async function save(filename, text) {
    if (FS && SH) {
      const prev = store.get('nivora_cache_backup');
      if (prev) { try { await FS.deleteFile({ path: prev, directory: 'CACHE' }); } catch {} }   // do not leave old health data in the cache
      const r = await FS.writeFile({ path: filename, data: text, directory: 'CACHE', encoding: 'utf8' });
      store.set('nivora_cache_backup', filename);
      await SH.share({ title: 'Nivora backup', text: 'Nivora backup file', files: [r.uri], dialogTitle: 'Save your Nivora backup' });
      return 'shared';
    }
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    return 'downloaded';
  }

  /* ---------- screens ---------- */
  const inp = 'mt-1 w-full px-3 py-2.5 border border-slate-300 rounded-lg';
  function openExport() {
    openModal('Export backup', `<form id="bkForm" class="space-y-3">
      <p class="text-sm text-slate-600">Saves all your data (expenses, medicines, profile) into one file. Keep it somewhere safe, such as Google Drive or your computer.</p>
      ${subtle ? `<label class="block text-sm font-medium">Password (optional, recommended)
        <input type="password" id="bkPass" autocomplete="new-password" class="${inp}" placeholder="Leave empty for no password" /></label>
        <p class="text-xs text-slate-500">The file contains health information. With a password it is encrypted. <b>If you forget the password, the backup cannot be opened by anyone.</b></p>` : ''}
      <button type="submit" class="w-full bg-teal-600 text-white font-semibold py-2.5 rounded-lg">Create backup</button></form>`, (root) => {
      root.querySelector('#bkForm').addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const pw = subtle ? root.querySelector('#bkPass').value : '';
        if (pw && pw.length < 6) return toast('Use a password of at least 6 characters', 'error');
        const btn = root.querySelector('button[type=submit]'); btn.disabled = true; btn.textContent = 'Creating…';
        try {
          const how = await save(`nivora-backup-${todayISO()}.json`, await build(pw));
          setMeta({ lastBackupAt: new Date().toISOString() }); closeModal();
          toast(how === 'shared' ? 'Choose where to save your backup' : 'Backup downloaded', 'success');
          if (typeof render === 'function') render();
        } catch (e) { btn.disabled = false; btn.textContent = 'Create backup'; if (!/cancel/i.test(String(e && e.message))) toast('Could not create the backup. Please try again.', 'error'); }
      });
    });
  }

  function askPassword(text, then) {
    openModal('Backup password', `<form id="pwForm" class="space-y-3"><p class="text-sm text-slate-600">This backup is password-protected.</p>
      <label class="block text-sm font-medium">Password<input type="password" id="pwIn" autocomplete="off" class="${inp}" /></label>
      <button type="submit" class="w-full bg-teal-600 text-white font-semibold py-2.5 rounded-lg">Open backup</button></form>`, (root) => {
      root.querySelector('#pwForm').addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const btn = root.querySelector('button[type=submit]'); btn.disabled = true;
        const r = await parse(text, root.querySelector('#pwIn').value); btn.disabled = false;
        if (r.wrongPassword) return toast('Wrong password, or the file is damaged.', 'error');
        closeModal(); then(r);
      });
    });
  }
  async function readFile(file, then) {
    if (!file) return;
    if (file.size > MAX_FILE) return toast('That file is too large to be a Nivora backup.', 'error');
    let text; try { text = await file.text(); } catch { return toast('Could not read that file.', 'error'); }
    const r = await parse(text, null);
    if (r.needsPassword) return askPassword(text, then);
    if (r.error) return toast(r.error, 'error');
    then(r);
  }
  const summary = d => `${d.expenses.length} expense${d.expenses.length === 1 ? '' : 's'}, ${d.medicines.length} medicine${d.medicines.length === 1 ? '' : 's'}`;
  const when = m => (m.exportedAt ? new Date(m.exportedAt).toLocaleString() : 'unknown date');

  /* Settings → Import: replaces this profile's data, keeping its name. */
  function onFile(input) {
    const f = input.files && input.files[0]; input.value = '';
    if (isDemo()) return toast('Create your own profile to import a backup.', 'error');
    readFile(f, ({ data, meta }) => {
      openModal('Import this backup?', `<p class="text-sm text-slate-600 mb-3">Backup from <b>${esc(when(meta))}</b>: ${esc(summary(data))}.</p>
        <p class="text-sm text-red-700 bg-red-50 rounded-lg p-3 mb-4">This <b>replaces all current data</b> on this profile. You can undo it afterwards from Settings.</p>
        <div class="flex gap-2"><button onclick="closeModal()" class="flex-1 border py-2.5 rounded-lg">Cancel</button>
        <button id="impGo" class="flex-1 bg-teal-600 text-white font-semibold py-2.5 rounded-lg">Replace my data</button></div>`,
        (root) => { root.querySelector('#impGo').onclick = () => { closeModal(); applyImport(data); }; });
    });
  }
  function applyImport(data) {
    store.set(ukey(), JSON.stringify(state));                                  // one-level undo
    const keep = { name: state.user.name, email: state.user.email, avatarInitials: state.user.avatarInitials };
    state = { ...data, user: { ...data.user, ...keep } };
    const p = Object.values(data.profiles)[0]; state.profiles = p ? { [profileKeyFor(state.user)]: p } : {};
    ensureExt(); applyUiPrefs(); saveState(); setMeta({ lastImportAt: new Date().toISOString() });
    navigate('/dashboard'); if (typeof render === 'function') render(); toast('Backup imported ✓', 'success');
  }
  function undo() {
    let prev; try { prev = JSON.parse(store.get(ukey())); } catch { prev = null; }
    if (!prev) return toast('Nothing to undo.', 'error');
    openModal('Undo the last import?', `<p class="text-sm text-slate-600 mb-4">Your data goes back to how it was before the import.</p>
      <div class="flex gap-2"><button onclick="closeModal()" class="flex-1 border py-2.5 rounded-lg">Cancel</button>
      <button id="undoGo" class="flex-1 bg-teal-600 text-white font-semibold py-2.5 rounded-lg">Undo import</button></div>`, (root) => {
      root.querySelector('#undoGo').onclick = () => {
        closeModal(); state = migrateState(prev); ensureExt(); applyUiPrefs(); store.remove(ukey()); saveState(); render(); toast('Previous data restored', 'success');
      };
    });
  }

  /* First-launch screen: create a profile from a backup (new phone). */
  function restoreAsNewProfile(input) {
    const f = input.files && input.files[0]; input.value = '';
    readFile(f, ({ data, meta }) => {
      openModal('Restore this backup?', `<p class="text-sm text-slate-600 mb-4">Backup from <b>${esc(when(meta))}</b> for <b>${esc(data.user.name)}</b>: ${esc(summary(data))}.</p>
        <div class="flex gap-2"><button onclick="closeModal()" class="flex-1 border py-2.5 rounded-lg">Cancel</button>
        <button id="rsGo" class="flex-1 bg-teal-600 text-white font-semibold py-2.5 rounded-lg">Restore</button></div>`, (root) => {
        root.querySelector('#rsGo').onclick = () => {
          closeModal();
          const p = createProfile(data.user.name); if (!p) return;
          state = { ...data, user: { ...data.user, name: p.name, email: '', avatarInitials: initialsOf(p.name) } };
          const pr = Object.values(data.profiles)[0]; state.profiles = pr ? { [profileKeyFor(state.user)]: pr } : {};
          ensureExt(); applyUiPrefs(); saveState(); setMeta({ lastImportAt: new Date().toISOString() });
          NativeAlarms.requestSync(); toast('Backup restored ✓', 'success'); navigate('/dashboard');
        };
      });
    });
  }

  return { openExport, onFile, undo, restoreAsNewProfile, needsBackup, statusText, parse, build,
           hasUndo: () => !!store.get(ukey()), isNative: native };
})();

/* ---------- pieces of UI that live in other screens ---------- */
function backupCardHTML() {
  const demo = isDemo(), warn = Backup.needsBackup();
  return `<div class="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 space-y-3">
      <h2 class="font-bold text-slate-900">Backup &amp; restore</h2>
      <p class="text-sm text-slate-600">Your data is stored <b>only on this phone</b>. If you uninstall Nivora, reset the phone or lose it, the data is gone, so keep a backup.</p>
      <p class="text-sm ${warn ? 'text-amber-700 font-medium' : 'text-slate-500'}">${esc(Backup.statusText())}</p>
      <div class="flex gap-2">
        <button onclick="Backup.openExport()" class="flex-1 bg-teal-600 hover:bg-teal-700 text-white font-semibold py-2.5 rounded-lg">Export backup</button>
        <button onclick="document.getElementById('importFile').click()" ${demo ? 'disabled' : ''} class="flex-1 border border-slate-300 font-semibold py-2.5 rounded-lg ${demo ? 'opacity-50' : ''}">Import backup</button>
      </div>
      <input type="file" id="importFile" style="display:none" onchange="Backup.onFile(this)" />
      ${demo ? '<p class="text-xs text-slate-500">Import is available on your own profile.</p>' : ''}
      ${Backup.hasUndo() ? '<button onclick="Backup.undo()" class="w-full text-left py-1 text-slate-700 hover:text-teal-700 font-medium">↩️ Undo last import</button>' : ''}
    </div>`;
}
function backupNudgeHTML() {
  if (!Backup.needsBackup() || sessionStorage.getItem('nivora_nudge_off')) return '';
  return `<div class="bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl p-4 mb-4 flex items-start gap-3">
      <div class="text-xl">💾</div>
      <div class="flex-1 text-sm"><p class="font-semibold">Back up your data</p>
        <p class="mt-0.5">Everything is stored only on this phone. Save a backup so you never lose it.</p>
        <button onclick="Backup.openExport()" class="mt-2 bg-amber-600 text-white font-semibold px-3 py-1.5 rounded-lg">Back up now</button></div>
      <button onclick="sessionStorage.setItem('nivora_nudge_off','1'); render()" class="text-amber-700 text-lg leading-none" aria-label="Dismiss">×</button>
    </div>`;
}
