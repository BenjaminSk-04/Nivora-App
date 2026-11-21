/* =====================================================================
   budgets.js - budget math, Budgets screen, budget editing.
   ===================================================================== */

function totalBudget() {
  const savedTotal = Number(state.totalBudgetMonthly);
  return Number.isFinite(savedTotal) && savedTotal >= 0
    ? savedTotal
    : Object.values(state.budgets).reduce((s,v) => s+Number(v || 0), 0);
}

function distributeTotalBudget(total) {
  const weights = CATEGORIES.map(c => Math.max(0, Number(state.budgets?.[c] || 0)));
  const weightSum = weights.reduce((sum, value) => sum + value, 0);
  const effectiveWeights = weightSum > 0 ? weights : CATEGORIES.map(() => 1);
  const denominator = effectiveWeights.reduce((sum, value) => sum + value, 0);
  let allocated = 0;
  state.budgets = {};
  CATEGORIES.forEach((category, index) => {
    const amount = index === CATEGORIES.length - 1
      ? Math.max(0, total - allocated)
      : Math.round(total * effectiveWeights[index] / denominator);
    state.budgets[category] = amount;
    allocated += amount;
  });
}

function categorySpentThisMonth() {
  const map = Object.fromEntries(CATEGORIES.map(c => [c, 0]));
  for (const e of expensesThisMonth()) map[e.category] = (map[e.category] || 0) + myShare(e);
  return map;
}

function categorySpentPrevMonth() {
  const map = Object.fromEntries(CATEGORIES.map(c => [c, 0]));
  for (const e of expensesPrevMonth()) map[e.category] = (map[e.category] || 0) + myShare(e);
  return map;
}


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


function openEditTotalBudget() {
  openModal('Set total monthly budget', `
    <form id="totalBudgetForm" class="space-y-3">
      <label class="block">
        <span class="text-sm font-medium">Your total budget for this month (₹)</span>
        <input type="number" name="amount" value="${totalBudget()}" min="0" step="1" required
          inputmode="numeric" class="mt-1 w-full px-3 py-2.5 border rounded-lg"
          placeholder="Enter your total budget"/>
      </label>
      <p class="text-xs text-slate-500">This total is set by you and is tracked separately from the individual category limits.</p>
      <div class="flex gap-2 pt-2">
        <button type="button" onclick="closeModal()" class="flex-1 border py-2.5 rounded-lg">Cancel</button>
        <button type="submit" class="flex-1 bg-teal-600 text-white font-semibold py-2.5 rounded-lg">Save budget</button>
      </div>
    </form>`, (root) => {
    root.querySelector('#totalBudgetForm').addEventListener('submit', (ev) => {
      ev.preventDefault();
      const amount = Number(new FormData(ev.target).get('amount'));
      if (!Number.isFinite(amount) || amount < 0) {
        toast('Enter a valid budget amount', 'error');
        return;
      }
      state.totalBudgetMonthly = amount;
      distributeTotalBudget(amount);
      saveState();
      closeModal();
      render();
      toast('Budget split automatically across all expense categories', 'success');
    });
  });
}


function openEditBudget(cat) {
  openModal(`Budget for ${cat}`, `
    <form id="budgetForm" class="space-y-3">
      <label class="block"><span class="text-sm font-medium">Monthly limit (₹)</span>
        <input type="number" name="amount" value="${state.budgets[cat] || 0}" min="0" required class="mt-1 w-full px-3 py-2.5 border rounded-lg"/></label>
      <div class="flex gap-2 pt-2">
        <button type="button" onclick="closeModal()" class="flex-1 border py-2.5 rounded-lg">Cancel</button>
        <button type="submit" class="flex-1 bg-teal-600 text-white font-semibold py-2.5 rounded-lg">Save</button>
      </div>
    </form>`, (root) => {
    root.querySelector('#budgetForm').addEventListener('submit', (ev) => {
      ev.preventDefault();
      state.budgets[cat] = Number(new FormData(ev.target).get('amount'));
      saveState(); closeModal(); render(); toast('Budget updated','success');
    });
  });
}
