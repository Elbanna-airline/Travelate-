import crypto from 'node:crypto';

const COOKIE = 'elbanna_agenda_sync';
const STATE_KEY = 'elbanna:agenda:sync:v1';
const LOCK_KEY = `${STATE_KEY}:lock`;
const SESSION_DAYS = 30;
const MAX_STATE_BYTES = 1024 * 1024;

function json(res, status, value) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(JSON.stringify(value));
}

function configReady() {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN && process.env.AGENDA_SYNC_PASSWORD);
}

async function redis(command) {
  const url = process.env.UPSTASH_REDIS_REST_URL.replace(/\/$/, '');
  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
  });
  const data = await response.json();
  if (!response.ok || data.error) throw new Error('Shared storage request failed');
  return data.result;
}

function requestBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body || '{}'); } catch { return {}; }
}

function safeOrigin(req) {
  const origin = req.headers.origin;
  const host = req.headers.host;
  if (!origin || !host) return true;
  try { return new URL(origin).host === host; } catch { return false; }
}

function passwordDigest(value) {
  return crypto.createHmac('sha256', 'elbanna-agenda-sync-password-v1').update(String(value || '')).digest();
}

function sign(value) {
  return crypto.createHmac('sha256', process.env.AGENDA_SYNC_PASSWORD).update(value).digest('base64url');
}

function issueCookie(req) {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + SESSION_DAYS * 864e5, nonce: crypto.randomBytes(12).toString('hex') })).toString('base64url');
  const token = `${payload}.${sign(payload)}`;
  const secure = req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '';
  return `${COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/api/agenda-sync; Max-Age=${SESSION_DAYS * 86400}${secure}`;
}

function authenticated(req) {
  const raw = req.headers.cookie || '';
  const token = raw.split(';').map(x => x.trim()).find(x => x.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  if (!token) return false;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return false;
  const expected = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return Number.isFinite(session.exp) && session.exp > Date.now();
  } catch { return false; }
}

async function readRecord() {
  const raw = await redis(['GET', STATE_KEY]);
  if (!raw) return null;
  const value = JSON.parse(raw);
  if (!value || !value.state || typeof value.state !== 'object' || typeof value.version !== 'string') return null;
  return value;
}

async function withLock(callback) {
  const lock = crypto.randomBytes(16).toString('hex');
  let acquired = false;
  for (let attempt = 0; attempt < 25; attempt++) {
    const result = await redis(['SET', LOCK_KEY, lock, 'NX', 'PX', 15000]);
    if (result === 'OK') { acquired = true; break; }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  if (!acquired) throw Object.assign(new Error('Shared storage is busy; try again.'), { status: 503 });
  try { return await callback(); }
  finally {
    await redis(['EVAL', "if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) else return 0 end", '1', LOCK_KEY, lock]);
  }
}

export default async function handler(req, res) {
  if (!configReady()) return json(res, 503, { error: 'Cloud sync setup is incomplete. Add AGENDA_SYNC_PASSWORD and connect the existing Upstash Redis variables in Vercel.' });
  if (!safeOrigin(req)) return json(res, 403, { error: 'Cross-site request rejected.' });

  if (req.method === 'POST') {
    const body = requestBody(req);
    if (body.action === 'login') {
      const supplied = passwordDigest(body.password);
      const expected = passwordDigest(process.env.AGENDA_SYNC_PASSWORD);
      if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) return json(res, 401, { error: 'Incorrect sync password.' });
      res.setHeader('Set-Cookie', issueCookie(req));
      return json(res, 200, { ok: true });
    }
  }

  if (!authenticated(req)) return json(res, 401, { error: 'Sign in with your sync password.' });
  if (req.method === 'GET') {
    try {
      const record = await readRecord();
      return json(res, 200, { state: record?.state || null, version: record?.version || null });
    } catch (error) {
      console.error(error);
      return json(res, 503, { error: 'Could not load your cloud agenda.' });
    }
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return json(res, 405, { error: 'Method not allowed.' });
  }

  const body = requestBody(req);
  if (body.action === 'logout') {
    res.setHeader('Set-Cookie', `${COOKIE}=; HttpOnly; SameSite=Strict; Path=/api/agenda-sync; Max-Age=0${req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : ''}`);
    return json(res, 200, { ok: true });
  }
  if (body.action !== 'save' || !body.state || typeof body.state !== 'object' || Array.isArray(body.state)) return json(res, 400, { error: 'A valid agenda state is required.' });
  let serialized;
  try { serialized = JSON.stringify(body.state); } catch { return json(res, 400, { error: 'Agenda state is not valid JSON.' }); }
  if (Buffer.byteLength(serialized, 'utf8') > MAX_STATE_BYTES) return json(res, 413, { error: 'Agenda data is too large to sync.' });

  try {
    const result = await withLock(async () => {
      const current = await readRecord();
      const currentVersion = current?.version || null;
      if (body.baseVersion !== currentVersion) return { conflict: true, state: current?.state || null, version: currentVersion };
      const version = new Date().toISOString();
      await redis(['SET', STATE_KEY, JSON.stringify({ state: body.state, version })]);
      return { conflict: false, state: body.state, version };
    });
    if (result.conflict) return json(res, 409, { error: 'A newer cloud version already exists.', state: result.state, version: result.version });
    return json(res, 200, { ok: true, version: result.version });
  } catch (error) {
    console.error(error);
    return json(res, error.status || 503, { error: error.status === 503 ? error.message : 'Cloud sync failed. Your local agenda is still saved.' });
  }
}
