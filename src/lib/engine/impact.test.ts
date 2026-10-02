import { describe, expect, it } from 'vitest';
import { absence, substitution, teamSnapshot } from './__fixtures__/team';
import { absenceImpact, changedDates } from './impact';

const MON = '2026-10-12';
const TUE = '2026-10-13';
const TODAY = '2026-10-01';

describe('impactcheck bij afwezigheid', () => {
  it('toont welke dagdelen onder de norm zakken, met het eerste voorstel', () => {
    const impact = absenceImpact(teamSnapshot(), { previous: null, next: absence('new', 'lotte', MON) }, TODAY);
    expect(impact.parts).toEqual([
      { date: MON, groupId: 'eindhoven', dayPart: 'morning', before: 2, after: 1, norm: 2, proposal: 'Danique' },
      { date: MON, groupId: 'eindhoven', dayPart: 'afternoon', before: 2, after: 1, norm: 2, proposal: 'Danique' },
    ]);
    expect(impact.changes).toEqual([]);
  });

  it('meldt niets als de vestiging op de norm blijft', () => {
    const impact = absenceImpact(teamSnapshot(), { previous: null, next: absence('new', 'milan', TUE) }, TODAY);
    expect(impact).toEqual({ parts: [], changes: [] });
  });

  it('meldt ook een vestiging die verder onder de norm zakt', () => {
    const snapshot = teamSnapshot({ absences: [absence('a1', 'lotte', MON)] });
    const impact = absenceImpact(snapshot, { previous: null, next: absence('new', 'daan', MON, MON, { dayPart: 'morning' }) }, TODAY);
    expect(impact.parts).toEqual([
      { date: MON, groupId: 'eindhoven', dayPart: 'morning', before: 1, after: 0, norm: 2, proposal: 'Danique' },
    ]);
  });

  it('kijkt bij een wijziging naar de oude én de nieuwe dagen, alleen vanaf vandaag', () => {
    expect(
      changedDates(
        [
          { startDate: '2026-09-28', endDate: '2026-10-02' },
          { startDate: '2026-10-02', endDate: '2026-10-03' },
        ],
        TODAY,
      ),
    ).toEqual(['2026-10-01', '2026-10-02', '2026-10-03']);
  });

  it('noemt de invallen die vervallen als de invaller zelf afwezig wordt', () => {
    const snapshot = teamSnapshot({
      absences: [absence('a1', 'lotte', MON)],
      substitutions: [substitution('s1', 'danique', MON, 'eindhoven')],
    });
    const impact = absenceImpact(snapshot, { previous: null, next: absence('new', 'danique', MON) }, TODAY);
    expect(impact.changes).toEqual([expect.objectContaining({ substitutionId: 's1', status: 'reschedule' })]);
    // Het gat in Eindhoven komt terug; Hans is dan het eerste voorstel.
    expect(impact.parts.map((part) => [part.groupId, part.dayPart, part.after, part.proposal])).toEqual([
      ['eindhoven', 'morning', 1, 'Hans'],
      ['eindhoven', 'afternoon', 1, 'Hans'],
    ]);
  });

  it('noemt de invallen die niet meer nodig zijn als een afwezigheid verdwijnt', () => {
    const lotte = absence('a1', 'lotte', MON);
    const snapshot = teamSnapshot({ absences: [lotte], substitutions: [substitution('s1', 'danique', MON, 'eindhoven')] });
    const impact = absenceImpact(snapshot, { previous: lotte, next: null }, TODAY);
    expect(impact.parts).toEqual([]);
    expect(impact.changes).toEqual([expect.objectContaining({ substitutionId: 's1', status: 'not_needed' })]);
  });
});
