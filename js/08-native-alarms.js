/* Native medicine alarms (Android, via Capacitor Local Notifications).
   Why: page timers stop when the app is closed or the phone sleeps. Android's AlarmManager does not.
   How: we keep the next DAYS days of pending doses scheduled as one-shot OS notifications and rebuild
   that plan whenever data changes (saveState) or the app returns to the foreground. A dose that is
   already taken/skipped is simply left out of the plan, so its alarm is cancelled automatically.
   On the web (no Capacitor) this module is inert and the in-page reminders keep working. */
const NativeAlarms = (() => {
  const cap = window.Capacitor;
  const isNative = !!(cap && cap.isNativePlatform && cap.isNativePlatform());
  let LN = null; try { LN = isNative ? cap.registerPlugin('LocalNotifications') : null; } catch { LN = null; }   // never let a plugin problem break the app
  const CHANNEL = 'doses', DAYS = 14, MAX = 200, PROMPTED_KEY = 'nivora_alarm_prompted';
  let timer = null, busy = false, rerun = false;

  const isoLocal = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  function idFor(key, used) {                       // stable positive 31-bit id (FNV-1a), collision-safe
    let h = 0x811c9dc5;
    for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    let id = (h & 0x7fffffff) || 1;
    while (used.has(id)) id = (id % 0x7fffffff) + 1;
    used.add(id); return id;
  }

  /* Pure function: which alarms should exist right now? */
  function plan(now = new Date()) {
    if (!currentUser || !state || !state.user || !state.user.notifications) return [];
    const out = [];
    for (let i = 0; i < DAYS; i++) {
      const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
      const iso = isoLocal(day);
      for (const med of state.medicines) {
        if (!isDoseDue(med, iso)) continue;
        for (const time of med.times) {
          const [h, m] = time.split(':').map(Number);
          const at = new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m || 0, 0);
          if (at <= now) continue;
          const st = med.log && med.log[iso] && med.log[iso][time];
          if (st === 'taken' || st === 'skipped') continue;
          out.push({ at, med, time, iso });
        }
      }
    }
    out.sort((a, b) => a.at - b.at);
    const used = new Set();
    return out.slice(0, MAX).map(o => ({ ...o, id: idFor(`${o.iso}|${o.med.id}|${o.time}`, used) }));
  }

  async function ensureChannel() {
    await LN.createChannel({
      id: CHANNEL, name: 'Medicine reminders', description: 'Alerts when a dose is due',
      importance: 5, visibility: 0, vibration: true,   // visibility 0 = private: lock screen hides the contents
    });
  }

  /* Rebuild the OS schedule from the plan. Never prompts by itself unless there is something to remind about. */
  async function sync() {
    if (!LN) return;
    if (busy) { rerun = true; return; }
    busy = true;
    try {
      const items = plan();
      let perm = (await LN.checkPermissions()).display;
      if (perm !== 'granted' && items.length && !store.get(PROMPTED_KEY)) {     // ask once, in context
        store.set(PROMPTED_KEY, '1');
        perm = (await LN.requestPermissions()).display;
      }
      if (perm !== 'granted') return;
      await ensureChannel();
      const pending = (await LN.getPending()).notifications || [];
      if (pending.length) await LN.cancel({ notifications: pending.map(n => ({ id: n.id })) });
      if (items.length) {
        await LN.schedule({
          notifications: items.map(it => ({
            id: it.id, channelId: CHANNEL,
            title: '💊 Medicine reminder',
            body: `It is time to take ${it.med.name} (${fmtTime12(it.time)}).`,
            schedule: { at: it.at, allowWhileIdle: true },
            extra: { medId: it.med.id, time: it.time, date: it.iso },
          })),
        });
      }
    } catch (e) { console.warn('NativeAlarms.sync failed', e); }
    finally { busy = false; if (rerun) { rerun = false; sync(); } }
  }
  function requestSync() { if (!LN) return; clearTimeout(timer); timer = setTimeout(sync, 400); }

  /* User-initiated: ask for permission and tell the caller whether exact alarms are allowed. */
  async function enable() {
    if (!LN) return { ok: false, reason: 'web' };
    try {
      await ensureChannel();
      let p = (await LN.checkPermissions()).display;
      if (p !== 'granted') p = (await LN.requestPermissions()).display;
      if (p !== 'granted') return { ok: false, reason: 'permission' };
      let exact = 'granted';
      try { exact = (await LN.checkExactNotificationSetting()).exact_alarm; } catch {}
      await sync();
      return { ok: true, exact };
    } catch (e) { console.warn('NativeAlarms.enable failed', e); return { ok: false, reason: 'error' }; }
  }
  async function openExactAlarmSettings() { try { await LN.changeExactNotificationSetting(); } catch {} }

  /* Fires a real OS notification in `seconds` so the user can verify alarms with the app closed. */
  async function test(seconds = 10) {
    const r = await enable(); if (!r.ok) return r;
    await LN.schedule({ notifications: [{
      id: 2147483000, channelId: CHANNEL, title: '💊 Test reminder',
      body: 'Alarms are working. You can close Nivora and wait for this.',
      schedule: { at: new Date(Date.now() + seconds * 1000), allowWhileIdle: true },
    }] });
    return r;
  }

  if (LN) {
    LN.addListener('localNotificationActionPerformed', () => { try { navigate('/medicines'); } catch {} });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) requestSync(); });
  }
  return { isNative, plan, sync, requestSync, enable, test, openExactAlarmSettings };
})();
