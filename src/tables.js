// One QR code per table. Each encodes the menu URL with the table number and its check code (see orders.js),
// so the order a guest sends is tagged with the table the code sits on. Print on card stock and fold into table tents.
import '@fontsource/lato/400.css';
import '@fontsource/lato/700.css';
import '@fontsource/cormorant-garamond/600.css';
import './kolam/tokens.css';
import './kolam/kolam.css';
import './styles.css';
import './tables.css';
import QRCode from 'qrcode';
import { TABLES, tableUrl } from './orders.js';
import { RESTAURANT, VENUE_ID, lockupHTML } from './dishes.js';
import { icon, MARK } from './icons.js';

const root = document.getElementById('qr');
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const defaultBase = new URL('./index.html', location.href).href.replace(/index\.html$/, '');
let base = new URLSearchParams(location.search).get('base') || defaultBase;

async function render() {
  const cards = await Promise.all(TABLES.map(async t => {
    const url = tableUrl(base, t, VENUE_ID);
    const svg = await QRCode.toString(url, { type: 'svg', margin: 0, errorCorrectionLevel: 'M', color: { dark: '#1c140a', light: '#0000' } });
    return `<figure class="tent">
      ${lockupHTML()}
      <p class="tent-table">Table <strong>${t}</strong></p>
      <div class="tent-qr" role="img" aria-label="QR code for table ${t}">${svg}</div>
      <figcaption>Scan with your camera to see tonight’s dishes on this table and order straight to the kitchen.</figcaption>
      <a class="tent-link" href="${esc(url)}">Open as table ${t}</a>
    </figure>`;
  }));
  root.innerHTML = `
  <header class="qr-top">
    <div><h1 class="display display-sm">${RESTAURANT.name} table codes</h1>
    <p class="muted">Each code opens the menu seated at its table, so orders reach the kitchen tagged with where to bring the food.</p></div>
    <form class="qr-base" id="base-form">
      <div class="k-field"><label class="k-label" for="base">Menu address</label><input class="k-input" id="base" type="url" value="${esc(base)}" required></div>
      <button class="k-btn k-btn-outline" type="submit">Update codes</button>
      <button class="k-btn k-btn-primary" type="button" id="print">${icon('receipt')}Print</button>
    </form>
  </header>
  <main class="tents">${cards.join('')}</main>`;
  root.querySelector('#base-form').addEventListener('submit', e => { e.preventDefault(); base = root.querySelector('#base').value; render(); });
  root.querySelector('#print').addEventListener('click', () => print());
}
document.title = `Table codes · ${RESTAURANT.name}`;
render();
