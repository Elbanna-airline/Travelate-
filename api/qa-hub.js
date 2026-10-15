import crypto from 'node:crypto';

const SALT = 'tq-qa-hub|v1|';
const COOKIE = 'qa_hub_session';
const STATE_KEY = 'tawasul:qa-hub:state:v1';
const LOCK_KEY = `${STATE_KEY}:lock`;
const WEEK_DELETE_EMAIL = 'm.elbanna@tawasul-eg.com';
const USERS = [
  { email: 'm.elbanna@tawasul-eg.com', role: 'Team Leader', canEdit: true, hash: 'ee9f3cbc6f384aa78d87685b72c3ca45cec2d91f46da77ee43b4ea3653d75c18' },
  { email: 'm.abdelnasser@tawasul-eg.com', role: 'Team Leader', canEdit: true, hash: '46532401c9b4f1a15cf09e69116f9b3f159c5a52e208c13e09be8971b4103ea7' },
  { email: 'm.wissa@tawasul-eg.com', role: 'Access', canEdit: false, hash: '51212087890fe5a55db9eb9c0469ae3a40f15daf9c92764ef6bb77420020a48b' },
  { email: 'm.elkholy@tawasul-eg.com', role: 'Quality Team Lead', canEdit: false, hash: 'a5cc0de855186d0abed269a775800e8906db17bd06f5e5aaaa40dbbe6c591369' },
  { email: 'o.mokhtar@tawasul-eg.com', role: 'Management', canEdit: true, hash: '0836ed0d309ef1041c14095b69d8fee087d6da4b80f7a62c8b8737b3e2f8c4a9' },
  { email: 't.fouda@qgoaviation.com', role: 'Access', canEdit: false, hash: '7f0c19ab644a292cac94969e6db815441c3fe8284520c65527a673f415a860fb' },
  { email: 'm.mekawy@qgoaviation.com', role: 'Access', canEdit: false, hash: '9c60a7e6b4123aa0616955d343951ece5855b52074b3f565026fb444531c6834' },
  { email: 'kghazi@qgoaviation.com', role: 'Access', canEdit: false, hash: '62043def6030130aabb3f0c78dd63cc91259766f90dc11de08b36b1fc25ea820' },
];

function json(res, status, value) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(value));
}

function configReady() {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN && process.env.QA_HUB_SESSION_SECRET);
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

function b64(value) {
  return Buffer.from(value).toString('base64url');
}

function sign(value) {
  return crypto.createHmac('sha256', process.env.QA_HUB_SESSION_SECRET).update(value).digest('base64url');
}

function issueCookie(user, req) {
  const payload = b64(JSON.stringify({ email: user.email, exp: Date.now() + 7 * 864e5 }));
  const token = `${payload}.${sign(payload)}`;
  const secure = req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '';
  return `${COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800${secure}`;
}

function currentUser(req) {
  const raw = req.headers.cookie || '';
  const token = raw.split(';').map(x => x.trim()).find(x => x.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
  if (!token) return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;
  const expected = sign(payload);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return session.exp > Date.now() ? USERS.find(user => user.email === session.email) || null : null;
  } catch { return null; }
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

async function readState() {
  const raw = await redis(['GET', STATE_KEY]);
  if (!raw) return { audits: [], overrides: {} };
  const state = JSON.parse(raw);
  return { audits: Array.isArray(state.audits) ? state.audits : [], overrides: state.overrides && typeof state.overrides === 'object' ? state.overrides : {} };
}

async function updateState(mutator) {
  const lock = crypto.randomBytes(16).toString('hex');
  let acquired = false;
  for (let attempt = 0; attempt < 25; attempt++) {
    const result = await redis(['SET', LOCK_KEY, lock, 'NX', 'PX', 15000]);
    if (result === 'OK') { acquired = true; break; }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  if (!acquired) throw new Error('Shared storage is busy; try again');
  try {
    const state = await readState();
    const result = mutator(state);
    await redis(['SET', STATE_KEY, JSON.stringify(state)]);
    return result ?? state;
  } finally {
    await redis(['EVAL', "if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) else return 0 end", '1', LOCK_KEY, lock]);
  }
}

function emailFromBody(value) { return String(value || '').trim().toLowerCase(); }

export default async function handler(req, res) {
  if (!configReady()) return json(res, 503, { error: 'Shared audit storage is not configured.' });
  if (!safeOrigin(req)) return json(res, 403, { error: 'Cross-site request rejected.' });
  const body = requestBody(req);

  if (req.method === 'POST' && body.action === 'logout') {
    res.setHeader('Set-Cookie', `${COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : ''}`);
    return json(res, 200, { ok: true });
  }

  if (req.method === 'POST' && body.action === 'login') {
    const email = emailFromBody(body.email);
    const user = USERS.find(item => item.email === email);
    const supplied = crypto.createHash('sha256').update(`${SALT}${email}|${String(body.password || '')}`).digest('hex');
    const a = Buffer.from(supplied);
    const b = Buffer.from(user?.hash || '0'.repeat(64));
    if (!user || a.length !== b.length || !crypto.timingSafeEqual(a, b)) return json(res, 401, { error: 'Email or password is incorrect.' });
    res.setHeader('Set-Cookie', issueCookie(user, req));
    return json(res, 200, { user: { email: user.email, role: user.role, canEdit: user.canEdit, canEditScorecard: user.email === WEEK_DELETE_EMAIL, canDeleteWeek: user.email === WEEK_DELETE_EMAIL } });
  }

  const user = currentUser(req);
  if (!user) return json(res, 401, { error: 'Please sign in again to the shared audit service.' });
  if (req.method === 'GET') {
    try { return json(res, 200, await readState()); }
    catch (error) { console.error(error); return json(res, 503, { error: 'Could not load shared audits.' }); }
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return json(res, 405, { error: 'Method not allowed.' });
  }
  if (!user.canEdit) return json(res, 403, { error: 'This account cannot create or change audits.' });

  try {
    const state = await updateState(shared => {
      const owned = audit => audit && audit.createdBy === user.email;
      if (body.action === 'save-audit') {
        const audit = body.audit;
        if (!audit || typeof audit.id !== 'string' || !audit.id || typeof audit.date !== 'string' || !audit.agent) throw Object.assign(new Error('Audit is missing required fields.'), { status: 400 });
        const index = shared.audits.findIndex(item => item.id === audit.id);
        if (index >= 0 && !owned(shared.audits[index])) throw Object.assign(new Error('You can edit only audits created by your account.'), { status: 403 });
        const saved = { ...audit, createdBy: index >= 0 ? shared.audits[index].createdBy : user.email, deleted: false };
        if (index >= 0) shared.audits[index] = saved; else shared.audits.push(saved);
      } else if (body.action === 'delete-audit' || body.action === 'restore-audit') {
        const audit = shared.audits.find(item => item.id === body.id);
        if (!owned(audit)) throw Object.assign(new Error('You can change only audits created by your account.'), { status: 403 });
        audit.deleted = body.action === 'delete-audit';
      } else if (body.action === 'restore-mine') {
        shared.audits.forEach(item => { if (owned(item) && item.deleted) item.deleted = false; });
      } else if (body.action === 'restore-evaluation') {
        if (user.email !== WEEK_DELETE_EMAIL) throw Object.assign(new Error('Only M. Elbanna can restore deleted source records.'), { status: 403 });
        if (typeof body.id !== 'string') throw Object.assign(new Error('Missing evaluation id.'), { status: 400 });
        shared.overrides[body.id] = { ...(shared.overrides[body.id] || {}), deleted: false };
      } else if (body.action === 'restore-all-visible') {
        const evaluationIds = Array.isArray(body.evaluationIds) ? body.evaluationIds.filter(x => typeof x === 'string') : [];
        if (evaluationIds.length && user.email !== WEEK_DELETE_EMAIL) throw Object.assign(new Error('Only M. Elbanna can restore deleted source records.'), { status: 403 });
        shared.audits.forEach(item => { if (owned(item) && item.deleted) item.deleted = false; });
        evaluationIds.forEach(id => { shared.overrides[id] = { ...(shared.overrides[id] || {}), deleted: false }; });
      } else if (body.action === 'delete-week') {
        if (user.email !== WEEK_DELETE_EMAIL) throw Object.assign(new Error('Only M. Elbanna can delete a complete week.'), { status: 403 });
        const auditIds = new Set(Array.isArray(body.auditIds) ? body.auditIds.filter(x => typeof x === 'string') : []);
        const evaluationIds = Array.isArray(body.evaluationIds) ? body.evaluationIds.filter(x => typeof x === 'string') : [];
        shared.audits.forEach(item => { if (auditIds.has(item.id)) item.deleted = true; });
        evaluationIds.forEach(id => { shared.overrides[id] = { ...(shared.overrides[id] || {}), deleted: true }; });
      } else {
        throw Object.assign(new Error('Unknown audit action.'), { status: 400 });
      }
      return shared;
    });
    return json(res, 200, state);
  } catch (error) {
    const status = error.status || (String(error.message).includes('busy') ? 503 : 500);
    if (status >= 500) console.error(error);
    return json(res, status, { error: status === 500 ? 'Shared audit operation failed.' : error.message });
  }
}
