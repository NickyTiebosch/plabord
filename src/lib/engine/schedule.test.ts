import { describe, expect, it } from 'vitest';
import { absence, employees, override, recurringShifts, settings, shift, substitution, teamSnapshot } from './__fixtures__/team';
import {
  clipToDayParts,
  computePersonalSchedule,
  computeSchedule,
  createScheduleContext,
  effectiveShiftTimes,
  entryState,
  groupDay,
  overlappedDayParts,
  type ShiftEntry,
} from './schedule';
import type { PlanningSnapshot, Substitution } from './types';

// Week 42 van 2026: ma 12 t/m zo 18 oktober.
const MON = '2026-10-12';
const TUE = '2026-10-13';
const WED = '2026-10-14';
const SAT = '2026-10-17';

function entriesOn(snapshot: PlanningSnapshot, date: string): ShiftEntry[] {
  return computeSchedule(snapshot, date, date)[0]?.entries ?? [];
}

function entryOf(snapshot: PlanningSnapshot, date: string, employeeId: string): ShiftEntry | undefined {
  return entriesOn(snapshot, date).find((entry) => entry.employeeId === employeeId && entry.kind === 'regular');
}

function namesIn(snapshot: PlanningSnapshot, date: string, groupId: string): string[] {
  return entriesOn(snapshot, date)
    .filter((entry) => entry.groupId === groupId)
    .map((entry) => entry.employeeName);
}

describe('vaste diensten', () => {
  it('rekent het rooster per datum uit de vaste diensten', () => {
    expect(namesIn(teamSnapshot(), MON, 'den_bosch')).toEqual(['Bram', 'Ingrid', 'Joris', 'Sanne']);
    expect(namesIn(teamSnapshot(), WED, 'den_bosch')).toEqual(['Bram', 'Fleur', 'Ingrid', 'Joris', 'Sanne']);
  });

  it('houdt rekening met geldig vanaf en geldig tot', () => {
    const shifts = [
      ...recurringShifts.filter((s) => !(s.employeeId === 'sanne' && s.weekday === 1)),
      shift('sanne', 1, 'den_bosch', 'counter', { validTo: '2026-10-25' }),
      shift('sanne', 1, 'eindhoven', 'counter', { validFrom: '2026-10-26' }),
    ];
    const snapshot = teamSnapshot({ recurringShifts: shifts });
    expect(entryOf(snapshot, '2026-10-19', 'sanne')?.groupId).toBe('den_bosch');
    expect(entryOf(snapshot, '2026-10-26', 'sanne')?.groupId).toBe('eindhoven');
    // Vóór de eerste geldige datum is er geen dienst.
    expect(entryOf(snapshot, '2024-12-30', 'sanne')).toBeUndefined();
  });

  it('laat het verleden ongemoeid als er een nieuwe vaste dienst begint', () => {
    const before = computeSchedule(teamSnapshot(), '2026-09-01', '2026-10-25');
    const shifts = [
      ...recurringShifts.filter((s) => s.employeeId !== 'joris'),
      ...[1, 2, 3].map((weekday) =>
        shift('joris', weekday as 1 | 2 | 3, 'den_bosch', 'counter', { validTo: '2026-10-25' }),
      ),
      shift('joris', 4, 'breda', 'counter', { validFrom: '2026-10-26' }),
    ];
    const after = computeSchedule(teamSnapshot({ recurringShifts: shifts }), '2026-09-01', '2026-10-25');
    expect(after).toEqual(before);
  });

  it('vult lege tijden aan met de standaarddienst, per veld', () => {
    const base = { weekday: 2 as const };
    expect(effectiveShiftTimes({ ...base, startTime: null, endTime: null }, settings)).toEqual({
      start: '07:30',
      end: '18:00',
    });
    expect(effectiveShiftTimes({ ...base, startTime: '09:00', endTime: null }, settings)).toEqual({
      start: '09:00',
      end: '18:00',
    });
    const saturday = { ...settings, saturdayShift: { start: '08:00', end: '12:00' } };
    expect(effectiveShiftTimes({ weekday: 6, startTime: null, endTime: null }, saturday)).toEqual({
      start: '08:00',
      end: '12:00',
    });
  });

  it('plant iemand die alleen op zaterdag werkt alleen op zaterdag in', () => {
    const days = computePersonalSchedule(teamSnapshot(), 'zoe', MON, '2026-10-18');
    const worked = days.filter((day) => day.entries.length > 0).map((day) => day.date);
    expect(worked).toEqual([SAT]);
    expect(days.find((day) => day.date === SAT)?.entries[0]).toMatchObject({ start: '09:00', end: '13:00' });
  });

  it('zet iemand zonder vaste diensten niet in het rooster', () => {
    const all = computeSchedule(teamSnapshot(), MON, '2026-11-30');
    expect(all.some((day) => day.entries.some((entry) => entry.employeeId === 'gert'))).toBe(false);
  });

  it('laat een inactieve medewerker weg', () => {
    const inactive = employees.map((e) => (e.id === 'sanne' ? { ...e, isActive: false } : e));
    expect(entryOf(teamSnapshot({ employees: inactive }), MON, 'sanne')).toBeUndefined();
    expect(computePersonalSchedule(teamSnapshot({ employees: inactive }), 'sanne', MON, MON)[0]?.entries).toEqual([]);
  });
});

describe('groep en rol per dag', () => {
  it('zet Anouk di/do aan de balie in Den Bosch en wo/vr bij Logistiek', () => {
    const snapshot = teamSnapshot();
    expect(entryOf(snapshot, TUE, 'anouk')).toMatchObject({ groupId: 'den_bosch', role: 'counter' });
    expect(entryOf(snapshot, WED, 'anouk')).toMatchObject({ groupId: 'logistics', role: 'transport' });
    expect(namesIn(snapshot, TUE, 'den_bosch')).toContain('Anouk');
    expect(namesIn(snapshot, WED, 'den_bosch')).not.toContain('Anouk');
  });

  it('laat alleen de rol balie meetellen voor de bezetting', () => {
    const snapshot = teamSnapshot();
    expect(entryOf(snapshot, TUE, 'anouk')?.countsForCounter).toBe(true);
    expect(entryOf(snapshot, WED, 'anouk')?.countsForCounter).toBe(false);
    expect(entryOf(snapshot, MON, 'ingrid')?.countsForCounter).toBe(false);
    expect(entryOf(snapshot, MON, 'danique')?.countsForCounter).toBe(false);
    expect(entryOf(snapshot, MON, 'petra')?.countsForCounter).toBe(false);
    expect(entryOf(snapshot, MON, 'sanne')?.countsForCounter).toBe(true);
  });
});

describe('dagdelen', () => {
  it('leidt de dagdelen af uit de tijden, met de grens om 13:00', () => {
    expect(overlappedDayParts({ start: '07:30', end: '18:00' }, '13:00')).toEqual(['morning', 'afternoon']);
    expect(overlappedDayParts({ start: '07:30', end: '13:00' }, '13:00')).toEqual(['morning']);
    expect(overlappedDayParts({ start: '13:00', end: '18:00' }, '13:00')).toEqual(['afternoon']);
    expect(overlappedDayParts({ start: '12:00', end: '14:00' }, '13:00')).toEqual(['morning', 'afternoon']);
  });

  it('kort een dienst in tot de dagdelen waarin iemand werkt', () => {
    const times = { start: '07:30', end: '18:00' };
    expect(clipToDayParts(times, ['afternoon'], '13:00')).toEqual({ start: '13:00', end: '18:00' });
    expect(clipToDayParts(times, ['morning'], '13:00')).toEqual({ start: '07:30', end: '13:00' });
    expect(clipToDayParts(times, [], '13:00')).toBeNull();
  });
});

describe('afwezigheid', () => {
  it('telt een halve dag per dagdeel', () => {
    const snapshot = teamSnapshot({ absences: [absence('a1', 'sanne', WED, WED, { dayPart: 'morning' })] });
    const entry = entryOf(snapshot, WED, 'sanne');
    expect(entry).toMatchObject({
      absentParts: ['morning'],
      workingParts: ['afternoon'],
      working: { start: '13:00', end: '18:00' },
      countsForCounter: true,
    });
    expect(entry && entryState(entry)).toBe('partly_absent');
  });

  it('laat aangevraagd en goedgekeurd allebei als afwezig tellen', () => {
    const snapshot = teamSnapshot({
      absences: [
        absence('a1', 'joris', MON, MON, { status: 'requested' }),
        absence('a2', 'bram', MON, '2026-10-16', { status: 'approved' }),
      ],
    });
    for (const id of ['joris', 'bram']) {
      const entry = entryOf(snapshot, MON, id);
      expect(entry?.workingParts).toEqual([]);
      expect(entry?.countsForCounter).toBe(false);
      expect(entry && entryState(entry)).toBe('absent');
    }
    const context = createScheduleContext(snapshot);
    const day = computeSchedule(snapshot, MON, MON)[0];
    const view = day && groupDay(context, day, 'den_bosch');
    expect(view?.working.map((e) => e.employeeName)).toEqual(['Ingrid', 'Sanne']);
    expect(view?.absent.map((e) => e.employeeName)).toEqual(['Bram', 'Joris']);
  });

  it('toont eigen afwezigheid ook op een dag zonder dienst', () => {
    const snapshot = teamSnapshot({ absences: [absence('a1', 'gert', MON, WED)] });
    const days = computePersonalSchedule(snapshot, 'gert', MON, WED);
    expect(days.map((day) => day.absences.length)).toEqual([1, 1, 1]);
    expect(days.every((day) => day.entries.length === 0)).toBe(true);
  });
});

describe('sluitingsdagen', () => {
  it('geeft op een sluitingsdag geen werkende diensten', () => {
    const snapshot = teamSnapshot();
    const kingsDay = '2026-04-27';
    const entries = entriesOn(snapshot, kingsDay);
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.every((entry) => entry.closure?.name === 'Koningsdag' && entry.workingParts.length === 0)).toBe(
      true,
    );
    expect(entries.some((entry) => entry.countsForCounter)).toBe(false);
    const context = createScheduleContext(snapshot);
    const day = computeSchedule(snapshot, kingsDay, kingsDay)[0];
    const view = day && groupDay(context, day, 'eindhoven');
    expect(view?.closure?.name).toBe('Koningsdag');
    expect(view?.working).toEqual([]);
  });

  it('behandelt Oudjaarsdag als gewone werkdag', () => {
    const entries = entriesOn(teamSnapshot(), '2026-12-31');
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.every((entry) => entry.closure === null)).toBe(true);
  });

  it('volgt een afwijking per groep', () => {
    const snapshot = teamSnapshot({
      closureOverrides: [{ id: 'o1', date: '2026-05-25', groupId: 'logistics', isClosed: false, label: null }],
    });
    expect(entryOf(snapshot, '2026-05-25', 'ruben')?.closure).toBeNull();
    expect(entryOf(snapshot, '2026-05-25', 'sanne')?.closure?.closed).toBe(true);
  });
});

describe('invallen (voorbereiding fase 2)', () => {
  const substitution: Substitution = {
    id: 's1',
    employeeId: 'danique',
    date: WED,
    groupId: 'eindhoven',
    dayParts: ['afternoon'],
    status: 'active',
    handledAt: null,
    createdAt: '2026-10-01T10:00:00.000Z',
    updatedAt: '2026-10-01T10:00:00.000Z',
  };

  it('laat een inval meetellen op de nieuwe vestiging en niet bij de eigen groep', () => {
    const snapshot = teamSnapshot({ substitutions: [substitution] });
    const entries = entriesOn(snapshot, WED).filter((entry) => entry.employeeId === 'danique');
    const own = entries.find((entry) => entry.kind === 'regular');
    const lent = entries.find((entry) => entry.kind === 'substitution');
    expect(own).toMatchObject({ groupId: 'backoffice', lentOutParts: ['afternoon'], workingParts: ['morning'] });
    expect(lent).toMatchObject({
      groupId: 'eindhoven',
      role: 'counter',
      workingParts: ['afternoon'],
      working: { start: '13:00', end: '18:00' },
      countsForCounter: true,
    });
  });

  it('negeert invallen die niet meer nodig zijn', () => {
    const snapshot = teamSnapshot({ substitutions: [{ ...substitution, status: 'not_needed' }] });
    expect(entriesOn(snapshot, WED).filter((entry) => entry.employeeId === 'danique')).toHaveLength(1);
  });
});

describe('determinisme', () => {
  it('geeft bij dezelfde gegevens in een andere volgorde precies hetzelfde rooster', () => {
    const absences = [absence('a1', 'sanne', WED, WED, { dayPart: 'afternoon' }), absence('a2', 'eva', MON, TUE)];
    const normal = computeSchedule(teamSnapshot({ absences }), MON, '2026-10-24');
    const shuffled = computeSchedule(
      teamSnapshot({
        absences: [...absences].reverse(),
        employees: [...employees].reverse(),
        recurringShifts: [...recurringShifts].reverse(),
      }),
      MON,
      '2026-10-24',
    );
    expect(shuffled).toEqual(normal);
  });
});

describe('roosterwijzigingen voor één dag (fase 2)', () => {
  it('geen dienst: de vaste dienst vervalt alleen die dag', () => {
    const snapshot = teamSnapshot({ shiftOverrides: [override('o1', 'joris', MON, { kind: 'off' })] });
    expect(entryOf(snapshot, MON, 'joris')).toBeUndefined();
    expect(entryOf(snapshot, TUE, 'joris')?.groupId).toBe('den_bosch');
    const context = createScheduleContext(snapshot);
    expect(context.daysOffOn(MON)).toEqual([
      { date: MON, employeeId: 'joris', employeeName: 'Joris', groupId: 'den_bosch', overrideId: 'o1' },
    ]);
    const personal = computePersonalSchedule(snapshot, 'joris', MON, TUE);
    expect(personal.map((day) => day.dayOff)).toEqual([true, false]);
  });

  it('een andere dienst vervangt de vaste dienst, en is gemarkeerd als gewijzigd', () => {
    const snapshot = teamSnapshot({
      shiftOverrides: [override('o1', 'sanne', MON, { kind: 'shift', groupId: 'eindhoven', role: 'counter', startTime: '09:00' })],
    });
    const entry = entryOf(snapshot, MON, 'sanne');
    expect(entry).toMatchObject({ groupId: 'eindhoven', role: 'counter', start: '09:00', end: '18:00', changed: true, sourceId: 'o1' });
    expect(entryOf(snapshot, TUE, 'sanne')).toMatchObject({ groupId: 'den_bosch', changed: false });
  });

  it('een dienst op een dag zonder vaste dienst komt erbij, met de standaardtijden van die dag', () => {
    const snapshot = teamSnapshot({
      shiftOverrides: [
        override('o1', 'joris', '2026-10-16', { kind: 'shift', groupId: 'den_bosch', role: 'counter' }),
        override('o2', 'gert', SAT, { kind: 'shift', groupId: 'eindhoven', role: 'counter' }),
      ],
    });
    expect(entryOf(snapshot, '2026-10-16', 'joris')).toMatchObject({ start: '07:30', end: '18:00', changed: true });
    expect(entryOf(snapshot, SAT, 'gert')).toMatchObject({ groupId: 'eindhoven', countsForCounter: true });
  });

  it('negeert wijzigingen van inactieve medewerkers', () => {
    const inactive = employees.map((employee) => (employee.id === 'gert' ? { ...employee, isActive: false } : employee));
    const snapshot = teamSnapshot({
      employees: inactive,
      shiftOverrides: [override('o1', 'gert', MON, { kind: 'shift', groupId: 'den_bosch', role: 'counter' })],
    });
    expect(entryOf(snapshot, MON, 'gert')).toBeUndefined();
  });

  it('een inval op een dag zonder dienst blijft zichtbaar, zodat de controle hem kan vinden', () => {
    const snapshot = teamSnapshot({
      shiftOverrides: [override('o1', 'danique', WED, { kind: 'off' })],
      substitutions: [substitution('s1', 'danique', WED, 'eindhoven')],
    });
    const entries = entriesOn(snapshot, WED).filter((entry) => entry.employeeId === 'danique');
    expect(entries.map((entry) => entry.kind)).toEqual(['substitution']);
  });
});
