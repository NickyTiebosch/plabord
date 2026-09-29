/**
 * Maakt van een ingelezen werkboek een importplan: wat is nieuw, wat verandert en wat blijft gelijk.
 * Pure functie; de database voert het plan daarna in één transactie uit (apply_import).
 *
 * Regels:
 * - Een medewerker is uniek op e-mail, of op naam als de e-mail leeg is.
 * - Een vaste dienst is uniek op naam + dag + geldig vanaf. Een nieuwe vaste dienst op dezelfde dag
 *   beëindigt de vorige de dag ervoor.
 * - Een afwezigheid is uniek op naam + van + tot + dagdeel.
 * - De import verwijdert of deactiveert nooit iets, en wist geen bestaand e-mailadres.
 */
import { addDays } from '../engine/dates';
import { formatDate, weekdayShort } from '../engine/format';
import { ABSENCE_STATUS_LABELS, ROLE_LABELS } from '../engine/labels';
import { effectiveShiftTimes } from '../engine/schedule';
import { normalizeName } from '../engine/sort';
import { toMinutes } from '../engine/time';
import type {
  Absence,
  AbsencePart,
  AbsenceStatus,
  Group,
  IsoDate,
  RecurringShift,
  Role,
  Settings,
  ShiftWeekday,
  TimeOfDay,
} from '../engine/types';
import { SHEET_NAMES } from './columns';
import type { ImportIssue, ParsedWorkbook, ShiftRow } from './workbook';

export interface CurrentEmployee {
  id: string;
  name: string;
  groupId: string;
  defaultRole: Role;
  isAdmin: boolean;
  isActive: boolean;
  email: string | null;
  /** Heeft al een gekoppeld inlogaccount. */
  hasAccount: boolean;
  counterGroupIds: readonly string[];
}

export interface CurrentData {
  settings: Settings;
  groups: readonly Group[];
  employees: readonly CurrentEmployee[];
  recurringShifts: readonly RecurringShift[];
  absences: readonly Absence[];
}

export interface PlanOptions {
  /** De beheerder die importeert: die raakt nooit de eigen beheerdersrechten kwijt. */
  importingEmployeeId: string | null;
}

export type PlanAction = 'create' | 'update' | 'unchanged';

export interface PlannedEmployee {
  key: string;
  row: number | null;
  id: string | null;
  action: PlanAction;
  name: string;
  groupId: string;
  defaultRole: Role;
  isAdmin: boolean;
  email: string | null;
  /** Het e-mailadres wordt nieuw toegevoegd. */
  addEmail: boolean;
  counterGroupIds: string[];
  counterChanged: boolean;
  changes: string[];
}

export interface PlannedShift {
  row: number;
  employeeKey: string;
  employeeName: string;
  action: PlanAction;
  id: string | null;
  weekday: ShiftWeekday;
  groupId: string;
  role: Role;
  startTime: TimeOfDay | null;
  endTime: TimeOfDay | null;
  validFrom: IsoDate;
  validTo: IsoDate | null;
  /** Een bestaande vaste dienst die de dag ervoor eindigt. */
  close: { shiftId: string; validTo: IsoDate } | null;
  changes: string[];
}

export interface PlannedAbsence {
  row: number;
  employeeKey: string;
  employeeName: string;
  action: PlanAction;
  id: string | null;
  startDate: IsoDate;
  endDate: IsoDate;
  dayPart: AbsencePart;
  status: AbsenceStatus;
  changes: string[];
}

export interface ActionCounts {
  create: number;
  update: number;
  unchanged: number;
}

/** Wat apply_import in de database verwacht. */
export interface ApplyImportPayload {
  employees: {
    key: string;
    id: string | null;
    update: boolean;
    name: string;
    group_id: string;
    default_role: Role;
    is_admin: boolean;
    email?: string;
    counter_group_ids?: string[];
  }[];
  shifts: {
    employee_key: string;
    id: string | null;
    weekday: ShiftWeekday;
    group_id: string;
    role: Role;
    start_time: TimeOfDay | null;
    end_time: TimeOfDay | null;
    valid_from: IsoDate;
    valid_to: IsoDate | null;
    close_shift_id: string | null;
    close_valid_to: IsoDate | null;
  }[];
  absences: {
    employee_key: string;
    id: string | null;
    start_date: IsoDate;
    end_date: IsoDate;
    day_part: AbsencePart;
    status: AbsenceStatus;
  }[];
}

export interface ImportPlan {
  errors: ImportIssue[];
  notices: ImportIssue[];
  employees: PlannedEmployee[];
  shifts: PlannedShift[];
  absences: PlannedAbsence[];
  summary: Record<'employees' | 'shifts' | 'absences', ActionCounts>;
  /** Namen van medewerkers voor wie na de import een inlogaccount wordt aangemaakt. */
  accountsToCreate: string[];
  hasChanges: boolean;
  /** `null` zolang er fouten zijn: dan kan er niet worden opgeslagen. */
  payload: ApplyImportPayload | null;
}

interface EmployeeRef {
  key: string;
  id: string | null;
  name: string;
  groupId: string;
  defaultRole: Role;
}

function sameList(a: readonly string[], b: readonly string[]): boolean {
  const left = [...a].sort();
  const right = [...b].sort();
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function countActions(items: readonly { action: PlanAction }[]): ActionCounts {
  const counts: ActionCounts = { create: 0, update: 0, unchanged: 0 };
  for (const item of items) counts[item.action]++;
  return counts;
}

export function planImport(parsed: ParsedWorkbook, current: CurrentData, options: PlanOptions): ImportPlan {
  const errors: ImportIssue[] = [...parsed.errors];
  const notices: ImportIssue[] = [...parsed.notices];
  const groupName = (id: string) => current.groups.find((group) => group.id === id)?.name ?? id;
  const employeesSheet = SHEET_NAMES.employees;

  const byEmail = new Map<string, CurrentEmployee>();
  const byName = new Map<string, CurrentEmployee>();
  for (const employee of current.employees) {
    if (employee.email) byEmail.set(employee.email, employee);
    byName.set(normalizeName(employee.name), employee);
  }

  // 1. Medewerkers
  const plannedEmployees: PlannedEmployee[] = [];
  const matchedIds = new Set<string>();
  for (const row of parsed.employees) {
    const nameKey = normalizeName(row.name);
    const matchByEmail = row.email ? byEmail.get(row.email) : undefined;
    const matchByName = byName.get(nameKey);
    const match = matchByEmail ?? matchByName;

    if (matchByEmail && matchByName && matchByName.id !== matchByEmail.id) {
      errors.push({ sheet: employeesSheet, row: row.row, message: `De naam "${row.name}" hoort al bij een andere medewerker.` });
      continue;
    }
    if (!matchByEmail && matchByName && row.email && matchByName.email && matchByName.email !== row.email) {
      errors.push({
        sheet: employeesSheet,
        row: row.row,
        message: `${matchByName.name} heeft al een ander e-mailadres. Wijzig het e-mailadres in de app.`,
      });
      continue;
    }
    if (match && matchedIds.has(match.id)) {
      errors.push({ sheet: employeesSheet, row: row.row, message: `${match.name} staat twee keer in het bestand.` });
      continue;
    }
    if (match) matchedIds.add(match.id);

    const defaultRole = row.role ?? match?.defaultRole ?? 'none';
    const counterGroupIds = [...(row.counterGroupIds ?? match?.counterGroupIds ?? [])].sort();
    let isAdmin = row.isAdmin ?? match?.isAdmin ?? false;
    if (match && match.id === options.importingEmployeeId && match.isAdmin && !isAdmin) {
      isAdmin = true;
      notices.push({ sheet: employeesSheet, row: row.row, message: 'Je eigen beheerdersrechten blijven staan.' });
    }
    if (match && !match.isActive) {
      notices.push({
        sheet: employeesSheet,
        row: row.row,
        message: `${match.name} staat op inactief; de import verandert dat niet.`,
      });
    }
    const email = row.email ?? match?.email ?? null;
    if (isAdmin && !email) {
      notices.push({
        sheet: employeesSheet,
        row: row.row,
        message: `${row.name} is beheerder maar heeft geen e-mailadres en kan dus niet inloggen.`,
      });
    }

    const changes: string[] = [];
    let addEmail = false;
    let counterChanged = !match;
    if (match) {
      if (match.name !== row.name) changes.push(`naam: ${match.name} → ${row.name}`);
      if (match.groupId !== row.groupId) changes.push(`groep: ${groupName(match.groupId)} → ${groupName(row.groupId)}`);
      if (match.defaultRole !== defaultRole) {
        changes.push(`rol: ${ROLE_LABELS[match.defaultRole]} → ${ROLE_LABELS[defaultRole]}`);
      }
      if (match.isAdmin !== isAdmin) changes.push(isAdmin ? 'wordt beheerder' : 'is geen beheerder meer');
      if (!match.email && row.email) {
        addEmail = true;
        changes.push('e-mailadres toegevoegd');
      }
      if (!sameList(match.counterGroupIds, counterGroupIds)) {
        counterChanged = true;
        changes.push('inzetbaar aan de balie gewijzigd');
      }
    } else {
      addEmail = email !== null;
    }

    plannedEmployees.push({
      key: match ? `db:${match.id}` : `new:${row.row}`,
      row: row.row,
      id: match?.id ?? null,
      action: match ? (changes.length > 0 ? 'update' : 'unchanged') : 'create',
      name: row.name,
      groupId: row.groupId,
      defaultRole,
      isAdmin,
      email,
      addEmail,
      counterGroupIds,
      counterChanged,
      changes,
    });
  }

  // Wie kunnen vaste diensten en afwezigheid krijgen: de medewerkers uit het bestand en de bestaande.
  const refs = new Map<string, EmployeeRef>();
  for (const employee of plannedEmployees) {
    refs.set(normalizeName(employee.name), {
      key: employee.key,
      id: employee.id,
      name: employee.name,
      groupId: employee.groupId,
      defaultRole: employee.defaultRole,
    });
  }
  for (const employee of current.employees) {
    const nameKey = normalizeName(employee.name);
    if (!refs.has(nameKey) && !matchedIds.has(employee.id)) {
      refs.set(nameKey, {
        key: `db:${employee.id}`,
        id: employee.id,
        name: employee.name,
        groupId: employee.groupId,
        defaultRole: employee.defaultRole,
      });
    }
  }
  const findRef = (sheet: string, row: number, name: string): EmployeeRef | null => {
    const ref = refs.get(normalizeName(name));
    if (!ref) {
      errors.push({ sheet, row, message: `Onbekende naam "${name}". Staat die in het tabblad Medewerkers?` });
      return null;
    }
    return ref;
  };

  // 2. Vaste roosters, per medewerker en weekdag op volgorde van "geldig vanaf".
  const shiftsSheet = SHEET_NAMES.shifts;
  const plannedShifts: PlannedShift[] = [];
  const shiftGroups = new Map<string, { ref: EmployeeRef; rows: ShiftRow[] }>();
  for (const row of parsed.shifts) {
    const ref = findRef(shiftsSheet, row.row, row.name);
    if (!ref) continue;
    const times = effectiveShiftTimes({ weekday: row.weekday, startTime: row.startTime, endTime: row.endTime }, current.settings);
    if (toMinutes(times.end) <= toMinutes(times.start)) {
      errors.push({
        sheet: shiftsSheet,
        row: row.row,
        message: 'Eindtijd moet na de begintijd liggen (let op de standaardtijden bij een lege cel).',
      });
      continue;
    }
    const groupKey = `${ref.key}|${row.weekday}`;
    const entry = shiftGroups.get(groupKey) ?? { ref, rows: [] };
    entry.rows.push(row);
    shiftGroups.set(groupKey, entry);
  }

  for (const { ref, rows } of shiftGroups.values()) {
    rows.sort((a, b) => (a.validFrom < b.validFrom ? -1 : a.validFrom > b.validFrom ? 1 : 0));
    const weekday = rows[0]?.weekday;
    const existing = ref.id
      ? current.recurringShifts
          .filter((shift) => shift.employeeId === ref.id && shift.weekday === weekday)
          .sort((a, b) => (a.validFrom < b.validFrom ? -1 : 1))
      : [];
    const matchedByFile = new Set(
      existing.filter((shift) => rows.some((row) => row.validFrom === shift.validFrom)).map((shift) => shift.id),
    );

    rows.forEach((row, index) => {
      const next = rows[index + 1];
      const intendedTo = next ? addDays(next.validFrom, -1) : undefined;
      const groupId = row.groupId ?? ref.groupId;
      const role = row.role ?? ref.defaultRole;
      const same = existing.find((shift) => shift.validFrom === row.validFrom);
      const day = weekdayShort(row.weekday);
      const validTo = intendedTo ?? (same ? same.validTo : null);

      // Een bestaande vaste dienst die niet in het bestand staat en later begint, zou overlappen.
      const conflicting = existing.find(
        (shift) =>
          !matchedByFile.has(shift.id) &&
          shift.validFrom > row.validFrom &&
          (validTo === null || shift.validFrom <= validTo),
      );
      if (conflicting) {
        errors.push({
          sheet: shiftsSheet,
          row: row.row,
          message: `${ref.name} heeft op ${day} al een vaste dienst vanaf ${formatDate(conflicting.validFrom)}. Pas die eerst aan in de app.`,
        });
        return;
      }

      if (same) {
        const changes: string[] = [];
        if (same.groupId !== groupId) changes.push(`groep: ${groupName(same.groupId)} → ${groupName(groupId)}`);
        if (same.role !== role) changes.push(`rol: ${ROLE_LABELS[same.role]} → ${ROLE_LABELS[role]}`);
        if (same.startTime !== row.startTime || same.endTime !== row.endTime) changes.push('tijden gewijzigd');
        if (same.validTo !== validTo) changes.push(`geldig tot: ${validTo ? formatDate(validTo) : 'onbepaald'}`);
        plannedShifts.push({
          row: row.row,
          employeeKey: ref.key,
          employeeName: ref.name,
          action: changes.length > 0 ? 'update' : 'unchanged',
          id: same.id,
          weekday: row.weekday,
          groupId,
          role,
          startTime: row.startTime,
          endTime: row.endTime,
          validFrom: row.validFrom,
          validTo,
          close: null,
          changes,
        });
        return;
      }

      // Alleen de eerste regel sluit een bestaande dienst af; latere regels volgen op een regel uit het bestand.
      const covering =
        index === 0
          ? existing.find(
              (shift) =>
                !matchedByFile.has(shift.id) &&
                shift.validFrom < row.validFrom &&
                (shift.validTo === null || shift.validTo >= row.validFrom),
            )
          : undefined;
      const close = covering ? { shiftId: covering.id, validTo: addDays(row.validFrom, -1) } : null;
      plannedShifts.push({
        row: row.row,
        employeeKey: ref.key,
        employeeName: ref.name,
        action: 'create',
        id: null,
        weekday: row.weekday,
        groupId,
        role,
        startTime: row.startTime,
        endTime: row.endTime,
        validFrom: row.validFrom,
        validTo,
        close,
        changes: close ? [`vorige dienst op ${day} eindigt op ${formatDate(close.validTo)}`] : [],
      });
    });
  }
  plannedShifts.sort((a, b) => a.row - b.row);

  // 3. Afwezigheid
  const absencesSheet = SHEET_NAMES.absences;
  const plannedAbsences: PlannedAbsence[] = [];
  for (const row of parsed.absences) {
    const ref = findRef(absencesSheet, row.row, row.name);
    if (!ref) continue;
    const same = ref.id
      ? current.absences.find(
          (absence) =>
            absence.employeeId === ref.id &&
            absence.startDate === row.startDate &&
            absence.endDate === row.endDate &&
            absence.dayPart === row.dayPart,
        )
      : undefined;
    const changes =
      same && same.status !== row.status
        ? [`status: ${ABSENCE_STATUS_LABELS[same.status]} → ${ABSENCE_STATUS_LABELS[row.status]}`]
        : [];
    plannedAbsences.push({
      row: row.row,
      employeeKey: ref.key,
      employeeName: ref.name,
      action: same ? (changes.length > 0 ? 'update' : 'unchanged') : 'create',
      id: same?.id ?? null,
      startDate: row.startDate,
      endDate: row.endDate,
      dayPart: row.dayPart,
      status: row.status,
      changes,
    });
  }

  const accountsToCreate = plannedEmployees
    .filter((employee) => {
      if (!employee.email) return false;
      const existing = employee.id ? current.employees.find((e) => e.id === employee.id) : undefined;
      return !existing?.hasAccount;
    })
    .map((employee) => employee.name);

  const summary = {
    employees: countActions(plannedEmployees),
    shifts: countActions(plannedShifts),
    absences: countActions(plannedAbsences),
  };
  const hasChanges =
    [summary.employees, summary.shifts, summary.absences].some((counts) => counts.create + counts.update > 0) ||
    accountsToCreate.length > 0;

  return {
    errors,
    notices,
    employees: plannedEmployees,
    shifts: plannedShifts,
    absences: plannedAbsences,
    summary,
    accountsToCreate,
    hasChanges,
    payload: errors.length > 0 ? null : buildPayload(plannedEmployees, plannedShifts, plannedAbsences, refs),
  };
}

function buildPayload(
  employees: readonly PlannedEmployee[],
  shifts: readonly PlannedShift[],
  absences: readonly PlannedAbsence[],
  refs: ReadonlyMap<string, EmployeeRef>,
): ApplyImportPayload {
  const shiftOps = shifts.filter((shift) => shift.action !== 'unchanged');
  const absenceOps = absences.filter((absence) => absence.action !== 'unchanged');
  const neededKeys = new Set([...shiftOps.map((s) => s.employeeKey), ...absenceOps.map((a) => a.employeeKey)]);

  const employeeOps: ApplyImportPayload['employees'] = [];
  const included = new Set<string>();
  for (const employee of employees) {
    if (employee.action === 'unchanged' && !neededKeys.has(employee.key)) continue;
    included.add(employee.key);
    employeeOps.push({
      key: employee.key,
      id: employee.id,
      update: employee.action === 'update',
      name: employee.name,
      group_id: employee.groupId,
      default_role: employee.defaultRole,
      is_admin: employee.isAdmin,
      ...(employee.addEmail && employee.email ? { email: employee.email } : {}),
      ...(employee.counterChanged ? { counter_group_ids: employee.counterGroupIds } : {}),
    });
  }
  // Bestaande medewerkers die niet in het tabblad Medewerkers staan, maar wel diensten of afwezigheid krijgen.
  for (const ref of refs.values()) {
    if (!neededKeys.has(ref.key) || included.has(ref.key) || !ref.id) continue;
    included.add(ref.key);
    employeeOps.push({
      key: ref.key,
      id: ref.id,
      update: false,
      name: ref.name,
      group_id: ref.groupId,
      default_role: ref.defaultRole,
      is_admin: false,
    });
  }

  return {
    employees: employeeOps,
    shifts: shiftOps.map((shift) => ({
      employee_key: shift.employeeKey,
      id: shift.id,
      weekday: shift.weekday,
      group_id: shift.groupId,
      role: shift.role,
      start_time: shift.startTime,
      end_time: shift.endTime,
      valid_from: shift.validFrom,
      valid_to: shift.validTo,
      close_shift_id: shift.close?.shiftId ?? null,
      close_valid_to: shift.close?.validTo ?? null,
    })),
    absences: absenceOps.map((absence) => ({
      employee_key: absence.employeeKey,
      id: absence.id,
      start_date: absence.startDate,
      end_date: absence.endDate,
      day_part: absence.dayPart,
      status: absence.status,
    })),
  };
}
