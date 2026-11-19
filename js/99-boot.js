/* Load-time side effects. Kept in the last file so every function declaration exists first. */
setInterval(checkDoseReminders, 1000);
setInterval(() => {
  const path = (window.location.hash.replace(/^#/, '') || '/dashboard');
  if (path === '/medicines' && !document.hidden) render();
}, 15000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) checkDoseReminders(); });
checkDoseReminders();
NativeAlarms.requestSync();   // restore/refresh OS alarms for an already-signed-in session
