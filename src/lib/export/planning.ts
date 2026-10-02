/**
 * Export (fase 3, besluit V20). Puur: van gegevens naar tabbladen met rijen. Het Excel-bestand
 * maakt xlsx.ts. Datums als d-m-jjjj en tijden als uu:mm, zoals in de import.
 */
import { dayOfMonth, monthOf, yearOf } from '../engine/dates';
import { weekdayShort } from '../engine/format';
import { ABSENCE_PART_LABELS, ABSENCE_STATUS_LABELS, DAY_PART_LABELS, ROLE_LABELS } from '../engine/labels';
import { compareByNameThenId, compareGroups } from '../engine/sort';
import { parseTime } from '../engine/time';
import type {
  Absence,
  DayPart,
  Employee,
  Group,
  IsoDate,
  RecurringShift,
  Role,
  ShiftOverride,
  Substitution,
} from '../engine/types';
import { ABSENCE_COLUMNS, EMPLOYEE_COLUMNS, SHEET_NAMES, SHIFT_COLUMNS } from '../import/columns';

export type Cell = string | number;

export interface ExportSheet {
  sheet: string;
  header: string[];
  rows: Cell[][];
}

export interface ExportEmployee extends Employee {
  email: string | null;
}

export interface PlanningData {
  employees: readonly ExportEmployee[];
  groups: readonly Group[];
  recurringShifts: readonly RecurringShift[];
  absences: readonly Absence[];
  substitutions: readonly Substitution[];
  shiftOverrides: readonly ShiftOverride[];
}

/** 14-10-2026, zoals de import het leest. */
export function formatExportDate(date: IsoDate): string {
  return `${dayOfMonth(date)}-${monthOf(date)}-${yearOf(date)}`;
}

export function formatExportTime(time: string | null): string {
  return time ? (parseTime(time) ?? time) : '';
}

/** De rol zoals in de import: leeg bij "geen rol". */
export function roleCell(role: Role | null): string {
  return role && role !== 'none' ? ROLE_LABELS[role] : '';
}

export function dayPartsCell(parts: readonly DayPart[]): string {
  return parts.length === 2 ? 'hele dag' : parts.map((part) => DAY_PART_LABELS[part]).join(' en ');
}

export const SUBSTITUTION_STATUS_TEXT: Record<Substitution['status'], string> = {
  active: 'gaat door',
  not_needed: 'niet meer nodig',
  reschedule: 'opnieuw regelen',
};

function byDateThenName<T extends { date: IsoDate }>(name: (item: T) => string) {
  return (a: T, b: T) => (a.date < b.date ? -1 : a.date > b.date ? 1 : name(a).localeCompare(name(b), 'nl'));
}

/**
 * De hele planning in één bestand. De eerste drie tabbladen hebben de koppen van de import
 * (met een extra "(info)"-kolom die de import overslaat); Invallen en Roosterwijzigingen zijn
 * er ter informatie bij. Vaste roosters: alleen wat nu geldt en wat nog komt.
 */
export function planningExport(data: PlanningData, today: IsoDate): ExportSheet[] {
  const groupName = (id: string | null) => data.groups.find((group) => group.id === id)?.name ?? id ?? '';
  const names = new Map(data.employees.map((employee) => [employee.id, employee.name]));
  const nameOf = (id: string) => names.get(id) ?? '';
  const groupOrder = [...data.groups].sort(compareGroups).map((group) => group.id);
  const employees = [...data.employees].sort(
    (a, b) => groupOrder.indexOf(a.groupId) - groupOrder.indexOf(b.groupId) || compareByNameThenId(a, b),
  );

  const shifts = data.recurringShifts
    .filter((shift) => shift.validTo === null || shift.validTo >= today)
    .sort(
      (a, b) =>
        nameOf(a.employeeId).localeCompare(nameOf(b.employeeId), 'nl') ||
        a.weekday - b.weekday ||
        (a.validFrom < b.validFrom ? -1 : a.validFrom > b.validFrom ? 1 : 0),
    );

  return [
    {
      sheet: SHEET_NAMES.employees,
      header: [...EMPLOYEE_COLUMNS.map((column) => column.header), 'Actief (info)'],
      rows: employees.map((employee) => [
        employee.name,
        employee.email ?? '',
        groupName(employee.groupId),
        roleCell(employee.defaultRole),
        employee.counterGroupIds.map((id) => groupName(id)).join(', '),
        employee.isAdmin ? 'ja' : 'nee',
        employee.isActive ? 'ja' : 'nee',
      ]),
    },
    {
      sheet: SHEET_NAMES.shifts,
      header: [...SHIFT_COLUMNS.map((column) => column.header), 'Geldig tot (info)'],
      rows: shifts.map((shift) => [
        nameOf(shift.employeeId),
        weekdayShort(shift.weekday),
        groupName(shift.groupId),
        roleCell(shift.role),
        formatExportTime(shift.startTime),
        formatExportTime(shift.endTime),
        formatExportDate(shift.validFrom),
        shift.validTo ? formatExportDate(shift.validTo) : '',
      ]),
    },
    {
      sheet: SHEET_NAMES.absences,
      header: ABSENCE_COLUMNS.map((column) => column.header),
      rows: [...data.absences]
        .sort((a, b) => (a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : nameOf(a.employeeId).localeCompare(nameOf(b.employeeId), 'nl')))
        .map((absence) => [
          nameOf(absence.employeeId),
          formatExportDate(absence.startDate),
          formatExportDate(absence.endDate),
          ABSENCE_PART_LABELS[absence.dayPart],
          ABSENCE_STATUS_LABELS[absence.status],
        ]),
    },
    {
      sheet: 'Invallen',
      header: ['Naam', 'Datum', 'Vestiging', 'Dagdeel', 'Status'],
      rows: [...data.substitutions]
        .sort(byDateThenName((sub) => nameOf(sub.employeeId)))
        .map((sub) => [
          nameOf(sub.employeeId),
          formatExportDate(sub.date),
          groupName(sub.groupId),
          dayPartsCell(sub.dayParts),
          SUBSTITUTION_STATUS_TEXT[sub.status],
        ]),
    },
    {
      sheet: 'Roosterwijzigingen',
      header: ['Naam', 'Datum', 'Wijziging', 'Groep', 'Rol', 'Begintijd', 'Eindtijd'],
      rows: [...data.shiftOverrides]
        .sort(byDateThenName((item) => nameOf(item.employeeId)))
        .map((item) => [
          nameOf(item.employeeId),
          formatExportDate(item.date),
          item.kind === 'off' ? 'geen dienst' : 'andere dienst',
          item.kind === 'shift' ? groupName(item.groupId) : '',
          roleCell(item.role),
          formatExportTime(item.startTime),
          formatExportTime(item.endTime),
        ]),
    },
  ];
}
