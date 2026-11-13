import { describe, expect, it } from 'vitest';
import { absence, teamSnapshot } from '../engine/__fixtures__/team';
import { closeReminderPush, closeReminderTargets } from './reminders';

// Dinsdag 13 oktober 2026: een gewone werkdag in de fixture.
const DAY = '2026-10-13';

describe('de herinnering voor het afsluiten van de dag (V61)', () => {
  it('gaat naar wie die dag op de vestiging werkt', () => {
    const targets = closeReminderTargets(teamSnapshot(), 'den_bosch', DAY);
    expect(targets).toContain('sanne');
    expect(targets).not.toContain('daan');
    expect(closeReminderTargets(teamSnapshot(), 'eindhoven', DAY)).toContain('daan');
  });

  it('slaat over wie de hele dag afwezig is', () => {
    const snapshot = teamSnapshot({ absences: [absence('a1', 'sanne', DAY)] });
    expect(closeReminderTargets(snapshot, 'den_bosch', DAY)).not.toContain('sanne');
  });

  it('gaat naar niemand als de vestiging dicht is', () => {
    const snapshot = teamSnapshot({ closureOverrides: [{ id: 'c', date: DAY, groupId: 'den_bosch', isClosed: true, label: 'Dicht' }] });
    expect(closeReminderTargets(snapshot, 'den_bosch', DAY)).toEqual([]);
  });

  it('noemt alleen de vestiging, en opent Binnenvallers', () => {
    expect(closeReminderPush('den_bosch', 'Den Bosch', DAY)).toEqual({
      title: 'Planbord',
      body: 'Den Bosch: de dag is nog niet afgesloten. Werk binnenvallers en meldingen bij en sluit de dag af.',
      url: '/binnenvallers?vestiging=den_bosch',
      tag: 'day-close-den_bosch-2026-10-13',
    });
  });
});
