import 'server-only';
import { createAdminClient, type AdminClient } from '../db/admin';

/**
 * Accountbeheer via de admin-API van Supabase (secret key). Alleen voor: accounts aanmaken,
 * e-mailadres wijzigen, inloggen blokkeren bij inactief (besluit V4) en, in fase 3, het account
 * verwijderen bij volledig verwijderen van een medewerker (V21).
 */

const BLOCK_DURATION = '876000h'; // 100 jaar

export type AccountResult = { ok: true } | { ok: false; error: string };

async function findUserIdByEmail(admin: AdminClient, email: string): Promise<string | null> {
  const perPage = 200;
  for (let page = 1; page <= 25; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) return null;
    const match = data.users.find((user) => user.email?.toLowerCase() === email);
    if (match) return match.id;
    if (data.users.length < perPage) return null;
  }
  return null;
}

/** Maakt een bevestigd inlogaccount voor dit adres (of vindt het bestaande) en koppelt het. */
export async function ensureAccount(employeeId: string, email: string): Promise<AccountResult> {
  const admin = createAdminClient();
  const created = await admin.auth.admin.createUser({ email, email_confirm: true });
  let userId = created.data.user?.id ?? null;
  if (!userId) {
    const exists = created.error?.code === 'email_exists' || created.error?.status === 422;
    if (!exists) {
      console.error('Account aanmaken mislukt', created.error?.status, created.error?.message);
      return { ok: false, error: 'Het inlogaccount kon niet worden aangemaakt. Probeer het later opnieuw.' };
    }
    userId = await findUserIdByEmail(admin, email);
    if (!userId) return { ok: false, error: 'Het bestaande inlogaccount voor dit adres is niet gevonden.' };
    // Een eerder geblokkeerd account weer vrijgeven.
    await admin.auth.admin.updateUserById(userId, { ban_duration: 'none' });
  }
  const linked = await admin
    .from('employee_accounts')
    .update({ user_id: userId })
    .eq('employee_id', employeeId)
    .eq('email', email);
  if (linked.error) {
    console.error('Account koppelen mislukt', linked.error.message);
    return { ok: false, error: 'Het account is aangemaakt, maar koppelen lukte niet. Dat gebeurt bij de eerste keer inloggen alsnog.' };
  }
  return { ok: true };
}

/** Wijzigt het e-mailadres van een bestaand inlogaccount. */
export async function changeAccountEmail(userId: string, email: string): Promise<AccountResult> {
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(userId, { email, email_confirm: true });
  if (error) {
    console.error('E-mailadres wijzigen mislukt', error.status, error.message);
    return {
      ok: false,
      error:
        error.status === 422
          ? 'Dit e-mailadres is al in gebruik voor een ander inlogaccount.'
          : 'Het e-mailadres van het inlogaccount kon niet worden gewijzigd.',
    };
  }
  return { ok: true };
}

/** Blokkeert of deblokkeert inloggen (bij inactief zetten of weer actief maken). */
export async function setAccountBlocked(userId: string, blocked: boolean): Promise<AccountResult> {
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(userId, { ban_duration: blocked ? BLOCK_DURATION : 'none' });
  if (error) {
    console.error('Account blokkeren mislukt', error.status, error.message);
    return { ok: false, error: 'Inloggen kon niet worden geblokkeerd of vrijgegeven.' };
  }
  return { ok: true };
}

/** Verwijdert het inlogaccount bij volledig verwijderen (fase 3, V21). Bestaat het al niet meer, dan is dat goed. */
export async function deleteAccount(userId: string): Promise<AccountResult> {
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error && error.status !== 404) {
    console.error('Account verwijderen mislukt', error.status, error.message);
    return { ok: false, error: 'Het inlogaccount kon niet worden verwijderd. Er is niets verwijderd; probeer het opnieuw.' };
  }
  return { ok: true };
}
