import type { IsoDate, Weekday } from './types';

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const ISO_WEEK_PATTERN = /^(\d{4})-W(\d{2})$/;
const DAY_MS = 86_400_000;
/** Bescherming tegen per ongeluk enorme bereiken (ruim 10 jaar). */
const MAX_RANGE_DAYS = 3700;

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function splitIsoDate(value: string): [number, number, number] | null {
  const match = ISO_DATE_PATTERN.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1000 || month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return null;
  return [year, month, day];
}

export function isIsoDate(value: unknown): value is IsoDate {
  return typeof value === 'string' && splitIsoDate(value) !== null;
}

/** Maakt een ISO-datum van losse delen; `null` als de datum niet bestaat (zoals 31-2). */
export function makeIsoDate(year: number, month: number, day: number): IsoDate | null {
  if (![year, month, day].every(Number.isInteger)) return null;
  if (year < 1000 || year > 9999 || month < 1 || month > 12) return null;
  if (day < 1 || day > daysInMonth(year, month)) return null;
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function toUtcMs(date: IsoDate): number {
  const parts = splitIsoDate(date);
  if (!parts) throw new RangeError(`Ongeldige datum: ${date}`);
  return Date.UTC(parts[0], parts[1] - 1, parts[2]);
}

function fromUtcMs(ms: number): IsoDate {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

/** Zet een Date om naar een ISO-datum op basis van de UTC-delen (zoals Excel-datums binnenkomen). */
export function isoDateFromUtcDate(date: Date): IsoDate {
  return fromUtcMs(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function yearOf(date: IsoDate): number {
  return Number(date.slice(0, 4));
}

export function monthOf(date: IsoDate): number {
  return Number(date.slice(5, 7));
}

export function dayOfMonth(date: IsoDate): number {
  return Number(date.slice(8, 10));
}

export function addDays(date: IsoDate, days: number): IsoDate {
  return fromUtcMs(toUtcMs(date) + days * DAY_MS);
}

/** Aantal dagen van `from` naar `to` (negatief als `to` eerder is). */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  return Math.round((toUtcMs(to) - toUtcMs(from)) / DAY_MS);
}

export function weekdayOf(date: IsoDate): Weekday {
  const day = new Date(toUtcMs(date)).getUTCDay();
  return (day === 0 ? 7 : day) as Weekday;
}

/** De maandag van de ISO-week waarin `date` valt. */
export function startOfIsoWeek(date: IsoDate): IsoDate {
  return addDays(date, 1 - weekdayOf(date));
}

export function isoWeekOf(date: IsoDate): { year: number; week: number } {
  const thursday = addDays(date, 4 - weekdayOf(date));
  const year = yearOf(thursday);
  const week = Math.floor(daysBetween(`${year}-01-01`, thursday) / 7) + 1;
  return { year, week };
}

/** Weeksleutel zoals '2026-W42'. */
export function isoWeekKey(date: IsoDate): string {
  const { year, week } = isoWeekOf(date);
  return `${year}-W${pad2(week)}`;
}

/** De maandag van een weeksleutel zoals '2026-W42', of `null` als die week niet bestaat. */
export function mondayOfIsoWeekKey(key: string): IsoDate | null {
  const match = ISO_WEEK_PATTERN.exec(key);
  if (!match) return null;
  const year = Number(match[1]);
  const week = Number(match[2]);
  if (year < 1000 || week < 1 || week > 53) return null;
  // Week 1 is de week waarin 4 januari valt.
  const monday = addDays(startOfIsoWeek(`${year}-01-04`), (week - 1) * 7);
  return isoWeekOf(monday).year === year ? monday : null;
}

/** Alle datums van `from` t/m `to`. */
export function eachDay(from: IsoDate, to: IsoDate): IsoDate[] {
  const count = daysBetween(from, to);
  if (count < 0) return [];
  if (count > MAX_RANGE_DAYS) throw new RangeError('Datumbereik is te groot');
  const days: IsoDate[] = [];
  for (let i = 0; i <= count; i++) days.push(addDays(from, i));
  return days;
}

/** Valt `date` binnen [from, to]? Een lege `to` betekent onbepaald. */
export function isWithin(date: IsoDate, from: IsoDate, to: IsoDate | null): boolean {
  return date >= from && (to === null || date <= to);
}

/** Overlappen twee periodes (beide inclusief)? Een lege einddatum betekent onbepaald. */
export function rangesOverlap(aFrom: IsoDate, aTo: IsoDate | null, bFrom: IsoDate, bTo: IsoDate | null): boolean {
  return (bTo === null || aFrom <= bTo) && (aTo === null || bFrom <= aTo);
}

export function minDate(a: IsoDate, b: IsoDate): IsoDate {
  return a <= b ? a : b;
}

export function maxDate(a: IsoDate, b: IsoDate): IsoDate {
  return a >= b ? a : b;
}

export function startOfMonth(date: IsoDate): IsoDate {
  return `${date.slice(0, 8)}01`;
}

export function endOfMonth(date: IsoDate): IsoDate {
  return `${date.slice(0, 8)}${pad2(daysInMonth(yearOf(date), monthOf(date)))}`;
}

/** Telt maanden op; de dag schuift terug als de maand korter is (31 jan + 1 maand = 28/29 feb). */
export function addMonths(date: IsoDate, months: number): IsoDate {
  const total = yearOf(date) * 12 + (monthOf(date) - 1) + months;
  const year = Math.floor(total / 12);
  const month = (total % 12) + 1;
  const day = Math.min(dayOfMonth(date), daysInMonth(year, month));
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

export function startOfQuarter(date: IsoDate): IsoDate {
  const month = Math.floor((monthOf(date) - 1) / 3) * 3 + 1;
  return `${date.slice(0, 5)}${pad2(month)}-01`;
}

export function startOfYear(date: IsoDate): IsoDate {
  return `${date.slice(0, 4)}-01-01`;
}

const amsterdamDateFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Amsterdam',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** De datum van vandaag in Europe/Amsterdam, los van de tijdzone van de server. */
export function todayInAmsterdam(now: Date): IsoDate {
  const parts = amsterdamDateFormat.formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}
