/**
 * Verlofoverzicht: periode en maatvoering van de tijdlijn (maand, kwartaal of jaar).
 */
import {
  addDays,
  addMonths,
  daysBetween,
  endOfMonth,
  isIsoDate,
  isoWeekOf,
  monthOf,
  startOfMonth,
  startOfQuarter,
  startOfYear,
  yearOf,
} from '../engine/dates';
import { formatMonthYear, monthShort } from '../engine/format';
import type { IsoDate } from '../engine/types';

export const LEAVE_VIEWS = ['maand', 'kwartaal', 'jaar'] as const;
export type LeaveView = (typeof LEAVE_VIEWS)[number];

export function parseLeaveView(value: unknown): LeaveView {
  return LEAVE_VIEWS.includes(value as LeaveView) ? (value as LeaveView) : 'maand';
}

export function parseAnchor(value: unknown, fallback: IsoDate): IsoDate {
  return typeof value === 'string' && isIsoDate(value) ? value : fallback;
}

export interface LeaveRange {
  view: LeaveView;
  from: IsoDate;
  to: IsoDate;
  previous: IsoDate;
  next: IsoDate;
  title: string;
}

export function leaveRange(view: LeaveView, anchor: IsoDate): LeaveRange {
  if (view === 'jaar') {
    const from = startOfYear(anchor);
    const year = yearOf(from);
    return { view, from, to: `${year}-12-31`, previous: `${year - 1}-01-01`, next: `${year + 1}-01-01`, title: String(year) };
  }
  if (view === 'kwartaal') {
    const from = startOfQuarter(anchor);
    const last = addMonths(from, 2);
    return {
      view,
      from,
      to: endOfMonth(last),
      previous: addMonths(from, -3),
      next: addMonths(from, 3),
      title: `${monthShort(monthOf(from))} – ${monthShort(monthOf(last))} ${yearOf(from)}`,
    };
  }
  const from = startOfMonth(anchor);
  return { view, from, to: endOfMonth(from), previous: addMonths(from, -1), next: addMonths(from, 1), title: formatMonthYear(from) };
}

/** Breedte van één dag in pixels. */
export function dayWidth(view: LeaveView): number {
  return view === 'maand' ? 28 : view === 'kwartaal' ? 11 : 4;
}

export interface Span {
  label: string;
  /** Index van de eerste dag in het bereik. */
  start: number;
  /** Aantal dagen binnen het bereik. */
  length: number;
}

/** Stuk van een tijdlijn voor een periode, ingekort tot het bereik. */
export function spanOf(from: IsoDate, to: IsoDate, start: IsoDate, end: IsoDate): { start: number; length: number } {
  const clippedStart = start < from ? from : start;
  const clippedEnd = end > to ? to : end;
  return { start: daysBetween(from, clippedStart), length: Math.max(0, daysBetween(clippedStart, clippedEnd) + 1) };
}

export function monthSpans(from: IsoDate, to: IsoDate, withYear: boolean): Span[] {
  const spans: Span[] = [];
  for (let month = startOfMonth(from); month <= to; month = addMonths(month, 1)) {
    const span = spanOf(from, to, month, endOfMonth(month));
    spans.push({ label: withYear ? formatMonthYear(month) : monthShort(monthOf(month)), ...span });
  }
  return spans;
}

export function weekSpans(from: IsoDate, to: IsoDate, mondays: readonly IsoDate[]): Span[] {
  return mondays.map((monday) => {
    const sunday = addDays(monday, 6);
    return { label: `wk ${isoWeekOf(monday).week}`, ...spanOf(from, to, monday, sunday) };
  });
}

