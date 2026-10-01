/**
 * Fictief team met dezelfde opbouw als het echte team (zie docs/SPEC.md, "Tests").
 * Alle namen zijn verzonnen.
 *
 * - Den Bosch: 4 balie + 1 poets; Eindhoven: 3 balie + 1 poets + Zoë (alleen zaterdag);
 *   Breda: 3 balie + 1 poets.
 * - Logistiek: Ruben (transport), Anouk (di/do balie Den Bosch, wo/vr transport) en
 *   Gert (zonder vaste diensten).
 * - Backoffice: Danique. Overig: Petra, Hans, Iris en Wouter.
 */
import type {
  Absence,
  ClosureOverride,
  Employee,
  Group,
  PlanningSnapshot,
  RecurringShift,
  Role,
  Settings,
  ShiftWeekday,
  Substitution,
} from '../types';

export const FIXTURE_TIMESTAMP = '2026-01-01T09:00:00.000Z';

export const groups: Group[] = [
  { id: 'den_bosch', name: 'Den Bosch', hasCounter: true, sortOrder: 1, substitutionRank: 3 },
  { id: 'eindhoven', name: 'Eindhoven', hasCounter: true, sortOrder: 2, substitutionRank: 3 },
  { id: 'breda', name: 'Breda', hasCounter: true, sortOrder: 3, substitutionRank: 3 },
  { id: 'logistics', name: 'Logistiek', hasCounter: false, sortOrder: 4, substitutionRank: 4 },
  { id: 'backoffice', name: 'Backoffice', hasCounter: false, sortOrder: 5, substitutionRank: 1 },
  { id: 'other', name: 'Overig', hasCounter: false, sortOrder: 6, substitutionRank: 2 },
];

export const settings: Settings = {
  standardShift: { start: '07:30', end: '18:00' },
  saturdayShift: { start: '07:30', end: '18:00' },
  dayPartBoundary: '13:00',
  lookaheadWeeks: 8,
  updatedAt: FIXTURE_TIMESTAMP,
};

function employee(id: string, name: string, groupId: string, defaultRole: Role, counterGroupIds: string[] = []): Employee {
  return { id, name, groupId, defaultRole, isAdmin: false, isActive: true, counterGroupIds };
}

export const employees: Employee[] = [
  employee('sanne', 'Sanne', 'den_bosch', 'counter', ['den_bosch', 'eindhoven']),
  employee('joris', 'Joris', 'den_bosch', 'counter', ['den_bosch']),
  employee('fleur', 'Fleur', 'den_bosch', 'counter', ['den_bosch']),
  employee('bram', 'Bram', 'den_bosch', 'counter', ['den_bosch', 'breda']),
  employee('ingrid', 'Ingrid', 'den_bosch', 'cleaning'),
  employee('daan', 'Daan', 'eindhoven', 'counter', ['eindhoven', 'den_bosch']),
  employee('lotte', 'Lotte', 'eindhoven', 'counter', ['eindhoven']),
  employee('milan', 'Milan', 'eindhoven', 'counter', ['eindhoven']),
  employee('noor', 'Noor', 'eindhoven', 'cleaning'),
  employee('zoe', 'Zoë', 'eindhoven', 'counter', ['eindhoven']),
  employee('eva', 'Eva', 'breda', 'counter', ['breda']),
  employee('thijs', 'Thijs', 'breda', 'counter', ['breda', 'eindhoven']),
  employee('yara', 'Yara', 'breda', 'counter', ['breda']),
  employee('kees', 'Kees', 'breda', 'cleaning'),
  employee('ruben', 'Ruben', 'logistics', 'transport'),
  employee('anouk', 'Anouk', 'logistics', 'transport', ['den_bosch']),
  employee('gert', 'Gert', 'logistics', 'transport'),
  employee('danique', 'Danique', 'backoffice', 'backoffice', ['den_bosch', 'eindhoven', 'breda']),
  employee('petra', 'Petra', 'other', 'none', ['den_bosch']),
  employee('hans', 'Hans', 'other', 'none', ['eindhoven']),
  employee('iris', 'Iris', 'other', 'none', ['breda']),
  employee('wouter', 'Wouter', 'other', 'none'),
];

const VALID_FROM = '2025-01-01';

export function shift(
  employeeId: string,
  weekday: ShiftWeekday,
  groupId: string,
  role: Role,
  options: Partial<Pick<RecurringShift, 'startTime' | 'endTime' | 'validFrom' | 'validTo' | 'updatedAt'>> = {},
): RecurringShift {
  const validFrom = options.validFrom ?? VALID_FROM;
  return {
    id: `${employeeId}-${weekday}-${validFrom}`,
    employeeId,
    weekday,
    groupId,
    role,
    startTime: options.startTime ?? null,
    endTime: options.endTime ?? null,
    validFrom,
    validTo: options.validTo ?? null,
    updatedAt: options.updatedAt ?? FIXTURE_TIMESTAMP,
  };
}

function week(
  employeeId: string,
  weekdays: ShiftWeekday[],
  groupId: string,
  role: Role,
  options: Parameters<typeof shift>[4] = {},
): RecurringShift[] {
  return weekdays.map((weekday) => shift(employeeId, weekday, groupId, role, options));
}

const MA_VR: ShiftWeekday[] = [1, 2, 3, 4, 5];

export const recurringShifts: RecurringShift[] = [
  // Den Bosch
  ...week('sanne', MA_VR, 'den_bosch', 'counter'),
  ...week('joris', [1, 2, 3], 'den_bosch', 'counter'),
  ...week('fleur', [3, 4, 5], 'den_bosch', 'counter'),
  ...week('bram', MA_VR, 'den_bosch', 'counter'),
  ...week('ingrid', [1, 3, 5], 'den_bosch', 'cleaning', { startTime: '07:30', endTime: '11:30' }),
  // Eindhoven
  ...week('daan', MA_VR, 'eindhoven', 'counter'),
  ...week('lotte', [1, 2, 3, 4], 'eindhoven', 'counter'),
  ...week('milan', [2, 3, 4, 5], 'eindhoven', 'counter'),
  ...week('noor', [2, 4], 'eindhoven', 'cleaning', { startTime: '16:00', endTime: '18:00' }),
  shift('zoe', 6, 'eindhoven', 'counter', { startTime: '09:00', endTime: '13:00' }),
  // Breda
  ...week('eva', MA_VR, 'breda', 'counter'),
  ...week('thijs', MA_VR, 'breda', 'counter'),
  ...week('yara', [1, 3, 5], 'breda', 'counter'),
  ...week('kees', MA_VR, 'breda', 'cleaning', { startTime: '07:30', endTime: '11:30' }),
  // Logistiek
  ...week('ruben', MA_VR, 'logistics', 'transport'),
  ...week('anouk', [2, 4], 'den_bosch', 'counter'),
  ...week('anouk', [3, 5], 'logistics', 'transport'),
  // Backoffice en Overig
  ...week('danique', MA_VR, 'backoffice', 'backoffice'),
  ...week('petra', MA_VR, 'other', 'none'),
  ...week('hans', [1, 2, 3, 4], 'other', 'none'),
  ...week('iris', [2, 3, 4, 5], 'other', 'none'),
  ...week('wouter', [1, 3, 5], 'other', 'none'),
];

export function absence(
  id: string,
  employeeId: string,
  startDate: string,
  endDate: string = startDate,
  options: Partial<Pick<Absence, 'dayPart' | 'status' | 'updatedAt'>> = {},
): Absence {
  return {
    id,
    employeeId,
    startDate,
    endDate,
    dayPart: options.dayPart ?? 'full_day',
    status: options.status ?? 'approved',
    updatedAt: options.updatedAt ?? FIXTURE_TIMESTAMP,
  };
}

export function teamSnapshot(
  extra: {
    absences?: Absence[];
    closureOverrides?: ClosureOverride[];
    substitutions?: Substitution[];
    recurringShifts?: RecurringShift[];
    employees?: Employee[];
  } = {},
): PlanningSnapshot {
  return {
    settings,
    groups,
    employees: extra.employees ?? employees,
    recurringShifts: extra.recurringShifts ?? recurringShifts,
    absences: extra.absences ?? [],
    closureOverrides: extra.closureOverrides ?? [],
    substitutions: extra.substitutions ?? [],
  };
}
