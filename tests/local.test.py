"""End-to-end tests: name-only profiles, backup export/import, validation of untrusted files.
Run from repo root after `SKIP_CSS=1 node scripts/build.mjs`:  python3 tests/local.test.py"""
import subprocess, time, json, os, sys, tempfile
from playwright.sync_api import sync_playwright

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SITE = 'http://localhost:8099'
TMP = tempfile.mkdtemp()
web = subprocess.Popen(['python3', '-m', 'http.server', '8099', '-d', os.path.join(ROOT, 'dist')], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(1.2)
ok = True
def check(name, cond, extra=''):
    global ok; ok &= bool(cond); print(('PASS ' if cond else 'FAIL ') + name, '' if cond else extra)
def toast(pg): return pg.evaluate("(document.querySelector('#toast-container')||{}).innerText||''")
def H(pg): return pg.evaluate('location.hash')
def wait_hash(pg, h, ms=4000):
    for _ in range(ms // 100):
        if H(pg) == h: return True
        pg.wait_for_timeout(100)
    return False
def fresh(b, init=None):
    ctx = b.new_context(accept_downloads=True); pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('dialog', lambda d: d.accept())      # the app asks before switching profile while reminders are active
    if init: pg.add_init_script(init)
    pg.goto(SITE + '/index.html'); pg.wait_for_selector('#profileName'); return ctx, pg, errs
def start(pg, name):
    pg.fill('#profileName', name); pg.click('#app button[type=submit]'); wait_hash(pg, '#/onboarding'); pg.evaluate('obSkipAll()'); wait_hash(pg, '#/dashboard')
def populate(pg):
    pg.evaluate("""(() => {
      commitMedicine({id:'med_t1',name:'Metformin',salt:'Metformin 500mg',dosage:'1 tablet',frequency:'daily',times:['09:00','21:00'],startDate:daysAgoISO(3),endDate:null,refillDate:daysAgoISO(-20),stock:12,active:true,log:{}});
      const m = state.medicines.find(x=>x.id==='med_t1'); m.log[daysAgoISO(1)] = {'09:00':'taken','21:00':'skipped'};
      state.group = {name:'Home 4B', members:['You','Rohan','Priya K']};
      state.expenses.push({id:'exp_a1',amount:250,category:'Food',date:todayISO(),notes:'Lunch',paidBy:'You',receipt:null,split:null});
      state.expenses.push({id:'exp_a2',amount:300,category:'Rent',date:todayISO(),notes:'Cab',paidBy:'Rohan',receipt:null,split:{members:['You','Rohan','Priya K'],mode:'equal',shares:{'You':100,'Rohan':100,'Priya K':100}}});
      state.expenses.push({id:'exp_r1',amount:80,category:'Health',date:todayISO(),notes:'Pharmacy',paidBy:'You',receipt:'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAEBAQ==',split:null});\n      confirmSettle('You','Rohan',50);
      state.notifications.unshift({id:'n1',title:'Dose',body:'Take it',at:new Date().toISOString()});
      ext().bills.push({id:'bill_x1',title:'Electricity',amount:1200,dueDay:5,paidMonth:null});
      ext().caregiver = {name:'Mum',phone:'+91 99999 11111'}; ext().upi['Rohan']='rohan@upi'; ext().balance = 4200; ext().alerted['low_2026-11'] = true;
      setProfile({city:'Pune',bloodGroup:'B+',conditions:['Diabetes'],goals:['Save more'],onboarded:true});
      state.budgets.Food = 7000;
      saveState(); closeModal();
    })()""")
def snap(pg):
    return json.loads(pg.evaluate("""JSON.stringify({e:state.expenses,m:state.medicines,g:state.group,x:state.ext,n:state.notifications,b:state.budgets,
      p:Object.values(state.profiles)[0], me:state.user.meKey})"""))
def export(pg, password=None, path=None):
    pg.evaluate('Backup.openExport()')
    if password: pg.fill('#bkPass', password)
    with pg.expect_download() as d: pg.click('#bkForm button[type=submit]')
    path = path or os.path.join(TMP, d.value.suggested_filename if not password else 'enc.json'); d.value.save_as(path); pg.wait_for_timeout(300); return path
def goto_settings(pg): pg.evaluate("location.hash='/settings'"); pg.wait_for_selector('#importFile', state='attached')
def import_file(pg, path):
    goto_settings(pg); pg.set_input_files('#importFile', path); pg.wait_for_timeout(500)

try:
  with sync_playwright() as p:
    b = p.chromium.launch()
    # ================= first launch: name only =================
    ctxA, a, errs = fresh(b)
    inputs = a.evaluate("[...document.querySelectorAll('#app input:not([type=file])')].map(i=>i.id)")
    check('welcome asks ONLY for a name (no email, no password)', inputs == ['profileName'], inputs)
    a.fill('#profileName', '<b>x</b>'); a.evaluate('handleStart()'); a.wait_for_timeout(300)
    check('unsafe name rejected', 'Please enter your name' in toast(a) and H(a) != '#/onboarding')
    a.fill('#profileName', 'Priya Nair'); a.click('#app button[type=submit]')
    check('name -> onboarding for the new profile', wait_hash(a, '#/onboarding'))
    st = a.evaluate('({me:ME(), name:state.user.name, e:state.expenses.length, m:state.medicines.length, demo:JSON.stringify(state).includes("Aarav"), grp:groupMembers()})')
    check('new profile starts EMPTY under their own name', st['e'] == 0 and st['m'] == 0 and st['me'] == 'You' and st['name'] == 'Priya Nair' and not st['demo'] and st['grp'] == ['You'], st)
    a.evaluate('obSkipAll()'); wait_hash(a, '#/dashboard'); populate(a)
    a.reload(); a.wait_for_timeout(900)
    check('reload: stays signed in with data intact', H(a) == '#/dashboard' and a.evaluate('state.expenses.length') >= 3 and a.evaluate('currentUser.username') == 'Priya Nair')
    check('dashboard shows backup nudge (data, never backed up)', 'Back up your data' in a.inner_text('#app'))
    goto_settings(a); check('settings: "Not backed up yet" warning', 'Not backed up yet' in a.inner_text('#app'))

    # ================= multiple profiles =================
    a.evaluate('logout()'); wait_hash(a, '#/login'); a.wait_for_selector('#profileName')
    check('switch profile: data stays on device', a.evaluate("Object.keys(localStorage).some(k=>k.startsWith('nivora_state_p_'))") and 'Priya Nair' in a.inner_text('#app'))
    a.fill('#profileName', 'priya nair'); a.evaluate('handleStart()'); a.wait_for_timeout(300)
    check('duplicate name rejected (case-insensitive)', 'already exists' in toast(a))
    a.fill('#profileName', 'Rohan'); a.click('#app button[type=submit]'); wait_hash(a, '#/onboarding'); a.evaluate('obSkipAll()')
    check('second profile is separate and empty', a.evaluate('state.expenses.length') == 0 and a.evaluate('currentUser.username') == 'Rohan')
    a.evaluate('logout()'); a.wait_for_selector('#profileName'); a.click("button:has-text('Priya Nair')"); wait_hash(a, '#/dashboard')
    check('switching back restores first profile data', a.evaluate('state.expenses.length') >= 3)
    orig = snap(a)

    # ================= export =================
    plain = export(a)
    env = json.load(open(plain))
    check('export: file name + envelope', os.path.basename(plain).startswith('nivora-backup-') and env['app'] == 'nivora' and env['encrypted'] is False and env['counts']['medicines'] == 1)
    check('export: contains the data + checksum', 'Metformin' in open(plain).read() and len(env['checksum']) == 64)
    goto_settings(a); check('settings shows last backup date after export', 'Last backup' in a.inner_text('#app') and 'Not backed up' not in a.inner_text('#app'))
    a.evaluate("location.hash='/dashboard'"); a.wait_for_timeout(300); check('backup nudge gone after export', 'Back up your data' not in a.inner_text('#app'))
    enc = export(a, 'secret123')
    raw = open(enc).read(); e2 = json.loads(raw)
    check('encrypted export hides all content', e2['encrypted'] is True and 'Metformin' not in raw and 'Lunch' not in raw and 'data' not in e2 and e2['kdf']['iterations'] >= 600000)

    # ================= import into a fresh profile (plain) =================
    ctxB, bpg, errsB = fresh(b); start(bpg, 'Rohan')
    import_file(bpg, plain)
    check('import shows a summary before replacing', 'replaces all current data' in bpg.inner_text('#modal-root').lower() and '3 expense' not in '' and 'medicine' in bpg.inner_text('#modal-root'))
    bpg.click('#impGo'); bpg.wait_for_timeout(700)
    check('import: round-trip is lossless (expenses, meds, group, ext, profile, budgets...)', snap(bpg) == orig, '')
    check('import keeps this profile\'s own name', bpg.evaluate('state.user.name') == 'Rohan')
    goto_settings(bpg); check('undo button offered after import', 'Undo last import' in bpg.inner_text('#app'))
    bpg.evaluate('Backup.undo()'); bpg.click('#undoGo'); bpg.wait_for_timeout(500)
    check('undo restores previous (empty) data', bpg.evaluate('state.expenses.length') == 0 and bpg.evaluate('state.medicines.length') == 0)

    # ================= encrypted import =================
    import_file(bpg, enc)
    check('encrypted backup asks for the password', bpg.query_selector('#pwIn') is not None)
    bpg.fill('#pwIn', 'wrong'); bpg.click('#pwForm button[type=submit]'); bpg.wait_for_timeout(1500)
    check('wrong password rejected, nothing changed', 'Wrong password' in toast(bpg) and bpg.evaluate('state.expenses.length') == 0)
    bpg.fill('#pwIn', 'secret123'); bpg.click('#pwForm button[type=submit]'); bpg.wait_for_selector('#impGo', timeout=8000)
    bpg.click('#impGo'); bpg.wait_for_timeout(600)
    check('correct password imports everything', snap(bpg) == orig)

    # ================= hostile / broken files are rejected =================
    def reject(label, text, expect):
        path = os.path.join(TMP, 'bad.json'); open(path, 'w').write(text)
        before = snap(bpg); import_file(bpg, path); msg = toast(bpg)
        check(f'reject: {label}', expect in msg and snap(bpg) == before and bpg.query_selector('#impGo') is None, msg)
    good = json.load(open(plain))
    reject('not JSON', 'hello world', 'not a Nivora backup')
    reject('other app', json.dumps({'app': 'other', 'format': 1}), 'not a Nivora backup')
    t = json.loads(json.dumps(good)); t['data']['expenses'][0]['amount'] = 999999
    reject('tampered (checksum mismatch)', json.dumps(t), 'damaged or was edited')
    t = json.loads(json.dumps(good)); t['format'] = 99
    reject('newer format', json.dumps(t), 'newer version')
    def hostile(mut):
        return bpg.evaluate("""async (src) => { const s = JSON.parse(JSON.stringify(state)); (new Function('s', src))(s);
            const keep = state; state = s; const t = await Backup.build(''); state = keep; return t; }""", mut)
    for label, js, frag in [
        ('script in expense id', "s.expenses[0].id=\"x');alert(1);//\"", 'expense is invalid'),
        ('script in payer name', "s.expenses[0].paidBy=\"Bob');alert(1);//\"", 'invalid name'),
        ('script in group member', "s.group.members.push('<img src=x onerror=alert(1)>')", 'group member name is invalid'),
        ('script in medicine id', "s.medicines[0].id='a\"onmouseover=\"alert(1)'", 'medicine is invalid'),
        ('bad date', "s.expenses[0].date='yesterday'", 'expense is invalid'),
        ('NaN/Infinity-like amount', "s.expenses[0].amount='1e999'", 'expense is invalid'),
        ('bad dose status', "s.medicines[0].log[Object.keys(s.medicines[0].log)[0]]['09:00']='<b>'", 'log entry is invalid'),
        ('split with person outside group', "s.expenses[1].split.members.push('Stranger')", 'not in the group'),
        ('absurd list size', "s.expenses=new Array(100001).fill(s.expenses[0])", 'too large'),
    ]:
        reject(label, hostile(js), frag)

    # ================= XSS fuzz: free-text fields full of payloads must render inert =================
    P = '<img src=x onerror="window.__xss=1"><script>window.__xss=2</script>\'"><svg onload=window.__xss=3><b id=injected>x</b>" onmouseover="window.__xss=4" x="'
    xss = hostile(f"""const P={json.dumps(P)};
      s.medicines[0].name=P; s.medicines[0].salt=P; s.medicines[0].dosage=P; s.expenses[0].notes=P; s.expenses[0].category=P; s.expenses[1].notes=P;
      s.user.name=P; s.notifications[0].title=P; s.notifications[0].body=P;
      s.ext.bills[0].title=P; s.ext.caregiver.name=P; s.ext.caregiver.phone=P; s.ext.upi['Rohan']=P;
      for (const k of Object.keys(Object.values(s.profiles)[0])) if (typeof Object.values(s.profiles)[0][k]==='string') Object.values(s.profiles)[0][k]=P;
      Object.values(s.profiles)[0].conditions=[P]; Object.values(s.profiles)[0].goals=[P];""")
    path = os.path.join(TMP, 'xss.json'); open(path, 'w').write(xss)
    import_file(bpg, path)
    if bpg.query_selector('#impGo') is None: print('XSS file was rejected:', toast(bpg))
    bpg.click('#impGo'); bpg.wait_for_timeout(600)
    routes = bpg.evaluate('Object.keys(views).filter(r=>!["/login","/signup","/forgot"].includes(r))')
    for r in routes:
        bpg.evaluate(f"location.hash='{r}'"); bpg.wait_for_timeout(250)
    for opener in ['openEditGroup()', 'Backup.openExport()', 'openAdherenceReport()', 'adherenceText(adherenceData())', "document.querySelector('#modal-root').innerHTML=''"]:
        try: bpg.evaluate(opener)
        except Exception: pass
    bad = bpg.evaluate("({x: window.__xss===undefined ? null : window.__xss, img: document.querySelectorAll('img[onerror]').length, scr: [...document.querySelectorAll('script')].filter(s=>/__xss/.test(s.textContent)).length, svg: document.querySelectorAll('svg[onload]').length, inj: document.querySelectorAll('#injected, [onmouseover*=__xss]').length})")
    check(f'XSS payloads in {len(routes)} screens stay inert (text only)', bad['x'] is None and bad['img'] == 0 and bad['scr'] == 0 and bad['svg'] == 0 and bad['inj'] == 0, bad)
    bpg.evaluate("closeModal()")
    check('no JS errors during import/render fuzz', not errsB, errsB)

    # ================= Kendra concept is gone =================
    ctxK, k, errsK = fresh(b); reqs = []
    k.on('request', lambda r: reqs.append(r.url)); start(k, 'Meera'); populate(k)
    k.evaluate("location.hash='/kendras'"); k.wait_for_timeout(400)
    check('old #/kendras link falls back to the dashboard (no screen, no error)', k.evaluate("typeof views['/kendras']") == 'undefined' and 'Jan Aushadhi' not in k.inner_text('#app'))
    texts = []
    for r in k.evaluate('Object.keys(views).filter(r=>!["/login","/signup","/forgot"].includes(r))'):
        k.evaluate(f"location.hash='{r}'"); k.wait_for_timeout(200); texts.append(k.inner_text('#app'))
    alltext = ' '.join(texts).lower()
    check('no screen mentions Kendra / Jan Aushadhi / locations / Ranitidine', not any(w in alltext for w in ['kendra', 'aushadhi', 'locate me', 'find location', 'ranitidine', 'medicine finder', 'generic savings', 'track saving', 'saved by choosing']))
    check('no map or location requests (Leaflet / OpenStreetMap) and no geolocation use', not [u for u in reqs if 'unpkg' in u or 'openstreetmap' in u or 'leaflet' in u] and k.evaluate("typeof getLocation==='undefined' && typeof initMap==='undefined' && typeof L==='undefined'"))
    k.evaluate("location.hash='/generic-finder'"); k.wait_for_timeout(300)
    check('Medicine Finder + savings tracker are gone (old link falls back, no screen, no code)', k.evaluate("typeof views['/generic-finder']")=='undefined' and k.evaluate("typeof trackSaving==='undefined' && typeof GENERIC_MEDS==='undefined' && typeof HEALTH_TABS==='undefined'") and 'Medicine Finder' not in k.inner_text('#app'))
    k.evaluate("location.hash='/medicines'"); k.wait_for_timeout(300)
    med_text = k.inner_text('#app')
    k.evaluate("location.hash='/dashboard'"); k.wait_for_timeout(400)
    check('Medicines screen has no finder tab; dashboard links to "My medicines" instead', 'Finder' not in med_text and 'My medicines' in k.inner_text('#app'))
    check('profile data no longer carries Kendra/price lists/savings/location', k.evaluate("!('kendras' in state) && !('genericMeds' in state) && !('savingsTracker' in state) && !('location' in state.user)"))
    # old saved data (from before the removal) is cleaned on load
    uid = k.evaluate('currentUser.id')
    k.evaluate(f"""(() => {{ const s = JSON.parse(localStorage.getItem('nivora_state_{uid}')); s.kendras=[{{id:'k1',name:'Jan Aushadhi - X',lat:1,lng:2}}]; s.genericMeds=[{{salt:'x',jakBrand:'y',jakPrice:1}}]; s.user.location={{lat:18.5,lng:73.8}};
      localStorage.setItem('nivora_state_{uid}', JSON.stringify(s)); }})()""")
    k.reload(); k.wait_for_timeout(800)
    check('old saved data with kendras/location is migrated on load; expenses kept', k.evaluate("!('kendras' in state) && !('genericMeds' in state) && !('savingsTracker' in state) && !('location' in state.user)") and k.evaluate('state.expenses.length') >= 3)
    # an old backup file that still contains them imports cleanly and drops them
    legacy = k.evaluate("""async () => { const s = JSON.parse(JSON.stringify(state)); s.kendras=[{id:'k1',name:'Jan Aushadhi - X',lat:1,lng:2}]; s.genericMeds=[{salt:'x',jakBrand:'y',jakPrice:1}]; s.savingsTracker=[{id:'sv1',salt:'x',saved:5,at:'2026-01-01'}]; s.user.location={lat:18.5,lng:73.8};
        const keep = state; state = s; const t = await Backup.build(''); state = keep; return t; }""")
    open(os.path.join(TMP, 'legacy.json'), 'w').write(legacy); k.evaluate("location.hash='/settings'"); k.wait_for_selector('#importFile', state='attached')
    k.set_input_files('#importFile', os.path.join(TMP, 'legacy.json')); k.wait_for_selector('#impGo'); k.click('#impGo'); k.wait_for_timeout(500)
    check('an old backup containing Kendra data imports cleanly and drops it', k.evaluate("!('kendras' in state) && !('genericMeds' in state) && !('savingsTracker' in state) && !('location' in state.user) && state.expenses.length>=3"))
    check('no JS errors (Kendra removal)', not errsK, errsK)

    # ================= adherence report (in-app, hand-calculated) =================
    NOON = """(() => { const RD = Date, n = new RD(), off = new RD(n.getFullYear(), n.getMonth(), n.getDate(), 12, 0, 0) - n;   /* pretend it is 12:00 today so results do not depend on when the test runs */
      window.Date = class extends RD { constructor(...a) { if (a.length) super(...a); else super(RD.now() + off); } static now() { return RD.now() + off; } }; })();"""
    ctxR, r, errsR = fresh(b, NOON + """(() => { window.__opened = 0; window.open = () => { window.__opened++; return null; }; window.__shared = null; navigator.share = async d => { window.__shared = d; }; })();"""); start(r, 'Dev')
    r.evaluate("""(() => { const iso = n => { const d = new Date(); d.setDate(d.getDate() - n); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); };
      const log = {}; for (let i=1;i<=5;i++) log[iso(i)] = {'09:00':'taken','21:00':'taken'};
      log[iso(6)] = {'09:00':'taken','21:00':'skipped'}; log[iso(7)] = {'09:00':'skipped','21:00':'skipped'}; log[iso(0)] = {'09:00':'taken'};
      state.medicines = [{id:'ad1',name:'Metformin',salt:'Metformin 500mg',dosage:'1 tablet',frequency:'daily',times:['09:00','21:00'],startDate:iso(9),endDate:null,refillDate:null,stock:30,active:true,log},
                         {id:'ad2',name:'Vitamin D',salt:'',dosage:'',frequency:'daily',times:['08:00'],startDate:iso(-3),endDate:null,refillDate:null,stock:30,active:true,log:{}}];
      saveState(); })()""")
    d = r.evaluate("(() => { const n = new Date(); return adherenceData(new Date(n.getFullYear(), n.getMonth(), n.getDate(), 12, 0)); })()")
    m1 = d[0]
    check('adherence maths: 19 due, 12 taken, 3 skipped, 4 missed, 63%', (m1['due'], m1['taken'], m1['skipped'], m1['missed'], m1['pct']) == (19, 12, 3, 4, 63), m1)
    check('medicine that has not started yet: nothing due, no percentage', (d[1]['due'], d[1]['pct']) == (0, None), d[1])
    r.evaluate('openAdherenceReport()'); r.wait_for_timeout(300)
    rep = r.inner_text('#modal-root')
    check('report opens INSIDE the app (no pop-up window)', 'Metformin' in rep and '63%' in rep and 'Not a medical record' in rep and r.evaluate('window.__opened') == 0)
    r.click("button:has-text('Share report')"); r.wait_for_timeout(400)
    sh = r.evaluate('window.__shared')
    check('Share sends a readable plain-text report', sh and 'Metformin (Metformin 500mg)' in sh['text'] and 'Taken 12/19 (63%)' in sh['text'] and 'skipped 3, missed 4' in sh['text'] and 'Not a medical record' in sh['text'], sh)
    r.evaluate("navigator.share = undefined; window.__clip = null; Object.defineProperty(navigator, 'clipboard', {value:{writeText: async t => { window.__clip = t; }}, configurable:true});")
    r.evaluate('closeModal(); shareAdherenceReport()'); r.wait_for_timeout(400)
    check('without a share dialog the report is copied to the clipboard', 'Taken 12/19' in (r.evaluate('window.__clip') or '') and 'copied' in toast(r))
    r.evaluate("remindOwes('Rohan', 120)"); r.wait_for_timeout(300)
    check('"remind to pay" no longer relies on pop-up windows', r.evaluate('window.__opened') == 0)
    check('no JS errors (report)', not errsR, errsR)

    # ================= demo data can be exported and re-imported =================
    ctxC, c, errsC = fresh(b); c.evaluate('startDemo()'); wait_hash(c, '#/dashboard')
    for r_ in routes: c.evaluate(f"location.hash='{r_}'"); c.wait_for_timeout(150)
    check('sample-data profile renders every screen without errors', not errsC and len(c.inner_html('#app')) > 1000, errsC)
    goto_settings(c); check('demo: import disabled', c.evaluate("document.querySelector('button[onclick*=importFile]').disabled"))
    demo_file = export(c, path=os.path.join(TMP, 'demo.json'))
    c.evaluate('logout()'); c.wait_for_selector('#profileName'); start(c, 'Maya'); import_file(c, demo_file)
    c.click('#impGo'); c.wait_for_timeout(600)
    check('demo backup (legacy "Aarav" identity) imports and renders', c.evaluate('state.expenses.length') > 5 and c.evaluate('ME()') == 'Aarav' and c.evaluate('state.user.name') == 'Maya')
    for r in routes: c.evaluate(f"location.hash='{r}'"); c.wait_for_timeout(150)
    check('all screens render after demo import', not errsC, errsC)

    # ================= restore on a "new phone" from the welcome screen =================
    ctxD, d, errsD = fresh(b)
    d.set_input_files('#restoreFile', plain); d.wait_for_selector('#rsGo'); d.click('#rsGo'); wait_hash(d, '#/dashboard')
    check('restore from welcome screen creates the profile with all data', d.evaluate('currentUser.username') == 'Priya Nair' and snap(d) == orig)
    d.reload(); d.wait_for_timeout(700)
    check('restored profile persists after restart', d.evaluate('state.expenses.length') >= 3 and H(d) == '#/dashboard')
    # corrupted storage
    uid = d.evaluate('currentUser.id'); d.evaluate(f"localStorage.setItem('nivora_state_{uid}','{{bad json')"); d.reload(); d.wait_for_timeout(800)
    check('corrupted data: app still opens, copy of bad data kept, user told', d.evaluate('state.expenses.length') == 0 and d.evaluate(f"localStorage.getItem('nivora_corrupt_{uid}')") == '{bad json' and 'could not be read' in toast(d))

    # ================= delete profile =================
    d.evaluate('openDeleteProfile()'); d.fill('#delConfirm', 'nope'); d.click('#delForm button[type=submit]'); d.wait_for_timeout(200)
    check('delete requires typing DELETE', d.evaluate('!!currentUser'))
    d.fill('#delConfirm', 'DELETE'); d.click('#delForm button[type=submit]'); wait_hash(d, '#/login'); d.wait_for_timeout(300)
    left = d.evaluate("Object.keys(localStorage).filter(k=>k.startsWith('nivora_state_')||k.startsWith('nivora_backup_')||k.startsWith('nivora_undo_')||k.startsWith('nivora_corrupt_')||k==='nivora_session')")
    check('delete profile wipes its data from the phone', left == [] and d.evaluate('JSON.parse(localStorage.getItem("nivora_profiles")||"[]").length') == 0, left)
    check('no JS errors (restore/delete)', not errsD, errsD)

    # ================= Android: export goes through Filesystem + Share =================
    NATIVE = """(() => { const calls=[]; let files={};
      const FS={ writeFile: async o=>{calls.push(['write',o.path,o.directory,o.encoding]); files[o.path]=o.data; return {uri:'file:///cache/'+o.path}}, deleteFile: async o=>{calls.push(['delete',o.path]); delete files[o.path]} };
      const SH={ share: async o=>{calls.push(['share',o.files])} };
      const LN={ checkPermissions: async()=>({display:'granted'}), requestPermissions: async()=>({display:'granted'}), createChannel: async()=>{}, getPending: async()=>({notifications:[]}), cancel: async()=>{}, schedule: async()=>{}, checkExactNotificationSetting: async()=>({exact_alarm:'granted'}), addListener: async()=>({remove(){}}) };
      window.__n={calls, files};
      window.Capacitor={isNativePlatform:()=>true, registerPlugin:n=>({Filesystem:FS,Share:SH,LocalNotifications:LN}[n])}; })();"""
    ctxE, e, errsE = fresh(b, NATIVE); start(e, 'Asha'); populate(e)
    e.evaluate('Backup.openExport()'); e.fill('#bkPass', 'pw1234'); e.click('#bkForm button[type=submit]'); e.wait_for_timeout(1500)
    calls = e.evaluate('__n.calls')
    check('Android: backup written to cache then opened in the share sheet', calls[0][0] == 'write' and calls[0][2] == 'CACHE' and calls[0][3] == 'utf8' and calls[1][0] == 'share' and calls[1][1][0].startswith('file:///cache/nivora-backup-'), calls)
    check('Android: shared file is the encrypted backup', json.loads(list(e.evaluate('__n.files').values())[0])['encrypted'] is True)
    e.evaluate('Backup.openExport()'); e.click('#bkForm button[type=submit]'); e.wait_for_timeout(1200)
    calls = e.evaluate('__n.calls')
    check('Android: previous backup file is deleted from cache before the next one', any(c[0] == 'delete' for c in calls), calls)
    check('no JS errors (native)', not errsE, errsE)
    check('no JS errors (main flow)', not errs, errs)
    b.close()
finally:
    web.terminate()
print('\nALL PASSED' if ok else '\nSOME FAILED'); sys.exit(0 if ok else 1)
