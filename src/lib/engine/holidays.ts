import { addDays, makeIsoDate, weekdayOf, yearOf } from './dates';
import type { IsoDate } from './types';

export interface Holiday {
  date: IsoDate;
  name: string;
}

/** Eerste paasdag volgens de gregoriaanse kalender (algoritme van Meeus/Jones/Butcher). */
export function easterSunday(year: number): IsoDate {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  const date = makeIsoDate(year, month, day);
  if (!date) throw new RangeError(`Geen paasdatum voor ${year}`);
  return date;
}

/** Koningsdag is 27 april, of zaterdag 26 april als 27 april op een zondag valt. */
export function kingsDay(year: number): IsoDate {
  const april27 = `${year}-04-27`;
  return weekdayOf(april27) === 7 ? `${year}-04-26` : april27;
}

/**
 * De vaste sluitingsdagen van een jaar, gesorteerd op datum.
 * Oudjaarsdag en Goede Vrijdag zijn gewone werkdagen en staan er bewust niet in.
 */
export function dutchHolidays(year: number): Holiday[] {
  const easter = easterSunday(year);
  const holidays: Holiday[] = [
    { date: `${year}-01-01`, name: 'Nieuwjaarsdag' },
    { date: easter, name: '1e paasdag' },
    { date: addDays(easter, 1), name: '2e paasdag' },
    { date: kingsDay(year), name: 'Koningsdag' },
    { date: `${year}-05-05`, name: 'Bevrijdingsdag' },
    { date: addDays(easter, 39), name: 'Hemelvaartsdag' },
    { date: addDays(easter, 49), name: '1e pinksterdag' },
    { date: addDays(easter, 50), name: '2e pinksterdag' },
    { date: `${year}-12-25`, name: '1e kerstdag' },
    { date: `${year}-12-26`, name: '2e kerstdag' },
  ];
  return holidays.sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : 0));
}

/** Snelle opzoektabel datum → naam, per jaar gecachet. */
export function createHolidayLookup(): (date: IsoDate) => string | null {
  const cache = new Map<number, Map<IsoDate, string>>();
  return (date) => {
    const year = yearOf(date);
    let byDate = cache.get(year);
    if (!byDate) {
      byDate = new Map(dutchHolidays(year).map((holiday) => [holiday.date, holiday.name]));
      cache.set(year, byDate);
    }
    return byDate.get(date) ?? null;
  };
}
