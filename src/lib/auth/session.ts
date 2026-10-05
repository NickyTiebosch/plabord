import 'server-only';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { createClient, type ServerClient } from '../db/server';

export interface Viewer {
  userId: string;
  email: string | null;
  employeeId: string;
  name: string;
  groupId: string;
  isAdmin: boolean;
  supabase: ServerClient;
}

/** De Supabase-client van dit verzoek, met de sessie uit de cookies. */
const getClient = cache(createClient);

async function findEmployee(supabase: ServerClient, userId: string) {
  // Eén vraag aan de database: het account met de medewerker erbij. RLS geldt voor allebei.
  const account = await supabase
    .from('employee_accounts')
    .select('employee:employees(id, name, group_id, is_admin, is_active)')
    .eq('user_id', userId)
    .maybeSingle();
  const employee = account.data?.employee;
  return employee?.is_active ? employee : null;
}

/** De sessie van dit verzoek (één keer per verzoek opgehaald). */
export const getSession = cache(async () => {
  const supabase = await getClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = error ? null : data?.claims;
  if (!claims?.sub) return { supabase, userId: null, email: null, employee: null } as const;

  let employee = await findEmployee(supabase, claims.sub);
  if (!employee) {
    // Eerste keer inloggen, of het koppelen bij het aanmaken ging mis: koppel op e-mailadres.
    const claimed = await supabase.rpc('claim_account');
    if (claimed.data) employee = await findEmployee(supabase, claims.sub);
  }
  return {
    supabase,
    userId: claims.sub,
    email: typeof claims.email === 'string' ? claims.email : null,
    employee,
  } as const;
});

/** Ingelogd én gekoppeld aan een actieve medewerker; anders doorsturen. */
export async function requireViewer(): Promise<Viewer> {
  const session = await getSession();
  if (!session.userId) redirect('/inloggen');
  if (!session.employee) redirect('/geen-toegang');
  return {
    userId: session.userId,
    email: session.email,
    employeeId: session.employee.id,
    name: session.employee.name,
    groupId: session.employee.group_id,
    isAdmin: session.employee.is_admin,
    supabase: session.supabase,
  };
}

/** Alleen voor beheerders. RLS controleert het daarna nog een keer. */
export async function requireAdmin(): Promise<Viewer> {
  const viewer = await requireViewer();
  if (!viewer.isAdmin) redirect('/');
  return viewer;
}

