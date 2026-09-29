import { yearOf } from './dates';
import { createHolidayLookup, dutchHolidays } from './holidays';
import type { ClosureOverride, Group, IsoDate } from './types';

export interface ClosureInfo {
  closed: boolean;
  /** Naam van de feestdag of het label van de afwijking; `null` als open. */
  name: string | null;
}

const OPEN: ClosureInfo = { closed: false, name: null };
const DEFAULT_CLOSED_NAME = 'Gesloten';

function overrideKey(date: IsoDate, groupId: string | null): string {
  return `${date}|${groupId ?? '*'}`;
}

export type ClosureResolver = (date: IsoDate, groupId: string) => ClosureInfo;

/**
 * Bepaalt of een groep op een datum dicht is. Volgorde:
 * 1. een afwijking voor die groep;
 * 2. anders een afwijking voor alle groepen;
 * 3. anders: is het een feestdag?
 */
export function createClosureResolver(overrides: readonly ClosureOverride[]): ClosureResolver {
  const holidayName = createHolidayLookup();
  const byKey = new Map<string, ClosureOverride>();
  for (const override of overrides) byKey.set(overrideKey(override.date, override.groupId), override);

  return (date, groupId) => {
    const override = byKey.get(overrideKey(date, groupId)) ?? byKey.get(overrideKey(date, null));
    const holiday = holidayName(date);
    if (override) {
      if (!override.isClosed) return OPEN;
      return { closed: true, name: override.label ?? holiday ?? DEFAULT_CLOSED_NAME };
    }
    return holiday ? { closed: true, name: holiday } : OPEN;
  };
}

export interface HolidayRow {
  date: IsoDate;
  name: string;
  /** Per groep: dicht of open, na afwijkingen. */
  closedByGroup: Record<string, boolean>;
}

export interface ClosureYearOverview {
  year: number;
  holidays: HolidayRow[];
  /** Afwijkingen die een gewone werkdag sluiten. */
  extraClosures: ClosureOverride[];
}

/** Overzicht voor het beheerscherm Sluitingsdagen: feestdagen met per groep open/dicht, plus extra dagen. */
export function closureOverviewForYear(
  year: number,
  groups: readonly Group[],
  overrides: readonly ClosureOverride[],
): ClosureYearOverview {
  const resolve = createClosureResolver(overrides);
  const holidays = dutchHolidays(year).map((holiday) => ({
    date: holiday.date,
    name: holiday.name,
    closedByGroup: Object.fromEntries(groups.map((group) => [group.id, resolve(holiday.date, group.id).closed])),
  }));
  const holidayDates = new Set(holidays.map((holiday) => holiday.date));
  const extraClosures = overrides
    .filter((override) => override.isClosed && yearOf(override.date) === year && !holidayDates.has(override.date))
    .slice()
    .sort((a, b) => (a.date === b.date ? (a.groupId ?? '').localeCompare(b.groupId ?? '') : a.date < b.date ? -1 : 1));
  return { year, holidays, extraClosures };
}
