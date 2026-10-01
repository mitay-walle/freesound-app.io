(() => {
  'use strict';

  const STATIC_MODE = location.hostname.endsWith('.github.io');
  if (!STATIC_MODE) return;

  const FS_API = 'https://freesound.org/apiv2';
  const FS_OAUTH_AUTHORIZE = 'https://freesound.org/apiv2/oauth2/authorize/';
  const FS_OAUTH_TOKEN = 'https://freesound.org/apiv2/oauth2/access_token/';
  const VERSION = '0.1.0-pages';
  const STORAGE = {
    settings: 'fs_static_settings',
    blacklist: 'fs_static_blacklist',
    favorites: 'fs_static_favorites',
    searches: 'fs_static_searches',
    oauth: 'fs_static_oauth',
    downloads: 'fs_static_downloads',
    oauthState: 'fs_static_oauth_state',
  };
  const DEFAULT_SETTINGS = {
    apiKey: '',
    clientId: '',
    clientSecret: '',
    downloadDir: 'Браузер → Загрузки',
    pageSize: 30,
    previewQuality: 'hq-mp3',
    blacklistServerSide: true,
    blacklistMaxServerSide: 300,
    attributionLog: false,
  };
  const BL_KINDS = { user: 'users', tag: 'tags', pack: 'packs', word: 'words' };
  const BL_KEY = { user: 'username', tag: 'tag', pack: 'id', word: 'word' };
  const OAUTH_ONLY = [
    /^\/sounds\/\d+\/download\/?$/,
    /^\/sounds\/upload\/?$/,
    /^\/sounds\/describe\/?$/,
    /^\/sounds\/pending_uploads\/?$/,
    /^\/sounds\/\d+\/(edit|bookmark|rate|comment)\/?$/,
    /^\/packs\/\d+\/download\/?$/,
    /^\/me\/?/,
  ];
  const FILTERABLE = [/^\/search\/?(text\/?)?$/, /^\/sounds\/\d+\/similar\/?$/];

  const nativeFetch = window.fetch.bind(window);
  const nativeOpen = window.open.bind(window);

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw == null ? structuredClone(fallback) : JSON.parse(raw);
    } catch (_) {
      return structuredClone(fallback);
    }
  }

  function write(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
    return value;
  }

  function settings() {
    return { ...DEFAULT_SETTINGS, ...read(STORAGE.settings, {}) };
  }

  function blacklist() {
    const bl = read(STORAGE.blacklist, {});
    for (const list of Object.values(BL_KINDS)) if (!Array.isArray(bl[list])) bl[list] = [];
    return bl;
  }

  function jsonResponse(status, data, headers = {}) {
    return new Response(JSON.stringify(data), {
      status,
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
    });
  }

  function errorResponse(status, detail) {
    return jsonResponse(status, { detail });
  }

  function cleanValue(kind, value) {
    const v = String(value ?? '').trim();
    if (kind === 'tag' || kind === 'word') return v.toLowerCase();
    if (kind === 'pack') return v.replace(/\D/g, '');
    return v;
  }

  function findBlacklist(bl, kind, value) {
    const key = BL_KEY[kind];
    const norm = cleanValue(kind, value).toLowerCase();
    return bl[BL_KINDS[kind]].findIndex((it) => String(it[key]).toLowerCase() === norm);
  }

  function solrQuote(value) {
    return '"' + String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
  }

  function injectBlacklist(target, currentSettings) {
    if (!currentSettings.blacklistServerSide) return 0;
    const bl = blacklist();
    const max = currentSettings.blacklistMaxServerSide || 300;
    const clauses = [];
    let count = 0;
    const users = bl.users.slice(0, max).map((x) => x.username).filter(Boolean);
    if (users.length) { clauses.push('-username:(' + users.map(solrQuote).join(' OR ') + ')'); count += users.length; }
    const tags = bl.tags.slice(0, max).map((x) => x.tag).filter(Boolean);
    if (tags.length) { clauses.push('-tag:(' + tags.map(solrQuote).join(' OR ') + ')'); count += tags.length; }
    const packs = bl.packs.filter((x) => x.name).slice(0, max).map((x) => x.name);
    if (packs.length) { clauses.push('-pack:(' + packs.map(solrQuote).join(' OR ') + ')'); count += packs.length; }
    if (clauses.length) {
      const existing = target.searchParams.get('filter');
      target.searchParams.set('filter', [existing && existing.trim(), ...clauses].filter(Boolean).join(' '));
    }
    const words = bl.words.slice(0, max).map((x) => x.word).filter((x) => /^[\p{L}\p{N}_-]+$/u.test(x));
    if (words.length && target.searchParams.has('query')) {
      const query = target.searchParams.get('query') || '';
      target.searchParams.set('query', [query.trim(), ...words.map((x) => '-' + x)].filter(Boolean).join(' '));
      count += words.length;
    }
    return count;
  }

  function baseUrl() {
    return new URL('./', location.href.split('#')[0].split('?')[0]);
  }

  function redirectUri() {
    return new URL('oauth-callback.html', baseUrl()).href;
  }

  function randomState() {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (x) => x.toString(16).padStart(2, '0')).join('');
  }

  async function exchangeToken(params) {
    const s = settings();
    if (!s.clientId || !s.clientSecret) throw Object.assign(new Error('Client ID и Client Secret обязательны для OAuth2.'), { status: 400 });
    const body = new URLSearchParams({ client_id: s.clientId, client_secret: s.clientSecret, ...params });
    const response = await nativeFetch(FS_OAUTH_TOKEN, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
      body,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.access_token) {
      throw Object.assign(new Error(data.error_description || data.detail || data.error || `OAuth2 HTTP ${response.status}`), { status: response.status || 502 });
    }
    const previous = read(STORAGE.oauth, {});
    const oauth = {
      access_token: data.access_token,
      refresh_token: data.refresh_token || previous.refresh_token || null,
      scope: data.scope || '',
      expires_at: Date.now() + (Number(data.expires_in) || 86400) * 1000,
      username: previous.username || null,
      avatar: previous.avatar || null,
      obtained_at: new Date().toISOString(),
    };
    write(STORAGE.oauth, oauth);
    return oauth;
  }

  async function getBearer() {
    let oauth = read(STORAGE.oauth, null);
    if (!oauth || !oauth.access_token) return null;
    if (oauth.expires_at && oauth.expires_at - Date.now() < 120000 && oauth.refresh_token) {
      try { oauth = await exchangeToken({ grant_type: 'refresh_token', refresh_token: oauth.refresh_token }); }
      catch (_) { return null; }
    }
    return oauth.access_token;
  }

  async function enrichOAuthProfile(oauth) {
    try {
      const response = await nativeFetch(`${FS_API}/me/`, { headers: { authorization: `Bearer ${oauth.access_token}`, accept: 'application/json' } });
      if (!response.ok) return oauth;
      const me = await response.json();
      oauth.username = me.username || oauth.username || null;
      oauth.avatar = me.avatar && (me.avatar.medium || me.avatar.small) || null;
      write(STORAGE.oauth, oauth);
    } catch (_) { /* non-fatal */ }
    return oauth;
  }

  async function finishOAuthCode(code) {
    return enrichOAuthProfile(await exchangeToken({ grant_type: 'authorization_code', code }));
  }

  function oauthAuthorizeUrl() {
    const s = settings();
    if (!s.clientId) throw new Error('Client ID не настроен.');
    const state = randomState();
    localStorage.setItem(STORAGE.oauthState, state);
    const url = new URL(FS_OAUTH_AUTHORIZE);
    url.searchParams.set('client_id', s.clientId);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('state', state);
    return url.toString();
  }

  async function apiRequest(input, init = {}) {
    const requestUrl = new URL(input instanceof URL ? input.href : (typeof input === 'string' ? input : input.url), location.href);
    const apiPath = requestUrl.pathname.replace(/^\/api/, '') || '/';
    const target = new URL(FS_API + apiPath);
    requestUrl.searchParams.forEach((v, k) => target.searchParams.append(k, v));
    target.searchParams.delete('token');
    const noBlacklist = target.searchParams.get('_nobl') === '1';
    target.searchParams.delete('_nobl');
    const s = settings();
    const injected = !noBlacklist && FILTERABLE.some((re) => re.test(apiPath)) ? injectBlacklist(target, s) : 0;
    const needsOAuth = OAUTH_ONLY.some((re) => re.test(apiPath));
    const headers = new Headers(init.headers || {});
    headers.set('accept', 'application/json');
    let authKind = 'none';
    if (needsOAuth) {
      const bearer = await getBearer();
      if (!bearer) return errorResponse(401, 'Этот ресурс требует OAuth2. Войдите в Freesound в настройках.');
      headers.set('authorization', `Bearer ${bearer}`);
      authKind = 'oauth';
    } else if (s.apiKey) {
      target.searchParams.set('token', s.apiKey);
      authKind = 'token';
    } else {
      const bearer = await getBearer();
      if (!bearer) return errorResponse(401, 'Нет API key. Откройте настройки и вставьте Freesound Client secret / Api key.');
      headers.set('authorization', `Bearer ${bearer}`);
      authKind = 'oauth';
    }
    let response;
    try {
      response = await nativeFetch(target, { ...init, headers });
    } catch (e) {
      return errorResponse(502, `Не удалось обратиться к freesound.org: ${e.message}`);
    }
    const text = await response.text();
    const outHeaders = new Headers();
    outHeaders.set('content-type', response.headers.get('content-type') || 'application/json; charset=utf-8');
    outHeaders.set('cache-control', 'no-store');
    const safeUrl = new URL(target);
    safeUrl.searchParams.delete('token');
    outHeaders.set('x-fs-url', safeUrl.toString());
    outHeaders.set('x-fs-auth', authKind);
    outHeaders.set('x-fs-blacklist-injected', String(injected));
    return new Response(text, { status: response.status, statusText: response.statusText, headers: outHeaders });
  }

  async function fetchSound(id) {
    const s = settings();
    const target = new URL(`${FS_API}/sounds/${id}/`);
    target.searchParams.set('fields', 'id,name,username,type,previews,license,url,duration,pack');
    if (s.apiKey) target.searchParams.set('token', s.apiKey);
    else {
      const bearer = await getBearer();
      if (!bearer) throw Object.assign(new Error('Нет API key.'), { status: 401 });
      const response = await nativeFetch(target, { headers: { authorization: `Bearer ${bearer}`, accept: 'application/json' } });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw Object.assign(new Error(data.detail || `HTTP ${response.status}`), { status: response.status });
      return data;
    }
    const response = await nativeFetch(target, { headers: { accept: 'application/json' } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(data.detail || `HTTP ${response.status}`), { status: response.status });
    return data;
  }

  function sanitizeFilename(value) {
    return String(value || 'sound').replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').replace(/\s+/g, ' ').trim().slice(0, 180) || 'sound';
  }

  async function browserDownload(body) {
    const id = Number(body.id);
    if (!Number.isInteger(id) || id <= 0) throw Object.assign(new Error('Некорректный sound id'), { status: 400 });
    const kind = body.kind || 'original';
    const sound = await fetchSound(id);
    let sourceUrl;
    let headers = {};
    let ext;
    if (kind === 'original') {
      const bearer = await getBearer();
      if (!bearer) throw Object.assign(new Error('Для оригинала нужен OAuth2-вход в Freesound.'), { status: 401 });
      sourceUrl = `${FS_API}/sounds/${id}/download/`;
      headers = { authorization: `Bearer ${bearer}` };
      ext = '.' + (sound.type || 'wav');
    } else {
      sourceUrl = sound.previews && sound.previews['preview-' + kind];
      if (!sourceUrl) throw Object.assign(new Error(`Превью ${kind} недоступно.`), { status: 400 });
      ext = kind.endsWith('ogg') ? '.ogg' : '.mp3';
    }
    const base = sanitizeFilename(String(sound.name || '').replace(/\.[a-z0-9]{2,4}$/i, ''));
    const file = `${id}__${sanitizeFilename(sound.username)}__${base}${kind === 'original' ? '' : '__' + kind}${ext}`;
    let bytes = 0;
    try {
      const response = await nativeFetch(sourceUrl, { headers, redirect: 'follow' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      bytes = blob.size;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (_) {
      const a = document.createElement('a');
      a.href = sourceUrl;
      a.target = '_blank';
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
    const rec = { id, name: sound.name, username: sound.username, license: sound.license, url: sound.url, kind, file, bytes, downloaded_at: new Date().toISOString() };
    const log = read(STORAGE.downloads, { items: [] });
    log.items.unshift(rec);
    log.items = log.items.slice(0, 5000);
    write(STORAGE.downloads, log);
    return rec;
  }

  async function localRequest(input, init = {}) {
    const url = new URL(input instanceof URL ? input.href : (typeof input === 'string' ? input : input.url), location.href);
    const path = url.pathname.replace(/^\/local/, '');
    const method = String(init.method || 'GET').toUpperCase();
    let body = {};
    if (init.body) {
      try { body = JSON.parse(init.body); } catch (_) { body = {}; }
    }
    if (path === '/status' && method === 'GET') {
      const s = settings();
      const bl = blacklist();
      const oauth = read(STORAGE.oauth, null);
      return jsonResponse(200, {
        version: VERSION,
        mock: false,
        hasApiKey: Boolean(s.apiKey),
        hasClient: Boolean(s.clientId && s.clientSecret),
        oauth: oauth && oauth.access_token ? { connected: true, username: oauth.username, avatar: oauth.avatar || null, expiresAt: oauth.expires_at, scope: oauth.scope } : { connected: false },
        redirectUri: redirectUri(),
        downloadDir: s.downloadDir,
        blacklistCount: bl.users.length + bl.tags.length + bl.packs.length + bl.words.length,
        pageSize: s.pageSize,
        previewQuality: s.previewQuality,
        blacklistServerSide: s.blacklistServerSide,
      });
    }
    if (path === '/settings') {
      if (method === 'GET') return jsonResponse(200, settings());
      if (method === 'PUT' || method === 'POST') {
        const next = { ...settings() };
        for (const key of Object.keys(DEFAULT_SETTINGS)) {
          if (!(key in body)) continue;
          if (typeof DEFAULT_SETTINGS[key] === 'number') next[key] = Number(body[key]) || DEFAULT_SETTINGS[key];
          else if (typeof DEFAULT_SETTINGS[key] === 'boolean') next[key] = Boolean(body[key]);
          else next[key] = String(body[key] ?? '').trim();
        }
        next.pageSize = Math.min(150, Math.max(1, next.pageSize));
        if (!next.downloadDir) next.downloadDir = DEFAULT_SETTINGS.downloadDir;
        return jsonResponse(200, write(STORAGE.settings, next));
      }
    }
    if (path === '/blacklist') {
      if (method === 'GET') return jsonResponse(200, blacklist());
      if (method === 'PUT') return jsonResponse(200, write(STORAGE.blacklist, body || {}));
    }
    if (path === '/blacklist/add' && method === 'POST') {
      const kind = String(body.kind || 'user');
      if (!BL_KINDS[kind]) return errorResponse(400, 'Неизвестный тип blacklist.');
      const values = (Array.isArray(body.values) ? body.values : [body.value]).map((x) => cleanValue(kind, x)).filter(Boolean);
      if (!values.length) return errorResponse(400, 'value is required');
      const bl = blacklist();
      const list = bl[BL_KINDS[kind]];
      const key = BL_KEY[kind];
      let added = 0;
      let lastName = '';
      for (const value of values) {
        if (findBlacklist(bl, kind, value) >= 0) continue;
        const item = { [key]: value, note: String(body.note || ''), added: new Date().toISOString() };
        if (kind === 'pack') {
          item.name = String(body.name || '');
          if (!item.name) {
            try { const pack = await (await apiRequest(`/api/packs/${value}/`)).json(); item.name = pack.name || ''; } catch (_) { /* optional */ }
          }
          lastName = item.name;
        }
        list.push(item);
        added += 1;
      }
      write(STORAGE.blacklist, bl);
      return jsonResponse(200, { ...bl, added, lastName });
    }
    if (path === '/blacklist/remove' && method === 'POST') {
      const kind = String(body.kind || 'user');
      if (!BL_KINDS[kind]) return errorResponse(400, 'Неизвестный тип blacklist.');
      const bl = blacklist();
      const index = findBlacklist(bl, kind, body.value);
      if (index >= 0) bl[BL_KINDS[kind]].splice(index, 1);
      return jsonResponse(200, write(STORAGE.blacklist, bl));
    }
    if (path === '/blacklist/note' && method === 'POST') {
      const kind = String(body.kind || 'user');
      if (!BL_KINDS[kind]) return errorResponse(400, 'Неизвестный тип blacklist.');
      const bl = blacklist();
      const index = findBlacklist(bl, kind, body.value);
      if (index < 0) return errorResponse(404, 'Запись не найдена в blacklist.');
      bl[BL_KINDS[kind]][index].note = String(body.note || '');
      return jsonResponse(200, write(STORAGE.blacklist, bl));
    }
    if (path === '/favorites') {
      if (method === 'GET') return jsonResponse(200, read(STORAGE.favorites, { sounds: [] }));
      if (method === 'PUT') return jsonResponse(200, write(STORAGE.favorites, { sounds: Array.isArray(body.sounds) ? body.sounds : [] }));
    }
    if (path === '/favorites/toggle' && method === 'POST') {
      const sound = body.sound;
      if (!sound || !sound.id) return errorResponse(400, 'sound with id is required');
      const fav = read(STORAGE.favorites, { sounds: [] });
      const index = fav.sounds.findIndex((x) => x.id === sound.id);
      let isFav;
      if (index >= 0) { fav.sounds.splice(index, 1); isFav = false; }
      else { fav.sounds.unshift({ ...sound, added: new Date().toISOString() }); isFav = true; }
      write(STORAGE.favorites, fav);
      return jsonResponse(200, { isFav, count: fav.sounds.length });
    }
    if (path === '/searches') {
      if (method === 'GET') return jsonResponse(200, read(STORAGE.searches, { items: [] }));
      if (method === 'PUT') return jsonResponse(200, write(STORAGE.searches, { items: Array.isArray(body.items) ? body.items : [] }));
    }
    if (path === '/downloads' && method === 'GET') return jsonResponse(200, read(STORAGE.downloads, { items: [] }));
    if (path === '/download' && method === 'POST') {
      try { return jsonResponse(200, await browserDownload(body)); }
      catch (e) { return errorResponse(e.status || 500, e.message); }
    }
    if (path === '/open-folder' && method === 'POST') return errorResponse(400, 'GitHub Pages работает в браузере и не может открыть папку в проводнике.');
    if (path === '/oauth/manual' && method === 'POST') {
      try {
        const oauth = await finishOAuthCode(String(body.code || '').trim());
        return jsonResponse(200, { connected: true, username: oauth.username, avatar: oauth.avatar || null, expiresAt: oauth.expires_at });
      } catch (e) { return errorResponse(e.status || 500, e.message); }
    }
    if (path === '/oauth/logout' && method === 'POST') {
      localStorage.removeItem(STORAGE.oauth);
      return jsonResponse(200, { connected: false });
    }
    if (path === '/oauth/refresh' && method === 'POST') {
      const oauth = read(STORAGE.oauth, null);
      if (!oauth || !oauth.refresh_token) return errorResponse(400, 'Not connected');
      try {
        const fresh = await exchangeToken({ grant_type: 'refresh_token', refresh_token: oauth.refresh_token });
        return jsonResponse(200, { connected: true, username: fresh.username, expiresAt: fresh.expires_at });
      } catch (e) { return errorResponse(e.status || 500, e.message); }
    }
    return errorResponse(404, `Unknown local route ${method} ${path}`);
  }

  window.fetch = async function patchedFetch(input, init = {}) {
    const url = new URL(input instanceof URL ? input.href : (typeof input === 'string' ? input : input.url), location.href);
    if (url.origin === location.origin && url.pathname.startsWith('/api/')) return apiRequest(input, init);
    if (url.origin === location.origin && url.pathname.startsWith('/local/')) return localRequest(input, init);
    return nativeFetch(input, init);
  };

  window.open = function patchedOpen(url, target, features) {
    if (url === '/oauth/start') {
      let authUrl;
      try { authUrl = oauthAuthorizeUrl(); }
      catch (e) { alert(e.message); return null; }
      const popup = nativeOpen(authUrl, target, features);
      if (popup) return popup;
      location.href = authUrl;
      return { closed: false };
    }
    return nativeOpen(url, target, features);
  };

  async function handleOAuthCallback() {
    const params = new URLSearchParams(location.search);
    const error = params.get('error');
    const code = params.get('code');
    const state = params.get('state');
    if (error) throw new Error(error === 'access_denied' ? 'Доступ не был разрешён.' : error);
    if (!code) throw new Error('В ответе Freesound нет кода авторизации.');
    const expectedState = localStorage.getItem(STORAGE.oauthState);
    if (expectedState && state && expectedState !== state) throw new Error('OAuth state не совпадает. Начните вход заново.');
    localStorage.removeItem(STORAGE.oauthState);
    return finishOAuthCode(code);
  }

  window.FSStatic = { active: true, redirectUri, handleOAuthCallback, baseUrl: () => baseUrl().href };
})();
