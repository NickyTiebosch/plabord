/**
 * De uitnodiging (V33): wie er een krijgt bij "Iedereen uitnodigen", en wat de beheerder ziet bij
 * een medewerker. Puur: "nu" komt binnen als parameter. De stand komt uit de wachtrij; Planbord
 * bewaart er verder niets over. Per medewerker telt de laatste uitnodiging (V39).
 */
import { todayInAmsterdam } from '../engine/dates';
import { formatDayShort } from '../engine/format';
import { MAX_ATTEMPTS, RETRY_WINDOW_MS } from './reminders';
import type { MailStatus } from './types';

export interface InviteCandidate {
  id: string;
  isActive: boolean;
  /** Zonder inlogaccount kan iemand niet inloggen; dan heeft een uitnodiging geen zin. */
  hasAccount: boolean;
}

/** Een uitnodiging uit de wachtrij. */
export interface InviteRecord {
  employeeId: string;
  status: MailStatus;
  attempts: number;
  createdAt: string;
  sentAt: string | null;
}

/**
 * De stand van de laatste uitnodiging (V39):
 * - `none`: nog nooit uitgenodigd;
 * - `sent`: verstuurd;
 * - `pending`: klaar om te versturen;
 * - `retrying`: mislukt, en de geplande taak probeert het nog;
 * - `failed`: mislukt, en Planbord probeert het niet meer;
 * - `skipped`: niet verstuurd, omdat er geen werkmail was.
 */
export type InviteState = 'none' | 'sent' | 'pending' | 'retrying' | 'failed' | 'skipped';

/** Hoe vaak de geplande taak deze uitnodiging nog probeert: hooguit drie keer, in de eerste week. */
export function inviteRetriesLeft(invite: InviteRecord, now: Date): number {
  if (invite.status !== 'pending' && invite.status !== 'failed') return 0;
  if (now.getTime() - Date.parse(invite.createdAt) >= RETRY_WINDOW_MS) return 0;
  return Math.max(0, MAX_ATTEMPTS - invite.attempts);
}

export function inviteState(invite: InviteRecord | null | undefined, now: Date): InviteState {
  if (!invite) return 'none';
  switch (invite.status) {
    case 'sent':
      return 'sent';
    case 'skipped':
      return 'skipped';
    case 'pending':
      return inviteRetriesLeft(invite, now) > 0 ? 'pending' : 'failed';
    case 'failed':
      return inviteRetriesLeft(invite, now) > 0 ? 'retrying' : 'failed';
  }
}

/** Uitgenodigd is wie een uitnodiging heeft die verstuurd is of klaarstaat. */
export function isInvited(state: InviteState): boolean {
  return state === 'sent' || state === 'pending';
}

/** Mislukt, of Planbord het nu nog probeert of niet. */
export function inviteFailed(state: InviteState): boolean {
  return state === 'retrying' || state === 'failed';
}

/** Kan deze medewerker een uitnodiging krijgen? Alleen wie actief is en een inlogaccount heeft. */
export function canBeInvited(employee: InviteCandidate): boolean {
  return employee.isActive && employee.hasAccount;
}

/**
 * "Iedereen uitnodigen": wie actief is, een inlogaccount heeft en geen uitnodiging heeft die
 * verstuurd is of klaarstaat. Dus ook wie een mislukte uitnodiging heeft (V39). Niet de beheerder
 * zelf. In de volgorde van `employees`.
 */
export function inviteTargets(
  employees: readonly InviteCandidate[],
  invites: readonly InviteRecord[],
  viewerId: string,
  now: Date,
): string[] {
  const latest = latestInvites(invites);
  return employees
    .filter((employee) => canBeInvited(employee) && employee.id !== viewerId)
    .filter((employee) => !isInvited(inviteState(latest.get(employee.id), now)))
    .map((employee) => employee.id);
}

/** Het blok Iedereen uitnodigen: voor hoeveel collega's de knop is, en wat erboven staat. */
export function inviteEveryoneText(
  employees: readonly InviteCandidate[],
  invites: readonly InviteRecord[],
  viewerId: string,
  now: Date,
): { count: number; text: string } {
  const latest = latestInvites(invites);
  const targets = inviteTargets(employees, invites, viewerId, now);
  if (targets.length === 0) {
    return { count: 0, text: 'Iedereen die kan inloggen, heeft een uitnodiging gehad. Een nieuwe collega nodig je uit op diens pagina.' };
  }
  const again = targets.filter((id) => inviteFailed(inviteState(latest.get(id), now))).length;
  const fresh = targets.length - again;
  const parts: string[] = [];
  if (fresh > 0) {
    parts.push(
      `${fresh} ${fresh === 1 ? 'collega kan' : "collega's kunnen"} inloggen maar ${fresh === 1 ? 'heeft' : 'hebben'} nog geen uitnodiging gehad.`,
    );
  }
  if (again > 0) parts.push(`Bij ${again} ${again === 1 ? 'collega' : "collega's"} is de uitnodiging mislukt.`);
  return { count: targets.length, text: parts.join(' ') };
}

/** De laatste uitnodiging per medewerker. */
export function latestInvites(invites: readonly InviteRecord[]): Map<string, InviteRecord> {
  const latest = new Map<string, InviteRecord>();
  for (const invite of invites) {
    const current = latest.get(invite.employeeId);
    if (!current || invite.createdAt > current.createdAt) latest.set(invite.employeeId, invite);
  }
  return latest;
}

/** Wat de beheerder bij een medewerker ziet, bijvoorbeeld "Uitgenodigd op di 6 okt." */
export function inviteStatusText(invite: InviteRecord | null, now: Date): string {
  if (!invite) return 'Nog niet uitgenodigd.';
  switch (inviteState(invite, now)) {
    case 'sent':
      return `Uitgenodigd op ${formatDayShort(todayInAmsterdam(new Date(invite.sentAt ?? invite.createdAt)))}.`;
    case 'pending':
      return 'De uitnodiging wordt verstuurd.';
    case 'retrying': {
      const left = inviteRetriesLeft(invite, now);
      return `De uitnodiging is nog niet gelukt. Planbord probeert het elk uur opnieuw (nog ${left} keer).`;
    }
    case 'failed':
      return 'De uitnodiging is niet gelukt en Planbord probeert het niet meer. Doe eerst een testmail (Beheer → Instellingen); lukt die, stuur hem dan opnieuw.';
    case 'none':
      return 'Nog niet uitgenodigd.';
    case 'skipped':
      return 'De uitnodiging is niet verstuurd: er was geen werkmail.';
  }
}
