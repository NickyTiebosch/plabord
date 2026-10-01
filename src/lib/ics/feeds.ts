/**
 * De drie agendafeeds: persoonlijk, per vestiging en team-verlof.
 * Minimale inhoud en nooit e-mailadressen.
 */
import { addDays, eachDay, weekdayOf } from '../engine/dates';
import { ABSENCE_PART_LABELS, ROLE_LABELS } from '../engine/labels';
import { createScheduleContext } from '../engine/schedule';
import { formatTimeRange } from '../engine/time';
import type { Absence, IsoDate, PlanningSnapshot } from '../engine/types';
import { buildCalendar, type CalendarEvent } from './ical';

export type FeedKind = 'personal' | 'location' | 'absences';

export interface FeedRequest {
  kind: FeedKind;
  /** Eigenaar van de link; bij de persoonlijke feed ook de medewerker om wie het gaat. */
  employeeId: string;
  /** Alleen bij een vestigingsfeed. */
  groupId: string | null;
}

/** Stempel voor gegevens zonder eigen wijzigingsdatum, zoals berekende feestdagen. */
const FIXED_STAMP = '2026-01-01T00:00:00.000Z';

/** Bereik van een feed: 30 dagen terug tot 26 weken vooruit. */
export function feedRange(today: IsoDate): { from: IsoDate; to: IsoDate } {
  return { from: addDays(today, -30), to: addDays(today, 26 * 7) };
}

function absenceSuffix(absence: Pick<Absence, 'dayPart' | 'status'>): string {
  const notes: string[] = [];
  if (absence.dayPart !== 'full_day') notes.push(ABSENCE_PART_LABELS[absence.dayPart]);
  if (absence.status === 'requested') notes.push('aangevraagd');
  return notes.length > 0 ? ` (${notes.join(', ')})` : '';
}

function overlapsRange(absence: Absence, from: IsoDate, to: IsoDate): boolean {
  return absence.startDate <= to && absence.endDate >= from;
}

/** Eigen diensten, invallen en afwezigheid. */
export function personalFeedEvents(
  snapshot: PlanningSnapshot,
  employeeId: string,
  from: IsoDate,
  to: IsoDate,
): CalendarEvent[] {
  const context = createScheduleContext(snapshot);
  const events: CalendarEvent[] = [];
  for (const date of eachDay(from, to)) {
    for (const entry of context.entriesOn(date)) {
      if (entry.employeeId !== employeeId || !entry.working) continue;
      const groupName = context.groupsById.get(entry.groupId)?.name ?? entry.groupId;
      const times = formatTimeRange(entry.working.start, entry.working.end);
      const regular = entry.kind === 'regular';
      events.push({
        kind: 'timed',
        uid: regular ? `dienst-${employeeId}-${date}@planbord` : `inval-${entry.sourceId}@planbord`,
        stamp: entry.updatedAt,
        date,
        start: entry.working.start,
        end: entry.working.end,
        summary: regular ? `Dienst ${groupName} ${times}` : `Invallen ${groupName} ${times}`,
      });
    }
  }
  for (const absence of snapshot.absences) {
    if (absence.employeeId !== employeeId || !overlapsRange(absence, from, to)) continue;
    events.push({
      kind: 'all_day',
      uid: `afwezig-${absence.id}@planbord`,
      stamp: absence.updatedAt,
      startDate: absence.startDate,
      endDate: absence.endDate,
      summary: `Afwezig${absenceSuffix(absence)}`,
    });
  }
  return events;
}

/** Wie werkt wanneer in een vestiging, plus de dagen dat die gesloten is. */
export function locationFeedEvents(
  snapshot: PlanningSnapshot,
  groupId: string,
  from: IsoDate,
  to: IsoDate,
): CalendarEvent[] {
  const context = createScheduleContext(snapshot);
  const events: CalendarEvent[] = [];
  for (const date of eachDay(from, to)) {
    const closure = context.closure(date, groupId);
    if (closure.closed) {
      if (weekdayOf(date) !== 7) {
        events.push({
          kind: 'all_day',
          uid: `gesloten-${groupId}-${date}@planbord`,
          stamp: FIXED_STAMP,
          startDate: date,
          endDate: date,
          summary: `Gesloten: ${closure.name ?? 'sluitingsdag'}`,
        });
      }
      continue;
    }
    for (const entry of context.entriesOn(date)) {
      if (entry.groupId !== groupId || !entry.working) continue;
      const regular = entry.kind === 'regular';
      events.push({
        kind: 'timed',
        uid: `${groupId}-${regular ? 'dienst' : 'inval'}-${entry.employeeId}-${date}@planbord`,
        stamp: entry.updatedAt,
        date,
        start: entry.working.start,
        end: entry.working.end,
        summary: regular ? `${entry.employeeName} (${ROLE_LABELS[entry.role]})` : `${entry.employeeName} (invaller)`,
      });
    }
  }
  return events;
}

/** Wie is afwezig: iedereen, aangevraagd en goedgekeurd. */
export function absenceFeedEvents(snapshot: PlanningSnapshot, from: IsoDate, to: IsoDate): CalendarEvent[] {
  const names = new Map(
    snapshot.employees.filter((employee) => employee.isActive).map((employee) => [employee.id, employee.name]),
  );
  const events: CalendarEvent[] = [];
  for (const absence of snapshot.absences) {
    const name = names.get(absence.employeeId);
    if (!name || !overlapsRange(absence, from, to)) continue;
    events.push({
      kind: 'all_day',
      uid: `team-afwezig-${absence.id}@planbord`,
      stamp: absence.updatedAt,
      startDate: absence.startDate,
      endDate: absence.endDate,
      summary: `Afwezig: ${name}${absenceSuffix(absence)}`,
    });
  }
  return events;
}

export function feedCalendarName(kind: FeedKind, groupName: string | null): string {
  if (kind === 'personal') return 'Planbord – Mijn rooster';
  if (kind === 'location') return `Planbord – ${groupName ?? 'Vestiging'}`;
  return 'Planbord – Verlof team';
}

/** De complete ICS-tekst voor een feed, voor de periode rond `today`. */
export function buildFeed(snapshot: PlanningSnapshot, request: FeedRequest, today: IsoDate): string {
  const { from, to } = feedRange(today);
  const groupName = request.groupId
    ? (snapshot.groups.find((group) => group.id === request.groupId)?.name ?? null)
    : null;
  let events: CalendarEvent[];
  if (request.kind === 'personal') events = personalFeedEvents(snapshot, request.employeeId, from, to);
  else if (request.kind === 'location' && request.groupId) events = locationFeedEvents(snapshot, request.groupId, from, to);
  else events = absenceFeedEvents(snapshot, from, to);
  return buildCalendar({ name: feedCalendarName(request.kind, groupName), events });
}
