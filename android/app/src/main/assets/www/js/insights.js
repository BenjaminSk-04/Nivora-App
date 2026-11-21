/* =====================================================================
   insights.js - Insights screen and past-month spending summary.
   ===================================================================== */


/* ---------- Past month spending (Insights) ---------- */
function pastMonthStats(days = 30) {
  const byDay = {};
  for (const e of state.expenses) { const a = myShare(e); if (a > 0) { const k = String(e.date).slice(0, 10); byDay[k] = (byDay[k] || 0) + a; } }
  const cur = [];
  for (let i = days - 1; i >= 0; i--) { const iso = daysAgoISO(i); cur.push({ iso, value: byDay[iso] || 0 }); }
  let prev = 0; for (let i = days; i < days * 2; i++) prev += byDay[daysAgoISO(i)] || 0;
  const total = cur.reduce((t, d) => t + d.value, 0);
  const top = cur.reduce((b, d) => d.value > b.value ? d : b, cur[0]);
  return { cur, total, prev, avg: total / days, top, diff: total - prev, pct: prev > 0 ? (total - prev) / prev * 100 : null };
}

const pmDay = (iso, long) => new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', long ? { weekday:'short', day:'numeric', month:'long' } : { day:'numeric', month:'short' });

function pmSelect(el) {
  document.querySelectorAll('.pm-bar').forEach(b => b.setAttribute('opacity', b === el ? '1' : '0.5'));
  const out = document.getElementById('pmReadout');
  if (out) out.innerHTML = `<b class="text-slate-900">${esc(pmDay(el.dataset.iso, true))}</b> · ${Number(el.dataset.v) > 0 ? fmtINR(Number(el.dataset.v)) : 'no spending'}`;
}

function pastMonthHTML() {
  const st = pastMonthStats(30);
  const head = `<h2 class="font-bold text-slate-900">Past month spending</h2><p class="text-sm text-slate-500">Daily expenses, last 30 days</p>`;
  if (st.total <= 0) return `<div class="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">${head}
    <p class="text-slate-500 text-sm mt-6 mb-2 text-center">No spending recorded in the last 30 days. Add an expense to see your daily pattern.</p></div>`;
  const W = 600, H = 160, base = 150, top = 14, n = st.cur.length, slot = (W - 16) / n, bw = slot * 0.62;
  const max = Math.max(...st.cur.map(d => d.value), 1), y = v => base - (v / max) * (base - top);
  const bars = st.cur.map((d, i) => {
    const x = 8 + i * slot + (slot - bw) / 2, h = Math.max(d.value > 0 ? (d.value / max) * (base - top) : 2, 2), isTop = d.iso === st.top.iso;
    return `<rect class="pm-bar" x="${x.toFixed(1)}" y="${(base - h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="2" fill="${d.value <= 0 ? '#e2e8f0' : isTop ? '#0f766e' : '#14b8a6'}"
      opacity="1" data-iso="${d.iso}" data-v="${Math.round(d.value)}" tabindex="0" role="button" aria-label="${esc(pmDay(d.iso, true))}: ${d.value > 0 ? fmtINR(d.value) : 'no spending'}"
      onclick="pmSelect(this)" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();pmSelect(this)}" style="cursor:pointer"><title>${esc(pmDay(d.iso))}: ${d.value > 0 ? fmtINR(d.value) : 'no spending'}</title></rect>`;
  }).join('');
  const ticks = [0, 6, 12, 18, 24, 29].map(i => `<text x="${(8 + i * slot + slot / 2).toFixed(1)}" y="${H + 14}" font-size="11" fill="#64748b" text-anchor="${i === 0 ? 'start' : i === 29 ? 'end' : 'middle'}">${esc(pmDay(st.cur[i].iso))}</text>`).join('');
  const avgY = y(st.avg).toFixed(1);
  const up = st.diff > 0, flat = Math.abs(st.diff) < 1;
  const cmpColor = flat ? 'text-slate-700' : up ? 'text-red-600' : 'text-teal-700';
  const cmpText = flat ? 'Same' : `${up ? '↑' : '↓'} ${fmtINR(Math.abs(st.diff))}`;
  const summary = st.prev <= 0 ? `You spent <b>${fmtINR(st.total)}</b> in the last 30 days.`
    : flat ? `You spent <b>${fmtINR(st.total)}</b>, about the same as the previous 30 days.`
    : `You spent <b>${fmtINR(st.total)}</b>, <b class="${cmpColor}">${fmtINR(Math.abs(st.diff))} ${up ? 'more' : 'less'}</b> than the previous 30 days${st.pct !== null ? ` (${Math.abs(Math.round(st.pct))}%)` : ''}.`;
  const tile = (label, val, cls = 'text-slate-900') => `<div class="bg-slate-50 rounded-2xl px-2 py-3 text-center"><p class="text-[11px] font-semibold uppercase tracking-wide text-slate-500">${label}</p><p class="text-lg font-extrabold mt-1 ${cls}">${val}</p></div>`;
  return `<div class="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
    ${head}
    <p class="text-sm text-slate-700 mt-3">${summary}</p>
    <p id="pmReadout" aria-live="polite" class="text-sm text-slate-500 mt-3 min-h-[1.25rem]">Tap a bar to see that day's spending.</p>
    <div class="mt-1 overflow-x-auto no-scrollbar"><svg viewBox="0 0 ${W} ${H + 20}" class="w-full min-w-[420px]" role="group" aria-label="Daily spending bar chart for the last 30 days">
      <line x1="8" y1="${base}" x2="${W - 8}" y2="${base}" stroke="#e2e8f0"/>
      <line x1="8" y1="${avgY}" x2="${W - 8}" y2="${avgY}" stroke="#f59e0b" stroke-width="1.5" stroke-dasharray="5 4"/>
      <text x="${W - 8}" y="${Number(avgY) - 4}" font-size="11" fill="#b45309" text-anchor="end">Avg ${fmtINR(st.avg)}/day</text>
      ${bars}${ticks}</svg></div>
    <div class="grid grid-cols-3 gap-3 mt-3">
      ${tile('Total', fmtINR(st.total))}${tile('Daily avg', fmtINR(st.avg))}${tile('vs previous 30 days', cmpText, cmpColor)}
    </div>
    <p class="text-sm text-slate-500 mt-3">Highest day: <b class="text-slate-800">${esc(new Date(st.top.iso + 'T00:00:00').toLocaleDateString('en-IN', { day:'numeric', month:'long' }))}</b> (${fmtINR(st.top.value)})</p>
  </div>`;
}


views['/insights'] = () => {
  const catSpent = categorySpentThisMonth();
  const pieData = CATEGORIES.map(c => ({ label:c, value:catSpent[c], color:catColor(c) })).filter(d => d.value > 0);
  const sixMonths = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(new Date().getFullYear(), new Date().getMonth() - i, 1);
    const key = monthKeyOffset(i);
    sixMonths.push({ label: d.toLocaleDateString('en-IN', { month:'short' }), value: state.expenses.filter(e => monthKey(e.date) === key).reduce((s,e) => s + myShare(e), 0) });
  }
  return `
  <h1 class="text-2xl md:text-3xl font-extrabold text-slate-900 mb-4">Money</h1>
  ${tabBar('/insights', MONEY_TABS)}
  <div class="space-y-4">
    ${pastMonthHTML()}
    <div class="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
      <h2 class="font-bold text-slate-900 mb-3">Category breakdown</h2>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
        <div>${pieChart(pieData)}</div>
        <ul class="space-y-1.5">
          ${pieData.map(d => `<li class="flex items-center justify-between text-sm">
            <span class="flex items-center gap-2"><span class="w-3 h-3 rounded-full" style="background:${d.color}"></span>${d.label}</span>
            <span class="font-semibold">${fmtINR(d.value)}</span>
          </li>`).join('')}
        </ul>
      </div>
    </div>
    <div class="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
      <h2 class="font-bold text-slate-900 mb-3">6-month spend trend</h2>
      ${lineChart(sixMonths)}
    </div>
  </div>`;
};
