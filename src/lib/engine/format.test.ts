import { describe, expect, it } from 'vitest';
import { formatDateRange, formatDayLong, formatDayShort, formatMonthYear } from './format';
import { formatTimeRange, fromMinutes, parseTime, toMinutes } from './time';

describe('datumnotatie', () => {
  it('schrijft datums als "di 14 okt"', () => {
    expect(formatDayShort('2025-10-14')).toBe('di 14 okt');
    expect(formatDayShort('2026-03-02')).toBe('ma 2 mrt');
    expect(formatDayLong('2026-05-14')).toBe('donderdag 14 mei');
    expect(formatMonthYear('2026-10-01')).toBe('oktober 2026');
  });

  it('schrijft periodes kort', () => {
    expect(formatDateRange('2026-10-14', '2026-10-14')).toBe('wo 14 okt');
    expect(formatDateRange('2026-10-14', '2026-10-18')).toBe('14–18 okt');
    expect(formatDateRange('2026-10-28', '2026-11-03')).toBe('28 okt – 3 nov');
    expect(formatDateRange('2026-12-29', '2027-01-02')).toBe('29 dec 2026 – 2 jan 2027');
  });
});

describe('tijden', () => {
  it('leest tijden in verschillende schrijfwijzen als 24-uurs HH:MM', () => {
    expect(parseTime('7:30')).toBe('07:30');
    expect(parseTime('07:30')).toBe('07:30');
    expect(parseTime('07:30:00')).toBe('07:30');
    expect(parseTime('18.00')).toBe('18:00');
    expect(parseTime('24:00')).toBeNull();
    expect(parseTime('7:3')).toBeNull();
    expect(parseTime('half acht')).toBeNull();
  });

  it('rekent tussen tijden en minuten', () => {
    expect(toMinutes('13:00')).toBe(780);
    expect(fromMinutes(450)).toBe('07:30');
    expect(formatTimeRange('07:30', '18:00')).toBe('07:30–18:00');
  });
});
