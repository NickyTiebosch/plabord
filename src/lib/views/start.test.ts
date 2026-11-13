import { describe, expect, it } from 'vitest';
import type { MyScheduleDay, MyScheduleWeek } from './my-schedule';
import { startShifts } from './start';

function day(date: string, tone: 'normal' | 'absent' | 'closed' | null, isToday = false): MyScheduleDay {
  return {
    date,
    label: date,
    isToday,
    lines: tone ? [{ title: 'Den Bosch', detail: 'Balie · 07:30–18:00', tone, note: null }] : [],
    absence: null,
  };
}
const week = (days: MyScheduleDay[]): MyScheduleWeek => ({ key: days[0]?.date ?? '', label: 'week', days });

describe('je dienst op het startscherm (V53)', () => {
  it('geeft vandaag en de eerstvolgende dag waarop je werkt', () => {
    const weeks = [week([day('2026-11-12', 'normal', true), day('2026-11-13', null), day('2026-11-14', 'absent')]), week([day('2026-11-16', 'normal')])];
    const result = startShifts(weeks);
    expect(result.today?.date).toBe('2026-11-12');
    expect(result.next?.date).toBe('2026-11-16');
  });

  it('slaat een gesloten dag over, en geeft niets als er geen dienst meer in de periode valt', () => {
    expect(startShifts([week([day('2026-11-12', null, true), day('2026-11-13', 'closed')])]).next).toBeNull();
  });

  it('werkt ook op zondag, als vandaag niet in het rooster staat', () => {
    const result = startShifts([week([day('2026-11-16', 'normal')])]);
    expect(result.today).toBeNull();
    expect(result.next?.date).toBe('2026-11-16');
  });
});
