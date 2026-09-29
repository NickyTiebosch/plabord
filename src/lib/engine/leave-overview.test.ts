import { describe, expect, it } from 'vitest';
import { absence, employees, groups } from './__fixtures__/team';
import { computeLeaveOverview, listAbsencesInRange } from './leave-overview';
import type { Absence } from './types';

function overview(absences: Absence[], from = '2026-10-01', to = '2026-10-31', people = employees) {
  return computeLeaveOverview({ groups, employees: people, absences, closureOverrides: [] }, from, to);
}

describe('computeLeaveOverview', () => {
  it('groepeert rijen per groep, op naam, inclusief medewerkers zonder vaste diensten', () => {
    const result = overview([]);
    expect(result.sections.map((section) => section.groupName)).toEqual([
      'Den Bosch',
      'Eindhoven',
      'Breda',
      'Logistiek',
      'Backoffice',
      'Overig',
    ]);
    expect(result.sections[0]?.rows.map((row) => row.name)).toEqual(['Bram', 'Fleur', 'Ingrid', 'Joris', 'Sanne']);
    expect(result.sections[3]?.rows.map((row) => row.name)).toContain('Gert');
  });

  it('kort balken in tot het zichtbare bereik en onthoudt de echte datums', () => {
    const result = overview([absence('a1', 'sanne', '2026-09-28', '2026-10-02', { status: 'requested' })]);
    const bar = result.sections[0]?.rows.find((row) => row.name === 'Sanne')?.bars[0];
    expect(bar).toMatchObject({
      startDate: '2026-10-01',
      endDate: '2026-10-02',
      fullStartDate: '2026-09-28',
      status: 'requested',
    });
  });

  it('telt per week per vestiging hoeveel mensen (ma–za) afwezig zijn', () => {
    const result = overview([
      absence('a1', 'sanne', '2026-10-14', '2026-10-14', { dayPart: 'morning' }),
      absence('a2', 'joris', '2026-10-17', '2026-10-17', { status: 'requested' }),
      absence('a3', 'fleur', '2026-10-18'), // zondag: telt niet
      absence('a4', 'anouk', '2026-10-13'), // groep Logistiek: telt niet voor Den Bosch
    ]);
    const denBosch = result.sections.find((section) => section.groupId === 'den_bosch');
    const week42 = denBosch?.weekCounters.find((counter) => counter.monday === '2026-10-12');
    expect(week42).toEqual({ monday: '2026-10-12', absent: 2, total: 5 });
    const eindhoven = result.sections.find((section) => section.groupId === 'eindhoven');
    expect(eindhoven?.weekCounters.find((counter) => counter.monday === '2026-10-12')).toEqual({
      monday: '2026-10-12',
      absent: 0,
      total: 5,
    });
    expect(result.sections.find((section) => section.groupId === 'logistics')?.weekCounters).toEqual([]);
  });

  it('telt inactieve medewerkers niet mee', () => {
    const people = employees.map((e) => (e.id === 'sanne' ? { ...e, isActive: false } : e));
    const result = overview([absence('a1', 'sanne', '2026-10-14')], '2026-10-01', '2026-10-31', people);
    const denBosch = result.sections.find((section) => section.groupId === 'den_bosch');
    expect(denBosch?.rows.map((row) => row.name)).not.toContain('Sanne');
    expect(denBosch?.weekCounters.find((counter) => counter.monday === '2026-10-12')).toMatchObject({
      absent: 0,
      total: 4,
    });
  });

  it('markeert de sluitingsdagen per groep', () => {
    const result = overview([], '2026-04-01', '2026-04-30');
    expect(result.sections[0]?.closedDates).toEqual(['2026-04-05', '2026-04-06', '2026-04-27']);
    expect(result.weeks[0]).toBe('2026-03-30');
  });
});

describe('listAbsencesInRange', () => {
  it('geeft afwezigheid in een periode, op datum en naam', () => {
    const items = listAbsencesInRange(
      employees,
      [
        absence('a1', 'thijs', '2026-10-13'),
        absence('a2', 'eva', '2026-10-12', '2026-10-20'),
        absence('a3', 'bram', '2026-10-12'),
        absence('a4', 'lotte', '2026-11-02'),
      ],
      '2026-10-12',
      '2026-10-17',
    );
    expect(items.map((item) => item.employeeName)).toEqual(['Bram', 'Eva', 'Thijs']);
  });
});
