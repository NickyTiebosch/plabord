/**
 * Een tijdelijke Postgres-database in het geheugen (PGlite) met een minimaal nagebootste Supabase:
 * de rollen anon, authenticated en service_role, en een auth-schema met users, uid() en jwt().
 * Net als Supabase krijgen nieuwe objecten in public standaard alle rechten, zodat de tests
 * bewijzen dat de migraties daar niet op vertrouwen.
 */
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';
import { bundlePath } from '../../scripts/bundle-sql.ts';

export const SUPABASE_MOCK_SQL = `
create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;

create schema auth;
grant usage on schema auth to anon, authenticated, service_role;
create table auth.users (
  id uuid primary key,
  email text unique,
  created_at timestamptz not null default now()
);
create function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;
create function auth.uid() returns uuid language sql stable as $$
  select nullif(auth.jwt() ->> 'sub', '')::uuid
$$;
grant execute on function auth.jwt() to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
`;

export function setupSql(): string {
  return readFileSync(bundlePath('fase-1'), 'utf8');
}

export async function createDatabase(): Promise<PGlite> {
  const db = await PGlite.create({ extensions: { btree_gist } });
  await db.exec(SUPABASE_MOCK_SQL);
  await db.exec(setupSql());
  return db;
}

export type Session =
  | { role: 'anon' }
  | { role: 'authenticated'; userId: string; email?: string }
  | { role: 'service_role' };

/** Zet de rol en JWT-claims zoals Supabase dat per verzoek doet. */
export async function setSession(db: PGlite, session: Session | null): Promise<void> {
  await db.exec('reset role');
  if (!session) {
    await db.query(`select set_config('request.jwt.claims', '', false)`);
    return;
  }
  const claims =
    session.role === 'authenticated'
      ? { sub: session.userId, email: session.email ?? null, role: 'authenticated' }
      : { role: session.role };
  await db.query(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify(claims)]);
  await db.exec(`set role ${session.role}`);
}

/** Voert `fn` uit met een sessie en zet daarna de beheerdersrol (postgres) terug. */
export async function withSession<T>(db: PGlite, session: Session, fn: () => Promise<T>): Promise<T> {
  await setSession(db, session);
  try {
    return await fn();
  } finally {
    await setSession(db, null);
  }
}

export interface TestPerson {
  employeeId: string;
  userId: string | null;
  email: string | null;
}

/** Maakt (als postgres, zonder RLS) een medewerker aan, met werkmail en inlogaccount als gevraagd. */
export async function createPerson(
  db: PGlite,
  options: {
    name: string;
    groupId?: string;
    role?: string;
    isAdmin?: boolean;
    isActive?: boolean;
    email?: string | null;
    withUser?: boolean;
    linkUser?: boolean;
  },
): Promise<TestPerson> {
  const email = options.email === undefined ? `${options.name.toLowerCase()}@voorbeeld.nl` : options.email;
  const employee = await db.query<{ id: string }>(
    `insert into public.employees (name, group_id, default_role, is_admin, is_active)
     values ($1, $2, $3, $4, $5) returning id`,
    [
      options.name,
      options.groupId ?? 'den_bosch',
      options.role ?? 'counter',
      options.isAdmin ?? false,
      options.isActive ?? true,
    ],
  );
  const employeeId = employee.rows[0]?.id;
  if (!employeeId) throw new Error('Medewerker niet aangemaakt');
  let userId: string | null = null;
  if (email && (options.withUser ?? true)) {
    userId = randomUUID();
    await db.query('insert into auth.users (id, email) values ($1, $2)', [userId, email]);
  }
  if (email) {
    await db.query('insert into public.employee_accounts (employee_id, email, user_id) values ($1, $2, $3)', [
      employeeId,
      email,
      options.linkUser === false ? null : userId,
    ]);
  }
  return { employeeId, userId, email };
}

export function session(person: TestPerson): Session {
  if (!person.userId) throw new Error('Deze testpersoon heeft geen inlogaccount');
  return { role: 'authenticated', userId: person.userId, email: person.email ?? undefined };
}

/** Verwacht dat een query faalt met een melding die `pattern` bevat. */
export async function expectError(promise: Promise<unknown>, pattern: RegExp): Promise<void> {
  try {
    await promise;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!pattern.test(message)) throw new Error(`Verwachtte fout ${pattern}, kreeg: ${message}`);
    return;
  }
  throw new Error(`Verwachtte fout ${pattern}, maar de query slaagde`);
}
