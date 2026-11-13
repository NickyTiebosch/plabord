import 'server-only';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { createClient, type ServerClient } from '../db/server';
import { loadWhileChecking } from './parallel';

export interface Viewer {
  userId: string;
  email: string | null;
  employeeId: string;
  name: string;
  groupId: string;
  isAdmin: boolean;
  /** Teamleider (fase 5, V43): helpt met afwezigheid, invallen en de registraties. */
  isTeamLead: boolean;
  /** Beheerder of teamleider. */
  isLead: boolean;
  /** Werkt met de uitleen (V52): een vestiging die uitleent, daar mogen invallen, of beheerder of teamleider. */
  usesLoans: boolean;
  supabase: ServerClient;
}

/** De Supabase-client van dit verzoek, met de sessie uit de cookies. */
const getClient = cache(createClient);

async function findEmployee(supabase: ServerClient, userId: string) {
  // Eén vraag aan de database: het account met de medewerker erbij. RLS geldt voor allebei.
  const account = await supabase
    .from('employee_accounts')
    .select('employee:employees(id, name, group_id, is_admin, is_team_lead, is_active)')
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
  if (!claims?.sub) return { supabase, userId: null, email: null, employee: null, usesLoans: false } as const;

  // Tegelijk: wie het is, en of die met de uitleen werkt (V52). Mislukt dat laatste, dan niet.
  const loans = supabase.rpc('uses_loans').then((result) => result.data === true, () => false);
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
    usesLoans: employee ? await loans : false,
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
    isTeamLead: session.employee.is_team_lead,
    isLead: session.employee.is_admin || session.employee.is_team_lead,
    usesLoans: session.usesLoans,
    supabase: session.supabase,
  };
}

/** Alleen voor beheerders. RLS controleert het daarna nog een keer. */
export async function requireAdmin(): Promise<Viewer> {
  const viewer = await requireViewer();
  if (!viewer.isAdmin) redirect('/');
  return viewer;
}

/** Beheerder of teamleider (fase 5, V43). RLS controleert het daarna nog een keer. */
export async function requireLead(): Promise<Viewer> {
  const viewer = await requireViewer();
  if (!viewer.isLead) redirect('/');
  return viewer;
}

/** Alleen voor wie met de uitleen werkt (V52). RLS controleert het daarna nog een keer. */
export async function requireLoans(): Promise<Viewer> {
  const viewer = await requireViewer();
  if (!viewer.usesLoans) redirect('/');
  return viewer;
}

/**
 * Als requireViewer(), maar de gegevens van de pagina laden al terwijl de controle loopt, in plaats
 * van erna. Dat scheelt een rondgang naar de database. De pagina krijgt de gegevens pas als de
 * controle slaagt, en RLS schermt ze hoe dan ook af.
 */
export function requireViewerWith<T>(load: (supabase: ServerClient) => Promise<T>): Promise<[Viewer, T]> {
  return checkWhileLoading(requireViewer, load);
}

/** Als requireAdmin(), met de gegevens tegelijk geladen (zie requireViewerWith). */
export function requireAdminWith<T>(load: (supabase: ServerClient) => Promise<T>): Promise<[Viewer, T]> {
  return checkWhileLoading(requireAdmin, load);
}

/** Als requireLoans(), met de gegevens tegelijk geladen (zie requireViewerWith). */
export function requireLoansWith<T>(load: (supabase: ServerClient) => Promise<T>): Promise<[Viewer, T]> {
  return checkWhileLoading(requireLoans, load);
}

/** Als requireLead(), met de gegevens tegelijk geladen (zie requireViewerWith). */
export function requireLeadWith<T>(load: (supabase: ServerClient) => Promise<T>): Promise<[Viewer, T]> {
  return checkWhileLoading(requireLead, load);
}

async function checkWhileLoading<T>(
  check: () => Promise<Viewer>,
  load: (supabase: ServerClient) => Promise<T>,
): Promise<[Viewer, T]> {
  const supabase = await getClient();
  return loadWhileChecking(check, () => load(supabase));
}
