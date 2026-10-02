import 'server-only';
import { loadPlanningSnapshot, type DbClient } from '../db/queries';
import { todayInAmsterdam } from '../engine/dates';
import { ConfigError } from '../env';
import { composeMail, personalDaysFor } from './messages';
import { mergeNotices } from './notices';
import { NO_MAILS, type DispatchCounts } from './outcome';
import { queueCleanupBefore, reminderDateAt, reminderTargets, shouldRetry } from './reminders';
import { smtpTransport, type MailTransport } from './send';
import { MAIL_KINDS, MAIL_STATUSES, type MailKind, type MailNotice, type QueuedMail } from './types';

/**
 * De wachtrij en het versturen (fase 3). Twee ingangen:
 * - `sendNotices`: directe mails na een actie van een beheerder, met diens sessie (V14, V17);
 * - `runMailJob`: de geplande taak, met de secret key: opnieuw proberen, herinneringen (V15) en opruimen.
 * In de wachtrij staan geen adressen en geen tekst; de tekst ontstaat hier, bij het versturen.
 * Een mail die niet lukt, laat de actie nooit mislukken.
 */

export interface DispatchOptions {
  now: Date;
  /** Link naar Mijn rooster in de mail, of `null`. */
  appUrl: string | null;
  /** Standaard SMTP met de instellingen uit de omgeving; tests geven een eigen transport. */
  transport?: () => MailTransport;
}

interface Recipient {
  name: string;
  email: string | null;
}

const SELECT_QUEUE = 'id, employee_id, kind, dates, status, attempts, created_at';

type QueueRow = { id: string; employee_id: string; kind: string; dates: string[]; status: string; attempts: number; created_at: string };

function toQueuedMail(row: QueueRow): QueuedMail | null {
  const kind = MAIL_KINDS.find((item) => item === row.kind);
  const status = MAIL_STATUSES.find((item) => item === row.status);
  if (!kind || !status) return null;
  return { id: row.id, employeeId: row.employee_id, kind, dates: row.dates, status, attempts: row.attempts, createdAt: row.created_at };
}

async function mailEnabled(client: DbClient): Promise<boolean> {
  const { data, error } = await client.from('settings').select('mail_enabled').maybeSingle();
  if (error) throw new Error(`Instelling mails laden mislukt: ${error.message}`);
  return Boolean(data?.mail_enabled);
}

/** Naam en werkmail van de ontvangers. De adressen gaan alleen naar de mailserver. */
async function recipients(client: DbClient, employeeIds: readonly string[]): Promise<Map<string, Recipient>> {
  const ids = [...new Set(employeeIds)];
  const result = new Map<string, Recipient>();
  if (ids.length === 0) return result;
  const [people, accounts] = await Promise.all([
    client.from('employees').select('id, name, is_active').in('id', ids),
    client.from('employee_accounts').select('employee_id, email').in('employee_id', ids),
  ]);
  if (people.error) throw new Error(`Medewerkers laden mislukt: ${people.error.message}`);
  if (accounts.error) throw new Error(`Werkmails laden mislukt: ${accounts.error.message}`);
  const emails = new Map((accounts.data ?? []).map((row) => [row.employee_id, row.email]));
  for (const person of people.data ?? []) {
    // Wie inactief is, krijgt geen mail meer.
    result.set(person.id, { name: person.name, email: person.is_active ? (emails.get(person.id) ?? null) : null });
  }
  return result;
}

interface NewMail {
  employeeId: string;
  kind: MailKind;
  dates: string[];
}

/** Zet mails in de wachtrij: `pending`, of meteen `skipped` als mails uit staan of er geen werkmail is. */
async function enqueue(
  client: DbClient,
  mails: readonly NewMail[],
  enabled: boolean,
  people: ReadonlyMap<string, Recipient>,
): Promise<QueuedMail[]> {
  const rows = mails.map((mail) => {
    const off = !enabled && mail.kind !== 'test';
    const noAddress = !people.get(mail.employeeId)?.email;
    return {
      employee_id: mail.employeeId,
      kind: mail.kind,
      dates: mail.dates,
      status: off || noAddress ? 'skipped' : 'pending',
      last_error: off ? 'mails uit' : noAddress ? 'geen werkmail' : null,
    };
  });
  if (rows.length === 0) return [];
  const { data, error } = await client.from('mail_queue').insert(rows).select(SELECT_QUEUE);
  if (error) throw new Error(`Mails klaarzetten mislukt: ${error.message}`);
  return (data ?? []).map(toQueuedMail).filter((mail): mail is QueuedMail => mail !== null);
}

function countSkipped(mails: readonly QueuedMail[], people: ReadonlyMap<string, Recipient>): DispatchCounts {
  const skipped = mails.filter((mail) => mail.status === 'skipped');
  const noAddress = skipped.filter((mail) => !people.get(mail.employeeId)?.email).length;
  return { ...NO_MAILS, noAddress, disabled: skipped.length - noAddress };
}

function addCounts(a: DispatchCounts, b: DispatchCounts): DispatchCounts {
  return { sent: a.sent + b.sent, failed: a.failed + b.failed, disabled: a.disabled + b.disabled, noAddress: a.noAddress + b.noAddress };
}

/**
 * Verstuurt de mails met status `pending` of `failed` uit `mails`. Is een vervallen inval gemaild,
 * dan is die vanzelf afgehandeld en verdwijnt hij uit "Let op" (V19).
 */
async function deliver(
  client: DbClient,
  mails: readonly QueuedMail[],
  people: ReadonlyMap<string, Recipient>,
  options: DispatchOptions,
): Promise<DispatchCounts> {
  const open = mails.filter((mail) => mail.status === 'pending' || mail.status === 'failed');
  if (open.length === 0) return NO_MAILS;

  const dates = open.flatMap((mail) => mail.dates).sort();
  const first = dates[0];
  const last = dates.at(-1);
  const snapshot = first && last ? await loadPlanningSnapshot(client, { from: first, to: last }) : null;

  let transport: MailTransport | null = null;
  let setupError = 'mailserver niet ingesteld';
  try {
    transport = (options.transport ?? smtpTransport)();
  } catch (error) {
    if (!(error instanceof ConfigError)) setupError = 'mailserver onbereikbaar';
    console.error('Mailserver niet beschikbaar', error instanceof Error ? error.message : error);
  }

  const counts = { ...NO_MAILS };
  try {
    for (const mail of open) {
      const person = people.get(mail.employeeId);
      const attempts = mail.attempts + 1;
      if (!person?.email) {
        await client.from('mail_queue').update({ status: 'skipped', attempts, last_error: 'geen werkmail' }).eq('id', mail.id);
        counts.noAddress++;
        continue;
      }
      if (!transport) {
        await client.from('mail_queue').update({ status: 'failed', attempts, last_error: setupError }).eq('id', mail.id);
        counts.failed++;
        continue;
      }
      const content = composeMail({
        kind: mail.kind,
        name: person.name,
        days: snapshot && mail.kind !== 'test' ? personalDaysFor(snapshot, mail.employeeId, mail.dates) : [],
        groups: snapshot?.groups ?? [],
        appUrl: options.appUrl,
      });
      try {
        await transport.send({ to: person.email, ...content });
      } catch (error) {
        // Nooit het adres loggen; alleen dat het misging.
        console.error('Mail versturen mislukt', mail.kind, error instanceof Error ? error.name : 'fout');
        await client.from('mail_queue').update({ status: 'failed', attempts, last_error: 'versturen mislukt' }).eq('id', mail.id);
        counts.failed++;
        continue;
      }
      const sentAt = options.now.toISOString();
      await client.from('mail_queue').update({ status: 'sent', attempts, last_error: null, sent_at: sentAt }).eq('id', mail.id);
      counts.sent++;
      if (mail.kind === 'substitution_cancelled') {
        await client
          .from('substitutions')
          .update({ handled_at: sentAt })
          .eq('employee_id', mail.employeeId)
          .in('date', mail.dates)
          .neq('status', 'active')
          .is('handled_at', null);
      }
    }
  } finally {
    transport?.close();
  }
  return counts;
}

/**
 * Directe mails na een actie van een beheerder (V14): per persoon hooguit één, niet over het
 * verleden. Gebruikt de sessie van de beheerder. Mislukt er iets, dan blijft de actie gewoon gelukt.
 */
export async function sendNotices(client: DbClient, notices: readonly MailNotice[], options: DispatchOptions): Promise<DispatchCounts> {
  const merged = mergeNotices(notices, todayInAmsterdam(options.now));
  if (merged.length === 0) return NO_MAILS;
  try {
    const [enabled, people] = await Promise.all([mailEnabled(client), recipients(client, merged.map((mail) => mail.employeeId))]);
    const queued = await enqueue(client, merged, enabled, people);
    return addCounts(countSkipped(queued, people), await deliver(client, queued, people, options));
  } catch (error) {
    console.error('Mails na een actie mislukt', error instanceof Error ? error.message : error);
    return { ...NO_MAILS, failed: merged.length };
  }
}

export type TestMailResult = 'verstuurd' | 'mislukt' | 'geen-adres';

/** De testmail van een beheerder aan zichzelf (V18). Gaat altijd, ook als mails uit staan. */
export async function sendTestMail(client: DbClient, employeeId: string, options: DispatchOptions): Promise<TestMailResult> {
  try {
    const people = await recipients(client, [employeeId]);
    if (!people.get(employeeId)?.email) return 'geen-adres';
    const queued = await enqueue(client, [{ employeeId, kind: 'test', dates: [] }], true, people);
    const counts = await deliver(client, queued, people, options);
    return counts.sent > 0 ? 'verstuurd' : 'mislukt';
  } catch (error) {
    console.error('Testmail mislukt', error instanceof Error ? error.message : error);
    return 'mislukt';
  }
}

export interface MailJobResult {
  retried: DispatchCounts;
  reminders: DispatchCounts;
  /** De datum waarvoor herinneringen zijn klaargezet, of `null` buiten het uur van de herinneringen. */
  reminderDate: string | null;
  cleaned: number;
}

/** Een mail die net is klaargezet, verstuurt de actie zelf; de taak blijft er de eerste minuten af. */
const RETRY_AFTER_MS = 10 * 60 * 1000;
/** Ouder dan dit probeert de taak niet meer. */
const RETRY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * De geplande taak, elk uur, met de secret key (V17): mislukte mails opnieuw proberen, om 16:00
 * de herinneringen voor morgen (V15), en regels ouder dan 90 dagen opruimen.
 */
export async function runMailJob(client: DbClient, options: DispatchOptions): Promise<MailJobResult> {
  const today = todayInAmsterdam(options.now);
  const enabled = await mailEnabled(client);

  // 1. Opnieuw proberen.
  const open = await client
    .from('mail_queue')
    .select(SELECT_QUEUE)
    .in('status', ['pending', 'failed'])
    .lt('created_at', new Date(options.now.getTime() - RETRY_AFTER_MS).toISOString())
    .gt('created_at', new Date(options.now.getTime() - RETRY_WINDOW_MS).toISOString());
  if (open.error) throw new Error(`Wachtrij laden mislukt: ${open.error.message}`);
  const retry = (open.data ?? []).map(toQueuedMail).filter((mail): mail is QueuedMail => mail !== null && shouldRetry(mail, today));
  let retried = { ...NO_MAILS };
  if (retry.length > 0) {
    if (!enabled) {
      await client.from('mail_queue').update({ status: 'skipped', last_error: 'mails uit' }).in('id', retry.map((mail) => mail.id));
      retried = { ...NO_MAILS, disabled: retry.length };
    } else {
      const people = await recipients(client, retry.map((mail) => mail.employeeId));
      retried = await deliver(client, retry, people, options);
    }
  }

  // 2. Herinneringen voor morgen, om 16:00.
  const reminderDate = reminderDateAt(options.now);
  let reminders = { ...NO_MAILS };
  if (reminderDate) {
    const snapshot = await loadPlanningSnapshot(client, { from: reminderDate, to: reminderDate });
    const targets = reminderTargets(snapshot, reminderDate);
    const existing = await client.from('mail_queue').select('employee_id').eq('kind', 'reminder').contains('dates', [reminderDate]);
    if (existing.error) throw new Error(`Herinneringen laden mislukt: ${existing.error.message}`);
    const done = new Set((existing.data ?? []).map((row) => row.employee_id));
    const fresh = targets.filter((target) => !done.has(target.employeeId));
    if (fresh.length > 0) {
      const people = await recipients(client, fresh.map((target) => target.employeeId));
      const queued: QueuedMail[] = [];
      // Eén voor één: loopt de taak toevallig twee keer, dan weigert de database de dubbele.
      for (const target of fresh) {
        try {
          queued.push(...(await enqueue(client, [{ employeeId: target.employeeId, kind: 'reminder', dates: [reminderDate] }], enabled, people)));
        } catch (error) {
          console.error('Herinnering klaarzetten mislukt', error instanceof Error ? error.message : error);
        }
      }
      reminders = addCounts(countSkipped(queued, people), await deliver(client, queued, people, options));
    }
  }

  // 3. Opruimen: de wachtrij is geen planning, dus niet langer bewaren dan nodig.
  const cleaned = await client.from('mail_queue').delete({ count: 'exact' }).lt('created_at', queueCleanupBefore(options.now));
  if (cleaned.error) throw new Error(`Opruimen mislukt: ${cleaned.error.message}`);

  return { retried, reminders, reminderDate, cleaned: cleaned.count ?? 0 };
}
