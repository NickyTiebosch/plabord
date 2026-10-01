import { describe, expect, it } from 'vitest';
import { groups } from '../engine/__fixtures__/team';
import {
  excelSerialToIsoDate,
  parseAbsencePart,
  parseCounterGroups,
  parseDateCell,
  parseEmail,
  parseGroup,
  parseRole,
  parseStatus,
  parseTimeCell,
  parseWeekday,
  parseYesNo,
} from './cells';

describe('datums', () => {
  it('leest echte Excel-datums (Date-cellen in UTC)', () => {
    expect(parseDateCell(new Date(Date.UTC(2026, 9, 14)))).toEqual({ ok: true, value: '2026-10-14' });
  });

  it('leest Excel-datumgetallen', () => {
    expect(excelSerialToIsoDate(44927)).toBe('2023-01-01');
    expect(excelSerialToIsoDate(45658)).toBe('2025-01-01');
    expect(parseDateCell(45658.75)).toEqual({ ok: true, value: '2025-01-01' });
  });

  it('leest d-m-jjjj, ook met enkele cijfers en andere scheidingstekens', () => {
    expect(parseDateCell('14-10-2026')).toEqual({ ok: true, value: '2026-10-14' });
    expect(parseDateCell('1-2-2026')).toEqual({ ok: true, value: '2026-02-01' });
    expect(parseDateCell('01/02/2026')).toEqual({ ok: true, value: '2026-02-01' });
    expect(parseDateCell('2026-10-14')).toEqual({ ok: true, value: '2026-10-14' });
  });

  it('meldt datums die niet bestaan of niet te lezen zijn', () => {
    expect(parseDateCell('31-2-2026').ok).toBe(false);
    expect(parseDateCell('morgen').ok).toBe(false);
    expect(parseDateCell(true).ok).toBe(false);
    expect(parseDateCell(new Date(Date.UTC(1899, 11, 30, 7, 30))).ok).toBe(false);
  });

  it('geeft null bij een lege cel', () => {
    expect(parseDateCell(null)).toEqual({ ok: true, value: null });
    expect(parseDateCell('  ')).toEqual({ ok: true, value: null });
  });
});

describe('tijden', () => {
  it('leest Excel-tijden, ook met afrondingsfouten', () => {
    expect(parseTimeCell(new Date(Date.UTC(1899, 11, 30, 7, 30)))).toEqual({ ok: true, value: '07:30' });
    expect(parseTimeCell(new Date(Date.UTC(1899, 11, 30, 7, 29, 59, 999)))).toEqual({ ok: true, value: '07:30' });
    expect(parseTimeCell(0.3125)).toEqual({ ok: true, value: '07:30' });
    expect(parseTimeCell(0.75)).toEqual({ ok: true, value: '18:00' });
  });

  it('leest uu:mm als tekst', () => {
    expect(parseTimeCell('7:30')).toEqual({ ok: true, value: '07:30' });
    expect(parseTimeCell('18.00')).toEqual({ ok: true, value: '18:00' });
    expect(parseTimeCell('25:00').ok).toBe(false);
    expect(parseTimeCell('')).toEqual({ ok: true, value: null });
  });
});

describe('keuzes', () => {
  it('leest ja en nee', () => {
    expect(parseYesNo('Ja')).toEqual({ ok: true, value: true });
    expect(parseYesNo('nee')).toEqual({ ok: true, value: false });
    expect(parseYesNo(true)).toEqual({ ok: true, value: true });
    expect(parseYesNo('')).toEqual({ ok: true, value: null });
    expect(parseYesNo('misschien').ok).toBe(false);
  });

  it('leest dagen van ma t/m za en weigert zondag', () => {
    expect(parseWeekday('ma')).toEqual({ ok: true, value: 1 });
    expect(parseWeekday('Zaterdag')).toEqual({ ok: true, value: 6 });
    expect(parseWeekday('zo')).toEqual({ ok: false, error: 'Op zondag zijn er geen vaste diensten.' });
  });

  it('leest rollen, dagdelen en statussen', () => {
    expect(parseRole('Balie')).toEqual({ ok: true, value: 'counter' });
    expect(parseRole('poets')).toEqual({ ok: true, value: 'cleaning' });
    expect(parseRole('geen rol')).toEqual({ ok: true, value: 'none' });
    expect(parseRole('kok').ok).toBe(false);
    expect(parseAbsencePart('Hele dag')).toEqual({ ok: true, value: 'full_day' });
    expect(parseAbsencePart('middag')).toEqual({ ok: true, value: 'afternoon' });
    expect(parseStatus('Aangevraagd')).toEqual({ ok: true, value: 'requested' });
  });

  it('leest e-mailadressen in kleine letters, ook als hyperlink', () => {
    expect(parseEmail(' Sanne@Voorbeeld.NL ')).toEqual({ ok: true, value: 'sanne@voorbeeld.nl' });
    expect(parseEmail('mailto:sanne@voorbeeld.nl')).toEqual({ ok: true, value: 'sanne@voorbeeld.nl' });
    expect(parseEmail('sanne@')).toMatchObject({ ok: false });
  });

  it('herkent groepen zonder op hoofdletters of streepjes te letten', () => {
    expect(parseGroup('den bosch', groups)).toEqual({ ok: true, value: 'den_bosch' });
    expect(parseGroup('Den-Bosch', groups)).toEqual({ ok: true, value: 'den_bosch' });
    expect(parseGroup("'s-Hertogenbosch", groups)).toEqual({ ok: true, value: 'den_bosch' });
    expect(parseGroup('Overig', groups)).toEqual({ ok: true, value: 'other' });
    expect(parseGroup('Tilburg', groups).ok).toBe(false);
  });

  it('leest vestigingen gescheiden door komma’s en weigert groepen zonder balie', () => {
    expect(parseCounterGroups('Den Bosch, Breda', groups)).toEqual({ ok: true, value: ['breda', 'den_bosch'] });
    expect(parseCounterGroups('', groups)).toEqual({ ok: true, value: [] });
    expect(parseCounterGroups('Logistiek', groups)).toEqual({ ok: false, error: 'Logistiek heeft geen balie.' });
  });
});
