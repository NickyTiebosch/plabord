import { describe, expect, it } from 'vitest';
import { absence, groups, teamSnapshot } from '../engine/__fixtures__/team';
import { computePersonalSchedule } from '../engine/schedule';
import type { Absence, Substitution } from '../engine/types';
import { buildGroupWeek } from './group-week';
import { leaveRange, monthSpans, spanOf, weekSpans } from './leave';
import { buildMySchedule } from './my-schedule';
import { findTab, rosterTabs } from './tabs';

describe('Mijn rooster', () => {
  it('toont per week de dagen ma–za met afwijkingen', () => {
    const snapshot = teamSnapshot({
      absences: [absence('a1', 'sanne', '2026-10-14', '2026-10-14', { dayPart: 'morning', status: 'requested' })],
    });
    const days = computePersonalSchedule(snapshot, 'sanne', '2026-10-12', '2026-10-18');
    const weeks = buildMySchedule(days, groups, '2026-10-13');
    expect(weeks).toHaveLength(1);
    expect(weeks[0]?.label).toBe('Week 42 · 12–17 okt');
    expect(weeks[0]?.days.map((day) => day.label)).toEqual(['ma 12 okt', 'di 13 okt', 'wo 14 okt', 'do 15 okt', 'vr 16 okt', 'za 17 okt']);
    const wednesday = weeks[0]?.days[2];
    expect(wednesday?.lines).toEqual([
      { title: 'Den Bosch', detail: 'balie · 13:00–18:00', tone: 'deviation', note: 'ochtend afwezig' },
    ]);
    expect(wednesday?.absence).toEqual({ label: 'Afwezig (ochtend)', requested: true });
    expect(weeks[0]?.days[1]?.isToday).toBe(true);
    expect(weeks[0]?.days[5]?.lines).toEqual([]);
  });

  it('zegt een hele dag afwezig maar één keer', () => {
    const snapshot = teamSnapshot({ absences: [absence('a1', 'sanne', '2026-10-14')] });
    const day = buildMySchedule(computePersonalSchedule(snapshot, 'sanne', '2026-10-14', '2026-10-14'), groups, '2026-10-14')[0]?.days[0];
    expect(day?.lines).toEqual([{ title: 'Den Bosch', detail: 'balie · 07:30–18:00', tone: 'absent', note: null }]);
    expect(day?.absence).toEqual({ label: 'Afwezig', requested: false });
  });

  it('meldt sluitingsdagen en invallen', () => {
    const kingsDay = buildMySchedule(computePersonalSchedule(teamSnapshot(), 'sanne', '2026-04-27', '2026-04-27'), groups, '2026-04-27');
    expect(kingsDay[0]?.days[0]?.lines).toEqual([
      { title: 'Den Bosch', detail: 'balie', tone: 'closed', note: 'Gesloten: Koningsdag' },
    ]);
    const substitution: Substitution = {
      id: 's1',
      employeeId: 'danique',
      date: '2026-10-14',
      groupId: 'eindhoven',
      dayParts: ['afternoon'],
      status: 'active',
      handledAt: null,
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
    };
    const days = computePersonalSchedule(teamSnapshot({ substitutions: [substitution] }), 'danique', '2026-10-14', '2026-10-14');
    const lines = buildMySchedule(days, groups, '2026-10-14')[0]?.days[0]?.lines;
    expect(lines).toContainEqual({ title: 'Invallen in Eindhoven', detail: 'balie · 13:00–18:00', tone: 'deviation', note: null });
  });
});

describe('Vestigingsrooster', () => {
  it('heeft tabs per vestiging en één voor ondersteunend', () => {
    expect(rosterTabs(groups).map((tab) => tab.slug)).toEqual(['den-bosch', 'eindhoven', 'breda', 'ondersteunend']);
    expect(findTab(groups, 'ondersteunend')?.groupIds).toEqual(['logistics', 'backoffice', 'other']);
    expect(findTab(groups, 'tilburg')).toBeNull();
  });

  it('toont per dag wie werkt en wie afwezig is', () => {
    const snapshot = teamSnapshot({ absences: [absence('a1', 'joris', '2026-10-13', '2026-10-13', { status: 'requested' })] });
    const week = buildGroupWeek(snapshot, ['den_bosch'], '2026-10-12', '2026-10-13');
    expect(week).toHaveLength(6);
    const tuesday = week[1]?.sections[0];
    expect(tuesday?.working.flatMap((block) => block.people).map((line) => line.name)).toEqual(['Anouk', 'Bram', 'Sanne']);
    expect(tuesday?.absent).toEqual([
      expect.objectContaining({ name: 'Joris', note: 'aangevraagd', requested: true }),
    ]);
  });

  it('zet in een vestiging de balie bovenaan en de andere rollen eronder, elk met een kopje', () => {
    const substitution: Substitution = {
      id: 's1',
      employeeId: 'danique',
      date: '2026-10-12',
      groupId: 'den_bosch',
      dayParts: ['afternoon'],
      status: 'active',
      handledAt: null,
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
    };
    const snapshot = teamSnapshot({ substitutions: [substitution] });
    const monday = buildGroupWeek(snapshot, ['den_bosch'], '2026-10-12', '2026-10-12')[0]?.sections[0];
    expect(monday?.working.map((block) => [block.role, block.label, block.people.map((line) => line.name)])).toEqual([
      // Wie is ingeleend, staat onder de eigen mensen.
      ['counter', 'Balie', ['Bram', 'Joris', 'Sanne', 'Danique']],
      ['cleaning', 'Hiker/buitendienst', ['Ingrid']],
    ]);
    // Het kopje noemt de rol al, dus niet nog eens achter elke naam.
    expect(monday?.working[1]?.people[0]).toMatchObject({ role: 'cleaning', roleLabel: null, times: '07:30–11:30' });
    expect(monday?.working[0]?.people[3]).toMatchObject({ name: 'Danique', note: 'ingeleend', borrowed: true });
  });

  it('noemt de rol van wie afwezig is als die afwijkt van de balie', () => {
    const snapshot = teamSnapshot({ absences: [absence('a1', 'ingrid', '2026-10-12'), absence('a2', 'joris', '2026-10-12')] });
    const monday = buildGroupWeek(snapshot, ['den_bosch'], '2026-10-12', '2026-10-12')[0]?.sections[0];
    expect(monday?.working.map((block) => block.label)).toEqual(['Balie']);
    expect(monday?.absent.map((line) => [line.name, line.role, line.roleLabel])).toEqual([
      ['Ingrid', 'cleaning', 'hiker/buitendienst'],
      ['Joris', 'counter', null],
    ]);
  });

  it('houdt een ondersteunende groep als één lijst, met de rol achter de naam', () => {
    const wednesday = buildGroupWeek(teamSnapshot(), ['logistics', 'backoffice', 'other'], '2026-10-14', '2026-10-14')[0];
    const [logistics, , other] = wednesday?.sections ?? [];
    expect(logistics?.working).toEqual([
      {
        role: null,
        label: null,
        people: [
          expect.objectContaining({ name: 'Anouk', role: 'transport', roleLabel: 'transport' }),
          expect.objectContaining({ name: 'Ruben', role: 'transport', roleLabel: 'transport' }),
        ],
      },
    ]);
    expect(other?.working[0]?.people.map((line) => [line.name, line.roleLabel])).toEqual([
      ['Hans', null],
      ['Iris', null],
      ['Petra', null],
      ['Wouter', null],
    ]);
  });

  it('toont geen bezetting per dagdeel, alleen een melding bij een tekort aan de balie', () => {
    const mondayOf = (absences: Absence[]) =>
      buildGroupWeek(teamSnapshot({ absences }), ['den_bosch'], '2026-10-12', '2026-10-12')[0]?.sections[0];
    // Maandag in Den Bosch: Sanne, Joris en Bram aan de balie, de norm is 2.
    expect(mondayOf([])?.shortage).toBeNull();
    expect(mondayOf([absence('a1', 'sanne', '2026-10-12'), absence('a2', 'joris', '2026-10-12')])?.shortage).toBe(
      '1 te weinig aan de balie',
    );
    expect(
      mondayOf([
        absence('a1', 'sanne', '2026-10-12', '2026-10-12', { dayPart: 'afternoon' }),
        absence('a2', 'joris', '2026-10-12', '2026-10-12', { dayPart: 'afternoon' }),
      ])?.shortage,
    ).toBe('1 te weinig aan de balie (middag)');
    expect(
      mondayOf([
        absence('a1', 'sanne', '2026-10-12'),
        absence('a2', 'joris', '2026-10-12'),
        absence('a3', 'bram', '2026-10-12', '2026-10-12', { dayPart: 'afternoon' }),
      ])?.shortage,
    ).toBe('Te weinig aan de balie: ochtend 1, middag 2');
  });

  it('toont een gesloten vestiging', () => {
    const week = buildGroupWeek(teamSnapshot(), ['breda'], '2026-04-27', '2026-04-27');
    expect(week[0]?.sections[0]).toMatchObject({ closure: 'Koningsdag', working: [], absent: [], shortage: null });
  });
});

describe('Verlofoverzicht', () => {
  it('rekent de periode per weergave uit', () => {
    expect(leaveRange('maand', '2026-10-14')).toMatchObject({
      from: '2026-10-01',
      to: '2026-10-31',
      previous: '2026-09-01',
      next: '2026-11-01',
      title: 'oktober 2026',
    });
    expect(leaveRange('kwartaal', '2026-11-20')).toMatchObject({
      from: '2026-10-01',
      to: '2026-12-31',
      previous: '2026-07-01',
      next: '2027-01-01',
      title: 'okt – dec 2026',
    });
    expect(leaveRange('jaar', '2026-11-20')).toMatchObject({ from: '2026-01-01', to: '2026-12-31', title: '2026' });
  });

  it('kort stukken van de tijdlijn in tot het bereik', () => {
    expect(spanOf('2026-10-01', '2026-10-31', '2026-09-28', '2026-10-04')).toEqual({ start: 0, length: 4 });
    expect(monthSpans('2026-10-01', '2026-12-31', false).map((span) => [span.label, span.start, span.length])).toEqual([
      ['okt', 0, 31],
      ['nov', 31, 30],
      ['dec', 61, 31],
    ]);
    expect(weekSpans('2026-10-01', '2026-10-31', ['2026-09-28'])[0]).toEqual({ label: 'wk 40', start: 0, length: 4 });
  });
});
