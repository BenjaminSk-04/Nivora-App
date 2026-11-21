/* =====================================================================
   forms.js - small helpers shared by many forms (input class, category <option>s, number parsing).
   ===================================================================== */

const ext = () => state.ext;

const numOf = v => { const n = Number(String(v).replace(/,/g,'')); return Number.isFinite(n) ? n : NaN; };

const catOptions = sel => CATEGORIES.map(c => `<option value="${c}" ${c===sel?'selected':''}>${CATEGORY_META[c].icon} ${c}</option>`).join('');

const inCls = 'mt-1 w-full px-3 py-2.5 border border-slate-300 rounded-lg';
