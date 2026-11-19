import { Capacitor } from "@capacitor/core";
import { CapacitorSQLite, SQLiteConnection } from "@capacitor-community/sqlite";

const DB_NAME = "nivora";
const DB_VERSION = 1;
let db;
let webMode = false;
const WEB_KEY = "nivora_dev_store_v1";

const schema = [
  `CREATE TABLE IF NOT EXISTS profile (id INTEGER PRIMARY KEY CHECK(id=1), name TEXT NOT NULL DEFAULT 'My Nivora', currency TEXT NOT NULL DEFAULT 'INR', created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS transactions (id TEXT PRIMARY KEY, title TEXT NOT NULL, amount REAL NOT NULL CHECK(amount >= 0), type TEXT NOT NULL CHECK(type IN ('income','expense')), category TEXT NOT NULL, txn_date TEXT NOT NULL, note TEXT DEFAULT '', created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS budgets (id TEXT PRIMARY KEY, category TEXT NOT NULL UNIQUE, amount REAL NOT NULL CHECK(amount >= 0), month TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS goals (id TEXT PRIMARY KEY, title TEXT NOT NULL, target REAL NOT NULL CHECK(target > 0), saved REAL NOT NULL DEFAULT 0 CHECK(saved >= 0), due_date TEXT DEFAULT '', created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS medicines (id TEXT PRIMARY KEY, name TEXT NOT NULL, dosage TEXT DEFAULT '', schedule TEXT DEFAULT '', notes TEXT DEFAULT '', active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS dose_logs (id TEXT PRIMARY KEY, medicine_id TEXT NOT NULL, scheduled_at TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', taken_at TEXT DEFAULT '', FOREIGN KEY(medicine_id) REFERENCES medicines(id) ON DELETE CASCADE)`,
  `CREATE TABLE IF NOT EXISTS bills (id TEXT PRIMARY KEY, title TEXT NOT NULL, amount REAL NOT NULL DEFAULT 0, due_date TEXT DEFAULT '', status TEXT NOT NULL DEFAULT 'unpaid', kind TEXT NOT NULL DEFAULT 'bill', note TEXT DEFAULT '', created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS shared_expenses (id TEXT PRIMARY KEY, title TEXT NOT NULL, amount REAL NOT NULL, paid_by TEXT NOT NULL, participants TEXT NOT NULL, settled INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)`
];

function id() { return globalThis.crypto?.randomUUID?.() ?? `nvr_${Date.now()}_${Math.random().toString(36).slice(2,9)}`; }
function now() { return new Date().toISOString(); }
function loadWeb() { try { return JSON.parse(localStorage.getItem(WEB_KEY) || "{}"); } catch { return {}; } }
function saveWeb(data) { localStorage.setItem(WEB_KEY, JSON.stringify(data)); }

export async function initDatabase() {
  if (Capacitor.isNativePlatform()) {
    const sqlite = new SQLiteConnection(CapacitorSQLite);
    const consistency = await sqlite.checkConnectionsConsistency();
    const isConn = (await sqlite.isConnection(DB_NAME, false)).result;
    db = consistency.result && isConn ? await sqlite.retrieveConnection(DB_NAME, false)
      : await sqlite.createConnection(DB_NAME, false, "no-encryption", DB_VERSION, false);
    await db.open();
    for (const sql of schema) await db.execute(sql);
    await db.run("INSERT OR IGNORE INTO profile (id,name,currency,created_at) VALUES (1,?,?,?)", ["My Nivora","INR",now()]);
    await db.execute("PRAGMA foreign_keys = ON;");
    return { mode: "sqlite" };
  }
  webMode = true;
  const data = loadWeb();
  if (!data.profile) {
    data.profile = { name: "My Nivora", currency: "INR" };
    for (const key of ["transactions","budgets","goals","medicines","dose_logs","bills","shared_expenses"]) data[key] = [];
    data.settings = {};
    saveWeb(data);
  }
  return { mode: "browser-preview" };
}

async function query(sql, values = []) {
  if (webMode) throw new Error("Use browser repository methods in preview mode.");
  return (await db.query(sql, values)).values || [];
}
async function run(sql, values = []) {
  if (webMode) throw new Error("Use browser repository methods in preview mode.");
  return db.run(sql, values);
}
function webMutate(fn) { const data = loadWeb(); const result = fn(data); saveWeb(data); return result; }
function webList(key) { return loadWeb()[key] || []; }

export const store = {
  async profile() {
    if (webMode) return loadWeb().profile;
    return (await query("SELECT * FROM profile WHERE id=1"))[0];
  },
  async updateProfile(name, currency) {
    if (webMode) return webMutate(d => { d.profile = {...d.profile,name,currency}; });
    return run("UPDATE profile SET name=?,currency=? WHERE id=1", [name,currency]);
  },
  async listTransactions() {
    if (webMode) return webList("transactions").sort((a,b)=>b.txn_date.localeCompare(a.txn_date));
    return query("SELECT * FROM transactions ORDER BY txn_date DESC, created_at DESC");
  },
  async addTransaction(item) {
    const row = { id:id(), ...item, created_at:now() };
    if (webMode) webMutate(d => d.transactions.push(row));
    else await run("INSERT INTO transactions (id,title,amount,type,category,txn_date,note,created_at) VALUES (?,?,?,?,?,?,?,?)", [row.id,row.title,row.amount,row.type,row.category,row.txn_date,row.note,row.created_at]);
    return row;
  },
  async deleteTransaction(rowId) {
    if (webMode) webMutate(d => d.transactions = d.transactions.filter(x=>x.id!==rowId));
    else await run("DELETE FROM transactions WHERE id=?", [rowId]);
  },
  async listBudgets() {
    if (webMode) return webList("budgets");
    return query("SELECT * FROM budgets ORDER BY category");
  },
  async saveBudget(category, amount) {
    const month = new Date().toISOString().slice(0,7);
    if (webMode) webMutate(d => { const old=d.budgets.find(x=>x.category===category); if(old) old.amount=amount; else d.budgets.push({id:id(),category,amount,month}); });
    else await run("INSERT INTO budgets (id,category,amount,month) VALUES (?,?,?,?) ON CONFLICT(category) DO UPDATE SET amount=excluded.amount,month=excluded.month", [id(),category,amount,month]);
  },
  async listGoals() { return webMode ? webList("goals") : query("SELECT * FROM goals ORDER BY created_at DESC"); },
  async addGoal(title,target,due_date="") {
    const row={id:id(),title,target,saved:0,due_date,created_at:now()};
    if(webMode) webMutate(d=>d.goals.push(row));
    else await run("INSERT INTO goals (id,title,target,saved,due_date,created_at) VALUES (?,?,?,?,?,?)",[row.id,title,target,0,due_date,row.created_at]);
  },
  async contributeGoal(rowId,amount) {
    if(webMode) webMutate(d=>{const g=d.goals.find(x=>x.id===rowId);if(g)g.saved=Math.min(g.target,Number(g.saved)+amount);});
    else await run("UPDATE goals SET saved=MIN(target,saved+?) WHERE id=?",[amount,rowId]);
  },
  async listMedicines() { return webMode ? webList("medicines") : query("SELECT * FROM medicines WHERE active=1 ORDER BY name"); },
  async addMedicine(name,dosage,schedule,notes="") {
    const row={id:id(),name,dosage,schedule,notes,active:1,created_at:now()};
    if(webMode) webMutate(d=>d.medicines.push(row));
    else await run("INSERT INTO medicines (id,name,dosage,schedule,notes,active,created_at) VALUES (?,?,?,?,?,1,?)",[row.id,name,dosage,schedule,notes,row.created_at]);
  },
  async listBills() { return webMode ? webList("bills") : query("SELECT * FROM bills ORDER BY CASE WHEN status='unpaid' THEN 0 ELSE 1 END,due_date"); },
  async addBill(title,amount,due_date,kind="bill",note="") {
    const row={id:id(),title,amount,due_date,kind,note,status:"unpaid",created_at:now()};
    if(webMode) webMutate(d=>d.bills.push(row));
    else await run("INSERT INTO bills (id,title,amount,due_date,kind,note,status,created_at) VALUES (?,?,?,?,?,?,?,?)",[row.id,title,amount,due_date,kind,note,"unpaid",row.created_at]);
  },
  async toggleBill(rowId,status) {
    if(webMode) webMutate(d=>{const b=d.bills.find(x=>x.id===rowId);if(b)b.status=status;});
    else await run("UPDATE bills SET status=? WHERE id=?",[status,rowId]);
  },
  async listShared() { return webMode ? webList("shared_expenses") : query("SELECT * FROM shared_expenses ORDER BY created_at DESC"); },
  async addShared(title,amount,paid_by,participants) {
    const row={id:id(),title,amount,paid_by,participants,settled:0,created_at:now()};
    if(webMode) webMutate(d=>d.shared_expenses.push(row));
    else await run("INSERT INTO shared_expenses (id,title,amount,paid_by,participants,settled,created_at) VALUES (?,?,?,?,?,0,?)",[row.id,title,amount,paid_by,JSON.stringify(participants),row.created_at]);
  },
  async dashboard() {
    const tx=await this.listTransactions(), goals=await this.listGoals(), bills=await this.listBills(), budgets=await this.listBudgets();
    const month=new Date().toISOString().slice(0,7);
    const monthTx=tx.filter(x=>String(x.txn_date).startsWith(month));
    const income=monthTx.filter(x=>x.type==="income").reduce((s,x)=>s+Number(x.amount),0);
    const spent=monthTx.filter(x=>x.type==="expense").reduce((s,x)=>s+Number(x.amount),0);
    return {income,spent,balance:income-spent,goals,bills,budgets,transactions:tx.slice(0,5)};
  },
  async exportData() {
    const profile=await this.profile(), transactions=await this.listTransactions(), budgets=await this.listBudgets(), goals=await this.listGoals(), medicines=await this.listMedicines(), bills=await this.listBills(), shared=await this.listShared();
    return {app:"Nivora",version:1,exportedAt:now(),profile,transactions,budgets,goals,medicines,bills,sharedExpenses:shared};
  }
};
