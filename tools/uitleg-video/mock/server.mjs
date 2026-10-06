// Minimale nagebootste Supabase (Auth + PostgREST-subset) op PGlite, alleen om lokaal te testen en
// om de schermen voor de uitlegvideo's vast te leggen. Alles hierin is fictief: de sleutels en de
// inlogcode (123456) werken alleen tegen deze nabootsing. Draai de app er nooit in productie tegen.
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { PGlite } from '../../../node_modules/@electric-sql/pglite/dist/index.js';
import { btree_gist } from '../../../node_modules/@electric-sql/pglite/dist/contrib/btree_gist.js';

const PORT = Number(process.env.MOCK_PORT ?? 54321);
// Vertraging per verzoek in milliseconden, om een database ver weg na te bootsen. Bijvoorbeeld 100
// voor de app in de VS en de database in Frankfurt. Standaard geen.
const DELAY_MS = Number(process.env.MOCK_DELAY_MS ?? 0);
const JWT_SECRET = 'local-test-jwt-secret-local-test-jwt-secret';
const SECRET_KEY = 'sb_secret_localtest';
const OTP_CODE = '123456';

const MOCK_SQL = `
create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;
grant usage on schema public to anon, authenticated, service_role;
${process.env.MOCK_STRICT ? 'alter default privileges in schema public revoke execute on functions from public;' : `alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;`}
create schema auth;
grant usage on schema auth to anon, authenticated, service_role;
create table auth.users (id uuid primary key, email text unique, created_at timestamptz not null default now(), banned_until timestamptz, last_sign_in_at timestamptz);
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
create function auth.uid() returns uuid language sql stable as $$ select nullif(auth.jwt() ->> 'sub', '')::uuid $$;
grant execute on function auth.jwt() to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
`;

const db = await PGlite.create({ extensions: { btree_gist } });
await db.exec(MOCK_SQL);
for (const phase of ['fase-1', 'fase-2', 'fase-3', 'fase-4']) await db.exec(fs.readFileSync(new URL(`../../../supabase/setup/${phase}.sql`, import.meta.url), 'utf8'));
await db.exec(fs.readFileSync(process.env.MOCK_SEED ?? new URL('./seed.sql', import.meta.url), 'utf8'));

// ---------- JWT ----------
const b64u = (value) => Buffer.from(value).toString('base64url');
function signJwt(payload) {
  const data = `${b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${b64u(JSON.stringify(payload))}`;
  return `${data}.${crypto.createHmac('sha256', JWT_SECRET).update(data).digest('base64url')}`;
}
function verifyJwt(token) {
  const parts = String(token).split('.');
  if (parts.length !== 3) return null;
  const expected = crypto.createHmac('sha256', JWT_SECRET).update(`${parts[0]}.${parts[1]}`).digest('base64url');
  if (expected !== parts[2]) return null;
  const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
  if (payload.exp && payload.exp < Date.now() / 1000) return null;
  return payload;
}

const refreshTokens = new Map();
const usedRefreshTokens = new Map();

async function findUserByEmail(email) {
  const r = await db.query('select id, email, created_at, banned_until from auth.users where lower(email) = lower($1)', [email]);
  return r.rows[0] ?? null;
}
async function findUserById(id) {
  const r = await db.query('select id, email, created_at, banned_until from auth.users where id = $1', [id]);
  return r.rows[0] ?? null;
}
function userJson(u) {
  const created = new Date(u.created_at).toISOString();
  return {
    id: u.id, aud: 'authenticated', role: 'authenticated', email: u.email, email_confirmed_at: created, phone: '',
    confirmed_at: created, last_sign_in_at: new Date().toISOString(), app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: {}, identities: [], created_at: created, updated_at: created, is_anonymous: false,
    banned_until: u.banned_until ? new Date(u.banned_until).toISOString() : undefined,
  };
}
function session(u) {
  const now = Math.floor(Date.now() / 1000);
  const ttl = Number(process.env.MOCK_TOKEN_TTL ?? 3600);
  const access = signJwt({ sub: u.id, email: u.email, role: 'authenticated', aud: 'authenticated', iat: now, exp: now + ttl, session_id: crypto.randomUUID(), aal: 'aal1' });
  const refresh = crypto.randomBytes(16).toString('hex');
  refreshTokens.set(refresh, u.id);
  console.log(`[mock] ${new Date().toISOString()} sessie voor ${u.email} refresh=${refresh.slice(0, 6)}`);
  return { access_token: access, token_type: 'bearer', expires_in: ttl, expires_at: now + ttl, refresh_token: refresh, user: userJson(u) };
}

// ---------- HTTP helpers ----------
function send(res, status, body, headers = {}) {
  const text = body === undefined ? '' : typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...headers });
  res.end(text);
}
async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}
function authError(res, status, code, msg) {
  send(res, status, { code: status, error_code: code, msg });
}

// ---------- Auth ----------
async function handleAuth(req, res, url) {
  const path = url.pathname.replace('/auth/v1', '');
  const apikey = req.headers['apikey'];
  const bearer = (req.headers['authorization'] ?? '').replace(/^Bearer /i, '');
  const isService = apikey === SECRET_KEY || bearer === SECRET_KEY;

  if (path === '/otp' && req.method === 'POST') {
    const body = await readBody(req);
    const user = await findUserByEmail(body.email ?? '');
    if (!user) return authError(res, 422, 'otp_disabled', 'Signups not allowed for otp');
    if (user.banned_until && new Date(user.banned_until) > new Date()) return authError(res, 403, 'user_banned', 'User is banned');
    console.log(`[mock] inlogcode voor ${user.email}: ${OTP_CODE}`);
    return send(res, 200, {});
  }
  if (path === '/verify' && req.method === 'POST') {
    const body = await readBody(req);
    const user = await findUserByEmail(body.email ?? '');
    if (!user || body.token !== OTP_CODE) return authError(res, 403, 'otp_expired', 'Token has expired or is invalid');
    if (user.banned_until && new Date(user.banned_until) > new Date()) return authError(res, 403, 'user_banned', 'User is banned');
    // Zoals Supabase: het moment van inloggen (V38).
    await db.query('update auth.users set last_sign_in_at = now() where id = $1', [user.id]);
    return send(res, 200, session(user));
  }
  if (path === '/token' && req.method === 'POST') {
    const body = await readBody(req);
    // Zoals Supabase: een gebruikt token mag binnen 10 seconden nog een keer (gelijktijdige verzoeken).
    const reused = usedRefreshTokens.get(body.refresh_token);
    const userId = refreshTokens.get(body.refresh_token) ?? (reused && Date.now() - reused.at < 10_000 ? reused.userId : undefined);
    console.log(`[mock] ${new Date().toISOString()} refresh ${String(body.refresh_token).slice(0, 6)} ${userId ? (reused ? 'hergebruik' : 'ok') : 'ONBEKEND'} ua=${req.headers['user-agent']?.slice(0, 20)}`);
    if (!userId) return authError(res, 400, 'refresh_token_not_found', 'Invalid Refresh Token: Refresh Token Not Found');
    if (refreshTokens.delete(body.refresh_token)) usedRefreshTokens.set(body.refresh_token, { userId, at: Date.now() });
    const user = await findUserById(userId);
    if (!user) return authError(res, 400, 'user_not_found', 'User not found');
    return send(res, 200, session(user));
  }
  if (path === '/user' && req.method === 'GET') {
    const claims = verifyJwt(bearer);
    if (!claims) return authError(res, 401, 'bad_jwt', 'invalid JWT');
    const user = await findUserById(claims.sub);
    if (!user) return authError(res, 403, 'user_not_found', 'User from sub claim in JWT does not exist');
    return send(res, 200, userJson(user));
  }
  if (path === '/logout' && req.method === 'POST') {
    res.writeHead(204);
    return res.end();
  }
  if (path.startsWith('/admin/users')) {
    if (!isService) return authError(res, 403, 'not_admin', 'User not allowed');
    const id = path.split('/')[3];
    if (req.method === 'POST' && !id) {
      const body = await readBody(req);
      if (await findUserByEmail(body.email)) return authError(res, 422, 'email_exists', 'A user with this email address has already been registered');
      const r = await db.query('insert into auth.users (id, email) values (gen_random_uuid(), lower($1)) returning *', [body.email]);
      return send(res, 200, userJson(r.rows[0]));
    }
    if (req.method === 'GET' && !id) {
      const r = await db.query('select * from auth.users order by created_at');
      return send(res, 200, { users: r.rows.map(userJson), aud: 'authenticated' }, { 'x-total-count': String(r.rows.length) });
    }
    if (req.method === 'PUT' && id) {
      const body = await readBody(req);
      if (body.email) await db.query('update auth.users set email = lower($1) where id = $2', [body.email, id]);
      if (body.ban_duration) {
        if (body.ban_duration === 'none') await db.query('update auth.users set banned_until = null where id = $1', [id]);
        else await db.query(`update auth.users set banned_until = now() + interval '100 years' where id = $1`, [id]);
      }
      const user = await findUserById(id);
      return user ? send(res, 200, userJson(user)) : authError(res, 404, 'user_not_found', 'User not found');
    }
    if (req.method === 'DELETE' && id) {
      await db.query('delete from auth.users where id = $1', [id]);
      return send(res, 200, {});
    }
  }
  return authError(res, 404, 'not_found', `Onbekend auth-pad ${req.method} ${path}`);
}

// ---------- REST (PostgREST-subset) ----------
const IDENT = /^[a-z_][a-z0-9_]*$/;
const q = (name) => {
  if (!IDENT.test(name)) throw Object.assign(new Error(`Ongeldige naam ${name}`), { code: 'PGRST100' });
  return `"${name}"`;
};

function splitTopLevel(text) {
  const out = [];
  let depth = 0, current = '', quoted = false;
  for (const ch of text) {
    if (ch === '"') quoted = !quoted;
    if (!quoted && ch === '(') depth++;
    if (!quoted && ch === ')') depth--;
    if (!quoted && depth === 0 && ch === ',') { out.push(current); current = ''; continue; }
    current += ch;
  }
  if (current) out.push(current);
  return out;
}

function condition(column, expression, params, table) {
  if (column === 'or' || column === 'and') {
    const inner = expression.replace(/^\(/, '').replace(/\)$/, '');
    const parts = splitTopLevel(inner).map((part) => {
      const [col, ...rest] = part.split('.');
      return condition(col, rest.join('.'), params, table);
    });
    return `(${parts.join(column === 'or' ? ' or ' : ' and ')})`;
  }
  let [op, ...rest] = expression.split('.');
  let value = rest.join('.');
  let negate = false;
  if (op === 'not') { negate = true; [op, ...rest] = value.split('.'); value = rest.join('.'); }
  const col = `${table}.${q(column)}`;
  const param = (v) => { params.push(v.replace(/^"(.*)"$/, '$1')); return `$${params.length}`; };
  let sql;
  switch (op) {
    case 'eq': sql = `${col} = ${param(value)}`; break;
    case 'neq': sql = `${col} <> ${param(value)}`; break;
    case 'gt': sql = `${col} > ${param(value)}`; break;
    case 'gte': sql = `${col} >= ${param(value)}`; break;
    case 'lt': sql = `${col} < ${param(value)}`; break;
    case 'lte': sql = `${col} <= ${param(value)}`; break;
    case 'like': sql = `${col}::text like ${param(value.replaceAll('*', '%'))}`; break;
    case 'ilike': sql = `${col}::text ilike ${param(value.replaceAll('*', '%'))}`; break;
    case 'is': sql = `${col} is ${value === 'null' ? 'null' : value === 'true' ? 'true' : 'false'}`; break;
    case 'cs': sql = `${col} @> ${param(value)}`; break;
    case 'in': {
      const items = splitTopLevel(value.replace(/^\(/, '').replace(/\)$/, ''));
      sql = items.length ? `${col} in (${items.map(param).join(', ')})` : 'false';
      break;
    }
    default: throw Object.assign(new Error(`Onbekende operator ${op}`), { code: 'PGRST100' });
  }
  return negate ? `not (${sql})` : sql;
}

const RESERVED = new Set(['select', 'order', 'limit', 'offset', 'columns', 'on_conflict']);

function whereClause(url, params, table) {
  const conds = [];
  for (const [key, value] of url.searchParams) {
    if (RESERVED.has(key)) continue;
    conds.push(condition(key, value, params, table));
  }
  return conds.length ? ` where ${conds.join(' and ')}` : '';
}

// Splitst op komma's, maar niet binnen haakjes: "a,b:c(d,e)" geeft ["a", "b:c(d,e)"].
function splitTop(text) {
  const parts = [];
  let depth = 0;
  let current = '';
  for (const char of text) {
    if (char === ',' && depth === 0) {
      parts.push(current);
      current = '';
      continue;
    }
    if (char === '(') depth += 1;
    if (char === ')') depth -= 1;
    current += char;
  }
  return [...parts, current];
}

// De vreemde sleutel van een tabel naar een andere, voor een ingebedde rij.
async function foreignKey(table, target) {
  const r = await db.query(
    `select a.attname as col, af.attname as ref from pg_constraint c
       join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
       join pg_attribute af on af.attrelid = c.confrelid and af.attnum = c.confkey[1]
     where c.contype = 'f' and c.conrelid = $1::regclass and c.confrelid = $2::regclass`,
    [`public.${table}`, `public.${target}`],
  );
  if (r.rows.length !== 1) throw Object.assign(new Error(`Geen eenduidige relatie tussen ${table} en ${target}`), { code: 'PGRST200' });
  return r.rows[0];
}

// Kolommen, en ingebedde rijen zoals "employee:employees(id,name)". Alleen veel-op-één, via een
// vreemde sleutel van deze tabel: meer heeft de app niet nodig. RLS geldt ook voor de ingebedde rij.
async function selectList(url, alias, table) {
  const select = url.searchParams.get('select') ?? '*';
  if (select === '*') return `${alias}.*`;
  const columns = [];
  for (const item of splitTop(select).map((part) => part.trim())) {
    const embed = item.match(/^(?:(\w+):)?(\w+)\((.*)\)$/);
    if (!embed) {
      columns.push(`${alias}.${q(item)}`);
      continue;
    }
    const [, name, target, inner] = embed;
    const fk = await foreignKey(table, target);
    const list = inner.split(',').map((c) => `_e.${q(c.trim())}`).join(', ');
    columns.push(`(select to_json(_x) from (select ${list} from public.${q(target)} _e where _e.${q(fk.ref)} = ${alias}.${q(fk.col)}) _x) as ${q(name ?? target)}`);
  }
  return columns.join(', ');
}

function orderClause(url, alias) {
  const order = url.searchParams.get('order');
  if (!order) return '';
  return ` order by ${order.split(',').map((item) => {
    const [col, dir = 'asc', nulls] = item.split('.');
    return `${alias}.${q(col)} ${dir === 'desc' ? 'desc' : 'asc'}${nulls === 'nullsfirst' ? ' nulls first' : nulls === 'nullslast' ? ' nulls last' : ''}`;
  }).join(', ')}`;
}

function pgError(res, error, role) {
  const code = error.code ?? '';
  let status = 400;
  if (code === '42501') status = role === 'anon' ? 401 : 403;
  else if (['23505', '23503', '23P01'].includes(code)) status = 409;
  else if (code.startsWith('PGRST')) status = 400;
  else if (!/^(22|23|P0|40)/.test(code)) status = 500;
  if (status === 500) console.error('[mock] fout', error);
  send(res, status, { code, message: error.message, details: error.detail ?? null, hint: error.hint ?? null });
}

async function withRole(role, claims, fn) {
  return db.transaction(async (tx) => {
    await tx.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify(claims)]);
    await tx.exec(`set local role ${role}`);
    return fn(tx);
  });
}

async function handleRest(req, res, url) {
  const apikey = req.headers['apikey'];
  const bearer = (req.headers['authorization'] ?? '').replace(/^Bearer /i, '');
  const claims = verifyJwt(bearer);
  let role = 'anon';
  let jwtClaims = { role: 'anon' };
  if (claims) { role = 'authenticated'; jwtClaims = claims; }
  else if (apikey === SECRET_KEY || bearer === SECRET_KEY) { role = 'service_role'; jwtClaims = { role: 'service_role' }; }

  const path = url.pathname.replace('/rest/v1/', '');
  const prefer = String(req.headers['prefer'] ?? '');
  const wantObject = String(req.headers['accept'] ?? '').includes('vnd.pgrst.object');
  try {
    if (path.startsWith('rpc/')) {
      const fn = path.slice(4);
      const body = req.method === 'POST' ? await readBody(req) : {};
      const params = [];
      const args = Object.entries(body).map(([k, v]) => { params.push(v === null ? null : typeof v === 'object' ? JSON.stringify(v) : v); return `${q(k)} => $${params.length}`; });
      // Een functie die niets teruggeeft (void) kan niet door to_json: dan gewoon aanroepen.
      const isVoid = await db.query(`select p.prorettype = 'void'::regtype as v from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = $1 limit 1`, [fn]);
      const call = isVoid.rows[0]?.v ? `select public.${q(fn)}(${args.join(', ')})` : `select to_json(public.${q(fn)}(${args.join(', ')})) as r`;
      const result = await withRole(role, jwtClaims, (tx) => tx.query(call, params));
      if (isVoid.rows[0]?.v) { res.writeHead(204); return res.end(); }
      return send(res, 200, JSON.stringify(result.rows[0]?.r ?? null));
    }

    const table = `public.${q(path)}`;
    const alias = '_t';
    const params = [];
    let sql;
    if (req.method === 'GET' || req.method === 'HEAD') {
      const where = whereClause(url, params, alias);
      const limit = url.searchParams.get('limit');
      const offset = url.searchParams.get('offset');
      const inner = `select ${await selectList(url, alias, path)} from ${table} ${alias}${where}${orderClause(url, alias)}${limit ? ` limit ${Number(limit)}` : ''}${offset ? ` offset ${Number(offset)}` : ''}`;
      sql = `select coalesce(json_agg(_r), '[]') as r from (${inner}) _r`;
      const countSql = prefer.includes('count=exact') ? `select count(*)::int as n from ${table} ${alias}${where}` : null;
      const { rows, count } = await withRole(role, jwtClaims, async (tx) => {
        const r = await tx.query(sql, params);
        const c = countSql ? await tx.query(countSql, params) : null;
        return { rows: r.rows[0].r, count: c?.rows[0].n };
      });
      const headers = count !== undefined ? { 'Content-Range': `0-${Math.max(rows.length - 1, 0)}/${count}` } : {};
      if (req.method === 'HEAD') { res.writeHead(200, headers); return res.end(); }
      if (wantObject) {
        if (rows.length !== 1) return send(res, 406, { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: `The result contains ${rows.length} rows`, hint: null });
        return send(res, 200, rows[0], headers);
      }
      return send(res, 200, rows, headers);
    }

    const returning = prefer.includes('return=representation');
    if (req.method === 'POST') {
      const body = await readBody(req);
      const rows = Array.isArray(body) ? body : [body];
      const columns = url.searchParams.get('columns')?.split(',').map((c) => c.replaceAll('"', '').trim()) ?? [...new Set(rows.flatMap(Object.keys))];
      params.push(JSON.stringify(rows));
      const cols = columns.map(q).join(', ');
      sql = `insert into ${table} (${cols}) select ${cols} from json_populate_recordset(null::${table}, $1::json)`;
    } else if (req.method === 'PATCH') {
      const body = await readBody(req);
      params.push(JSON.stringify(body));
      const sets = Object.keys(body).map((c) => `${q(c)} = _new.${q(c)}`).join(', ');
      const where = whereClause(url, params, alias);
      sql = `update ${table} ${alias} set ${sets} from (select * from json_populate_record(null::${table}, $1::json)) _new${where}`;
    } else if (req.method === 'DELETE') {
      sql = `delete from ${table} ${alias}${whereClause(url, params, alias)}`;
      if (prefer.includes('count=exact') && !returning) {
        const result = await withRole(role, jwtClaims, (tx) => tx.query(`with _w as (${sql} returning 1) select count(*)::int as n from _w`, params));
        res.writeHead(204, { 'Content-Range': `*/${result.rows[0].n}` });
        return res.end();
      }
    } else {
      return send(res, 405, { message: 'Method not allowed' });
    }
    const wrapped = returning ? `with _w as (${sql} returning ${req.method === 'POST' ? '*' : `${alias}.*`}) select coalesce(json_agg(_w), '[]') as r from _w` : sql;
    const result = await withRole(role, jwtClaims, (tx) => tx.query(wrapped, params));
    if (!returning) { res.writeHead(req.method === 'POST' ? 201 : 204); return res.end(); }
    const rows = result.rows[0].r;
    if (wantObject) {
      if (rows.length !== 1) return send(res, 406, { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: `The result contains ${rows.length} rows`, hint: null });
      return send(res, req.method === 'POST' ? 201 : 200, rows[0]);
    }
    return send(res, req.method === 'POST' ? 201 : 200, rows);
  } catch (error) {
    return pgError(res, error, role);
  }
}

// ---------- Beheer van de mock (alleen lokaal) ----------
async function handleMock(req, res, url) {
  if (url.pathname === '/mock/sql' && req.method === 'POST') {
    const body = await readBody(req);
    try {
      const r = await db.query(body.sql, body.params ?? []);
      return send(res, 200, r.rows);
    } catch (error) {
      return send(res, 400, { message: error.message });
    }
  }
  return send(res, 404, {});
}

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    try {
      if (process.env.MOCK_LOG) console.log(`[mock] ${req.method} ${url.pathname}${url.search}`);
      if (DELAY_MS > 0 && !url.pathname.startsWith('/mock/')) await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
      if (url.pathname.startsWith('/auth/v1')) return await handleAuth(req, res, url);
      if (url.pathname.startsWith('/rest/v1')) return await handleRest(req, res, url);
      if (url.pathname.startsWith('/mock/')) return await handleMock(req, res, url);
      send(res, 404, { message: 'not found' });
    } catch (error) {
      console.error('[mock] onverwachte fout', error);
      send(res, 500, { message: String(error) });
    }
  })
  .listen(PORT, () => console.log(`[mock] Supabase-mock op http://localhost:${PORT}`));
