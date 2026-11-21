/* =====================================================================
   expenses.js - expense math, list screen, add/edit/delete, receipts.
   ===================================================================== */


function myShare(e) { if (e.settlement) return 0; if (e.split) return e.split.shares[ME] || 0; return (e.paidBy && e.paidBy !== ME) ? 0 : e.amount; }

function expensesThisMonth() { return state.expenses.filter(e => monthKey(e.date) === thisMonthKey()); }

function expensesPrevMonth() { return state.expenses.filter(e => monthKey(e.date) === prevMonthKey()); }

function totalSpentThisMonth() { return expensesThisMonth().reduce((s,e) => s + myShare(e), 0); }


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
                    <p class="text-xs text-slate-500">${e.category} · ${fmtDay(e.date)} · ${esc(nameOf(e.paidBy))} paid ${e.split ? '· shared' : ''}</p>
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


function openAddExpense(isGroup = false) {
  const title = isGroup ? 'Add Shared Expense' : 'Add Expense';
  openModal(title, `
    <form id="expForm" class="space-y-3">
      <label class="block">
        <span class="text-sm font-medium text-slate-700">Amount (₹)</span>
        <input type="number" name="amount" required min="1" step="0.01" class="mt-1 w-full px-3 py-2.5 border border-slate-300 rounded-lg" placeholder="0"/>
      </label>
      <label class="block">
        <span class="text-sm font-medium text-slate-700">Notes</span>
        <input type="text" name="notes" class="mt-1 w-full px-3 py-2.5 border border-slate-300 rounded-lg" placeholder="What was it for?"/>
      </label>
      <label class="block">
        <span class="text-sm font-medium text-slate-700">Category</span>
        <select name="category" id="expCategory" class="mt-1 w-full px-3 py-2.5 border border-slate-300 rounded-lg">
          ${CATEGORIES.map(c => `<option value="${c}">${CATEGORY_META[c].icon} ${c}</option>`).join('')}
        </select>
      </label>
      <label class="block">
        <span class="text-sm font-medium text-slate-700">Date</span>
        <input type="date" name="date" value="${todayISO()}" class="mt-1 w-full px-3 py-2.5 border border-slate-300 rounded-lg"/>
      </label>
      <label class="block ${isGroup ? '' : 'hidden'}" id="paidByWrap">
        <span class="text-sm font-medium text-slate-700">Paid by</span>
        <select name="paidBy" class="mt-1 w-full px-3 py-2.5 border border-slate-300 rounded-lg">
          ${membersList().map(m => `<option value="${esc(m)}">${esc(nameOf(m))}</option>`).join('')}
        </select>
      </label>
      ${(!isGroup && state.flatmates.length) ? `<label class="flex items-center gap-2 mt-2 cursor-pointer">
        <input type="checkbox" name="split" class="w-4 h-4" onchange="document.getElementById('paidByWrap').classList.toggle('hidden', !this.checked)"/>
        <span class="text-sm font-medium text-slate-700">Split with ${esc(state.groupName || 'the group')}</span>
      </label>` : ''}
      <div class="flex gap-2 pt-2">
        <button type="button" onclick="closeModal()" class="flex-1 border border-slate-300 text-slate-700 font-medium py-2.5 rounded-lg">Cancel</button>
        <button type="submit" class="flex-1 bg-teal-600 text-white font-semibold py-2.5 rounded-lg hover:bg-teal-700">Save</button>
      </div>
    </form>`, (root) => {
    const form = root.querySelector('#expForm');
    form.querySelector('[name=notes]').addEventListener('input', (e) => {
      form.querySelector('#expCategory').value = autoCategorize(e.target.value);
    });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const amount = Number(fd.get('amount'));
      const category = fd.get('category');
      const shouldSplit = isGroup || fd.get('split') === 'on';
      if (!(amount > 0)) return toast('Enter an amount greater than 0', 'error');
      
      const exp = { id: 'exp_'+uid(), amount, category, date: fd.get('date') || todayISO(), notes: (fd.get('notes') || '').trim(), paidBy: shouldSplit ? fd.get('paidBy') : ME, receipt: null, split: null };
      
      if (shouldSplit) {
        const members = membersList();
        const parts = splitShares(amount, 'equal', members.map(() => 1));
        const shares = {}; members.forEach((n, i) => shares[n] = parts[i]);
        exp.split = { members, mode:'equal', shares };
      }
      
      state.expenses.push(exp);
      saveState();
      closeModal();
      
      const newSpentCat = categorySpentThisMonth()[category];
      const newTotalSpent = totalSpentThisMonth();
      if (newSpentCat > state.budgets[category]) {
        toast(`Alert: You have exceeded your ${category} budget by ${fmtINR(newSpentCat - state.budgets[category])}!`, 'error');
      } else if (newTotalSpent > totalBudget()) {
        toast(`Alert: You have exceeded your overall monthly budget!`, 'error');
      } else {
        toast(`Expense added: ${fmtINR(amount)}`, 'success');
      }
      render();
    });
  });
}


function openEditExpense(id) {
  const e = state.expenses.find(x => x.id === id);
  if (!e) return;
  openModal('Edit expense', `
    <form id="editExp" class="space-y-3">
      <label class="block"><span class="text-sm font-medium">Amount (₹)</span>
        <input type="number" name="amount" value="${e.amount}" required class="mt-1 w-full px-3 py-2.5 border rounded-lg"/></label>
      <label class="block"><span class="text-sm font-medium">Notes</span>
        <input type="text" name="notes" value="${esc(e.notes)}" class="mt-1 w-full px-3 py-2.5 border rounded-lg"/></label>
      <div class="flex gap-2 pt-2">
        <button type="button" onclick="closeModal()" class="flex-1 border py-2.5 rounded-lg">Cancel</button>
        <button type="submit" class="flex-1 bg-teal-600 text-white font-semibold py-2.5 rounded-lg">Save</button>
      </div>
    </form>`, (root) => {
    root.querySelector('#editExp').addEventListener('submit', (ev) => {
      ev.preventDefault();
      const fd = new FormData(ev.target);
      e.amount = Number(fd.get('amount'));
      e.notes = fd.get('notes');
      if (e.split) {
        const ms = e.split.members;
        if (e.settlement) {
          const to = ms.find(m => m !== e.paidBy);
          e.split.shares = { [e.paidBy]: 0, [to]: e.amount };
        } else {
          const per = Math.round((e.amount / ms.length) * 100) / 100;
          const shares = {};
          ms.forEach(m => shares[m] = per);
          shares[ms[ms.length-1]] = Math.round((e.amount - per*(ms.length-1)) * 100) / 100;
          e.split.shares = shares;
        }
      }
      saveState(); closeModal(); render(); toast('Expense updated','success');
    });
  });
}


function confirmDeleteExpense(id) {
  openModal('Delete expense?', `
    <p class="text-slate-600 mb-4">This can't be undone.</p>
    <div class="flex gap-2">
      <button onclick="closeModal()" class="flex-1 border py-2.5 rounded-lg">Cancel</button>
      <button onclick="deleteExpense('${id}')" class="flex-1 bg-red-600 text-white font-semibold py-2.5 rounded-lg">Delete</button>
    </div>`);
}


function deleteExpense(id) {
  state.expenses = state.expenses.filter(e => e.id !== id);
  saveState(); closeModal(); render(); toast('Expense deleted','success');
}


function refreshExpenseList() { const box = $('#expList'); if (box) box.innerHTML = expenseListHTML(); }

function handleExpenseSearch(el) { expenseFilter.search = el.value; refreshExpenseList(); }

function handleCatFilter(el) { expenseFilter.cat = el.value; refreshExpenseList(); }

function pushExpense(o) {
  state.expenses.push({ id:'exp_'+uid(), receipt:null, split:null, paidBy:ME, date:todayISO(), ...o });
  saveState();
  const over = categorySpentThisMonth()[o.category] > (state.budgets[o.category] || Infinity);
  toast(over ? `Added ${fmtINR(o.amount)} — over your ${o.category} budget` : `Added ${fmtINR(o.amount)} · ${o.category}`, over ? 'warning' : 'success');
  render();
}

function receiptBtnHTML(e) {
  return e.receipt ? `<button onclick="viewReceipt('${e.id}')" class="p-1.5 rounded hover:bg-slate-100" aria-label="View receipt">🧾</button>`
                   : `<button onclick="attachReceipt('${e.id}')" class="p-1.5 rounded hover:bg-slate-100" aria-label="Attach receipt">📎</button>`;
}

function attachReceipt(id) {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
  inp.onchange = () => {
    const f = inp.files[0]; if (!f) return;
    const img = new Image(), url = URL.createObjectURL(f);
    img.onload = () => {
      const s = Math.min(1, 900 / Math.max(img.width, img.height)), c = document.createElement('canvas');
      c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
      let d = c.toDataURL('image/jpeg', .6); if (d.length > 250000) d = c.toDataURL('image/jpeg', .4);
      if (d.length > 400000) return toast('Image is too large to store. Try a closer crop', 'error');
      const e = state.expenses.find(x => x.id === id); if (!e) return;
      e.receipt = d; saveState(); render(); toast('Receipt attached', 'success');
    };
    img.onerror = () => toast('Could not read that image', 'error'); img.src = url;
  };
  inp.click();
}

function viewReceipt(id) {
  const e = state.expenses.find(x => x.id === id); if (!e || !e.receipt) return;
  openModal('Receipt', `<img src="${esc(e.receipt)}" alt="Receipt" class="w-full rounded-lg border"/>
    <button onclick="removeReceipt('${id}')" class="mt-3 w-full border border-red-300 text-red-600 py-2.5 rounded-lg">Remove receipt</button>`);
}

function removeReceipt(id) { const e = state.expenses.find(x => x.id === id); if (e) { e.receipt = null; saveState(); closeModal(); render(); } }
