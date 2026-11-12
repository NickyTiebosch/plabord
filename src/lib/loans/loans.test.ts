import { describe, expect, it } from 'vitest';
import { createClosureResolver } from '../engine/closures';
import { correctionChanges, parseCorrectionForm, parseHandOutForm, parseOdometer, parseReturnForm } from './forms';
import { formatPlate, normalizePlate, plateQuery } from './plates';
import {
  distance,
  formatLoanMoment,
  formatOdometer,
  isOverdue,
  loanDueDate,
  mobilityDayCheck,
  openLoanFor,
  recentWeekdays,
  reissueOptions,
  sortOpenLoans,
} from './status';
import { amsterdamInstant, endOfLocalDay, localMoment, startOfLocalDay } from './time';
import type { LoanGroup, VehicleLoan } from './types';

const closures = createClosureResolver([]);

/** Tijdstip in Nederlandse tijd, als in de database. */
function at(date: string, time: string): string {
  return amsterdamInstant(date, time).toISOString();
}

function loan(overrides: Partial<VehicleLoan> & { id: string }): VehicleLoan {
  return {
    groupId: 'den_bosch',
    plate: 'GHP39K',
    model: 'VW Polo',
    destination: 'mobility',
    handedTo: 'Mobiliteit',
    handedOutBy: 'sanne',
    handedOutAt: at('2026-11-10', '16:00'),
    odometerOut: null,
    returnedAt: null,
    returnedBy: null,
    odometerIn: null,
    wasUsed: null,
    note: null,
    returnNote: null,
    ...overrides,
  };
}

function form(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

describe('kentekens', () => {
  it('bewaart een kenteken zonder streepjes en in hoofdletters', () => {
    expect(normalizePlate('ghp-39-k')).toBe('GHP39K');
    expect(normalizePlate(' GHP 39 K ')).toBe('GHP39K');
    expect(normalizePlate('X–920–RV')).toBe('X920RV');
    expect(normalizePlate('D 123 ABC')).toBe('D123ABC');
  });

  it('weigert wat geen kenteken kan zijn', () => {
    expect(normalizePlate('')).toBeNull();
    expect(normalizePlate('G')).toBeNull();
    expect(normalizePlate('ABCDEFGHIJK')).toBeNull();
    expect(normalizePlate('AB-12-ÄÖ')).toBeNull();
    expect(normalizePlate('AB/12/CD')).toBeNull();
  });

  it('toont een Nederlands kenteken met streepjes', () => {
    expect(formatPlate('GHP39K')).toBe('GHP-39-K');
    expect(formatPlate('X920RV')).toBe('X-920-RV');
    expect(formatPlate('KPK66J')).toBe('KPK-66-J');
    expect(formatPlate('AB1234')).toBe('AB-12-34');
    expect(formatPlate('1234AB')).toBe('12-34-AB');
    expect(formatPlate('ABCD12')).toBe('AB-CD-12');
    expect(formatPlate('12ABCD')).toBe('12-AB-CD');
    expect(formatPlate('ABCDEF')).toBe('AB-CD-EF');
    // Andere lengtes, vaak buitenlands: zoals ze zijn.
    expect(formatPlate('D123ABC')).toBe('D123ABC');
  });

  it('zoekt ook op een deel van een kenteken', () => {
    expect(plateQuery('39-k')).toBe('39K');
    expect(plateQuery(' ghp ')).toBe('GHP');
  });
});

describe('Nederlandse tijd', () => {
  it('rekent datum en tijd om naar een tijdstip, in winter- en zomertijd', () => {
    expect(at('2026-11-12', '14:00')).toBe('2026-11-12T13:00:00.000Z');
    expect(at('2026-07-01', '14:00')).toBe('2026-07-01T12:00:00.000Z');
    expect(localMoment('2026-07-01T12:00:00.000Z')).toEqual({ date: '2026-07-01', time: '14:00' });
  });

  it('gaat goed in de nachten van de wisseling', () => {
    // 02:30 bestaat niet op 29 maart 2026; het tijdstip ligt dan binnen een uur ervan.
    const spring = amsterdamInstant('2026-03-29', '02:30').getTime();
    expect(Math.abs(spring - Date.parse('2026-03-29T01:30:00.000Z'))).toBeLessThanOrEqual(3_600_000);
    // 02:30 bestaat twee keer op 25 oktober 2026; het tijdstip is dan een van beide.
    expect(localMoment(at('2026-10-25', '02:30'))).toEqual({ date: '2026-10-25', time: '02:30' });
  });

  it('geeft het begin en einde van een dag in Nederlandse tijd', () => {
    expect(startOfLocalDay('2026-11-12')).toBe('2026-11-11T23:00:00.000Z');
    expect(endOfLocalDay('2026-11-12')).toBe('2026-11-12T23:00:00.000Z');
    expect(startOfLocalDay('2026-07-01')).toBe('2026-06-30T22:00:00.000Z');
  });
});

describe('te lang uit (V48)', () => {
  it('moet de volgende werkdag terug zijn; van vrijdag op maandag', () => {
    expect(loanDueDate(loan({ id: '1', handedOutAt: at('2026-11-10', '16:00') }), closures)).toBe('2026-11-11');
    expect(loanDueDate(loan({ id: '2', handedOutAt: at('2026-11-13', '17:30') }), closures)).toBe('2026-11-16');
    expect(loanDueDate(loan({ id: '3', handedOutAt: at('2026-11-14', '09:00') }), closures)).toBe('2026-11-16');
  });

  it('slaat sluitingsdagen over: op 24 december mee, op 28 december terug', () => {
    expect(loanDueDate(loan({ id: '4', handedOutAt: at('2026-12-24', '15:00') }), closures)).toBe('2026-12-28');
  });

  it('staat pas te lang uit na het einde van de werkdag', () => {
    const open = loan({ id: '5', handedOutAt: at('2026-11-10', '16:00') });
    expect(isOverdue(open, new Date(at('2026-11-11', '17:59')), closures, '18:00')).toBe(false);
    expect(isOverdue(open, new Date(at('2026-11-11', '18:00')), closures, '18:00')).toBe(true);
    expect(isOverdue(open, new Date(at('2026-11-12', '08:00')), closures, '18:00')).toBe(true);
    expect(isOverdue({ ...open, returnedAt: at('2026-11-12', '07:00') }, new Date(at('2026-11-13', '08:00')), closures, '18:00')).toBe(false);
  });
});

describe('lijsten', () => {
  const loans = [
    loan({ id: 'a', groupId: 'eindhoven', plate: 'AAA11A', handedOutAt: at('2026-11-12', '08:00') }),
    loan({ id: 'b', groupId: 'den_bosch', plate: 'BBB22B', handedOutAt: at('2026-11-12', '09:00') }),
    loan({ id: 'c', groupId: 'den_bosch', plate: 'CCC33C', handedOutAt: at('2026-11-11', '09:00') }),
  ];

  it('zet de eigen vestiging eerst, en daarin wat het langst uit staat', () => {
    expect(sortOpenLoans(loans, 'den_bosch').map((item) => item.id)).toEqual(['c', 'b', 'a']);
    expect(sortOpenLoans(loans, null).map((item) => item.id)).toEqual(['c', 'a', 'b']);
  });

  it('vindt de open uitleen van een kenteken', () => {
    expect(openLoanFor(loans, 'BBB22B')?.id).toBe('b');
    expect(openLoanFor(loans, 'ZZZ99Z')).toBeNull();
  });

  it('biedt de auto’s van de laatste 14 dagen opnieuw aan: elk één keer, niet wat nu uit staat', () => {
    const history = [
      loan({ id: '1', plate: 'GHP39K', handedOutAt: at('2026-11-02', '08:00'), returnedAt: at('2026-11-03', '08:00'), wasUsed: true }),
      loan({ id: '2', plate: 'GHP39K', handedOutAt: at('2026-11-10', '08:00'), returnedAt: at('2026-11-11', '08:00'), wasUsed: false, handedTo: 'Mobiliteit nacht' }),
      loan({ id: '3', plate: 'X920RV', handedOutAt: at('2026-11-09', '08:00'), returnedAt: at('2026-11-10', '08:00'), wasUsed: true }),
      loan({ id: '4', plate: 'OUD11A', handedOutAt: at('2026-10-20', '08:00'), returnedAt: at('2026-10-21', '08:00'), wasUsed: true }),
      loan({ id: '5', plate: 'EHV11A', groupId: 'eindhoven', handedOutAt: at('2026-11-10', '08:00'), returnedAt: at('2026-11-11', '08:00'), wasUsed: true }),
      loan({ id: '6', plate: 'UIT11A', handedOutAt: at('2026-11-08', '08:00'), returnedAt: at('2026-11-09', '08:00'), wasUsed: true }),
      loan({ id: '7', plate: 'UIT11A', groupId: 'breda', handedOutAt: at('2026-11-12', '08:00') }),
    ];
    expect(reissueOptions(history, 'den_bosch', '2026-11-12')).toEqual([
      { plate: 'GHP39K', model: 'VW Polo', destination: 'mobility', handedTo: 'Mobiliteit nacht' },
      { plate: 'X920RV', model: 'VW Polo', destination: 'mobility', handedTo: 'Mobiliteit' },
    ]);
  });
});

describe('controle op Mobiliteit (V48)', () => {
  const groups: LoanGroup[] = [
    { id: 'den_bosch', name: 'Den Bosch', mobilityPerDay: 2 },
    { id: 'eindhoven', name: 'Eindhoven', mobilityPerDay: 2 },
    { id: 'breda', name: 'Breda', mobilityPerDay: 0 },
  ];

  it('neemt de werkdagen tot en met vandaag', () => {
    expect(recentWeekdays('2026-11-12', 6)).toEqual(['2026-11-05', '2026-11-06', '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12']);
    expect(recentWeekdays('2026-11-15', 2)).toEqual(['2026-11-12', '2026-11-13']);
  });

  it('telt per vestiging per dag, vandaag nog open, een sluitingsdag telt niet', () => {
    const loans = [
      loan({ id: '1', handedOutAt: at('2026-11-10', '08:00') }),
      loan({ id: '2', plate: 'X920RV', handedOutAt: at('2026-11-10', '17:00') }),
      loan({ id: '3', plate: 'KPK66J', handedOutAt: at('2026-11-11', '08:00') }),
      loan({ id: '4', plate: 'T826HN', handedOutAt: at('2026-11-12', '08:00') }),
      loan({ id: '5', plate: 'V02KZD', destination: 'workshop_weekend', handedOutAt: at('2026-11-11', '09:00') }),
      loan({ id: '6', plate: 'V26JXD', groupId: 'eindhoven', handedOutAt: at('2026-11-11', '09:00') }),
    ];
    const closed = createClosureResolver([{ id: 'x', date: '2026-11-11', groupId: 'eindhoven', isClosed: true, label: 'Verbouwing' }]);
    const firstDates = new Map([
      ['den_bosch', '2026-10-01'],
      ['eindhoven', '2026-11-01'],
    ]);
    const rows = mobilityDayCheck(loans, groups, ['2026-11-10', '2026-11-11', '2026-11-12'], '2026-11-12', closed, firstDates);
    expect(rows.map((row) => row.groupId)).toEqual(['den_bosch', 'eindhoven']);
    expect(rows[0]?.cells.map((cell) => [cell.count, cell.state])).toEqual([
      [2, 'ok'],
      [1, 'short'],
      [1, 'pending'],
    ]);
    expect(rows[1]?.cells.map((cell) => [cell.count, cell.state])).toEqual([
      [0, 'short'],
      [1, 'closed'],
      [0, 'pending'],
    ]);
    expect(rows[0]?.cells[0]?.label).toBe('di 10 nov');
  });

  it('telt de dagen vóór de eerste uitleen van een vestiging niet mee', () => {
    const rows = mobilityDayCheck(
      [loan({ id: '1', handedOutAt: at('2026-11-11', '08:00') })],
      groups,
      ['2026-11-10', '2026-11-11', '2026-11-12'],
      '2026-11-12',
      closures,
      new Map([['den_bosch', '2026-11-11']]),
    );
    expect(rows.map((row) => row.cells.map((cell) => cell.state))).toEqual([
      ['before', 'short', 'pending'],
      ['before', 'before', 'before'],
    ]);
  });
});

describe('weergave', () => {
  it('schrijft een moment als vandaag, gisteren of met de dag', () => {
    expect(formatLoanMoment(at('2026-11-12', '16:30'), '2026-11-12')).toBe('vandaag 16:30');
    expect(formatLoanMoment(at('2026-11-11', '09:05'), '2026-11-12')).toBe('gisteren 09:05');
    expect(formatLoanMoment(at('2026-11-10', '09:05'), '2026-11-12')).toBe('di 10 nov 09:05');
  });

  it('schrijft kilometerstanden met punten en rekent de afstand uit', () => {
    expect(formatOdometer(45210)).toBe('45.210');
    expect(formatOdometer(1234567)).toBe('1.234.567');
    expect(formatOdometer(0)).toBe('0');
    expect(formatOdometer(null)).toBe('');
    expect(distance({ odometerOut: 45210, odometerIn: 45288 })).toBe(78);
    expect(distance({ odometerOut: null, odometerIn: 45288 })).toBeNull();
  });
});

describe('formulieren van de uitleen', () => {
  const now = new Date(at('2026-11-12', '14:00'));
  const groupIds = ['den_bosch', 'eindhoven', 'breda'];
  const valid = {
    groupId: 'den_bosch',
    plate: 'ghp-39-k',
    model: '  VW   Polo ',
    odometerOut: '45.210',
    date: '2026-11-12',
    time: '13:45',
    destination: 'mobility',
    handedTo: ' Mobiliteit ',
    note: '',
  };

  it('leest de kilometerstand met of zonder punten', () => {
    expect(parseOdometer('45.210')).toBe(45210);
    expect(parseOdometer('45 210')).toBe(45210);
    expect(parseOdometer('')).toBeNull();
    expect(parseOdometer('45,5')).toBe('invalid');
    expect(parseOdometer('3000000')).toBe('invalid');
  });

  it('leest een geldige aanmelding', () => {
    expect(parseHandOutForm(form(valid), { now, groupIds })).toEqual({
      ok: true,
      data: {
        groupId: 'den_bosch',
        plate: 'GHP39K',
        model: 'VW Polo',
        odometerOut: 45210,
        handedOutAt: '2026-11-12T12:45:00.000Z',
        destination: 'mobility',
        handedTo: 'Mobiliteit',
        note: null,
      },
    });
  });

  it('noemt per veld wat er mis is', () => {
    const result = parseHandOutForm(form({ ...valid, plate: 'G', model: '', destination: '', handedTo: '', groupId: 'logistics' }), {
      now,
      groupIds,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.state.fieldErrors ?? {}).sort()).toEqual(['destination', 'groupId', 'handedTo', 'model', 'plate']);
  });

  it('weigert een moment in de toekomst, maar laat vijf minuten speling', () => {
    expect(parseHandOutForm(form({ ...valid, time: '14:04' }), { now, groupIds }).ok).toBe(true);
    const later = parseHandOutForm(form({ ...valid, time: '15:00' }), { now, groupIds });
    expect(later.ok ? null : later.state.fieldErrors).toEqual({ date: 'Het moment van meegeven ligt in de toekomst.' });
  });

  it('controleert de retour tegen het meegeven', () => {
    const out = { handedOutAt: at('2026-11-12', '09:00'), odometerOut: 45210 };
    expect(parseReturnForm(form({ odometerIn: '45.288', date: '2026-11-12', time: '13:00', note: ' Pech onderweg ' }), { now, loan: out })).toEqual({
      ok: true,
      data: { odometerIn: 45288, returnedAt: '2026-11-12T12:00:00.000Z', note: 'Pech onderweg' },
    });
    const lower = parseReturnForm(form({ odometerIn: '45000', date: '2026-11-12', time: '13:00', note: '' }), { now, loan: out });
    expect(lower.ok ? null : Object.keys(lower.state.fieldErrors ?? {})).toEqual(['odometerIn']);
    const before = parseReturnForm(form({ odometerIn: '', date: '2026-11-12', time: '08:00', note: '' }), { now, loan: out });
    expect(before.ok ? null : Object.keys(before.state.fieldErrors ?? {})).toEqual(['date']);
  });

  it('vraagt bij corrigeren van een retour ook of de auto is ingezet', () => {
    const returned = { ...valid, returnDate: '2026-11-12', returnTime: '13:50', odometerIn: '', returnNote: '' };
    const missing = parseCorrectionForm(form(returned), { now, groupIds, returned: true });
    expect(missing.ok ? null : Object.keys(missing.state.fieldErrors ?? {})).toEqual(['wasUsed']);
    const ok = parseCorrectionForm(form({ ...returned, wasUsed: 'nee' }), { now, groupIds, returned: true });
    expect(ok.ok ? ok.data.return : null).toEqual({ returnedAt: '2026-11-12T12:50:00.000Z', odometerIn: null, wasUsed: false, note: null });
    const open = parseCorrectionForm(form(valid), { now, groupIds, returned: false });
    expect(open.ok ? open.data.return : 'fout').toBeNull();
  });

  it('slaat bij corrigeren alleen op wat echt verandert; seconden tellen niet', () => {
    const stored = loan({
      id: '1',
      handedOutAt: '2026-11-12T12:45:31.123Z',
      odometerOut: 45210,
      returnedAt: '2026-11-12T12:50:12.000Z',
      wasUsed: true,
    });
    const same = parseCorrectionForm(
      form({ ...valid, model: 'VW Polo', returnDate: '2026-11-12', returnTime: '13:50', odometerIn: '', wasUsed: 'ja', returnNote: '' }),
      { now, groupIds, returned: true },
    );
    expect(same.ok ? correctionChanges(stored, same.data) : null).toEqual({});
    const changed = parseCorrectionForm(
      form({ ...valid, model: 'VW Polo GTI', time: '13:40', returnDate: '2026-11-12', returnTime: '13:50', odometerIn: '45.300', wasUsed: 'nee', returnNote: '' }),
      { now, groupIds, returned: true },
    );
    expect(changed.ok ? correctionChanges(stored, changed.data) : null).toEqual({
      model: 'VW Polo GTI',
      handed_out_at: '2026-11-12T12:40:00.000Z',
      odometer_in: 45300,
      was_used: false,
    });
  });
});
