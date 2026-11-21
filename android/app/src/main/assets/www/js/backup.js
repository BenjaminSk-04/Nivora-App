/* =====================================================================
   backup.js - export/import backups (uses window.AndroidBridge inside the Android app).
   ===================================================================== */

/* ---------- Backup & Restore ----------
   In the Android app, window.AndroidBridge.saveBackup()/pickBackup() are injected by
   MainActivity.kt and use Android's Storage Access Framework so the user picks a real
   file location (Downloads, Drive, etc). In a plain browser there is no such bridge,
   so we fall back to a normal <a download> Blob and a hidden <input type=file>. */
function setBackupStatus(msg) { const el = document.getElementById('backupLastAction'); if (el) el.textContent = msg; }

function backupPayload() {
  return JSON.stringify({ app:'nivora', exportedAt:new Date().toISOString(), schemaVersion:SCHEMA_VERSION, state }, null, 2);
}

function exportBackup() {
  const payload = backupPayload();
  const filename = `nivora-backup-${todayISO()}.json`;
  if (window.AndroidBridge && typeof AndroidBridge.saveBackup === 'function') {
    setBackupStatus('Choose where to save your backup…');
    AndroidBridge.saveBackup(payload, filename);
    return;
  }
  try {
    const blob = new Blob([payload], { type:'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
    setBackupStatus(`Downloaded ${filename}`);
  } catch {
    toast('Could not create the backup file.', 'error');
  }
}
/* Called by MainActivity.kt via evaluateJavascript once the SAF write finishes (or fails). */
window.onBackupSaved = (ok) => {
  setBackupStatus(ok ? 'Backup saved.' : 'Backup was not saved.');
  toast(ok ? 'Backup saved' : 'Backup was not saved', ok ? 'success' : 'error');
};


function applyImportedState(incoming) {
  state = migrateState(incoming);
  saveState();
  toast('Backup restored', 'success');
  setBackupStatus('Backup restored.');
  navigate('/dashboard'); render();
}

function confirmImportState(incoming) {
  openModal('Restore this backup?', `
    <p class="text-slate-600 mb-4">This replaces everything currently in the app — expenses, medicines, budgets and your profile — with the contents of this backup. This cannot be undone.</p>
    <div class="flex gap-2">
      <button onclick="closeModal()" class="flex-1 border py-2.5 rounded-lg">Cancel</button>
      <button id="confirmImportBtn" class="flex-1 bg-teal-600 text-white font-semibold py-2.5 rounded-lg">Restore</button>
    </div>`, root => {
    root.querySelector('#confirmImportBtn').onclick = () => { closeModal(); applyImportedState(incoming); };
  });
}

function parseBackupJSON(text) {
  let data; try { data = JSON.parse(text); } catch { return null; }
  const incoming = (data && typeof data === 'object' && data.state) ? data.state : data;
  if (!incoming || typeof incoming !== 'object' || !incoming.user || !Array.isArray(incoming.expenses)) return null;
  return incoming;
}

function triggerImportBackup() {
  if (window.AndroidBridge && typeof AndroidBridge.pickBackup === 'function') { AndroidBridge.pickBackup(); return; }
  const el = document.getElementById('importBackupInput'); if (el) el.click();
}

function handleImportBackupFile(input) {
  const file = input.files && input.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    input.value = '';
    const incoming = parseBackupJSON(String(reader.result || ''));
    if (!incoming) return toast('That file is not a valid Nivora backup.', 'error');
    confirmImportState(incoming);
  };
  reader.onerror = () => toast('Could not read that file.', 'error');
  reader.readAsText(file);
}
/* Called by MainActivity.kt via evaluateJavascript after the user picks a file through SAF.
   text is the file's raw content, or null/undefined if the user cancelled or it failed to read. */
window.onBackupPicked = (text) => {
  if (!text) return;
  const incoming = parseBackupJSON(text);
  if (!incoming) return toast('That file is not a valid Nivora backup.', 'error');
  confirmImportState(incoming);
};


function confirmResetProfile() {
  openModal('Reset your profile?', `
    <p class="text-slate-600 mb-4">This clears your name and onboarding details and takes you back through setup. Your expenses and medicines are kept. Back up your data first from Settings if you want a copy.</p>
    <div class="flex gap-2">
      <button onclick="closeModal()" class="flex-1 border py-2.5 rounded-lg">Cancel</button>
      <button onclick="resetProfile()" class="flex-1 bg-red-600 text-white font-semibold py-2.5 rounded-lg">Reset profile</button>
    </div>`);
}
