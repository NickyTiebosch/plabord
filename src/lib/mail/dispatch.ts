import 'server-only';
import { loadPlanningSnapshot, type DbClient } from '../db/queries';
import { todayInAmsterdam } from '../engine/dates';
import type { PlanningSnapshot } from '../engine/types';
import { ConfigError } from '../env';
import { composePush } from '../push/messages';
import { webPushSender, type PushSender } from '../push/send';
import { composeMail, personalDaysFor } from './messages';
import { mergeNotices } from './notices';
import { NO_MAILS, type DispatchCounts } from './outcome';
import { queueCleanupBefore, reminderDateAt, reminderTargets, shouldRetry } from './reminders';
import { smtpTransport, type MailTransport } from './send';
import { mailErrorCode, serverUnavailable } from './smtp-errors';
import { alwaysSent, MAIL_KINDS, MAIL_STATUSES, type MailKind, type MailNotice, type QueuedMail } from './types';

/**
 * De wachtrij en het versturen (fase 3), en sinds fase 4 de push naast de mail (V24). Twee ingangen:
 * - `sendNotices`: directe mails na een actie van een beheerder, met diens sessie (V14, V17);
 * - `runMailJob`: de geplande taak, met de secret key: opnieuw proberen, herinneringen (V15) en opruimen.
 * In de wachtrij staan geen adressen en geen tekst; de tekst ontstaat hier, bij het versturen.
 * Een mail of push die niet lukt, laat de actie nooit mislukken. Een push gaat alleen mee met een
 * nieuwe mail, niet met een nieuwe poging: een late push heeft weinig zin.
 */

export interface DispatchOptions {
  now: Date;
  /** Link naar Mijn rooster in de mail, of `null`. */
  appUrl: string | null;
  /** Standaard SMTP met de instellingen uit de omgeving; tests geven een eigen transport. */
  transport?: () => MailTransport;
  /** Standaard web push met de sleutels uit de omgeving (of geen push zonder sleutels). */
  push?: () => PushSender | null;
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

/**
 * Zet mails in de wachtrij: `pending`, of meteen `skipped` als mails uit staan of er geen werkmail
 * is. De testmail en de uitnodiging gaan ook als mails uit staan (V18, V33).
 */
async function enqueue(
  client: DbClient,
  mails: readonly NewMail[],
  enabled: boolean,
  people: ReadonlyMap<string, Recipient>,
): Promise<QueuedMail[]> {
  const rows = mails.map((mail) => {
    const off = !enabled && !alwaysSent(mail.kind);
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
const isOpen = (mail: QueuedMail) => mail.status === 'pending' || mail.status === 'failed';

/** Het rooster rond de dagen van deze mails, of `null` als er geen dagen zijn (een test). */
async function snapshotFor(client: DbClient, mails: readonly QueuedMail[]): Promise<PlanningSnapshot | null> {
  const dates = mails.flatMap((mail) => mail.dates).sort();
  const first = dates[0];
  const last = dates.at(-1);
  return first && last ? loadPlanningSnapshot(client, { from: first, to: last }) : null;
}

async function deliver(
  client: DbClient,
  mails: readonly QueuedMail[],
  people: ReadonlyMap<string, Recipient>,
  options: DispatchOptions,
  preloaded?: PlanningSnapshot | null,
): Promise<DispatchCounts> {
  const open = mails.filter(isOpen);
  if (open.length === 0) return NO_MAILS;
  const snapshot = preloaded === undefined ? await snapshotFor(client, open) : preloaded;

  let transport: MailTransport | null = null;
  let setupError = 'mailserver niet ingesteld';
  try {
    transport = (options.transport ?? smtpTransport)();
  } catch (error) {
    if (!(error instanceof ConfigError)) setupError = 'mailserver onbereikbaar';
    console.error('Mailserver niet beschikbaar', error instanceof Error ? error.message : error);
  }

  const counts = { ...NO_MAILS };
  // Wordt `false` als de mailserver onbereikbaar blijkt: dan de rest deze keer niet meer proberen.
  let usable = true;
  try {
    for (const mail of open) {
      const person = people.get(mail.employeeId);
      const attempts = mail.attempts + 1;
      if (!person?.email) {
        await client.from('mail_queue').update({ status: 'skipped', attempts, last_error: 'geen werkmail' }).eq('id', mail.id);
        counts.noAddress++;
        continue;
      }
      if (!transport || !usable) {
        await client.from('mail_queue').update({ status: 'failed', attempts, last_error: setupError }).eq('id', mail.id);
        counts.failed++;
        continue;
      }
      const content = composeMail({
        kind: mail.kind,
        name: person.name,
        days: snapshot && !alwaysSent(mail.kind) ? personalDaysFor(snapshot, mail.employeeId, mail.dates) : [],
        groups: snapshot?.groups ?? [],
        appUrl: options.appUrl,
      });
      try {
        await transport.send({ to: person.email, ...content });
      } catch (error) {
        // Nooit het adres loggen: alleen de soort mail en de foutcode.
        console.error('Mail versturen mislukt', mail.kind, mailErrorCode(error));
        if (serverUnavailable(error)) {
          // Elke volgende poging kost tot tien seconden; de geplande taak probeert het later opnieuw.
          usable = false;
          setupError = 'mailserver onbereikbaar';
        }
        await client
          .from('mail_queue')
          .update({ status: 'failed', attempts, last_error: usable ? 'versturen mislukt' : setupError })
          .eq('id', mail.id);
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

type DeviceRow = { id: string; employee_id: string; endpoint: string; p256dh: string; auth: string };

/** Stuurt één melding naar de toestellen; ruimt verdwenen abonnementen op. Geeft het aantal geslaagde. */
async function pushToDevices(
  client: DbClient,
  send: PushSender,
  devices: readonly DeviceRow[],
  content: Parameters<PushSender>[1],
  now: Date,
): Promise<number> {
  const outcomes = await Promise.all(devices.map((device) => send(device, content)));
  const sent = devices.filter((_, index) => outcomes[index] === 'sent').map((device) => device.id);
  const gone = devices.filter((_, index) => outcomes[index] === 'gone').map((device) => device.id);
  if (sent.length > 0) await client.from('push_subscriptions').update({ last_success_at: now.toISOString() }).in('id', sent);
  if (gone.length > 0) await client.from('push_subscriptions').delete().in('id', gone);
  return sent.length;
}

/**
 * De push naast de mail (fase 4, V24): voor elke mail die net is klaargezet (dus niet als mails uit
 * staan), naar alle toestellen van die persoon met meldingen aan. Alleen actieve medewerkers.
 * Houdt per mail bij naar hoeveel toestellen de push ging. Mislukt er iets, dan alleen loggen.
 */
async function pushQueued(
  client: DbClient,
  mails: readonly QueuedMail[],
  people: ReadonlyMap<string, Recipient>,
  snapshot: PlanningSnapshot | null,
  options: DispatchOptions,
): Promise<void> {
  const targets = mails.filter((mail) => mail.status === 'pending' && !alwaysSent(mail.kind) && people.get(mail.employeeId)?.email);
  if (targets.length === 0) return;
  const send = (options.push ?? webPushSender)();
  if (!send) return;
  try {
    const devices = await client
      .from('push_subscriptions')
      .select('id, employee_id, endpoint, p256dh, auth')
      .in('employee_id', [...new Set(targets.map((mail) => mail.employeeId))]);
    if (devices.error) throw new Error(`Toestellen laden mislukt: ${devices.error.message}`);
    for (const mail of targets) {
      const own = (devices.data ?? []).filter((device) => device.employee_id === mail.employeeId);
      if (own.length === 0) continue;
      const content = composePush({
        kind: mail.kind,
        days: snapshot ? personalDaysFor(snapshot, mail.employeeId, mail.dates) : [],
        groups: snapshot?.groups ?? [],
      });
      const sent = await pushToDevices(client, send, own, content, options.now);
      if (sent > 0) await client.from('mail_queue').update({ push_devices: sent }).eq('id', mail.id);
    }
  } catch (error) {
    console.error('Push naast de mail mislukt', error instanceof Error ? error.message : error);
  }
}

/**
 * Directe mails na een actie van een beheerder (V14): per persoon hooguit één, niet over het
 * verleden. Gebruikt de sessie van de beheerder. Mislukt er iets, dan blijft de actie gewoon gelukt.
 * Sinds fase 4 gaat de push mee (V24).
 */
export async function sendNotices(client: DbClient, notices: readonly MailNotice[], options: DispatchOptions): Promise<DispatchCounts> {
  const merged = mergeNotices(notices, todayInAmsterdam(options.now));
  if (merged.length === 0) return NO_MAILS;
  try {
    const [enabled, people] = await Promise.all([mailEnabled(client), recipients(client, merged.map((mail) => mail.employeeId))]);
    const queued = await enqueue(client, merged, enabled, people);
    const snapshot = await snapshotFor(client, queued.filter(isOpen));
    const counts = addCounts(countSkipped(queued, people), await deliver(client, queued, people, options, snapshot));
    await pushQueued(client, queued, people, snapshot, options);
    return counts;
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

/**
 * De uitnodiging (V33): per persoon één mail met een link naar de app en de uitleg, met de sessie
 * van de beheerder. Gaat ook als meldingen uit staan, en zonder push. Eerst staan alle mails in de
 * wachtrij, dan gaan ze één voor één: wat niet meer lukt, verstuurt de geplande taak later.
 */
export async function sendInvites(client: DbClient, employeeIds: readonly string[], options: DispatchOptions): Promise<DispatchCounts> {
  const ids = [...new Set(employeeIds)];
  if (ids.length === 0) return NO_MAILS;
  try {
    const people = await recipients(client, ids);
    const queued = await enqueue(client, ids.map((employeeId) => ({ employeeId, kind: 'invite' as const, dates: [] })), true, people);
    return addCounts(countSkipped(queued, people), await deliver(client, queued, people, options, null));
  } catch (error) {
    console.error('Uitnodigingen versturen mislukt', error instanceof Error ? error.message : error);
    return { ...NO_MAILS, failed: ids.length };
  }
}

export type TestPushResult =
  | { status: 'verstuurd'; devices: number; sent: number }
  | { status: 'geen-toestel' | 'mislukt' | 'niet-ingesteld' };

/** De testmelding van een beheerder aan de eigen toestellen (V27). Gaat altijd, ook als meldingen uit staan. */
export async function sendTestPush(client: DbClient, employeeId: string, options: DispatchOptions): Promise<TestPushResult> {
  const send = (options.push ?? webPushSender)();
  if (!send) return { status: 'niet-ingesteld' };
  try {
    const devices = await client
      .from('push_subscriptions')
      .select('id, employee_id, endpoint, p256dh, auth')
      .eq('employee_id', employeeId);
    if (devices.error) throw new Error(`Toestellen laden mislukt: ${devices.error.message}`);
    const own = devices.data ?? [];
    if (own.length === 0) return { status: 'geen-toestel' };
    const sent = await pushToDevices(client, send, own, composePush({ kind: 'test', days: [], groups: [] }), options.now);
    return sent > 0 ? { status: 'verstuurd', devices: own.length, sent } : { status: 'mislukt' };
  } catch (error) {
    console.error('Testmelding mislukt', error instanceof Error ? error.message : error);
    return { status: 'mislukt' };
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
 * De geplande taak, elk uur, met de secret key (V17): om 16:00 de herinneringen voor morgen (V15),
 * mislukte mails opnieuw proberen, en regels ouder dan 90 dagen opruimen.
 */
export async function runMailJob(client: DbClient, options: DispatchOptions): Promise<MailJobResult> {
  const today = todayInAmsterdam(options.now);
  const enabled = await mailEnabled(client);

  // 1. Wat opnieuw moet: eerst ophalen, zodat de herinneringen van zo meteen er niet tussen zitten.
  const open = await client
    .from('mail_queue')
    .select(SELECT_QUEUE)
    .in('status', ['pending', 'failed'])
    .lt('created_at', new Date(options.now.getTime() - RETRY_AFTER_MS).toISOString())
    .gt('created_at', new Date(options.now.getTime() - RETRY_WINDOW_MS).toISOString());
  if (open.error) throw new Error(`Wachtrij laden mislukt: ${open.error.message}`);
  const retry = (open.data ?? []).map(toQueuedMail).filter((mail): mail is QueuedMail => mail !== null && shouldRetry(mail, today));

  // 2. Herinneringen voor morgen, om 16:00. Vóór het opnieuw proberen: ze kunnen maar in dit ene
  // uur worden klaargezet. Wat daarna niet verstuurd raakt, probeert de taak een uur later opnieuw.
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
      const snapshot = await snapshotFor(client, queued.filter(isOpen));
      reminders = addCounts(countSkipped(queued, people), await deliver(client, queued, people, options, snapshot));
      await pushQueued(client, queued, people, snapshot, options);
    }
  }

  // 3. Opnieuw proberen. Staan mails uit, dan alleen de uitnodigingen (V33); de rest vervalt.
  let retried = { ...NO_MAILS };
  if (retry.length > 0) {
    const stopped = enabled ? [] : retry.filter((mail) => !alwaysSent(mail.kind));
    const again = enabled ? retry : retry.filter((mail) => alwaysSent(mail.kind));
    if (stopped.length > 0) {
      await client.from('mail_queue').update({ status: 'skipped', last_error: 'mails uit' }).in('id', stopped.map((mail) => mail.id));
    }
    if (again.length > 0) {
      const people = await recipients(client, again.map((mail) => mail.employeeId));
      retried = await deliver(client, again, people, options);
    }
    retried = { ...retried, disabled: retried.disabled + stopped.length };
  }

  // 4. Opruimen: de wachtrij is geen planning, dus niet langer bewaren dan nodig.
  const cleaned = await client.from('mail_queue').delete({ count: 'exact' }).lt('created_at', queueCleanupBefore(options.now));
  if (cleaned.error) throw new Error(`Opruimen mislukt: ${cleaned.error.message}`);

  return { retried, reminders, reminderDate, cleaned: cleaned.count ?? 0 };
}
