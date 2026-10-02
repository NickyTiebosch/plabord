/**
 * Vestigingsrooster: per dag wie er werkt, wie is ingeleend en wie afwezig is.
 * Vanaf fase 2 ook een melding als er te weinig mensen aan de balie staan (besluit V12: geen
 * bezetting per dagdeel als het genoeg is), en wie door een roosterwijziging vrij is.
 * In een vestiging staan de mensen per rol bij elkaar, met de balie bovenaan.
 */
import { addDays, eachDay } from '../engine/dates';
import { formatDayShort } from '../engine/format';
import { DAY_PART_LABELS, ROLE_LABELS } from '../engine/labels';
import { computeSchedule, createScheduleContext, groupDay, type ShiftEntry } from '../engine/schedule';
import { compareGroups } from '../engine/sort';
import { createNormLookup, staffingOf } from '../engine/staffing';
import { formatTimeRange } from '../engine/time';
import { ROLES, type DayPart, type IsoDate, type PlanningSnapshot, type Role } from '../engine/types';
import { isRequested, partialAbsenceNote } from './labels';

export interface PersonLine {
  employeeId: string;
  name: string;
  /** De rol van deze dienst. */
  role: Role;
  /** De rol als tekst achter de naam, als het kopje of de groep die nog niet zegt; anders null. */
  roleLabel: string | null;
  times: string;
  note: string | null;
  borrowed: boolean;
  requested: boolean;
  /** De dienst van deze dag komt uit een roosterwijziging. */
  changed: boolean;
}

/** Mensen die werken, bij elkaar per rol. */
export interface WorkingBlock {
  /** De rol van dit blok in een vestiging; null in een ondersteunende groep (daar is het één lijst). */
  role: Role | null;
  /** Kopje, zoals "Balie" of "Hiker/buitendienst"; null zonder kopje. */
  label: string | null;
  people: PersonLine[];
}

export interface GroupSection {
  groupId: string;
  groupName: string;
  closure: string | null;
  /**
   * Wie er werkt. In een vestiging een blok per rol, in de volgorde van de rollen, dus de balie
   * bovenaan. In een ondersteunende groep één blok zonder kopje. Leeg als niemand werkt.
   */
  working: WorkingBlock[];
  absent: PersonLine[];
  elsewhere: PersonLine[];
  /**
   * Alleen als de vestiging in een of meer dagdelen onder de norm zit, bijvoorbeeld
   * "1 te weinig aan de balie (middag)". Anders null: dan is de bezetting in orde.
   */
  shortage: string | null;
  /** Wie hier volgens de vaste dienst zou werken, maar door een roosterwijziging vrij is. */
  daysOff: { employeeId: string; name: string }[];
}

export interface GroupWeekDay {
  date: IsoDate;
  label: string;
  isToday: boolean;
  sections: GroupSection[];
}

function roleNote(entry: ShiftEntry, hasCounter: boolean): string | null {
  if (hasCounter) return entry.role === 'counter' ? null : ROLE_LABELS[entry.role];
  return entry.role === 'none' ? null : ROLE_LABELS[entry.role];
}

function capitalize(text: string): string {
  return text.charAt(0).toLocaleUpperCase('nl') + text.slice(1);
}

function personLine(entry: ShiftEntry, hasCounter: boolean): PersonLine {
  const times = entry.working
    ? formatTimeRange(entry.working.start, entry.working.end)
    : formatTimeRange(entry.start, entry.end);
  const notes = [
    entry.kind === 'substitution' ? 'ingeleend' : partialAbsenceNote(entry.absentParts),
    entry.changed ? 'gewijzigd' : null,
  ].filter((note): note is string => Boolean(note));
  return {
    employeeId: entry.employeeId,
    name: entry.employeeName,
    role: entry.role,
    roleLabel: roleNote(entry, hasCounter),
    times,
    note: notes.length > 0 ? notes.join(' · ') : null,
    borrowed: entry.kind === 'substitution',
    requested: isRequested(entry.absences),
    changed: entry.changed,
  };
}

/** In een vestiging een blok per rol (het kopje noemt de rol); anders één lijst met de rol achter de naam. */
function workingBlocks(entries: readonly ShiftEntry[], hasCounter: boolean): WorkingBlock[] {
  const lines = entries.map((entry) => personLine(entry, hasCounter));
  if (lines.length === 0) return [];
  if (!hasCounter) return [{ role: null, label: null, people: lines }];
  return ROLES.flatMap((role) => {
    const people = lines.filter((line) => line.role === role).map((line) => ({ ...line, roleLabel: null }));
    return people.length > 0 ? [{ role, label: capitalize(ROLE_LABELS[role]), people }] : [];
  });
}

/**
 * Het tekort aan de balie in gewone taal. Het dagdeel staat er alleen bij als niet de hele dag
 * hetzelfde tekort heeft. `null` als elk dagdeel op de norm zit.
 */
export function shortageText(parts: readonly { dayPart: DayPart; norm: number; shortage: number }[]): string | null {
  const counted = parts.filter((part) => part.norm > 0);
  const short = counted.filter((part) => part.shortage > 0);
  const [first] = short;
  if (!first) return null;
  if (short.every((part) => part.shortage === first.shortage)) {
    const which = short.length === counted.length ? '' : ` (${short.map((part) => DAY_PART_LABELS[part.dayPart]).join(' en ')})`;
    return `${first.shortage} te weinig aan de balie${which}`;
  }
  return `Te weinig aan de balie: ${short.map((part) => `${DAY_PART_LABELS[part.dayPart]} ${part.shortage}`).join(', ')}`;
}

/** Een week (ma–za) voor één of meer groepen. */
export function buildGroupWeek(
  snapshot: PlanningSnapshot,
  groupIds: readonly string[],
  monday: IsoDate,
  today: IsoDate,
): GroupWeekDay[] {
  const context = createScheduleContext(snapshot);
  const normOf = createNormLookup(snapshot.staffingNorms);
  const groups = snapshot.groups.filter((group) => groupIds.includes(group.id)).sort(compareGroups);
  const days = computeSchedule(snapshot, monday, addDays(monday, 5));
  return days.map((day) => {
    const daysOff = context.daysOffOn(day.date);
    return {
      date: day.date,
      label: formatDayShort(day.date),
      isToday: day.date === today,
      sections: groups.map((group) => {
        const view = groupDay(context, day, group.id);
        const shortage =
          group.hasCounter && !view.closure
            ? shortageText(staffingOf(context, normOf, day.date, group.id, day.entries).parts)
            : null;
        return {
          groupId: group.id,
          groupName: group.name,
          closure: view.closure ? (view.closure.name ?? 'Gesloten') : null,
          working: workingBlocks(view.working, group.hasCounter),
          absent: view.absent.map((entry) => ({
            ...personLine(entry, group.hasCounter),
            // Het kopje zegt al "Afwezig"; we melden alleen of het nog is aangevraagd.
            note: isRequested(entry.absences) ? 'aangevraagd' : null,
          })),
          elsewhere: view.elsewhere.map((entry) => ({ ...personLine(entry, group.hasCounter), note: 'valt elders in' })),
          shortage,
          daysOff: view.closure
            ? []
            : daysOff
                .filter((item) => item.groupId === group.id)
                .map((item) => ({ employeeId: item.employeeId, name: item.employeeName })),
        };
      }),
    };
  });
}

/** De maandagen rond een week, voor de knoppen vorige/volgende. */
export function weekNavigation(monday: IsoDate): { previous: IsoDate; next: IsoDate; days: IsoDate[] } {
  return { previous: addDays(monday, -7), next: addDays(monday, 7), days: eachDay(monday, addDays(monday, 5)) };
}
