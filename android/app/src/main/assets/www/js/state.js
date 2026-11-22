/* =====================================================================
   state.js - the app state shape (buildSeed), local storage wrapper, schema
   versioning + migrations, save/load, and small account helpers.
   To change what's stored: bump SCHEMA_VERSION and add a MIGRATIONS step.
   ===================================================================== */

/* A brand-new install starts completely empty — no sample expenses, no sample
   medicines, no fictional flatmates. Real users don't want someone else's demo
   data sitting in their app. Budgets keep sensible starting numbers (you can
   change or zero them out in Budgets any time); everything else starts blank. */
function buildSeed() {
  return {
    user: { name:'', email:'', avatarInitials:'', largeText:false, notifications:true, lowBalanceThreshold:1000 },
    budgets: { Food:6000, Rent:8500, Utilities:1800, Transport:1200, Health:2500, Entertainment:1000, Other:4000 },
    totalBudgetMonthly: 25000,
    expenses: [], medicines: [], savingsTracker: [], notifications: [],
    flatmates: [], groupName: '',
    profiles: {},
  };
}


const STORE_KEY = 'nivora_v1';

let state = null;

const LOCAL_USER_EMAIL = 'me@nivora.local';


/* Storage wrappers: safe under private mode / quota errors / disabled storage.
   State always lives in memory, so the app still works if persistence fails. */
const store = {
  get(k)    { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); return true; } catch { return false; } },
  remove(k) { try { localStorage.removeItem(k); } catch {} },
};


/* Schema versioning: bump SCHEMA_VERSION when the stored shape changes and add a step to
   MIGRATIONS[newVersion] that mutates/returns the old state. User data is never wiped. */
const SCHEMA_VERSION = 3;

const MIGRATIONS = {
  2: s => { // per-account profiles; existing account counts as already onboarded
    s.profiles = s.profiles || {};
    const key = String(s.user?.email || '').toLowerCase();
    if (key && !s.profiles[key]) s.profiles[key] = { ...blankProfile(), onboarded: true };
    return s;
  },
  3: s => { // "me" is now a stable internal key (ME) instead of the hardcoded demo
            // name 'Aarav', and flatmates/group name are real, user-managed data.
    const LEGACY_ME = 'Aarav';
    const foundFlatmates = new Set();
    for (const e of (s.expenses || [])) {
      if (e.paidBy === LEGACY_ME) e.paidBy = ME;
      if (e.split) {
        e.split.members = (e.split.members || []).map(m => m === LEGACY_ME ? ME : m);
        if (e.split.shares && Object.prototype.hasOwnProperty.call(e.split.shares, LEGACY_ME)) {
          e.split.shares[ME] = e.split.shares[LEGACY_ME];
          delete e.split.shares[LEGACY_ME];
        }
        for (const m of e.split.members) if (m !== ME) foundFlatmates.add(m);
      }
    }
    if (!Array.isArray(s.flatmates)) s.flatmates = [...foundFlatmates];
    if (typeof s.groupName !== 'string') s.groupName = '';
    return s;
  },
};

function migrateState(s) {
  let v = Number(s.schemaVersion) || 1;
  while (v < SCHEMA_VERSION) { v++; if (MIGRATIONS[v]) s = MIGRATIONS[v](s); }
  s.schemaVersion = SCHEMA_VERSION;
  return s;
}

function freshState() { const s = buildSeed(); s.schemaVersion = SCHEMA_VERSION; return s; }


let storageWarned = false;

function loadState() { try { const raw = store.get(STORE_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; } }

function saveState() {
  if (!store.set(STORE_KEY, JSON.stringify(state)) && !storageWarned) {
    storageWarned = true;
    toast('Storage is unavailable — changes will be lost when you close this tab', 'warning');
  }
}



/* LEGACY one-time wipe for data written before v1.5 (its shape is unknown). Do NOT bump this
   constant for future changes - use SCHEMA_VERSION + MIGRATIONS above instead. */
const LEGACY_SEED_VERSION = 'v1.5';


const initialsOf = n => n.split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?';

function setUserName(name) {
  state.user.name = name;
  state.user.email = LOCAL_USER_EMAIL;
  state.user.avatarInitials = initialsOf(name);
  saveState();
}

/* Nivora is a single local-profile app: there's no server account, so "sign out" really
   means "clear my profile & data and start the onboarding wizard again". */
function isOnboarded() { return !!getProfile()?.onboarded; }

function resetProfile() {
  closeModal();
  if (state.profiles) delete state.profiles[profileKey()];
  obReset();
  navigate('/onboarding');
}
