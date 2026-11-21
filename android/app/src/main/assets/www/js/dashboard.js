/* =====================================================================
   dashboard.js - the Home screen.
   ===================================================================== */


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
      <h1 class="text-2xl md:text-3xl font-extrabold text-slate-900 mt-1">Hello, ${esc(state.user.name || 'there')} 👋</h1>
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
      <a href="#/medicines" class="bg-white rounded-xl p-4 shadow-sm border border-slate-100 hover:border-teal-300 transition flex items-center gap-3">
        <div class="text-pink-500">${ICONS.pill}</div><p class="text-sm font-semibold text-slate-900">Medicines</p>
      </a>
      <button type="button" onclick="openScanBill()" class="bg-white rounded-xl p-4 shadow-sm border border-slate-100 hover:border-teal-300 transition flex items-center gap-3 text-left">
        <div class="text-blue-500">${ICONS.camera}</div><p class="text-sm font-semibold text-slate-900">Scan bill</p>
      </button>
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
              <p class="text-xs text-slate-500">${fmtDay(e.date)} · ${esc(nameOf(e.paidBy))} paid</p>
            </div>
          </div>
          <span class="font-bold text-slate-900">${fmtINR(myShare(e))}</span>
        </li>`).join('')}
      </ul>
    </div>
  </div>`;
};

function homeShortcutsHTML() {
  const nb = unpaidBills().map(b => ({ b, d: nextDue(b) })).sort((a, c) => a.d - c.d)[0];
  const sub = nb ? `${esc(nb.b.title)} · ${nb.d.toLocaleDateString('en-IN', { day:'numeric', month:'short' })}` : 'Rent, WiFi…';
  const t = (icon, label, hint, fn, cls) => `<button onclick="${fn}" class="${cls || 'bg-white border border-slate-100 text-slate-900'} rounded-2xl p-3 shadow-sm text-center active:scale-95 transition"><div class="text-2xl">${icon}</div><p class="text-sm font-semibold mt-1">${label}</p><p class="text-[11px] opacity-70 truncate">${hint}</p></button>`;
  return `<div class="grid grid-cols-3 gap-3">${t('✨', 'Smart add', 'type or paste SMS', "openSmartAdd('')")}${t('📷', 'Scan bill', 'camera or photo', 'openScanBill()', 'bg-gradient-to-br from-teal-600 to-teal-700 text-white')}${t('💳', 'Bills', sub, 'openBills()')}</div>`;
}
