import { describe, expect, it } from 'vitest';
import { addDays, weekdayOf } from './dates';
import { dutchHolidays, easterSunday, kingsDay } from './holidays';

describe('easterSunday', () => {
  it.each([
    [2008, '2008-03-23'],
    [2011, '2011-04-24'],
    [2019, '2019-04-21'],
    [2024, '2024-03-31'],
    [2025, '2025-04-20'],
    [2026, '2026-04-05'],
    [2027, '2027-03-28'],
    [2028, '2028-04-16'],
    [2029, '2029-04-01'],
    [2030, '2030-04-21'],
    [2038, '2038-04-25'],
  ])('Pasen %i valt op %s', (year, expected) => {
    expect(easterSunday(year)).toBe(expected);
  });

  it('valt altijd op een zondag', () => {
    for (let year = 2000; year <= 2100; year++) expect(weekdayOf(easterSunday(year))).toBe(7);
  });
});

describe('kingsDay', () => {
  it('is 27 april, of 26 april als 27 april een zondag is', () => {
    expect(kingsDay(2026)).toBe('2026-04-27');
    expect(kingsDay(2025)).toBe('2025-04-26');
    expect(kingsDay(2031)).toBe('2031-04-26');
  });
});

describe('dutchHolidays', () => {
  it('geeft de tien sluitingsdagen van 2026', () => {
    expect(dutchHolidays(2026)).toEqual([
      { date: '2026-01-01', name: 'Nieuwjaarsdag' },
      { date: '2026-04-05', name: '1e paasdag' },
      { date: '2026-04-06', name: '2e paasdag' },
      { date: '2026-04-27', name: 'Koningsdag' },
      { date: '2026-05-05', name: 'Bevrijdingsdag' },
      { date: '2026-05-14', name: 'Hemelvaartsdag' },
      { date: '2026-05-24', name: '1e pinksterdag' },
      { date: '2026-05-25', name: '2e pinksterdag' },
      { date: '2026-12-25', name: '1e kerstdag' },
      { date: '2026-12-26', name: '2e kerstdag' },
    ]);
  });

  it('rekent Hemelvaart en Pinksteren vanaf Pasen', () => {
    for (let year = 2020; year <= 2040; year++) {
      const holidays = dutchHolidays(year);
      const easter = easterSunday(year);
      const byName = new Map(holidays.map((holiday) => [holiday.name, holiday.date]));
      expect(byName.get('Hemelvaartsdag')).toBe(addDays(easter, 39));
      expect(weekdayOf(byName.get('Hemelvaartsdag') ?? '')).toBe(4);
      expect(byName.get('2e pinksterdag')).toBe(addDays(easter, 50));
      expect(weekdayOf(byName.get('2e pinksterdag') ?? '')).toBe(1);
    }
  });

  it('laat Oudjaarsdag en Goede Vrijdag weg', () => {
    const dates = dutchHolidays(2026).map((holiday) => holiday.date);
    expect(dates).not.toContain('2026-12-31');
    expect(dates).not.toContain('2026-04-03');
  });
});
