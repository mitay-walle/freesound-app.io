#!/usr/bin/env node
'use strict';

/*
 * Freesound App — local server.
 *
 * Responsibilities:
 *   - serve the static UI from ./public
 *   - proxy /api/* to https://freesound.org/apiv2/* adding the API key (or OAuth2 bearer)
 *   - inject the author blacklist into every search / similarity request (server side)
 *   - keep local state in ./data/*.json (settings, blacklist, favorites, saved searches, oauth)
 *   - download previews / originals into a folder, keeping an attribution log
 *
 * Zero dependencies: Node >= 20 (uses global fetch).
 */

const http = require('http');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const { pipeline } = require('stream/promises');
const { Readable } = require('stream');
const { spawn } = require('child_process');

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_DIR = path.join(ROOT, 'data');
const MOCK_DIR = path.join(ROOT, 'mock');

const FS_API = 'https://freesound.org/apiv2';
const FS_OAUTH_AUTHORIZE = 'https://freesound.org/apiv2/oauth2/authorize/';
const FS_OAUTH_TOKEN = 'https://freesound.org/apiv2/oauth2/access_token/';

const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT) || 8765;
const MOCK = process.argv.includes('--mock') || process.env.MOCK === '1';
const APP_VERSION = require('./package.json').version;

const FILES = {
  settings: path.join(DATA_DIR, 'settings.json'),
  blacklist: path.join(DATA_DIR, 'blacklist.json'),
  favorites: path.join(DATA_DIR, 'favorites.json'),
  searches: path.join(DATA_DIR, 'searches.json'),
  oauth: path.join(DATA_DIR, 'oauth.json'),
  downloads: path.join(DATA_DIR, 'downloads.json'),
};

const DEFAULT_SETTINGS = {
  apiKey: '',
  clientId: '',
  clientSecret: '',
  downloadDir: path.join(ROOT, 'downloads'),
  pageSize: 30,
  previewQuality: 'hq-mp3', // hq-mp3 | lq-mp3 | hq-ogg | lq-ogg
  blacklistServerSide: true,
  blacklistMaxServerSide: 300,
  attributionLog: true,
};

// Endpoints that only work with an OAuth2 bearer token.
const OAUTH_ONLY = [
  /^\/sounds\/\d+\/download\/?$/,
  /^\/sounds\/upload\/?$/,
  /^\/sounds\/describe\/?$/,
  /^\/sounds\/pending_uploads\/?$/,
  /^\/sounds\/\d+\/(edit|bookmark|rate|comment)\/?$/,
  /^\/packs\/\d+\/download\/?$/,
  /^\/me\/?/,
];

// Endpoints whose `filter` parameter we extend with the blacklist.
const FILTERABLE = [/^\/search\/?(text\/?)?$/, /^\/sounds\/\d+\/similar\/?$/];

// ---------------------------------------------------------------------------
// Small JSON store with an atomic write + a per-file write queue.
// ---------------------------------------------------------------------------
const writeQueues = new Map();

async function readJson(file, fallback) {
  try {
    const txt = await fsp.readFile(file, 'utf8');
    return JSON.parse(txt);
  } catch (e) {
    if (e.code === 'ENOENT') return typeof fallback === 'function' ? fallback() : fallback;
    if (e instanceof SyntaxError) {
      console.warn(`[data] ${path.basename(file)} is corrupt, backing it up and starting fresh`);
      try { await fsp.copyFile(file, file + '.corrupt-' + Date.now()); } catch (_) { /* ignore */ }
      return typeof fallback === 'function' ? fallback() : fallback;
    }
    throw e;
  }
}

function writeJson(file, data) {
  const prev = writeQueues.get(file) || Promise.resolve();
  const next = prev.catch(() => {}).then(async () => {
    await fsp.mkdir(path.dirname(file), { recursive: true });
    const tmp = file + '.tmp';
    await fsp.writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
    await fsp.rename(tmp, file);
  });
  writeQueues.set(file, next);
  return next;
}

async function getSettings() {
  const s = await readJson(FILES.settings, {});
  const merged = { ...DEFAULT_SETTINGS, ...s };
  // Freesound's "Client secret / Api key" is one value: fall back to the client secret for token auth.
  if (!merged.apiKey && merged.clientSecret) merged.apiKey = merged.clientSecret;
  return merged;
}

const BL_KINDS = { user: 'users', tag: 'tags', pack: 'packs', word: 'words' };
const BL_KEY = { user: 'username', tag: 'tag', pack: 'id', word: 'word' };

async function getBlacklist() {
  const bl = await readJson(FILES.blacklist, {});
  for (const list of Object.values(BL_KINDS)) if (!Array.isArray(bl[list])) bl[list] = [];
  return bl;
}

function blNormalize(kind, value) {
  const v = String(value ?? '').trim();
  if (kind === 'tag' || kind === 'word') return v.toLowerCase();
  if (kind === 'pack') return v.replace(/\D/g, '');
  return v;
}

function blFind(bl, kind, value) {
  const key = BL_KEY[kind];
  const norm = blNormalize(kind, value).toLowerCase();
  return bl[BL_KINDS[kind]].findIndex((it) => String(it[key]).toLowerCase() === norm);
}

const EMPTY_LIST = (key) => () => ({ [key]: [] });

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

function sendJson(res, status, obj, extraHeaders) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
    ...(extraHeaders || {}),
  });
  res.end(body);
}

function redirect(res, location) {
  res.writeHead(302, { location });
  res.end();
}

function readBody(req, limit = 5 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        reject(new Error('Request body too large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function readJsonBody(req) {
  const buf = await readBody(req);
  if (!buf.length) return {};
  try {
    return JSON.parse(buf.toString('utf8'));
  } catch (_) {
    throw Object.assign(new Error('Invalid JSON body'), { status: 400 });
  }
}

class HttpError extends Error {
  constructor(status, message, extra) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

// ---------------------------------------------------------------------------
// Static files
// ---------------------------------------------------------------------------
async function serveStatic(req, res, pathname) {
  let rel = decodeURIComponent(pathname);
  if (rel === '/' || rel === '') rel = '/index.html';
  const abs = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!abs.startsWith(PUBLIC_DIR + path.sep) && abs !== PUBLIC_DIR) {
    throw new HttpError(403, 'Forbidden');
  }
  let stat;
  try {
    stat = await fsp.stat(abs);
  } catch (_) {
    throw new HttpError(404, 'Not found');
  }
  if (stat.isDirectory()) {
    throw new HttpError(404, 'Not found');
  }
  const ext = path.extname(abs).toLowerCase();
  res.writeHead(200, {
    'content-type': MIME[ext] || 'application/octet-stream',
    'content-length': stat.size,
    'cache-control': 'no-cache',
  });
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  await pipeline(fs.createReadStream(abs), res);
}

// ---------------------------------------------------------------------------
// Blacklist -> Solr filter
// ---------------------------------------------------------------------------
function solrQuote(value) {
  return '"' + String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
}

// Adds every blacklist kind to the request: users/tags/packs as negative filter clauses,
// words as prohibited query terms. Returns the number of entries injected.
async function injectBlacklist(target, settings) {
  if (!settings.blacklistServerSide) return 0;
  const bl = await getBlacklist();
  const max = settings.blacklistMaxServerSide || 300;
  const clauses = [];
  let n = 0;
  const users = bl.users.slice(0, max).map((u) => u.username);
  if (users.length) { clauses.push('-username:(' + users.map(solrQuote).join(' OR ') + ')'); n += users.length; }
  const tags = bl.tags.slice(0, max).map((t) => t.tag);
  if (tags.length) { clauses.push('-tag:(' + tags.map(solrQuote).join(' OR ') + ')'); n += tags.length; }
  const packs = bl.packs.filter((p) => p.name).slice(0, max).map((p) => p.name);
  if (packs.length) { clauses.push('-pack:(' + packs.map(solrQuote).join(' OR ') + ')'); n += packs.length; }
  if (clauses.length) {
    const existing = target.searchParams.get('filter');
    target.searchParams.set('filter', [existing && existing.trim(), ...clauses].filter(Boolean).join(' '));
  }
  const words = bl.words.slice(0, max).map((w) => w.word).filter((w) => /^[\p{L}\p{N}_-]+$/u.test(w));
  if (words.length && target.searchParams.has('query')) {
    const q = target.searchParams.get('query') || '';
    target.searchParams.set('query', [q.trim(), ...words.map((w) => '-' + w)].filter(Boolean).join(' '));
    n += words.length;
  }
  return n;
}

// ---------------------------------------------------------------------------
// OAuth2
// ---------------------------------------------------------------------------
const pendingStates = new Map(); // state -> timestamp

function redirectUri() {
  return `http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}/oauth/callback`;
}

async function exchangeToken(params) {
  const settings = await getSettings();
  if (!settings.clientId || !settings.clientSecret) {
    throw new HttpError(400, 'Client ID and Client Secret are required for OAuth2 (see Settings).');
  }
  const body = new URLSearchParams({
    client_id: settings.clientId,
    client_secret: settings.clientSecret,
    ...params,
  });
  const r = await fetch(FS_OAUTH_TOKEN, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
    body,
    signal: AbortSignal.timeout(30000),
  });
  const text = await r.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (_) {
    data = { detail: text.slice(0, 300) };
  }
  if (!r.ok || !data.access_token) {
    throw new HttpError(r.status === 200 ? 502 : r.status, `OAuth2 token request failed: ${data.error_description || data.detail || data.error || r.status}`);
  }
  const prev = await readJson(FILES.oauth, {});
  const oauth = {
    access_token: data.access_token,
    refresh_token: data.refresh_token || prev.refresh_token,
    scope: data.scope,
    expires_at: Date.now() + (Number(data.expires_in) || 86400) * 1000,
    username: prev.username || null,
    obtained_at: new Date().toISOString(),
  };
  await writeJson(FILES.oauth, oauth);
  return oauth;
}

async function getBearer({ refreshIfNeeded = true } = {}) {
  const oauth = await readJson(FILES.oauth, null);
  if (!oauth || !oauth.access_token) return null;
  if (refreshIfNeeded && oauth.expires_at && oauth.expires_at - Date.now() < 120 * 1000 && oauth.refresh_token) {
    try {
      const fresh = await exchangeToken({ grant_type: 'refresh_token', refresh_token: oauth.refresh_token });
      return fresh.access_token;
    } catch (e) {
      console.warn('[oauth] refresh failed:', e.message);
      return null;
    }
  }
  return oauth.access_token;
}

async function fetchMe(bearer) {
  const r = await fetch(`${FS_API}/me/`, {
    headers: { authorization: `Bearer ${bearer}`, accept: 'application/json' },
    signal: AbortSignal.timeout(30000),
  });
  if (!r.ok) return null;
  return r.json();
}

async function oauthStart(req, res) {
  const settings = await getSettings();
  if (!settings.clientId) {
    throw new HttpError(400, 'Client ID is not configured. Open Settings and paste the Client ID of your API credential.');
  }
  const state = crypto.randomBytes(16).toString('hex');
  pendingStates.set(state, Date.now());
  for (const [k, t] of pendingStates) if (Date.now() - t > 15 * 60 * 1000) pendingStates.delete(k);
  const u = new URL(FS_OAUTH_AUTHORIZE);
  u.searchParams.set('client_id', settings.clientId);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('state', state);
  redirect(res, u.toString());
}

async function oauthFinish(code) {
  const oauth = await exchangeToken({ grant_type: 'authorization_code', code });
  try {
    const me = await fetchMe(oauth.access_token);
    if (me && me.username) {
      oauth.username = me.username;
      oauth.avatar = (me.avatar && (me.avatar.medium || me.avatar.small)) || null;
      await writeJson(FILES.oauth, oauth);
    }
  } catch (_) { /* non fatal */ }
  return oauth;
}

function oauthResultPage(res, ok, error, username) {
  const payload = JSON.stringify({ type: 'fs-oauth', ok, error: error || null, username: username || null });
  const fallback = ok ? '/?oauth=connected#tab=settings' : '/?oauth=error&msg=' + encodeURIComponent(error || 'error') + '#tab=settings';
  const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>Freesound App</title>
<style>body{margin:0;background:#1b1b1e;color:#f1f1f3;font:14px/1.5 'Poppins','Segoe UI',system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh}
.box{background:#242428;padding:28px 34px;max-width:420px}.ok{color:#35d07f}.err{color:#ff5a5a}a{color:#6a9bff}</style></head>
<body><div class="box"><h2 class="${ok ? 'ok' : 'err'}">${ok ? 'Вход выполнен' : 'Вход не удался'}</h2>
<p>${ok ? (username ? 'Вы вошли как <b>' + username.replace(/[<>&]/g, '') + '</b>. ' : '') + 'Это окно можно закрыть.' : (error || '').replace(/[<>&]/g, '')}</p>
<p><a href="${fallback}">Вернуться в приложение</a></p></div>
<script>
(function(){var data=${payload};
try{if(window.opener&&!window.opener.closed){window.opener.postMessage(data,'*');setTimeout(function(){window.close();},400);return;}}catch(e){}
location.replace(${JSON.stringify(fallback)});})();
</script></body></html>`;
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
  res.end(html);
}

async function oauthCallback(req, res, url) {
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');
  if (error) return oauthResultPage(res, false, error === 'access_denied' ? 'Доступ не был разрешён.' : error);
  if (!code) return oauthResultPage(res, false, 'В ответе Freesound нет кода авторизации.');
  if (state && !pendingStates.has(state)) {
    return oauthResultPage(res, false, 'Сессия входа устарела, начните заново.');
  }
  pendingStates.delete(state);
  try {
    const oauth = await oauthFinish(code);
    oauthResultPage(res, true, null, oauth.username);
  } catch (e) {
    oauthResultPage(res, false, e.message);
  }
}

// ---------------------------------------------------------------------------
// API proxy
// ---------------------------------------------------------------------------
function stripToken(u) {
  const c = new URL(u);
  c.searchParams.delete('token');
  return c.toString();
}

async function proxyApi(req, res, url) {
  const apiPath = url.pathname.replace(/^\/api/, '') || '/';
  if (apiPath.startsWith('/oauth2')) throw new HttpError(403, 'OAuth endpoints are handled by /oauth/*');

  const settings = await getSettings();
  const target = new URL(FS_API + apiPath);
  for (const [k, v] of url.searchParams) target.searchParams.append(k, v);
  target.searchParams.delete('token');

  const noBlacklist = target.searchParams.get('_nobl') === '1';
  target.searchParams.delete('_nobl');
  let injected = 0;
  if (!noBlacklist && FILTERABLE.some((re) => re.test(apiPath))) {
    injected = await injectBlacklist(target, settings);
  }

  if (MOCK) return mockApi(req, res, apiPath, target, injected);

  const needsOAuth = OAUTH_ONLY.some((re) => re.test(apiPath));
  const headers = { accept: 'application/json', 'user-agent': `FreesoundApp/${APP_VERSION}` };
  let authKind = 'none';
  if (needsOAuth) {
    const bearer = await getBearer();
    if (!bearer) throw new HttpError(401, 'This resource requires OAuth2. Connect your Freesound account in Settings.');
    headers.authorization = `Bearer ${bearer}`;
    authKind = 'oauth';
  } else if (settings.apiKey) {
    headers.authorization = `Token ${settings.apiKey}`;
    authKind = 'token';
  } else {
    const bearer = await getBearer();
    if (bearer) {
      headers.authorization = `Bearer ${bearer}`;
      authKind = 'oauth';
    } else {
      throw new HttpError(401, 'No API key configured. Open Settings and paste your Freesound API key (https://freesound.org/apiv2/apply).');
    }
  }

  const init = { method: req.method, headers, signal: AbortSignal.timeout(60000) };
  if (req.method === 'POST' || req.method === 'PUT') {
    const buf = await readBody(req);
    init.body = buf;
    headers['content-type'] = req.headers['content-type'] || 'application/json';
  }

  let r;
  try {
    r = await fetch(target, init);
  } catch (e) {
    throw new HttpError(502, `Cannot reach freesound.org: ${e.cause?.message || e.message}`);
  }
  const text = await r.text();
  const ct = r.headers.get('content-type') || 'application/json; charset=utf-8';
  res.writeHead(r.status, {
    'content-type': ct.includes('json') ? 'application/json; charset=utf-8' : ct,
    'cache-control': 'no-store',
    'x-fs-url': stripToken(target),
    'x-fs-auth': authKind,
    'x-fs-blacklist-injected': String(injected),
  });
  res.end(text);
}

// ---------------------------------------------------------------------------
// Mock API (for UI development without an API key): node server.js --mock
// ---------------------------------------------------------------------------
let mockCache = null;
async function loadMock() {
  if (mockCache) return mockCache;
  mockCache = await readJson(path.join(MOCK_DIR, 'sounds.json'), { sounds: [] });
  return mockCache;
}

function paginate(items, target, mapper) {
  const page = Math.max(1, parseInt(target.searchParams.get('page') || '1', 10) || 1);
  const pageSize = Math.min(150, Math.max(1, parseInt(target.searchParams.get('page_size') || '15', 10) || 15));
  const start = (page - 1) * pageSize;
  const slice = items.slice(start, start + pageSize).map(mapper || ((x) => x));
  const mk = (p) => {
    const u = new URL(target);
    u.searchParams.set('page', String(p));
    return u.toString();
  };
  return {
    count: items.length,
    next: start + pageSize < items.length ? mk(page + 1) : null,
    previous: page > 1 ? mk(page - 1) : null,
    results: slice,
  };
}

function pickFields(sound, fieldsParam) {
  if (!fieldsParam) {
    const { id, name, tags, username, license } = sound;
    return { id, name, tags, username, license };
  }
  const out = {};
  for (const f of fieldsParam.split(',').map((s) => s.trim()).filter(Boolean)) {
    if (f in sound) out[f] = sound[f];
    else if (f === 'score') out.score = 1;
    else out[f] = null;
  }
  return out;
}

async function mockApi(req, res, apiPath, target, injected) {
  const { sounds } = await loadMock();
  const bl = await getBlacklist();
  const blockedUsers = new Set(bl.users.map((u) => u.username.toLowerCase()));
  const blockedTags = new Set(bl.tags.map((t) => t.tag.toLowerCase()));
  const blockedPacks = new Set(bl.packs.map((p) => String(p.id)));
  const blockedWords = bl.words.map((w) => w.word.toLowerCase());
  const notBlocked = (s) => {
    if (blockedUsers.has(String(s.username).toLowerCase())) return false;
    if ((s.tags || []).some((t) => blockedTags.has(String(t).toLowerCase()))) return false;
    const pm = String(s.pack || '').match(/\/packs\/(\d+)/);
    if (pm && blockedPacks.has(pm[1])) return false;
    const hay = `${s.name} ${s.description} ${(s.tags || []).join(' ')}`.toLowerCase();
    return !blockedWords.some((w) => hay.includes(w));
  };
  const fields = target.searchParams.get('fields');
  const headers = { 'x-fs-url': stripToken(target), 'x-fs-auth': 'mock', 'x-fs-blacklist-injected': String(injected) };
  await new Promise((r) => setTimeout(r, 250)); // simulate latency

  let m;
  if (FILTERABLE.some((re) => re.test(apiPath))) {
    const q = (target.searchParams.get('query') || '').toLowerCase().trim();
    const filter = target.searchParams.get('filter') || '';
    let items = sounds.filter(notBlocked);
    if (q) {
      const terms = q.split(/\s+/).filter((t) => t && !t.startsWith('-'));
      items = items.filter((s) => terms.every((t) => (s.name + ' ' + s.tags.join(' ') + ' ' + s.description).toLowerCase().includes(t.replace(/"/g, ''))));
    }
    if (/type:\(?wav/.test(filter)) items = items.filter((s) => s.type === 'wav');
    const sort = target.searchParams.get('sort') || 'score';
    const sorters = {
      duration_desc: (a, b) => b.duration - a.duration,
      duration_asc: (a, b) => a.duration - b.duration,
      created_desc: (a, b) => b.created.localeCompare(a.created),
      created_asc: (a, b) => a.created.localeCompare(b.created),
      downloads_desc: (a, b) => b.num_downloads - a.num_downloads,
      downloads_asc: (a, b) => a.num_downloads - b.num_downloads,
      rating_desc: (a, b) => b.avg_rating - a.avg_rating,
      rating_asc: (a, b) => a.avg_rating - b.avg_rating,
    };
    if (sorters[sort]) items = [...items].sort(sorters[sort]);
    return sendJson(res, 200, paginate(items, target, (s) => pickFields(s, fields)), headers);
  }
  if ((m = apiPath.match(/^\/sounds\/(\d+)\/?$/))) {
    const s = sounds.find((x) => x.id === Number(m[1]));
    if (!s) return sendJson(res, 404, { detail: 'Not found.' }, headers);
    return sendJson(res, 200, fields ? pickFields(s, fields) : s, headers);
  }
  if ((m = apiPath.match(/^\/sounds\/(\d+)\/comments\/?$/))) {
    return sendJson(res, 200, paginate([
      { username: 'reinsamba', comment: 'Great recording, thanks!', created: '2024-01-15T10:22:00' },
      { username: 'Jovica', comment: 'Used this in my track.', created: '2023-11-02T18:05:11' },
    ], target), headers);
  }
  if ((m = apiPath.match(/^\/sounds\/(\d+)\/analysis\/?$/))) {
    const s = sounds.find((x) => x.id === Number(m[1]));
    return sendJson(res, 200, s ? s._analysis || {} : {}, headers);
  }
  if ((m = apiPath.match(/^\/users\/([^/]+)\/?$/))) {
    const name = decodeURIComponent(m[1]);
    const own = sounds.filter((s) => s.username === name);
    return sendJson(res, 200, {
      url: `https://freesound.org/people/${name}/`, username: name, about: 'Mock user profile.', homepage: null,
      avatar: null, date_joined: '2010-05-05T12:00:00', num_sounds: own.length, num_packs: 1, num_posts: 3, num_comments: 12,
      sounds: `${FS_API}/users/${name}/sounds/`, packs: `${FS_API}/users/${name}/packs/`,
    }, headers);
  }
  if ((m = apiPath.match(/^\/users\/([^/]+)\/sounds\/?$/))) {
    const name = decodeURIComponent(m[1]);
    return sendJson(res, 200, paginate(sounds.filter((s) => s.username === name), target, (s) => pickFields(s, fields)), headers);
  }
  if ((m = apiPath.match(/^\/users\/([^/]+)\/packs\/?$/))) {
    return sendJson(res, 200, paginate([{ id: 24152, url: 'https://freesound.org/people/InspectorJ/packs/24152/', description: '', created: '2017-06-22T14:36:16', name: 'Water Swirls', username: decodeURIComponent(m[1]), num_sounds: 3, sounds: `${FS_API}/packs/24152/sounds/`, num_downloads: 1200 }], target), headers);
  }
  if ((m = apiPath.match(/^\/packs\/(\d+)\/?$/))) {
    return sendJson(res, 200, { id: Number(m[1]), url: `https://freesound.org/people/InspectorJ/packs/${m[1]}/`, description: 'Mock pack', created: '2017-06-22T14:36:16', name: 'Water Swirls', username: 'InspectorJ', num_sounds: 3, sounds: `${FS_API}/packs/${m[1]}/sounds/`, num_downloads: 1200 }, headers);
  }
  if ((m = apiPath.match(/^\/packs\/(\d+)\/sounds\/?$/))) {
    return sendJson(res, 200, paginate(sounds.filter(notBlocked).slice(0, 3), target, (s) => pickFields(s, fields)), headers);
  }
  if (/^\/usage\/?$/.test(apiPath)) {
    return sendJson(res, 200, { current: { burst: { num_requests: 3, limit: 60 }, sustained: { num_requests: 42, limit: 2000 } }, historic: [['2026-10-01', 42]] }, headers);
  }
  if (/^\/me\/?$/.test(apiPath)) {
    return sendJson(res, 200, { username: 'mockuser', email: 'mock@example.com' }, headers);
  }
  return sendJson(res, 404, { detail: `Mock: no handler for ${apiPath}` }, headers);
}

// ---------------------------------------------------------------------------
// Downloads
// ---------------------------------------------------------------------------
function sanitizeFilename(name) {
  return String(name)
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+$/, '_')
    .slice(0, 150) || 'sound';
}

async function uniquePath(dir, filename) {
  const ext = path.extname(filename);
  const base = filename.slice(0, filename.length - ext.length);
  let candidate = path.join(dir, filename);
  let i = 2;
  while (fs.existsSync(candidate)) {
    candidate = path.join(dir, `${base} (${i})${ext}`);
    i += 1;
  }
  return candidate;
}

function filenameFromDisposition(cd) {
  if (!cd) return null;
  let m = cd.match(/filename\*=UTF-8''([^;]+)/i);
  if (m) {
    try { return decodeURIComponent(m[1]); } catch (_) { /* fallthrough */ }
  }
  m = cd.match(/filename="?([^";]+)"?/i);
  return m ? m[1] : null;
}

async function apiGet(apiPath, params) {
  const settings = await getSettings();
  const target = new URL(FS_API + apiPath);
  for (const [k, v] of Object.entries(params || {})) target.searchParams.set(k, v);
  const headers = { accept: 'application/json' };
  if (settings.apiKey) headers.authorization = `Token ${settings.apiKey}`;
  else {
    const bearer = await getBearer();
    if (!bearer) throw new HttpError(401, 'No API key configured.');
    headers.authorization = `Bearer ${bearer}`;
  }
  const r = await fetch(target, { headers, signal: AbortSignal.timeout(60000) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new HttpError(r.status, data.detail || `Freesound returned ${r.status}`);
  return data;
}

async function appendAttribution(dir, rec) {
  const line = `"${rec.name}" by ${rec.username} — ${rec.url} — License: ${rec.license}${rec.file ? ` — file: ${path.basename(rec.file)}` : ''}\n`;
  await fsp.appendFile(path.join(dir, '_attribution.txt'), line, 'utf8');
}

async function downloadSound(body) {
  const id = Number(body.id);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, 'Invalid sound id');
  const kind = body.kind || 'original';
  const settings = await getSettings();
  const dir = path.resolve(body.dir || settings.downloadDir);
  await fsp.mkdir(dir, { recursive: true });

  let sound;
  if (MOCK) {
    const { sounds } = await loadMock();
    sound = sounds.find((s) => s.id === id);
    if (!sound) throw new HttpError(404, 'Mock sound not found');
  } else {
    sound = await apiGet(`/sounds/${id}/`, { fields: 'id,name,username,type,previews,license,url,duration,pack' });
  }

  let sourceUrl;
  let headers = {};
  let ext;
  if (kind === 'original') {
    if (MOCK) throw new HttpError(400, 'Original download is not available in mock mode');
    const bearer = await getBearer();
    if (!bearer) throw new HttpError(401, 'Downloading originals requires OAuth2. Connect your Freesound account in Settings.');
    sourceUrl = `${FS_API}/sounds/${id}/download/`;
    headers = { authorization: `Bearer ${bearer}` };
    ext = '.' + (sound.type || 'wav');
  } else {
    const key = 'preview-' + kind; // preview-hq-mp3 etc.
    sourceUrl = sound.previews && sound.previews[key];
    if (!sourceUrl) throw new HttpError(400, `Preview ${kind} not available for this sound`);
    ext = kind.endsWith('ogg') ? '.ogg' : '.mp3';
  }

  const r = await fetch(sourceUrl, { headers, redirect: 'follow' });
  if (!r.ok) {
    const txt = await r.text().catch(() => '');
    let detail = txt.slice(0, 300);
    try { detail = JSON.parse(txt).detail || detail; } catch (_) { /* ignore */ }
    throw new HttpError(r.status, `Download failed (${r.status}): ${detail}`);
  }

  const baseName = sanitizeFilename(sound.name.replace(/\.[a-z0-9]{2,4}$/i, ''));
  let filename;
  const cdName = filenameFromDisposition(r.headers.get('content-disposition'));
  if (kind === 'original' && cdName) {
    filename = sanitizeFilename(cdName);
  } else {
    filename = `${id}__${sanitizeFilename(sound.username)}__${baseName}${kind === 'original' ? '' : '__' + kind}${ext}`;
  }
  const dest = await uniquePath(dir, filename);
  await pipeline(Readable.fromWeb(r.body), fs.createWriteStream(dest));
  const stat = await fsp.stat(dest);

  const rec = {
    id, name: sound.name, username: sound.username, license: sound.license, url: sound.url,
    kind, file: dest, bytes: stat.size, downloaded_at: new Date().toISOString(),
  };
  const log = await readJson(FILES.downloads, EMPTY_LIST('items'));
  log.items.unshift(rec);
  log.items = log.items.slice(0, 5000);
  await writeJson(FILES.downloads, log);
  if (settings.attributionLog) await appendAttribution(dir, rec);
  return rec;
}

function openInExplorer(target, select) {
  if (process.platform === 'win32') {
    // explorer.exe wants `/select,"path"` as one raw argument, so bypass Node's own quoting.
    const args = select ? [`/select,"${target}"`] : [`"${target}"`];
    spawn('explorer.exe', args, { detached: true, stdio: 'ignore', windowsVerbatimArguments: true }).unref();
  } else if (process.platform === 'darwin') {
    spawn('open', select ? ['-R', target] : [target], { detached: true, stdio: 'ignore' }).unref();
  } else {
    spawn('xdg-open', [select ? path.dirname(target) : target], { detached: true, stdio: 'ignore' }).unref();
  }
}

// ---------------------------------------------------------------------------
// Local state routes
// ---------------------------------------------------------------------------
async function handleLocal(req, res, url) {
  const p = url.pathname.replace(/^\/local/, '');
  const method = req.method;

  if (p === '/status' && method === 'GET') {
    const settings = await getSettings();
    const oauth = await readJson(FILES.oauth, null);
    const bl = await getBlacklist();
    return sendJson(res, 200, {
      version: APP_VERSION,
      mock: MOCK,
      hasApiKey: Boolean(settings.apiKey),
      hasClient: Boolean(settings.clientId && settings.clientSecret),
      oauth: oauth && oauth.access_token
        ? { connected: true, username: oauth.username, avatar: oauth.avatar || null, expiresAt: oauth.expires_at, scope: oauth.scope }
        : { connected: false },
      redirectUri: redirectUri(),
      downloadDir: settings.downloadDir,
      blacklistCount: bl.users.length + bl.tags.length + bl.packs.length + bl.words.length,
      pageSize: settings.pageSize,
      previewQuality: settings.previewQuality,
      blacklistServerSide: settings.blacklistServerSide,
    });
  }

  if (p === '/settings') {
    if (method === 'GET') return sendJson(res, 200, await getSettings());
    if (method === 'PUT' || method === 'POST') {
      const body = await readJsonBody(req);
      const current = await getSettings();
      const next = { ...current };
      for (const k of Object.keys(DEFAULT_SETTINGS)) {
        if (!(k in body)) continue;
        const v = body[k];
        if (typeof DEFAULT_SETTINGS[k] === 'number') next[k] = Number(v) || DEFAULT_SETTINGS[k];
        else if (typeof DEFAULT_SETTINGS[k] === 'boolean') next[k] = Boolean(v);
        else next[k] = String(v ?? '').trim();
      }
      next.pageSize = Math.min(150, Math.max(1, next.pageSize));
      if (!next.downloadDir) next.downloadDir = DEFAULT_SETTINGS.downloadDir;
      next.downloadDir = path.resolve(next.downloadDir);
      await writeJson(FILES.settings, next);
      return sendJson(res, 200, next);
    }
  }

  if (p === '/blacklist') {
    if (method === 'GET') return sendJson(res, 200, await getBlacklist());
    if (method === 'PUT') {
      const body = await readJsonBody(req);
      const bl = {};
      for (const [kind, list] of Object.entries(BL_KINDS)) {
        const key = BL_KEY[kind];
        const seen = new Set();
        bl[list] = [];
        for (const it of Array.isArray(body[list]) ? body[list] : []) {
          const value = blNormalize(kind, typeof it === 'string' ? it : it && it[key]);
          if (!value || seen.has(value.toLowerCase())) continue;
          seen.add(value.toLowerCase());
          bl[list].push({ [key]: value, ...(kind === 'pack' ? { name: (it && it.name) || '' } : {}), note: String((it && it.note) || ''), added: (it && it.added) || new Date().toISOString() });
        }
      }
      await writeJson(FILES.blacklist, bl);
      return sendJson(res, 200, bl);
    }
  }
  if (p === '/blacklist/add' && method === 'POST') {
    const body = await readJsonBody(req);
    const kind = String(body.kind || 'user');
    if (!BL_KINDS[kind]) throw new HttpError(400, 'Unknown blacklist kind');
    const values = (Array.isArray(body.values) ? body.values : [body.value]).map((v) => blNormalize(kind, v)).filter(Boolean);
    if (!values.length) throw new HttpError(400, 'value is required');
    const bl = await getBlacklist();
    const list = bl[BL_KINDS[kind]];
    const key = BL_KEY[kind];
    let added = 0;
    let lastName = '';
    for (const value of values) {
      if (blFind(bl, kind, value) >= 0) continue;
      const item = { [key]: value, note: String(body.note || ''), added: new Date().toISOString() };
      if (kind === 'pack') {
        item.name = String(body.name || '');
        if (!item.name && !MOCK) {
          try { const pack = await apiGet(`/packs/${value}/`, {}); item.name = pack.name || ''; } catch (_) { /* name stays empty: client-side only */ }
        } else if (!item.name && MOCK) {
          item.name = 'Water Swirls';
        }
        lastName = item.name;
      }
      list.push(item);
      added += 1;
    }
    await writeJson(FILES.blacklist, bl);
    return sendJson(res, 200, { ...bl, added, lastName });
  }
  if (p === '/blacklist/remove' && method === 'POST') {
    const body = await readJsonBody(req);
    const kind = String(body.kind || 'user');
    if (!BL_KINDS[kind]) throw new HttpError(400, 'Unknown blacklist kind');
    const bl = await getBlacklist();
    const idx = blFind(bl, kind, body.value);
    if (idx >= 0) bl[BL_KINDS[kind]].splice(idx, 1);
    await writeJson(FILES.blacklist, bl);
    return sendJson(res, 200, bl);
  }
  if (p === '/blacklist/note' && method === 'POST') {
    const body = await readJsonBody(req);
    const kind = String(body.kind || 'user');
    if (!BL_KINDS[kind]) throw new HttpError(400, 'Unknown blacklist kind');
    const bl = await getBlacklist();
    const idx = blFind(bl, kind, body.value);
    if (idx < 0) throw new HttpError(404, 'Entry not in blacklist');
    bl[BL_KINDS[kind]][idx].note = String(body.note || '');
    await writeJson(FILES.blacklist, bl);
    return sendJson(res, 200, bl);
  }

  if (p === '/favorites') {
    if (method === 'GET') return sendJson(res, 200, await readJson(FILES.favorites, EMPTY_LIST('sounds')));
    if (method === 'PUT') {
      const body = await readJsonBody(req);
      const fav = { sounds: Array.isArray(body.sounds) ? body.sounds : [] };
      await writeJson(FILES.favorites, fav);
      return sendJson(res, 200, fav);
    }
  }
  if (p === '/favorites/toggle' && method === 'POST') {
    const body = await readJsonBody(req);
    const sound = body.sound;
    if (!sound || !sound.id) throw new HttpError(400, 'sound with id is required');
    const fav = await readJson(FILES.favorites, EMPTY_LIST('sounds'));
    const idx = fav.sounds.findIndex((s) => s.id === sound.id);
    let isFav;
    if (idx >= 0) {
      fav.sounds.splice(idx, 1);
      isFav = false;
    } else {
      fav.sounds.unshift({ ...sound, added: new Date().toISOString() });
      isFav = true;
    }
    await writeJson(FILES.favorites, fav);
    return sendJson(res, 200, { isFav, count: fav.sounds.length });
  }

  if (p === '/searches') {
    if (method === 'GET') return sendJson(res, 200, await readJson(FILES.searches, EMPTY_LIST('items')));
    if (method === 'PUT') {
      const body = await readJsonBody(req);
      const data = { items: Array.isArray(body.items) ? body.items : [] };
      await writeJson(FILES.searches, data);
      return sendJson(res, 200, data);
    }
  }

  if (p === '/attribution') {
    const settings = await getSettings();
    const file = path.join(settings.downloadDir, '_attribution.txt');
    if (method === 'GET') {
      let content = '';
      try { content = await fsp.readFile(file, 'utf8'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
      return sendJson(res, 200, { content, exists: Boolean(content), bytes: Buffer.byteLength(content) });
    }
    if (method === 'DELETE') {
      try { await fsp.unlink(file); } catch (e) { if (e.code !== 'ENOENT') throw e; }
      return sendJson(res, 200, { content: '', exists: false, bytes: 0 });
    }
  }

  if (p === '/downloads' && method === 'GET') {
    return sendJson(res, 200, await readJson(FILES.downloads, EMPTY_LIST('items')));
  }
  if (p === '/download' && method === 'POST') {
    const body = await readJsonBody(req);
    const rec = await downloadSound(body);
    return sendJson(res, 200, rec);
  }
  if (p === '/open-folder' && method === 'POST') {
    const body = await readJsonBody(req);
    const settings = await getSettings();
    if (body.file) {
      if (!fs.existsSync(body.file)) throw new HttpError(404, 'File does not exist any more');
      openInExplorer(body.file, true);
    } else {
      await fsp.mkdir(settings.downloadDir, { recursive: true });
      openInExplorer(settings.downloadDir, false);
    }
    return sendJson(res, 200, { ok: true });
  }

  if (p === '/oauth/manual' && method === 'POST') {
    const body = await readJsonBody(req);
    const code = String(body.code || '').trim();
    if (!code) throw new HttpError(400, 'code is required');
    const oauth = await oauthFinish(code);
    return sendJson(res, 200, { connected: true, username: oauth.username, avatar: oauth.avatar || null, expiresAt: oauth.expires_at });
  }
  if (p === '/oauth/logout' && method === 'POST') {
    try { await fsp.unlink(FILES.oauth); } catch (_) { /* ignore */ }
    return sendJson(res, 200, { connected: false });
  }
  if (p === '/oauth/refresh' && method === 'POST') {
    const oauth = await readJson(FILES.oauth, null);
    if (!oauth || !oauth.refresh_token) throw new HttpError(400, 'Not connected');
    const fresh = await exchangeToken({ grant_type: 'refresh_token', refresh_token: oauth.refresh_token });
    return sendJson(res, 200, { connected: true, username: fresh.username, expiresAt: fresh.expires_at });
  }

  throw new HttpError(404, `Unknown local route ${method} ${p}`);
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------
async function route(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const p = url.pathname;

  if (p.startsWith('/api/')) return proxyApi(req, res, url);
  if (p.startsWith('/local/')) return handleLocal(req, res, url);
  if (p === '/oauth/start') return oauthStart(req, res);
  if (p === '/oauth/callback') return oauthCallback(req, res, url);
  if (req.method !== 'GET' && req.method !== 'HEAD') throw new HttpError(405, 'Method not allowed');
  return serveStatic(req, res, p);
}

const server = http.createServer(async (req, res) => {
  const started = Date.now();
  try {
    await route(req, res);
  } catch (e) {
    const status = e.status || 500;
    if (status >= 500) console.error(`[error] ${req.method} ${req.url}:`, e);
    if (!res.headersSent) sendJson(res, status, { detail: e.message, ...(e.extra || {}) });
    else res.end();
  } finally {
    if (process.env.LOG_REQUESTS) console.log(`${req.method} ${req.url} ${res.statusCode} ${Date.now() - started}ms`);
  }
});

fs.mkdirSync(DATA_DIR, { recursive: true });
server.listen(PORT, HOST, () => {
  console.log(`Freesound App ${APP_VERSION}${MOCK ? ' [MOCK MODE]' : ''}`);
  console.log(`  UI:            http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}/`);
  console.log(`  OAuth redirect: ${redirectUri()}`);
  console.log(`  Data dir:       ${DATA_DIR}`);
});
