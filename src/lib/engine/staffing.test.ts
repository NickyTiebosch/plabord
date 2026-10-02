import { describe, expect, it } from 'vitest';
import { absence, staffingNorms, substitution, teamSnapshot } from './__fixtures__/team';
import { createScheduleContext } from './schedule';
import { counterLocations, createNormLookup, staffingOf } from './staffing';
import type { PlanningSnapshot } from './types';

// Week 42 van 2026: ma 12 t/m za 17 oktober.
const MON = '2026-10-12';
const TUE = '2026-10-13';
const SAT = '2026-10-17';

function counts(snapshot: PlanningSnapshot, date: string, groupId: string) {
  const context = createScheduleContext(snapshot);
  return staffingOf(context, createNormLookup(snapshot.staffingNorms), date, groupId).parts.map((part) => [
    part.dayPart,
    part.count,
    part.norm,
    part.shortage,
  ]);
}

describe('bezetting tegen de norm', () => {
  it('telt alleen de rol balie: hiker/buitendienst telt niet mee', () => {
    // Den Bosch op maandag: Sanne, Joris en Bram aan de balie; Ingrid is hiker/buitendienst.
    expect(counts(teamSnapshot(), MON, 'den_bosch')).toEqual([
      ['morning', 3, 2, 0],
      ['afternoon', 3, 2, 0],
    ]);
  });

  it('telt iemand die di/do aan de balie staat en wo/vr transport doet alleen op di/do', () => {
    // Anouk (Logistiek) staat dinsdag in Den Bosch aan de balie.
    expect(counts(teamSnapshot(), TUE, 'den_bosch')[0]).toEqual(['morning', 4, 2, 0]);
    expect(counts(teamSnapshot(), '2026-10-14', 'den_bosch')[0]).toEqual(['morning', 4, 2, 0]);
    const wednesday = createScheduleContext(teamSnapshot()).entriesOn('2026-10-14').find((entry) => entry.employeeId === 'anouk');
    expect(wednesday).toMatchObject({ groupId: 'logistics', countsForCounter: false });
  });

  it('telt een halve dag afwezig per dagdeel, en aangevraagd telt ook', () => {
    const snapshot = teamSnapshot({ absences: [absence('a1', 'lotte', MON, MON, { dayPart: 'morning', status: 'requested' })] });
    expect(counts(snapshot, MON, 'eindhoven')).toEqual([
      ['morning', 1, 2, 1],
      ['afternoon', 2, 2, 0],
    ]);
  });

  it('telt een inval mee op de nieuwe vestiging en niet bij de eigen groep', () => {
    const snapshot = teamSnapshot({ substitutions: [substitution('s1', 'sanne', MON, 'eindhoven')] });
    expect(counts(snapshot, MON, 'eindhoven')[0]).toEqual(['morning', 3, 2, 0]);
    expect(counts(snapshot, MON, 'den_bosch')[0]).toEqual(['morning', 2, 2, 0]);
  });

  it('heeft op een gesloten dag geen norm en geen tekort', () => {
    // Koningsdag 2026.
    expect(counts(teamSnapshot(), '2026-04-27', 'eindhoven')).toEqual([
      ['morning', 0, 0, 0],
      ['afternoon', 0, 0, 0],
    ]);
  });

  it('heeft op zaterdag norm 0, zoals de seed', () => {
    expect(counts(teamSnapshot(), SAT, 'eindhoven')).toEqual([
      ['morning', 1, 0, 0],
      ['afternoon', 0, 0, 0],
    ]);
  });

  it('kent de drie vestigingen in de vaste volgorde', () => {
    expect(counterLocations(createScheduleContext(teamSnapshot())).map((group) => group.id)).toEqual([
      'den_bosch',
      'eindhoven',
      'breda',
    ]);
    expect(staffingNorms).toHaveLength(36);
  });
});
