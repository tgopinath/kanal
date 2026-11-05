import '@fontsource/lato/400.css';
import '@fontsource/lato/700.css';
import '@fontsource/lato/900.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/cormorant-garamond/500.css';
import '@fontsource/cormorant-garamond/600.css';
import '@fontsource/cormorant-garamond/500-italic.css';
import './kolam/tokens.css';
import './kolam/kolam.css';
import './styles.css';
import '@google/model-viewer';

import { RESTAURANT, COURSES, DISHES, ENV_CREDITS, byId, inCourse, formatPrice, formatQty } from './dishes.js';
import { icon, MARK } from './icons.js';
import { Native, platform } from './native.js';
import { mountTable } from './table.js';
import * as Orders from './orders.js';

const app = document.getElementById('app');
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const asset = p => `./${p}`;
const poster = d => asset(`posters/${d.id}.webp`);
const model = d => asset(`models/${d.id}.glb`);
const usdz = d => asset(`models/${d.id}.usdz`);

// ---------- small persisted state (per-viewer conveniences only) ----------
const store = {
  get(k, f) { try { const v = localStorage.getItem('kanal.' + k); return v == null ? f : JSON.parse(v); } catch { return f; } },
  set(k, v) { try { localStorage.setItem('kanal.' + k, JSON.stringify(v)); } catch {} },
};
let shortlist = store.get('shortlist', {}); // { id: qty }
const shortCount = () => Object.values(shortlist).reduce((a, b) => a + b, 0);
function setQty(id, q) {
  if (q <= 0) delete shortlist[id]; else shortlist[id] = q;
  store.set('shortlist', shortlist);
  document.querySelectorAll('[data-count]').forEach(el => { const n = shortCount(); el.textContent = n; el.hidden = !n; });
}

// The table comes from the QR code on it (see orders.js).
const scan = Orders.readTableFromUrl();
let table = Orders.currentTable();
let orderNote = '';
const tableLabel = () => (table ? `Table ${table}` : 'No table yet');

const theme = store.get('theme', 'system');
if (theme !== 'system') document.documentElement.dataset.theme = theme;

function toast(msg) {
  const host = document.querySelector('.toast-host');
  host.innerHTML = `<div class="k-toast" role="status"><span class="k-toast-text">${esc(msg)}</span></div>`;
  clearTimeout(toast.t); toast.t = setTimeout(() => (host.innerHTML = ''), 2600);
}

// ---------- shared pieces ----------
const lockup = (small = false) => `
  <span class="lockup ${small ? 'lockup-sm' : ''}">${MARK}<span class="lockup-words"><span class="lockup-name">KANAL</span><span class="lockup-ta" lang="ta">${RESTAURANT.tamil}</span></span></span>`;

const price = d => `<span class="qty-price"><span>${formatQty(d)}</span><span class="dot" aria-hidden="true">·</span><span>${formatPrice(d.price)}</span></span>`;

function nav(active) {
  const items = [
    ['menu', '#/', 'menu', 'Menu'],
    ['table', `#/table/${current.tableId || 'prime-rib'}`, 'table', 'On the table'],
    ['shortlist', '#/order', 'bag', 'Order'],
    ['about', '#/about', 'info', 'About'],
  ];
  return `<nav class="k-bottomnav appnav" aria-label="Main">${items.map(([k, href, ic, label]) => `
    <a class="k-bottomnav-item ${active === k ? 'is-active' : ''}" href="${href}" ${active === k ? 'aria-current="page"' : ''}>
      ${icon(ic)}<span>${label}</span>${k === 'shortlist' ? `<span class="k-count navcount" data-count ${shortCount() ? '' : 'hidden'}>${shortCount()}</span>` : ''}
    </a>`).join('')}</nav>`;
}

function dishRow(d) {
  const n = shortlist[d.id] || 0;
  return `<li class="dish-row">
    <a class="dish-link" href="#/dish/${d.id}">
      <span class="dish-thumb"><img src="${poster(d)}" alt="" loading="lazy" width="320" height="320"></span>
      <span class="dish-text">
        <span class="dish-name">${esc(d.name)}</span>
        <span class="dish-line">${esc(d.line)}</span>
        <span class="dish-meta">${price(d)}${d.tags.slice(0, 1).map(t => `<span class="tag">${esc(t)}</span>`).join('')}</span>
      </span>
    </a>
    <a class="row-ar k-iconbtn" href="#/table/${d.id}" aria-label="See ${esc(d.name)} on your table">${icon('ar')}</a>
    ${n ? `<span class="row-in" aria-label="${n} in your order">${n}</span>` : ''}
  </li>`;
}

// ---------- views ----------
const current = { tableId: 'prime-rib', cleanup: null };

function viewMenu() {
  const hero = DISHES.find(d => d.hero);
  app.innerHTML = `
  <header class="masthead">
    <div class="masthead-row">${lockup()}${table ? `<span class="table-chip">Table ${table} · ${RESTAURANT.service}</span>` : `<a class="table-chip table-chip-cta" href="#/order">${icon('qr')}Find your table</a>`}</div>
  </header>
  <main id="main" class="menu" tabindex="-1">
    <section class="hero" aria-labelledby="hero-title">
      <div class="hero-media"><img src="${poster(hero)}" alt="${esc(hero.name)} on an oak board" width="640" height="640"></div>
      <div class="hero-text">
        <p class="eyebrow">Tonight’s signature</p>
        <h1 id="hero-title" class="display">${esc(hero.name)}</h1>
        <div class="gold-rule" aria-hidden="true"></div>
        <p class="hero-meta">${price(hero)}</p>
        <p class="hero-line">${esc(hero.line)}</p>
        <div class="hero-actions">
          <a class="k-btn k-btn-primary" href="#/table/${hero.id}">${icon('ar')}See it on your table</a>
          <a class="k-btn k-btn-outline" href="#/dish/${hero.id}">Details</a>
        </div>
      </div>
    </section>

    <div class="course-bar" role="navigation" aria-label="Courses">
      <div class="course-tabs">${COURSES.map((c, i) => `<a class="course-tab ${i === 0 ? 'is-active' : ''}" href="#c-${c.id}" data-course="${c.id}">${c.label}</a>`).join('')}</div>
    </div>

    ${COURSES.map(c => `
    <section class="course" id="c-${c.id}" aria-labelledby="h-${c.id}">
      <h2 id="h-${c.id}" class="course-title"><span>${c.label}</span><span class="course-count">${inCourse(c.id).length}</span></h2>
      <ul class="dish-list" role="list">${inCourse(c.id).map(dishRow).join('')}</ul>
    </section>`).join('')}

    <p class="fineprint">Every dish here is a real 3D scan or model, shown at its actual size on your table. Prices include taxes. Add allergies to the note when you send your order.</p>
  </main>
  ${nav('menu')}`;

  // Course tabs: smooth-scroll and follow the scroll position.
  const tabs = [...app.querySelectorAll('.course-tab')];
  tabs.forEach(t => t.addEventListener('click', e => {
    e.preventDefault();
    document.getElementById(`c-${t.dataset.course}`).scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  }));
  const io = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (en.isIntersecting) tabs.forEach(t => t.classList.toggle('is-active', `c-${t.dataset.course}` === en.target.id));
    });
  }, { rootMargin: '-30% 0px -60% 0px' });
  app.querySelectorAll('.course').forEach(s => io.observe(s));
  return () => io.disconnect();
}

function viewDish(id) {
  const d = byId(id);
  if (!d) return viewMissing();
  const list = DISHES, i = list.indexOf(d);
  const prev = list[(i - 1 + list.length) % list.length], next = list[(i + 1) % list.length];
  const n = shortlist[d.id] || 0;
  const course = COURSES.find(c => c.id === d.course);
  app.innerHTML = `
  <header class="topbar">
    <a class="k-iconbtn" href="#/" aria-label="Back to the menu">${icon('back')}</a>
    <span class="topbar-title">${course.label}</span>
    ${lockup(true)}
  </header>
  <main id="main" class="dish" tabindex="-1">
    <div class="stage">
      <model-viewer id="mv" src="${model(d)}" ios-src="${usdz(d)}" poster="${poster(d)}" alt="3D scan of ${esc(d.name)}. Drag to turn it."
        camera-controls auto-rotate auto-rotate-delay="1500" rotation-per-second="18deg" interaction-prompt="none"
        camera-orbit="30deg 62deg auto" min-camera-orbit="auto 20deg auto" max-camera-orbit="auto 84deg auto"
        environment-image="${asset('env/hearth.hdr')}" tone-mapping="neutral" exposure="0.95" shadow-intensity="1" shadow-softness="0.4"
        ar ar-modes="webxr scene-viewer quick-look" ar-placement="floor" ar-scale="fixed" touch-action="pan-y" loading="eager">
        <div class="mv-progress" slot="progress-bar"><span></span></div>
        <button slot="ar-button" hidden></button>
      </model-viewer>
      <div class="stage-controls">
        <a class="round-btn" href="#/dish/${prev.id}" aria-label="Previous dish: ${esc(prev.name)}">${icon('prev')}</a>
        <button class="round-btn" id="reset" type="button" aria-label="Reset the view">${icon('rotate')}</button>
        <a class="round-btn" href="#/dish/${next.id}" aria-label="Next dish: ${esc(next.name)}">${icon('next')}</a>
      </div>
      <p class="stage-hint">${icon('hand')}Drag to turn · pinch to zoom</p>
    </div>

    <article class="dish-info">
      <p class="eyebrow">${course.label.replace(/s$/, '')}${d.tags.length ? ' · ' + d.tags.map(esc).join(' · ') : ''}</p>
      <h1 class="display">${esc(d.name)}</h1>
      <div class="gold-rule" aria-hidden="true"></div>
      <p class="hero-meta">${price(d)}</p>
      <p class="dish-story">${esc(d.story)}</p>
      <dl class="facts">
        <div><dt>Pairs with</dt><dd>${esc(d.pairing)}</dd></div>
        <div><dt>Contains</dt><dd>${d.allergens.length ? d.allergens.map(esc).join(', ') : 'No major allergens'}</dd></div>
      </dl>
      <div class="dish-actions">
        <a class="k-btn k-btn-primary k-btn-lg" href="#/table/${d.id}" id="on-table">${icon('ar')}View on your table</a>
        <div class="stepper" role="group" aria-label="Quantity in your order">
          ${n ? `<button class="k-iconbtn" type="button" data-q="-1" aria-label="One fewer">${icon('minus')}</button><span class="stepper-n" aria-live="polite">${n} in your order</span><button class="k-iconbtn" type="button" data-q="1" aria-label="One more">${icon('plus')}</button>`
              : `<button class="k-btn k-btn-outline k-btn-block" type="button" data-q="1">${icon('plus')}Add to order</button>`}
        </div>
      </div>
      <p class="credit">${esc(d.credit.kind)}: “${esc(d.credit.title)}” by ${esc(d.credit.author)} · <a href="${d.credit.url}" target="_blank" rel="noopener">source</a> · <a href="${d.credit.license.url}" target="_blank" rel="noopener">${d.credit.license.name}</a>${d.standIn ? `<br><span class="standin">${esc(d.standIn)}</span>` : ''}</p>
    </article>
  </main>
  ${nav('menu')}`;

  current.tableId = d.id;
  const mv = app.querySelector('#mv');
  app.querySelector('#reset').addEventListener('click', () => { mv.cameraOrbit = '30deg 62deg auto'; mv.fieldOfView = 'auto'; mv.jumpCameraToGoal?.(); });
  mv.addEventListener('progress', e => { app.querySelector('.mv-progress span').style.transform = `scaleX(${e.detail.totalProgress})`; if (e.detail.totalProgress === 1) app.querySelector('.mv-progress').classList.add('done'); });
  app.querySelectorAll('[data-q]').forEach(b => b.addEventListener('click', () => {
    setQty(d.id, (shortlist[d.id] || 0) + Number(b.dataset.q));
    toast(Number(b.dataset.q) > 0 ? `${d.name} added to your order` : `${d.name} updated`);
    rerender();
  }));
  const keys = e => {
    if (e.target.closest('input,textarea')) return;
    if (e.key === 'ArrowRight') location.hash = `#/dish/${next.id}`;
    if (e.key === 'ArrowLeft') location.hash = `#/dish/${prev.id}`;
  };
  addEventListener('keydown', keys);
  return () => removeEventListener('keydown', keys);
}

function viewTable(id) {
  const d = byId(id) || DISHES[0];
  current.tableId = d.id;
  app.innerHTML = `
  <main id="main" class="table-view" tabindex="-1" aria-label="${esc(d.name)} on the table">
    <div class="table-scene" id="scene"></div>
  </main>
  ${nav('table')}`;
  const native = Native.available();
  return mountTable(app.querySelector('#scene'), {
    dishes: DISHES, start: DISHES.indexOf(d), native, platform: platform(),
    lockupHTML: lockup(), icon, esc, formatPrice, formatQty, model, usdz, poster, asset,
    onAdd: x => { setQty(x.id, (shortlist[x.id] || 0) + 1); toast(`${x.name} added to your order`); },
    onIndex: i => { current.tableId = DISHES[i].id; history.replaceState(null, '', `#/table/${DISHES[i].id}`); },
    openNative: async i => {
      const payload = DISHES.map(x => ({ id: x.id, name: x.name, qty: formatQty(x), price: formatPrice(x.price), model: `models/${x.id}.glb`, usdz: `models/${x.id}.usdz` }));
      try {
        const r = await Native.open(payload, i);
        window.__kanalLastAR = r;
        return r && typeof r.index === 'number' ? r.index : -1;
      } catch (e) { toast(String(e?.message || 'AR could not start on this phone')); return -1; }
    },
  });
}

const clock = t => new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

function statusTrack(o) {
  const at = Orders.STATUS.findIndex(x => x.id === o.status);
  return `<ol class="track" aria-label="Order status: ${Orders.STATUS[at].label}">${Orders.STATUS.map((st, i) => `
    <li class="track-step ${i < at ? 'is-done' : ''} ${i === at ? 'is-now' : ''}" ${i === at ? 'aria-current="step"' : ''}><span class="track-dot" aria-hidden="true"></span><span class="track-label">${st.label}</span></li>`).join('')}</ol>`;
}

function seatPicker() {
  return `<section class="seat k-card" aria-labelledby="seat-title">
    <div class="seat-qr" aria-hidden="true">${icon('qr')}</div>
    <h2 id="seat-title" class="display display-sm">Which table are you at?</h2>
    <p>Point your phone’s camera at the code on your table stand. It tells the kitchen where to bring your food, so you can order straight from here.</p>
    <form class="seat-form" id="seat">
      <div class="k-field"><label class="k-label" for="seat-n">Can’t scan? Enter the number on the stand</label>
        <select class="k-select" id="seat-n" required><option value="">Choose a table</option>${Orders.TABLES.map(t => `<option value="${t}">Table ${t}</option>`).join('')}</select></div>
      <button class="k-btn k-btn-primary" type="submit">Seat me</button>
    </form>
  </section>`;
}

function viewOrder() {
  const items = Object.entries(shortlist).map(([id, q]) => [byId(id), q]).filter(([d]) => d);
  const total = items.reduce((s, [d, q]) => s + d.price * q, 0);
  const sent = table ? Orders.mine(table) : [];
  const rounds = sent.filter(o => o.kind === 'food').sort((a, b) => b.placedAt - a.placedAt);
  const bill = sent.find(o => o.kind === 'bill' && o.status !== 'served');
  const billTotal = rounds.reduce((s, o) => s + o.total, 0);
  app.innerHTML = `
  <header class="topbar"><span class="topbar-title topbar-title-lg">Your order</span>${table ? `<span class="table-chip">Table ${table}</span>` : lockup(true)}</header>
  <main id="main" class="shortlist" tabindex="-1">
    ${!table ? seatPicker() : ''}
    ${items.length ? `
    <section aria-labelledby="cart-title">
      <h2 id="cart-title" class="section-title">Not sent yet</h2>
      <ul class="k-list sl-list" role="list">${items.map(([d, q]) => `
        <li class="k-list-item sl-item">
          <img class="sl-thumb" src="${poster(d)}" alt="" width="64" height="64">
          <span class="k-list-text"><a class="sl-name" href="#/dish/${d.id}">${esc(d.name)}</a><span class="sl-sub">${formatQty(d)} · ${formatPrice(d.price)} each</span></span>
          <span class="stepper stepper-sm" role="group" aria-label="${esc(d.name)} quantity">
            <button class="k-iconbtn" type="button" data-id="${d.id}" data-q="-1" aria-label="One fewer ${esc(d.name)}">${icon('minus')}</button>
            <span class="stepper-n">${q}</span>
            <button class="k-iconbtn" type="button" data-id="${d.id}" data-q="1" aria-label="One more ${esc(d.name)}">${icon('plus')}</button>
          </span>
        </li>`).join('')}
      </ul>
      <div class="k-field order-note"><label class="k-label" for="note">Note for the kitchen <span class="muted">(optional)</span></label>
        <textarea class="k-input" id="note" maxlength="280" rows="2" placeholder="Allergies, no chilli, bring the dessert later…">${esc(orderNote)}</textarea></div>
      <div class="sl-total"><span>This round</span><span class="sl-sum">${formatPrice(total)}</span></div>
      <button class="k-btn k-btn-primary k-btn-lg k-btn-block" type="button" id="send" ${table ? '' : 'disabled aria-describedby="seat-title"'}>${icon('send')}Send to the kitchen</button>
      ${table ? '' : '<p class="help-line">Choose your table first so the kitchen knows where to bring it.</p>'}
      <button class="k-btn k-btn-ghost k-btn-block" type="button" id="clear">Clear these dishes</button>
    </section>` : ''}

    ${rounds.length ? `
    <section aria-labelledby="sent-title" class="sent">
      <h2 id="sent-title" class="section-title">Sent to the kitchen</h2>
      <div aria-live="polite">${rounds.map(o => `
        <article class="round k-card" aria-label="Round ${o.round}">
          <header class="round-head"><span class="round-n">Round ${o.round}</span><span class="round-time">${icon('clock')}${clock(o.placedAt)}</span></header>
          <p class="round-status">${esc(Orders.STATUS.find(x => x.id === o.status).guest)}</p>
          ${statusTrack(o)}
          <ul class="round-items" role="list">${o.items.map(i => `<li><span class="server-q">${i.qty} ×</span> ${esc(i.name)}</li>`).join('')}</ul>
          ${o.note ? `<p class="round-note">“${esc(o.note)}”</p>` : ''}
        </article>`).join('')}</div>
      <div class="sl-total bill-total"><span>Your bill so far</span><span class="sl-sum">${formatPrice(billTotal)}</span></div>
      ${bill ? `<p class="k-alert bill-asked" role="status">${icon('receipt')}<span>Bill requested at ${clock(bill.placedAt)}. It’s on its way to Table ${table}.</span></p>`
             : `<button class="k-btn k-btn-outline k-btn-block" type="button" id="bill">${icon('receipt')}Ask for the bill</button>`}
    </section>` : ''}

    ${!items.length && !rounds.length ? `<div class="empty">
        <div class="empty-mark">${MARK}</div>
        <h1 class="display display-sm">Nothing ordered yet</h1>
        <p>Add dishes from the menu, then send them straight to the kitchen. Your food is brought to ${table ? `Table ${table}` : 'your table'}; you can keep adding rounds all evening.</p>
        <a class="k-btn k-btn-primary" href="#/">Browse the menu</a>
      </div>` : ''}
    ${table ? `<p class="fineprint">Seated at Table ${table}. Wrong table? <button class="linkbtn" type="button" id="leave">Change table</button></p>` : ''}
  </main>
  <dialog class="k-dialog server" id="confirm" aria-labelledby="confirm-title">
    <h2 class="k-dialog-title" id="confirm-title">Send to the kitchen?</h2>
    <ul class="server-list">${items.map(([d, q]) => `<li><span class="server-q">${q} ×</span> ${esc(d.name)}</li>`).join('')}</ul>
    <p class="k-dialog-body">The kitchen starts cooking as soon as you send, and your food is brought to <strong>Table ${table}</strong>. ${formatPrice(total)}, paid with your bill at the end.</p>
    <div class="k-dialog-actions"><button class="k-btn k-btn-ghost" type="button" id="confirm-no">Not yet</button><button class="k-btn k-btn-primary" type="button" id="confirm-yes">${icon('send')}Send order</button></div>
  </dialog>
  ${nav('shortlist')}`;

  app.querySelectorAll('[data-q]').forEach(b => b.addEventListener('click', () => { setQty(b.dataset.id, (shortlist[b.dataset.id] || 0) + Number(b.dataset.q)); rerender(); }));
  app.querySelector('#note')?.addEventListener('input', e => { orderNote = e.target.value; });
  app.querySelector('#clear')?.addEventListener('click', () => { shortlist = {}; store.set('shortlist', shortlist); setQty('', 0); rerender(); toast('Dishes cleared'); });
  app.querySelector('#seat')?.addEventListener('submit', e => {
    e.preventDefault();
    const v = app.querySelector('#seat-n').value; if (!v) return;
    Orders.setTable(v); table = v; rerender(); toast(`Seated at Table ${v}`);
  });
  app.querySelector('#leave')?.addEventListener('click', () => { Orders.leaveTable(); table = null; rerender(); });
  const dlg = app.querySelector('#confirm');
  app.querySelector('#send')?.addEventListener('click', () => dlg.showModal());
  app.querySelector('#confirm-no')?.addEventListener('click', () => dlg.close());
  app.querySelector('#confirm-yes')?.addEventListener('click', () => {
    const o = Orders.placeOrder({ table, note: orderNote, items: items.map(([d, q]) => ({ id: d.id, name: d.name, qty: q, price: d.price })) });
    dlg.close();
    shortlist = {}; store.set('shortlist', shortlist); setQty('', 0); orderNote = '';
    seen.set(o.id, o.status);
    rerender(); scrollTo(0, 0);
    toast(`Round ${o.round} sent. The kitchen has it.`);
  });
  app.querySelector('#bill')?.addEventListener('click', () => { Orders.requestBill(table); rerender(); toast('Bill requested'); });
  return Orders.subscribe(() => { if (document.activeElement?.id !== 'note') rerender(); });
}

function viewAbout() {
  const t = store.get('theme', 'system');
  app.innerHTML = `
  <header class="topbar"><span class="topbar-title topbar-title-lg">About Kanal</span>${lockup(true)}</header>
  <main id="main" class="about" tabindex="-1">
    <section class="about-intro">
      <div class="about-mark">${MARK}</div>
      <p class="eyebrow">${esc(RESTAURANT.line)}</p>
      <h1 class="display"><span lang="ta">${RESTAURANT.tamil}</span> means ember.</h1>
      <div class="gold-rule" aria-hidden="true"></div>
      <p>Kanal cooks over a single wood fire: meat rested beside it, bread baked against its floor, pears poached in what is left of the heat. This menu lets you see each plate at its real size, on your own table, before you order. Kanal is a fictional restaurant made for a design portfolio.</p>
    </section>

    <section class="how" aria-labelledby="how-title">
      <h2 id="how-title" class="section-title">How “View on your table” works</h2>
      <ol class="steps">
        <li><span class="step-n">1</span><span><strong>Point at the table.</strong> Move the phone slowly so it can find the flat surface.</span></li>
        <li><span class="step-n">2</span><span><strong>Tap to set the dish down.</strong> It appears at its real size with its name and price above it.</span></li>
        <li><span class="step-n">3</span><span><strong>Browse on the table.</strong> Tap the circles under the dish for the previous or next plate, or pause the slideshow. Pinch to resize, twist to turn.</span></li>
      </ol>
      <p class="muted">On a computer you see a table preview instead. The Android and iPhone apps use ARCore and ARKit; on a phone browser, ${platform() === 'web' ? 'Chrome on Android or Safari on iPhone opens its own AR viewer' : 'the app uses the camera directly'}.</p>
    </section>

    <section aria-labelledby="disp-title">
      <h2 id="disp-title" class="section-title">Display</h2>
      <div class="k-tabs" role="radiogroup" aria-label="Theme">
        ${[['system', 'Match phone'], ['dark', 'Evening'], ['light', 'Daylight']].map(([v, l]) => `<button class="k-tab" role="radio" aria-checked="${t === v}" data-theme-set="${v}" type="button">${l}</button>`).join('')}
      </div>
    </section>

    <section aria-labelledby="cred-title">
      <h2 id="cred-title" class="section-title">Credits</h2>
      <p class="muted">The dishes are real 3D scans and models shared under open licences. They were cleaned, resized to real-world scale and lightened for phones; nothing else was changed.</p>
      <ul class="credits" role="list">
        ${DISHES.map(d => `<li><span class="cr-what">${esc(d.name)}</span><span class="cr-src">${esc(d.credit.kind)}, “${esc(d.credit.title)}” by ${esc(d.credit.author)}. <a href="${d.credit.url}" target="_blank" rel="noopener">Source${icon('external', 'ext')}</a> · <a href="${d.credit.license.url}" target="_blank" rel="noopener">${d.credit.license.name}</a>${d.standIn ? ` <em>${esc(d.standIn)}</em>` : ''}</span></li>`).join('')}
        ${ENV_CREDITS.map(c => `<li><span class="cr-what">${esc(c.what)}</span><span class="cr-src">“${esc(c.title)}” by ${esc(c.author)}. <a href="${c.url}" target="_blank" rel="noopener">Source${icon('external', 'ext')}</a> · <a href="${c.license.url}" target="_blank" rel="noopener">${c.license.name}</a></span></li>`).join('')}
        <li><span class="cr-what">3D viewer</span><span class="cr-src">&lt;model-viewer&gt; by Google, Apache 2.0. Android AR: ARCore with SceneView. iPhone AR: ARKit with RealityKit.</span></li>
        <li><span class="cr-what">Type</span><span class="cr-src">Lato (Łukasz Dziedzic) and Cormorant Garamond (Christian Thalmann), SIL Open Font License.</span></li>
      </ul>
      <p class="muted">Design and code by Gopinath Thandapani, on the Kolam design system.</p>
    </section>

    <section aria-labelledby="staff-title">
      <h2 id="staff-title" class="section-title">For the restaurant</h2>
      <p class="muted">Orders go straight from each table to the kitchen screen, which marks them cooking, on their way and served. Each table has its own QR code.</p>
      <div class="staff-links">
        <a class="k-btn k-btn-outline" href="./kitchen.html">${icon('flame')}Kitchen screen</a>
        <a class="k-btn k-btn-outline" href="./tables.html">${icon('qr')}Table QR codes</a>
      </div>
    </section>
  </main>
  ${nav('about')}`;
  app.querySelectorAll('[data-theme-set]').forEach(b => b.addEventListener('click', () => {
    const v = b.dataset.themeSet; store.set('theme', v);
    if (v === 'system') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = v;
    rerender();
  }));
}

function viewMissing() {
  app.innerHTML = `<main id="main" class="empty" tabindex="-1"><h1 class="display display-sm">That dish isn’t on tonight’s menu</h1><a class="k-btn k-btn-primary" href="#/">Back to the menu</a></main>${nav('menu')}`;
}

// ---------- router ----------
function route() {
  current.cleanup?.(); current.cleanup = null;
  const [, view, id] = (location.hash.slice(1) || '/').split('/');
  const r = view === 'dish' ? viewDish(id) : view === 'table' ? viewTable(id) : view === 'order' || view === 'shortlist' ? viewOrder() : view === 'about' ? viewAbout() : viewMenu();
  current.cleanup = typeof r === 'function' ? r : null;
  document.body.dataset.view = view || 'menu';
  const t = { dish: byId(id)?.name, table: 'On the table', order: 'Your order', about: 'About' }[view];
  document.title = t ? `${t} · Kanal` : 'Kanal — Table Menu';
}
let lastHash = location.hash;
function rerender() { const y = scrollY; route(); scrollTo(0, y); }
addEventListener('hashchange', () => {
  // The table view swaps dishes in place (and keeps the hash in step with replaceState); only re-render for another dish.
  const sameView = location.hash.startsWith('#/table') && lastHash.startsWith('#/table') && location.hash.split('/')[2] === current.tableId;
  lastHash = location.hash;
  if (sameView) return; // the table view changes dish in place
  route();
  if (!location.hash.startsWith('#c-')) { scrollTo(0, 0); document.getElementById('main')?.focus({ preventScroll: true }); }
});
// Tell the guest when the kitchen moves one of their rounds along, wherever they are in the menu.
const seen = new Map();
if (table) Orders.mine(table).forEach(o => seen.set(o.id, o.status));
Orders.subscribe(() => {
  if (!table) return;
  for (const o of Orders.mine(table)) {
    const was = seen.get(o.id); seen.set(o.id, o.status);
    if (!was || was === o.status) continue;
    if (o.kind === 'bill' && o.status === 'served') toast('Your bill is on its way');
    else if (o.kind === 'food' && o.status !== 'received') toast(`Round ${o.round}: ${Orders.STATUS.find(x => x.id === o.status).guest.toLowerCase()}`);
  }
});

if (location.hash === '' && scan?.table) location.hash = '#/';
route();
if (scan?.error) toast(scan.error);
else if (scan?.table) toast(`Welcome to Kanal. You’re at Table ${scan.table}.`);

if ('serviceWorker' in navigator && location.protocol === 'https:' && platform() === 'web') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
