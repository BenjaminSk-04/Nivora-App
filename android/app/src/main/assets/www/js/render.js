/* =====================================================================
   render.js - the router render() and the dose-reminder timer loop.
   ===================================================================== */


function render() {
  const path = (window.location.hash.replace(/^#/, '') || '/dashboard');
  if (!isOnboarded() && path !== '/onboarding') return navigate('/onboarding');
  if (isOnboarded() && path === '/onboarding') return navigate('/dashboard');

  const app = $('#app');
  if (path === '/onboarding') {
    app.innerHTML = views[path]();
    return;
  }

  app.innerHTML = `
    ${topNav(path)}
    <main class="max-w-6xl mx-auto px-4 py-5 pb-24 md:pb-8">${(views[path] || views['/dashboard'])()}</main>
    ${bottomNav(path)}
  `;
  document.documentElement.classList.toggle('large-text', state.user.largeText);
}


/* Dose reminders fire only during the exact scheduled clock minute.
   Fired keys are persisted per day so a reload does not re-fire them.
   Browser/OS background throttling can delay or suppress reminders while the page is inactive. */
const FIRED_KEY = 'nivora_fired';

const firedReminders = (() => {
  try { const o = JSON.parse(store.get(FIRED_KEY) || '{}'); return new Set(o.day === todayISO() ? o.keys : []); }
  catch { return new Set(); }
})();

function persistFired() {
  const today = todayISO();
  for (const k of firedReminders) if (!k.startsWith(today)) firedReminders.delete(k);
  store.set(FIRED_KEY, JSON.stringify({ day: today, keys: [...firedReminders] }));
}

function checkDoseReminders() {
  if (!isOnboarded() || !state.user.notifications) return;
  const now = new Date(), nowMin = now.getHours() * 60 + now.getMinutes(), today = todayISO();
  for (const d of todaysDoses()) {
    if (d.status !== 'pending') continue;
    const [h, m] = d.time.split(':').map(Number);
    if (nowMin !== h * 60 + (m || 0)) continue;
    const key = `${today}|${d.med.id}|${d.time}`;
    if (firedReminders.has(key)) continue;
    firedReminders.add(key); persistFired();
    fireReminder('💊 Medicine reminder', `It is time to take ${d.med.name} (${fmtTime12(d.time)}).`);
  }
}

setInterval(checkDoseReminders, 1000);

setInterval(() => {
  const path = (window.location.hash.replace(/^#/, '') || '/dashboard');
  if (path === '/medicines' && !document.hidden) render();
}, 15000);

document.addEventListener('visibilitychange', () => { if (!document.hidden) checkDoseReminders(); });
