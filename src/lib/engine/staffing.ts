/**
 * Bezetting aan de balie per vestiging, dag en dagdeel, tegen de norm (fase 2).
 * Alleen wie die dag "telt mee aan de balie" telt: rol balie, in een vestiging, in dat dagdeel aan het werk.
 * Een inval telt mee bij de vestiging waar iemand invalt, en niet bij de eigen groep.
 */
import { weekdayOf } from './dates';
import type { ScheduleContext, ShiftEntry } from './schedule';
import { compareGroups } from './sort';
import { DAY_PARTS, type DayPart, type Group, type IsoDate, type StaffingNorm } from './types';

export interface PartStaffing {
  dayPart: DayPart;
  /** Aantal mensen aan de balie. */
  count: number;
  norm: number;
  /** Hoeveel er te weinig zijn: norm − aantal, minimaal 0. */
  shortage: number;
}

export interface GroupStaffing {
  date: IsoDate;
  groupId: string;
  /** Gesloten: dan is er geen norm en geen tekort. */
  closed: boolean;
  parts: PartStaffing[];
}

/** De norm voor een vestiging op een datum in een dagdeel. Geen norm = 0. */
export type NormLookup = (groupId: string, date: IsoDate, dayPart: DayPart) => number;

export function createNormLookup(norms: readonly StaffingNorm[]): NormLookup {
  const byKey = new Map(norms.map((norm) => [`${norm.groupId}|${norm.weekday}|${norm.dayPart}`, norm.minStaff]));
  return (groupId, date, dayPart) => byKey.get(`${groupId}|${weekdayOf(date)}|${dayPart}`) ?? 0;
}

/** De vestigingen met een balie, in de vaste volgorde. */
export function counterLocations(context: ScheduleContext): Group[] {
  return [...context.groupsById.values()].filter((group) => group.hasCounter).sort(compareGroups);
}

/** Wie in dit dagdeel aan de balie van deze vestiging telt. Iedereen hooguit één keer. */
export function countersAt(entries: readonly ShiftEntry[], groupId: string, dayPart: DayPart): string[] {
  const ids = new Set<string>();
  for (const entry of entries) {
    if (entry.groupId === groupId && entry.countsForCounter && entry.workingParts.includes(dayPart)) ids.add(entry.employeeId);
  }
  return [...ids];
}

/** De bezetting van één vestiging op één dag. Geef `entries` mee als je ze al hebt. */
export function staffingOf(
  context: ScheduleContext,
  normOf: NormLookup,
  date: IsoDate,
  groupId: string,
  entries: readonly ShiftEntry[] = context.entriesOn(date),
): GroupStaffing {
  const closed = context.closure(date, groupId).closed;
  const parts = DAY_PARTS.map((dayPart) => {
    if (closed) return { dayPart, count: 0, norm: 0, shortage: 0 };
    const count = countersAt(entries, groupId, dayPart).length;
    const norm = normOf(groupId, date, dayPart);
    return { dayPart, count, norm, shortage: Math.max(0, norm - count) };
  });
  return { date, groupId, closed, parts };
}
