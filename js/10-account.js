/* Profiles: just a NAME, stored on this device. No server, no email, no password.
   Several people can share one phone (each profile has its own data). */
const PROFILES_KEY = 'nivora_profiles', SESSION_KEY = 'nivora_session';
const NAME_RE = /^[\p{L}\p{N} .'\-]{1,40}$/u;

const cleanName = s => String(s || '').trim().replace(/\s+/g, ' ');
const profiles = () => { try { const a = JSON.parse(store.get(PROFILES_KEY) || '[]'); return Array.isArray(a) ? a.filter(p => p && /^p_[0-9a-f]{8,}$/.test(p.id) && typeof p.name === 'string') : []; } catch { return []; } };
const saveProfiles = a => store.set(PROFILES_KEY, JSON.stringify(a));
const isDemo = () => !!currentUser && currentUser.id === 'demo';
const newId = () => { const a = new Uint8Array(6); (window.crypto || {}).getRandomValues ? crypto.getRandomValues(a) : a.forEach((_, i) => a[i] = Math.random() * 256); return 'p_' + [...a].map(x => x.toString(16).padStart(2, '0')).join(''); };

/* Make `p` the open profile and load its on-device data (or start empty). */
function openProfile(p) {
  currentUser = { id: p.id, email: p.id + '@device.local', username: p.name };
  STORE_KEY = 'nivora_state_' + p.id;
  let cached = null; const raw = store.get(STORE_KEY);
  if (raw) {
    try { cached = JSON.parse(raw); }
    catch { store.set('nivora_corrupt_' + p.id, raw); toast('Your saved data could not be read. A copy was kept on this device.', 'error'); }
  }
  state = (cached && cached.user) ? migrateState(cached) : blankState({ name: p.name, email: currentUser.email });
  ensureExt(); applyUiPrefs(); persistLocal(); store.set(SESSION_KEY, p.id);
}
function openDemo() {
  currentUser = { id: 'demo', email: DEMO_USER.email, username: DEMO_USER.name };
  STORE_KEY = 'nivora_state_demo';
  const raw = store.get(STORE_KEY); let cached = null; try { cached = raw ? JSON.parse(raw) : null; } catch {}
  state = (cached && cached.user) ? migrateState(cached) : freshState();
  ensureExt(); applyUiPrefs(); persistLocal(); store.set(SESSION_KEY, 'demo');
}
function closeProfile() {
  store.remove(SESSION_KEY); currentUser = null; STORE_KEY = null;
  state = blankState({ name: '', email: '' }); ensureExt(); applyUiPrefs();
  if (typeof NativeAlarms !== 'undefined') NativeAlarms.requestSync();   // no open profile -> alarms cancelled
}
function createProfile(rawName) {
  const name = cleanName(rawName);
  if (!NAME_RE.test(name)) { toast('Please enter your name (letters, numbers, spaces, . \' -), up to 40 characters', 'error'); return null; }
  const list = profiles();
  if (list.some(p => p.name.toLowerCase() === name.toLowerCase())) { toast('A profile with this name already exists on this phone. Tap it above to continue.', 'error'); return null; }
  const p = { id: newId(), name, createdAt: new Date().toISOString() };
  if (!saveProfiles([...list, p])) { toast('This device cannot save data (storage is disabled or full).', 'error'); return null; }
  openProfile(p); return p;
}
function removeProfileData(id) {
  ['nivora_state_', 'nivora_backup_', 'nivora_undo_', 'nivora_corrupt_'].forEach(k => store.remove(k + id));
  saveProfiles(profiles().filter(p => p.id !== id));
}

/* ---------- actions used by the screens ---------- */
function afterOpen() {
  if (typeof NativeAlarms !== 'undefined') NativeAlarms.requestSync();
  if (!getProfile()) { setProfile(blankProfile()); obReset(); navigate('/onboarding'); return; }
  navigate('/dashboard');
}
function handleStart() {
  const p = createProfile($('#profileName').value);
  if (!p) return;
  toast(`Welcome, ${p.name} 👋`, 'success'); afterOpen();
}
function continueAs(id) {
  const p = profiles().find(x => x.id === id); if (!p) return;
  openProfile(p); afterOpen();
}
function startDemo() { openDemo(); if (typeof NativeAlarms !== 'undefined') NativeAlarms.requestSync(); toast('Exploring with sample data', 'info'); navigate('/dashboard'); }
function logout() {   // "Switch profile": data stays on the device
  closeModal();
  if (!isDemo() && state.user.notifications && state.medicines.some(m => m.active) &&
      !confirm('Medicine reminders only ring for the profile that is open. Switch profile anyway?')) return;
  closeProfile(); navigate('/login');
}
function openDeleteProfile() {
  openModal('Delete this profile?', `
    <p class="text-slate-600 text-sm mb-3">This permanently deletes <b>${esc(state.user.name)}</b> and <b>all</b> its data from this phone. It cannot be undone unless you have a backup.</p>
    <form id="delForm" class="space-y-3">
      <label class="block text-sm font-medium">Type DELETE to confirm
        <input id="delConfirm" autocomplete="off" class="mt-1 w-full px-3 py-2.5 border border-slate-300 rounded-lg" /></label>
      <div class="flex gap-2"><button type="button" onclick="closeModal()" class="flex-1 border py-2.5 rounded-lg">Cancel</button>
        <button type="submit" class="flex-1 bg-red-600 text-white font-semibold py-2.5 rounded-lg">Delete everything</button></div>
    </form>`, (root) => {
    root.querySelector('#delForm').addEventListener('submit', (ev) => {
      ev.preventDefault();
      if (root.querySelector('#delConfirm').value.trim() !== 'DELETE') return toast('Type DELETE exactly to confirm', 'error');
      const id = currentUser.id; closeModal(); closeProfile(); removeProfileData(id);
      navigate('/login'); toast('Profile and data deleted from this phone.', 'success');
    });
  });
}

/* ---------- screens ---------- */
views['/login'] = views['/signup'] = views['/forgot'] = () => {
  const list = profiles();
  return `<div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 to-slate-50 p-4">
    <div class="w-full max-w-sm bg-white rounded-2xl shadow-xl p-6 sm:p-8">
      <div class="text-center mb-2 flex flex-col items-center">${LOGO_FULL}<h1 class="text-xl font-extrabold text-slate-900 mt-1">Welcome to Nivora</h1>
        <p class="text-sm text-slate-500 mt-1">Track expenses and medicines. No account, no internet needed.</p></div>
      ${list.length ? `<div class="mt-4"><p class="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Continue as</p>
        <div class="space-y-2">${list.map(p => `<button onclick="continueAs('${p.id}')" class="w-full flex items-center gap-3 text-left border border-slate-200 hover:border-teal-400 rounded-xl px-3 py-2.5">
          <span class="w-9 h-9 rounded-full bg-teal-100 text-teal-800 font-bold flex items-center justify-center">${esc(initialsOf(p.name))}</span>
          <span class="font-medium text-slate-800 truncate">${esc(p.name)}</span></button>`).join('')}</div></div>` : ''}
      <form onsubmit="event.preventDefault(); handleStart()" class="space-y-3 mt-4">
        <label class="block"><span class="text-sm font-medium text-slate-700">${list.length ? 'Or add another person' : 'What is your name?'}</span>
          <input type="text" id="profileName" maxlength="40" required autocomplete="given-name" placeholder="Your name"
            class="mt-1 w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:border-teal-500 outline-none" /></label>
        <button type="submit" class="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold py-3 rounded-xl transition">${list.length ? 'Add profile' : 'Get started'}</button>
      </form>
      <p class="text-xs text-slate-500 mt-3">Your data is stored <b>only on this phone</b>. Save a backup from Settings so you never lose it.</p>
      <div class="mt-4 pt-4 border-t border-slate-100 flex flex-col gap-2 text-sm">
        <button onclick="document.getElementById('restoreFile').click()" class="text-teal-700 font-medium hover:underline">📂 I have a backup — restore it</button>
        <button onclick="startDemo()" class="text-slate-500 hover:text-slate-700">👀 Just explore with sample data</button>
      </div>
      <input type="file" id="restoreFile" style="display:none" onchange="Backup.restoreAsNewProfile(this)" />
    </div></div>`;
};

/* Settings → "Profile" card */
function accountCardHTML() {
  if (isDemo()) return `<div class="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 space-y-2">
      <h2 class="font-bold text-slate-900 mb-2">Sample data</h2>
      <p class="text-sm text-slate-600">You are exploring with sample data. Nothing here is yours.</p>
      <button onclick="confirmReset()" class="w-full text-left py-2 text-slate-700 hover:text-teal-700 font-medium">🔄 Reset sample data</button>
      <button onclick="logout()" class="w-full text-left py-2 text-slate-700 hover:text-teal-700 font-medium">🚪 Leave sample data and create my profile</button>
    </div>`;
  return `<div class="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 space-y-2">
      <h2 class="font-bold text-slate-900 mb-2">Profile</h2>
      <p class="text-sm text-slate-600">Signed in as <b>${esc(state.user.name)}</b>. Stored only on this phone.</p>
      <button onclick="logout()" class="w-full text-left py-2 text-slate-700 hover:text-teal-700 font-medium">🔄 Switch profile</button>
      <button onclick="openDeleteProfile()" class="w-full text-left py-2 text-red-600 hover:text-red-700 font-medium">🗑️ Delete this profile and its data</button>
    </div>`;
}

/* ---------- open the last used profile ---------- */
(function restoreSession() {
  const sid = store.get(SESSION_KEY);
  if (sid === 'demo') return openDemo();
  const p = profiles().find(x => x.id === sid);
  if (p) openProfile(p); else if (sid) store.remove(SESSION_KEY);
})();
