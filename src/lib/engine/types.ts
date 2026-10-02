/** Kalenderdatum als ISO-string: 'YYYY-MM-DD'. */
export type IsoDate = string;

/** Tijd op een dag als 'HH:MM' (24-uurs). */
export type TimeOfDay = string;

/** ISO-weekdag: 1 = maandag … 7 = zondag. */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/** Weekdagen waarop een vaste dienst kan vallen: maandag t/m zaterdag. */
export type ShiftWeekday = 1 | 2 | 3 | 4 | 5 | 6;
export const SHIFT_WEEKDAYS: readonly ShiftWeekday[] = [1, 2, 3, 4, 5, 6];

export const ROLES = ['counter', 'backoffice', 'transport', 'cleaning', 'none'] as const;
export type Role = (typeof ROLES)[number];

export const DAY_PARTS = ['morning', 'afternoon'] as const;
export type DayPart = (typeof DAY_PARTS)[number];

export const ABSENCE_PARTS = ['full_day', 'morning', 'afternoon'] as const;
export type AbsencePart = (typeof ABSENCE_PARTS)[number];

export const ABSENCE_STATUSES = ['requested', 'approved'] as const;
export type AbsenceStatus = (typeof ABSENCE_STATUSES)[number];

/** Status van een inval (fase 2). Alleen `active` telt mee in het rooster. */
export const SUBSTITUTION_STATUSES = ['active', 'not_needed', 'reschedule'] as const;
export type SubstitutionStatus = (typeof SUBSTITUTION_STATUSES)[number];

export interface Group {
  id: string;
  name: string;
  /** Vestiging met een balie. */
  hasCounter: boolean;
  sortOrder: number;
  /** Invalvolgorde (fase 2): lager = eerder aan de beurt. */
  substitutionRank: number;
}

export interface ShiftTimes {
  start: TimeOfDay;
  end: TimeOfDay;
}

export interface Settings {
  standardShift: ShiftTimes;
  saturdayShift: ShiftTimes;
  dayPartBoundary: TimeOfDay;
  lookaheadWeeks: number;
  /** Tijdstip van de laatste wijziging (ISO-timestamp). */
  updatedAt: string;
}

export interface Employee {
  id: string;
  name: string;
  groupId: string;
  defaultRole: Role;
  isAdmin: boolean;
  isActive: boolean;
  /** Vestigingen waar deze medewerker aan de balie inzetbaar is. */
  counterGroupIds: readonly string[];
}

export interface RecurringShift {
  id: string;
  employeeId: string;
  weekday: ShiftWeekday;
  groupId: string;
  role: Role;
  /** Leeg = standaardtijd. */
  startTime: TimeOfDay | null;
  /** Leeg = standaardtijd. */
  endTime: TimeOfDay | null;
  validFrom: IsoDate;
  /** Leeg = onbepaald. Inclusief. */
  validTo: IsoDate | null;
  updatedAt: string;
}

export interface Absence {
  id: string;
  employeeId: string;
  startDate: IsoDate;
  endDate: IsoDate;
  dayPart: AbsencePart;
  status: AbsenceStatus;
  updatedAt: string;
}

/** Afwijking op de berekende feestdagen. `groupId` null = alle groepen. */
export interface ClosureOverride {
  id: string;
  date: IsoDate;
  groupId: string | null;
  /** true = (extra) dicht, false = toch open. */
  isClosed: boolean;
  label: string | null;
}

/** Inval (fase 2): iemand werkt in bepaalde dagdelen aan de balie van een andere vestiging. */
export interface Substitution {
  id: string;
  employeeId: string;
  date: IsoDate;
  /** De vestiging waar de inval is. */
  groupId: string;
  dayParts: readonly DayPart[];
  status: SubstitutionStatus;
  /** Wanneer de beheerder een vervallen inval heeft afgehandeld (besluit V10). */
  handledAt: string | null;
  /** Wanneer de inval is toegewezen (ISO-timestamp). Bij "niet meer nodig" vervalt de laatste eerst. */
  createdAt: string;
  updatedAt: string;
}

/**
 * Roosterwijziging voor één dag (fase 2). `off` = geen dienst; `shift` = deze dienst,
 * in plaats van de vaste dienst of erbij. De vaste diensten blijven ongemoeid.
 */
export interface ShiftOverride {
  id: string;
  employeeId: string;
  date: IsoDate;
  kind: 'off' | 'shift';
  /** Alleen bij `shift`. */
  groupId: string | null;
  role: Role | null;
  /** Leeg = standaardtijd. */
  startTime: TimeOfDay | null;
  endTime: TimeOfDay | null;
  updatedAt: string;
}

/** Minimaal aantal mensen aan de balie per vestiging, weekdag en dagdeel. */
export interface StaffingNorm {
  groupId: string;
  weekday: ShiftWeekday;
  dayPart: DayPart;
  minStaff: number;
}

/** Een genegeerd gat (fase 2): verborgen zolang het tekort niet groter is dan `shortage`. */
export interface GapDismissal {
  groupId: string;
  date: IsoDate;
  dayPart: DayPart;
  shortage: number;
}

/** Momentopname van alle gegevens die de engine nodig heeft. */
export interface PlanningSnapshot {
  settings: Settings;
  groups: readonly Group[];
  employees: readonly Employee[];
  recurringShifts: readonly RecurringShift[];
  absences: readonly Absence[];
  closureOverrides: readonly ClosureOverride[];
  substitutions: readonly Substitution[];
  shiftOverrides: readonly ShiftOverride[];
  staffingNorms: readonly StaffingNorm[];
}
