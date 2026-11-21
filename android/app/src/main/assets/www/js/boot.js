/* =====================================================================
   boot.js - app startup. MUST load last.
   Everything else only *defines* functions and registers views; this file
   is the only place that runs state-dependent code at startup:
     1. one-time legacy storage wipe, 2. load + migrate (or create) state,
     3. apply saved UI prefs, 4. first reminder check, 5. start the router.
   ===================================================================== */

if (store.get('nivora_seed_ver') !== LEGACY_SEED_VERSION) {
  store.remove(STORE_KEY);
  store.set('nivora_seed_ver', LEGACY_SEED_VERSION);
}

{
  const loaded = loadState();
  state = (loaded && loaded.user) ? migrateState(loaded) : freshState();
  saveState();
}

if (state.user.largeText) document.documentElement.classList.add('large-text');

/* Extension data (bills, balance, caregiver, UPI ids). Always has defaults. */
state.ext = Object.assign({ balance:null, lowAt:1000, bills:[], caregiver:{name:'',phone:''}, upi:{}, alerted:{} }, state.ext || {});

checkDoseReminders();

window.addEventListener('hashchange', render);
window.addEventListener('load', render);
