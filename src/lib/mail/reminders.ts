/**
 * Herinneringen de dag ervoor (besluit V15), en wanneer de geplande taak iets opnieuw probeert.
 * Puur: "nu" en alle gegevens komen binnen als parameter.
 */
import { addDays, amsterdamDateTime, weekdayOf } from '../engine/dates';
import { createScheduleContext, dayPartsOfAbsence } from '../engine/schedule';
import { compareNames } from '../engine/sort';
import type { IsoDate, PlanningSnapshot } from '../engine/types';
import type { QueuedMail } from './types';

/** De herinneringen gaan om 16:00 (Europe/Amsterdam) de dag ervoor weg. */
export const REMINDER_HOUR = 16;

/** Zo vaak probeert de app een mail hooguit te versturen. */
export const MAX_ATTEMPTS = 3;

/** Regels in de wachtrij ouder dan dit ruimt de geplande taak op. */
export const QUEUE_RETENTION_DAYS = 90;

/**
 * Is het nu het uur van de herinneringen (16:00–16:59 in Amsterdam, ook rond de wisseling van
 * zomer- en wintertijd)? Dan de datum van morgen. Op zaterdag niet: op zondag zijn er geen diensten.
 */
export function reminderDateAt(now: Date): IsoDate | null {
  const { date, time } = amsterdamDateTime(now);
  if (Number(time.slice(0, 2)) !== REMINDER_HOUR) return null;
  const tomorrow = addDays(date, 1);
  return weekdayOf(tomorrow) === 7 ? null : tomorrow;
}

export interface ReminderTarget {
  employeeId: string;
  name: string;
}

/**
 * Wie op `date` afwijkt van het vaste rooster, en dus de dag ervoor een herinnering krijgt:
 * - valt die dag ergens in;
 * - heeft door een roosterwijziging een andere dienst;
 * - heeft door een roosterwijziging geen dienst.
 * Niet bij afwezigheid de hele dag, en niet als de groep van die dienst dicht is.
 * Alleen actieve medewerkers; op naam gesorteerd.
 */
export function reminderTargets(snapshot: PlanningSnapshot, date: IsoDate): ReminderTarget[] {
  const context = createScheduleContext(snapshot);
  const entries = context.entriesOn(date);
  // Door een roosterwijziging vrij, terwijl de groep van de vaste dienst die dag open is.
  const daysOff = new Set(
    context
      .daysOffOn(date)
      .filter((item) => !context.closure(date, item.groupId).closed)
      .map((item) => item.employeeId),
  );
  const targets: ReminderTarget[] = [];
  for (const employee of context.employeesById.values()) {
    const absentParts = new Set(
      context.absencesOn(employee.id, date).flatMap((absence) => dayPartsOfAbsence(absence.dayPart)),
    );
    if (absentParts.size === 2) continue;
    const own = entries.filter((entry) => entry.employeeId === employee.id && !entry.closure);
    if (own.some((entry) => entry.kind === 'substitution' || entry.changed) || daysOff.has(employee.id)) {
      targets.push({ employeeId: employee.id, name: employee.name });
    }
  }
  return targets.sort(
    (a, b) => compareNames(a.name, b.name) || (a.employeeId < b.employeeId ? -1 : a.employeeId > b.employeeId ? 1 : 0),
  );
}

/**
 * Probeert de geplande taak deze mail (nog eens) te versturen? Alleen als hij nog niet is
 * verstuurd, minder dan MAX_ATTEMPTS keer is geprobeerd, en nog over vandaag of later gaat.
 * Een testmail niet: die stuur je gewoon opnieuw.
 */
export function shouldRetry(mail: Pick<QueuedMail, 'kind' | 'status' | 'attempts' | 'dates'>, today: IsoDate): boolean {
  if (mail.kind === 'test') return false;
  if (mail.status !== 'pending' && mail.status !== 'failed') return false;
  if (mail.attempts >= MAX_ATTEMPTS) return false;
  return mail.dates.some((date) => date >= today);
}

/** Het tijdstip waarvoor regels in de wachtrij weg mogen (90 dagen geleden). */
export function queueCleanupBefore(now: Date): string {
  return new Date(now.getTime() - QUEUE_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
}
