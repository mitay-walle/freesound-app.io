(() => {
  'use strict';

  const $ = (selector) => document.querySelector(selector);
  const STORAGE = {
    theme: 'fs_ui_theme',
    accent: 'fs_ui_accent',
    language: 'fs_ui_language',
    sidebarWidth: 'fs_sidebar_width',
    sidebarCollapsed: 'fs_sidebar_collapsed',
    contrast: 'fs_ui_contrast',
    waveformContrast: 'fs_ui_waveform_contrast',
    textScale: 'fs_ui_text_scale',
    visibility: 'fs_ui_visibility',
    disclaimer: 'fs_freesound_disclaimer_v1',
  };
  const DEFAULT_ACCENT = '#3d7bff';
  const DEFAULT_SIDEBAR = 322;
  const MIN_SIDEBAR = 240;
  const MAX_SIDEBAR = 600;
  const DEFAULT_CONTRAST = 100;
  const DEFAULT_WAVEFORM_CONTRAST = 100;
  const DEFAULT_TEXT_SCALE = 120;
  const TECH_UI_PARTS = ['tech-duration', 'tech-format', 'tech-samplerate', 'tech-bitdepth', 'tech-channels', 'tech-filesize'];
  const UI_PARTS = ['waveform', ...TECH_UI_PARTS, 'author', 'rating', 'downloads', 'comments', 'license', 'date', 'pack', 'category', 'tags', 'description', 'actions', 'action-favorite', 'action-rate', 'action-comment', 'action-original', 'action-similar', 'action-freesound'];

  const I18N = window.FSI18N || {};
  const SUPPORTED_LANGUAGES = ['ru', 'en', 'zh', 'ko'];

  const textOriginal = new WeakMap();
  const attrOriginal = new WeakMap();
  let language = SUPPORTED_LANGUAGES.includes(localStorage.getItem(STORAGE.language)) ? localStorage.getItem(STORAGE.language) : 'ru';

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function normalizeHex(value) {
    const match = /^#([0-9a-f]{6})$/i.exec(String(value || '').trim());
    return match ? '#' + match[1].toLowerCase() : DEFAULT_ACCENT;
  }

  function rgb(hex) {
    const value = normalizeHex(hex).slice(1);
    return [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16));
  }

  function mix(hex, target, amount) {
    const a = rgb(hex);
    const b = rgb(target);
    return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * amount).toString(16).padStart(2, '0')).join('');
  }

  function applyAccent(value) {
    const accent = normalizeHex(value);
    const values = rgb(accent);
    const light = document.documentElement.dataset.theme === 'light';
    document.documentElement.style.setProperty('--accent', accent);
    document.documentElement.style.setProperty('--accent-2', mix(accent, light ? '#000000' : '#ffffff', light ? .18 : .24));
    document.documentElement.style.setProperty('--accent-soft', `rgba(${values[0]}, ${values[1]}, ${values[2]}, .14)`);
    localStorage.setItem(STORAGE.accent, accent);
    const input = $('#s_accent');
    const label = $('#accentValue');
    if (input && input.value !== accent) input.value = accent;
    if (label) label.textContent = accent;
  }

  function readVisibility() {
    let stored = {};
    try { stored = JSON.parse(localStorage.getItem(STORAGE.visibility) || '{}'); } catch (_) { stored = {}; }
    if (stored.technical === false) {
      TECH_UI_PARTS.forEach((part) => {
        if (!(part in stored)) stored[part] = false;
      });
    }
    const result = {};
    UI_PARTS.forEach((part) => { result[part] = stored[part] !== false; });
    return result;
  }

  function applyVisibility(next, persist = true) {
    const visibility = { ...readVisibility(), ...(next || {}) };
    UI_PARTS.forEach((part) => {
      document.documentElement.classList.toggle('hide-ui-' + part, visibility[part] === false);
      const input = document.querySelector(`[data-ui-part="${part}"]`);
      if (input) input.checked = visibility[part] !== false;
    });
    if (persist) localStorage.setItem(STORAGE.visibility, JSON.stringify(visibility));
  }

  function applyContrast(value, persist = true) {
    const contrast = clamp(Number(value) || DEFAULT_CONTRAST, 60, 140);
    const scale = contrast / 100;
    const light = document.documentElement.dataset.theme === 'light';
    const bg = light ? '#f3f4f7' : '#1b1b1e';
    const text = light ? '#20232a' : '#f1f1f3';
    const card2Base = light ? .06 : .07;
    const card3Base = light ? .10 : .11;
    const lineBase = light ? .14 : .08;
    const mutedBase = light ? .55 : .45;
    const dimBase = light ? .38 : .28;
    document.documentElement.style.setProperty('--card-2', mix(bg, text, Math.min(.30, card2Base * scale)));
    document.documentElement.style.setProperty('--card-3', mix(bg, text, Math.min(.36, card3Base * scale)));
    document.documentElement.style.setProperty('--line', mix(bg, text, Math.min(.40, lineBase * scale)));
    document.documentElement.style.setProperty('--muted', mix(bg, text, Math.min(.82, mutedBase * scale)));
    document.documentElement.style.setProperty('--dim', mix(bg, text, Math.min(.68, dimBase * scale)));
    if (persist) localStorage.setItem(STORAGE.contrast, String(contrast));
    const input = $('#s_contrast');
    const label = $('#contrastValue');
    if (input && Number(input.value) !== contrast) input.value = String(contrast);
    if (label) label.textContent = contrast + '%';
  }

  function applyWaveformContrast(value, persist = true) {
    const contrast = clamp(Number(value) || DEFAULT_WAVEFORM_CONTRAST, 20, 100);
    const opacity = contrast / 100;
    document.documentElement.style.setProperty('--wave-opacity', opacity.toFixed(2));
    document.documentElement.style.setProperty('--wave-base-opacity', (opacity * .38).toFixed(3));
    if (persist) localStorage.setItem(STORAGE.waveformContrast, String(contrast));
    const input = $('#s_waveformContrast');
    const label = $('#waveformContrastValue');
    if (input && Number(input.value) !== contrast) input.value = String(contrast);
    if (label) label.textContent = contrast + '%';
  }

  function applyTextScale(value, persist = true) {
    const scale = clamp(Number(value) || DEFAULT_TEXT_SCALE, 80, 160);
    document.documentElement.style.setProperty('--text-scale', (scale / 100).toFixed(2));
    if (persist) localStorage.setItem(STORAGE.textScale, String(scale));
    const input = $('#s_textScale');
    const label = $('#textScaleValue');
    if (input && Number(input.value) !== scale) input.value = String(scale);
    if (label) label.textContent = scale + '%';
  }

  function themeIcon(theme) {
    if (theme === 'dark') return '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>';
    return '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
  }

  function applyTheme(value, persist = true) {
    const theme = value === 'light' ? 'light' : 'dark';
    document.documentElement.dataset.theme = theme;
    if (persist) localStorage.setItem(STORAGE.theme, theme);
    const button = $('#themeToggle');
    if (button) {
      button.innerHTML = themeIcon(theme);
      button.title = translateValue('Светлая / тёмная тема');
    }
    applyAccent(localStorage.getItem(STORAGE.accent) || DEFAULT_ACCENT);
    applyContrast(localStorage.getItem(STORAGE.contrast) || DEFAULT_CONTRAST, false);
  }

  function languageStrings(code = language) {
    const pack = I18N[code] || I18N.ru || { strings: {} };
    const primary = pack.strings || {};
    const fallbackPack = pack.fallback && I18N[pack.fallback] ? I18N[pack.fallback] : null;
    return { primary, fallback: fallbackPack && fallbackPack.strings ? fallbackPack.strings : {} };
  }

  function translateValue(value) {
    if (language === 'ru') return value;
    const { primary, fallback } = languageStrings();
    if (Object.prototype.hasOwnProperty.call(primary, value)) return primary[value];
    if (Object.prototype.hasOwnProperty.call(fallback, value)) return fallback[value];

    let match = /^(\d[\d\s.,]*) результатов$/.exec(value);
    if (match) {
      if (language === 'zh') return match[1] + ' 个结果';
      if (language === 'ko') return '결과 ' + match[1] + '개';
      return match[1] + ' results';
    }

    match = /^стр\. (\d+) из (\d+)$/.exec(value);
    if (match) {
      if (language === 'zh') return '第 ' + match[1] + ' 页，共 ' + match[2] + ' 页';
      if (language === 'ko') return match[1] + ' / ' + match[2] + ' 페이지';
      return 'page ' + match[1] + ' of ' + match[2];
    }

    match = /^(\d+) оценок$/.exec(value);
    if (match) {
      if (language === 'zh') return match[1] + ' 个评分';
      if (language === 'ko') return '평가 ' + match[1] + '개';
      return match[1] + ' ratings';
    }

    match = /^Скачать превью \((.+)\)$/.exec(value);
    if (match) {
      if (language === 'zh') return '下载预览 (' + match[1] + ')';
      if (language === 'ko') return '미리듣기 다운로드 (' + match[1] + ')';
      return 'Download preview (' + match[1] + ')';
    }

    match = /^Тег «(.+)» в чёрный список$/.exec(value);
    if (match) {
      if (language === 'zh') return '将标签“' + match[1] + '”加入黑名单';
      if (language === 'ko') return '태그 “' + match[1] + '”을 블랙리스트에 추가';
      return 'Blacklist tag “' + match[1] + '”';
    }
    return value;
  }

  function translateTextNode(node) {
    if (node.parentElement && node.parentElement.closest('[data-i18n-ignore]')) return;
    if (!textOriginal.has(node)) textOriginal.set(node, node.nodeValue);
    const original = textOriginal.get(node);
    if (language === 'ru') {
      if (node.nodeValue !== original) node.nodeValue = original;
      return;
    }
    const trimmed = original.trim();
    if (!trimmed) return;
    const translated = translateValue(trimmed);
    if (translated === trimmed) return;
    const left = original.match(/^\s*/)[0];
    const right = original.match(/\s*$/)[0];
    node.nodeValue = left + translated + right;
  }

  function translateElementAttributes(element) {
    if (element.closest && element.closest('[data-i18n-ignore]')) return;
    const attributes = ['title', 'placeholder', 'aria-label'];
    let originals = attrOriginal.get(element);
    if (!originals) {
      originals = {};
      attrOriginal.set(element, originals);
    }
    for (const name of attributes) {
      if (!element.hasAttribute(name)) continue;
      if (!(name in originals)) originals[name] = element.getAttribute(name);
      const original = originals[name];
      element.setAttribute(name, language === 'ru' ? original : translateValue(original));
    }
  }

  function translateTree(root = document.body) {
    if (!root) return;
    if (root.nodeType === Node.TEXT_NODE) {
      translateTextNode(root);
      return;
    }
    if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) return;
    if (root.nodeType === Node.ELEMENT_NODE && root.closest && root.closest('[data-i18n-ignore]')) return;
    if (root.nodeType === Node.ELEMENT_NODE) translateElementAttributes(root);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    let node = walker.currentNode;
    while (node) {
      if (node.nodeType === Node.TEXT_NODE) translateTextNode(node);
      else if (node.nodeType === Node.ELEMENT_NODE) translateElementAttributes(node);
      node = walker.nextNode();
    }
  }

  function applyLanguage(value, persist = true) {
    language = SUPPORTED_LANGUAGES.includes(value) ? value : 'ru';
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : language;
    if (persist) localStorage.setItem(STORAGE.language, language);
    const select = $('#s_language');
    if (select && select.value !== language) select.value = language;
    translateTree(document.body);
    applyTheme(document.documentElement.dataset.theme || 'dark', false);
  }

  function setSidebarWidth(value, persist = true) {
    const width = clamp(Number(value) || DEFAULT_SIDEBAR, MIN_SIDEBAR, MAX_SIDEBAR);
    document.documentElement.style.setProperty('--sidebar-w', width + 'px');
    if (persist) localStorage.setItem(STORAGE.sidebarWidth, String(width));
  }

  function setSidebarCollapsed(collapsed, persist = true) {
    const view = $('#view-search');
    if (!view) return;
    view.classList.toggle('filters-collapsed', Boolean(collapsed));
    if (persist) localStorage.setItem(STORAGE.sidebarCollapsed, collapsed ? '1' : '0');
  }

  function bindSidebar() {
    const resizer = $('#sidebarResizer');
    const collapse = $('#collapseFilters');
    const expand = $('#expandFilters');
    if (collapse) collapse.addEventListener('click', () => setSidebarCollapsed(true));
    if (expand) expand.addEventListener('click', () => setSidebarCollapsed(false));
    if (!resizer) return;

    let dragging = false;
    const move = (event) => {
      if (!dragging) return;
      setSidebarWidth(event.clientX);
    };
    const stop = () => {
      dragging = false;
      resizer.classList.remove('dragging');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    resizer.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      dragging = true;
      resizer.classList.add('dragging');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      resizer.setPointerCapture(event.pointerId);
      move(event);
    });
    resizer.addEventListener('pointermove', move);
    resizer.addEventListener('pointerup', stop);
    resizer.addEventListener('pointercancel', stop);
    resizer.addEventListener('dblclick', () => setSidebarWidth(DEFAULT_SIDEBAR));
    resizer.addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      const current = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sidebar-w'), 10) || DEFAULT_SIDEBAR;
      setSidebarWidth(current + (event.key === 'ArrowLeft' ? -16 : 16));
    });
  }

  function bindSettings() {
    const accent = $('#s_accent');
    const lang = $('#s_language');
    const contrast = $('#s_contrast');
    const waveformContrast = $('#s_waveformContrast');
    const textScale = $('#s_textScale');
    if (accent) {
      accent.value = normalizeHex(localStorage.getItem(STORAGE.accent) || DEFAULT_ACCENT);
      accent.addEventListener('input', () => applyAccent(accent.value));
      accent.addEventListener('change', () => applyAccent(accent.value));
    }
    if (lang) {
      lang.value = language;
      lang.addEventListener('change', () => applyLanguage(lang.value));
    }
    if (contrast) {
      contrast.value = localStorage.getItem(STORAGE.contrast) || String(DEFAULT_CONTRAST);
      contrast.addEventListener('input', () => applyContrast(contrast.value));
      contrast.addEventListener('change', () => applyContrast(contrast.value));
    }
    if (waveformContrast) {
      waveformContrast.value = localStorage.getItem(STORAGE.waveformContrast) || String(DEFAULT_WAVEFORM_CONTRAST);
      waveformContrast.addEventListener('input', () => applyWaveformContrast(waveformContrast.value));
      waveformContrast.addEventListener('change', () => applyWaveformContrast(waveformContrast.value));
    }
    if (textScale) {
      textScale.value = localStorage.getItem(STORAGE.textScale) || String(DEFAULT_TEXT_SCALE);
      textScale.addEventListener('input', () => applyTextScale(textScale.value));
      textScale.addEventListener('change', () => applyTextScale(textScale.value));
    }
    document.querySelectorAll('[data-ui-part]').forEach((input) => {
      input.addEventListener('change', () => applyVisibility({ [input.dataset.uiPart]: input.checked }));
    });
    applyVisibility(readVisibility(), false);
  }

  function bindFirstRunDisclaimer() {
    if (localStorage.getItem(STORAGE.disclaimer) === '1') return;
    const modal = $('#firstRunDisclaimer');
    const accept = $('#acceptFirstRunDisclaimer');
    if (!modal || !accept) return;

    const close = () => {
      localStorage.setItem(STORAGE.disclaimer, '1');
      modal.classList.add('hidden');
    };
    accept.addEventListener('click', close, { once: true });
    modal.classList.remove('hidden');
    accept.focus();
  }

  function bindTheme() {
    const button = $('#themeToggle');
    if (!button) return;
    button.addEventListener('click', () => {
      const current = document.documentElement.dataset.theme || 'dark';
      applyTheme(current === 'dark' ? 'light' : 'dark');
    });
  }

  const observer = new MutationObserver((records) => {
    if (language === 'ru') return;
    for (const record of records) {
      for (const node of record.addedNodes) translateTree(node);
    }
  });

  setSidebarWidth(localStorage.getItem(STORAGE.sidebarWidth) || DEFAULT_SIDEBAR, false);
  setSidebarCollapsed(localStorage.getItem(STORAGE.sidebarCollapsed) === '1', false);
  applyTheme(localStorage.getItem(STORAGE.theme) || 'dark', false);
  applyWaveformContrast(localStorage.getItem(STORAGE.waveformContrast) || DEFAULT_WAVEFORM_CONTRAST, false);
  applyTextScale(localStorage.getItem(STORAGE.textScale) || DEFAULT_TEXT_SCALE, false);
  applyVisibility(readVisibility(), false);
  bindSidebar();
  bindTheme();
  bindSettings();
  applyLanguage(language, false);
  bindFirstRunDisclaimer();
  observer.observe(document.body, { childList: true, subtree: true });

  window.FSUI = { applyTheme, applyAccent, applyContrast, applyWaveformContrast, applyTextScale, applyLanguage, applyVisibility, setSidebarWidth, setSidebarCollapsed };
})();
