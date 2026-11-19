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

const LOGO_EMBLEM_SRC = 'assets/logo-emblem.webp';
const LOGO_FULL_SRC = 'assets/logo-full.webp';
const LOGO_SVG = `<img src="${LOGO_EMBLEM_SRC}" alt="Nivora" class="w-10 h-10 flex-shrink-0 object-contain" width="40" height="40" />`;
const LOGO_FULL = `<img src="${LOGO_FULL_SRC}" alt="Nivora: One platform. A healthier tomorrow." class="w-full max-w-[170px] h-auto mx-auto" width="170" height="151" />`;

const ICONS = {
  eye: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-5 h-5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`,
  eyeOff: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-5 h-5"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`,
  plus: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-6 h-6"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  users: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-6 h-6"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>`,
  pill: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-6 h-6"><path d="M10.5 20.5L3.5 13.5a5 5 0 017-7l7 7a5 5 0 01-7 7z"/><line x1="8.5" y1="8.5" x2="15.5" y2="15.5"/></svg>`,
  map: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-6 h-6"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>`,
  bell: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-5 h-5"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>`,
};

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

/* Defined here (not with onboarding) because buildSeed() needs it at load time. */
function blankProfile() {
  return { dob:'', gender:'', genderOther:'', phone:'', city:'', bloodGroup:'', allergies:'', conditions:[],
           emergencyName:'', emergencyRelation:'', emergencyPhone:'', monthlyIncome:'', monthlyBudget:'', goals:[], onboarded:false };
}

function buildSeed() {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth();
  const thisDay = d => `${y}-${pad(m+1)}-${pad(Math.min(d, now.getDate()))}`;
  const lmDate = new Date(y, m-1, 1);
  const lastDay = d => `${lmDate.getFullYear()}-${pad(lmDate.getMonth()+1)}-${pad(d)}`;

  const G = ['Aarav','Rohan','Priya'];
  const exp = (o) => ({ id: 'exp_'+uid(), receipt:null, split:null, ...o });

  const expenses = [
    exp({ amount:2800, category:'Food', date:thisDay(3), notes:'BigBasket groceries', paidBy:'Aarav' }),
    exp({ amount:1800, category:'Food', date:thisDay(7), notes:'Swiggy dinner', paidBy:'Aarav' }),
    exp({ amount:400,  category:'Food', date:thisDay(11), notes:'Chai & snacks', paidBy:'Aarav' }),
    exp({ amount:1500, category:'Health', date:thisDay(9), notes:'Salbutamol + Montelukast', paidBy:'Aarav' }),
    exp({ amount:800,  category:'Transport', date:thisDay(8), notes:'Uber to office', paidBy:'Aarav' }),
    exp({ amount:500,  category:'Entertainment', date:thisDay(12), notes:'Netflix personal', paidBy:'Aarav' }),
    exp({ amount:1200, category:'Other', date:thisDay(14), notes:'Haircut + misc', paidBy:'Aarav' }),
    
    exp({ amount:1500, category:'Food', date:thisDay(2), notes:'Groceries (Flat 302)', paidBy:'Aarav', split:{ members:G, mode:'equal', shares:{ Aarav:500, Rohan:500, Priya:500 } } }),
    exp({ amount:1200, category:'Utilities', date:thisDay(5), notes:'MSEB electricity', paidBy:'Rohan', split:{ members:G, mode:'equal', shares:{ Aarav:400, Rohan:400, Priya:400 } } }),
    exp({ amount:450,  category:'Utilities', date:thisDay(6), notes:'JioFiber Wi-Fi', paidBy:'Priya', split:{ members:G, mode:'equal', shares:{ Aarav:150, Rohan:150, Priya:150 } } }),
    exp({ amount:24000, category:'Rent', date:thisDay(1), notes:'Flat 302 rent', paidBy:'Aarav', split:{ members:G, mode:'equal', shares:{ Aarav:8000, Rohan:8000, Priya:8000 } } }),
    exp({ amount:600,  category:'Utilities', date:thisDay(4), notes:'Water tanker', paidBy:'Rohan', split:{ members:G, mode:'equal', shares:{ Aarav:200, Rohan:200, Priya:200 } } }),
    exp({ amount:450,  category:'Entertainment', date:thisDay(10), notes:'Netflix shared', paidBy:'Priya', split:{ members:G, mode:'equal', shares:{ Aarav:150, Rohan:150, Priya:150 } } }),

    exp({ amount:3760, category:'Food', date:lastDay(3), notes:'Food last month', paidBy:'Aarav' }),
    exp({ amount:8000, category:'Rent', date:lastDay(1), notes:'Rent last month', paidBy:'Aarav' }),
    exp({ amount:1500, category:'Utilities', date:lastDay(4), notes:'Utilities last mo', paidBy:'Aarav' }),
    exp({ amount:700,  category:'Transport', date:lastDay(5), notes:'Transport last mo', paidBy:'Aarav' }),
    exp({ amount:2000, category:'Health', date:lastDay(6), notes:'Meds last month', paidBy:'Aarav' }),
    exp({ amount:600,  category:'Entertainment', date:lastDay(7), notes:'Fun last mo', paidBy:'Aarav' }),
    exp({ amount:900,  category:'Other', date:lastDay(8), notes:'Misc last mo', paidBy:'Aarav' }),
  ];

  const medicines = [
    { id:'med_'+uid(), name:'Salbutamol Inhaler', salt:'Salbutamol 100mcg', dosage:'2 puffs', frequency:'daily', times:['21:00'], startDate: daysAgoISO(60), endDate: null, refillDate: daysAgoISO(-8), stock: 3, active:true, log: { [todayISO()]: {} } },
    { id:'med_'+uid(), name:'Azithromycin', salt:'Azithromycin 500mg', dosage:'1 tablet', frequency:'daily', times:['08:00', '20:00'], startDate: daysAgoISO(2), endDate: daysAgoISO(-3), refillDate: null, stock: 4, active:true, log: { [todayISO()]: {} } },
    { id:'med_'+uid(), name:'Montelukast', salt:'Montelukast 10mg', dosage:'1 tablet', frequency:'daily', times:['21:00'], startDate: daysAgoISO(45), endDate: null, refillDate: daysAgoISO(-12), stock: 5, active:true, log: { [todayISO()]: {} } }
  ];



  return {
    user: { name:'Aarav Sharma', email:'aarav@demo.nivora', avatarInitials:'AS', largeText:false, notifications:true, lowBalanceThreshold:1000 },
    budgets: { Food:6000, Rent:8500, Utilities:1800, Transport:1200, Health:2500, Entertainment:1000, Other:4000 },
    totalBudgetMonthly: 25000,
    expenses, medicines, notifications: [],
    profiles: { 'aarav@demo.nivora': { ...blankProfile(), dob:'1996-04-12', gender:'Male', phone:'+91 98765 43210', city:'Pune', bloodGroup:'B+', emergencyName:'Meera Sharma', emergencyRelation:'Mother', emergencyPhone:'+91 98765 00000', monthlyIncome:'45000', goals:['Track daily expenses','Get medicine reminders'], onboarded:true } },
  };
}

let STORE_KEY = null;                        // set when an account is opened: nivora_state_<id>
let state = null;
let currentUser = null;

/* Storage wrappers: safe under private mode / quota errors / disabled storage.
   State always lives in memory, so the app still works if persistence fails. */
const store = {
  get(k)    { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); return true; } catch { return false; } },
  remove(k) { try { localStorage.removeItem(k); } catch {} },
};
const ssGet    = k => { try { return sessionStorage.getItem(k); } catch { return null; } };
const ssSet    = (k, v) => { try { sessionStorage.setItem(k, v); } catch {} };
const ssRemove = k => { try { sessionStorage.removeItem(k); } catch {} };

/* Schema versioning: bump SCHEMA_VERSION when the stored shape changes and add a step to
   MIGRATIONS[newVersion] that mutates/returns the old state. User data is never wiped. */
const SCHEMA_VERSION = 2;
const MIGRATIONS = {
  2: s => { // per-account profiles; existing account counts as already onboarded
    s.profiles = s.profiles || {};
    const key = String(s.user?.email || '').toLowerCase();
    if (key && !s.profiles[key]) s.profiles[key] = { ...blankProfile(), onboarded: true };
    return s;
  },
};
function migrateState(s) {
  let v = Number(s.schemaVersion) || 1;
  while (v < SCHEMA_VERSION) { v++; if (MIGRATIONS[v]) s = MIGRATIONS[v](s); }
  delete s.kendras; delete s.genericMeds; delete s.savingsTracker; if (s.user) delete s.user.location;   // removed features
  s.schemaVersion = SCHEMA_VERSION;
  return s;
}
function freshState() { const s = buildSeed(); s.schemaVersion = SCHEMA_VERSION; return s; }

let storageWarned = false;
function loadState() { try { const raw = store.get(STORE_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; } }
function persistLocal() {
  if (!STORE_KEY) return true;               // signed-out guest state is never written to disk
  if (!store.set(STORE_KEY, JSON.stringify(state)) && !storageWarned) {
    storageWarned = true;
    toast('Storage is unavailable — changes will be lost when you close this tab', 'warning');
    return false;
  }
  return true;
}
function saveState() {
  persistLocal();
  if (typeof NativeAlarms !== 'undefined') NativeAlarms.requestSync(); // keep OS alarms in step with the data
}
function resetDemo() { store.remove(STORE_KEY); state = freshState(); saveState(); toast('Demo data reset','success'); render(); }

/* LEGACY one-time wipe for data written before v1.5 (its shape is unknown). Do NOT bump this
   constant for future changes - use SCHEMA_VERSION + MIGRATIONS above instead. */
state = blankState({ name: '', email: '' });   // signed-out placeholder; never written to disk (account is opened in 10-account.js)
if (state.user.largeText) document.documentElement.classList.add('large-text');

/* Identity helpers. The demo seed has no meKey/group, so it keeps its legacy Aarav / Flat 302 identity;
   real accounts get meKey 'You' and their own editable group. */
const ME = () => (state && state.user && state.user.meKey) || 'Aarav';
const groupInfo = () => (state && state.group) || { name: 'Flat 302', members: ['Aarav', 'Rohan', 'Priya'] };
const groupMembers = () => groupInfo().members;
const groupName = () => groupInfo().name;

const APP_VERSION = '1.0.0';
const DEMO_USER = { name: 'Aarav Sharma', email: 'aarav@demo.nivora' };
const profileKeyFor = u => String((u && u.email) || '').toLowerCase();   // key of the user's entry in state.profiles
function initialsOf(n) { return String(n || '').split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?'; }
function titleCase(t) { return String(t).replace(/[._-]+/g, ' ').replace(/\b\p{L}/gu, c => c.toUpperCase()); }

/* ---- Accounts (stored on this device only) ---- */
function ensureExt() {
  state.ext = Object.assign({ balance:null, lowAt:1000, bills:[], caregiver:{name:'',phone:''}, upi:{}, alerted:{} }, state.ext || {});
}
function applyUiPrefs() { document.documentElement.classList.toggle('large-text', !!(state.user && state.user.largeText)); }
/* A new profile starts EMPTY (no demo data). */
function blankState({ name, email, consentAt }) {
  const seed = buildSeed();
  return {
    schemaVersion: SCHEMA_VERSION,
    user: { name, email, avatarInitials: initialsOf(name), meKey: 'You', largeText: false, notifications: true,
            lowBalanceThreshold: 1000, consentAt: consentAt || null },
    budgets: seed.budgets, totalBudgetMonthly: seed.totalBudgetMonthly,
    expenses: [], medicines: [], notifications: [],
    group: { name: 'My group', members: ['You'] },
    profiles: {},
  };
}


