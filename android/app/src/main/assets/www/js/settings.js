/* =====================================================================
   settings.js - Settings screen and the "clear all data" confirmation.
   ===================================================================== */


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
    <div class="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 space-y-3">
      <h2 class="font-bold text-slate-900">Backup &amp; Restore</h2>
      <p class="text-xs text-slate-500">Your data lives only on this device. Export a backup file before resetting, switching phones, or uninstalling.</p>
      <div class="grid grid-cols-2 gap-3">
        <button onclick="exportBackup()" class="flex items-center justify-center gap-2 border border-teal-600 text-teal-700 font-semibold py-2.5 rounded-xl hover:bg-teal-50">${ICONS.download} Export</button>
        <button onclick="triggerImportBackup()" class="flex items-center justify-center gap-2 border border-slate-300 text-slate-700 font-semibold py-2.5 rounded-xl hover:bg-slate-50">${ICONS.upload} Import</button>
      </div>
      <input type="file" id="importBackupInput" accept="application/json" class="hidden" onchange="handleImportBackupFile(this)"/>
      <p id="backupLastAction" class="text-xs text-slate-400"></p>
    </div>
    <div class="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 space-y-2">
      <h2 class="font-bold text-slate-900 mb-2">Data & Privacy</h2>
      <button onclick="confirmReset()" class="w-full text-left py-2 text-red-600 hover:text-red-700 font-medium">🗑️ Clear all data</button>
      <button onclick="confirmResetProfile()" class="w-full text-left py-2 text-red-600 hover:text-red-700 font-medium">🚪 Reset profile</button>
    </div>
    <p class="text-xs text-slate-400 text-center pb-6">Nivora v1.0</p>
  </div>`;


function confirmReset() {
  openModal('Clear all data?', `
    <p class="text-slate-600 mb-4">This permanently erases every expense, medicine, budget and your profile from this device, and takes you back through setup. Back up your data first from Settings if you want a copy.</p>
    <div class="flex gap-2">
      <button onclick="closeModal()" class="flex-1 border py-2.5 rounded-lg">Cancel</button>
      <button onclick="clearAllData();closeModal()" class="flex-1 bg-red-600 text-white font-semibold py-2.5 rounded-lg">Clear everything</button>
    </div>`);
}
