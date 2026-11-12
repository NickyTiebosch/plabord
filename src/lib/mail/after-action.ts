import 'server-only';
import type { Viewer } from '../auth/session';
import { createAdminClient } from '../db/admin';
import type { DbClient } from '../db/queries';
import { siteBaseUrl } from '../site-url';
import { sendInvites, sendNotices } from './dispatch';
import { mailOutcome, NO_MAILS, type DispatchCounts, type MailOutcome } from './outcome';
import type { MailNotice } from './types';

/** Wie de actie deed: de sessie, en of het een beheerder is. */
export type MailActor = Pick<Viewer, 'supabase' | 'isAdmin'>;

/**
 * Directe mails na een actie van een beheerder of teamleider (fase 3, V14), en sinds fase 4 de push.
 * Geeft de code voor de melding terug (`?mail=…`), of `null` als er geen mail bij hoorde.
 *
 * Een beheerder verstuurt met de eigen sessie. Een teamleider (fase 5, V43) mag de werkmails en
 * toestellen van collega's niet lezen; dan zet de server de mails klaar met de secret key. De
 * actie zelf is dan al gedaan met de sessie van de teamleider, en door RLS gecontroleerd.
 */
export async function mailAfterAction(actor: MailActor, notices: readonly MailNotice[]): Promise<MailOutcome | null> {
  if (notices.length === 0) return null;
  let client: DbClient;
  try {
    client = actor.isAdmin ? actor.supabase : createAdminClient();
  } catch (error) {
    console.error('Mails na een actie van een teamleider: geen secret key', error instanceof Error ? error.message : error);
    return mailOutcome({ ...NO_MAILS, failed: notices.length });
  }
  const counts = await sendNotices(client, notices, { now: new Date(), appUrl: `${await siteBaseUrl()}/` });
  return mailOutcome(counts);
}

/** De uitnodiging (V33), met de sessie van de beheerder: een link naar de app en de uitleg. */
export async function inviteNow(client: DbClient, employeeIds: readonly string[]): Promise<DispatchCounts> {
  return sendInvites(client, employeeIds, { now: new Date(), appUrl: `${await siteBaseUrl()}/` });
}
