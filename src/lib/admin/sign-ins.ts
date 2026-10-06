/**
 * Wie er al is begonnen (besluit V38): ingelogd, en meldingen aan. Puur.
 *
 * Het tijdstip van inloggen komt uit Supabase Auth: de laatste keer dat iemand een code invulde.
 * Collega's blijven daarna ingelogd, dus het zegt niet wanneer iemand de app voor het laatst opende.
 * Planbord slaat daar zelf niets van op. Of iemand Planbord op de telefoon heeft gezet, ziet de
 * server niet; meldingen aan is het teken (op een iPhone kan dat alleen vanaf het beginscherm).
 */
import { amsterdamDateTime } from '../engine/dates';
import { formatDayShort } from '../engine/format';
import { inviteFailed, isInvited, type InviteState } from '../mail/invites';

/** Per medewerker met een inlogaccount: wanneer die voor het laatst inlogde, of `null` als nog nooit. */
export type SignIns = ReadonlyMap<string, string | null>;

/** Het antwoord van `employee_sign_ins` (jsonb), zonder iets aan te nemen over de vorm. */
export function parseSignIns(value: unknown): Map<string, string | null> {
  const signIns = new Map<string, string | null>();
  if (!Array.isArray(value)) return signIns;
  for (const row of value as unknown[]) {
    if (!row || typeof row !== 'object') continue;
    const { employee_id: employeeId, last_sign_in_at: lastSignInAt } = row as Record<string, unknown>;
    if (typeof employeeId === 'string') signIns.set(employeeId, typeof lastSignInAt === 'string' ? lastSignInAt : null);
  }
  return signIns;
}

/** "Laatst ingelogd op di 6 okt om 14:05." of "Nog niet ingelogd." */
export function lastSignInText(lastSignInAt: string | null): string {
  if (!lastSignInAt) return 'Nog niet ingelogd.';
  const { date, time } = amsterdamDateTime(new Date(lastSignInAt));
  return `Laatst ingelogd op ${formatDayShort(date)} om ${time}.`;
}

export interface OnboardingBadge {
  label: string;
  tone: 'neutral' | 'warning' | 'success';
}

interface OnboardingPerson {
  id: string;
  isActive: boolean;
  email: string | null;
  hasAccount: boolean;
}

/** Het label voor de uitnodiging: verstuurd of klaar, of mislukt (V39). */
function inviteBadge(state: InviteState): OnboardingBadge[] {
  if (isInvited(state)) return [{ label: 'uitgenodigd', tone: 'success' }];
  if (inviteFailed(state)) return [{ label: 'uitnodiging mislukt', tone: 'warning' }];
  return [];
}

/**
 * De labels in de lijst met medewerkers. `lastSignInAt` is `undefined` als Planbord het niet weet,
 * bijvoorbeeld zolang de bundel van fase 4 nog niet opnieuw is gedraaid: dan blijft de lijst zoals hij was.
 */
export function onboardingBadges(
  employee: OnboardingPerson,
  status: { invite: InviteState; lastSignInAt: string | null | undefined; devices: number },
): OnboardingBadge[] {
  if (!employee.email) return [{ label: 'geen e-mail', tone: 'neutral' }];
  if (!employee.hasAccount) return [{ label: 'nog geen account', tone: 'warning' }];
  const invited = inviteBadge(status.invite);
  if (!employee.isActive || status.lastSignInAt === undefined) return invited;
  if (status.lastSignInAt === null) return [...invited, { label: 'nog niet ingelogd', tone: 'warning' }];
  const { date } = amsterdamDateTime(new Date(status.lastSignInAt));
  return [
    { label: `ingelogd ${formatDayShort(date)}`, tone: 'success' },
    status.devices > 0 ? { label: 'meldingen aan', tone: 'success' } : { label: 'meldingen uit', tone: 'warning' },
  ];
}

/** Het aantal rijen per medewerker, bijvoorbeeld toestellen met meldingen. */
export function countByEmployee(rows: readonly { employee_id: string }[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.employee_id, (counts.get(row.employee_id) ?? 0) + 1);
  return counts;
}

export interface OnboardingSummary {
  /** Actieve medewerkers met een inlogaccount. */
  withAccount: number;
  signedIn: number;
  notifications: number;
}

/** Hoeveel actieve collega's met een inlogaccount zijn ingelogd en meldingen aan hebben; `null` als het onbekend is. */
export function onboardingSummary(
  employees: readonly OnboardingPerson[],
  signIns: SignIns | null,
  devices: ReadonlyMap<string, number>,
): OnboardingSummary | null {
  if (!signIns) return null;
  const counted = employees.filter((employee) => employee.isActive && employee.hasAccount);
  return {
    withAccount: counted.length,
    signedIn: counted.filter((employee) => Boolean(signIns.get(employee.id))).length,
    notifications: counted.filter((employee) => (devices.get(employee.id) ?? 0) > 0).length,
  };
}

/** "2 van de 3 collega's met een inlogaccount zijn ingelogd. 1 heeft meldingen aan." */
export function onboardingSummaryText(summary: OnboardingSummary | null): string | null {
  if (!summary || summary.withAccount === 0) return null;
  const { withAccount, signedIn, notifications } = summary;
  return (
    `${signedIn} van de ${withAccount} ${withAccount === 1 ? 'collega' : "collega's"} met een inlogaccount ` +
    `${signedIn === 1 ? 'is' : 'zijn'} ingelogd. ${notifications} ${notifications === 1 ? 'heeft' : 'hebben'} meldingen aan.`
  );
}
