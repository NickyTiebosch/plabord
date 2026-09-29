import { dayOfMonth, monthOf, weekdayOf, yearOf } from './dates';
import type { IsoDate, Weekday } from './types';

const WEEKDAYS_SHORT = ['ma', 'di', 'wo', 'do', 'vr', 'za', 'zo'] as const;
const WEEKDAYS_LONG = ['maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag', 'zondag'] as const;
const MONTHS_SHORT = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'] as const;
const MONTHS_LONG = [
  'januari',
  'februari',
  'maart',
  'april',
  'mei',
  'juni',
  'juli',
  'augustus',
  'september',
  'oktober',
  'november',
  'december',
] as const;

export function weekdayShort(weekday: Weekday): string {
  return WEEKDAYS_SHORT[weekday - 1] ?? '';
}

export function weekdayLong(weekday: Weekday): string {
  return WEEKDAYS_LONG[weekday - 1] ?? '';
}

export function monthShort(month: number): string {
  return MONTHS_SHORT[month - 1] ?? '';
}

export function monthLong(month: number): string {
  return MONTHS_LONG[month - 1] ?? '';
}

/** 'di 14 okt' */
export function formatDayShort(date: IsoDate): string {
  return `${weekdayShort(weekdayOf(date))} ${dayOfMonth(date)} ${monthShort(monthOf(date))}`;
}

/** 'di 14 okt 2025' */
export function formatDayShortWithYear(date: IsoDate): string {
  return `${formatDayShort(date)} ${yearOf(date)}`;
}

/** 'dinsdag 14 oktober' */
export function formatDayLong(date: IsoDate): string {
  return `${weekdayLong(weekdayOf(date))} ${dayOfMonth(date)} ${monthLong(monthOf(date))}`;
}

/** '14 okt' */
export function formatDayMonth(date: IsoDate): string {
  return `${dayOfMonth(date)} ${monthShort(monthOf(date))}`;
}

/** '14 okt 2025' */
export function formatDate(date: IsoDate): string {
  return `${formatDayMonth(date)} ${yearOf(date)}`;
}

/** 'oktober 2025' */
export function formatMonthYear(date: IsoDate): string {
  return `${monthLong(monthOf(date))} ${yearOf(date)}`;
}

/**
 * Korte periode:
 * - één dag: 'di 14 okt'
 * - zelfde maand: '14–18 okt'
 * - zelfde jaar: '28 okt – 3 nov'
 * - anders: '29 dec 2025 – 2 jan 2026'
 */
export function formatDateRange(from: IsoDate, to: IsoDate): string {
  if (from === to) return formatDayShort(from);
  if (yearOf(from) === yearOf(to) && monthOf(from) === monthOf(to)) {
    return `${dayOfMonth(from)}–${dayOfMonth(to)} ${monthShort(monthOf(to))}`;
  }
  if (yearOf(from) === yearOf(to)) return `${formatDayMonth(from)} – ${formatDayMonth(to)}`;
  return `${formatDate(from)} – ${formatDate(to)}`;
}
