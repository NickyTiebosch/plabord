import { describe, expect, it } from 'vitest';
import { absence, teamSnapshot } from './__fixtures__/team';
import { findGaps } from './gaps';
import { createScheduleContext } from './schedule';
import { createNormLookup } from './staffing';
import type { GapDismissal, PlanningSnapshot } from './types';

const MON = '2026-10-12';
const TUE = '2026-10-13';

function scan(snapshot: PlanningSnapshot, from: string, to: string, dismissals: GapDismissal[] = []) {
  return findGaps(createScheduleContext(snapshot), createNormLookup(snapshot.staffingNorms), from, to, dismissals);
}

function summary(snapshot: PlanningSnapshot, from: string, to: string, dismissals: GapDismissal[] = []) {
  const result = scan(snapshot, from, to, dismissals);
  const line = (gap: (typeof result.gaps)[number]) =>
    `${gap.date} ${gap.groupId} ${gap.parts.map((part) => `${part.dayPart}:${part.count}/${part.norm}`).join(' ')}`;
  return { gaps: result.gaps.map(line), ignored: result.ignored.map(line) };
}

describe('gaten', () => {
  it('zijn er niet zolang iedereen er is', () => {
    expect(summary(teamSnapshot(), MON, '2026-10-17')).toEqual({ gaps: [], ignored: [] });
  });

  it('ontstaan alleen als de norm echt wordt onderschreden', () => {
    // Eindhoven heeft op dinsdag 3 mensen: één afwezig is nog geen gat.
    expect(summary(teamSnapshot({ absences: [absence('a1', 'milan', TUE)] }), TUE, TUE).gaps).toEqual([]);
    // Op maandag heeft Eindhoven er precies 2: één afwezig is een gat, ochtend en middag samen.
    expect(summary(teamSnapshot({ absences: [absence('a1', 'lotte', MON)] }), MON, MON).gaps).toEqual([
      '2026-10-12 eindhoven morning:1/2 afternoon:1/2',
    ]);
  });

  it('volgen een halve dag afwezig', () => {
    const snapshot = teamSnapshot({ absences: [absence('a1', 'lotte', MON, MON, { dayPart: 'afternoon' })] });
    expect(summary(snapshot, MON, MON).gaps).toEqual(['2026-10-12 eindhoven afternoon:1/2']);
  });

  it('zijn er niet op een sluitingsdag, ook al werkt er niemand', () => {
    // Koningsdag 2026 valt op maandag 27 april.
    expect(summary(teamSnapshot(), '2026-04-27', '2026-04-27').gaps).toEqual([]);
  });

  it('staan op datum en dan in de volgorde van de vestigingen', () => {
    const snapshot = teamSnapshot({
      absences: [absence('a1', 'lotte', MON, TUE), absence('a2', 'eva', TUE), absence('a3', 'milan', TUE)],
    });
    expect(summary(snapshot, MON, TUE).gaps).toEqual([
      '2026-10-12 eindhoven morning:1/2 afternoon:1/2',
      '2026-10-13 eindhoven morning:1/2 afternoon:1/2',
      '2026-10-13 breda morning:1/2 afternoon:1/2',
    ]);
  });

  it('blijven genegeerd tot het tekort groter wordt (besluit V8)', () => {
    const dismissals: GapDismissal[] = [
      { groupId: 'eindhoven', date: MON, dayPart: 'morning', shortage: 1 },
      { groupId: 'eindhoven', date: MON, dayPart: 'afternoon', shortage: 1 },
    ];
    const one = teamSnapshot({ absences: [absence('a1', 'lotte', MON)] });
    expect(summary(one, MON, MON, dismissals)).toEqual({
      gaps: [],
      ignored: ['2026-10-12 eindhoven morning:1/2 afternoon:1/2'],
    });
    const two = teamSnapshot({ absences: [absence('a1', 'lotte', MON), absence('a2', 'daan', MON)] });
    expect(summary(two, MON, MON, dismissals)).toEqual({
      gaps: ['2026-10-12 eindhoven morning:0/2 afternoon:0/2'],
      ignored: [],
    });
  });
});
