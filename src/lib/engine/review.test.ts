import { describe, expect, it } from 'vitest';
import { absence, override, substitution, teamSnapshot } from './__fixtures__/team';
import { findGaps } from './gaps';
import { reviewSubstitutions } from './review';
import { createScheduleContext } from './schedule';
import { createNormLookup } from './staffing';

const MON = '2026-10-12';
const TODAY = '2026-10-01';

describe('achterhaalde invallen (besluit V10)', () => {
  it('maakt een inval "niet meer nodig" als de afwezigheid weg is', () => {
    // Lotte was afwezig en Danique viel in; daarna is Lottes afwezigheid verwijderd.
    const snapshot = teamSnapshot({ substitutions: [substitution('s1', 'danique', MON, 'eindhoven')] });
    expect(reviewSubstitutions(snapshot, [MON], TODAY)).toEqual([
      {
        substitutionId: 's1',
        employeeId: 'danique',
        date: MON,
        groupId: 'eindhoven',
        status: 'not_needed',
        reason: 'Eindhoven zit zonder deze inval op de norm',
      },
    ]);
  });

  it('laat een inval staan die nog nodig is', () => {
    const snapshot = teamSnapshot({
      absences: [absence('a1', 'lotte', MON)],
      substitutions: [substitution('s1', 'danique', MON, 'eindhoven')],
    });
    expect(reviewSubstitutions(snapshot, [MON], TODAY)).toEqual([]);
  });

  it('laat bij twee overbodige invallen de laatst ingeplande eerst vervallen, en houdt de rest', () => {
    // Lotte en Daan waren afwezig, Danique en Hans vielen in. Daans afwezigheid is verwijderd.
    const snapshot = teamSnapshot({
      absences: [absence('a1', 'lotte', MON)],
      substitutions: [
        substitution('s1', 'danique', MON, 'eindhoven', ['morning', 'afternoon'], { createdAt: '2026-10-02T08:00:00.000Z' }),
        substitution('s2', 'hans', MON, 'eindhoven', ['morning', 'afternoon'], { createdAt: '2026-10-02T09:00:00.000Z' }),
      ],
    });
    expect(reviewSubstitutions(snapshot, [MON], TODAY).map((change) => [change.substitutionId, change.status])).toEqual([
      ['s2', 'not_needed'],
    ]);
  });

  it('zet de inval op "opnieuw regelen" als de invaller zelf afwezig is, en het gat komt terug', () => {
    const snapshot = teamSnapshot({
      absences: [absence('a1', 'lotte', MON), absence('a2', 'danique', MON, MON, { dayPart: 'afternoon' })],
      substitutions: [substitution('s1', 'danique', MON, 'eindhoven')],
    });
    expect(reviewSubstitutions(snapshot, [MON], TODAY)).toEqual([
      expect.objectContaining({ substitutionId: 's1', status: 'reschedule', reason: 'is zelf afwezig' }),
    ]);
    // Nadat de status is aangepast, telt de inval niet meer en staat het gat er weer.
    const after = teamSnapshot({
      absences: snapshot.absences.slice(),
      substitutions: [substitution('s1', 'danique', MON, 'eindhoven', ['morning', 'afternoon'], { status: 'reschedule' })],
    });
    const gaps = findGaps(createScheduleContext(after), createNormLookup(after.staffingNorms), MON, MON).gaps;
    expect(gaps.map((gap) => gap.groupId)).toEqual(['eindhoven']);
  });

  it('zet de inval op "opnieuw regelen" als de invaller die dag niet meer werkt', () => {
    const snapshot = teamSnapshot({
      absences: [absence('a1', 'lotte', MON)],
      shiftOverrides: [override('o1', 'danique', MON, { kind: 'off' })],
      substitutions: [substitution('s1', 'danique', MON, 'eindhoven')],
    });
    expect(reviewSubstitutions(snapshot, [MON], TODAY)).toEqual([
      expect.objectContaining({ substitutionId: 's1', status: 'reschedule', reason: 'werkt die dag niet meer' }),
    ]);
  });

  it('laat invallen in het verleden ongemoeid', () => {
    const snapshot = teamSnapshot({ substitutions: [substitution('s1', 'danique', MON, 'eindhoven')] });
    expect(reviewSubstitutions(snapshot, [MON], '2026-10-13')).toEqual([]);
  });

  it('kijkt alleen naar invallen die doorgaan, op de gevraagde dagen', () => {
    const snapshot = teamSnapshot({
      substitutions: [
        substitution('s1', 'danique', MON, 'eindhoven', ['morning'], { status: 'not_needed' }),
        substitution('s2', 'hans', '2026-10-13', 'eindhoven'),
      ],
    });
    expect(reviewSubstitutions(snapshot, [MON], TODAY)).toEqual([]);
  });
});
