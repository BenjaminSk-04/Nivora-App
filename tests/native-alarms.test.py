import subprocess, time, json, os
from playwright.sync_api import sync_playwright

MOCK = """
(() => {
  const log = []; let perm = 'prompt', pending = [], channels = [], exact = 'granted';
  const LN = {
    checkPermissions: async () => ({display: perm}),
    requestPermissions: async () => { log.push('requestPermissions'); if (perm === 'prompt') perm = 'granted'; return {display: perm}; },
    createChannel: async c => { channels.push(c); },
    getPending: async () => ({notifications: pending.map(n => ({id: n.id}))}),
    cancel: async ({notifications}) => { const ids = new Set(notifications.map(n=>n.id)); pending = pending.filter(n => !ids.has(n.id)); log.push('cancel:'+ids.size); },
    schedule: async ({notifications}) => { pending.push(...notifications.map(n => ({...n, schedule:{...n.schedule, at: new Date(n.schedule.at).toISOString()}}))); log.push('schedule:'+notifications.length); },
    checkExactNotificationSetting: async () => ({exact_alarm: exact}),
    changeExactNotificationSetting: async () => { log.push('openExactSettings'); },
    addListener: async () => ({remove(){}}),
  };
  window.__mock = { log, get pending(){return pending}, get channels(){return channels}, set exact(v){exact=v}, set perm(v){perm=v} };
  window.Capacitor = { isNativePlatform: () => true, registerPlugin: n => { if (n !== 'LocalNotifications') throw new Error('unexpected plugin '+n); return LN; } };
})();
"""
srv = subprocess.Popen(['python3','-m','http.server','8099','-d',os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','dist')],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
time.sleep(1)
ok = True
def check(name, cond, extra=''):
    global ok; ok &= bool(cond); print(('PASS ' if cond else 'FAIL ')+name, extra)
try:
    with sync_playwright() as p:
        b = p.chromium.launch()
        # ---------- NATIVE ----------
        pg = b.new_page(); errs=[]
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.add_init_script(MOCK)
        pg.goto('http://localhost:8099/index.html'); pg.wait_for_timeout(500)
        check('native detected', pg.evaluate('NativeAlarms.isNative'))
        pg.evaluate('startDemo()'); pg.wait_for_timeout(1500)
        n = pg.evaluate('__mock.pending.length')
        check('asked permission once, in context', pg.evaluate('__mock.log.filter(x=>x=="requestPermissions").length')==1)
        check('channel created private+high', pg.evaluate('__mock.channels[0].importance')==5 and pg.evaluate('__mock.channels[0].visibility')==0)
        # independent expectation computed from raw data
        exp = pg.evaluate("""(() => { const now=new Date(); let c=0;
          for (let i=0;i<14;i++){ const d=new Date(now.getFullYear(),now.getMonth(),now.getDate()+i);
            const iso=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
            for (const m of state.medicines){ if(!isDoseDue(m,iso))continue; for(const t of m.times){ const [h,mi]=t.split(':').map(Number);
              if(new Date(d.getFullYear(),d.getMonth(),d.getDate(),h,mi)<=now)continue; const s=m.log&&m.log[iso]&&m.log[iso][t]; if(s==='taken'||s==='skipped')continue; c++; }}}
          return c; })()""")
        check('scheduled count matches raw data', n==exp and n>0, f'(scheduled {n}, expected {exp})')
        ids = pg.evaluate('__mock.pending.map(x=>x.id)')
        check('ids unique & positive int32', len(set(ids))==len(ids) and all(0<i<2**31 for i in ids))
        check('all in the future & within 14 days', pg.evaluate('__mock.pending.every(x=>{const t=new Date(x.schedule.at)-Date.now(); return t>0 && t<14*864e5+864e5})'))
        check('allowWhileIdle on every alarm', pg.evaluate('__mock.pending.every(x=>x.schedule.allowWhileIdle===true)'))
        # taking a dose cancels exactly that alarm
        nxt = pg.evaluate('(()=>{const p=__mock.pending[0]; return p.extra})()')
        before = pg.evaluate('__mock.pending.length'); first_id = pg.evaluate('__mock.pending[0].id')
        pg.evaluate(f"(()=>{{const m=state.medicines.find(x=>x.id=='{nxt['medId']}'); m.log=m.log||{{}}; (m.log['{nxt['date']}']=m.log['{nxt['date']}']||{{}})['{nxt['time']}']='taken'; saveState();}})()"); pg.wait_for_timeout(900)
        still = pg.evaluate(f'__mock.pending.some(x=>x.id=={first_id})')
        check('dose already taken/skipped -> its alarm removed', (not still) and pg.evaluate('__mock.pending.length')==before-1, f"({before} -> {pg.evaluate('__mock.pending.length')})")
        # deleting a medicine removes its alarms
        mid = nxt['medId']
        pg.evaluate(f"deleteMedicine('{mid}')"); pg.wait_for_timeout(900)
        check('deleted medicine -> no alarms left for it', pg.evaluate(f'__mock.pending.every(x=>x.extra.medId!="{mid}")'))
        # notifications off clears everything
        pg.evaluate('state.user.notifications=false; saveState()'); pg.wait_for_timeout(900)
        check('notifications off -> all cancelled', pg.evaluate('__mock.pending.length')==0)
        pg.evaluate('state.user.notifications=true; saveState()'); pg.wait_for_timeout(900)
        check('notifications on -> rescheduled', pg.evaluate('__mock.pending.length')>0)
        # logout clears
        pg.evaluate('logout()'); pg.wait_for_timeout(900)
        check('logout -> all cancelled (privacy)', pg.evaluate('__mock.pending.length')==0)
        # test button path + exact-alarm denied flow
        pg.evaluate('__mock.exact="denied"')
        pg.evaluate('startDemo()'); pg.wait_for_timeout(900)
        pg.evaluate('testReminder()'); pg.wait_for_timeout(2200)
        check('test reminder schedules a ~10s OS alarm', pg.evaluate('__mock.pending.some(x=>x.id==2147483000 && new Date(x.schedule.at)-Date.now()<12000)'))
        check('exact-alarm denied -> opens system settings', pg.evaluate('__mock.log.includes("openExactSettings")'))
        check('app keeps working when other native plugins are unavailable (backup module still loads)', pg.evaluate('typeof Backup.statusText()')=='string')
        check('no JS errors (native)', not errs, errs)
        pg.close()
        # ---------- permission denied ----------
        pg = b.new_page(); pg.add_init_script(MOCK + "__mock.perm='denied';")
        pg.goto('http://localhost:8099/index.html'); pg.wait_for_timeout(400)
        pg.evaluate('startDemo()'); pg.wait_for_timeout(900)
        check('permission denied -> nothing scheduled, no crash', pg.evaluate('__mock.pending.length')==0)
        pg.close()
        # ---------- WEB (no Capacitor) ----------
        pg = b.new_page(); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto('http://localhost:8099/index.html'); pg.wait_for_timeout(400)
        pg.evaluate('startDemo()'); pg.wait_for_timeout(700)
        check('web: module inert, plan still computable', pg.evaluate('NativeAlarms.isNative')==False and pg.evaluate('NativeAlarms.plan().length')>0)
        check('no JS errors (web)', not errs, errs)
        b.close()
finally:
    srv.terminate()
print('\nALL PASSED' if ok else '\nSOME FAILED')
