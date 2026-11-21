/* =====================================================================
   nav.js - top/bottom navigation, tab bar, profile menu, and the `views` registry every screen registers into.
   ===================================================================== */


function navigate(path) { window.location.hash = path; }

const MONEY_TABS = [{ path:'/expenses', label:'Expenses' },{ path:'/budgets', label:'Budgets' },{ path:'/splits', label:'Splits' },{ path:'/insights', label:'Insights' }];


function profileMenuHTML() {
  const pct = profileCompletion(), item = 'w-full flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 text-left';
  return `<div id="profileWrap" class="relative">
    <button id="profileBtn" type="button" onclick="toggleProfileMenu()" aria-haspopup="menu" aria-expanded="false" aria-controls="profileMenu" aria-label="Account menu"
      class="w-9 h-9 rounded-full bg-teal-100 text-teal-800 flex items-center justify-center font-semibold text-sm hover:ring-2 hover:ring-teal-300 transition">${esc(state.user.avatarInitials)}</button>
    <div id="profileMenu" role="menu" class="hidden absolute right-0 mt-2 w-72 max-w-[calc(100vw-1.5rem)] bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden z-50">
      <div class="px-4 py-4 flex items-center gap-3 border-b border-slate-100">
        <div class="w-11 h-11 rounded-full bg-teal-100 text-teal-800 flex items-center justify-center font-bold shrink-0">${esc(state.user.avatarInitials)}</div>
        <div class="min-w-0"><p class="font-semibold text-slate-900 truncate">${esc(state.user.name)}</p><p class="text-xs text-slate-500 truncate">${esc(state.user.email)}</p></div>
      </div>
      ${pct < 100 ? `<div class="px-4 py-3 bg-slate-50 border-b border-slate-100"><div class="flex justify-between text-xs text-slate-500 mb-1"><span>Profile ${pct}% complete</span></div><div class="h-1.5 bg-slate-200 rounded"><div class="h-full bg-teal-500 rounded" style="width:${pct}%"></div></div></div>` : ''}
      <div class="py-1">
        <a href="#/settings" role="menuitem" class="${item}"><span aria-hidden="true">👤</span>Profile &amp; settings</a>
        <button type="button" role="menuitem" onclick="toggleProfileMenu(false); openEditProfile()" class="${item}"><span aria-hidden="true">✏️</span>Edit profile</button>
      </div>
      <div class="py-1 border-t border-slate-100">
        <button type="button" role="menuitem" onclick="toggleProfileMenu(false); confirmResetProfile()" class="${item} !text-red-600 hover:!bg-red-50"><span aria-hidden="true">🚪</span>Reset profile</button>
      </div>
    </div>
  </div>`;
}

function toggleProfileMenu(force) {
  const m = $('#profileMenu'), b = $('#profileBtn'); if (!m || !b) return;
  const open = typeof force === 'boolean' ? force : m.classList.contains('hidden');
  m.classList.toggle('hidden', !open); b.setAttribute('aria-expanded', String(open));
  if (open) m.querySelector('[role=menuitem]')?.focus();
}

document.addEventListener('click', e => { if (!e.target.closest('#profileWrap')) toggleProfileMenu(false); });

document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  const m = $('#profileMenu'); if (m && !m.classList.contains('hidden')) { toggleProfileMenu(false); $('#profileBtn')?.focus(); }
});


function topNav(path) {
  const links = [ { p:'/dashboard', l:'Home' }, { p:'/expenses', l:'Money' }, { p:'/medicines', l:'Health' }, { p:'/settings', l:'Settings' } ];
  const active = (p) => {
    if (p === '/expenses') return path.startsWith('/expenses') || path.startsWith('/budgets') || path.startsWith('/splits') || path.startsWith('/insights');
    if (p === '/medicines') return path.startsWith('/medicines');
    return path === p;
  };
  return `<header class="bg-white border-b border-slate-200 sticky top-0 z-40">
    <div class="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
      <a href="#/dashboard" class="flex items-center gap-2">${LOGO_SVG}<span class="text-xl font-extrabold text-slate-900 tracking-tight hidden sm:block">Nivora</span></a>
      <nav class="hidden md:flex items-center gap-1">${links.map(l => `<a href="#${l.p}" class="px-4 py-2 rounded-lg text-sm font-medium transition ${active(l.p) ? 'bg-teal-50 text-teal-700' : 'text-slate-600 hover:bg-slate-100'}">${l.l}</a>`).join('')}</nav>
      <div class="flex items-center gap-2">
        <button onclick="openNotifications()" class="relative p-2 rounded-lg hover:bg-slate-100" aria-label="Notifications">
          <span class="text-slate-600">${ICONS.bell}</span>
          <span id="notifDot" class="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full ${state.notifications.length ? '' : 'hidden'}"></span>
        </button>
        ${profileMenuHTML()}
      </div>
    </div>
  </header>`;
}


const NAV = [
  { path:'/dashboard', label:'Home', icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><path d="M9 22V12h6v10"/></svg>' },
  { path:'/expenses',  label:'Money', icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>' },
  { path:'/medicines', label:'Health',icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M2 12h20"/><circle cx="12" cy="12" r="9"/></svg>' },
  { path:'/settings',  label:'More',  icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33h0a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82v0a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>' },
];


function bottomNav(path) {
  const active = (p) => {
    if (p === '/expenses') return ['/expenses','/budgets','/splits','/insights'].includes(path);
    if (p === '/medicines') return path === '/medicines';
    return path === p;
  };
  return `<nav class="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-40 pb-[env(safe-area-inset-bottom)]">
    <div class="grid grid-cols-4">
      ${NAV.map(n => `<a href="#${n.path}" class="flex flex-col items-center gap-0.5 py-2.5 ${active(n.path) ? 'tab-active' : 'text-slate-500'}"><span class="w-6 h-6">${n.icon}</span><span class="text-xs font-medium">${n.label}</span></a>`).join('')}
    </div>
  </nav>`;
}


function tabBar(path, tabs) {
  return `<div class="flex gap-2 overflow-x-auto pb-2 mb-4 no-scrollbar">${tabs.map(t => `<a href="#${t.path}" class="px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${path === t.path ? 'bg-teal-600 text-white shadow' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}">${t.label}</a>`).join('')}</div>`;
}


const views = {};
