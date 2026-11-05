// "On the table": the dish standing on a walnut table with its floating glass card, the leader line to a glowing pin,
// and the KANAL · MENU lockup with previous / pause / next lying flat on the table in front of it.
// It is the same layout the native AR views draw over the camera (see android/.../TableArActivity.kt and ios/Kanal/ARTableView.swift),
// so the web and portfolio show the concept even on a computer. On phones it also hands off to real AR.

const ADVANCE_MS = 8000;

export function mountTable(root, o) {
  const { dishes, icon, esc, formatPrice, formatQty, model, usdz, asset } = o;
  let i = o.start, paused = matchMedia('(prefers-reduced-motion: reduce)').matches, timer = 0, t0 = 0, raf = 0, remain = ADVANCE_MS;

  root.innerHTML = `
    <div class="ts-wood" aria-hidden="true"></div>
    <div class="ts-top">
      <a class="round-btn round-btn-glass" href="#/dish/${dishes[i].id}" id="ts-close" aria-label="Close and see the dish details">${icon('close')}</a>
      <p class="ts-count" aria-live="off"><span id="ts-course"></span> <span class="ts-num" id="ts-num"></span></p>
      <button class="ts-ar k-btn k-btn-sm" type="button" id="ts-ar" hidden>${icon('camera')}<span>Open camera</span></button>
    </div>
    <svg class="ts-leader" id="ts-leader" aria-hidden="true">
      <line id="ts-line" x1="0" y1="0" x2="0" y2="0" stroke="#e8d3a6" stroke-opacity=".8" stroke-width="1.25" stroke-linecap="round"/></svg>
    <div class="ts-card" id="ts-card" role="group" aria-roledescription="dish card">
      <p class="ts-name" id="ts-name"></p>
      <span class="ts-rule" aria-hidden="true"></span>
      <p class="ts-meta" id="ts-meta"></p>
      ${o.onAdd ? `<button class="ts-add" type="button" id="ts-add">${icon('plus')}<span>Add to order</span></button>` : ''}
    </div>
    <model-viewer class="ts-mv" id="ts-mv" camera-controls disable-pan disable-zoom interaction-prompt="none"
      camera-orbit="0deg 60deg auto" min-camera-orbit="auto 45deg auto" max-camera-orbit="auto 72deg 4m" field-of-view="26deg"
      environment-image="${asset('env/hearth.hdr')}" tone-mapping="neutral" exposure="0.95" shadow-intensity="1" shadow-softness="0.4"
      ar ar-modes="webxr scene-viewer quick-look" ar-placement="floor" ar-scale="fixed" touch-action="pan-y">
      <button class="ts-pin" slot="hotspot-pin" data-position="0 0.05m 0" data-normal="0 1 0" tabindex="-1" aria-hidden="true"><span></span></button>
      <button slot="ar-button" hidden></button>
    </model-viewer>
    <div class="ts-floor">
      <div class="ts-plane">
        <div class="ts-lockup">${o.lockupHTML}<span class="ts-menu">MENU</span></div>
        <div class="ts-controls" role="group" aria-label="Browse dishes">
          <button class="ring-btn" type="button" id="ts-prev" aria-label="Previous dish">${icon('prev')}</button>
          <button class="ring-btn ring-btn-main" type="button" id="ts-pause" aria-label="Pause the slideshow" aria-pressed="false">
            <svg class="ring-progress" viewBox="0 0 56 56" aria-hidden="true"><circle cx="28" cy="28" r="26.5" pathLength="100" id="ts-ring"/></svg>
            <span id="ts-pause-ic">${icon('pause')}</span></button>
          <button class="ring-btn" type="button" id="ts-next" aria-label="Next dish">${icon('next')}</button>
        </div>
      </div>
    </div>
    <p class="k-sr-only" aria-live="polite" id="ts-live"></p>
    <p class="ts-hint" id="ts-hint">${o.native ? 'Tap Open camera to place it on your real table' : 'Table preview · drag to look around'}</p>`;

  const $ = s => root.querySelector(s);
  const mv = $('#ts-mv'), card = $('#ts-card'), line = $('#ts-line'), svg = $('#ts-leader'), pin = $('.ts-pin');

  function show(n, first = false) {
    i = (n + dishes.length) % dishes.length;
    const d = dishes[i];
    o.onIndex?.(i);
    $('#ts-close').href = `#/dish/${d.id}`;
    $('#ts-num').textContent = `${i + 1} / ${dishes.length}`;
    $('#ts-course').textContent = o.courseLabel ? o.courseLabel(d.course) : d.course;
    $('#ts-live').textContent = `${d.name}, ${formatQty(d)}, ${formatPrice(d.price)}`;
    const apply = () => {
      $('#ts-name').textContent = d.name;
      $('#ts-meta').textContent = `${formatQty(d)}  ·  ${formatPrice(d.price)}`;
      mv.setAttribute('alt', `3D scan of ${d.name} on the table`);
      mv.src = model(d); mv.setAttribute('ios-src', usdz(d));
    };
    if (first) { apply(); return; }
    root.classList.add('is-swapping');
    setTimeout(apply, 220);
  }

  mv.addEventListener('load', () => {
    const dim = mv.getDimensions();
    mv.updateHotspot({ name: 'hotspot-pin', position: `0m ${(dim.y * 0.78).toFixed(3)}m 0m` });
    // Keep the table at one real-world scale: small plates (a burger, a tart) stay small instead of being zoomed to fill.
    const fit = Math.hypot(dim.x, dim.y, dim.z) / 2 / Math.sin(13 * Math.PI / 180);
    mv.cameraOrbit = `0deg 60deg ${Math.max(fit, 0.62).toFixed(3)}m`; mv.jumpCameraToGoal();
    requestAnimationFrame(() => root.classList.remove('is-swapping'));
    if (!o.native && mv.canActivateAR) $('#ts-ar').hidden = false;
  });
  if (o.native) $('#ts-ar').hidden = false;

  // Leader line from the card to the pin, kept in place every frame.
  function draw() {
    const r = root.getBoundingClientRect(), c = card.getBoundingClientRect(), p = pin.getBoundingClientRect();
    svg.setAttribute('viewBox', `0 0 ${r.width} ${r.height}`);
    const x1 = c.left + c.width / 2 - r.left, y1 = c.bottom - r.top;
    const x2 = p.left + p.width / 2 - r.left, y2 = p.top + p.height / 2 - r.top;
    line.setAttribute('x1', x1); line.setAttribute('y1', y1); line.setAttribute('x2', x2); line.setAttribute('y2', y2 - 6);
    if (!paused && timer) {
      const left = Math.max(0, remain - (performance.now() - t0));
      $('#ts-ring').style.strokeDashoffset = String((left / ADVANCE_MS) * 100);
    }
    raf = requestAnimationFrame(draw);
  }
  raf = requestAnimationFrame(draw);

  function schedule() {
    clearTimeout(timer); timer = 0;
    if (paused) return;
    t0 = performance.now();
    timer = setTimeout(() => { remain = ADVANCE_MS; show(i + 1); schedule(); }, remain);
  }
  function setPaused(p) {
    if (p && timer) remain = Math.max(400, remain - (performance.now() - t0));
    paused = p;
    const b = $('#ts-pause');
    b.setAttribute('aria-pressed', String(p));
    b.setAttribute('aria-label', p ? 'Resume the slideshow' : 'Pause the slideshow');
    $('#ts-pause-ic').innerHTML = icon(p ? 'play' : 'pause');
    root.classList.toggle('is-paused', p);
    if (p) { clearTimeout(timer); timer = 0; } else schedule();
  }
  const step = k => { remain = ADVANCE_MS; show(i + k); schedule(); };

  $('#ts-prev').addEventListener('click', () => step(-1));
  $('#ts-next').addEventListener('click', () => step(1));
  $('#ts-pause').addEventListener('click', () => setPaused(!paused));
  $('#ts-add')?.addEventListener('click', () => { o.onAdd(dishes[i]); setPaused?.(true); });
  $('#ts-ar').addEventListener('click', () => {
    setPaused(true);
    if (!o.native) return mv.activateAR();
    o.openNative(i).then(back => { if (typeof back === 'number' && back >= 0 && back !== i) { remain = ADVANCE_MS; show(back); } });
  });
  // Touching the dish pauses the slideshow so people can look closely.
  mv.addEventListener('pointerdown', () => { if (!paused) setPaused(true); });
  const keys = e => {
    if (e.key === 'ArrowRight') step(1);
    else if (e.key === 'ArrowLeft') step(-1);
    else if (e.key === ' ' && !e.target.closest('button,a')) { e.preventDefault(); setPaused(!paused); }
  };
  addEventListener('keydown', keys);

  show(i, true);
  setPaused(paused);

  return () => { cancelAnimationFrame(raf); clearTimeout(timer); removeEventListener('keydown', keys); };
}
