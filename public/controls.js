/* Custom form controls: dual-range slider, segmented toggles, star picker. No dependencies. */
window.FSC = (() => {
  'use strict';
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const N = 1000;

  function makeScale(min, max, log) {
    if (log) {
      const lmin = Math.log(min);
      const lmax = Math.log(max);
      return { toPos: (v) => ((Math.log(Math.max(v, min)) - lmin) / (lmax - lmin)) * N, toVal: (p) => Math.exp(lmin + (p / N) * (lmax - lmin)) };
    }
    return { toPos: (v) => ((v - min) / (max - min)) * N, toVal: (p) => min + (p / N) * (max - min) };
  }

  function roundTo(v, step) {
    const d = step < 1 ? Math.ceil(-Math.log10(step)) : 0;
    return Number((Math.round(v / step) * step).toFixed(d));
  }
  // Round to ~3 significant digits so slider values read naturally (e.g. 12.3, 456, 1230).
  function nice(v) {
    if (v === 0) return 0;
    const mag = Math.pow(10, Math.floor(Math.log10(Math.abs(v))) - 2);
    return Number((Math.round(v / mag) * mag).toPrecision(3));
  }

  /**
   * Dual (or single) range slider with editable number inputs.
   * opts: { min, max, log, step, unit, single, onChange(min, max) }  — '' means "no bound".
   */
  function dualRange(el, opts) {
    const { min, max, log = false, step = null, single = false, unit = '' } = opts;
    const sc = makeScale(min, max, log);
    el.classList.add('drange');
    if (single) el.classList.add('single');
    el.innerHTML = `<div class="drange-slider"><div class="drange-track"><div class="drange-fill"></div></div>
        <input type="range" class="r-min" min="0" max="${N}" value="0" aria-label="минимум">
        ${single ? '' : `<input type="range" class="r-max" min="0" max="${N}" value="${N}" aria-label="максимум">`}
      </div>
      <div class="drange-vals">
        <input type="number" class="v-min" placeholder="${single ? 'от' : 'мин'}" step="any">
        ${single ? '' : '<span class="dash">—</span><input type="number" class="v-max" placeholder="макс" step="any">'}
        ${unit ? `<span class="unit">${esc(unit)}</span>` : ''}
      </div>`;
    const rMin = el.querySelector('.r-min');
    const rMax = el.querySelector('.r-max');
    const vMin = el.querySelector('.v-min');
    const vMax = el.querySelector('.v-max');
    const fill = el.querySelector('.drange-fill');
    let state = { min: '', max: '' };
    const q = (v) => (step ? roundTo(v, step) : nice(v));

    function paint() {
      const pMin = state.min === '' ? 0 : clamp(sc.toPos(Number(state.min)), 0, N);
      const pMax = single || state.max === '' ? N : clamp(sc.toPos(Number(state.max)), 0, N);
      rMin.value = pMin;
      if (rMax) rMax.value = pMax;
      fill.style.left = (pMin / N) * 100 + '%';
      fill.style.right = 100 - (pMax / N) * 100 + '%';
      rMin.style.zIndex = pMin > N - 20 ? 6 : 3; // let the min thumb win when both sit at the right end
      if (document.activeElement !== vMin) vMin.value = state.min;
      if (vMax && document.activeElement !== vMax) vMax.value = state.max;
      el.classList.toggle('active', state.min !== '' || state.max !== '');
    }
    function emit() { paint(); if (opts.onChange) opts.onChange(state.min, state.max); }

    rMin.addEventListener('input', () => {
      let p = Number(rMin.value);
      if (rMax && p > Number(rMax.value)) { p = Number(rMax.value); rMin.value = p; }
      state.min = p <= 0 ? '' : String(q(sc.toVal(p)));
      emit();
    });
    if (rMax) rMax.addEventListener('input', () => {
      let p = Number(rMax.value);
      if (p < Number(rMin.value)) { p = Number(rMin.value); rMax.value = p; }
      state.max = p >= N ? '' : String(q(sc.toVal(p)));
      emit();
    });
    vMin.addEventListener('change', () => { state.min = vMin.value.trim() === '' || Number.isNaN(Number(vMin.value)) ? '' : String(Number(vMin.value)); emit(); });
    if (vMax) vMax.addEventListener('change', () => { state.max = vMax.value.trim() === '' || Number.isNaN(Number(vMax.value)) ? '' : String(Number(vMax.value)); emit(); });
    paint();
    return {
      el,
      get: () => ({ ...state }),
      set: (mn, mx) => { state = { min: mn == null ? '' : String(mn), max: single || mx == null ? '' : String(mx) }; paint(); },
    };
  }

  /**
   * Segmented control. opts: { options: [{value,label,title}], multi, value, defaultValue, allowClear, onChange(value) }
   */
  function segmented(el, opts) {
    el.classList.add('segc');
    if (opts.multi) el.classList.add('multi');
    let value = opts.multi ? [...(opts.value || [])] : (opts.value ?? '');
    const def = opts.defaultValue ?? '';
    el.innerHTML = opts.options.map((o) => `<button type="button" data-v="${esc(o.value)}" ${o.title ? `title="${esc(o.title)}"` : ''}>${o.label}</button>`).join('');
    function paint() {
      el.querySelectorAll('button').forEach((b) => { const v = b.dataset.v; b.classList.toggle('on', opts.multi ? value.includes(v) : value === v); });
      el.classList.toggle('active', opts.multi ? value.length > 0 : value !== def);
    }
    el.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b || !el.contains(b)) return;
      const v = b.dataset.v;
      if (opts.multi) value = value.includes(v) ? value.filter((x) => x !== v) : [...value, v];
      else value = opts.allowClear && v === value ? def : v;
      paint();
      if (opts.onChange) opts.onChange(opts.multi ? [...value] : value);
    });
    paint();
    return {
      el,
      get: () => (opts.multi ? [...value] : value),
      set: (v) => { value = opts.multi ? [...(v || [])] : (v == null ? def : String(v)); paint(); },
    };
  }

  const STAR = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';

  /** Star picker for a minimum rating: value '' or '1'..'5'. */
  function stars(el, opts) {
    el.classList.add('stars');
    let value = '';
    el.innerHTML = [1, 2, 3, 4, 5].map((n) => `<button type="button" data-n="${n}" title="не ниже ${n}">${STAR}</button>`).join('') + '<span class="stars-label"></span>';
    const btns = Array.from(el.querySelectorAll('button'));
    const label = el.querySelector('.stars-label');
    const paint = (hover) => {
      const v = hover || Number(value || 0);
      btns.forEach((b) => b.classList.toggle('on', Number(b.dataset.n) <= v));
      label.textContent = value ? `не ниже ${value}` : 'любой';
      el.classList.toggle('active', value !== '');
    };
    btns.forEach((b) => {
      b.addEventListener('mouseenter', () => paint(Number(b.dataset.n)));
      b.addEventListener('mouseleave', () => paint());
      b.addEventListener('click', () => { value = value === b.dataset.n ? '' : b.dataset.n; paint(); if (opts.onChange) opts.onChange(value); });
    });
    paint();
    return { el, get: () => value, set: (v) => { value = v ? String(Math.round(Number(v))) : ''; paint(); } };
  }

  return { dualRange, segmented, stars };
})();
