// Table ordering: which table this phone is sitting at, and the channel orders travel on between guests and the kitchen.
//
// Every table has its own QR code: <menu url>?table=07&k=<code>. Scanning it stores the table for this visit (4 hours),
// so every order from this phone is tagged with it and the kitchen knows where to run the food. No server visit needed.
//
// Channel: orders live in a shared list that both the guest menu and the kitchen screen read and write, and every change
// is broadcast so open screens update live. In this concept build the list is the browser's own storage, shared by tabs
// on one device (open the kitchen screen in another window to try it). For the real restaurant the same three calls
// (list, put, subscribe) go to a realtime database instead; nothing else in the app changes.

const KEY = 'kanal.orders.v1';
const TABLE_KEY = 'kanal.table.v1';
const DEVICE_KEY = 'kanal.device.v1';
const VISIT_MS = 4 * 60 * 60 * 1000;
export const TABLES = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));

// A short check code per table, printed into its QR, so a typed URL with a random table number is rejected.
// (A real deployment would issue these from the server and rotate them.)
export const tableCode = t => {
  let h = 2166136261;
  for (const c of `kanal:${t}:hearth`) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return h.toString(36).slice(0, 5);
};
export const tableUrl = (base, t) => `${base}?table=${t}&k=${tableCode(t)}`;

const read = (k, f) => { try { const v = localStorage.getItem(k); return v == null ? f : JSON.parse(v); } catch { return f; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };

export function deviceId() {
  let id = read(DEVICE_KEY, null);
  if (!id) { id = Math.random().toString(36).slice(2, 10); write(DEVICE_KEY, id); }
  return id;
}

// ---------- table session ----------
export function readTableFromUrl() {
  const q = new URLSearchParams(location.search);
  const t = q.get('table'), k = q.get('k');
  if (!t) return null;
  const table = String(Number(t)).padStart(2, '0');
  // Drop the parameters from the address bar so a shared screenshot or link doesn't carry the table.
  history.replaceState(null, '', location.pathname + location.hash);
  if (!TABLES.includes(table) || k !== tableCode(table)) return { error: 'This code isn’t one of our tables. Please scan the code on your table again.' };
  write(TABLE_KEY, { table, at: Date.now() });
  return { table };
}
export function currentTable() {
  const s = read(TABLE_KEY, null);
  if (!s || Date.now() - s.at > VISIT_MS) return null;
  return s.table;
}
export function setTable(table) { write(TABLE_KEY, { table, at: Date.now() }); }
export function leaveTable() { try { localStorage.removeItem(TABLE_KEY); } catch {} }

// ---------- channel ----------
export const STATUS = [
  { id: 'received', label: 'Received', guest: 'The kitchen has your order' },
  { id: 'cooking', label: 'Cooking', guest: 'On the fire' },
  { id: 'ready', label: 'On its way', guest: 'Coming to your table' },
  { id: 'served', label: 'Served', guest: 'Enjoy' },
];
const bc = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('kanal-orders') : null;
const listeners = new Set();
const notify = () => { const all = list(); [...listeners].forEach(f => listeners.has(f) && f(all)); };
bc && (bc.onmessage = notify);
addEventListener('storage', e => { if (e.key === KEY) notify(); });

export function list() { return read(KEY, []); }
function save(all) {
  // Keep tonight's tickets only.
  const day = Date.now() - 12 * 60 * 60 * 1000;
  write(KEY, all.filter(o => o.placedAt > day));
  bc?.postMessage('changed');
  notify();
}
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

export function placeOrder({ table, items, note }) {
  const all = list();
  const round = all.filter(o => o.table === table && o.kind === 'food' && o.device === deviceId()).length + 1;
  const order = {
    id: 'o' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
    kind: 'food', table, round, device: deviceId(),
    items, note: (note || '').trim().slice(0, 280),
    total: items.reduce((s, i) => s + i.price * i.qty, 0),
    status: 'received', placedAt: Date.now(), updatedAt: Date.now(),
  };
  save([...all, order]);
  return order;
}
export function requestBill(table) {
  const all = list();
  if (all.some(o => o.kind === 'bill' && o.table === table && o.status !== 'served')) return false;
  save([...all, { id: 'b' + Date.now().toString(36), kind: 'bill', table, device: deviceId(), status: 'received', placedAt: Date.now(), updatedAt: Date.now() }]);
  return true;
}
export function setStatus(id, status) {
  save(list().map(o => (o.id === id ? { ...o, status, updatedAt: Date.now() } : o)));
}
export function nextStatus(s) { const i = STATUS.findIndex(x => x.id === s); return STATUS[Math.min(STATUS.length - 1, i + 1)].id; }
export const mine = (table) => list().filter(o => o.table === table && o.device === deviceId());
