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
    visibility: 'fs_ui_visibility',
    disclaimer: 'fs_freesound_disclaimer_v1',
  };
  const DEFAULT_ACCENT = '#3d7bff';
  const DEFAULT_SIDEBAR = 322;
  const MIN_SIDEBAR = 240;
  const MAX_SIDEBAR = 600;
  const DEFAULT_CONTRAST = 100;
  const UI_PARTS = ['waveform', 'technical', 'author', 'rating', 'downloads', 'comments', 'license', 'date', 'pack', 'category', 'tags', 'description', 'actions'];

  const EN = new Map(Object.entries({
    'Поиск': 'Search',
    'Избранное': 'Favorites',
    'Чёрный список': 'Blacklist',
    'Загрузки': 'Downloads',
    'Настройки': 'Settings',
    'Фильтры': 'Filters',
    'Сбросить': 'Reset',
    'Применить': 'Apply',
    'Применить фильтры': 'Apply filters',
    'Слова и теги': 'Words and tags',
    'Исключить слова': 'Exclude words',
    'Теги — обязательно': 'Required tags',
    'Теги — исключить': 'Excluded tags',
    'Категория': 'Category',
    'Подкатегория': 'Subcategory',
    'Формат и качество': 'Format and quality',
    'Тип файла': 'File type',
    'Каналы': 'Channels',
    'Частота дискретизации': 'Sample rate',
    'Разрядность': 'Bit depth',
    'Размер файла': 'File size',
    'Длительность': 'Duration',
    'Лицензия': 'License',
    'Рейтинг и популярность': 'Rating and popularity',
    'Рейтинг': 'Rating',
    'Оценок не меньше': 'Minimum ratings',
    'Скачиваний не меньше': 'Minimum downloads',
    'Дата загрузки': 'Upload date',
    'Автор, пак, прочее': 'Author, pack and more',
    'Только автор (точное имя)': 'Author only (exact username)',
    'Слово в названии пака': 'Word in pack name',
    'Геотег': 'Geotag',
    'Ремикс другого звука': 'Remix of another sound',
    'Имеет ремиксы': 'Has remixes',
    'Ритм и высота': 'Rhythm and pitch',
    'Темп': 'Tempo',
    'Нота': 'Note',
    'Октава': 'Octave',
    'Уверенность определения ноты не ниже': 'Minimum note confidence',
    'Тональность': 'Tonality',
    'Зацикливается (loopable)': 'Loopable',
    'Одно событие': 'Single event',
    'Реверберация': 'Reverb',
    'Громкость не ниже': 'Minimum loudness',
    'Любые аудио-дескрипторы': 'Any audio descriptors',
    'Похожие звуки': 'Similar sounds',
    'ID звука-образца': 'Reference sound ID',
    'Пространство сходства': 'Similarity space',
    'Эксперт: Solr-фильтр': 'Expert: Solr filter',
    'Дополнительный фильтр': 'Additional filter',
    'Ручной режим: использовать только текст ниже': 'Manual mode: use only the text below',
    'Сортировка по цели': 'Target sorting',
    'Веса полей': 'Field weights',
    'Итоговый filter': 'Final filter',
    'копировать': 'copy',
    'Сортировка': 'Sort',
    'На странице': 'Per page',
    'по пакам': 'group packs',
    'Сохранённые…': 'Saved…',
    'Сохранить': 'Save',
    'Экспорт JSON': 'Export JSON',
    'Скачать все превью': 'Download all previews',
    'Массовый импорт / экспорт': 'Bulk import / export',
    'Импортировать в текущий раздел': 'Import into current section',
    'Скопировать список': 'Copy list',
    'Автор': 'Author',
    'Заметка': 'Note',
    'Добавлен': 'Added',
    'Звук': 'Sound',
    'Вид': 'Type',
    'Размер': 'Size',
    'Когда': 'When',
    'Интерфейс': 'Interface',
    'Язык': 'Language',
    'Акцентный цвет': 'Accent color',
    'Контраст': 'Contrast',
    'Элементы результата поиска': 'Search result elements',
    'Тех. параметры': 'Technical details',
    'Скачивания': 'Downloads',
    'Комментарии': 'Comments',
    'Лицензия': 'License',
    'Дата': 'Date',
    'Пак': 'Pack',
    'Категория': 'Category',
    'Теги': 'Tags',
    'Описание': 'Description',
    'Действия справа': 'Right-side actions',
    'Пресеты фильтров…': 'Filter presets…',
    'К дефолту': 'Defaults',
    'Сохранить как основной поиск': 'Save as main search',
    'Импорт JSON': 'Import JSON',
    'Аккаунт Freesound': 'Freesound account',
    'Войти через Freesound': 'Sign in with Freesound',
    'Выйти': 'Sign out',
    'Пошаговая настройка': 'Setup wizard',
    'Ключи API': 'API credentials',
    'Если Freesound показал код вместо перенаправления': 'If Freesound showed a code instead of redirecting',
    'Обменять код': 'Exchange code',
    'Загрузки и воспроизведение': 'Downloads and playback',
    'Папка для скачивания': 'Download folder',
    'Качество превью': 'Preview quality',
    'Результатов на странице': 'Results per page',
    'Вести файл _attribution.txt в папке загрузок (для лицензий CC BY)': 'Keep _attribution.txt in the download folder (for CC BY licenses)',
    'Исключать на стороне API (рекомендуется)': 'Exclude on the API side (recommended)',
    'Максимум записей одного вида в запросе': 'Maximum entries of one type per request',
    'Проверить лимиты API': 'Check API limits',
    'Ничего не играет': 'Nothing is playing',
    'Повтор': 'Loop',
    'Автоматически играть следующий': 'Automatically play next',
    'Проиграть заново': 'Replay',
    'Любая': 'Any',
    'Любые': 'Any',
    'Любой': 'Any',
    'Да': 'Yes',
    'Нет': 'No',
    'Не важно': 'Does not matter',
    'Только с геотегом': 'Only geotagged',
    'Моно': 'Mono',
    'Стерео': 'Stereo',
    'все теги': 'all tags',
    'любой из тегов': 'any tag',
    'Релевантность': 'Relevance',
    'Сначала новые': 'Newest first',
    'Сначала старые': 'Oldest first',
    'Больше скачиваний': 'Most downloaded',
    'Меньше скачиваний': 'Least downloaded',
    'Выше рейтинг': 'Highest rated',
    'Ниже рейтинг': 'Lowest rated',
    'Длиннее': 'Longest first',
    'Короче': 'Shortest first',
    'По умолчанию': 'Default',
    'Неделя': 'Week',
    'Месяц': 'Month',
    'Год': 'Year',
    '5 лет': '5 years',
    'Добавить': 'Add',
    'Открыть папку': 'Open folder',
    'Русский': 'Russian',
    'Светлая / тёмная тема': 'Light / dark theme',
    'Свернуть фильтры': 'Collapse filters',
    'Показать фильтры': 'Show filters',
    'Изменить ширину фильтров': 'Resize filters',
    'Что ищем? Например: rain loop -thunder   или   "door slam"': 'Search sounds, e.g. rain loop -thunder   or   "door slam"',
    'поиск по списку': 'search list',
    'заметка (необязательно)': 'note (optional)',
    'по одному значению на строку': 'one value per line',
    'фильтр по названию/автору/тегу': 'filter by name/author/tag',
    'код авторизации': 'authorization code',
  }));

  const textOriginal = new WeakMap();
  const attrOriginal = new WeakMap();
  let language = localStorage.getItem(STORAGE.language) || 'ru';

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
      button.title = language === 'en' ? 'Light / dark theme' : 'Светлая / тёмная тема';
    }
    applyAccent(localStorage.getItem(STORAGE.accent) || DEFAULT_ACCENT);
    applyContrast(localStorage.getItem(STORAGE.contrast) || DEFAULT_CONTRAST, false);
  }

  function translateValue(value) {
    if (language !== 'en') return value;
    if (EN.has(value)) return EN.get(value);
    let match = /^(\d[\d\s.,]*) результатов$/.exec(value);
    if (match) return match[1] + ' results';
    match = /^стр\. (\d+) из (\d+)$/.exec(value);
    if (match) return 'page ' + match[1] + ' of ' + match[2];
    return value;
  }

  function translateTextNode(node) {
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
      element.setAttribute(name, language === 'en' ? translateValue(original) : original);
    }
  }

  function translateTree(root = document.body) {
    if (!root) return;
    if (root.nodeType === Node.TEXT_NODE) {
      translateTextNode(root);
      return;
    }
    if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) return;
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
    language = value === 'en' ? 'en' : 'ru';
    document.documentElement.lang = language;
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
    document.querySelectorAll('[data-ui-part]').forEach((input) => {
      input.addEventListener('change', () => applyVisibility({ [input.dataset.uiPart]: input.checked }));
    });
    applyVisibility(readVisibility(), false);
  }

  function bindFirstRunDisclaimer() {
    if (localStorage.getItem(STORAGE.disclaimer) === '1') return;
    const modal = $('#firstRunDisclaimer');
    const title = $('#firstRunDisclaimerTitle');
    const text = $('#firstRunDisclaimerText');
    const accept = $('#acceptFirstRunDisclaimer');
    if (!modal || !title || !text || !accept) return;

    if (language === 'en') {
      title.textContent = 'About this app';
      text.innerHTML = '<p><b>This is an unofficial, non-commercial client for the Freesound API.</b></p>' +
        '<p>The site is not monetized and its author receives no financial benefit from operating it.</p>' +
        '<p>This site is not part of Freesound and is not affiliated with Music Technology Group / Universitat Pompeu Fabra.</p>' +
        '<p>Data and sounds are loaded from Freesound; use of the API and sounds is governed by Freesound terms and the license of each individual sound.</p>';
      const link = modal.querySelector('a');
      if (link) link.textContent = 'Open Freesound';
      accept.textContent = 'Got it';
    }

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
    if (language !== 'en') return;
    for (const record of records) {
      for (const node of record.addedNodes) translateTree(node);
    }
  });

  setSidebarWidth(localStorage.getItem(STORAGE.sidebarWidth) || DEFAULT_SIDEBAR, false);
  setSidebarCollapsed(localStorage.getItem(STORAGE.sidebarCollapsed) === '1', false);
  applyTheme(localStorage.getItem(STORAGE.theme) || 'dark', false);
  applyVisibility(readVisibility(), false);
  bindSidebar();
  bindTheme();
  bindSettings();
  applyLanguage(language, false);
  bindFirstRunDisclaimer();
  observer.observe(document.body, { childList: true, subtree: true });

  window.FSUI = { applyTheme, applyAccent, applyContrast, applyLanguage, applyVisibility, setSidebarWidth, setSidebarCollapsed };
})();
