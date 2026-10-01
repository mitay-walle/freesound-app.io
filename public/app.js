/* Freesound App — front-end logic (vanilla JS, no build step). */
(() => {
  'use strict';

  // ------------------------------------------------------------------ utils
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const val = (sel) => ($(sel) ? $(sel).value.trim() : '');
  const setVal = (sel, v) => { const el = $(sel); if (el) el.value = v ?? ''; };
  const sq = (v) => '"' + String(v).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
  const range = (field, min, max) => (min === '' && max === '' ? '' : `${field}:[${min === '' ? '*' : min} TO ${max === '' ? '*' : max}]`);
  const isNum = (v) => v !== '' && v !== null && v !== undefined && !Number.isNaN(Number(v));
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  const fmtDur = (d) => {
    if (d == null) return '';
    const s = Number(d);
    if (s < 60) return s.toFixed(s < 10 ? 2 : 1) + ' с';
    const m = Math.floor(s / 60);
    const r = Math.floor(s % 60);
    return `${m}:${String(r).padStart(2, '0')}`;
  };
  const fmtClock = (s) => {
    if (!Number.isFinite(s)) return '0:00';
    const m = Math.floor(s / 60);
    const r = Math.floor(s % 60);
    return `${m}:${String(r).padStart(2, '0')}`;
  };
  const fmtSize = (b) => (b == null ? '' : b < 1024 * 1024 ? (b / 1024).toFixed(0) + ' KB' : (b / 1024 / 1024).toFixed(1) + ' MB');
  const fmtNum = (n) => (n == null ? '' : Number(n).toLocaleString('ru-RU'));
  const chStr = (c) => (c === 1 ? 'моно' : c === 2 ? 'стерео' : c ? c + ' кан.' : '');
  const licShort = (l) => (l === 'Creative Commons 0' ? 'CC0' : l === 'Attribution' ? 'CC BY' : l === 'Attribution NonCommercial' ? 'CC BY-NC' : l || '');
  const licClass = (l) => (l === 'Creative Commons 0' ? 'cc0' : l === 'Attribution' ? 'by' : l === 'Attribution NonCommercial' ? 'nc' : '');
  const packIdFrom = (uri) => { const m = String(uri || '').match(/\/packs\/(\d+)/); return m ? m[1] : null; };
  const linkify = (t) => esc(t).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
  const dateIso = (daysAgo) => new Date(Date.now() - daysAgo * 86400000).toISOString().slice(0, 10);
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
  const cssUrl = (u) => `url('${String(u).replace(/['\\]/g, '')}')`;

  // ------------------------------------------------------------------ icons (Feather-style, 24x24 stroke)
  const ICONS = {
    search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
    heart: '<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>',
    ban: '<circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
    sliders: '<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>',
    play: '<polygon points="6 3 20 12 6 21 6 3" fill="currentColor" stroke="none"/>',
    pause: '<rect x="5" y="4" width="5" height="16" fill="currentColor" stroke="none"/><rect x="14" y="4" width="5" height="16" fill="currentColor" stroke="none"/>',
    shuffle: '<polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/>',
    external: '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>',
    comment: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
    box: '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>',
    user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    check: '<polyline points="20 6 9 17 4 12"/>',
    list: '<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>',
    grid: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>',
    repeat: '<polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>',
    skip: '<polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/>',
    folder: '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>',
    activity: '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
    eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
    'log-in': '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/>',
    'log-out': '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
    copy: '<rect x="9" y="9" width="13" height="13"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    key: '<path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>',
    'chevron-down': '<polyline points="6 9 12 15 18 9"/>',
    'chevron-left': '<polyline points="15 18 9 12 15 6"/>',
    'chevron-right': '<polyline points="9 18 15 12 9 6"/>',
    'rotate-ccw': '<polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-9.5L1 10"/>',
    moon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="6.34" y2="6.34"/><line x1="17.66" y1="17.66" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="6.34" y2="17.66"/><line x1="17.66" y1="6.34" x2="19.07" y2="4.93"/>',
    info: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
    type: '<polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/>',
  };
  const ic = (name, cls = '', fill = false) => `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="${fill ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
  function mountIcons(root = document) {
    $$('[data-icon]', root).forEach((el) => {
      const svg = ic(el.dataset.icon, el.dataset.size || '');
      if (el.tagName === 'SPAN' || el.tagName === 'DIV') el.innerHTML = svg;
      else el.insertAdjacentHTML('afterbegin', svg);
      el.removeAttribute('data-icon');
    });
  }

  // ------------------------------------------------------------------ state
  const S = {
    status: null,
    settings: null,
    favorites: [],
    favSet: new Set(),
    searches: [],
    query: '',
    sort: localStorage.getItem('fs_sort') || 'score',
    page: 1,
    pageSize: 30,
    groupByPack: false,
    view: localStorage.getItem('fs_view') || 'list',
    results: null,
    lastUrl: '',
    injected: 0,
    hidden: 0,
    soundCache: new Map(),
    current: null,
    currentList: [],
    loop: false,
    autoNext: localStorage.getItem('fs_autonext') === '1',
    loading: false,
    tab: 'search',
    usageAt: 0,
    blKind: 'user',
    selectedId: null,
    filterPresets: [],
  };

  // Blacklist model: users / tags / packs / words.
  const BL = { users: [], tags: [], packs: [], words: [], userSet: new Set(), tagSet: new Set(), packIds: new Set(), wordList: [] };
  const KIND = {
    user: { label: 'автор', plural: 'Авторы', placeholder: 'username' },
    tag: { label: 'тег', plural: 'Теги', placeholder: 'тег, например field-recording' },
    pack: { label: 'пак', plural: 'Паки', placeholder: 'ID пака или ссылка на него' },
    word: { label: 'слово', plural: 'Слова', placeholder: 'слово или фраза в названии/описании/тегах' },
  };
  const FILTER_PRESETS_KEY = 'fs_filter_presets';
  const MAIN_SEARCH_KEY = 'fs_main_search';
  const tagSuggestCache = new Map();

  // ------------------------------------------------------------------ http
  async function api(path, params = {}, init = {}) {
    const u = new URL('/api' + path, location.origin);
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null) continue;
      if (v === '' && k !== 'query') continue;
      u.searchParams.set(k, v);
    }
    const r = await fetch(u, init);
    const text = await r.text();
    let data;
    try { data = JSON.parse(text); } catch (_) { data = { detail: text.slice(0, 300) }; }
    if (!r.ok) throw Object.assign(new Error(friendlyError(r.status, data)), { status: r.status, data });
    return { data, headers: r.headers };
  }

  function friendlyError(status, data) {
    const d = (data && data.detail) || '';
    if (status === 401) return d || 'Нет доступа: проверьте ключи API в настройках.';
    if (status === 429) return 'Лимит запросов Freesound исчерпан (60/мин, 2000/день). ' + d;
    if (status === 404) return 'Не найдено. ' + d;
    if (status === 400) return 'Некорректный запрос: ' + d;
    return d || `Ошибка HTTP ${status}`;
  }

  async function local(path, method = 'GET', body) {
    const r = await fetch('/local' + path, {
      method,
      headers: body ? { 'content-type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(data.detail || `HTTP ${r.status}`), { status: r.status });
    return data;
  }

  // ------------------------------------------------------------------ toasts
  function toast(msg, opts = {}) {
    if (typeof opts === 'string') opts = { type: opts };
    const box = $('#toasts');
    const el = document.createElement('div');
    el.className = 'toast ' + (opts.type || '');
    const span = document.createElement('span');
    span.textContent = msg;
    el.appendChild(span);
    const close = () => el.remove();
    if (opts.action) {
      const b = document.createElement('button');
      b.textContent = opts.action.label;
      b.onclick = () => { close(); opts.action.fn(); };
      el.appendChild(b);
    }
    const x = document.createElement('button');
    x.className = 'x';
    x.textContent = '×';
    x.onclick = close;
    el.appendChild(x);
    box.appendChild(el);
    if (!opts.sticky) setTimeout(close, opts.timeout || (opts.type === 'error' ? 8000 : 4000));
    return { close, set: (m) => { span.textContent = m; } };
  }

  // ------------------------------------------------------------------ chips input
  async function suggestTags(query) {
    const q = String(query || '').trim().toLowerCase();
    if (q.length < 2) return [];
    const cached = tagSuggestCache.get(q);
    if (cached && Date.now() - cached.at < 300000) return cached.items.slice();

    const counts = new Map();
    for (const sound of S.soundCache.values()) {
      for (const tag of sound.tags || []) {
        const lower = String(tag).toLowerCase();
        if (!lower.includes(q)) continue;
        counts.set(lower, (counts.get(lower) || 0) + 3);
      }
    }
    try {
      const { data } = await api('/search/text/', { query: q, fields: 'id,tags', page_size: 20, _nobl: 1 });
      for (const sound of data.results || []) {
        for (const tag of sound.tags || []) {
          const lower = String(tag).toLowerCase();
          if (!lower.includes(q)) continue;
          counts.set(lower, (counts.get(lower) || 0) + 1);
        }
      }
    } catch (_) { /* local suggestions are still useful */ }

    const items = Array.from(counts.entries())
      .sort((a, b) => Number(b[0].startsWith(q)) - Number(a[0].startsWith(q)) || b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 12)
      .map(([tag]) => tag);
    tagSuggestCache.set(q, { at: Date.now(), items });
    return items;
  }

  function makeChips(container) {
    const input = document.createElement('input');
    input.type = 'text';
    input.autocomplete = 'off';
    input.placeholder = container.dataset.placeholder || '';
    const suggest = document.createElement('div');
    suggest.className = 'tag-suggest hidden';
    const items = [];
    let suggestItems = [];
    let suggestIndex = -1;
    let suggestTimer = null;
    let suggestSeq = 0;

    const hideSuggest = () => {
      suggest.classList.add('hidden');
      suggest.innerHTML = '';
      suggestItems = [];
      suggestIndex = -1;
    };
    const render = () => {
      $$('.chip-item', container).forEach((c) => c.remove());
      items.forEach((t, i) => {
        const c = document.createElement('span');
        c.className = 'chip-item';
        c.innerHTML = `${esc(t)}<button type="button" title="убрать">×</button>`;
        c.querySelector('button').onclick = () => { items.splice(i, 1); render(); container.dispatchEvent(new Event('input', { bubbles: true })); };
        container.insertBefore(c, input);
      });
    };
    const add = (raw) => {
      raw.split(/[,\s]+/).map((t) => t.trim().toLowerCase()).filter(Boolean).forEach((t) => { if (!items.includes(t)) items.push(t); });
      render();
      container.dispatchEvent(new Event('input', { bubbles: true }));
      hideSuggest();
    };
    const renderSuggest = (values) => {
      suggestItems = values.filter((tag) => !items.includes(tag));
      suggestIndex = suggestItems.length ? 0 : -1;
      suggest.innerHTML = suggestItems.map((tag, i) => `<button type="button" data-tag="${esc(tag)}" class="${i === suggestIndex ? 'active' : ''}">${esc(tag)}</button>`).join('');
      suggest.classList.toggle('hidden', !suggestItems.length);
    };
    const updateSuggestSelection = () => {
      $$('button', suggest).forEach((button, i) => button.classList.toggle('active', i === suggestIndex));
      const active = suggest.querySelector('button.active');
      if (active) active.scrollIntoView({ block: 'nearest' });
    };
    const queueSuggest = () => {
      clearTimeout(suggestTimer);
      const q = input.value.trim();
      if (q.length < 2) { hideSuggest(); return; }
      const seq = ++suggestSeq;
      suggestTimer = setTimeout(async () => {
        const values = await suggestTags(q);
        if (seq !== suggestSeq || input.value.trim() !== q) return;
        renderSuggest(values);
      }, 220);
    };

    input.addEventListener('input', queueSuggest);
    input.addEventListener('keydown', (e) => {
      if (!suggest.classList.contains('hidden') && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
        e.preventDefault();
        suggestIndex = (suggestIndex + (e.key === 'ArrowDown' ? 1 : -1) + suggestItems.length) % suggestItems.length;
        updateSuggestSelection();
        return;
      }
      if (e.key === 'Enter' || e.key === ',') {
        const selected = !suggest.classList.contains('hidden') && suggestIndex >= 0 ? suggestItems[suggestIndex] : input.value;
        if (String(selected || '').trim()) { e.preventDefault(); add(selected); input.value = ''; }
      } else if (e.key === 'Escape') {
        hideSuggest();
      } else if (e.key === 'Backspace' && !input.value && items.length) {
        items.pop(); render(); container.dispatchEvent(new Event('input', { bubbles: true }));
      }
    });
    input.addEventListener('blur', () => setTimeout(() => {
      if (input.value.trim()) { add(input.value); input.value = ''; }
      hideSuggest();
    }, 150));
    suggest.addEventListener('mousedown', (e) => {
      const button = e.target.closest('button[data-tag]');
      if (!button) return;
      e.preventDefault();
      add(button.dataset.tag);
      input.value = '';
      input.focus();
    });
    container.addEventListener('click', (e) => { if (e.target === container) input.focus(); });
    container.appendChild(input);
    container.appendChild(suggest);
    return {
      get: () => items.slice(),
      set: (arr) => { items.length = 0; (arr || []).forEach((t) => { if (!items.includes(t)) items.push(t); }); render(); hideSuggest(); },
      add,
    };
  }
  const chips = {};

  // ------------------------------------------------------------------ custom filter controls
  const C = {};
  const onCtl = () => updateFilterPreview();
  const TRI = [{ value: '', label: 'Любой' }, { value: 'true', label: 'Да' }, { value: 'false', label: 'Нет' }];
  const noteOpts = () => FS.NOTES.map((n) => ({ value: n, label: n }));

  function setupControls() {
    C.tagsMode = FSC.segmented($('#c_tagsMode'), { options: [{ value: 'all', label: 'все теги' }, { value: 'any', label: 'любой из тегов' }], value: 'all', defaultValue: 'all', onChange: onCtl });
    C.types = FSC.segmented($('#c_types'), { multi: true, options: FS.TYPES.map((t) => ({ value: t, label: t })), onChange: onCtl });
    C.channels = FSC.segmented($('#c_channels'), { options: [{ value: '', label: 'Любые' }, { value: '1', label: 'Моно' }, { value: '2', label: 'Стерео' }, { value: 'multi', label: '3+' }], value: '', onChange: onCtl });
    C.sr = FSC.segmented($('#c_sr'), { multi: true, options: [22050, 44100, 48000, 88200, 96000, 192000].map((v) => ({ value: String(v), label: (v / 1000).toString().replace('.', ',') + ' kHz' })), onChange: onCtl });
    C.bd = FSC.segmented($('#c_bd'), { multi: true, options: ['16', '24', '32'].map((v) => ({ value: v, label: v + ' bit' })), onChange: onCtl });
    C.size = FSC.dualRange($('#c_size'), { min: 0.05, max: 2000, log: true, unit: 'МБ', onChange: onCtl });
    C.dur = FSC.dualRange($('#c_dur'), { min: 0.05, max: 3600, log: true, unit: 'сек', onChange: onCtl });
    C.lic = FSC.segmented($('#c_lic'), { multi: true, options: FS.LICENSES.map((l) => ({ value: l.value, label: l.short, title: l.desc })), onChange: onCtl });
    C.rating = FSC.stars($('#c_rating'), { onChange: onCtl });
    C.numRatings = FSC.dualRange($('#c_numRatings'), { min: 0, max: 200, step: 1, single: true, unit: 'оценок', onChange: onCtl });
    C.downloads = FSC.dualRange($('#c_downloads'), { min: 1, max: 100000, log: true, single: true, unit: 'скачиваний', onChange: onCtl });
    C.geo = FSC.segmented($('#c_geo'), { options: [{ value: '', label: 'Не важно' }, { value: 'true', label: 'Только с геотегом' }], value: '', onChange: onCtl });
    C.remix = FSC.segmented($('#c_remix'), { options: TRI, value: '', onChange: onCtl });
    C.wasRemixed = FSC.segmented($('#c_wasRemixed'), { options: TRI, value: '', onChange: onCtl });
    C.bpm = FSC.dualRange($('#c_bpm'), { min: 0, max: 300, step: 1, unit: 'BPM', onChange: onCtl });
    C.note = FSC.segmented($('#c_note'), { options: noteOpts(), value: '', allowClear: true, onChange: onCtl });
    C.octave = FSC.segmented($('#c_octave'), { options: [0, 1, 2, 3, 4, 5, 6, 7, 8].map((o) => ({ value: String(o), label: String(o) })), value: '', allowClear: true, onChange: onCtl });
    C.noteConf = FSC.dualRange($('#c_noteConf'), { min: 0, max: 1, step: 0.05, single: true, onChange: onCtl });
    C.keyRoot = FSC.segmented($('#c_keyRoot'), { options: noteOpts(), value: '', allowClear: true, onChange: onCtl });
    C.keyMode = FSC.segmented($('#c_keyMode'), { options: [{ value: '', label: 'Любой лад' }, { value: 'major', label: 'major' }, { value: 'minor', label: 'minor' }], value: '', onChange: onCtl });
    C.loop = FSC.segmented($('#c_loop'), { options: TRI, value: '', onChange: onCtl });
    C.single = FSC.segmented($('#c_single'), { options: TRI, value: '', onChange: onCtl });
    C.reverb = FSC.segmented($('#c_reverb'), { options: TRI, value: '', onChange: onCtl });
    C.loud = FSC.dualRange($('#c_loud'), { min: -70, max: 0, step: 1, single: true, unit: 'LUFS', onChange: onCtl });
  }

  // ------------------------------------------------------------------ descriptor rows
  function fieldOptionsHtml(selected) {
    const groups = {};
    FS.FIELDS.forEach((f) => { (groups[f.group] = groups[f.group] || []).push(f); });
    return Object.entries(groups).map(([g, fs]) => `<optgroup label="${esc(g)}">${fs.map((f) => `<option value="${f.name}" ${f.name === selected ? 'selected' : ''}>${esc(f.label)} (${f.name})</option>`).join('')}</optgroup>`).join('');
  }

  function addDescRow(d = { field: 'brightness' }) {
    const row = document.createElement('div');
    row.className = 'desc-row';
    row.innerHTML = `<select class="d-field">${fieldOptionsHtml(d.field)}</select><button type="button" class="icon-btn d-reset" title="Сбросить дескриптор">${ic('rotate-ccw')}</button><button type="button" class="icon-btn d-del" title="убрать">${ic('x')}</button><div class="d-inputs"></div>`;
    const box = row.querySelector('.d-inputs');
    const mount = (field, dd) => {
      box.innerHTML = '';
      const f = FS.FIELD_BY_NAME[field];
      if (!f) { row._get = () => ({ field, min: '', max: '', value: '' }); return; }
      if ((f.kind === 'numeric' || f.kind === 'integer') && f.range) {
        const el = document.createElement('div');
        box.appendChild(el);
        const r = FSC.dualRange(el, { min: f.range[0], max: f.range[1], log: Boolean(f.log), step: f.step || (f.kind === 'integer' ? 1 : null), unit: f.unit || '', onChange: onCtl });
        r.set(dd.min ?? '', dd.max ?? '');
        row._get = () => { const v = r.get(); return { field, min: v.min, max: v.max, value: '' }; };
      } else if (f.kind === 'numeric' || f.kind === 'integer' || f.kind === 'date') {
        const t = f.kind === 'date' ? 'date' : 'number';
        box.innerHTML = `<input type="${t}" class="d-min" step="any" placeholder="от" value="${esc(dd.min ?? '')}"><input type="${t}" class="d-max" step="any" placeholder="до" value="${esc(dd.max ?? '')}">`;
        row._get = () => ({ field, min: box.querySelector('.d-min').value.trim(), max: box.querySelector('.d-max').value.trim(), value: '' });
      } else if (f.kind === 'boolean') {
        const el = document.createElement('div');
        box.appendChild(el);
        const sg = FSC.segmented(el, { options: [{ value: 'true', label: 'Да' }, { value: 'false', label: 'Нет' }], value: dd.value || 'true', defaultValue: 'true', onChange: onCtl });
        row._get = () => ({ field, min: '', max: '', value: sg.get() });
      } else if (f.values) {
        box.innerHTML = `<select class="d-val">${f.values.map((v) => `<option ${dd.value === v ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select>`;
        row._get = () => ({ field, min: '', max: '', value: box.querySelector('.d-val').value });
      } else {
        box.innerHTML = `<input type="text" class="d-val" placeholder="${f.kind === 'text' ? 'слово или несколько слов' : 'значение'}" value="${esc(dd.value ?? '')}">`;
        row._get = () => ({ field, min: '', max: '', value: box.querySelector('.d-val').value.trim() });
      }
    };
    mount(d.field, d);
    row.querySelector('.d-field').addEventListener('change', (e) => { mount(e.target.value, {}); updateFilterPreview(); });
    row.querySelector('.d-reset').addEventListener('click', () => { mount(row.querySelector('.d-field').value, {}); updateFilterPreview(); });
    row.querySelector('.d-del').addEventListener('click', () => { row.remove(); updateFilterPreview(); });
    $('#f_desc').appendChild(row);
    return row;
  }

  function readDescRows() { return $$('#f_desc .desc-row').map((row) => row._get()); }

  function descToFilter(d) {
    const f = FS.FIELD_BY_NAME[d.field];
    if (!f) return '';
    if (f.kind === 'numeric' || f.kind === 'integer') return range(d.field, d.min, d.max);
    if (f.kind === 'date') return d.min || d.max ? `${d.field}:[${d.min ? d.min + 'T00:00:00Z' : '*'} TO ${d.max ? d.max + 'T23:59:59Z' : '*'}]` : '';
    if (f.kind === 'boolean') return `${d.field}:${d.value || 'true'}`;
    if (!d.value) return '';
    if (f.kind === 'text') {
      const words = d.value.split(/\s+/).filter(Boolean);
      return words.length > 1 ? `${d.field}:(${words.map(sq).join(' AND ')})` : `${d.field}:${sq(words[0])}`;
    }
    return `${d.field}:${sq(d.value)}`;
  }

  // ------------------------------------------------------------------ filters <-> DOM
  function defaultFilters() {
    return {
      exclude: '', tagsInc: [], tagsExc: [], tagsMode: 'all', category: '', subcategory: '',
      types: [], channels: '', samplerates: [], bitdepths: [], sizeMin: '', sizeMax: '', durMin: '', durMax: '',
      licenses: [], rating: '', numRatings: '', downloads: '', after: '', before: '',
      user: '', pack: '', geo: false, remix: '', wasRemixed: '',
      bpmMin: '', bpmMax: '', note: '', octave: '', noteConf: '', keyRoot: '', keyMode: '', loop: '', single: '', reverb: '', loudMin: '',
      desc: [], similarTo: '', simSpace: '', extra: '', manual: false, manualText: '', sortTarget: '', weights: '',
    };
  }

  function readFilters() {
    const size = C.size.get();
    const dur = C.dur.get();
    const bpm = C.bpm.get();
    return {
      exclude: val('#f_exclude'),
      tagsInc: chips.inc.get(), tagsExc: chips.exc.get(), tagsMode: C.tagsMode.get() || 'all',
      category: val('#f_cat'), subcategory: val('#f_subcat'),
      types: C.types.get(), channels: C.channels.get(), samplerates: C.sr.get(), bitdepths: C.bd.get(),
      sizeMin: size.min, sizeMax: size.max, durMin: dur.min, durMax: dur.max,
      licenses: C.lic.get(), rating: C.rating.get(), numRatings: C.numRatings.get().min, downloads: C.downloads.get().min,
      after: val('#f_after'), before: val('#f_before'),
      user: val('#f_user'), pack: val('#f_pack'), geo: C.geo.get() === 'true', remix: C.remix.get(), wasRemixed: C.wasRemixed.get(),
      bpmMin: bpm.min, bpmMax: bpm.max, note: C.note.get(), octave: C.octave.get(), noteConf: C.noteConf.get().min,
      keyRoot: C.keyRoot.get(), keyMode: C.keyMode.get(), loop: C.loop.get(), single: C.single.get(), reverb: C.reverb.get(), loudMin: C.loud.get().min,
      desc: readDescRows(),
      similarTo: val('#f_similarTo'), simSpace: val('#f_simSpace'),
      extra: val('#f_extra'), manual: $('#f_manual').checked, manualText: val('#f_manualText'),
      sortTarget: val('#f_sortTarget'), weights: val('#f_weights'),
    };
  }

  function writeFilters(f) {
    f = { ...defaultFilters(), ...(f || {}) };
    setVal('#f_exclude', f.exclude);
    chips.inc.set(f.tagsInc); chips.exc.set(f.tagsExc); C.tagsMode.set(f.tagsMode || 'all');
    setVal('#f_cat', f.category); fillSubcats(); setVal('#f_subcat', f.subcategory);
    C.types.set(f.types); C.channels.set(f.channels); C.sr.set(f.samplerates); C.bd.set(f.bitdepths);
    C.size.set(f.sizeMin, f.sizeMax); C.dur.set(f.durMin, f.durMax);
    C.lic.set(f.licenses); C.rating.set(f.rating); C.numRatings.set(f.numRatings); C.downloads.set(f.downloads);
    setVal('#f_after', f.after); setVal('#f_before', f.before);
    setVal('#f_user', f.user); setVal('#f_pack', f.pack); C.geo.set(f.geo ? 'true' : ''); C.remix.set(f.remix); C.wasRemixed.set(f.wasRemixed);
    C.bpm.set(f.bpmMin, f.bpmMax); C.note.set(f.note); C.octave.set(f.octave); C.noteConf.set(f.noteConf);
    C.keyRoot.set(f.keyRoot); C.keyMode.set(f.keyMode); C.loop.set(f.loop); C.single.set(f.single); C.reverb.set(f.reverb); C.loud.set(f.loudMin);
    $('#f_desc').innerHTML = '';
    (f.desc || []).forEach((d) => addDescRow(d));
    setVal('#f_similarTo', f.similarTo); setVal('#f_simSpace', f.simSpace);
    setVal('#f_extra', f.extra); $('#f_manual').checked = Boolean(f.manual); setVal('#f_manualText', f.manualText); $('#f_manualText').disabled = !f.manual;
    setVal('#f_sortTarget', f.sortTarget); setVal('#f_weights', f.weights);
    updateFilterPreview();
  }

  const filterResetEntries = [];

  function afterFilterReset() {
    updateFilterPreview();
    renderModeBanner();
    const presets = $('#filterPresets');
    if (presets) presets.value = '';
  }

  function createFilterResetButton(className, title) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.title = title;
    button.setAttribute('aria-label', title);
    button.innerHTML = ic('rotate-ccw', 'sm');
    return button;
  }

  function registerFilterReset(id, reset, { visible = true } = {}) {
    const target = $('#' + id);
    if (!target) return;
    const entry = { id, target, reset };
    filterResetEntries.push(entry);
    if (!visible) return;

    const button = createFilterResetButton('filter-reset-field', 'Сбросить поле к значению по умолчанию');
    button.dataset.resetTarget = id;
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      reset();
      afterFilterReset();
    });

    const label = target.closest('label');
    const previous = target.previousElementSibling;
    if (label && label.closest('#filterForm')) {
      label.classList.add('filter-reset-host');
      label.appendChild(button);
    } else if (previous && previous.classList.contains('ctl-label')) {
      previous.classList.add('filter-reset-label');
      previous.appendChild(button);
    } else if (target.parentElement && target.parentElement.classList.contains('range')) {
      button.classList.add('filter-reset-range');
      target.insertAdjacentElement('afterend', button);
    } else {
      const wrap = document.createElement('div');
      wrap.className = 'filter-reset-standalone';
      target.parentNode.insertBefore(wrap, target);
      wrap.appendChild(target);
      wrap.appendChild(button);
    }
  }

  function setupFilterResetButtons() {
    filterResetEntries.length = 0;

    registerFilterReset('f_exclude', () => setVal('#f_exclude', ''));
    registerFilterReset('f_tagsInc', () => chips.inc.set([]));
    registerFilterReset('c_tagsMode', () => C.tagsMode.set('all'));
    registerFilterReset('f_tagsExc', () => chips.exc.set([]));
    registerFilterReset('f_cat', () => { setVal('#f_cat', ''); fillSubcats(); });
    registerFilterReset('f_subcat', () => setVal('#f_subcat', ''));
    registerFilterReset('c_types', () => C.types.set([]));
    registerFilterReset('c_channels', () => C.channels.set(''));
    registerFilterReset('c_sr', () => C.sr.set([]));
    registerFilterReset('c_bd', () => C.bd.set([]));
    registerFilterReset('c_size', () => C.size.set('', ''));
    registerFilterReset('c_dur', () => C.dur.set('', ''));
    registerFilterReset('c_lic', () => C.lic.set([]));
    registerFilterReset('c_rating', () => C.rating.set(''));
    registerFilterReset('c_numRatings', () => C.numRatings.set(''));
    registerFilterReset('c_downloads', () => C.downloads.set(''));
    registerFilterReset('f_after', () => setVal('#f_after', ''));
    registerFilterReset('f_before', () => setVal('#f_before', ''));
    registerFilterReset('f_user', () => setVal('#f_user', ''));
    registerFilterReset('f_pack', () => setVal('#f_pack', ''));
    registerFilterReset('c_geo', () => C.geo.set(''));
    registerFilterReset('c_remix', () => C.remix.set(''));
    registerFilterReset('c_wasRemixed', () => C.wasRemixed.set(''));
    registerFilterReset('c_bpm', () => C.bpm.set('', ''));
    registerFilterReset('c_note', () => C.note.set(''));
    registerFilterReset('c_octave', () => C.octave.set(''));
    registerFilterReset('c_noteConf', () => C.noteConf.set(''));
    registerFilterReset('c_keyRoot', () => C.keyRoot.set(''));
    registerFilterReset('c_keyMode', () => C.keyMode.set(''));
    registerFilterReset('c_loop', () => C.loop.set(''));
    registerFilterReset('c_single', () => C.single.set(''));
    registerFilterReset('c_reverb', () => C.reverb.set(''));
    registerFilterReset('c_loud', () => C.loud.set(''));
    registerFilterReset('f_desc', () => { $('#f_desc').innerHTML = ''; }, { visible: false });
    registerFilterReset('f_similarTo', () => setVal('#f_similarTo', ''));
    registerFilterReset('f_simSpace', () => setVal('#f_simSpace', ''));
    registerFilterReset('f_extra', () => setVal('#f_extra', ''));
    registerFilterReset('f_manual', () => { $('#f_manual').checked = false; $('#f_manualText').disabled = true; });
    registerFilterReset('f_manualText', () => setVal('#f_manualText', ''));
    registerFilterReset('f_sortTarget', () => setVal('#f_sortTarget', ''));
    registerFilterReset('f_weights', () => setVal('#f_weights', ''));

    $$('#filterForm details.fgroup').forEach((section) => {
      const summary = section.querySelector(':scope > summary');
      if (!summary) return;
      summary.classList.add('filter-summary-reset-host');
      const button = createFilterResetButton('filter-reset-section', 'Сбросить всю секцию к значениям по умолчанию');
      button.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        filterResetEntries.forEach((entry) => {
          if (section.contains(entry.target)) entry.reset();
        });
        afterFilterReset();
      });
      summary.appendChild(button);
    });
  }

  function buildFilter(f) {
    if (f.manual) return f.manualText.trim();
    const p = [];
    const push = (s) => { if (s) p.push(s); };
    const orGroup = (field, vals) => (vals.length === 1 ? `${field}:${vals[0]}` : `${field}:(${vals.join(' OR ')})`);
    if (f.tagsInc.length) push(f.tagsMode === 'any' ? `tag:(${f.tagsInc.map(sq).join(' OR ')})` : f.tagsInc.map((t) => `tag:${sq(t)}`).join(' '));
    f.tagsExc.forEach((t) => push(`-tag:${sq(t)}`));
    if (f.category) push(`category:${sq(f.category)}`);
    if (f.subcategory) push(`subcategory:${sq(f.subcategory)}`);
    if (f.types.length) push(orGroup('type', f.types));
    if (f.channels === 'multi') push('channels:[3 TO *]'); else if (f.channels) push(`channels:${f.channels}`);
    if (f.samplerates && f.samplerates.length) push(orGroup('samplerate', f.samplerates));
    if (f.bitdepths && f.bitdepths.length) push(orGroup('bitdepth', f.bitdepths));
    const mb = (v) => (isNum(v) ? String(Math.round(Number(v) * 1048576)) : '');
    push(range('filesize', mb(f.sizeMin), mb(f.sizeMax)));
    push(range('duration', isNum(f.durMin) ? f.durMin : '', isNum(f.durMax) ? f.durMax : ''));
    if (f.licenses.length) push(`license:(${f.licenses.map(sq).join(' OR ')})`);
    if (f.rating) push(`avg_rating:[${f.rating} TO *]`);
    if (isNum(f.numRatings) && Number(f.numRatings) > 0) push(`num_ratings:[${f.numRatings} TO *]`);
    if (isNum(f.downloads) && Number(f.downloads) > 0) push(`num_downloads:[${f.downloads} TO *]`);
    if (f.after || f.before) push(`created:[${f.after ? f.after + 'T00:00:00Z' : '*'} TO ${f.before ? f.before + 'T23:59:59Z' : '*'}]`);
    if (f.user) push(`username:${sq(f.user)}`);
    if (f.pack) push(`pack:${sq(f.pack)}`);
    if (f.geo) push('is_geotagged:true');
    if (f.remix) push(`is_remix:${f.remix}`);
    if (f.wasRemixed) push(`was_remixed:${f.wasRemixed}`);
    push(range('bpm', isNum(f.bpmMin) ? f.bpmMin : '', isNum(f.bpmMax) ? f.bpmMax : ''));
    const octaves = [0, 1, 2, 3, 4, 5, 6, 7, 8];
    if (f.note && f.octave) push(`note_name:${sq(f.note + f.octave)}`);
    else if (f.note) push(`note_name:(${octaves.map((o) => sq(f.note + o)).join(' OR ')})`);
    else if (f.octave) push(`note_name:(${FS.NOTES.map((n) => sq(n + f.octave)).join(' OR ')})`);
    if (isNum(f.noteConf) && Number(f.noteConf) > 0) push(`note_confidence:[${f.noteConf} TO *]`);
    if (f.keyRoot && f.keyMode) push(`tonality:${sq(f.keyRoot + ' ' + f.keyMode)}`);
    else if (f.keyRoot) push(`tonality:(${sq(f.keyRoot + ' major')} OR ${sq(f.keyRoot + ' minor')})`);
    else if (f.keyMode) push(`tonality:(${FS.NOTES.map((n) => sq(n + ' ' + f.keyMode)).join(' OR ')})`);
    if (f.loop) push(`loopable:${f.loop}`);
    if (f.single) push(`single_event:${f.single}`);
    if (f.reverb) push(`reverbness:${f.reverb}`);
    if (isNum(f.loudMin)) push(`loudness:[${f.loudMin} TO *]`);
    (f.desc || []).forEach((d) => push(descToFilter(d)));
    if (f.extra && f.extra.trim()) push(f.extra.trim());
    return p.join(' ');
  }

  function buildQuery(query, f) {
    const words = (f.exclude || '').split(/[,\s]+/).map((w) => w.trim()).filter(Boolean).map((w) => (w.startsWith('-') ? w : '-' + w));
    return [query.trim(), ...words].filter(Boolean).join(' ');
  }

  function updateFilterPreview() {
    if (!C.dur) return;
    const f = readFilters();
    const s = buildFilter(f);
    $('#filterPreview').textContent = s || '—';
    $$('#filterForm .fgroup').forEach((g) => {
      const active = $$('input, select, textarea', g).some((el) => {
        if (el.type === 'range') return false;
        if (el.type === 'checkbox' || el.type === 'radio') return el.type === 'checkbox' && el.checked && el.id !== 'f_manual';
        if (el.closest('.chips') || el.closest('.drange')) return false;
        return el.value && el.value.trim() !== '' && !el.disabled;
      }) || $$('.chip-item, .segc.active, .drange.active, .stars.active', g).length > 0;
      g.querySelector('summary').classList.toggle('active-flag', active);
    });
  }

  // ------------------------------------------------------------------ search
  function currentParams(page) {
    const f = readFilters();
    const params = {
      query: buildQuery(S.query, f),
      filter: buildFilter(f),
      page,
      page_size: S.pageSize,
      fields: FS.RESULT_FIELDS + ',' + FS.RESULT_DESCRIPTOR_FIELDS.join(','),
    };
    if (S.groupByPack) params.group_by_pack = 1;
    if (f.sortTarget) params.sort = f.sortTarget;
    else if (S.sort && S.sort !== 'score') params.sort = S.sort;
    if (f.similarTo) { params.similar_to = f.similarTo; if (f.simSpace) params.similarity_space = f.simSpace; }
    if (f.weights) params.weights = f.weights;
    return params;
  }

  async function runSearch(page = 1, { pushHistory = true } = {}) {
    if (S.loading) return;
    S.page = page;
    const params = currentParams(page);
    S.loading = true;
    $('#searchBtn').disabled = true;
    $('#results').innerHTML = '<div class="loading">Ищу…</div>';
    $('#pager').innerHTML = '';
    try {
      const { data, headers } = await api('/search/', params);
      S.results = data;
      S.lastUrl = headers.get('x-fs-url') || '';
      S.injected = Number(headers.get('x-fs-blacklist-injected') || 0);
      renderResults();
      if (pushHistory && S.query.trim()) addHistory(S.query.trim());
      saveHash();
      refreshUsage();
    } catch (e) {
      S.results = null;
      const needsKey = e.status === 401;
      $('#results').innerHTML = `<div class="banner err">${esc(e.message)}${needsKey ? ' <button class="btn small primary" data-action="onboarding">Настроить доступ</button>' : ''}</div>`;
      $('#resultCount').textContent = '—';
    } finally {
      S.loading = false;
      $('#searchBtn').disabled = false;
      renderModeBanner();
      renderRequestBox();
    }
  }

  function renderModeBanner() {
    const f = readFilters();
    const b = $('#modeBanner');
    if (f.similarTo) {
      const s = S.soundCache.get(Number(f.similarTo));
      b.className = 'banner';
      b.innerHTML = `${ic('shuffle')} Похожие на <b>${s ? esc(s.name) : '#' + esc(f.similarTo)}</b> (id ${esc(f.similarTo)})${f.simSpace ? ', пространство ' + esc(f.simSpace) : ''} <button class="btn small ghost" data-action="clear-similar">выйти из режима</button>`;
    } else if (f.manual) {
      b.className = 'banner info';
      b.innerHTML = 'Ручной режим фильтра: используется только текст из поля «Ручной режим». <button class="btn small ghost" data-action="clear-manual">выключить</button>';
    } else {
      b.className = 'banner hidden';
      b.innerHTML = '';
    }
  }

  function renderRequestBox() {
    const box = $('#requestBox');
    if (box.classList.contains('hidden')) return;
    if (!S.lastUrl) { box.innerHTML = 'Запросов ещё не было.'; return; }
    box.innerHTML = `<b>GET</b> ${esc(S.lastUrl)}<br><span>записей чёрного списка в запросе: ${S.injected}</span> · <button class="linklike" data-action="copy-url">копировать URL</button>`;
  }

  function renderResults() {
    const data = S.results;
    const box = $('#results');
    if (!data) { box.innerHTML = ''; return; }
    const all = data.results || [];
    const visible = all.filter((s) => !hiddenReason(s));
    S.hidden = all.length - visible.length;
    S.currentList = visible.map((s) => s.id);
    $('#resultCount').textContent = `${fmtNum(data.count)} результатов` + (data.count ? ` · стр. ${S.page} из ${Math.max(1, Math.ceil(data.count / S.pageSize))}` : '');
    const hc = $('#hiddenCount');
    hc.classList.toggle('hidden', S.hidden === 0);
    hc.textContent = S.hidden ? `скрыто ${S.hidden} (чёрный список)` : '';
    if (!visible.length) {
      box.innerHTML = `<div class="empty"><h3>Ничего не найдено</h3>Попробуйте убрать часть фильтров или изменить запрос.</div>`;
    } else {
      box.innerHTML = visible.map((s) => cardHtml(s)).join('');
    }
    renderPager(data.count);
    markPlaying();
    markSelected();
  }

  function renderPager(count) {
    const pages = Math.max(1, Math.ceil((count || 0) / S.pageSize));
    const el = $('#pager');
    if (pages <= 1) { el.innerHTML = ''; return; }
    const cur = S.page;
    const set = new Set([1, pages, cur - 2, cur - 1, cur, cur + 1, cur + 2].filter((p) => p >= 1 && p <= pages));
    const list = Array.from(set).sort((a, b) => a - b);
    let html = `<button data-action="page" data-page="${cur - 1}" ${cur <= 1 ? 'disabled' : ''}>‹</button>`;
    let prev = 0;
    for (const p of list) {
      if (p - prev > 1) html += '<span>…</span>';
      html += `<button data-action="page" data-page="${p}" class="${p === cur ? 'active' : ''}">${p}</button>`;
      prev = p;
    }
    html += `<button data-action="page" data-page="${cur + 1}" ${cur >= pages ? 'disabled' : ''}>›</button>`;
    html += `<input type="number" id="pageJump" min="1" max="${pages}" placeholder="стр." title="Перейти на страницу (Enter)">`;
    el.innerHTML = html;
    $('#pageJump').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); const p = Number(e.target.value); if (p >= 1 && p <= pages) runSearch(p); } });
  }

  async function refreshUsage(force = false) {
    if (!force && Date.now() - S.usageAt < 30000) return;
    if (S.status && !S.status.hasApiKey && !S.status.oauth.connected && !S.status.mock) return;
    S.usageAt = Date.now();
    try {
      const { data } = await api('/usage/');
      const c = data.current || {};
      const b = c.burst || {};
      const sustained = c.sustained || {};
      const burstUsed = b.num ?? b.num_requests ?? '—';
      const burstLimit = b.limit ?? '—';
      const sustainedUsed = sustained.num ?? sustained.num_requests ?? '—';
      const sustainedLimit = sustained.limit ?? '—';
      const burstText = `${burstUsed} / ${burstLimit}`;
      const sustainedText = `${sustainedUsed} / ${sustainedLimit}`;
      if ($('#usageBurst')) $('#usageBurst').textContent = burstText;
      if ($('#usageSustained')) $('#usageSustained').textContent = sustainedText;
      if ($('#usageInfo')) $('#usageInfo').textContent = `Обновлено ${new Date().toLocaleTimeString()}`;
    } catch (e) {
      if ($('#usageInfo')) $('#usageInfo').textContent = 'Не удалось получить лимиты: ' + e.message;
    }
  }

  // ------------------------------------------------------------------ blacklist model
  function setBlacklist(bl) {
    BL.users = bl.users || []; BL.tags = bl.tags || []; BL.packs = bl.packs || []; BL.words = bl.words || [];
    BL.userSet = new Set(BL.users.map((u) => u.username.toLowerCase()));
    BL.tagSet = new Set(BL.tags.map((t) => t.tag.toLowerCase()));
    BL.packIds = new Set(BL.packs.map((p) => String(p.id)));
    BL.wordList = BL.words.map((w) => w.word.toLowerCase());
    const total = BL.users.length + BL.tags.length + BL.packs.length + BL.words.length;
    $('#blCount').textContent = total || '';
    if (S.tab === 'blacklist') renderBlacklist();
  }
  function isBlocked(username) { return BL.userSet.has(String(username || '').toLowerCase()); }
  function hiddenReason(s) {
    if (isBlocked(s.username)) return 'автор';
    if (s.tags && s.tags.some((t) => BL.tagSet.has(String(t).toLowerCase()))) return 'тег';
    const pid = packIdFrom(s.pack);
    if (pid && BL.packIds.has(pid)) return 'пак';
    if (BL.wordList.length) {
      const hay = `${s.name || ''} ${s.description || ''} ${(s.tags || []).join(' ')}`.toLowerCase();
      if (BL.wordList.some((w) => hay.includes(w))) return 'слово';
    }
    return null;
  }

  async function blockItem(kind, value, extra = {}) {
    value = String(value || '').trim();
    if (!value) return;
    try {
      const data = await local('/blacklist/add', 'POST', { kind, value, ...extra });
      setBlacklist(data);
      rerenderLists();
      const shown = extra.name || data.lastName || value;
      toast(`${cap(KIND[kind].label)} «${shown}» в чёрном списке`, { action: { label: 'Отменить', fn: () => unblockItem(kind, value, true) } });
    } catch (e) { toast(e.message, 'error'); }
  }

  async function unblockItem(kind, value, silent) {
    try {
      const data = await local('/blacklist/remove', 'POST', { kind, value });
      setBlacklist(data);
      rerenderLists();
      if (!silent) toast(`${cap(KIND[kind].label)} «${value}» убран из чёрного списка`);
    } catch (e) { toast(e.message, 'error'); }
  }

  // ------------------------------------------------------------------ cards
  function waveHtml(s) {
    const wave = s.images && (s.images.waveform_m || s.images.waveform_l);
    return `<div class="wave" data-action="play" title="Воспроизвести">${wave ? `<img class="wave-image" src="${esc(wave)}" alt="" loading="lazy">` : ''}<span class="play-ic">${ic('play')}</span></div>`;
  }

  function tagChip(t) {
    return `<span class="tag" data-action="tag" data-tag="${esc(t)}" title="Клик — искать с тегом, Alt+клик — исключить тег">${esc(t)}<button type="button" class="tag-ban" data-action="block-tag" data-tag="${esc(t)}" title="Тег «${esc(t)}» в чёрный список">${ic('ban')}</button></span>`;
  }

  function cardHtml(s) {
    S.soundCache.set(s.id, s);
    const isFav = S.favSet.has(s.id);
    const blocked = isBlocked(s.username);
    const selected = S.selectedId === s.id;
    const meta = [fmtDur(s.duration), s.type && s.type.toUpperCase(), s.samplerate && (s.samplerate / 1000).toString().replace('.', ',') + ' kHz', s.bitdepth ? s.bitdepth + ' bit' : '', chStr(s.channels), fmtSize(s.filesize)].filter(Boolean).join(' · ');
    const packId = packIdFrom(s.pack);
    const badges = [];
    if (s.bpm) badges.push(`<span class="dbadge ui-part ui-category" title="BPM">♩ ${esc(s.bpm)}</span>`);
    if (s.note_name) badges.push(`<span class="dbadge ui-part ui-category" title="Нота">${esc(s.note_name)}</span>`);
    if (s.tonality) badges.push(`<span class="dbadge ui-part ui-category" title="Тональность">${esc(s.tonality)}</span>`);
    if (s.loopable) badges.push('<span class="dbadge ui-part ui-category" title="Зацикливается">loop</span>');
    const q = previewQuality();
    return `<article class="card ${blocked ? 'blocked' : ''} ${selected ? 'selected' : ''}" data-id="${s.id}">
      <div class="card-media">
        <div class="ui-part ui-waveform">${waveHtml(s)}</div>
        <div class="card-media-actions">
          <button type="button" data-action="replay" class="media-btn replay" title="Проиграть заново">${ic('rotate-ccw')}<span>Replay</span></button>
          <button type="button" data-action="dl-preview" class="media-btn download" title="Скачать превью (${esc(q)})">${ic('download')}<span>Скачать</span></button>
        </div>
      </div>
      <div class="card-main">
        <div class="card-title"><a href="${esc(s.url || '#')}" data-action="detail" title="Подробнее (Ctrl+клик — открыть на сайте)">${esc(s.name)}</a></div>
        <div class="card-meta ui-part ui-technical">${esc(meta)}</div>
        <div class="card-sub">
          <span class="ui-part ui-author"><a href="#" data-action="author" data-user="${esc(s.username)}" class="author">${esc(s.username)}</a>
          ${blocked
            ? `<button type="button" class="icon-btn on" data-action="unblock-user" data-user="${esc(s.username)}" title="Убрать автора из чёрного списка">${ic('ban', 'sm')}</button>`
            : `<button type="button" class="icon-btn danger" data-action="block-user" data-user="${esc(s.username)}" title="Автора в чёрный список">${ic('ban', 'sm')}</button>`}</span>
          ${s.avg_rating ? `<span class="ui-part ui-rating" title="${esc(s.num_ratings)} оценок">${ic('star', 'sm')} ${Number(s.avg_rating).toFixed(1)}${s.num_ratings ? ` (${esc(s.num_ratings)})` : ''}</span>` : ''}
          ${s.num_downloads != null ? `<span class="ui-part ui-downloads" title="скачиваний">${ic('download', 'sm')} ${fmtNum(s.num_downloads)}</span>` : ''}
          ${s.num_comments ? `<span class="ui-part ui-comments" title="комментариев">${ic('comment', 'sm')} ${esc(s.num_comments)}</span>` : ''}
          ${s.license ? `<span class="lic ui-part ui-license ${licClass(s.license)}" title="${esc(s.license)}">${esc(licShort(s.license))}</span>` : ''}
          ${s.created ? `<span class="ui-part ui-date" title="дата загрузки">${esc(String(s.created).slice(0, 10))}</span>` : ''}
          ${packId ? `<span class="ui-part ui-pack"><a href="#" data-action="pack" data-pack="${packId}" title="Открыть пак">${ic('box', 'sm')} пак</a><button type="button" class="icon-btn mini danger" data-action="block-pack" data-pack="${packId}" title="Пак в чёрный список">${ic('ban')}</button></span>` : ''}
          ${s.category ? `<span class="cat ui-part ui-category">${esc(s.category)}${s.subcategory ? ' / ' + esc(s.subcategory) : ''}</span>` : ''}
          ${badges.join('')}
        </div>
        ${s.tags && s.tags.length ? `<div class="tags ui-part ui-tags">${s.tags.map(tagChip).join('')}</div>` : ''}
        ${s.description ? `<div class="desc ui-part ui-description">${esc(String(s.description).slice(0, 320))}</div>` : ''}
        ${s.n_from_same_pack ? `<div class="ui-part ui-pack"><a href="#" data-action="morepack" data-uri="${esc(s.more_from_same_pack)}">+${esc(s.n_from_same_pack)} из того же пака</a></div>` : ''}
      </div>
      <div class="card-actions ui-part ui-actions">
        <button type="button" data-action="fav" class="icon-btn heart ${isFav ? 'on' : ''}" title="${isFav ? 'Убрать из избранного' : 'В избранное'}">${ic('heart', '', isFav)}</button>
        <button type="button" data-action="rate" class="icon-btn" title="Оценить звук">${ic('star')}</button>
        <button type="button" data-action="comment" class="icon-btn" title="Написать комментарий">${ic('comment')}</button>
        <button type="button" data-action="dl-original" class="icon-btn" title="Скачать оригинал (нужен вход)">${ic('download')}<small>orig</small></button>
        <button type="button" data-action="similar" class="icon-btn" title="Похожие звуки">${ic('shuffle')}</button>
        <a href="${esc(s.url || '#')}" target="_blank" rel="noopener" class="icon-btn" title="Открыть на freesound.org">${ic('external')}</a>
      </div>
    </article>`;
  }

  function refreshCardsFor(id) {
    const s = S.soundCache.get(id);
    if (!s) return;
    $$(`.card[data-id="${id}"]`).forEach((el) => { el.outerHTML = cardHtml(s); });
    markPlaying();
  }

  function rerenderLists() {
    if (S.results) renderResults();
    if (S.tab === 'favorites') renderFavorites();
    $$('#modalBody .results').forEach((box) => {
      const ids = $('.card', box).map((c) => Number(c.dataset.id));
      box.innerHTML = ids.map((id) => S.soundCache.get(id)).filter(Boolean).map((s) => cardHtml(s)).join('');
    });
    markPlaying();
    markSelected();
  }

  function selectedSound() {
    return (S.selectedId && S.soundCache.get(S.selectedId)) || S.current || null;
  }

  function markSelected() {
    $$('.card.selected').forEach((card) => card.classList.remove('selected'));
    if (!S.selectedId) return;
    $$(`.card[data-id="${S.selectedId}"]`).forEach((card) => card.classList.add('selected'));
  }

  function selectSound(id, scroll = true) {
    const sound = S.soundCache.get(Number(id));
    if (!sound) return null;
    S.selectedId = sound.id;
    markSelected();
    if (scroll) {
      const card = document.querySelector(`.card[data-id="${sound.id}"]`);
      if (card) card.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
    return sound;
  }

  function moveSelection(dir) {
    if (!S.currentList.length) return null;
    let index = S.selectedId ? S.currentList.indexOf(S.selectedId) : -1;
    if (index < 0 && S.current) index = S.currentList.indexOf(S.current.id);
    index = Math.min(S.currentList.length - 1, Math.max(0, index < 0 ? (dir > 0 ? 0 : S.currentList.length - 1) : index + dir));
    return selectSound(S.currentList[index]);
  }

  // ------------------------------------------------------------------ context menu (instant blacklist)
  const ctx = $('#ctxmenu');
  function hideCtx() { ctx.classList.add('hidden'); ctx.innerHTML = ''; }
  function showCtx(x, y, sound) {
    const packId = packIdFrom(sound.pack);
    ctx.innerHTML = `<div class="cx-head">Скрыть навсегда</div>
      <button type="button" data-cx="user" data-v="${esc(sound.username)}">${ic('ban', 'sm')} Автора <b>${esc(sound.username)}</b></button>
      ${packId ? `<button type="button" data-cx="pack" data-v="${packId}">${ic('ban', 'sm')} Пак <b>#${packId}</b></button>` : ''}
      ${sound.tags && sound.tags.length ? `<div class="cx-sep"></div><div class="cx-head">Тег</div><div class="cx-tags">${sound.tags.slice(0, 24).map((t) => `<button type="button" data-cx="tag" data-v="${esc(t)}">${esc(t)}</button>`).join('')}</div>` : ''}
      <div class="cx-sep"></div>
      <button type="button" data-cx="word" data-v="">${ic('type', 'sm')} Слово или фразу…</button>`;
    ctx.classList.remove('hidden');
    const w = ctx.offsetWidth;
    const h = ctx.offsetHeight;
    ctx.style.left = Math.min(x, window.innerWidth - w - 8) + 'px';
    ctx.style.top = Math.min(y, window.innerHeight - h - 8) + 'px';
    ctx.dataset.id = sound.id;
  }
  document.addEventListener('contextmenu', (e) => {
    const card = e.target.closest('.card');
    if (!card) { hideCtx(); return; }
    const sound = S.soundCache.get(Number(card.dataset.id));
    if (!sound) return;
    e.preventDefault();
    showCtx(e.clientX, e.clientY, sound);
  });
  ctx.addEventListener('click', (e) => {
    const b = e.target.closest('[data-cx]');
    if (!b) return;
    const kind = b.dataset.cx;
    const sound = S.soundCache.get(Number(ctx.dataset.id));
    hideCtx();
    if (kind === 'word') {
      const suggestion = sound ? String(sound.name || '').replace(/\.[a-z0-9]{2,4}$/i, '').split(/\s+/)[0] : '';
      const w = prompt('Слово или фраза: звуки, где она встречается в названии, описании или тегах, будут скрыты', suggestion);
      if (w && w.trim()) blockItem('word', w.trim());
      return;
    }
    blockItem(kind, b.dataset.v);
  });
  document.addEventListener('click', (e) => { if (!ctx.contains(e.target)) hideCtx(); });
  window.addEventListener('blur', hideCtx);

  // ------------------------------------------------------------------ player
  const audio = $('#audio');
  function previewQuality() { return (S.settings && S.settings.previewQuality) || 'hq-mp3'; }
  function previewUrl(s) {
    if (!s || !s.previews) return null;
    return s.previews['preview-' + previewQuality()] || s.previews['preview-hq-mp3'] || s.previews['preview-lq-mp3'] || s.previews['preview-hq-ogg'] || s.previews['preview-lq-ogg'];
  }

  function playSound(s) {
    if (S.current && S.current.id === s.id) { togglePlay(); return; }
    const url = previewUrl(s);
    if (!url) { toast('У этого звука нет превью', 'error'); return; }
    S.current = s;
    audio.src = url;
    audio.play().catch((err) => toast('Не удалось воспроизвести: ' + err.message, 'error'));
    renderPlayer();
    markPlaying();
  }

  function togglePlay() {
    if (!S.current) { if (S.currentList.length) playSound(S.soundCache.get(S.currentList[0])); return; }
    if (audio.paused) audio.play().catch(() => {}); else audio.pause();
  }

  function replaySound(s) {
    if (!s) return;
    if (!S.current || S.current.id !== s.id) {
      playSound(s);
      return;
    }
    audio.currentTime = 0;
    audio.play().catch((err) => toast('Не удалось воспроизвести: ' + err.message, 'error'));
  }

  function playNext(dir = 1) {
    if (!S.current || !S.currentList.length) return;
    const i = S.currentList.indexOf(S.current.id);
    const next = S.currentList[i + dir];
    if (next != null) playSound(S.soundCache.get(next));
  }

  function renderPlayer() {
    const s = S.current;
    const p = $('#player');
    p.classList.toggle('empty', !s);
    if (!s) return;
    $('#pTitle').textContent = s.name;
    $('#pTitle').href = s.url || '#';
    $('#pTitle').dataset.id = s.id;
    $('#pSub').textContent = `${s.username} · ${fmtDur(s.duration)} · ${licShort(s.license)}`;
    const wave = s.images && (s.images.waveform_l || s.images.waveform_m);
    const image = wave ? cssUrl(wave) : 'none';
    $('#pWaveBase').style.backgroundImage = image;
    $('#pWaveProg').style.backgroundImage = image;
    setProgress(0);
    const isFav = S.favSet.has(s.id);
    $('#pActions').innerHTML = `<span data-id="${s.id}">
      <button type="button" data-action="fav" class="icon-btn heart ${isFav ? 'on' : ''}" title="В избранное">${ic('heart', '', isFav)}</button>
      <button type="button" data-action="dl-preview" class="icon-btn" title="Скачать превью">${ic('download')}</button>
      <button type="button" data-action="dl-original" class="icon-btn" title="Скачать оригинал">${ic('download')}<small>orig</small></button>
      <button type="button" data-action="similar" class="icon-btn" title="Похожие">${ic('shuffle')}</button>
      <button type="button" data-action="block-user" data-user="${esc(s.username)}" class="icon-btn danger" title="Автора в чёрный список">${ic('ban')}</button>
    </span>`;
  }

  function setProgress(pct) {
    $('#pWaveProg').style.clipPath = `inset(0 ${100 - pct}% 0 0)`;
    $('#pHead').style.left = pct + '%';
  }

  function markPlaying() {
    const id = S.current ? S.current.id : null;
    const playing = S.current && !audio.paused;
    $$('.card').forEach((c) => {
      const on = Number(c.dataset.id) === id;
      c.classList.toggle('playing', on);
      const icn = c.querySelector('.play-ic');
      if (icn) icn.innerHTML = ic(on && playing ? 'pause' : 'play');
    });
    $('#pPlay').innerHTML = ic(playing ? 'pause' : 'play');
  }

  audio.addEventListener('timeupdate', () => {
    const d = audio.duration || (S.current && S.current.duration) || 0;
    setProgress(d ? Math.min(100, (audio.currentTime / d) * 100) : 0);
    $('#pTime').textContent = `${fmtClock(audio.currentTime)} / ${fmtClock(d)}`;
  });
  audio.addEventListener('play', markPlaying);
  audio.addEventListener('pause', markPlaying);
  audio.addEventListener('ended', () => { if (!audio.loop && S.autoNext) playNext(1); else markPlaying(); });
  audio.addEventListener('error', () => { if (S.current) toast('Ошибка загрузки аудио', 'error'); });

  $('#pPlay').addEventListener('click', togglePlay);
  $('#pWave').addEventListener('click', (e) => {
    if (!S.current) return;
    const r = e.currentTarget.getBoundingClientRect();
    const d = audio.duration || S.current.duration || 0;
    if (d) audio.currentTime = ((e.clientX - r.left) / r.width) * d;
  });
  $('#pReplay').addEventListener('click', () => {
    if (!S.current) return;
    audio.currentTime = 0;
    audio.play().catch((err) => toast('Не удалось воспроизвести: ' + err.message, 'error'));
  });
  $('#pLoop').addEventListener('click', () => { S.loop = !S.loop; audio.loop = S.loop; $('#pLoop').classList.toggle('on', S.loop); });
  $('#pAuto').addEventListener('click', () => { S.autoNext = !S.autoNext; localStorage.setItem('fs_autonext', S.autoNext ? '1' : '0'); $('#pAuto').classList.toggle('on', S.autoNext); });
  $('#pAuto').classList.toggle('on', S.autoNext);
  $('#pVol').value = localStorage.getItem('fs_vol') || '0.8';
  audio.volume = Number($('#pVol').value);
  $('#pVol').addEventListener('input', (e) => { audio.volume = Number(e.target.value); localStorage.setItem('fs_vol', e.target.value); });

  // ------------------------------------------------------------------ modal
  function openModal(html, { narrow = false } = {}) {
    $('#modalBox').classList.toggle('narrow', narrow);
    $('#modalBody').innerHTML = html;
    $('#modal').classList.remove('hidden');
    $('#modal').scrollTop = 0;
  }
  function closeModal() { $('#modal').classList.add('hidden'); $('#modalBody').innerHTML = ''; }
  $('#modalClose').addEventListener('click', closeModal);
  $('#modal').addEventListener('click', (e) => { if (e.target === $('#modal')) closeModal(); });

  const errorHtml = (e) => `<div class="banner err">${esc(e.message)}</div>`;

  async function submitRating(sound, rating) {
    if (!sound) return;
    try {
      await api(`/sounds/${sound.id}/rate/`, {}, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ rating: Number(rating) }),
      });
      const count = Number(sound.num_ratings || 0);
      const average = Number(sound.avg_rating || 0);
      sound.avg_rating = count > 0 ? ((average * count) + Number(rating)) / (count + 1) : Number(rating);
      sound.num_ratings = count + 1;
      refreshCardsFor(sound.id);
      toast(`Оценка ${rating}/5 отправлена`, 'ok');
    } catch (e) { toast(e.message, 'error'); }
  }

  function openRating(sound) {
    if (!sound) return;
    openModal(`<div class="quick-action-modal" data-id="${sound.id}">
      <h2>Оценить «${esc(sound.name)}»</h2>
      <div class="rating-buttons">${[1, 2, 3, 4, 5].map((rating) => `<button type="button" class="btn rating-choice" data-action="rate-value" data-rating="${rating}">${ic('star')} ${rating}</button>`).join('')}</div>
      <p class="hint">Freesound не позволяет изменить оценку повторно: повторная оценка того же звука вернёт конфликт.</p>
    </div>`, { narrow: true });
  }

  function openComment(sound) {
    if (!sound) return;
    openModal(`<form id="quickCommentForm" class="quick-action-modal" data-id="${sound.id}">
      <h2>Комментарий к «${esc(sound.name)}»</h2>
      <textarea id="quickCommentText" rows="6" required placeholder="Комментарий"></textarea>
      <div class="row"><button type="submit" class="btn primary">Отправить</button><button type="button" class="btn ghost" data-action="close-modal">Отмена</button></div>
    </form>`, { narrow: true });
    $('#quickCommentText').focus();
    $('#quickCommentForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      const comment = val('#quickCommentText').trim();
      if (!comment) return;
      try {
        await api(`/sounds/${sound.id}/comment/`, {}, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ comment }),
        });
        sound.num_comments = Number(sound.num_comments || 0) + 1;
        refreshCardsFor(sound.id);
        closeModal();
        toast('Комментарий отправлен', 'ok');
      } catch (e) { toast(e.message, 'error'); }
    });
  }

  async function openDetail(id) {
    openModal('<div class="loading">Загрузка…</div>');
    try {
      const { data } = await api(`/sounds/${id}/`);
      const cached = S.soundCache.get(Number(id)) || {};
      const s = { ...cached, ...data };
      S.soundCache.set(s.id, s);
      const isFav = S.favSet.has(s.id);
      const blocked = isBlocked(s.username);
      const packId = packIdFrom(s.pack);
      const kv = [
        ['ID', s.id], ['Автор', `<a href="#" data-action="author" data-user="${esc(s.username)}">${esc(s.username)}</a>`],
        ['Длительность', fmtDur(s.duration)], ['Формат', `${(s.type || '').toUpperCase()} · ${s.samplerate ? s.samplerate + ' Hz' : ''} · ${s.bitdepth ? s.bitdepth + ' bit' : ''} · ${chStr(s.channels)} · ${fmtSize(s.filesize)}`],
        ['Лицензия', `<span class="lic ${licClass(s.license)}">${esc(licShort(s.license))}</span> ${esc(s.license)}`],
        ['Загружен', String(s.created || '').replace('T', ' ').slice(0, 16)],
        ['Категория', s.category ? `${esc(s.category)}${s.subcategory ? ' / ' + esc(s.subcategory) : ''}${s.category_is_user_provided === false ? ' <small>(автоматически)</small>' : ''}` : '—'],
        ['Рейтинг', s.avg_rating ? `${Number(s.avg_rating).toFixed(2)} (${s.num_ratings} оценок)` : 'нет оценок'],
        ['Скачиваний', fmtNum(s.num_downloads)], ['Комментариев', fmtNum(s.num_comments)],
        ['Пак', packId ? `<a href="#" data-action="pack" data-pack="${packId}">открыть пак #${packId}</a>` : '—'],
        ['Геотег', s.geotag || '—'], ['Ремикс', s.is_remix ? 'да' : 'нет'], ['MD5', `<code>${esc(s.md5 || '')}</code>`],
        ['gen-AI', esc(s.gen_ai_preference || '—')],
      ];
      openModal(`<div data-id="${s.id}">
        <h2>${esc(s.name)}</h2>
        <div class="row">
          <button class="btn small primary" data-action="play">${ic('play')} Играть</button>
          <button class="btn small ghost ${isFav ? 'on' : ''}" data-action="fav">${ic('heart', '', isFav)} ${isFav ? 'В избранном' : 'В избранное'}</button>
          <button class="btn small ghost" data-action="dl-preview">${ic('download')} Превью</button>
          <button class="btn small ghost" data-action="dl-original">${ic('download')} Оригинал</button>
          <button class="btn small ghost" data-action="similar">${ic('shuffle')} Похожие</button>
          ${blocked ? `<button class="btn small danger" data-action="unblock-user" data-user="${esc(s.username)}">${ic('ban')} Убрать автора из ЧС</button>` : `<button class="btn small ghost" data-action="block-user" data-user="${esc(s.username)}">${ic('ban')} Автора в ЧС</button>`}
          <a class="btn small ghost" href="${esc(s.url)}" target="_blank" rel="noopener">${ic('external')} freesound.org</a>
        </div>
        ${s.images && s.images.spectral_l ? `<img class="spectro" src="${esc(s.images.spectral_l)}" alt="спектрограмма" loading="lazy">` : ''}
        ${s.images && s.images.waveform_l ? `<div class="detail-wave"><img class="detail-wave-image" src="${esc(s.images.waveform_l)}" alt="" loading="lazy"></div>` : ''}
        <dl class="kv">${kv.map(([k, v]) => `<dt>${k}</dt><dd>${v ?? '—'}</dd>`).join('')}</dl>
        ${s.tags && s.tags.length ? `<div class="tags">${s.tags.map(tagChip).join('')}</div>` : ''}
        <div class="fulldesc">${linkify(s.description || '')}</div>
        <details class="plain" id="dAnalysisBox"><summary>Аудио-анализ (дескрипторы)</summary><div id="dAnalysis" class="loading">Загрузка…</div></details>
        <h3>Комментарии</h3><div id="dComments" class="loading">Загрузка…</div>
      </div>`);
      const det = $('#dAnalysisBox');
      det.addEventListener('toggle', async () => {
        if (!det.open || det.dataset.loaded) return;
        det.dataset.loaded = '1';
        try {
          const { data } = await api(`/sounds/${id}/analysis/`);
          const entries = Object.entries(data).filter(([, v]) => !Array.isArray(v)).sort();
          $('#dAnalysis').className = 'analysis-grid';
          $('#dAnalysis').innerHTML = entries.length ? entries.map(([k, v]) => `<span>${esc(k)}</span><span>${esc(typeof v === 'number' ? +v.toFixed(4) : v)}</span>`).join('') : 'Анализ недоступен';
        } catch (e) { $('#dAnalysis').className = ''; $('#dAnalysis').innerHTML = errorHtml(e); }
      }, { once: true });
      api(`/sounds/${id}/comments/`, { page_size: 30 }).then(({ data }) => {
        const c = $('#dComments'); if (!c) return;
        c.className = '';
        c.innerHTML = data.results && data.results.length ? data.results.map((x) => `<div class="comment"><div class="who"><a href="#" data-action="author" data-user="${esc(x.username)}">${esc(x.username)}</a> · ${esc(String(x.created).replace('T', ' ').slice(0, 16))}</div>${linkify(x.comment)}</div>`).join('') : '<span class="hint">Комментариев нет</span>';
      }).catch((e) => { const c = $('#dComments'); if (c) { c.className = ''; c.innerHTML = errorHtml(e); } });
    } catch (e) { openModal(errorHtml(e)); }
  }

  const avatarHtml = (avatar, name, cls = 'avatar') => (avatar ? `<img class="${cls}" src="${esc(avatar)}" alt="">` : `<span class="${cls}">${esc(String(name || '?').slice(0, 1).toUpperCase())}</span>`);

  async function openAuthor(username, page = 1) {
    openModal('<div class="loading">Загрузка…</div>');
    try {
      const enc = encodeURIComponent(username);
      const [{ data: u }, { data: list }] = await Promise.all([
        api(`/users/${enc}/`),
        api(`/users/${enc}/sounds/`, { fields: FS.RESULT_FIELDS, page, page_size: 15 }),
      ]);
      const blocked = isBlocked(u.username);
      const pages = Math.max(1, Math.ceil((list.count || 0) / 15));
      list.results.forEach((s) => S.soundCache.set(s.id, s));
      openModal(`<div class="author-head">
          ${avatarHtml(u.avatar && u.avatar.medium, u.username)}
          <div>
            <h2>${esc(u.username)} ${blocked ? '<span class="lic nc">в чёрном списке</span>' : ''}</h2>
            <div class="hint">На Freesound с ${esc(String(u.date_joined || '').slice(0, 10))} · звуков: ${fmtNum(u.num_sounds)} · паков: ${fmtNum(u.num_packs)} · комментариев: ${fmtNum(u.num_comments)}</div>
          </div>
        </div>
        <div class="row">
          ${blocked ? `<button class="btn small danger" data-action="unblock-user" data-user="${esc(u.username)}">${ic('ban')} Убрать из чёрного списка</button>` : `<button class="btn small ghost" data-action="block-user" data-user="${esc(u.username)}">${ic('ban')} В чёрный список</button>`}
          <button class="btn small ghost" data-action="search-author" data-user="${esc(u.username)}">${ic('search')} Искать только у этого автора</button>
          <a class="btn small ghost" href="${esc(u.url)}" target="_blank" rel="noopener">${ic('external')} профиль на freesound.org</a>
          ${u.homepage ? `<a class="btn small ghost" href="${esc(u.homepage)}" target="_blank" rel="noopener">сайт автора</a>` : ''}
        </div>
        ${u.about ? `<div class="fulldesc" style="max-height:120px">${linkify(u.about)}</div>` : ''}
        <h3>Звуки (${fmtNum(list.count)})</h3>
        <div class="results list">${list.results.map((s) => cardHtml(s)).join('')}</div>
        <div class="pager">
          <button data-action="author-page" data-user="${esc(u.username)}" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>‹</button>
          <span>${page} / ${pages}</span>
          <button data-action="author-page" data-user="${esc(u.username)}" data-page="${page + 1}" ${page >= pages ? 'disabled' : ''}>›</button>
        </div>`);
      markPlaying();
    } catch (e) { openModal(errorHtml(e)); }
  }

  async function openPack(packId, page = 1) {
    openModal('<div class="loading">Загрузка…</div>');
    try {
      const [{ data: p }, { data: list }] = await Promise.all([
        api(`/packs/${packId}/`),
        api(`/packs/${packId}/sounds/`, { fields: FS.RESULT_FIELDS, page, page_size: 30 }),
      ]);
      const pages = Math.max(1, Math.ceil((list.count || 0) / 30));
      const visible = list.results.filter((s) => !hiddenReason(s));
      const blocked = BL.packIds.has(String(packId));
      openModal(`<h2>${ic('box')} ${esc(p.name)} ${blocked ? '<span class="lic nc">в чёрном списке</span>' : ''}</h2>
        <div class="hint">Автор: <a href="#" data-action="author" data-user="${esc(p.username)}">${esc(p.username)}</a> · звуков: ${fmtNum(p.num_sounds)} · скачиваний: ${fmtNum(p.num_downloads)} · создан ${esc(String(p.created || '').slice(0, 10))}</div>
        <div class="row">
          ${blocked ? `<button class="btn small danger" data-action="unblock-pack" data-pack="${packId}">${ic('ban')} Убрать пак из ЧС</button>` : `<button class="btn small ghost" data-action="block-pack" data-pack="${packId}" data-name="${esc(p.name)}">${ic('ban')} Пак в чёрный список</button>`}
          <button class="btn small ghost" data-action="search-pack" data-pack="${esc(p.name)}">${ic('search')} Искать по названию пака</button>
          <a class="btn small ghost" href="${esc(p.url)}" target="_blank" rel="noopener">${ic('external')} пак на freesound.org</a>
        </div>
        ${p.description ? `<div class="fulldesc" style="max-height:120px">${linkify(p.description)}</div>` : ''}
        <div class="results list">${visible.map((s) => cardHtml(s)).join('')}</div>
        ${pages > 1 ? `<div class="pager">
          <button data-action="pack-page" data-pack="${packId}" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>‹</button><span>${page} / ${pages}</span>
          <button data-action="pack-page" data-pack="${packId}" data-page="${page + 1}" ${page >= pages ? 'disabled' : ''}>›</button></div>` : ''}`);
      markPlaying();
    } catch (e) { openModal(errorHtml(e)); }
  }

  async function openMoreFromPack(uri) {
    openModal('<div class="loading">Загрузка…</div>');
    try {
      const u = new URL(uri);
      const params = Object.fromEntries(u.searchParams.entries());
      params.fields = FS.RESULT_FIELDS;
      params.page_size = 50;
      const { data } = await api(u.pathname.replace(/^\/apiv2/, ''), params);
      const visible = (data.results || []).filter((s) => !hiddenReason(s));
      openModal(`<h2>Звуки из того же пака (${fmtNum(data.count)})</h2><div class="results list">${visible.map((s) => cardHtml(s)).join('')}</div>`);
      markPlaying();
    } catch (e) { openModal(errorHtml(e)); }
  }

  // ------------------------------------------------------------------ auth: user block, login popup, onboarding
  function renderUserBlock() {
    const box = $('#userBlock');
    const o = S.status && S.status.oauth;
    if (o && o.connected) {
      box.innerHTML = `<button type="button" class="userbtn" id="userBtn">${avatarHtml(o.avatar, o.username)}<span>${esc(o.username || 'Freesound')}</span>${ic('chevron-down', 'sm')}</button>
        <div class="umenu hidden" id="userMenu">
          <div class="uinfo">Вход через Freesound · токен до ${o.expiresAt ? esc(new Date(o.expiresAt).toLocaleString('ru-RU')) : '?'}</div>
          <button type="button" data-action="author" data-user="${esc(o.username || '')}">${ic('user')} Мои звуки</button>
          <button type="button" data-action="goto-settings">${ic('sliders')} Настройки</button>
          <button type="button" data-action="logout">${ic('log-out')} Выйти</button>
        </div>`;
      $('#userBtn').addEventListener('click', (e) => { e.stopPropagation(); $('#userMenu').classList.toggle('hidden'); });
    } else {
      box.innerHTML = `<button type="button" class="btn small primary" data-action="login">${ic('log-in')} Войти</button>`;
    }
  }
  document.addEventListener('click', () => { const m = $('#userMenu'); if (m) m.classList.add('hidden'); });

  function hasCredentials() { return Boolean(S.settings && S.settings.clientId && S.settings.clientSecret); }

  async function saveCredentials(clientId, clientSecret) {
    S.settings = await local('/settings', 'PUT', { clientId, clientSecret, apiKey: clientSecret });
    await loadStatus();
  }

  function openOAuthPopup() {
    const w = window.open('/oauth/start', 'fs_oauth', 'width=640,height=780,menubar=no,toolbar=no,location=yes,status=no');
    if (!w) { location.href = '/oauth/start'; return; }
    toast('Открыто окно входа Freesound. Разрешите доступ приложению.', { timeout: 6000 });
  }

  async function startLogin() {
    if (!hasCredentials()) { openOnboarding(); return; }
    openOAuthPopup();
  }

  function openOnboarding() {
    const s = S.settings || {};
    const redirect = (S.status && S.status.redirectUri) || '';
    openModal(`<h2>Подключение к Freesound</h2>
      <p class="hint">Freesound требует собственный ключ для каждого приложения. Это делается один раз и занимает минуту.</p>
      <div class="steps">
        <div class="step"><div>
          <b>Создайте ключ API</b>
          <div class="hint">Откройте <a href="https://freesound.org/apiv2/apply" target="_blank" rel="noopener">freesound.org/apiv2/apply</a> (нужен аккаунт Freesound) и заполните форму «Create new API credentials»:</div>
          <ul class="hint plain-list">
            <li><b>Name</b> — любое, например FreesoundApp</li>
            <li><b>URL</b> — можно оставить пустым</li>
            <li><b>Callback URL</b> — вставьте: <span class="copyline"><span>${esc(redirect)}</span><button type="button" class="icon-btn" data-action="copy-text" data-text="${esc(redirect)}" title="Скопировать">${ic('copy')}</button></span></li>
            <li><b>Description</b> — пара слов о том, зачем ключ (обязательное поле)</li>
            <li>отметьте согласие с terms of use и нажмите <b>Request new access credentials</b></li>
          </ul>
          <div class="hint">Ключ выдаётся сразу: на странице появятся Client ID и Client secret / Api key.</div>
        </div></div>
        <div class="step"><div>
          <b>Вставьте Client ID и Client secret / API key</b>
          <label>Client ID <input type="text" id="ob_clientId" value="${esc(s.clientId || '')}" autocomplete="off" spellcheck="false"></label>
          <label>Client secret / API key <input type="text" id="ob_clientSecret" value="${esc(s.clientSecret || '')}" autocomplete="off" spellcheck="false"></label>
        </div></div>
        <div class="step"><div>
          <b>Войдите</b>
          <div class="hint">Откроется окно Freesound: подтвердите доступ. Вход нужен для скачивания оригиналов (wav/flac); поиск и превью работают и без него.</div>
          <div class="row">
            <button type="button" class="btn primary" data-action="ob-login">${ic('log-in')} Сохранить и войти</button>
            <button type="button" class="btn ghost" data-action="ob-save">Сохранить без входа</button>
          </div>
        </div></div>
      </div>
      <details class="plain"><summary>Freesound показал код вместо перенаправления</summary>
        <p class="hint">Так бывает, если в Callback URL указан <code>http://freesound.org/home/app_permissions/permission_granted/</code>. Скопируйте код со страницы Freesound и вставьте сюда.</p>
        <div class="row"><input type="text" id="ob_code" placeholder="код авторизации"><button type="button" class="btn small ghost" data-action="ob-code">Обменять код</button></div>
      </details>`, { narrow: true });
    $('#ob_clientId').focus();
  }

  async function onboardingSave(login) {
    const clientId = val('#ob_clientId');
    const clientSecret = val('#ob_clientSecret');
    if (!clientId || !clientSecret) { toast('Заполните оба поля', 'error'); return; }
    try {
      await saveCredentials(clientId, clientSecret);
      if (login) { openOAuthPopup(); } else { closeModal(); toast('Ключи сохранены, можно искать', 'ok'); }
      if (S.tab === 'settings') { fillSettingsForm(); renderAuthStatus(); }
    } catch (e) { toast(e.message, 'error'); }
  }

  async function exchangeManualCode(code) {
    if (!code) { toast('Введите код', 'error'); return; }
    try {
      const r = await local('/oauth/manual', 'POST', { code });
      await loadStatus();
      closeModal();
      toast(`Вход выполнен: ${r.username || 'Freesound'}`, 'ok');
      if (S.tab === 'settings') renderAuthStatus();
    } catch (e) { toast(e.message, 'error'); }
  }

  async function onOAuthResult(data) {
    await loadStatus();
    if (data.ok) {
      toast(`Вход выполнен${S.status.oauth.username ? ': ' + S.status.oauth.username : ''}`, 'ok');
      if ($('#ob_clientId')) closeModal();
    } else {
      toast('Вход не удался: ' + (data.error || 'неизвестная ошибка'), 'error');
    }
    if (S.tab === 'settings') renderAuthStatus();
  }
  window.addEventListener('message', (e) => {
    if (!e.data || e.data.type !== 'fs-oauth') return;
    onOAuthResult(e.data);
  });

  async function logout() {
    await local('/oauth/logout', 'POST', {});
    await loadStatus();
    toast('Вы вышли из аккаунта');
    if (S.tab === 'settings') renderAuthStatus();
  }

  // ------------------------------------------------------------------ blacklist page
  function blItems(kind) { return kind === 'user' ? BL.users : kind === 'tag' ? BL.tags : kind === 'pack' ? BL.packs : BL.words; }
  function blValue(kind, item) { return kind === 'user' ? item.username : kind === 'tag' ? item.tag : kind === 'pack' ? String(item.id) : item.word; }

  function renderBlacklist() {
    const kind = S.blKind;
    if (C.blKind) {
      C.blKind.el.querySelectorAll('button').forEach((b) => {
        const k = b.dataset.v;
        b.innerHTML = `${KIND[k].plural} <span class="badge">${blItems(k).length || ''}</span>`;
      });
    }
    $('#blValue').placeholder = KIND[kind].placeholder;
    $('#blColName').textContent = cap(KIND[kind].label);
    const q = val('#blFilter').toLowerCase();
    const items = blItems(kind);
    const rows = items.filter((it) => !q || JSON.stringify(it).toLowerCase().includes(q));
    const total = BL.users.length + BL.tags.length + BL.packs.length + BL.words.length;
    $('#blInfo').textContent = `${items.length} в разделе · ${total} всего` + (S.status && S.status.blacklistServerSide ? '' : ' · фильтрация только на клиенте');
    const cell = (it) => {
      if (kind === 'user') return `<a href="#" data-action="author" data-user="${esc(it.username)}">${esc(it.username)}</a>`;
      if (kind === 'tag') return `<span class="tag" data-action="tag" data-tag="${esc(it.tag)}">${esc(it.tag)}</span>`;
      if (kind === 'pack') return `<a href="#" data-action="pack" data-pack="${esc(it.id)}">${esc(it.name || '#' + it.id)}</a> <span class="bl-kind-note">#${esc(it.id)}${it.name ? '' : ' · имя не загружено, скрывается только на клиенте'}</span>`;
      return `<b>${esc(it.word)}</b> <span class="bl-kind-note">в названии, описании или тегах</span>`;
    };
    $('#blTable tbody').innerHTML = rows.length ? rows.map((it) => `<tr data-v="${esc(blValue(kind, it))}">
        <td>${cell(it)}</td>
        <td><input class="note" value="${esc(it.note || '')}" placeholder="заметка"></td>
        <td class="hint">${it.added ? esc(new Date(it.added).toLocaleDateString('ru-RU')) : ''}</td>
        <td class="actions"><button class="btn small ghost" data-action="bl-remove" data-kind="${kind}" data-v="${esc(blValue(kind, it))}">Убрать</button></td>
      </tr>`).join('') : `<tr><td colspan="4" class="hint">Раздел пуст. ${kind === 'user' ? 'Нажмите значок запрета рядом с автором в результатах.' : kind === 'tag' ? 'Наведите на тег в карточке и нажмите значок запрета.' : kind === 'pack' ? 'Нажмите значок запрета рядом со ссылкой на пак.' : 'Правый клик по карточке → «Слово или фразу…».'}</td></tr>`;
    $$('#blTable input.note').forEach((inp) => {
      inp.addEventListener('change', async () => {
        const value = inp.closest('tr').dataset.v;
        try { const data = await local('/blacklist/note', 'POST', { kind, value, note: inp.value }); setBlacklist(data); } catch (e) { toast(e.message, 'error'); }
      });
    });
  }

  // ------------------------------------------------------------------ favorites / downloads
  function setFavorites(sounds) {
    S.favorites = sounds || [];
    S.favSet = new Set(S.favorites.map((s) => s.id));
    S.favorites.forEach((s) => { if (!S.soundCache.has(s.id)) S.soundCache.set(s.id, s); });
    $('#favCount').textContent = S.favorites.length || '';
  }

  async function toggleFav(s) {
    const snap = {};
    ['id', 'name', 'username', 'tags', 'license', 'duration', 'type', 'samplerate', 'bitdepth', 'channels', 'filesize', 'created', 'avg_rating', 'num_ratings', 'num_downloads', 'num_comments', 'previews', 'images', 'pack', 'url', 'description', 'category', 'subcategory'].forEach((k) => { if (s[k] !== undefined) snap[k] = s[k]; });
    try {
      const r = await local('/favorites/toggle', 'POST', { sound: snap });
      if (r.isFav) S.favorites.unshift({ ...snap, added: new Date().toISOString() });
      else S.favorites = S.favorites.filter((x) => x.id !== s.id);
      setFavorites(S.favorites);
      refreshCardsFor(s.id);
      if (S.current && S.current.id === s.id) renderPlayer();
      if (S.tab === 'favorites') renderFavorites();
      const detailBtn = $(`#modalBody [data-id="${s.id}"] > .row [data-action="fav"]`);
      if (detailBtn) { detailBtn.innerHTML = `${ic('heart', '', r.isFav)} ${r.isFav ? 'В избранном' : 'В избранное'}`; detailBtn.classList.toggle('on', r.isFav); }
      toast(r.isFav ? 'Добавлено в избранное' : 'Убрано из избранного', { timeout: 1500 });
    } catch (e) { toast(e.message, 'error'); }
  }

  function renderFavorites() {
    const q = val('#favFilter').toLowerCase();
    const list = S.favorites.filter((s) => !q || s.name.toLowerCase().includes(q) || s.username.toLowerCase().includes(q) || (s.tags || []).some((t) => t.includes(q)));
    S.currentList = list.map((s) => s.id);
    $('#favList').className = 'results ' + S.view;
    $('#favList').innerHTML = list.length ? list.map((s) => cardHtml(s)).join('') : '<div class="empty"><h3>Избранного пока нет</h3>Нажмите на сердечко у любого звука.</div>';
    markPlaying();
    markSelected();
  }

  async function download(s, kind) {
    const label = kind === 'original' ? 'оригинал' : 'превью';
    const t = toast(`Скачиваю ${label}: ${s.name}…`, { sticky: true });
    try {
      const rec = await local('/download', 'POST', { id: s.id, kind });
      t.close();
      toast(`Сохранено: ${rec.file.split(/[\\/]/).pop()} (${fmtSize(rec.bytes)})`, { type: 'ok', timeout: 8000, action: { label: 'Показать', fn: () => local('/open-folder', 'POST', { file: rec.file }).catch((e) => toast(e.message, 'error')) } });
      if (S.tab === 'downloads') renderDownloads();
    } catch (e) {
      t.close();
      toast(e.message, { type: 'error', action: e.status === 401 ? { label: 'Войти', fn: startLogin } : undefined });
    }
  }

  async function renderDownloads() {
    try {
      const data = await local('/downloads');
      $('#dlDir').textContent = S.status ? S.status.downloadDir : '';
      $('#dlTable tbody').innerHTML = data.items.length ? data.items.map((r) => `<tr>
        <td><a href="#" data-action="detail" data-id="${r.id}">${esc(r.name)}</a></td>
        <td><a href="#" data-action="author" data-user="${esc(r.username)}">${esc(r.username)}</a></td>
        <td><span class="lic ${licClass(r.license)}">${esc(licShort(r.license))}</span></td>
        <td>${esc(r.kind)}</td><td>${fmtSize(r.bytes)}</td>
        <td class="hint">${esc(new Date(r.downloaded_at).toLocaleString('ru-RU'))}</td>
        <td class="actions"><button class="btn small ghost" data-action="reveal" data-file="${esc(r.file)}">${ic('folder')} Показать</button></td>
      </tr>`).join('') : '<tr><td colspan="7" class="hint">Загрузок ещё не было.</td></tr>';
    } catch (e) { toast(e.message, 'error'); }
  }

  // ------------------------------------------------------------------ saved searches, history, hash
  function snapshotSearch(name) {
    return { name, query: S.query, filters: readFilters(), sort: S.sort, groupByPack: S.groupByPack, pageSize: S.pageSize, saved: new Date().toISOString() };
  }
  function applySnapshot(snap, { search = true } = {}) {
    S.query = snap.query || ''; $('#q').value = S.query;
    writeFilters(snap.filters);
    S.sort = snap.sort || localStorage.getItem('fs_sort') || 'score'; $('#sort').value = S.sort; localStorage.setItem('fs_sort', S.sort);
    S.groupByPack = Boolean(snap.groupByPack); $('#groupByPack').checked = S.groupByPack;
    if (snap.pageSize) { S.pageSize = Number(snap.pageSize); $('#pageSize').value = String(S.pageSize); }
    if (search) runSearch(snap.page || 1);
  }
  function renderSavedSearches() {
    const sel = $('#savedSearches');
    const cur = sel.value;
    sel.innerHTML = '<option value="">Сохранённые…</option>' + S.searches.map((s, i) => `<option value="${i}">${esc(s.name)}</option>`).join('');
    if (cur && S.searches[cur]) sel.value = cur;
  }
  async function saveSearches() {
    try { const data = await local('/searches', 'PUT', { items: S.searches }); S.searches = data.items; renderSavedSearches(); } catch (e) { toast(e.message, 'error'); }
  }

  function loadFilterPresets() {
    try { S.filterPresets = JSON.parse(localStorage.getItem(FILTER_PRESETS_KEY) || '[]'); }
    catch (_) { S.filterPresets = []; }
    if (!Array.isArray(S.filterPresets)) S.filterPresets = [];
    renderFilterPresets();
  }

  function renderFilterPresets() {
    const select = $('#filterPresets');
    if (!select) return;
    const current = select.value;
    select.innerHTML = '<option value="">Пресеты фильтров…</option>' + S.filterPresets.map((preset, index) => `<option value="${index}">${esc(preset.name)}</option>`).join('');
    if (current && S.filterPresets[Number(current)]) select.value = current;
  }

  function saveFilterPresetsLocal() {
    localStorage.setItem(FILTER_PRESETS_KEY, JSON.stringify(S.filterPresets));
    renderFilterPresets();
  }

  function saveCurrentFilterPreset() {
    const name = prompt('Название пресета фильтров:');
    if (!name || !name.trim()) return;
    const preset = { name: name.trim(), filters: readFilters(), saved: new Date().toISOString() };
    const index = S.filterPresets.findIndex((item) => item.name.toLowerCase() === preset.name.toLowerCase());
    if (index >= 0) S.filterPresets[index] = preset; else S.filterPresets.push(preset);
    saveFilterPresetsLocal();
    $('#filterPresets').value = String(S.filterPresets.findIndex((item) => item.name === preset.name));
    toast('Пресет фильтров сохранён', 'ok');
  }

  function applyFilterPreset(index) {
    const preset = S.filterPresets[Number(index)];
    if (!preset) return;
    writeFilters(preset.filters || defaultFilters());
    updateFilterPreview();
    renderModeBanner();
    toast(`Пресет «${preset.name}» применён`, { timeout: 1500 });
  }

  function deleteFilterPreset(index) {
    const preset = S.filterPresets[Number(index)];
    if (!preset) return;
    if (!confirm(`Удалить пресет фильтров «${preset.name}»?`)) return;
    S.filterPresets.splice(Number(index), 1);
    saveFilterPresetsLocal();
    $('#filterPresets').value = '';
  }

  function readMainSearch() {
    try { return JSON.parse(localStorage.getItem(MAIN_SEARCH_KEY) || 'null'); }
    catch (_) { return null; }
  }

  function renderMainSearchStatus() {
    const el = $('#mainSearchStatus');
    if (!el) return;
    const snap = readMainSearch();
    el.textContent = snap ? `Основной: ${snap.query || 'без текста, только фильтры'}` : '';
  }

  function saveMainSearch() {
    S.query = val('#q');
    const snap = snapshotSearch('Основной поиск');
    localStorage.setItem(MAIN_SEARCH_KEY, JSON.stringify(snap));
    renderMainSearchStatus();
    toast('Текущий поиск сохранён как основной', 'ok');
  }

  function addHistory(q) {
    let h = [];
    try { h = JSON.parse(localStorage.getItem('fs_history') || '[]'); } catch (_) { /* ignore */ }
    h = [q, ...h.filter((x) => x !== q)].slice(0, 40);
    localStorage.setItem('fs_history', JSON.stringify(h));
    renderHistory();
  }
  function renderHistory() {
    let h = [];
    try { h = JSON.parse(localStorage.getItem('fs_history') || '[]'); } catch (_) { /* ignore */ }
    $('#historyList').innerHTML = h.map((q) => `<option value="${esc(q)}">`).join('');
  }

  function compactFilters(f) {
    const d = defaultFilters();
    const out = {};
    for (const [k, v] of Object.entries(f)) {
      if (JSON.stringify(v) !== JSON.stringify(d[k])) out[k] = v;
    }
    return out;
  }
  function saveHash() {
    const snap = { query: S.query, filters: compactFilters(readFilters()) };
    if (S.sort !== 'score') snap.sort = S.sort;
    if (S.groupByPack) snap.groupByPack = true;
    if (S.pageSize !== 30) snap.pageSize = S.pageSize;
    if (S.page > 1) snap.page = S.page;
    if (!Object.keys(snap.filters).length) delete snap.filters;
    const enc = encodeURIComponent(JSON.stringify(snap));
    history.replaceState(null, '', `#tab=search&s=${enc}`);
  }
  function readHash() {
    const h = location.hash.replace(/^#/, '');
    if (!h) return null;
    const p = new URLSearchParams(h);
    const out = { tab: p.get('tab') || 'search' };
    if (p.get('s')) { try { out.snap = JSON.parse(decodeURIComponent(p.get('s'))); } catch (_) { /* ignore */ } }
    return out;
  }

  // ------------------------------------------------------------------ tabs
  function showTab(tab) {
    S.tab = tab;
    $$('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === tab));
    $$('.view').forEach((v) => v.classList.toggle('active', v.id === 'view-' + tab));
    if (tab === 'favorites') renderFavorites();
    if (tab === 'blacklist') renderBlacklist();
    if (tab === 'downloads') renderDownloads();
    if (tab === 'settings') { fillSettingsForm(); renderAuthStatus(); }
    if (tab === 'search' && S.results) { S.currentList = (S.results.results || []).filter((s) => !hiddenReason(s)).map((s) => s.id); }
    if (tab !== 'search') history.replaceState(null, '', '#tab=' + tab);
    else if (S.results) saveHash();
    else history.replaceState(null, '', '#tab=search');
  }

  // ------------------------------------------------------------------ settings
  async function loadStatus() {
    try {
      S.status = await local('/status');
      const chip = $('#statusChip');
      if (S.status.mock) { chip.textContent = 'MOCK-режим'; chip.className = 'chip warn'; }
      else if (!S.status.hasApiKey && !S.status.oauth.connected) { chip.textContent = 'Нет ключа API'; chip.className = 'chip err'; }
      else { chip.textContent = 'API подключён'; chip.className = 'chip ok'; }
      renderUserBlock();
    } catch (e) { toast('Сервер недоступен: ' + e.message, 'error'); }
  }

  async function refreshDownloadFolderUI() {
    const input = $('#s_downloadDir');
    const choose = $('#chooseDownloadFolder');
    const clear = $('#clearDownloadFolder');
    const hint = $('#downloadFolderHint');
    if (!input || !choose || !clear || !hint) return;

    if (window.FSStatic && window.FSStatic.active) {
      input.readOnly = true;
      input.disabled = false;
      if (window.FSStatic.supportsDirectoryPicker) {
        choose.classList.remove('hidden');
        clear.classList.remove('hidden');
        const info = await window.FSStatic.getDownloadFolderInfo();
        input.value = info && info.name ? info.name : 'Browser default Downloads';
        hint.textContent = info && info.name
          ? 'Files are written directly to this folder. This does not change the browser global Downloads folder.'
          : 'No app-specific folder selected. Downloads use the browser default behavior.';
      } else {
        choose.classList.add('hidden');
        clear.classList.add('hidden');
        input.value = 'Browser default Downloads';
        hint.textContent = 'This browser does not support app-specific folder access. Downloads use the browser default folder.';
      }
    } else {
      input.readOnly = false;
      choose.classList.add('hidden');
      clear.classList.add('hidden');
      hint.textContent = 'Local server mode: this path is used directly by Node.js.';
    }
  }

  async function getAttributionData() {
    return local('/attribution');
  }

  async function viewAttribution() {
    try {
      const data = await getAttributionData();
      openModal(`<h2>_attribution.txt</h2><pre class="attribution-preview">${esc(data.content || 'Файл пока пуст.')}</pre>`, { narrow: true });
    } catch (e) { toast(e.message, 'error'); }
  }

  async function copyAttribution() {
    try {
      const data = await getAttributionData();
      await navigator.clipboard.writeText(data.content || '');
      toast('_attribution.txt скопирован', { timeout: 1500 });
    } catch (e) { toast(e.message, 'error'); }
  }

  async function downloadAttribution() {
    try {
      const data = await getAttributionData();
      downloadBlob('_attribution.txt', data.content || '', 'text/plain;charset=utf-8');
    } catch (e) { toast(e.message, 'error'); }
  }

  async function clearAttribution() {
    if (!confirm('Очистить _attribution.txt?')) return;
    try {
      await local('/attribution', 'DELETE');
      toast('_attribution.txt очищен', 'ok');
    } catch (e) { toast(e.message, 'error'); }
  }

  // Fills the settings form from the server. Called only when the tab opens or after an explicit save,
  // never on focus/visibility changes, so typed-but-unsaved values are not wiped.
  async function fillSettingsForm() {
    try {
      S.settings = await local('/settings');
      const s = S.settings;
      setVal('#s_clientId', s.clientId); setVal('#s_clientSecret', s.clientSecret || s.apiKey);
      setVal('#s_downloadDir', s.downloadDir); setVal('#s_previewQuality', s.previewQuality); setVal('#s_pageSize', s.pageSize);
      $('#s_attributionLog').checked = Boolean(s.attributionLog);
      await refreshDownloadFolderUI();
      $('#s_blacklistServerSide').checked = Boolean(s.blacklistServerSide);
      setVal('#s_blacklistMaxServerSide', s.blacklistMaxServerSide);
      $('#redirectUri').textContent = S.status ? S.status.redirectUri : '';
    } catch (e) { toast(e.message, 'error'); }
  }

  function renderAuthStatus() {
    if (!S.status) return;
    const o = S.status.oauth;
    $('#oauthStatus').innerHTML = o.connected
      ? `${ic('check', 'sm')} <span class="ok-text">Вы вошли как <b>${esc(o.username || '?')}</b></span> · токен действует до ${esc(new Date(o.expiresAt).toLocaleString('ru-RU'))}, обновляется автоматически`
      : `${ic('info', 'sm')} Не выполнен вход. ${S.status.hasApiKey ? 'Поиск и превью работают по ключу API, оригиналы недоступны.' : 'Нужны ключи API (ниже) или пошаговая настройка.'}`;
    $('#oauthLogout').classList.toggle('hidden', !o.connected);
  }

  async function saveSettings(e) {
    e.preventDefault();
    const body = {
      clientId: val('#s_clientId'), clientSecret: val('#s_clientSecret'), apiKey: val('#s_clientSecret'),
      downloadDir: val('#s_downloadDir'), previewQuality: val('#s_previewQuality'), pageSize: Number(val('#s_pageSize')) || 30,
      attributionLog: $('#s_attributionLog').checked, blacklistServerSide: $('#s_blacklistServerSide').checked,
      blacklistMaxServerSide: Number(val('#s_blacklistMaxServerSide')) || 300,
    };
    try {
      S.settings = await local('/settings', 'PUT', body);
      S.pageSize = S.settings.pageSize; $('#pageSize').value = String(S.pageSize);
      await loadStatus();
      renderAuthStatus();
      toast('Настройки сохранены', 'ok');
    } catch (err) { toast(err.message, 'error'); }
  }

  // Credentials are saved as soon as the field loses focus, so nothing is lost even without pressing "Save".
  const autosaveCredentials = debounce(async () => {
    const clientId = val('#s_clientId');
    const clientSecret = val('#s_clientSecret');
    if (!clientId && !clientSecret) return;
    if (S.settings && S.settings.clientId === clientId && S.settings.clientSecret === clientSecret) return;
    try {
      await saveCredentials(clientId, clientSecret);
      renderAuthStatus();
      toast('Ключи сохранены', { type: 'ok', timeout: 1500 });
    } catch (e) { toast(e.message, 'error'); }
  }, 400);

  // ------------------------------------------------------------------ static UI setup
  function fillSubcats() {
    const cat = FS.TAXONOMY.find((c) => c.name === val('#f_cat'));
    const sel = $('#f_subcat');
    sel.innerHTML = '<option value="">Любая</option>' + (cat ? cat.sub.map((s) => `<option value="${esc(s.name)}" title="${esc(s.ex)}">${esc(s.name)}</option>`).join('') : '');
    sel.disabled = !cat;
  }

  function setupStatic() {
    mountIcons();
    setupControls();
    $('#f_cat').innerHTML = '<option value="">Любая</option>' + FS.TAXONOMY.map((c) => `<option value="${esc(c.name)}" title="${esc(c.desc)}">${esc(c.name)}</option>`).join('');
    $('#f_cat').addEventListener('change', fillSubcats);
    $('#licCommercial').addEventListener('click', () => { C.lic.set(['Creative Commons 0', 'Attribution']); updateFilterPreview(); });
    $('#f_simSpace').innerHTML = FS.SIMILARITY_SPACES.map((s) => `<option value="${s.value}">${esc(s.label)}</option>`).join('');
    $('#sort').innerHTML = FS.SORTS.map((s) => `<option value="${s.value}">${esc(s.label)}</option>`).join('');
    if (!FS.SORTS.some((item) => item.value === S.sort)) S.sort = 'score';
    $('#sort').value = S.sort;
    localStorage.setItem('fs_sort', S.sort);
    $('#durPresets').innerHTML = FS.DURATION_PRESETS.map((p) => `<button type="button" data-min="${p.min}" data-max="${p.max}">${esc(p.label)}</button>`).join('') + '<button type="button" data-min="" data-max="">любая</button>';
    $$('#durPresets button').forEach((b) => b.addEventListener('click', () => { C.dur.set(b.dataset.min, b.dataset.max); updateFilterPreview(); }));
    $('#datePresets').innerHTML = FS.DATE_PRESETS.map((p) => `<button type="button" data-days="${p.days}">${esc(p.label)}</button>`).join('') + '<button type="button" data-days="">любая</button>';
    $$('#datePresets button').forEach((b) => b.addEventListener('click', () => { setVal('#f_after', b.dataset.days ? dateIso(Number(b.dataset.days)) : ''); setVal('#f_before', ''); updateFilterPreview(); }));
    chips.inc = makeChips($('#f_tagsInc'));
    chips.exc = makeChips($('#f_tagsExc'));
    setupFilterResetButtons();
    $('#addDesc').addEventListener('click', () => { addDescRow(); updateFilterPreview(); });
    $('#f_manual').addEventListener('change', (e) => {
      $('#f_manualText').disabled = !e.target.checked;
      if (e.target.checked && !val('#f_manualText')) { const f = readFilters(); f.manual = false; setVal('#f_manualText', buildFilter(f)); }
      updateFilterPreview();
    });
    $('#copyFilter').addEventListener('click', () => { navigator.clipboard.writeText($('#filterPreview').textContent).then(() => toast('Скопировано', { timeout: 1200 })); });
    $('#filterForm').addEventListener('input', debounce(updateFilterPreview, 120));
    $('#filterForm').addEventListener('change', updateFilterPreview);
    $('#filterForm').addEventListener('submit', (e) => { e.preventDefault(); S.query = val('#q'); runSearch(1); });
    $('#resetFilters').addEventListener('click', () => {
      writeFilters(defaultFilters());
      updateFilterPreview();
      renderModeBanner();
      $('#filterPresets').value = '';
      toast('Фильтры сброшены к дефолту', { timeout: 1200 });
    });
    loadFilterPresets();
    renderMainSearchStatus();
    $('#filterPresets').addEventListener('change', (e) => { if (e.target.value !== '') applyFilterPreset(e.target.value); });
    $('#saveFilterPreset').addEventListener('click', saveCurrentFilterPreset);
    $('#deleteFilterPreset').addEventListener('click', () => deleteFilterPreset($('#filterPresets').value));
    $('#saveMainSearch').addEventListener('click', saveMainSearch);
    $('#searchForm').addEventListener('submit', (e) => { e.preventDefault(); S.query = val('#q'); runSearch(1); });
    $('#sort').addEventListener('change', (e) => { S.sort = e.target.value; localStorage.setItem('fs_sort', S.sort); if (S.results) runSearch(1); });
    $('#pageSize').addEventListener('change', (e) => { S.pageSize = Number(e.target.value); if (S.results) runSearch(1); });
    $('#groupByPack').addEventListener('change', (e) => { S.groupByPack = e.target.checked; if (S.results) runSearch(1); });
    $$('#viewSeg button').forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));
    $('#toggleRequest').addEventListener('click', () => { $('#requestBox').classList.toggle('hidden'); renderRequestBox(); });
    $('#saveSearch').addEventListener('click', async () => {
      const sel = $('#savedSearches');
      const cur = sel.value !== '' ? S.searches[Number(sel.value)] : null;
      const name = prompt('Название сохранённого поиска:', cur ? cur.name : (S.query || 'Без названия'));
      if (!name) return;
      const snap = snapshotSearch(name.trim());
      const idx = S.searches.findIndex((s) => s.name === snap.name);
      if (idx >= 0) S.searches[idx] = snap; else S.searches.push(snap);
      await saveSearches();
      sel.value = String(S.searches.findIndex((s) => s.name === snap.name));
      toast('Поиск сохранён', 'ok');
    });
    $('#savedSearches').addEventListener('change', (e) => {
      const snap = S.searches[Number(e.target.value)];
      if (!snap) return;
      if (confirm(`Загрузить «${snap.name}»? (Отмена — удалить его из сохранённых)`)) applySnapshot(snap);
      else if (confirm(`Удалить сохранённый поиск «${snap.name}»?`)) { S.searches.splice(Number(e.target.value), 1); saveSearches(); e.target.value = ''; }
      else e.target.value = '';
    });
    $$('.tab').forEach((t) => t.addEventListener('click', () => showTab(t.dataset.tab)));
    $('#statusChip').addEventListener('click', () => { if (S.status && !S.status.hasApiKey && !S.status.oauth.connected) openOnboarding(); else showTab('settings'); });

    // favorites
    $('#favFilter').addEventListener('input', debounce(renderFavorites, 150));
    $('#favExport').addEventListener('click', () => downloadBlob('freesound-favorites.json', JSON.stringify(S.favorites, null, 2)));
    $('#favDownloadAll').addEventListener('click', async () => {
      if (!S.favorites.length) return;
      if (!confirm(`Скачать превью для ${S.favorites.length} звуков?`)) return;
      const t = toast('Скачиваю…', { sticky: true });
      let ok = 0;
      for (const [i, s] of S.favorites.entries()) {
        t.set(`Скачиваю ${i + 1}/${S.favorites.length}: ${s.name}`);
        try { await local('/download', 'POST', { id: s.id, kind: previewQuality() }); ok += 1; } catch (e) { toast(`${s.name}: ${e.message}`, 'error'); }
      }
      t.close();
      toast(`Готово: ${ok} из ${S.favorites.length}`, 'ok');
    });

    // blacklist page
    C.blKind = FSC.segmented($('#c_blKind'), { options: Object.keys(KIND).map((k) => ({ value: k, label: KIND[k].plural })), value: 'user', defaultValue: 'user', onChange: (v) => { S.blKind = v; renderBlacklist(); } });
    $('#blAddForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      let value = val('#blValue');
      if (!value) return;
      if (S.blKind === 'pack') value = packIdFrom(value) || value.replace(/\D/g, '');
      await blockItem(S.blKind, value, { note: val('#blNote') });
      setVal('#blValue', ''); setVal('#blNote', '');
    });
    $('#blFilter').addEventListener('input', debounce(renderBlacklist, 150));
    $('#blImport').addEventListener('click', async () => {
      const values = val('#blBulk').split(/\r?\n|,/).map((s) => s.trim()).filter(Boolean).map((v) => (S.blKind === 'pack' ? packIdFrom(v) || v.replace(/\D/g, '') : v)).filter(Boolean);
      if (!values.length) return;
      try { const data = await local('/blacklist/add', 'POST', { kind: S.blKind, values, note: 'импорт' }); setBlacklist(data); rerenderLists(); setVal('#blBulk', ''); toast(`Добавлено: ${data.added}`, 'ok'); } catch (err) { toast(err.message, 'error'); }
    });
    $('#blImportJson').addEventListener('click', () => $('#blJsonFile').click());
    $('#blJsonFile').addEventListener('change', async (event) => {
      const file = event.target.files && event.target.files[0];
      event.target.value = '';
      if (!file) return;
      try {
        const imported = JSON.parse(await file.text());
        if (!imported || typeof imported !== 'object') throw new Error('JSON должен содержать объект blacklist.');
        const merge = (current, incoming, key) => {
          const map = new Map((current || []).map((item) => [String(item[key]).toLowerCase(), item]));
          for (const raw of incoming || []) {
            const item = typeof raw === 'object' && raw !== null ? raw : { [key]: raw };
            const value = String(item[key] ?? '').trim();
            if (!value) continue;
            const mapKey = value.toLowerCase();
            if (!map.has(mapKey)) map.set(mapKey, { ...item, [key]: value, added: item.added || new Date().toISOString() });
          }
          return Array.from(map.values());
        };
        const merged = {
          users: merge(BL.users, imported.users, 'username'),
          tags: merge(BL.tags, imported.tags, 'tag'),
          packs: merge(BL.packs, imported.packs, 'id'),
          words: merge(BL.words, imported.words, 'word'),
        };
        const data = await local('/blacklist', 'PUT', merged);
        setBlacklist(data);
        rerenderLists();
        toast('Blacklist JSON импортирован', 'ok');
      } catch (err) { toast('Не удалось импортировать JSON: ' + err.message, 'error'); }
    });
    $('#blExport').addEventListener('click', () => downloadBlob('freesound-blacklist.json', JSON.stringify({ users: BL.users, tags: BL.tags, packs: BL.packs, words: BL.words }, null, 2)));
    $('#blCopy').addEventListener('click', () => navigator.clipboard.writeText(blItems(S.blKind).map((it) => (S.blKind === 'pack' ? `${it.id} ${it.name || ''}`.trim() : blValue(S.blKind, it))).join('\n')).then(() => toast('Список скопирован', { timeout: 1500 })));

    // downloads
    $('#dlOpenFolder').addEventListener('click', () => local('/open-folder', 'POST', {}).catch((e) => toast(e.message, 'error')));

    // settings
    $('#settingsForm').addEventListener('submit', saveSettings);
    $$('.eye').forEach((b) => b.addEventListener('click', () => { const i = $('#' + b.dataset.for); i.type = i.type === 'password' ? 'text' : 'password'; }));
    $('#s_clientId').addEventListener('change', autosaveCredentials);
    $('#s_clientSecret').addEventListener('change', autosaveCredentials);
    $('#oauthConnect').addEventListener('click', async () => {
      const clientId = val('#s_clientId'); const clientSecret = val('#s_clientSecret');
      if (!clientId || !clientSecret) { openOnboarding(); return; }
      try { await saveCredentials(clientId, clientSecret); openOAuthPopup(); } catch (e) { toast(e.message, 'error'); }
    });
    $('#oauthLogout').addEventListener('click', logout);
    $('#openOnboarding').addEventListener('click', openOnboarding);
    $('#copyRedirect').addEventListener('click', () => navigator.clipboard.writeText($('#redirectUri').textContent).then(() => toast('Callback URL скопирован', { timeout: 1500 })));
    $('#oauthManual').addEventListener('click', async () => {
      const code = val('#oauthCode');
      const clientId = val('#s_clientId'); const clientSecret = val('#s_clientSecret');
      try {
        if (clientId && clientSecret) await saveCredentials(clientId, clientSecret);
        await exchangeManualCode(code);
        setVal('#oauthCode', '');
      } catch (e) { toast(e.message, 'error'); }
    });
    $('#checkUsage').addEventListener('click', () => { $('#usageInfo').textContent = '…'; refreshUsage(true); });
    $('#attributionView').addEventListener('click', viewAttribution);
    $('#attributionCopy').addEventListener('click', copyAttribution);
    $('#attributionDownload').addEventListener('click', downloadAttribution);
    $('#attributionClear').addEventListener('click', clearAttribution);
    $('#chooseDownloadFolder').addEventListener('click', async () => {
      if (!window.FSStatic || !window.FSStatic.chooseDownloadFolder) return;
      try { await window.FSStatic.chooseDownloadFolder(); await refreshDownloadFolderUI(); }
      catch (e) { if (e && e.name !== 'AbortError') toast(e.message, 'error'); }
    });
    $('#clearDownloadFolder').addEventListener('click', async () => {
      if (!window.FSStatic || !window.FSStatic.clearDownloadFolder) return;
      await window.FSStatic.clearDownloadFolder();
      await refreshDownloadFolderUI();
    });
  }

  function setView(v) {
    S.view = v;
    localStorage.setItem('fs_view', v);
    $$('#viewSeg button').forEach((b) => b.classList.toggle('active', b.dataset.view === v));
    $('#results').className = 'results ' + v;
    $('#favList').className = 'results ' + v;
  }

  function downloadBlob(name, text, mime = 'application/json') {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: mime }));
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  // ------------------------------------------------------------------ global click delegation
  document.addEventListener('click', async (e) => {
    const card = e.target.closest('.card[data-id]');
    if (card) selectSound(Number(card.dataset.id), false);
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const action = el.dataset.action;
    const holder = el.closest('[data-id]');
    const id = el.dataset.id ? Number(el.dataset.id) : holder ? Number(holder.dataset.id) : null;
    const sound = id ? S.soundCache.get(id) : null;
    const user = el.dataset.user || (sound && sound.username);

    if (action === 'detail' && (e.ctrlKey || e.metaKey)) return; // let the browser open the site
    if (el.tagName === 'A' || el.tagName === 'BUTTON') e.preventDefault();
    if (action.startsWith('block-') || action.startsWith('unblock-')) e.stopPropagation();

    switch (action) {
      case 'play': if (sound) playSound(sound); break;
      case 'replay': if (sound) replaySound(sound); break;
      case 'rate': if (sound) openRating(sound); break;
      case 'rate-value': if (sound) { await submitRating(sound, Number(el.dataset.rating)); closeModal(); } break;
      case 'comment': if (sound) openComment(sound); break;
      case 'close-modal': closeModal(); break;
      case 'detail': if (id) openDetail(id); break;
      case 'author': if (user) openAuthor(user); break;
      case 'author-page': openAuthor(el.dataset.user, Number(el.dataset.page)); break;
      case 'pack': openPack(el.dataset.pack); break;
      case 'pack-page': openPack(el.dataset.pack, Number(el.dataset.page)); break;
      case 'morepack': openMoreFromPack(el.dataset.uri); break;
      case 'block-user': if (user) blockItem('user', user); break;
      case 'unblock-user': if (user) unblockItem('user', user); break;
      case 'block-tag': blockItem('tag', el.dataset.tag); break;
      case 'block-pack': blockItem('pack', el.dataset.pack, el.dataset.name ? { name: el.dataset.name } : {}); break;
      case 'unblock-pack': unblockItem('pack', el.dataset.pack); break;
      case 'bl-remove': unblockItem(el.dataset.kind, el.dataset.v); break;
      case 'fav': if (sound) toggleFav(sound); break;
      case 'dl-preview': if (sound) download(sound, previewQuality()); break;
      case 'dl-original': if (sound) download(sound, 'original'); break;
      case 'similar':
        if (sound) { closeModal(); setVal('#f_similarTo', String(sound.id)); $('#f_similarTo').closest('details').open = true; showTab('search'); runSearch(1); }
        break;
      case 'clear-similar': setVal('#f_similarTo', ''); updateFilterPreview(); runSearch(1); break;
      case 'clear-manual': $('#f_manual').checked = false; $('#f_manualText').disabled = true; updateFilterPreview(); runSearch(1); break;
      case 'tag':
        closeModal();
        if (e.altKey) chips.exc.add(el.dataset.tag); else chips.inc.add(el.dataset.tag);
        showTab('search'); runSearch(1);
        break;
      case 'search-author': closeModal(); setVal('#f_user', el.dataset.user); $('#f_user').closest('details').open = true; showTab('search'); runSearch(1); break;
      case 'search-pack': closeModal(); setVal('#f_pack', el.dataset.pack); $('#f_pack').closest('details').open = true; showTab('search'); runSearch(1); break;
      case 'page': runSearch(Number(el.dataset.page)); $('#view-search .content').scrollTop = 0; break;
      case 'copy-url': navigator.clipboard.writeText(S.lastUrl).then(() => toast('URL скопирован', { timeout: 1200 })); break;
      case 'copy-text': navigator.clipboard.writeText(el.dataset.text || '').then(() => toast('Скопировано', { timeout: 1200 })); break;
      case 'goto-settings': showTab('settings'); break;
      case 'onboarding': openOnboarding(); break;
      case 'login': startLogin(); break;
      case 'logout': logout(); break;
      case 'ob-login': onboardingSave(true); break;
      case 'ob-save': onboardingSave(false); break;
      case 'ob-code': exchangeManualCode(val('#ob_code')); break;
      case 'reveal': local('/open-folder', 'POST', { file: el.dataset.file }).catch((err) => toast(err.message, 'error')); break;
      default: break;
    }
  });

  document.addEventListener('keydown', (e) => {
    const tag = (e.target.tagName || '').toLowerCase();
    const typing = tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable;
    if (e.key === 'Escape') { hideCtx(); if (!$('#modal').classList.contains('hidden')) closeModal(); return; }
    if (typing) return;

    const selected = () => selectedSound();
    if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
    else if (e.key === '/') { e.preventDefault(); $('#q').focus(); $('#q').select(); }
    else if (e.altKey && e.key === 'ArrowRight') {
      e.preventDefault();
      const pages = S.results ? Math.ceil((S.results.count || 0) / S.pageSize) : 0;
      if (S.page < pages) { runSearch(S.page + 1); $('#view-search .content').scrollTop = 0; }
    } else if (e.altKey && e.key === 'ArrowLeft') {
      e.preventDefault();
      if (S.page > 1) { runSearch(S.page - 1); $('#view-search .content').scrollTop = 0; }
    } else if (e.key === 'ArrowDown' || e.key.toLowerCase() === 'j') {
      e.preventDefault(); moveSelection(1);
    } else if (e.key === 'ArrowUp' || e.key.toLowerCase() === 'k') {
      e.preventDefault(); moveSelection(-1);
    } else if (e.key === 'Home' && S.currentList.length) {
      e.preventDefault(); selectSound(S.currentList[0]);
    } else if (e.key === 'End' && S.currentList.length) {
      e.preventDefault(); selectSound(S.currentList[S.currentList.length - 1]);
    } else if (e.key === 'Enter' && selected()) {
      e.preventDefault(); playSound(selected());
    } else if (e.key.toLowerCase() === 'r' && selected()) {
      e.preventDefault(); replaySound(selected());
    } else if (e.key.toLowerCase() === 'd' && selected()) {
      e.preventDefault(); download(selected(), previewQuality());
    } else if (e.key.toLowerCase() === 'f' && selected()) {
      e.preventDefault(); toggleFav(selected());
    } else if (e.key.toLowerCase() === 'c' && selected()) {
      e.preventDefault(); openComment(selected());
    } else if (/^[1-5]$/.test(e.key) && selected()) {
      e.preventDefault(); submitRating(selected(), Number(e.key));
    } else if (e.key === 'ArrowRight' && e.shiftKey) playNext(1);
    else if (e.key === 'ArrowLeft' && e.shiftKey) playNext(-1);
  });

  // ------------------------------------------------------------------ init
  async function init() {
    setupStatic();
    setView(S.view);
    renderHistory();
    const [settings, bl, fav, searches] = await Promise.all([
      local('/settings').catch(() => null),
      local('/blacklist').catch(() => ({})),
      local('/favorites').catch(() => ({ sounds: [] })),
      local('/searches').catch(() => ({ items: [] })),
    ]);
    S.settings = settings;
    if (settings) { S.pageSize = settings.pageSize || 30; $('#pageSize').value = String(S.pageSize); }
    setBlacklist(bl);
    setFavorites(fav.sounds);
    S.searches = searches.items || [];
    renderSavedSearches();
    await loadStatus();
    writeFilters(defaultFilters());
    refreshUsage();

    const qs = new URLSearchParams(location.search);
    if (qs.get('oauth')) {
      if (qs.get('oauth') === 'connected') toast('Аккаунт Freesound подключён', 'ok');
      else toast('Вход не удался: ' + (qs.get('msg') || 'ошибка'), 'error');
      history.replaceState(null, '', '/' + (location.hash || '#tab=settings'));
      showTab('settings');
      return;
    }

    const h = readHash();
    if (h && h.tab && h.tab !== 'search') { showTab(h.tab); return; }
    if (h && h.snap) { applySnapshot(h.snap, { search: true }); return; }

    if (S.status && !S.status.hasApiKey && !S.status.oauth.connected && !S.status.mock) {
      $('#results').innerHTML = `<div class="empty"><h3>Подключите Freesound</h3>
        Нужен ключ API: создаётся за минуту. <div class="row" style="justify-content:center;margin-top:14px"><button class="btn primary" data-action="onboarding">${ic('key')} Настроить доступ</button></div></div>`;
    } else {
      const mainSearch = readMainSearch();
      if (mainSearch) { applySnapshot(mainSearch, { search: true }); return; }
      $('#results').innerHTML = `<div class="empty"><h3>Начните с запроса</h3>
        <ul>
          <li><b>rain loop -thunder</b> — минус исключает слово, кавычки ищут фразу.</li>
          <li>Фильтры слева: теги, категория, формат, длительность, лицензия, BPM/нота/тональность и ~70 аудио-дескрипторов.</li>
          <li>Чёрный список: значок запрета у автора, тега и пака или правый клик по карточке.</li>
          <li>Клик по тегу добавляет его в фильтр, Alt+клик исключает. Пробел — пауза, / — в строку поиска.</li>
        </ul></div>`;
    }
  }

  // Only the auth status is refreshed on focus; form fields are never touched here.
  window.addEventListener('focus', async () => { if (S.tab === 'settings') { await loadStatus(); renderAuthStatus(); } });
  init().catch((e) => toast('Ошибка инициализации: ' + e.message, 'error'));
})();
