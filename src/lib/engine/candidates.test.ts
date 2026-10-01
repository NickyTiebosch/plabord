import { describe, expect, it } from 'vitest';
import { absence, employees, override, substitution, teamSnapshot } from './__fixtures__/team';
import { evaluateCandidates, PROPOSAL_COUNT } from './candidates';
import { createScheduleContext } from './schedule';
import { createNormLookup } from './staffing';
import type { DayPart, PlanningSnapshot } from './types';

const MON = '2026-10-12';
const TUE = '2026-10-13';

function evaluate(snapshot: PlanningSnapshot, date: string, groupId: string, dayParts: DayPart[] = ['morning', 'afternoon']) {
  return evaluateCandidates(createScheduleContext(snapshot), createNormLookup(snapshot.staffingNorms), snapshot.substitutions, {
    date,
    groupId,
    dayParts,
  });
}

// Lotte is maandag afwezig: Eindhoven heeft dan 1 van de 2.
const lotteAway = [absence('a1', 'lotte', MON)];

describe('kandidaten voor een inval', () => {
  it('staan in de volgorde backoffice, overig, andere vestiging, logistiek, met een uitleg', () => {
    const { candidates } = evaluate(teamSnapshot({ absences: lotteAway }), MON, 'eindhoven');
    expect(candidates.map((candidate) => candidate.name)).toEqual(['Danique', 'Hans', 'Sanne', 'Thijs']);
    expect(candidates.slice(0, PROPOSAL_COUNT).map((candidate) => candidate.explanation)).toEqual([
      'Danique (backoffice): werkt die dag en mag in Eindhoven invallen; 0× ingevallen in 90 dagen.',
      'Hans (overig): werkt die dag en mag in Eindhoven invallen; 0× ingevallen in 90 dagen.',
      'Sanne (balie Den Bosch): werkt die dag en mag in Eindhoven invallen; Den Bosch blijft op de norm; 0× ingevallen in 90 dagen.',
    ]);
  });

  it('zet binnen een groep wie het minst is ingevallen voorop, daarna op naam', () => {
    const snapshot = teamSnapshot({
      absences: lotteAway,
      substitutions: [substitution('s0', 'sanne', '2026-09-30', 'eindhoven')],
    });
    const names = evaluate(snapshot, MON, 'eindhoven').candidates.map((candidate) => candidate.name);
    expect(names).toEqual(['Danique', 'Hans', 'Thijs', 'Sanne']);
    const sanne = evaluate(snapshot, MON, 'eindhoven').candidates.find((candidate) => candidate.name === 'Sanne');
    expect(sanne?.explanation).toContain('1× ingevallen in 90 dagen');
  });

  it('geeft gelijkwaardige kandidaten altijd dezelfde volgorde, hoe de gegevens ook binnenkomen', () => {
    const reversed = teamSnapshot({ absences: lotteAway, employees: [...employees].reverse() });
    const shuffled = teamSnapshot({
      absences: lotteAway,
      employees: [...employees].sort((a, b) => (a.name.length - b.name.length) || (a.id < b.id ? 1 : -1)),
    });
    const expected = evaluate(teamSnapshot({ absences: lotteAway }), MON, 'eindhoven').candidates;
    expect(evaluate(reversed, MON, 'eindhoven').candidates).toEqual(expected);
    expect(evaluate(shuffled, MON, 'eindhoven').candidates).toEqual(expected);
  });

  it('stelt rol poets nooit voor', () => {
    // Ingrid mag in deze test in Eindhoven invallen en poetst maandag de hele dag.
    const snapshot = teamSnapshot({
      absences: lotteAway,
      employees: employees.map((employee) => (employee.id === 'ingrid' ? { ...employee, counterGroupIds: ['eindhoven'] } : employee)),
      shiftOverrides: [override('o1', 'ingrid', MON, { kind: 'shift', groupId: 'den_bosch', role: 'cleaning' })],
    });
    const result = evaluate(snapshot, MON, 'eindhoven');
    expect(result.candidates.map((candidate) => candidate.employeeId)).not.toContain('ingrid');
    expect(result.excluded.find((item) => item.employeeId === 'ingrid')?.reason).toBe('heeft die dag de rol poets');
  });

  it('laat iemand die niet inzetbaar is in die vestiging helemaal buiten beschouwing', () => {
    const result = evaluate(teamSnapshot({ absences: lotteAway }), MON, 'eindhoven');
    const everyone = [...result.candidates.map((item) => item.employeeId), ...result.excluded.map((item) => item.employeeId)];
    // Petra mag alleen in Den Bosch, Ruben en Wouter nergens.
    expect(everyone).not.toContain('petra');
    expect(everyone).not.toContain('ruben');
    expect(everyone).not.toContain('wouter');
  });

  it('neemt iemand uit een andere vestiging alleen als die vestiging op de norm blijft', () => {
    // Dinsdag: Lotte en Milan afwezig in Eindhoven. Breda heeft dinsdag precies 2 (Eva en Thijs).
    const snapshot = teamSnapshot({ absences: [absence('a1', 'lotte', TUE), absence('a2', 'milan', TUE)] });
    const result = evaluate(snapshot, TUE, 'eindhoven');
    expect(result.candidates.map((candidate) => candidate.name)).toEqual(['Danique', 'Hans', 'Sanne']);
    expect(result.excluded.find((item) => item.name === 'Thijs')?.reason).toBe(
      'Breda zakt dan onder de norm (ochtend en middag)',
    );
  });

  it('kijkt bij de normcheck alleen naar de dagdelen van de inval', () => {
    // Eva is dinsdagmiddag afwezig: Breda heeft 's middags maar 1. Thijs kan dan alleen 's ochtends niet weg.
    const snapshot = teamSnapshot({
      absences: [absence('a1', 'lotte', TUE), absence('a2', 'milan', TUE), absence('a3', 'eva', TUE, TUE, { dayPart: 'afternoon' })],
    });
    expect(evaluate(snapshot, TUE, 'eindhoven', ['afternoon']).excluded.find((item) => item.name === 'Thijs')?.reason).toBe(
      'Breda zakt dan onder de norm (middag)',
    );
  });

  it('slaat over wie afwezig is, al ingeleend is, niet de hele dag werkt of in dezelfde vestiging staat', () => {
    const snapshot = teamSnapshot({
      absences: [...lotteAway, absence('a2', 'hans', MON, MON, { dayPart: 'morning', status: 'requested' })],
      substitutions: [substitution('s1', 'danique', MON, 'breda', ['morning'])],
    });
    const result = evaluate(snapshot, MON, 'eindhoven');
    const reasons = Object.fromEntries(result.excluded.map((item) => [item.name, item.reason]));
    expect(reasons).toMatchObject({
      Hans: 'is die dag afwezig',
      Danique: 'valt die dag al ergens in',
      Daan: 'werkt die dag al in Eindhoven',
      Milan: 'werkt die dag niet',
      'Zoë': 'werkt die dag niet',
    });
    expect(result.candidates.map((candidate) => candidate.name)).toEqual(['Sanne', 'Thijs']);
  });

  it('volgt de groep en rol van die dag, ook bij een roosterwijziging', () => {
    // Gert (Logistiek, zonder vaste diensten) staat maandag door een wijziging in Breda aan de balie.
    const snapshot = teamSnapshot({
      absences: lotteAway,
      employees: employees.map((employee) => (employee.id === 'gert' ? { ...employee, counterGroupIds: ['eindhoven'] } : employee)),
      shiftOverrides: [override('o1', 'gert', MON, { kind: 'shift', groupId: 'breda', role: 'counter' })],
    });
    const gert = evaluate(snapshot, MON, 'eindhoven').candidates.find((candidate) => candidate.name === 'Gert');
    expect(gert).toMatchObject({ dayGroupId: 'breda', rank: 3, fromLocation: true });
    expect(gert?.explanation).toContain('Gert (balie Breda)');
  });

  it('heeft niemand als de eigen groep gesloten is', () => {
    expect(evaluate(teamSnapshot(), '2026-04-27', 'eindhoven').candidates).toEqual([]);
  });
});
