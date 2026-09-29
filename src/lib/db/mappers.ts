/**
 * Van databaserijen (snake_case) naar de types van de engine (camelCase). Puur en los te testen.
 */
import {
  ABSENCE_PARTS,
  ABSENCE_STATUSES,
  ROLES,
  type Absence,
  type AbsencePart,
  type AbsenceStatus,
  type ClosureOverride,
  type Employee,
  type Group,
  type RecurringShift,
  type Role,
  type Settings,
  type ShiftWeekday,
} from '../engine/types';
import { parseTime } from '../engine/time';
import type { CurrentEmployee } from '../import/plan';
import type { Tables } from './database.types';

function oneOf<T extends string>(allowed: readonly T[], value: string, fallback: T): T {
  return (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

export function toRole(value: string): Role {
  return oneOf(ROLES, value, 'none');
}

export function toAbsencePart(value: string): AbsencePart {
  return oneOf(ABSENCE_PARTS, value, 'full_day');
}

export function toAbsenceStatus(value: string): AbsenceStatus {
  return oneOf(ABSENCE_STATUSES, value, 'approved');
}

/** Postgres geeft tijden als 'HH:MM:SS'; de app rekent met 'HH:MM'. */
export function toTime(value: string): string {
  return parseTime(value) ?? value.slice(0, 5);
}

export function toNullableTime(value: string | null): string | null {
  return value === null ? null : toTime(value);
}

export function mapGroup(row: Tables<'groups'>): Group {
  return {
    id: row.id,
    name: row.name,
    hasCounter: row.has_counter,
    sortOrder: row.sort_order,
    substitutionRank: row.substitution_rank,
  };
}

export function mapSettings(row: Tables<'settings'>): Settings {
  return {
    standardShift: { start: toTime(row.standard_shift_start), end: toTime(row.standard_shift_end) },
    saturdayShift: { start: toTime(row.saturday_shift_start), end: toTime(row.saturday_shift_end) },
    dayPartBoundary: toTime(row.day_part_boundary),
    lookaheadWeeks: row.lookahead_weeks,
    updatedAt: row.updated_at,
  };
}

/** Koppelt de inzetbaarheid per medewerker. */
export function counterGroupsByEmployee(rows: readonly Pick<Tables<'counter_eligibility'>, 'employee_id' | 'group_id'>[]) {
  const map = new Map<string, string[]>();
  for (const row of rows) {
    const list = map.get(row.employee_id) ?? [];
    list.push(row.group_id);
    map.set(row.employee_id, list);
  }
  for (const list of map.values()) list.sort();
  return map;
}

export function mapEmployee(row: Tables<'employees'>, counterGroupIds: readonly string[] = []): Employee {
  return {
    id: row.id,
    name: row.name,
    groupId: row.group_id,
    defaultRole: toRole(row.default_role),
    isAdmin: row.is_admin,
    isActive: row.is_active,
    counterGroupIds: [...counterGroupIds].sort(),
  };
}

export function mapRecurringShift(row: Tables<'recurring_shifts'>): RecurringShift {
  return {
    id: row.id,
    employeeId: row.employee_id,
    weekday: row.weekday as ShiftWeekday,
    groupId: row.group_id,
    role: toRole(row.role),
    startTime: toNullableTime(row.start_time),
    endTime: toNullableTime(row.end_time),
    validFrom: row.valid_from,
    validTo: row.valid_to,
    updatedAt: row.updated_at,
  };
}

export function mapAbsence(row: Tables<'absences'>): Absence {
  return {
    id: row.id,
    employeeId: row.employee_id,
    startDate: row.start_date,
    endDate: row.end_date,
    dayPart: toAbsencePart(row.day_part),
    status: toAbsenceStatus(row.status),
    updatedAt: row.updated_at,
  };
}

export function mapClosure(row: Tables<'closure_days'>): ClosureOverride {
  return { id: row.id, date: row.date, groupId: row.group_id, isClosed: row.is_closed, label: row.label };
}

/** Medewerkers zoals de import ze nodig heeft: met e-mail en of er al een account is. */
export function mapCurrentEmployees(
  employees: readonly Tables<'employees'>[],
  accounts: readonly Pick<Tables<'employee_accounts'>, 'employee_id' | 'email' | 'user_id'>[],
  eligibility: readonly Pick<Tables<'counter_eligibility'>, 'employee_id' | 'group_id'>[],
): CurrentEmployee[] {
  const accountByEmployee = new Map(accounts.map((account) => [account.employee_id, account]));
  const counters = counterGroupsByEmployee(eligibility);
  return employees.map((row) => {
    const account = accountByEmployee.get(row.id);
    return {
      ...mapEmployee(row, counters.get(row.id) ?? []),
      email: account?.email ?? null,
      hasAccount: Boolean(account?.user_id),
    };
  });
}
