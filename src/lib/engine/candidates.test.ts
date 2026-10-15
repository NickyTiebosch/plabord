import { describe, expect, it } from 'vitest';
import { absence, employees, override, substitution, teamSnapshot } from './__fixtures__/team';
import { assignmentDecision, evaluateCandidates, PROPOSAL_COUNT, shortfallKey } from './candidates';
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

  it('stelt rol hiker/buitendienst nooit voor', () => {
    // Ingrid mag in deze test in Eindhoven invallen en is maandag de hele dag hiker/buitendienst.
    const snapshot = teamSnapshot({
      absences: lotteAway,
      employees: employees.map((employee) => (employee.id === 'ingrid' ? { ...employee, counterGroupIds: ['eindhoven'] } : employee)),
      shiftOverrides: [override('o1', 'ingrid', MON, { kind: 'shift', groupId: 'den_bosch', role: 'cleaning' })],
    });
    const result = evaluate(snapshot, MON, 'eindhoven');
    expect(result.candidates.map((candidate) => candidate.employeeId)).not.toContain('ingrid');
    expect(result.excluded.find((item) => item.employeeId === 'ingrid')?.reason).toBe('heeft die dag de rol hiker/buitendienst');
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

describe('schuiven: wie alleen afvalt op de norm van de eigen vestiging (V40)', () => {
  // Maandag: Lotte, Joris, Danique, Hans en Yara afwezig. Eindhoven heeft alleen Daan;
  // Den Bosch (Sanne en Bram) en Breda (Eva en Thijs) zitten precies op de norm.
  const tight = teamSnapshot({
    absences: ['lotte', 'joris', 'danique', 'hans', 'yara'].map((id, index) => absence(`a${index}`, id, MON)),
  });

  it('staan apart, met de vestiging die dan onder de norm zakt en een uitleg', () => {
    const result = evaluate(tight, MON, 'eindhoven');
    expect(result.candidates).toEqual([]);
    expect(result.shortfallCandidates.map((item) => [item.name, item.sourceGroupId])).toEqual([
      ['Sanne', 'den_bosch'],
      ['Thijs', 'breda'],
    ]);
    expect(result.shortfallCandidates[0]?.shortfall).toEqual([
      { dayPart: 'morning', count: 1, norm: 2, shortage: 1 },
      { dayPart: 'afternoon', count: 1, norm: 2, shortage: 1 },
    ]);
    expect(result.shortfallCandidates[0]?.explanation).toBe(
      'Sanne (balie Den Bosch): werkt die dag en mag in Eindhoven invallen, maar Den Bosch zakt dan onder de norm (ochtend en middag); 0× ingevallen in 90 dagen.',
    );
    // Ze staan ook nog bij wie afvalt, met dezelfde reden als altijd.
    expect(result.excluded.find((item) => item.name === 'Sanne')?.reason).toBe('Den Bosch zakt dan onder de norm (ochtend en middag)');
  });

  it('neemt alleen de dagdelen van de inval mee', () => {
    const sanne = evaluate(tight, MON, 'eindhoven', ['afternoon']).shortfallCandidates.find((item) => item.name === 'Sanne');
    expect(sanne?.shortfall).toEqual([{ dayPart: 'afternoon', count: 1, norm: 2, shortage: 1 }]);
    expect(sanne?.explanation).toContain('Den Bosch zakt dan onder de norm (middag)');
  });

  it('laat wie om een andere reden afvalt erbuiten', () => {
    const ids = evaluate(tight, MON, 'eindhoven').shortfallCandidates.map((item) => item.employeeId);
    // Danique en Hans zijn afwezig, Daan werkt al in Eindhoven, Zoë werkt die dag niet.
    for (const id of ['danique', 'hans', 'daan', 'zoe']) expect(ids).not.toContain(id);
  });

  it('heeft een sleutel met de vestiging en de bezetting zonder hem', () => {
    const sanne = evaluate(tight, MON, 'eindhoven').shortfallCandidates[0];
    expect(sanne && shortfallKey(sanne)).toBe('den_bosch|morning:1/2,afternoon:1/2');
  });
});

describe('mag deze inval worden opgeslagen (V40)', () => {
  const tight = teamSnapshot({
    absences: ['lotte', 'joris', 'danique', 'hans', 'yara'].map((id, index) => absence(`a${index}`, id, MON)),
  });

  it('een gewone kandidaat altijd, ook met een sleutel', () => {
    const result = evaluate(teamSnapshot({ absences: lotteAway }), MON, 'eindhoven');
    expect(assignmentDecision(result, 'danique', null)).toEqual({ kind: 'candidate' });
    // Was Sanne onder Schuiven, maar blijft Den Bosch intussen op de norm, dan is het een gewone inval.
    expect(assignmentDecision(result, 'sanne', 'den_bosch|morning:1/2,afternoon:1/2')).toEqual({ kind: 'candidate' });
  });

  it('iemand onder Schuiven alleen met de sleutel van wat de beheerder zag', () => {
    const result = evaluate(tight, MON, 'eindhoven');
    expect(assignmentDecision(result, 'sanne', 'den_bosch|morning:1/2,afternoon:1/2')).toEqual({
      kind: 'move',
      sourceGroupId: 'den_bosch',
      shortfall: [
        { dayPart: 'morning', count: 1, norm: 2, shortage: 1 },
        { dayPart: 'afternoon', count: 1, norm: 2, shortage: 1 },
      ],
    });
    expect(assignmentDecision(result, 'sanne', null)).toEqual({ kind: 'invalid' });
    expect(assignmentDecision(result, 'sanne', 'den_bosch|morning:0/2,afternoon:0/2')).toEqual({ kind: 'invalid' });
    expect(assignmentDecision(result, 'sanne', 'breda|morning:1/2,afternoon:1/2')).toEqual({ kind: 'invalid' });
  });

  it('nooit iemand die om een andere reden afvalt', () => {
    const result = evaluate(tight, MON, 'eindhoven');
    expect(assignmentDecision(result, 'hans', 'den_bosch|morning:1/2,afternoon:1/2')).toEqual({ kind: 'invalid' });
    expect(assignmentDecision(result, 'daan', null)).toEqual({ kind: 'invalid' });
  });
});
