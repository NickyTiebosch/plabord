import { describe, expect, it } from 'vitest';
import {
  addDays,
  addMonths,
  amsterdamDateTime,
  daysBetween,
  eachDay,
  endOfMonth,
  isIsoDate,
  isoWeekKey,
  isoWeekOf,
  isWithin,
  makeIsoDate,
  mondayOfIsoWeekKey,
  rangesOverlap,
  startOfIsoWeek,
  startOfQuarter,
  todayInAmsterdam,
  weekdayOf,
} from './dates';

describe('isIsoDate en makeIsoDate', () => {
  it('accepteert alleen bestaande datums in YYYY-MM-DD', () => {
    expect(isIsoDate('2026-10-14')).toBe(true);
    expect(isIsoDate('2028-02-29')).toBe(true);
    expect(isIsoDate('2026-02-29')).toBe(false);
    expect(isIsoDate('2026-13-01')).toBe(false);
    expect(isIsoDate('2026-1-1')).toBe(false);
    expect(isIsoDate('14-10-2026')).toBe(false);
    expect(isIsoDate(null)).toBe(false);
  });

  it('maakt geen datum die niet bestaat', () => {
    expect(makeIsoDate(2026, 2, 31)).toBeNull();
    expect(makeIsoDate(2026, 10, 4)).toBe('2026-10-04');
  });
});

describe('rekenen met datums', () => {
  it('telt dagen op over maand- en jaargrenzen heen', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    // De wissel naar zomertijd (29 maart 2026) verandert niets aan kalenderdagen.
    expect(addDays('2026-03-28', 2)).toBe('2026-03-30');
    expect(daysBetween('2026-01-01', '2026-12-31')).toBe(364);
  });

  it('kent de weekdagen (1 = maandag, 7 = zondag)', () => {
    expect(weekdayOf('2025-10-14')).toBe(2);
    expect(weekdayOf('2026-01-01')).toBe(4);
    expect(weekdayOf('2026-10-04')).toBe(7);
  });

  it('bepaalt ISO-weken, ook rond de jaarwisseling', () => {
    expect(isoWeekKey('2026-01-01')).toBe('2026-W01');
    expect(isoWeekKey('2027-01-01')).toBe('2026-W53');
    expect(isoWeekKey('2024-12-30')).toBe('2025-W01');
    expect(isoWeekOf('2026-10-14')).toEqual({ year: 2026, week: 42 });
    expect(startOfIsoWeek('2026-10-18')).toBe('2026-10-12');
  });

  it('zet een weeksleutel om naar de maandag van die week', () => {
    expect(mondayOfIsoWeekKey('2026-W42')).toBe('2026-10-12');
    expect(mondayOfIsoWeekKey('2026-W53')).toBe('2026-12-28');
    expect(mondayOfIsoWeekKey('2027-W53')).toBeNull();
    expect(mondayOfIsoWeekKey('2026-42')).toBeNull();
  });

  it('geeft alle dagen van een periode', () => {
    expect(eachDay('2026-10-12', '2026-10-14')).toEqual(['2026-10-12', '2026-10-13', '2026-10-14']);
    expect(eachDay('2026-10-14', '2026-10-12')).toEqual([]);
  });

  it('vergelijkt periodes met een open einde', () => {
    expect(isWithin('2030-01-01', '2026-01-01', null)).toBe(true);
    expect(isWithin('2025-12-31', '2026-01-01', null)).toBe(false);
    expect(rangesOverlap('2026-01-01', '2026-01-31', '2026-01-31', null)).toBe(true);
    expect(rangesOverlap('2026-01-01', '2026-01-31', '2026-02-01', '2026-02-02')).toBe(false);
  });

  it('rekent met maanden en kwartalen', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2026-11-15', 3)).toBe('2027-02-15');
    expect(addMonths('2026-01-15', -1)).toBe('2025-12-15');
    expect(endOfMonth('2028-02-10')).toBe('2028-02-29');
    expect(startOfQuarter('2026-11-20')).toBe('2026-10-01');
  });
});

describe('todayInAmsterdam', () => {
  it('rekent in Europe/Amsterdam, niet in UTC', () => {
    // 22:30 UTC in de zomer is 00:30 de volgende dag in Amsterdam.
    expect(todayInAmsterdam(new Date('2026-06-14T22:30:00Z'))).toBe('2026-06-15');
    // 23:30 UTC in de winter is 00:30 de volgende dag.
    expect(todayInAmsterdam(new Date('2026-01-14T23:30:00Z'))).toBe('2026-01-15');
    // Na de wissel naar wintertijd (25 okt 2026, 01:00 UTC) is het verschil één uur.
    expect(todayInAmsterdam(new Date('2026-10-25T22:30:00Z'))).toBe('2026-10-25');
    expect(todayInAmsterdam(new Date('2026-10-24T22:30:00Z'))).toBe('2026-10-25');
  });
});

describe('amsterdamDateTime', () => {
  it('geeft datum en 24-uurstijd in Europe/Amsterdam', () => {
    expect(amsterdamDateTime(new Date('2026-01-14T23:30:00Z'))).toEqual({ date: '2026-01-15', time: '00:30' });
    expect(amsterdamDateTime(new Date('2026-06-15T05:07:00Z'))).toEqual({ date: '2026-06-15', time: '07:07' });
    // Tijdens de wissel naar wintertijd komt 02:30 twee keer voor.
    expect(amsterdamDateTime(new Date('2026-10-25T00:30:00Z'))).toEqual({ date: '2026-10-25', time: '02:30' });
    expect(amsterdamDateTime(new Date('2026-10-25T01:30:00Z'))).toEqual({ date: '2026-10-25', time: '02:30' });
  });
});
