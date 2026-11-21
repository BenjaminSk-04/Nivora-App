/* =====================================================================
   charts.js - progress bar, pie chart and line chart (pure SVG/HTML string builders).
   ===================================================================== */


function progressBar(pct, color) {
  return `<div class="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden"><div class="h-full rounded-full transition-all duration-500" style="width:${Math.min(pct,100)}%;background:${color}"></div></div>`;
}

function budgetColor(pct) { return pct < 70 ? '#0d9488' : pct < 90 ? '#f59e0b' : '#dc2626'; }

function pieChart(data) {
  const total = data.reduce((s,d) => s + d.value, 0);
  if (!total) return '<p class="text-sm text-slate-500 text-center">No data</p>';
  let angle = -Math.PI/2, cx=100, cy=100, r=76;
  const live = data.filter(d => d.value > 0);
  if (live.length === 1) return `<svg viewBox="0 0 200 200" class="w-full max-w-[220px] mx-auto"><circle cx="100" cy="100" r="76" fill="${live[0].color}" stroke="white" stroke-width="2"><title>${live[0].label}: ${fmtINR(live[0].value)}</title></circle><circle cx="100" cy="100" r="42" fill="white"/></svg>`;
  const slices = live.map(d => {
    const frac = d.value / total, next = angle + frac * 2 * Math.PI;
    const x1 = cx + r*Math.cos(angle), y1 = cy + r*Math.sin(angle);
    const x2 = cx + r*Math.cos(next), y2 = cy + r*Math.sin(next);
    const large = frac > 0.5 ? 1 : 0;
    const path = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
    angle = next;
    return `<path d="${path}" fill="${d.color}" stroke="white" stroke-width="2"><title>${d.label}: ${fmtINR(d.value)}</title></path>`;
  }).join('');
  return `<svg viewBox="0 0 200 200" class="w-full max-w-[220px] mx-auto">${slices}<circle cx="100" cy="100" r="42" fill="white"/></svg>`;
}

function lineChart(points) {
  if (!points.length) return '';
  const w=400, h=160, padX=24, padY=24, max = Math.max(...points.map(p => p.value), 1);
  const step = (w - 2*padX) / Math.max(points.length - 1, 1);
  const coords = points.map((p,i) => ({ x: padX + i*step, y: h - padY - (p.value/max)*(h - 2*padY), ...p }));
  const pts = coords.map(c => `${c.x},${c.y}`).join(' ');
  return `<svg viewBox="0 0 ${w} ${h}" class="w-full">
    <defs><linearGradient id="grad-teal" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stop-color="#0d9488" stop-opacity="0.25"/><stop offset="100%" stop-color="#0d9488" stop-opacity="0"/></linearGradient></defs>
    <path d="M ${coords[0].x} ${h-padY} L ${pts.split(' ').join(' L ')} L ${coords[coords.length-1].x} ${h-padY} Z" fill="url(#grad-teal)"/>
    <polyline points="${pts}" fill="none" stroke="#0d9488" stroke-width="2.5" stroke-linecap="round"/>
    ${coords.map(c => `<circle cx="${c.x}" cy="${c.y}" r="3.5" fill="white" stroke="#0d9488" stroke-width="2"><title>${c.label}: ${fmtINR(c.value)}</title></circle>`).join('')}
    ${coords.map(c => `<text x="${c.x}" y="${h-4}" text-anchor="middle" font-size="9" fill="#64748b">${c.label}</text>`).join('')}
  </svg>`;
}
