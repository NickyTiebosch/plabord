import { describe, expect, it } from 'vitest';
import { absence, employees, override, settings, staffingNorms, substitution, teamSnapshot } from './__fixtures__/team';
import { createScheduleContext } from './schedule';
import { planSelfCover, type SelfCoverRequest } from './self-cover';
import { createNormLookup } from './staffing';
import type { DayPart, PlanningSnapshot } from './types';

// Week 42 van 2026: ma 12 t/m za 17 oktober.
const MON = '2026-10-12';
const TUE = '2026-10-13';
const SAT = '2026-10-17';
const BOTH: DayPart[] = ['morning', 'afternoon'];

function plan(snapshot: PlanningSnapshot, request: Partial<SelfCoverRequest> & Pick<SelfCoverRequest, 'employeeId'>) {
  return planSelfCover(createScheduleContext(snapshot), createNormLookup(snapshot.staffingNorms), {
    date: MON,
    groupId: 'eindhoven',
    dayParts: BOTH,
    today: MON,
    ...request,
  });
}

// Maandag zonder Lotte: Eindhoven heeft alleen Daan.
const lotteAway = [absence('a1', 'lotte', MON)];

describe('zelf inspringen (V40)', () => {
  it('geeft een nieuwe dienst als je die dag niet ingeroosterd bent, met de standaardtijden', () => {
    // Wouter werkt ma/wo/vr; dinsdag zijn Lotte en Milan afwezig.
    const snapshot = teamSnapshot({ absences: [absence('a1', 'lotte', TUE), absence('a2', 'milan', TUE)] });
    expect(plan(snapshot, { employeeId: 'wouter', date: TUE, today: TUE })).toEqual({
      ok: true,
      mode: 'new',
      groupId: 'eindhoven',
      dayParts: BOTH,
      times: { start: '07:30', end: '18:00' },
      stored: { startTime: null, endTime: null },
      current: { kind: 'none' },
      source: null,
      key: 'new|none|eindhoven|morning+afternoon|07:30-18:00|-',
    });
  });

  it('geeft ook een nieuwe dienst als je die dag op geen dienst stond', () => {
    const snapshot = teamSnapshot({ absences: lotteAway, shiftOverrides: [override('o1', 'wouter', MON, { kind: 'off' })] });
    expect(plan(snapshot, { employeeId: 'wouter' })).toMatchObject({ ok: true, mode: 'new', current: { kind: 'off' } });
  });

  it('vervangt een dienst elders, alleen voor de dagdelen van het gat, met de tijden erbij', () => {
    const result = plan(teamSnapshot({ absences: lotteAway }), { employeeId: 'wouter', dayParts: ['afternoon'] });
    expect(result).toMatchObject({
      ok: true,
      mode: 'replace',
      dayParts: ['afternoon'],
      times: { start: '13:00', end: '18:00' },
      stored: { startTime: '13:00', endTime: '18:00' },
      current: { kind: 'shift', groupId: 'other', role: 'none', times: { start: '07:30', end: '18:00' } },
      source: null,
    });
  });

  it('noemt de balie waar je vandaan komt, en of die onder de norm zakt', () => {
    // Bram staat maandag aan de balie in Den Bosch, met Sanne en Joris.
    expect(plan(teamSnapshot({ absences: lotteAway }), { employeeId: 'bram' })).toMatchObject({
      ok: true,
      mode: 'replace',
      source: { groupId: 'den_bosch', shortfall: [] },
    });
    // Zonder Joris blijft er in Den Bosch zonder Bram maar één over.
    const tight = teamSnapshot({ absences: [...lotteAway, absence('a2', 'joris', MON)] });
    const result = plan(tight, { employeeId: 'bram' });
    expect(result).toMatchObject({
      ok: true,
      source: {
        groupId: 'den_bosch',
        shortfall: [
          { dayPart: 'morning', count: 1, norm: 2, shortage: 1 },
          { dayPart: 'afternoon', count: 1, norm: 2, shortage: 1 },
        ],
      },
    });
    expect(result.ok && result.key).toBe(
      'replace|den_bosch:counter:07:30-18:00|eindhoven|morning+afternoon|07:30-18:00|den_bosch:morning:1/2,afternoon:1/2',
    );
  });

  it('maakt je dienst langer als je al aan dezelfde balie staat, maar in een ander dagdeel', () => {
    // Joris staat maandag alleen 's ochtends in Den Bosch; Bram is 's middags afwezig. Gat: de middag.
    const snapshot = teamSnapshot({
      absences: [absence('a1', 'bram', MON, MON, { dayPart: 'afternoon' })],
      shiftOverrides: [override('o1', 'joris', MON, { kind: 'shift', groupId: 'den_bosch', role: 'counter', startTime: '07:30', endTime: '13:00' })],
    });
    expect(plan(snapshot, { employeeId: 'joris', groupId: 'den_bosch', dayParts: ['afternoon'] })).toMatchObject({
      ok: true,
      mode: 'extend',
      times: { start: '07:30', end: '18:00' },
      // Gelijk aan de standaarddienst: dan slaan we geen tijden op.
      stored: { startTime: null, endTime: null },
      current: { kind: 'shift', groupId: 'den_bosch', role: 'counter', times: { start: '07:30', end: '13:00' } },
      source: null,
    });
    // Sanne staat 's middags al aan die balie.
    expect(plan(snapshot, { employeeId: 'sanne', groupId: 'den_bosch', dayParts: ['afternoon'] })).toEqual({
      ok: false,
      code: 'already_there',
      dayParts: ['afternoon'],
      groupId: null,
    });
  });

  it('kan niet als je in een dagdeel van het gat afwezig bent, ook als het is aangevraagd', () => {
    const snapshot = teamSnapshot({
      absences: [...lotteAway, absence('a2', 'wouter', MON, MON, { dayPart: 'afternoon', status: 'requested' })],
    });
    expect(plan(snapshot, { employeeId: 'wouter' })).toEqual({ ok: false, code: 'absent', dayParts: ['afternoon'], groupId: null });
    expect(plan(snapshot, { employeeId: 'wouter', dayParts: ['morning'] })).toMatchObject({ ok: true, mode: 'replace' });
  });

  it('kan niet als je die dag al ergens invalt', () => {
    const snapshot = teamSnapshot({ absences: lotteAway, substitutions: [substitution('s1', 'danique', MON, 'breda', ['morning'])] });
    expect(plan(snapshot, { employeeId: 'danique' })).toEqual({ ok: false, code: 'substituting', dayParts: [], groupId: 'breda' });
  });

  it('kan niet op een voorbije dag, zonder gat, of buiten een vestiging', () => {
    const snapshot = teamSnapshot({ absences: lotteAway });
    expect(plan(snapshot, { employeeId: 'wouter', today: TUE })).toMatchObject({ ok: false, code: 'past' });
    expect(plan(snapshot, { employeeId: 'wouter', groupId: 'other' })).toMatchObject({ ok: false, code: 'no_counter' });
    expect(plan(teamSnapshot(), { employeeId: 'wouter' })).toMatchObject({ ok: false, code: 'no_gap' });
    expect(plan(snapshot, { employeeId: 'wouter', dayParts: [] })).toMatchObject({ ok: false, code: 'no_gap' });
    // Koningsdag: dicht, dus geen gat.
    expect(plan(snapshot, { employeeId: 'wouter', date: '2026-04-27', today: '2026-04-01' })).toMatchObject({ ok: false, code: 'no_gap' });
  });

  it('kan niet voor een inactieve medewerker', () => {
    const snapshot = teamSnapshot({
      absences: lotteAway,
      employees: employees.map((employee) => (employee.id === 'wouter' ? { ...employee, isActive: false } : employee)),
    });
    expect(plan(snapshot, { employeeId: 'wouter' })).toMatchObject({ ok: false, code: 'inactive' });
  });

  it('kan niet als de standaarddienst niet in het dagdeel valt', () => {
    // Zaterdag met een norm van 2 en een zaterdagdienst vanaf 13:30: er is geen ochtend.
    const snapshot: PlanningSnapshot = {
      ...teamSnapshot({
        staffingNorms: staffingNorms.map((norm) => (norm.weekday === 6 && norm.groupId === 'eindhoven' ? { ...norm, minStaff: 2 } : norm)),
      }),
      settings: { ...settings, saturdayShift: { start: '13:30', end: '18:00' } },
    };
    expect(plan(snapshot, { employeeId: 'wouter', date: SAT, dayParts: ['morning'] })).toEqual({
      ok: false,
      code: 'no_times',
      dayParts: ['morning'],
      groupId: null,
    });
  });

  it('heeft een andere sleutel als je rooster van die dag verandert', () => {
    const before = plan(teamSnapshot({ absences: lotteAway }), { employeeId: 'wouter' });
    const after = plan(
      teamSnapshot({
        absences: lotteAway,
        shiftOverrides: [override('o1', 'wouter', MON, { kind: 'shift', groupId: 'other', role: 'none', startTime: '09:00', endTime: '17:00' })],
      }),
      { employeeId: 'wouter' },
    );
    expect(before.ok && after.ok && before.key !== after.key).toBe(true);
  });
});
