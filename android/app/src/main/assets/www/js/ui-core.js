/* =====================================================================
   ui-core.js - toasts, modal dialog, in-app notifications and reminders.
   ===================================================================== */


function toast(msg, type='info') {
  const colors = { info:'bg-slate-800', success:'bg-teal-600', error:'bg-red-600', warning:'bg-amber-500' };
  const el = document.createElement('div');
  el.className = `toast-in ${colors[type]} text-white px-4 py-3 rounded-xl shadow-lg max-w-sm text-sm font-medium pointer-events-auto flex items-start gap-2`;
  el.innerHTML = `<span class="mt-0.5">${type==='error'||type==='warning'?'⚠️':type==='success'?'✅':'ℹ️'}</span> <span>${esc(msg)}</span>`;
  $('#toast-container').appendChild(el);
  setTimeout(() => el.remove(), 4000);
}


function openModal(title, bodyHTML, onMount) {
  const root = $('#modal-root');
  root.innerHTML = `
    <div class="fixed inset-0 bg-slate-900/50 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-4" data-modal-backdrop>
      <div class="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto" role="dialog" aria-modal="true">
        <div class="sticky top-0 bg-white border-b border-slate-100 px-5 py-4 flex items-center justify-between rounded-t-2xl">
          <h2 class="text-lg font-bold text-slate-900">${esc(title)}</h2>
          <button data-close-modal aria-label="Close" class="p-2 hover:bg-slate-100 rounded-lg text-slate-500">✕</button>
        </div>
        <div class="p-5">${bodyHTML}</div>
      </div>
    </div>`;
  root.querySelectorAll('[data-close-modal]').forEach(b => b.addEventListener('click', closeModal));
  root.querySelector('[data-modal-backdrop]').addEventListener('click', e => { if (e.target.dataset.modalBackdrop !== undefined) closeModal(); });
  
  const focusables = root.querySelectorAll('button, input, select, textarea, a[href]');
  if (focusables.length) focusables[0].focus();
  root.onkeydown = e => {
    if (e.key === 'Escape') { closeModal(); return; }
    if (e.key === 'Tab') {
      if (e.shiftKey && document.activeElement === focusables[0]) { e.preventDefault(); focusables[focusables.length-1].focus(); }
      else if (!e.shiftKey && document.activeElement === focusables[focusables.length-1]) { e.preventDefault(); focusables[0].focus(); }
    }
  };

  if (onMount) onMount(root);
}

function closeModal() { const r = $('#modal-root'); r.innerHTML = ''; r.onkeydown = null; }


async function ensureNotificationPerm() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  return (await Notification.requestPermission()) === 'granted';
}

function fireReminder(title, body) {
  state.notifications.unshift({ id: uid(), title, body, at: new Date().toISOString() });
  state.notifications = state.notifications.slice(0, 50);
  saveState(); toast(`${title}: ${body}`, 'info');
  if ('Notification' in window && Notification.permission === 'granted') {
    try { new Notification(title, { body, tag: 'nivora-' + uid() }); } catch {}
  }
  const dot = $('#notifDot'); if (dot) dot.classList.remove('hidden');
}


async function testReminder() {
  const ok = await ensureNotificationPerm();
  const med = state.medicines.length > 0 ? state.medicines[0] : null;
  const name = med ? med.name : 'your medicine';
  const time = med && med.times.length > 0 ? med.times[0] : '21:00';
  fireReminder('💊 Medicine reminder', `Time to take ${name} (${fmtTime12(time)})`);
  if (!ok) toast('Browser notifications are blocked. Allow them in your browser site settings to get alerts.','warning');
}


function openNotifications() {
  openModal('Notifications', `
    ${state.notifications.length ? `<ul class="space-y-2">${state.notifications.map(n => `
      <li class="p-3 bg-slate-50 rounded-lg border border-slate-100">
        <p class="font-medium text-slate-900 text-sm">${esc(n.title)}</p>
        <p class="text-xs text-slate-600">${esc(n.body)}</p>
        <p class="text-[10px] text-slate-400 mt-1">${new Date(n.at).toLocaleString('en-IN')}</p>
      </li>`).join('')}</ul>` : '<p class="text-slate-500 text-center py-6">No notifications yet.</p>'}
  `);
}
