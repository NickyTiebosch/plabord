import 'server-only';
import type { DbClient } from '../db/queries';
import { siteBaseUrl } from '../site-url';
import { sendInvites, sendNotices } from './dispatch';
import { mailOutcome, type DispatchCounts, type MailOutcome } from './outcome';
import type { MailNotice } from './types';

/**
 * Directe mails na een actie van een beheerder (fase 3, V14), met diens sessie. Geeft de code
 * voor de melding terug (`?mail=…`), of `null` als er geen mail bij hoorde.
 */
export async function mailAfterAction(client: DbClient, notices: readonly MailNotice[]): Promise<MailOutcome | null> {
  if (notices.length === 0) return null;
  const counts = await sendNotices(client, notices, { now: new Date(), appUrl: `${await siteBaseUrl()}/` });
  return mailOutcome(counts);
}

/** De uitnodiging (V33), met de sessie van de beheerder: een link naar de app en de uitleg. */
export async function inviteNow(client: DbClient, employeeIds: readonly string[]): Promise<DispatchCounts> {
  return sendInvites(client, employeeIds, { now: new Date(), appUrl: `${await siteBaseUrl()}/` });
}
