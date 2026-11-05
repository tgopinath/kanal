// The kitchen pass: every table's orders arrive here live, with no server in between.
// New → On the fire → To run → Served. Bill requests show as a strip across the top.
import '@fontsource/lato/400.css';
import '@fontsource/lato/700.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/cormorant-garamond/600.css';
import './kolam/tokens.css';
import './kolam/kolam.css';
import './styles.css';
import './kitchen.css';
import * as Orders from './orders.js';
import { DISHES, RESTAURANT, VENUE_ID, formatPrice, lockupHTML } from './dishes.js';
import { icon, MARK } from './icons.js';

const root = document.getElementById('kds');
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const COLS = [
  { id: 'received', title: 'New', action: 'Start cooking' },
  { id: 'cooking', title: 'On the fire', action: 'Ready to run' },
  { id: 'ready', title: 'To run', action: 'Served' },
];
let sound = false, known = null;
const ago = t => { const m = Math.floor((Date.now() - t) / 60000); return m < 1 ? 'just now' : `${m} min ago`; };
const elapsed = t => { const s = Math.max(0, Math.floor((Date.now() - t) / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const late = o => { const m = (Date.now() - o.placedAt) / 60000; return m > 20 ? 'is-late' : m > 12 ? 'is-slow' : ''; };

function toast(msg, undo) {
  const host = document.querySelector('.toast-host');
  host.innerHTML = `<div class="k-toast" role="status"><span class="k-toast-text">${esc(msg)}</span>${undo ? '<button class="k-btn k-btn-sm k-btn-ghost" type="button" id="undo">Undo</button>' : ''}</div>`;
  host.querySelector('#undo')?.addEventListener('click', () => { undo(); host.innerHTML = ''; });
  clearTimeout(toast.t); toast.t = setTimeout(() => (host.innerHTML = ''), 5000);
}

function chime() {
  if (!sound) return;
  try {
    const ac = chime.ac || (chime.ac = new AudioContext());
    [880, 1320].forEach((f, k) => {
      const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime + k * 0.16;
      o.frequency.value = f; o.type = 'sine';
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      o.connect(g).connect(ac.destination); o.start(t); o.stop(t + 0.55);
    });
  } catch {}
}

function ticket(o, col, fresh) {
  return `<article class="ticket ${late(o)} ${fresh ? 'is-fresh' : ''}" aria-labelledby="t-${o.id}">
    <header class="ticket-head">
      <h3 class="ticket-table" id="t-${o.id}"><span class="k-sr-only">Table </span>${o.table}</h3>
      <div class="ticket-meta"><span class="ticket-round">Round ${o.round}</span><span class="ticket-time" data-since="${o.placedAt}">${elapsed(o.placedAt)}</span></div>
    </header>
    <ul class="ticket-items" role="list">${o.items.map(i => `<li><span class="ticket-q">${i.qty}</span><span>${esc(i.name)}</span></li>`).join('')}</ul>
    ${o.note ? `<p class="ticket-note">${icon('info')}<span>${esc(o.note)}</span></p>` : ''}
    <button class="k-btn ${col.id === 'ready' ? 'k-btn-outline' : 'k-btn-primary'} k-btn-block" type="button" data-advance="${o.id}" data-from="${o.status}">${col.id === 'ready' ? icon('check') : ''}${col.action}<span class="k-sr-only">, table ${o.table} round ${o.round}</span></button>
  </article>`;
}

function render() {
  const all = Orders.list().filter(o => (o.venue || 'kanal') === VENUE_ID);
  const food = all.filter(o => o.kind === 'food');
  const bills = all.filter(o => o.kind === 'bill' && o.status !== 'served');
  const served = food.filter(o => o.status === 'served').sort((a, b) => b.updatedAt - a.updatedAt);
  const ids = new Set(all.map(o => o.id));
  const fresh = known ? all.filter(o => !known.has(o.id)) : [];
  if (fresh.length) chime();
  known = ids;
  const tables = new Set(food.filter(o => o.status !== 'served').map(o => o.table));

  root.innerHTML = `
  <header class="kds-top">
    ${lockupHTML(true)}
    <h1 class="kds-title">Kitchen pass</h1>
    <p class="kds-stats"><span><strong>${food.length - served.length}</strong> open</span><span><strong>${tables.size}</strong> tables</span><span><strong>${served.length}</strong> served tonight</span></p>
    <div class="kds-tools">
      <button class="k-btn k-btn-sm k-btn-ghost" type="button" id="sound" aria-pressed="${sound}">${icon('bell')}${sound ? 'Sound on' : 'Sound off'}</button>
      <button class="k-btn k-btn-sm k-btn-outline" type="button" id="demo">${icon('plus')}Demo order</button>
      <a class="k-btn k-btn-sm k-btn-ghost" href="./tables.html?venue=${VENUE_ID}">${icon('qr')}Table codes</a>
      <a class="k-btn k-btn-sm k-btn-ghost" href="./index.html?venue=${VENUE_ID}">${icon('menu')}Guest menu</a>
    </div>
  </header>
  ${bills.length ? `<section class="bills" aria-label="Bill requests">${bills.map(b => `
    <div class="bill">${icon('receipt')}<span><strong>Table ${b.table}</strong> asked for the bill · ${ago(b.placedAt)}</span>
      <button class="k-btn k-btn-sm k-btn-primary" type="button" data-bill="${b.id}">Bill taken over</button></div>`).join('')}</section>` : ''}
  <main class="board" id="board" tabindex="-1">
    ${COLS.map(c => { const list = food.filter(o => o.status === c.id).sort((a, b) => a.placedAt - b.placedAt); return `
    <section class="col col-${c.id}" aria-labelledby="col-${c.id}">
      <h2 class="col-title" id="col-${c.id}">${c.title}<span class="col-count">${list.length}</span></h2>
      <div class="col-list">${list.length ? list.map(o => ticket(o, c, fresh.some(f => f.id === o.id))).join('') : `<p class="col-empty">${c.id === 'received' ? 'New orders from the tables appear here.' : 'Nothing here.'}</p>`}</div>
    </section>`; }).join('')}
  </main>
  ${served.length ? `<details class="served"><summary>Served tonight (${served.length})</summary>
    <ul role="list">${served.slice(0, 30).map(o => `<li><strong>Table ${o.table}</strong> · round ${o.round} · ${o.items.map(i => `${i.qty} × ${esc(i.name)}`).join(', ')} · ${formatPrice(o.total)}</li>`).join('')}</ul></details>` : ''}`;

  root.querySelectorAll('[data-advance]').forEach(b => b.addEventListener('click', () => {
    const id = b.dataset.advance, from = b.dataset.from, to = Orders.nextStatus(from);
    Orders.setStatus(id, to);
    const o = Orders.list().find(x => x.id === id);
    toast(`Table ${o.table}, round ${o.round}: ${Orders.STATUS.find(s => s.id === to).label.toLowerCase()}`, () => Orders.setStatus(id, from));
  }));
  root.querySelectorAll('[data-bill]').forEach(b => b.addEventListener('click', () => Orders.setStatus(b.dataset.bill, 'served')));
  root.querySelector('#sound').addEventListener('click', () => { sound = !sound; if (sound) { chime.ac?.resume?.(); chime(); } render(); });
  root.querySelector('#demo').addEventListener('click', () => {
    const t = Orders.TABLES[Math.floor(Math.random() * Orders.TABLES.length)];
    const pick = [...DISHES].sort(() => Math.random() - 0.5).slice(0, 1 + Math.floor(Math.random() * 3));
    const all = Orders.list();
    const o = { id: 'o' + Date.now().toString(36), kind: 'food', venue: VENUE_ID, table: t, device: 'demo', round: all.filter(x => (x.venue || 'kanal') === VENUE_ID && x.table === t && x.kind === 'food').length + 1,
      items: pick.map(d => ({ id: d.id, name: d.name, qty: 1 + (Math.random() < 0.3), price: d.price })), note: Math.random() < 0.4 ? 'No nuts please, one guest is allergic' : '',
      status: 'received', placedAt: Date.now(), updatedAt: Date.now() };
    o.total = o.items.reduce((s, i) => s + i.qty * i.price, 0);
    try { localStorage.setItem('kanal.orders.v1', JSON.stringify([...all, o])); } catch {}
    new BroadcastChannel('kanal-orders').postMessage('changed'); render();
  });
}

document.title = `Kitchen · ${RESTAURANT.name}`;
Orders.subscribe(render);
render();
// Tick the ticket timers without re-rendering the board.
setInterval(() => document.querySelectorAll('[data-since]').forEach(el => {
  el.textContent = elapsed(Number(el.dataset.since));
  const m = (Date.now() - Number(el.dataset.since)) / 60000, t = el.closest('.ticket');
  t.classList.toggle('is-slow', m > 12 && m <= 20); t.classList.toggle('is-late', m > 20);
}), 1000);
