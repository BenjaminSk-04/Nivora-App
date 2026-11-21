/* =====================================================================
   Nivora — v1.7 (quick add, forecasts, flexible splits, caregiver alerts)
   ===================================================================== */

const $  = (sel, root=document) => root.querySelector(sel);

const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

const pad = n => String(n).padStart(2,'0');

const uid = () => Math.random().toString(36).slice(2, 10);


const todayISO = () => { 
  const d = new Date(); 
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; 
};

const daysAgoISO = n => { 
  const d = new Date(); 
  d.setDate(d.getDate()-n); 
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; 
};


const fmtINR = n => new Intl.NumberFormat('en-IN', { style:'currency', currency:'INR', maximumFractionDigits: 0 }).format(n);

const fmtINR2 = n => new Intl.NumberFormat('en-IN', { style:'currency', currency:'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const daysUntil = iso => Math.ceil((new Date(iso) - new Date(todayISO())) / 86400000);

const monthKey = iso => iso ? iso.slice(0,7) : '';

const thisMonthKey = () => todayISO().slice(0,7);

const monthKeyOffset = n => { const d = new Date(); const x = new Date(d.getFullYear(), d.getMonth() - n, 1); return `${x.getFullYear()}-${pad(x.getMonth()+1)}`; };

const prevMonthKey = () => monthKeyOffset(1);

const fmtDay = iso => new Date(iso + 'T00:00:00').toLocaleDateString('en-IN', { day:'numeric', month:'short' });

const catColor = c => ({Food:'#0d9488',Rent:'#6366f1',Utilities:'#f59e0b',Transport:'#3b82f6',Health:'#ec4899',Entertainment:'#8b5cf6',Other:'#64748b'}[c] || '#64748b');

const CATEGORIES = ['Food','Rent','Transport','Health','Utilities','Entertainment','Other'];

const CATEGORY_META = {
  Food: { icon:'🍽️', hint:'Meals & groceries' },
  Rent: { icon:'🏠', hint:'Home & rent' },
  Transport: { icon:'🚌', hint:'Travel & fuel' },
  Health: { icon:'💊', hint:'Medical & wellness' },
  Utilities: { icon:'💡', hint:'Bills & utilities' },
  Entertainment: { icon:'🎬', hint:'Fun & leisure' },
  Other: { icon:'🛍️', hint:'Shopping & other costs' },
};


function fmtTime12(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hh = h % 12 || 12;
  return `${hh}:${pad(m || 0)} ${ampm}`;
}


function autoCategorize(notes='') {
  const n = notes.toLowerCase();
  const rules = [
    [/\b(groceries|vegetables|milk|bread|bigbasket|blinkit|zepto|dmart|chai|snack)/, 'Food'],
    [/\b(swiggy|zomato|restaurant|cafe|dinner|lunch|breakfast|food)/, 'Food'],
    [/\b(rent|maintenance|society)/, 'Rent'],
    [/\b(electricity|mseb|water|gas|wifi|fiber|internet|broadband|utility|bill)/, 'Utilities'],
    [/\b(uber|ola|auto|petrol|diesel|metro|bus|train|transport)/, 'Transport'],
    [/\b(medicine|pharmacy|doctor|hospital|clinic|medical|chemist|inhaler|tablet|health)/, 'Health'],
    [/\b(netflix|spotify|prime|hotstar|movie|game|entertainment)/, 'Entertainment'],
  ];
  for (const [re, cat] of rules) if (re.test(n)) return cat;
  return 'Other';
}
