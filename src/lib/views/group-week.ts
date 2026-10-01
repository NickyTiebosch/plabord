/**
 * Vestigingsrooster: per dag wie er werkt, wie is ingeleend en wie afwezig is.
 */
import { addDays, eachDay } from '../engine/dates';
import { formatDayShort } from '../engine/format';
import { ROLE_LABELS } from '../engine/labels';
import { computeSchedule, createScheduleContext, groupDay, type ShiftEntry } from '../engine/schedule';
import { compareGroups } from '../engine/sort';
import { formatTimeRange } from '../engine/time';
import type { IsoDate, PlanningSnapshot } from '../engine/types';
import { isRequested, partialAbsenceNote } from './labels';

export interface PersonLine {
  employeeId: string;
  name: string;
  /** Rol als die afwijkt van wat je in deze groep verwacht, anders null. */
  role: string | null;
  times: string;
  note: string | null;
  borrowed: boolean;
  requested: boolean;
}

export interface GroupSection {
  groupId: string;
  groupName: string;
  closure: string | null;
  working: PersonLine[];
  absent: PersonLine[];
  elsewhere: PersonLine[];
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

function personLine(entry: ShiftEntry, hasCounter: boolean): PersonLine {
  const times = entry.working
    ? formatTimeRange(entry.working.start, entry.working.end)
    : formatTimeRange(entry.start, entry.end);
  return {
    employeeId: entry.employeeId,
    name: entry.employeeName,
    role: roleNote(entry, hasCounter),
    times,
    note: entry.kind === 'substitution' ? 'ingeleend' : partialAbsenceNote(entry.absentParts),
    borrowed: entry.kind === 'substitution',
    requested: isRequested(entry.absences),
  };
}

/** Een week (ma–za) voor één of meer groepen. */
export function buildGroupWeek(
  snapshot: PlanningSnapshot,
  groupIds: readonly string[],
  monday: IsoDate,
  today: IsoDate,
): GroupWeekDay[] {
  const context = createScheduleContext(snapshot);
  const groups = snapshot.groups.filter((group) => groupIds.includes(group.id)).sort(compareGroups);
  const days = computeSchedule(snapshot, monday, addDays(monday, 5));
  return days.map((day) => ({
    date: day.date,
    label: formatDayShort(day.date),
    isToday: day.date === today,
    sections: groups.map((group) => {
      const view = groupDay(context, day, group.id);
      return {
        groupId: group.id,
        groupName: group.name,
        closure: view.closure ? (view.closure.name ?? 'Gesloten') : null,
        working: view.working.map((entry) => personLine(entry, group.hasCounter)),
        absent: view.absent.map((entry) => ({
          ...personLine(entry, group.hasCounter),
          // Het kopje zegt al "Afwezig"; we melden alleen of het nog is aangevraagd.
          note: isRequested(entry.absences) ? 'aangevraagd' : null,
        })),
        elsewhere: view.elsewhere.map((entry) => ({ ...personLine(entry, group.hasCounter), note: 'valt elders in' })),
      };
    }),
  }));
}

/** De maandagen rond een week, voor de knoppen vorige/volgende. */
export function weekNavigation(monday: IsoDate): { previous: IsoDate; next: IsoDate; days: IsoDate[] } {
  return { previous: addDays(monday, -7), next: addDays(monday, 7), days: eachDay(monday, addDays(monday, 5)) };
}
