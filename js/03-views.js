function navigate(path) { window.location.hash = path; }
const MONEY_TABS = [{ path:'/expenses', label:'Expenses' },{ path:'/budgets', label:'Budgets' },{ path:'/splits', label:'Splits' },{ path:'/insights', label:'Insights' }];
const HEALTH_TABS = [{ path:'/medicines', label:'Medicines' },{ path:'/generic-finder', label:'Medicine Finder 💊' },{ path:'/kendras', label:'Locations' }];

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
        <button type="button" role="menuitem" onclick="toggleProfileMenu(false); logout()" class="${item} !text-red-600 hover:!bg-red-50"><span aria-hidden="true">🚪</span>Log out</button>
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
    if (p === '/medicines') return path.startsWith('/medicines') || path.startsWith('/generic-finder') || path.startsWith('/kendras');
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
    if (p === '/medicines') return ['/medicines','/generic-finder','/kendras'].includes(path);
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

views['/login'] = () => `<div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 to-slate-50 p-4">
  <div class="w-full max-w-sm bg-white rounded-2xl shadow-xl p-6 sm:p-8">
    <div class="text-center mb-1 flex flex-col items-center">
      ${LOGO_FULL}
      <h1 class="sr-only">Nivora login</h1>
    </div>
    <form onsubmit="event.preventDefault(); handleLogin()" class="space-y-3 mt-4">
      <label class="block"><span class="text-sm font-medium text-slate-700">Username or Email ID</span>
        <input type="text" id="loginId" required autocomplete="username" value="aarav@demo.nivora" placeholder="Enter your username or email ID" class="mt-1 w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:border-teal-500 outline-none" /></label>
      <label class="block"><span class="text-sm font-medium text-slate-700">Password</span>
        <div class="mt-1 relative">
          <input type="password" id="loginPassword" required value="demo1234" class="w-full px-3 py-2.5 pr-11 border border-slate-300 rounded-lg focus:border-teal-500 outline-none" />
          <button type="button" onclick="togglePasswordVisibility(this)" class="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-500 hover:text-slate-700 rounded" aria-label="Show password">${ICONS.eye}</button>
        </div></label>
      <button type="submit" class="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold py-3 rounded-xl transition">Log in</button>
    </form>
    <p class="text-center text-sm text-slate-500 mt-4">New here? <a href="#/signup" class="text-teal-700 font-medium hover:underline">Sign up</a></p>
  </div>
</div>`;
views['/signup'] = () => `<div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 to-slate-50 p-4">
  <div class="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">
    <div class="text-center mb-6 flex flex-col items-center">
      ${LOGO_SVG.replace('w-10 h-10', 'w-14 h-14')}
      <h1 class="text-3xl font-extrabold text-slate-900 mt-2">Create account</h1>
      <p class="text-sm text-slate-500 mt-1">Demo only: data stays in this browser.</p>
    </div>
    <form onsubmit="event.preventDefault(); handleSignup()" class="space-y-3 mt-5">
      <label class="block"><span class="text-sm font-medium text-slate-700">Full name</span>
        <input type="text" id="signupName" required class="mt-1 w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:border-teal-500 outline-none" /></label>
      <label class="block"><span class="text-sm font-medium text-slate-700">Email</span>
        <input type="email" id="signupEmail" required class="mt-1 w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:border-teal-500 outline-none" /></label>
      <label class="block"><span class="text-sm font-medium text-slate-700">Password (min 8 characters)</span>
        <input type="password" id="signupPassword" required minlength="8" class="mt-1 w-full px-3 py-2.5 border border-slate-300 rounded-lg focus:border-teal-500 outline-none" /></label>
      <button type="submit" class="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold py-3 rounded-xl transition">Sign up</button>
    </form>
    <p class="text-center text-sm text-slate-500 mt-4">Already have an account? <a href="#/login" class="text-teal-700 font-medium hover:underline">Log in</a></p>
  </div>
</div>`;

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

views['/dashboard'] = () => {
  const spent = totalSpentThisMonth();
  const budgetTotal = totalBudget();
  const pct = budgetTotal ? (spent / budgetTotal) * 100 : 0;
  const doses = todaysDoses();
  const pendingDoses = doses.filter(d => d.status === 'pending');
  const catSpent = categorySpentThisMonth();
  const catPrev = categorySpentPrevMonth();
  const foodDiff = catSpent.Food - catPrev.Food;
  const lowStock = state.medicines.filter(m => m.stock <= 3 || (m.refillDate && daysUntil(m.refillDate) <= 5));
  const recent = [...state.expenses].sort((a,b) => b.date.localeCompare(a.date)).slice(0, 4);
  
  const isOverBudget = spent > budgetTotal;
  const overBudgetCats = CATEGORIES.filter(c => catSpent[c] > state.budgets[c]);

  return `
  <div class="space-y-5">
    <div>
      <p class="text-sm text-slate-500">${new Date().toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long' })}</p>
      <h1 class="text-2xl md:text-3xl font-extrabold text-slate-900 mt-1">Hello, ${esc(currentUser?.username || state.user.name)} 👋</h1>
    </div>

    ${isOverBudget || overBudgetCats.length ? `
    <div class="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
      <div class="text-2xl">🚨</div>
      <div class="text-sm text-red-900">
        <p class="font-bold">Budget Exceeded</p>
        ${isOverBudget ? `<p>You are ${fmtINR(spent - budgetTotal)} over your total monthly budget.</p>` : ''}
        ${overBudgetCats.length ? `<p class="mt-1">Over limit in: ${overBudgetCats.join(', ')}</p>` : ''}
      </div>
    </div>` : ''}

    ${homeShortcutsHTML()}
    ${moneyCardsHTML()}

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <a href="#/expenses" class="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:shadow-md transition block">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-sm font-semibold text-slate-500 uppercase tracking-wide">This month</h2>
          <span class="text-xs font-medium px-2 py-0.5 rounded-full ${foodDiff > 0 ? 'bg-red-50 text-red-600' : 'bg-teal-50 text-teal-700'}">${foodDiff > 0 ? '↑' : '↓'} ${fmtINR(Math.abs(foodDiff))} Food</span>
        </div>
        <p class="text-3xl md:text-4xl font-extrabold text-slate-900">${fmtINR(spent)}</p>
        <p class="text-sm text-slate-500 mt-1">of ${fmtINR(budgetTotal)} budget · <span style="color:${budgetColor(pct)};font-weight:600">${Math.round(pct)}%</span></p>
        <div class="mt-3">${progressBar(pct, budgetColor(pct))}</div>
        <div class="mt-3 flex items-center justify-between text-xs text-slate-500">
          <span>${fmtINR(Math.max(budgetTotal-spent,0))} left</span>
        </div>
      </a>

      <a href="#/medicines" class="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:shadow-md transition block">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-sm font-semibold text-slate-500 uppercase tracking-wide">Today's doses</h2>
          <span class="text-xs font-medium px-2 py-0.5 rounded-full bg-teal-50 text-teal-700">Adherence ${adherence()}%</span>
        </div>
        <p class="text-3xl md:text-4xl font-extrabold text-slate-900">${pendingDoses.length} <span class="text-lg font-semibold text-slate-500">due</span></p>
        ${doses.length ? `
          <ul class="mt-3 space-y-1.5">
            ${groupDoses(doses).slice(0, 3).map(doseSummaryLI).join('')}
          </ul>` : '<p class="mt-3 text-sm text-slate-500">No doses scheduled today 🎉</p>'}
      </a>
    </div>

    ${lowStock.length ? `
    <div class="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
      <div class="text-2xl">⚠️</div>
      <div class="text-sm text-amber-900"><p><strong>Refill needed:</strong> ${lowStock.map(m => esc(m.name)).join(', ')}</p></div>
    </div>` : ''}

    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <a href="#/splits" class="bg-white rounded-xl p-4 shadow-sm border border-slate-100 hover:border-teal-300 transition flex items-center gap-3">
        <div class="text-indigo-500">${ICONS.users}</div><p class="text-sm font-semibold text-slate-900">Split with flat</p>
      </a>
      <a href="#/generic-finder" class="bg-white rounded-xl p-4 shadow-sm border border-slate-100 hover:border-teal-300 transition flex items-center gap-3">
        <div class="text-pink-500">${ICONS.pill}</div><p class="text-sm font-semibold text-slate-900">Medicine Finder 💊</p>
      </a>
      <a href="#/kendras" class="bg-white rounded-xl p-4 shadow-sm border border-slate-100 hover:border-teal-300 transition flex items-center gap-3">
        <div class="text-blue-500">${ICONS.map}</div><p class="text-sm font-semibold text-slate-900">Find location</p>
      </a>
    </div>

    <div class="bg-white rounded-2xl shadow-sm border border-slate-100">
      <div class="p-4 border-b border-slate-100 flex items-center justify-between">
        <h2 class="font-bold text-slate-900">Recent expenses</h2>
        <a href="#/expenses" class="text-sm font-medium text-teal-700 hover:underline">View all →</a>
      </div>
      <ul class="divide-y divide-slate-100">
        ${recent.map(e => `<li class="p-4 flex items-center justify-between">
          <div class="flex items-center gap-3 min-w-0">
            <div class="w-10 h-10 rounded-lg flex items-center justify-center text-white font-semibold" style="background:${catColor(e.category)}">${e.category[0]}</div>
            <div class="min-w-0">
              <p class="font-medium text-slate-900 truncate">${esc(e.notes || e.category)}</p>
              <p class="text-xs text-slate-500">${fmtDay(e.date)} · ${esc(e.paidBy)} paid</p>
            </div>
          </div>
          <span class="font-bold text-slate-900">${fmtINR(myShare(e))}</span>
        </li>`).join('')}
      </ul>
    </div>
  </div>`;
};

let expenseFilter = { cat:'all', search:'' };
function expenseListHTML() {
  const filtered = state.expenses
    .filter(e => expenseFilter.cat === 'all' || e.category === expenseFilter.cat)
    .filter(e => !expenseFilter.search || (e.notes||'').toLowerCase().includes(expenseFilter.search.toLowerCase()))
    .sort((a,b) => b.date.localeCompare(a.date));

  const grouped = {};
  filtered.forEach(e => {
    const mk = monthKey(e.date);
    if (!grouped[mk]) grouped[mk] = [];
    grouped[mk].push(e);
  });
  
  const sortedMonths = Object.keys(grouped).sort().reverse();
  return sortedMonths.length ? sortedMonths.map(mk => {
      const monthExpenses = grouped[mk];
      const monthTotal = monthExpenses.reduce((s, e) => s + myShare(e), 0);
      const isCurrent = mk === thisMonthKey();
      const monthName = new Date(mk + '-01T00:00:00').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

      return `
        <div class="mt-6">
          <div class="flex items-center justify-between mb-3 px-1">
            <h2 class="text-lg font-bold text-slate-800">
              ${isCurrent ? 'This Month <span class="text-slate-400 font-medium">(' + monthName + ')</span>' : monthName}
            </h2>
            <span class="text-sm font-bold bg-white px-3 py-1 rounded-full border border-slate-200 shadow-sm text-slate-700">${fmtINR(monthTotal)}</span>
          </div>
          <div class="bg-white rounded-2xl shadow-sm border border-slate-100 divide-y divide-slate-100">
            ${monthExpenses.map(e => `
              <div class="p-4 flex items-center justify-between hover:bg-slate-50 group">
                <div class="flex items-center gap-3 min-w-0 flex-1">
                  <div class="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold flex-shrink-0" style="background:${catColor(e.category)}">${e.category[0]}</div>
                  <div class="min-w-0 flex-1">
                    <p class="font-medium text-slate-900 truncate">${esc(e.notes || e.category)}</p>
                    <p class="text-xs text-slate-500">${e.category} · ${fmtDay(e.date)} · ${esc(e.paidBy)} paid ${e.split ? '· shared' : ''}</p>
                  </div>
                </div>
                <div class="flex items-center gap-2">
                  <div class="text-right">
                    <p class="font-bold text-slate-900">${fmtINR(myShare(e))}</p>
                    ${e.split ? `<p class="text-[10px] text-slate-400">of ${fmtINR(e.amount)}</p>` : ''}
                  </div>
                  ${receiptBtnHTML(e)}<button onclick="openEditExpense('${e.id}')" class="p-1.5 rounded hover:bg-slate-100" aria-label="Edit">✏️</button>
                  <button onclick="confirmDeleteExpense('${e.id}')" class="p-1.5 rounded hover:bg-red-50" aria-label="Delete">🗑️</button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }).join('') : `
      <div class="bg-white rounded-2xl p-12 text-center border border-slate-100 mt-4">
        <p class="font-semibold text-slate-900">No expenses found</p>
        <button onclick="openAddExpense()" class="text-teal-700 font-medium hover:underline mt-2">+ Add your first expense</button>
      </div>
    `;
}

views['/expenses'] = () => {
  const spent = totalSpentThisMonth();
  const catSpent = categorySpentThisMonth();
  const topCat = Object.entries(catSpent).sort((a,b) => b[1]-a[1])[0] || ['None', 0];

  return `
  <h1 class="text-2xl md:text-3xl font-extrabold text-slate-900 mb-4">Money</h1>
  ${tabBar('/expenses', MONEY_TABS)}
  <div class="space-y-4">
    
    <div class="bg-gradient-to-br from-teal-600 to-teal-700 text-white rounded-2xl p-5">
      <p class="text-sm opacity-90">Spent this month</p>
      <p class="text-3xl font-extrabold mt-1">${fmtINR(spent)}</p>
      <div class="flex gap-4 mt-3 text-xs opacity-90">
        <span>Top: ${topCat[0]} (${fmtINR(topCat[1])})</span>
      </div>
    </div>

    <div class="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex gap-3 flex-wrap">
      <input type="search" id="expSearch" placeholder="Search notes..." value="${esc(expenseFilter.search)}" oninput="handleExpenseSearch(this)" class="flex-1 min-w-[200px] px-3 py-2 border border-slate-300 rounded-lg text-sm" aria-label="Search expenses"/>
      <select onchange="handleCatFilter(this)" class="px-3 py-2 border border-slate-300 rounded-lg text-sm" aria-label="Category filter">
        <option value="all" ${expenseFilter.cat==='all'?'selected':''}>All categories</option>
        ${CATEGORIES.map(c => `<option value="${c}" ${expenseFilter.cat===c?'selected':''}>${CATEGORY_META[c].icon} ${c}</option>`).join('')}
      </select>
    </div>

    ${quickAddHTML()}
    <button onclick="openAddExpense()" class="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2">
      <span>${ICONS.plus}</span> Add expense
    </button>

    <div id="expList" class="space-y-4 [&>*:first-child]:mt-0">${expenseListHTML()}</div>
  </div>`;
};

views['/budgets'] = () => {
  const spent = categorySpentThisMonth();
  const totalB = totalBudget();
  const totalS = Object.values(spent).reduce((a,b) => a+b, 0);
  const totalPct = totalB ? (totalS/totalB)*100 : 0;
  
  return `
  <h1 class="text-2xl md:text-3xl font-extrabold text-slate-900 mb-4">Money</h1>
  ${tabBar('/budgets', MONEY_TABS)}
  <div class="space-y-4">
    <div class="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
      <div class="flex items-center justify-between mb-2">
        <div>
          <h2 class="font-bold text-slate-900">Overall monthly budget</h2>
          <p class="text-xs text-slate-500 mt-0.5">Your total is automatically divided across expense categories</p>
        </div>
        <div class="text-right">
          <span class="block text-sm font-semibold mb-1" style="color:${budgetColor(totalPct)}">${Math.round(totalPct)}%</span>
          <button onclick="openEditTotalBudget()" class="text-xs font-semibold text-teal-700 hover:underline">Change total budget</button>
        </div>
      </div>
      <p class="text-sm text-slate-500">${fmtINR(totalS)} of ${fmtINR(totalB)}</p>
      <div class="mt-3">${progressBar(totalPct, budgetColor(totalPct))}</div>
    </div>

    <div class="rounded-xl border border-teal-100 bg-teal-50 px-4 py-3 text-sm text-teal-900">
      <span class="font-semibold">✨ Automatic budget split</span>
      <span class="block text-xs mt-1 text-teal-800">Each category receives a share of your total budget. Change the total anytime to recalculate all category limits.</span>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
      ${CATEGORIES.map(c => {
        const limit = state.budgets[c] || 0;
        const s = spent[c] || 0;
        const pct = limit ? (s/limit)*100 : 0;
        const color = budgetColor(pct);
        const isOver = s > limit;
        const meta = CATEGORY_META[c];
        const sharePct = totalB ? Math.round((limit / totalB) * 100) : 0;
        return `<div class="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex items-center gap-4 ${isOver ? 'ring-2 ring-red-400 ring-offset-1' : ''}">
          <div class="w-12 h-12 rounded-2xl flex-shrink-0 flex items-center justify-center text-2xl shadow-sm" style="background:${catColor(c)}18" role="img" aria-label="${c}: ${meta.hint}" title="${c} — ${meta.hint}">${meta.icon}</div>
          <div class="relative flex-shrink-0">
            <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true">
              <circle cx="32" cy="32" r="28" fill="none" stroke="#e2e8f0" stroke-width="6"/>
              <circle cx="32" cy="32" r="28" fill="none" stroke="${color}" stroke-width="6" stroke-dasharray="${2 * Math.PI * 28}" stroke-dashoffset="${2 * Math.PI * 28 * (1 - Math.min(pct, 100) / 100)}" stroke-linecap="round" transform="rotate(-90 32 32)"/>
            </svg>
            <span class="absolute inset-0 flex items-center justify-center text-xs font-bold" style="color:${color}">${Math.round(pct)}%</span>
          </div>
          <div class="flex-1 min-w-0">
            <p class="font-semibold text-slate-900">${c} <span class="text-xs font-normal text-slate-500">· ${sharePct}%</span></p>
            <p class="text-xs text-slate-500">${meta.hint}</p>
            <p class="text-xs text-slate-500">${fmtINR(s)} spent of ${fmtINR(limit)}</p>
            <button onclick="openEditBudget('${c}')" class="text-xs font-medium text-teal-700 hover:underline mt-1">Set limit</button>
          </div>
        </div>`;
      }).join('')}
    </div>
  </div>`;
};

views['/splits'] = () => {
  const gExps = state.expenses.filter(e => e.split).sort((a,b) => b.date.localeCompare(a.date));
  const balances = computeBalances(gExps, FLAT_MEMBERS);
  const settlements = settleUp(balances);
  const myBalance = balances.Aarav;

  return `
  <h1 class="text-2xl md:text-3xl font-extrabold text-slate-900 mb-4">Money</h1>
  ${tabBar('/splits', MONEY_TABS)}
  <div class="space-y-4">
    <div class="bg-gradient-to-br from-indigo-600 to-indigo-700 text-white rounded-2xl p-5">
      <div class="flex items-center justify-between mb-3">
        <div>
          <p class="text-xs uppercase opacity-80 font-semibold tracking-wide">Group</p>
          <h2 class="text-xl font-extrabold">🏠 Flat 302</h2>
        </div>
      </div>
      <p class="text-sm opacity-90">${myBalance >= 0 ? 'You are owed' : 'You owe'}</p>
      <p class="text-3xl font-extrabold mt-1">${fmtINR2(Math.abs(myBalance))}</p>
    </div>

    <div class="grid grid-cols-3 gap-3">
      ${FLAT_MEMBERS.map(m => {
        const b = balances[m] || 0;
        const isMe = m === 'Aarav';
        const color = b > 0.01 ? 'text-teal-700' : b < -0.01 ? 'text-red-600' : 'text-slate-500';
        return `<div class="bg-white rounded-xl p-3 shadow-sm border ${isMe ? 'border-teal-300' : 'border-slate-100'} text-center">
          <p class="text-xs font-semibold text-slate-500">${isMe ? 'You' : m}</p>
          <p class="font-extrabold text-lg ${color} mt-1">${b > 0 ? '+' : ''}${fmtINR(Math.abs(b))}</p>
          <p class="text-[10px] text-slate-400">${b > 0 ? 'owed' : b < 0 ? 'owes' : 'settled'}</p>
        </div>`;
      }).join('')}
    </div>

    ${settlements.length ? `<div class="bg-white rounded-2xl shadow-sm border border-slate-100">
      <div class="p-4 border-b border-slate-100">
        <h2 class="font-bold text-slate-900">Settle up</h2>
      </div>
      <ul class="divide-y divide-slate-100">
        ${settlements.map((s,i) => `<li class="p-4 flex flex-wrap items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            <div class="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold">${s.from[0]}</div>
            <span class="text-slate-500 text-sm">→</span>
            <div class="w-7 h-7 rounded-full bg-teal-200 flex items-center justify-center text-xs font-bold text-teal-800">${s.to[0]}</div>
            <span class="text-sm text-slate-700 ml-1">${s.from} pays ${s.to}</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="font-bold text-slate-900">${fmtINR2(s.amount)}</span>
            ${settleExtraHTML(s)}<button onclick="markSettled('${s.from}','${s.to}',${s.amount})" class="text-xs font-medium bg-teal-600 text-white px-2 py-1 rounded">Mark paid</button>
          </div>
        </li>`).join('')}
      </ul>
    </div>` : `<div class="bg-teal-50 border border-teal-200 rounded-2xl p-4 text-center text-teal-800 font-medium">✓ All settled up</div>`}

    <button onclick="openSplitExpense()" class="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold py-3 rounded-xl">+ Add shared expense</button>
  </div>`;
};

views['/medicines'] = () => {
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const doses = todaysDoses();
  const pending = doses.filter(d => d.status === 'pending');
  return `
  <h1 class="text-2xl md:text-3xl font-extrabold text-slate-900 mb-4">Health</h1>
  ${tabBar('/medicines', HEALTH_TABS)}
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

let genericSearch = '';
function handleGenericSearch(el) {
  genericSearch = el.value;
  const box = $('#genList'); if (box) box.innerHTML = genericListHTML();
}

function genericListHTML() {
  const q = genericSearch.toLowerCase().trim();
  const results = q ? state.genericMeds.filter(g => genMatch(g, q)) : state.genericMeds;
  const sorted = [...results].sort((a,b) => (b.brandPrice - b.jakPrice) - (a.brandPrice - a.jakPrice));
  return sorted.map(g => {
        const savings = g.brandPrice - g.jakPrice;
        const savingsPct = Math.round((savings / g.brandPrice) * 100);
        return `<div class="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
          <div class="flex items-start justify-between gap-2 mb-3">
            <div class="min-w-0">
              <h3 class="font-bold text-slate-900">${esc(g.salt)}</h3>
              <p class="text-xs text-slate-500">${esc(g.pack)}</p>
            </div>
            <span class="inline-block text-xs font-bold text-white px-2 py-0.5 rounded-full bg-teal-600">${savingsPct}% off</span>
          </div>
          <div class="grid grid-cols-2 gap-2 text-sm mb-3">
            <div class="bg-slate-50 rounded-lg p-2.5">
              <p class="text-xs text-slate-500 mb-0.5">Branded</p>
              <p class="font-semibold text-slate-900">${esc(g.brand)}</p>
              <p class="text-slate-700">${fmtINR(g.brandPrice)}</p>
            </div>
            <div class="bg-teal-50 rounded-lg p-2.5 border border-teal-200">
              <p class="text-xs text-teal-700 mb-0.5">Jan Aushadhi</p>
              <p class="font-semibold text-teal-900">${esc(g.jakBrand)}</p>
              <p class="font-bold text-teal-900">${fmtINR(g.jakPrice)}</p>
            </div>
          </div>
          <div class="flex items-center justify-between">
            ${monthlySavingHTML(g, savings)}
            <button onclick="trackSaving('${g.salt}', ${savings})" class="text-xs font-semibold bg-teal-600 text-white px-3 py-1.5 rounded-lg hover:bg-teal-700">+ Track saving</button>
          </div>
        </div>`;
      }).join('');
}

views['/generic-finder'] = () => {
  const totalSaved = state.savingsTracker.reduce((s, x) => s + x.saved, 0);

  return `
  <h1 class="text-2xl md:text-3xl font-extrabold text-slate-900 mb-4">Health</h1>
  ${tabBar('/generic-finder', HEALTH_TABS)}
  <div class="space-y-4">
    <div class="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
      <label class="block">
        <span class="text-sm font-semibold text-slate-700">Search by salt / brand</span>
        <input type="search" placeholder="e.g. salbutamol..." value="${esc(genericSearch)}" oninput="handleGenericSearch(this)" id="genSearch" class="mt-2 w-full px-4 py-3 border border-slate-300 rounded-xl focus:border-teal-500 outline-none text-base"/>
      </label>
    </div>

    ${totalSaved > 0 ? `<div class="bg-teal-50 border border-teal-200 rounded-2xl p-4">
      <p class="text-sm text-teal-900"><strong>💰 You've saved ${fmtINR(totalSaved)}</strong> by choosing generics.</p>
    </div>` : ''}

    <div id="genList" class="space-y-3">${genericListHTML()}</div>
    <div class="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-900">
      ⚠️ <strong>Not medical advice.</strong> Always consult your doctor or pharmacist before switching medication.
    </div>
  </div>`;
};

let kendraMapInstance = null;
let kendraYouMarker = null;
let kendraLocation = null;
function kendraListHTML() {
  const userLoc = kendraLocation || state.user.location || { lat: 18.5074, lng: 73.8077 };
  const withDist = state.kendras.map(k => {
    const dx = (k.lat - userLoc.lat) * 111;
    const dy = (k.lng - userLoc.lng) * 111 * Math.cos(userLoc.lat * Math.PI/180);
    return { ...k, dist: Math.sqrt(dx*dx + dy*dy) };
  }).sort((a,b) => a.dist - b.dist);

  return withDist.map(k => `<div class="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
        <div class="flex items-start justify-between gap-2 mb-1">
          <div class="min-w-0">
            <h3 class="font-semibold text-slate-900">${esc(k.name)}</h3>
            <p class="text-xs text-slate-500 mt-0.5">${esc(k.address)}</p>
            <p class="text-xs text-slate-500 mt-1">🕐 ${esc(k.timings)}</p>
          </div>
          <span class="text-xs font-bold text-teal-700 bg-teal-50 px-2 py-1 rounded-full whitespace-nowrap">${k.dist.toFixed(1)} km</span>
        </div>
        <a href="https://www.google.com/maps/dir/?api=1&destination=${k.lat},${k.lng}" target="_blank" rel="noopener" class="inline-block mt-2 text-sm font-medium text-teal-700 hover:underline">Get directions →</a>
      </div>`).join('');
}

views['/kendras'] = () => {
  return `
  <h1 class="text-2xl md:text-3xl font-extrabold text-slate-900 mb-4">Health</h1>
  ${tabBar('/kendras', HEALTH_TABS)}
  <div class="space-y-4">
    <div class="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex items-center justify-between">
      <div>
        <h2 class="font-bold text-slate-900">Jan Aushadhi Locations</h2>
        <p class="text-xs text-slate-500">${state.kendras.length} stores in Pune</p>
      </div>
      <button onclick="getLocation()" class="text-sm bg-teal-600 text-white font-semibold px-3 py-2 rounded-lg hover:bg-teal-700">📍 Locate me</button>
    </div>
    <div id="map" class="bg-white shadow-sm border border-slate-100 overflow-hidden"></div>
    <div id="kendraList" class="space-y-3">${kendraListHTML()}</div>
  </div>`;
};

