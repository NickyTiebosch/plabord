/**
 * De periodekeuze van de rapporten (fase 7, V67): per week, maand of jaar, een aantal perioden of
 * losse maanden, en een vestiging. De keuze staat in het adres, zodat een rapport te delen en te
 * bewaren is. Puur: "vandaag" komt binnen als parameter.
 */
import { addDays, addMonths, dayOfMonth, endOfMonth, isoWeekOf, monthOf, startOfIsoWeek, startOfMonth, startOfYear, yearOf } from '../engine/dates';
import { monthShort } from '../engine/format';
import type { IsoDate } from '../engine/types';

export type PeriodUnit = 'week' | 'month' | 'year';

export const UNIT_PARAM: Record<PeriodUnit, string> = { week: 'week', month: 'maand', year: 'jaar' };
export const UNIT_LABELS: Record<PeriodUnit, string> = { week: 'Per week', month: 'Per maand', year: 'Per jaar' };
const UNIT_BY_PARAM: Record<string, PeriodUnit> = { week: 'week', maand: 'month', jaar: 'year' };

/** Standaard aantal perioden, en het maximum. */
export const DEFAULT_COUNT: Record<PeriodUnit, number> = { week: 8, month: 6, year: 3 };
export const MAX_COUNT: Record<PeriodUnit, number> = { week: 26, month: 24, year: 5 };
/** Keuzes in de lijst; intypen kan ook, tot het maximum. */
export const COUNT_OPTIONS: Record<PeriodUnit, number[]> = { week: [4, 8, 13, 26], month: [3, 6, 12, 24], year: [1, 2, 3, 5] };

export interface Period {
  unit: PeriodUnit;
  /** De eerste dag: maandag, de eerste van de maand of 1 januari. Ook de sleutel van de periode. */
  from: IsoDate;
  to: IsoDate;
  /** "wk 46", "okt 2026", "2026". */
  label: string;
  /** "9–15 nov 2026", "oktober 2026", "2026". */
  title: string;
}

export interface ReportQuery {
  unit: PeriodUnit;
  count: number;
  /** Losse maanden ("2026-07"), alleen per maand. Leeg: de laatste `count` perioden. */
  months: string[];
  /** Eén vestiging, of null voor alle. */
  groupId: string | null;
  /** De perioden, oudste eerst. De laatste is de lopende (bij de laatste `count`). */
  periods: Period[];
  /** Per periode de periode ervoor, voor de vergelijking; zelfde volgorde. */
  previous: Period[];
}

export interface ReportParams {
  per?: string;
  aantal?: string;
  maanden?: string | string[];
  vestiging?: string;
}

export function startOfPeriod(unit: PeriodUnit, date: IsoDate): IsoDate {
  return unit === 'week' ? startOfIsoWeek(date) : unit === 'month' ? startOfMonth(date) : startOfYear(date);
}

export function periodAt(unit: PeriodUnit, date: IsoDate): Period {
  const from = startOfPeriod(unit, date);
  if (unit === 'week') {
    const to = addDays(from, 6);
    const sameMonth = monthOf(from) === monthOf(to);
    const title = sameMonth
      ? `${dayOfMonth(from)}–${dayOfMonth(to)} ${monthShort(monthOf(to))} ${yearOf(to)}`
      : `${dayOfMonth(from)} ${monthShort(monthOf(from))} – ${dayOfMonth(to)} ${monthShort(monthOf(to))} ${yearOf(to)}`;
    return { unit, from, to, label: `wk ${isoWeekOf(from).week}`, title: `week ${isoWeekOf(from).week} (${title})` };
  }
  if (unit === 'month') {
    const label = `${monthShort(monthOf(from))} ${yearOf(from)}`;
    return { unit, from, to: endOfMonth(from), label, title: label };
  }
  const year = String(yearOf(from));
  return { unit, from, to: `${year}-12-31`, label: year, title: year };
}

/** De periode `steps` perioden verder (negatief: eerder). */
export function shiftPeriod(period: Period, steps: number): Period {
  if (period.unit === 'week') return periodAt('week', addDays(period.from, steps * 7));
  if (period.unit === 'month') return periodAt('month', addMonths(period.from, steps));
  return periodAt('year', `${yearOf(period.from) + steps}-01-01`);
}

const MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;

function parseMonths(value: string | string[] | undefined, today: IsoDate): string[] {
  const list = (Array.isArray(value) ? value : (value ?? '').split(','))
    .flatMap((item) => item.split(','))
    .map((item) => item.trim())
    .filter((item) => MONTH_PATTERN.test(item) && `${item}-01` <= today);
  return [...new Set(list)].sort().slice(-MAX_COUNT.month);
}

/** De keuze uit het adres, met standaardwaarden voor wat ontbreekt of niet klopt. */
export function parseReportQuery(params: ReportParams, today: IsoDate, groupIds: readonly string[]): ReportQuery {
  const unit = UNIT_BY_PARAM[params.per ?? ''] ?? 'month';
  const wanted = Number.parseInt(params.aantal ?? '', 10);
  const count = Number.isInteger(wanted) && wanted >= 1 ? Math.min(wanted, MAX_COUNT[unit]) : DEFAULT_COUNT[unit];
  const months = unit === 'month' ? parseMonths(params.maanden, today) : [];
  const groupId = params.vestiging && groupIds.includes(params.vestiging) ? params.vestiging : null;
  const current = periodAt(unit, today);
  const periods =
    months.length > 0
      ? months.map((month) => periodAt('month', `${month}-01`))
      : Array.from({ length: count }, (_, index) => shiftPeriod(current, index - count + 1));
  return { unit, count, months, groupId, periods, previous: periods.map((period) => shiftPeriod(period, -1)) };
}

/** Van de eerste dag van de eerste vergelijkingsperiode tot de laatste dag: wat er geladen moet worden. */
export function queryRange(query: ReportQuery): { from: IsoDate; to: IsoDate } {
  const all = [...query.periods, ...query.previous];
  return {
    from: all.reduce((first, period) => (period.from < first ? period.from : first), all[0]?.from ?? '2026-01-01'),
    to: all.reduce((last, period) => (period.to > last ? period.to : last), all[0]?.to ?? '2026-01-01'),
  };
}

/** Het adres voor dezelfde keuze, met wijzigingen. */
export function reportHref(path: string, query: ReportQuery, change: Partial<Pick<ReportQuery, 'unit' | 'count' | 'months' | 'groupId'>> = {}): string {
  const unit = change.unit ?? query.unit;
  const params = new URLSearchParams();
  params.set('per', UNIT_PARAM[unit]);
  const months = change.months ?? (unit === query.unit ? query.months : []);
  if (unit === 'month' && months.length > 0) params.set('maanden', months.join(','));
  else params.set('aantal', String(change.count ?? (unit === query.unit ? query.count : DEFAULT_COUNT[unit])));
  const groupId = change.groupId === undefined ? query.groupId : change.groupId;
  if (groupId) params.set('vestiging', groupId);
  return `${path}?${params.toString()}`;
}

/** De laatste 24 maanden tot en met deze maand, nieuwste eerst: de keuzes voor "losse maanden". */
export function monthChoices(today: IsoDate): { value: string; label: string }[] {
  return Array.from({ length: MAX_COUNT.month }, (_, index) => {
    const date = addMonths(startOfMonth(today), -index);
    return { value: date.slice(0, 7), label: `${monthShort(monthOf(date))} ${yearOf(date)}` };
  });
}

/** Ligt de dag in de periode? */
export function inPeriod(date: IsoDate, period: Pick<Period, 'from' | 'to'>): boolean {
  return date >= period.from && date <= period.to;
}
