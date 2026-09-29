import { createClosureResolver } from './closures';
import { addDays, eachDay, maxDate, minDate, startOfIsoWeek } from './dates';
import { compareByNameThenId, compareGroups } from './sort';
import type { Absence, AbsencePart, AbsenceStatus, ClosureOverride, Employee, Group, IsoDate } from './types';

export interface LeaveBar {
  absenceId: string;
  /** Begin en eind, ingekort tot het zichtbare bereik. */
  startDate: IsoDate;
  endDate: IsoDate;
  /** De echte begin- en einddatum. */
  fullStartDate: IsoDate;
  fullEndDate: IsoDate;
  dayPart: AbsencePart;
  status: AbsenceStatus;
}

export interface LeaveRow {
  employeeId: string;
  name: string;
  bars: LeaveBar[];
}

export interface WeekCounter {
  /** Maandag van de week. */
  monday: IsoDate;
  /** Aantal medewerkers dat in die week (ma–za) minstens één dagdeel afwezig is. */
  absent: number;
  /** Aantal actieve medewerkers met deze vestiging als groep. */
  total: number;
}

export interface LeaveSection {
  groupId: string;
  groupName: string;
  hasCounter: boolean;
  rows: LeaveRow[];
  /** Alleen voor vestigingen: per week "x van y afwezig". Anders leeg. */
  weekCounters: WeekCounter[];
  /** Datums in het bereik waarop deze groep gesloten is. */
  closedDates: IsoDate[];
}

export interface LeaveOverview {
  from: IsoDate;
  to: IsoDate;
  days: IsoDate[];
  /** Maandagen van alle weken die (deels) in het bereik vallen. */
  weeks: IsoDate[];
  sections: LeaveSection[];
}

export interface LeaveOverviewInput {
  groups: readonly Group[];
  employees: readonly Employee[];
  absences: readonly Absence[];
  closureOverrides: readonly ClosureOverride[];
}

function overlaps(absence: Absence, from: IsoDate, to: IsoDate): boolean {
  return absence.startDate <= to && absence.endDate >= from;
}

function compareAbsences(a: Absence, b: Absence): number {
  return (
    (a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : 0) ||
    (a.endDate < b.endDate ? -1 : a.endDate > b.endDate ? 1 : 0) ||
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
}

/**
 * Het verlofoverzicht: per groep een rij per actieve medewerker (ook zonder vaste diensten),
 * met balken voor afwezigheid. Vestigingen krijgen per week de teller "x van y afwezig".
 */
export function computeLeaveOverview(input: LeaveOverviewInput, from: IsoDate, to: IsoDate): LeaveOverview {
  const days = eachDay(from, to);
  const weeks: IsoDate[] = [];
  for (let monday = startOfIsoWeek(from); monday <= to; monday = addDays(monday, 7)) weeks.push(monday);

  const resolveClosure = createClosureResolver(input.closureOverrides);
  const activeEmployees = input.employees.filter((employee) => employee.isActive);
  const absencesByEmployee = new Map<string, Absence[]>();
  for (const absence of input.absences) {
    const list = absencesByEmployee.get(absence.employeeId);
    if (list) list.push(absence);
    else absencesByEmployee.set(absence.employeeId, [absence]);
  }

  const sections: LeaveSection[] = [];
  for (const group of [...input.groups].sort(compareGroups)) {
    const members = activeEmployees.filter((employee) => employee.groupId === group.id).sort(compareByNameThenId);
    if (members.length === 0) continue;

    const rows: LeaveRow[] = members.map((employee) => ({
      employeeId: employee.id,
      name: employee.name,
      bars: (absencesByEmployee.get(employee.id) ?? [])
        .filter((absence) => overlaps(absence, from, to))
        .sort(compareAbsences)
        .map((absence) => ({
          absenceId: absence.id,
          startDate: maxDate(absence.startDate, from),
          endDate: minDate(absence.endDate, to),
          fullStartDate: absence.startDate,
          fullEndDate: absence.endDate,
          dayPart: absence.dayPart,
          status: absence.status,
        })),
    }));

    const weekCounters: WeekCounter[] = group.hasCounter
      ? weeks.map((monday) => {
          const saturday = addDays(monday, 5);
          const absent = members.filter((employee) =>
            (absencesByEmployee.get(employee.id) ?? []).some((absence) => overlaps(absence, monday, saturday)),
          ).length;
          return { monday, absent, total: members.length };
        })
      : [];

    sections.push({
      groupId: group.id,
      groupName: group.name,
      hasCounter: group.hasCounter,
      rows,
      weekCounters,
      closedDates: days.filter((date) => resolveClosure(date, group.id).closed),
    });
  }

  return { from, to, days, weeks, sections };
}

export interface AbsenceListItem {
  absence: Absence;
  employeeName: string;
  groupId: string;
}

/** Alle afwezigheid van actieve medewerkers die (deels) in een periode valt, op datum en naam. */
export function listAbsencesInRange(
  employees: readonly Employee[],
  absences: readonly Absence[],
  from: IsoDate,
  to: IsoDate,
): AbsenceListItem[] {
  const byId = new Map(employees.filter((employee) => employee.isActive).map((employee) => [employee.id, employee]));
  const items: AbsenceListItem[] = [];
  for (const absence of absences) {
    const employee = byId.get(absence.employeeId);
    if (!employee || !overlaps(absence, from, to)) continue;
    items.push({ absence, employeeName: employee.name, groupId: employee.groupId });
  }
  return items.sort(
    (a, b) =>
      (a.absence.startDate < b.absence.startDate ? -1 : a.absence.startDate > b.absence.startDate ? 1 : 0) ||
      compareByNameThenId(
        { name: a.employeeName, id: a.absence.employeeId },
        { name: b.employeeName, id: b.absence.employeeId },
      ) ||
      compareAbsences(a.absence, b.absence),
  );
}
