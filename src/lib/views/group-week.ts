/**
 * Vestigingsrooster: per dag wie er werkt, wie is ingeleend en wie afwezig is.
 * Vanaf fase 2 ook de bezetting per dagdeel tegen de norm, en wie door een roosterwijziging vrij is.
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

/** Bezetting van één dagdeel tegen de norm, bijvoorbeeld "ochtend 1/2". */
export interface StaffingPill {
  dayPart: DayPart;
  label: string;
  count: number;
  norm: number;
  short: boolean;
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
  /** Alleen bij een vestiging op een open dag met een norm. */
  staffing: StaffingPill[];
  /** Een of meer dagdelen onder de norm. */
  short: boolean;
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
        const staffing =
          group.hasCounter && !view.closure
            ? staffingOf(context, normOf, day.date, group.id, day.entries)
                .parts.filter((part) => part.norm > 0)
                .map((part) => ({
                  dayPart: part.dayPart,
                  label: `${DAY_PART_LABELS[part.dayPart]} ${part.count}/${part.norm}`,
                  count: part.count,
                  norm: part.norm,
                  short: part.shortage > 0,
                }))
            : [];
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
          staffing,
          short: staffing.some((pill) => pill.short),
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
