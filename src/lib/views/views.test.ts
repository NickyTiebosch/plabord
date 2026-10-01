import { describe, expect, it } from 'vitest';
import { absence, groups, teamSnapshot } from '../engine/__fixtures__/team';
import { computePersonalSchedule } from '../engine/schedule';
import type { Substitution } from '../engine/types';
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
    expect(tuesday?.working.map((line) => line.name)).toEqual(['Anouk', 'Bram', 'Sanne']);
    expect(tuesday?.absent).toEqual([
      expect.objectContaining({ name: 'Joris', note: 'aangevraagd', requested: true }),
    ]);
    const monday = week[0]?.sections[0];
    expect(monday?.working.find((line) => line.name === 'Ingrid')).toMatchObject({ role: 'poets', times: '07:30–11:30' });
  });

  it('toont een gesloten vestiging', () => {
    const week = buildGroupWeek(teamSnapshot(), ['breda'], '2026-04-27', '2026-04-27');
    expect(week[0]?.sections[0]).toMatchObject({ closure: 'Koningsdag', working: [], absent: [] });
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
