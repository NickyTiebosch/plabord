import { describe, expect, it } from 'vitest';
import { closureOverviewForYear, createClosureResolver } from './closures';
import type { ClosureOverride, Group } from './types';

const groups: Group[] = [
  { id: 'den_bosch', name: 'Den Bosch', hasCounter: true, sortOrder: 1, substitutionRank: 3 },
  { id: 'breda', name: 'Breda', hasCounter: true, sortOrder: 3, substitutionRank: 3 },
  { id: 'logistics', name: 'Logistiek', hasCounter: false, sortOrder: 4, substitutionRank: 4 },
];

function override(partial: Partial<ClosureOverride> & Pick<ClosureOverride, 'date' | 'isClosed'>): ClosureOverride {
  return { id: `o-${partial.date}-${partial.groupId ?? 'all'}`, groupId: null, label: null, ...partial };
}

describe('createClosureResolver', () => {
  it('sluit een feestdag voor alle groepen, ook de ondersteunende', () => {
    const resolve = createClosureResolver([]);
    expect(resolve('2026-04-27', 'den_bosch')).toEqual({ closed: true, name: 'Koningsdag' });
    expect(resolve('2026-04-27', 'logistics')).toEqual({ closed: true, name: 'Koningsdag' });
  });

  it('houdt Oudjaarsdag en gewone dagen open', () => {
    const resolve = createClosureResolver([]);
    expect(resolve('2026-12-31', 'den_bosch')).toEqual({ closed: false, name: null });
    expect(resolve('2026-10-14', 'breda')).toEqual({ closed: false, name: null });
  });

  it('kan een feestdag voor één groep openzetten', () => {
    const resolve = createClosureResolver([override({ date: '2026-05-25', groupId: 'logistics', isClosed: false })]);
    expect(resolve('2026-05-25', 'logistics').closed).toBe(false);
    expect(resolve('2026-05-25', 'breda')).toEqual({ closed: true, name: '2e pinksterdag' });
  });

  it('laat een afwijking voor één groep voorgaan op een afwijking voor iedereen', () => {
    const resolve = createClosureResolver([
      override({ date: '2026-05-25', isClosed: false }),
      override({ date: '2026-05-25', groupId: 'breda', isClosed: true }),
    ]);
    expect(resolve('2026-05-25', 'den_bosch').closed).toBe(false);
    expect(resolve('2026-05-25', 'breda')).toEqual({ closed: true, name: '2e pinksterdag' });
  });

  it('sluit extra dagen met hun label, voor iedereen of voor één groep', () => {
    const resolve = createClosureResolver([
      override({ date: '2026-06-12', isClosed: true, label: 'Bedrijfsuitje' }),
      override({ date: '2026-05-15', groupId: 'breda', isClosed: true }),
    ]);
    expect(resolve('2026-06-12', 'logistics')).toEqual({ closed: true, name: 'Bedrijfsuitje' });
    expect(resolve('2026-05-15', 'breda')).toEqual({ closed: true, name: 'Gesloten' });
    expect(resolve('2026-05-15', 'den_bosch').closed).toBe(false);
  });
});

describe('closureOverviewForYear', () => {
  it('toont per feestdag per groep open of dicht, en de extra sluitingsdagen', () => {
    const overview = closureOverviewForYear(2026, groups, [
      override({ date: '2026-05-25', groupId: 'logistics', isClosed: false }),
      override({ date: '2026-06-12', isClosed: true, label: 'Bedrijfsuitje' }),
      override({ date: '2027-06-12', isClosed: true, label: 'Volgend jaar' }),
    ]);
    expect(overview.holidays).toHaveLength(10);
    const whitMonday = overview.holidays.find((holiday) => holiday.date === '2026-05-25');
    expect(whitMonday?.closedByGroup).toEqual({ den_bosch: true, breda: true, logistics: false });
    expect(overview.extraClosures.map((closure) => closure.date)).toEqual(['2026-06-12']);
  });
});
