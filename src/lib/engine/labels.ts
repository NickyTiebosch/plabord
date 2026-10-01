import type { AbsencePart, AbsenceStatus, DayPart, Role } from './types';

/** Nederlandse namen voor rollen, zoals in de app en de Excel-import. */
export const ROLE_LABELS: Record<Role, string> = {
  counter: 'balie',
  backoffice: 'backoffice',
  transport: 'transport',
  cleaning: 'poets',
  none: 'geen rol',
};

export const DAY_PART_LABELS: Record<DayPart, string> = {
  morning: 'ochtend',
  afternoon: 'middag',
};

export const ABSENCE_PART_LABELS: Record<AbsencePart, string> = {
  full_day: 'hele dag',
  morning: 'ochtend',
  afternoon: 'middag',
};

export const ABSENCE_STATUS_LABELS: Record<AbsenceStatus, string> = {
  requested: 'aangevraagd',
  approved: 'goedgekeurd',
};
