import { describe, expect, it } from 'vitest';
import { substitution } from './__fixtures__/team';
import { recentSubstitutionCounts } from './history';

describe('invallen in de laatste 90 dagen (besluit V7)', () => {
  it('telt de 90 dagen vóór de datum, en alleen invallen die doorgaan', () => {
    const counts = recentSubstitutionCounts(
      [
        substitution('s1', 'danique', '2026-07-14', 'eindhoven'), // precies 90 dagen ervoor: telt
        substitution('s2', 'danique', '2026-07-13', 'eindhoven'), // 91 dagen ervoor: telt niet
        substitution('s3', 'danique', '2026-10-11', 'breda'), // de dag ervoor: telt
        substitution('s4', 'danique', '2026-10-12', 'breda'), // dezelfde dag: telt niet
        substitution('s5', 'danique', '2026-09-01', 'breda', ['morning'], { status: 'not_needed' }),
        substitution('s6', 'hans', '2026-09-01', 'eindhoven', ['morning'], { status: 'reschedule' }),
        substitution('s7', 'hans', '2026-09-02', 'eindhoven'),
      ],
      '2026-10-12',
    );
    expect(Object.fromEntries(counts)).toEqual({ danique: 2, hans: 1 });
  });
});
