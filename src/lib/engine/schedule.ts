import { createClosureResolver, type ClosureInfo } from './closures';
import { eachDay, isWithin, weekdayOf } from './dates';
import { compareNames } from './sort';
import { fromMinutes, toMinutes } from './time';
import type {
  AbsencePart,
  AbsenceStatus,
  DayPart,
  Employee,
  Group,
  IsoDate,
  PlanningSnapshot,
  RecurringShift,
  Role,
  Settings,
  ShiftTimes,
  TimeOfDay,
  Weekday,
} from './types';

export interface AbsenceMark {
  absenceId: string;
  dayPart: AbsencePart;
  status: AbsenceStatus;
  updatedAt: string;
}

/** `regular` komt uit een vaste dienst, `substitution` is een inval (fase 2). */
export type EntryKind = 'regular' | 'substitution';

export interface ShiftEntry {
  date: IsoDate;
  employeeId: string;
  employeeName: string;
  /** Groep waar deze dienst is. Bij een inval: de vestiging waar iemand invalt. */
  groupId: string;
  role: Role;
  kind: EntryKind;
  /** Id van de vaste dienst of van de inval. */
  sourceId: string;
  /** Geplande tijden, nog niet ingekort. */
  start: TimeOfDay;
  end: TimeOfDay;
  /** Dagdelen die de dienst overlapt. */
  dayParts: DayPart[];
  /** Dagdelen van deze dienst waarin iemand afwezig is. */
  absentParts: DayPart[];
  /** De afwezigheden die deze dag raken (aangevraagd of goedgekeurd). */
  absences: AbsenceMark[];
  /** Dagdelen waarin iemand elders invalt (fase 2). */
  lentOutParts: DayPart[];
  /** Dagdelen waarin iemand hier echt werkt. */
  workingParts: DayPart[];
  /** Werktijden na inkorten voor afwezigheid of inval; `null` als iemand hier niet werkt. */
  working: ShiftTimes | null;
  /** Gesloten (feestdag of sluitingsdag): dan werkt hier niemand. */
  closure: ClosureInfo | null;
  /** Telt mee voor de bezetting van de balie: rol balie, in een vestiging, dagdelen in `workingParts`. */
  countsForCounter: boolean;
  /** Laatste wijziging van de onderliggende gegevens (ISO-timestamp, UTC). */
  updatedAt: string;
}

export interface ScheduleDay {
  date: IsoDate;
  entries: ShiftEntry[];
}

const DAY_PART_ORDER: readonly DayPart[] = ['morning', 'afternoon'];

function sortParts(parts: Iterable<DayPart>): DayPart[] {
  const set = new Set(parts);
  return DAY_PART_ORDER.filter((part) => set.has(part));
}

function intersectParts(a: readonly DayPart[], b: readonly DayPart[]): DayPart[] {
  return sortParts(a.filter((part) => b.includes(part)));
}

function subtractParts(a: readonly DayPart[], b: readonly DayPart[]): DayPart[] {
  return sortParts(a.filter((part) => !b.includes(part)));
}

export function dayPartsOfAbsence(part: AbsencePart): DayPart[] {
  return part === 'full_day' ? ['morning', 'afternoon'] : [part];
}

/** Standaardtijden voor een weekdag: zaterdag heeft een eigen instelling. */
export function standardShiftFor(settings: Settings, weekday: Weekday): ShiftTimes {
  return weekday === 6 ? settings.saturdayShift : settings.standardShift;
}

/** De tijden van een vaste dienst. Een leeg begin of eind valt alleen voor dat veld terug op de standaard. */
export function effectiveShiftTimes(
  shift: Pick<RecurringShift, 'startTime' | 'endTime' | 'weekday'>,
  settings: Settings,
): ShiftTimes {
  const standard = standardShiftFor(settings, shift.weekday);
  return { start: shift.startTime ?? standard.start, end: shift.endTime ?? standard.end };
}

/** Welke dagdelen overlapt een tijdvak? Ochtend is vóór de grens, middag vanaf de grens. */
export function overlappedDayParts(times: ShiftTimes, boundary: TimeOfDay): DayPart[] {
  const start = toMinutes(times.start);
  const end = toMinutes(times.end);
  const border = toMinutes(boundary);
  if (end <= start) return [];
  const parts: DayPart[] = [];
  if (start < border) parts.push('morning');
  if (end > border) parts.push('afternoon');
  return parts;
}

/** Een tijdvak ingekort tot de gegeven dagdelen; `null` als er niets overblijft. */
export function clipToDayParts(times: ShiftTimes, parts: readonly DayPart[], boundary: TimeOfDay): ShiftTimes | null {
  const hasMorning = parts.includes('morning');
  const hasAfternoon = parts.includes('afternoon');
  if (!hasMorning && !hasAfternoon) return null;
  const start = toMinutes(times.start);
  const end = toMinutes(times.end);
  const border = toMinutes(boundary);
  const clippedStart = hasMorning ? start : Math.max(start, border);
  const clippedEnd = hasAfternoon ? end : Math.min(end, border);
  if (clippedEnd <= clippedStart) return null;
  return { start: fromMinutes(clippedStart), end: fromMinutes(clippedEnd) };
}

/** De vaste dienst die op een datum geldt, of `null`. */
export function findRecurringShift(shifts: readonly RecurringShift[], date: IsoDate): RecurringShift | null {
  const weekday = weekdayOf(date);
  let found: RecurringShift | null = null;
  for (const shift of shifts) {
    if (shift.weekday !== weekday || !isWithin(date, shift.validFrom, shift.validTo)) continue;
    // De database voorkomt overlap. Mocht het toch gebeuren, dan wint vast de nieuwste.
    if (
      !found ||
      shift.validFrom > found.validFrom ||
      (shift.validFrom === found.validFrom && shift.id > found.id)
    ) {
      found = shift;
    }
  }
  return found;
}

/** Het laatste van een reeks tijdstempels, als ISO-string in UTC. */
export function latestTimestamp(values: readonly string[]): string {
  let latest = 0;
  for (const value of values) {
    const ms = Date.parse(value);
    if (Number.isFinite(ms) && ms > latest) latest = ms;
  }
  return new Date(latest).toISOString();
}

function groupBy<T>(items: readonly T[], key: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    const list = map.get(k);
    if (list) list.push(item);
    else map.set(k, [item]);
  }
  return map;
}

export interface ScheduleContext {
  readonly settings: Settings;
  readonly groupsById: ReadonlyMap<string, Group>;
  /** Alleen actieve medewerkers. */
  readonly employeesById: ReadonlyMap<string, Employee>;
  entriesOn(date: IsoDate): ShiftEntry[];
  absencesOn(employeeId: string, date: IsoDate): AbsenceMark[];
  closure(date: IsoDate, groupId: string): ClosureInfo;
}

/** Bereidt de momentopname voor, zodat je daarna snel per datum kunt rekenen. */
export function createScheduleContext(snapshot: PlanningSnapshot): ScheduleContext {
  const { settings } = snapshot;
  const boundary = settings.dayPartBoundary;
  const groupsById = new Map(snapshot.groups.map((group) => [group.id, group]));
  const employees = snapshot.employees.filter((employee) => employee.isActive);
  const employeesById = new Map(employees.map((employee) => [employee.id, employee]));
  const shiftsByEmployee = groupBy(snapshot.recurringShifts, (shift) => shift.employeeId);
  const absencesByEmployee = groupBy(snapshot.absences, (absence) => absence.employeeId);
  const substitutionsByDate = groupBy(
    snapshot.substitutions.filter((sub) => sub.status === 'active' && employeesById.has(sub.employeeId)),
    (sub) => sub.date,
  );
  const resolveClosure = createClosureResolver(snapshot.closureOverrides);

  const groupOrder = (groupId: string) => groupsById.get(groupId)?.sortOrder ?? Number.MAX_SAFE_INTEGER;
  const compareEntries = (a: ShiftEntry, b: ShiftEntry) =>
    groupOrder(a.groupId) - groupOrder(b.groupId) ||
    (a.groupId < b.groupId ? -1 : a.groupId > b.groupId ? 1 : 0) ||
    (a.kind === b.kind ? 0 : a.kind === 'regular' ? -1 : 1) ||
    compareNames(a.employeeName, b.employeeName) ||
    (a.employeeId < b.employeeId ? -1 : a.employeeId > b.employeeId ? 1 : 0) ||
    (a.sourceId < b.sourceId ? -1 : a.sourceId > b.sourceId ? 1 : 0);

  function absencesOn(employeeId: string, date: IsoDate): AbsenceMark[] {
    return (absencesByEmployee.get(employeeId) ?? [])
      .filter((absence) => absence.startDate <= date && date <= absence.endDate)
      .map((absence) => ({
        absenceId: absence.id,
        dayPart: absence.dayPart,
        status: absence.status,
        updatedAt: absence.updatedAt,
      }))
      .sort((a, b) => (a.absenceId < b.absenceId ? -1 : a.absenceId > b.absenceId ? 1 : 0));
  }

  function makeEntry(input: {
    date: IsoDate;
    employee: Employee;
    kind: EntryKind;
    sourceId: string;
    groupId: string;
    role: Role;
    times: ShiftTimes;
    dayParts: DayPart[];
    absences: AbsenceMark[];
    absentParts: DayPart[];
    lentOutParts: DayPart[];
    closure: ClosureInfo;
    timestamps: string[];
  }): ShiftEntry {
    const closed = input.closure.closed;
    const absentParts = intersectParts(input.absentParts, input.dayParts);
    const lentOutParts = closed ? [] : subtractParts(intersectParts(input.lentOutParts, input.dayParts), absentParts);
    const workingParts = closed ? [] : subtractParts(input.dayParts, [...absentParts, ...lentOutParts]);
    const group = groupsById.get(input.groupId);
    return {
      date: input.date,
      employeeId: input.employee.id,
      employeeName: input.employee.name,
      groupId: input.groupId,
      role: input.role,
      kind: input.kind,
      sourceId: input.sourceId,
      start: input.times.start,
      end: input.times.end,
      dayParts: input.dayParts,
      absentParts,
      absences: input.absences,
      lentOutParts,
      workingParts,
      working: clipToDayParts(input.times, workingParts, boundary),
      closure: closed ? input.closure : null,
      countsForCounter: !closed && input.role === 'counter' && group?.hasCounter === true && workingParts.length > 0,
      updatedAt: latestTimestamp([
        ...input.timestamps,
        settings.updatedAt,
        ...input.absences.map((absence) => absence.updatedAt),
      ]),
    };
  }

  function entriesOn(date: IsoDate): ShiftEntry[] {
    const weekday = weekdayOf(date);
    const substitutions = substitutionsByDate.get(date) ?? [];
    const entries: ShiftEntry[] = [];

    for (const employee of employees) {
      const shift = findRecurringShift(shiftsByEmployee.get(employee.id) ?? [], date);
      const ownSubstitutions = substitutions.filter((sub) => sub.employeeId === employee.id);
      if (!shift && ownSubstitutions.length === 0) continue;

      const absences = absencesOn(employee.id, date);
      const absentParts = sortParts(absences.flatMap((absence) => dayPartsOfAbsence(absence.dayPart)));
      const shiftTimes = shift ? effectiveShiftTimes(shift, settings) : standardShiftFor(settings, weekday);

      if (shift) {
        entries.push(
          makeEntry({
            date,
            employee,
            kind: 'regular',
            sourceId: shift.id,
            groupId: shift.groupId,
            role: shift.role,
            times: shiftTimes,
            dayParts: overlappedDayParts(shiftTimes, boundary),
            absences,
            absentParts,
            lentOutParts: sortParts(ownSubstitutions.flatMap((sub) => sub.dayParts)),
            closure: resolveClosure(date, shift.groupId),
            timestamps: [shift.updatedAt, ...ownSubstitutions.map((sub) => sub.updatedAt)],
          }),
        );
      }

      for (const sub of ownSubstitutions) {
        const dayParts = sortParts(sub.dayParts);
        entries.push(
          makeEntry({
            date,
            employee,
            kind: 'substitution',
            sourceId: sub.id,
            groupId: sub.groupId,
            role: 'counter',
            times: clipToDayParts(shiftTimes, dayParts, boundary) ?? shiftTimes,
            dayParts,
            absences,
            absentParts,
            lentOutParts: [],
            closure: resolveClosure(date, sub.groupId),
            timestamps: [sub.updatedAt, ...(shift ? [shift.updatedAt] : [])],
          }),
        );
      }
    }

    return entries.sort(compareEntries);
  }

  return {
    settings,
    groupsById,
    employeesById,
    entriesOn,
    absencesOn,
    closure: resolveClosure,
  };
}

/** Het berekende rooster per datum, van `from` t/m `to`. */
export function computeSchedule(snapshot: PlanningSnapshot, from: IsoDate, to: IsoDate): ScheduleDay[] {
  const context = createScheduleContext(snapshot);
  return eachDay(from, to).map((date) => ({ date, entries: context.entriesOn(date) }));
}

export type EntryState = 'working' | 'partly_absent' | 'absent' | 'elsewhere' | 'closed';

/** Hoe een dienst op het scherm staat. */
export function entryState(entry: ShiftEntry): EntryState {
  if (entry.closure) return 'closed';
  if (entry.workingParts.length > 0) return entry.absentParts.length > 0 ? 'partly_absent' : 'working';
  if (entry.absentParts.length === 0 && entry.lentOutParts.length > 0) return 'elsewhere';
  return 'absent';
}

export interface GroupDay {
  date: IsoDate;
  groupId: string;
  closure: ClosureInfo | null;
  /** Werkt hier, ook als het maar een deel van de dag is. Invallers staan hier ook (kind = substitution). */
  working: ShiftEntry[];
  /** Zou hier werken, maar is de hele dienst afwezig. */
  absent: ShiftEntry[];
  /** Hoort hier, maar valt de hele dienst elders in (fase 2). */
  elsewhere: ShiftEntry[];
}

/** De dag van één groep, verdeeld in wie werkt, wie afwezig is en wie elders is. */
export function groupDay(context: ScheduleContext, day: ScheduleDay, groupId: string): GroupDay {
  const closure = context.closure(day.date, groupId);
  const result: GroupDay = {
    date: day.date,
    groupId,
    closure: closure.closed ? closure : null,
    working: [],
    absent: [],
    elsewhere: [],
  };
  if (closure.closed) return result;
  for (const entry of day.entries) {
    if (entry.groupId !== groupId) continue;
    const state = entryState(entry);
    if (state === 'working' || state === 'partly_absent') result.working.push(entry);
    else if (state === 'absent') result.absent.push(entry);
    else if (state === 'elsewhere') result.elsewhere.push(entry);
  }
  return result;
}

export interface PersonalDay {
  date: IsoDate;
  /** Eigen diensten: de vaste dienst (ook als het gesloten is) en eventuele invallen. */
  entries: ShiftEntry[];
  /** Eigen afwezigheid op deze datum, ook op een dag zonder dienst. */
  absences: AbsenceMark[];
}

/** Het rooster van één medewerker, per datum. */
export function computePersonalSchedule(
  snapshot: PlanningSnapshot,
  employeeId: string,
  from: IsoDate,
  to: IsoDate,
): PersonalDay[] {
  const context = createScheduleContext(snapshot);
  const active = context.employeesById.has(employeeId);
  return eachDay(from, to).map((date) => ({
    date,
    entries: active ? context.entriesOn(date).filter((entry) => entry.employeeId === employeeId) : [],
    absences: active ? context.absencesOn(employeeId, date) : [],
  }));
}
