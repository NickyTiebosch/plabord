/**
 * De uitnodiging (V33): wie er een krijgt bij "Iedereen uitnodigen", en wat de beheerder ziet bij
 * een medewerker. Puur. De stand komt uit de wachtrij; Planbord bewaart er verder niets over.
 */
import { todayInAmsterdam } from '../engine/dates';
import { formatDayShort } from '../engine/format';
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
  createdAt: string;
  sentAt: string | null;
}

/** Uitgenodigd is wie een uitnodiging heeft die verstuurd is, klaarstaat of nog opnieuw geprobeerd wordt. */
export function isInvited(status: MailStatus): boolean {
  return status === 'sent' || status === 'pending' || status === 'failed';
}

/** Kan deze medewerker een uitnodiging krijgen? Alleen wie actief is en een inlogaccount heeft. */
export function canBeInvited(employee: InviteCandidate): boolean {
  return employee.isActive && employee.hasAccount;
}

/**
 * "Iedereen uitnodigen": wie actief is, een inlogaccount heeft en nog geen uitnodiging kreeg. Niet
 * de beheerder zelf. In de volgorde van `employees`.
 */
export function inviteTargets(
  employees: readonly InviteCandidate[],
  invites: readonly Pick<InviteRecord, 'employeeId' | 'status'>[],
  viewerId: string,
): string[] {
  const invited = new Set(invites.filter((invite) => isInvited(invite.status)).map((invite) => invite.employeeId));
  return employees
    .filter((employee) => canBeInvited(employee) && employee.id !== viewerId && !invited.has(employee.id))
    .map((employee) => employee.id);
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
export function inviteStatusText(invite: InviteRecord | null): string {
  if (!invite) return 'Nog niet uitgenodigd.';
  switch (invite.status) {
    case 'sent':
      return `Uitgenodigd op ${formatDayShort(todayInAmsterdam(new Date(invite.sentAt ?? invite.createdAt)))}.`;
    case 'pending':
      return 'De uitnodiging wordt verstuurd.';
    case 'failed':
      return 'De uitnodiging is nog niet gelukt. Planbord probeert het elk uur opnieuw.';
    case 'skipped':
      return 'De uitnodiging is niet verstuurd: er was geen werkmail.';
  }
}
