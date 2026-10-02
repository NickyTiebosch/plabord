import { describe, expect, it } from 'vitest';
import { absence, teamSnapshot } from '../engine/__fixtures__/team';
import type { Substitution } from '../engine/types';
import { absenceFeedEvents, buildFeed, feedRange, locationFeedEvents, personalFeedEvents } from './feeds';

function summaries(events: { summary: string }[]): string[] {
  return events.map((event) => event.summary);
}

describe('feedRange', () => {
  it('loopt van 30 dagen terug tot 26 weken vooruit', () => {
    expect(feedRange('2026-10-14')).toEqual({ from: '2026-09-14', to: '2027-04-14' });
  });
});

describe('persoonlijke feed', () => {
  it('toont diensten, ingekort bij een halve dag afwezig, en de afwezigheid zelf', () => {
    const snapshot = teamSnapshot({
      absences: [absence('a1', 'sanne', '2026-10-14', '2026-10-14', { dayPart: 'morning', status: 'requested' })],
    });
    const events = personalFeedEvents(snapshot, 'sanne', '2026-10-12', '2026-10-16');
    expect(summaries(events)).toEqual([
      'Dienst Den Bosch 07:30–18:00',
      'Dienst Den Bosch 07:30–18:00',
      'Dienst Den Bosch 13:00–18:00',
      'Dienst Den Bosch 07:30–18:00',
      'Dienst Den Bosch 07:30–18:00',
      'Afwezig (ochtend, aangevraagd)',
    ]);
    expect(events[2]).toMatchObject({ uid: 'dienst-sanne-2026-10-14@planbord', start: '13:00', end: '18:00' });
  });

  it('laat diensten op een sluitingsdag weg', () => {
    const events = personalFeedEvents(teamSnapshot(), 'sanne', '2026-04-27', '2026-04-27');
    expect(events).toEqual([]);
  });

  it('toont een inval (fase 2) als "Invallen" met de vestiging', () => {
    const substitution: Substitution = {
      id: 's1',
      employeeId: 'danique',
      date: '2026-10-14',
      groupId: 'eindhoven',
      dayParts: ['afternoon'],
      status: 'active',
      handledAt: null,
      createdAt: '2026-10-01T10:00:00.000Z',
      updatedAt: '2026-10-01T10:00:00.000Z',
    };
    const events = personalFeedEvents(teamSnapshot({ substitutions: [substitution] }), 'danique', '2026-10-14', '2026-10-14');
    expect(summaries(events).sort()).toEqual(['Dienst Backoffice 07:30–13:00', 'Invallen Eindhoven 13:00–18:00']);
  });
});

describe('vestigingsfeed', () => {
  it('toont wie er werkt met rol, en wie afwezig is niet', () => {
    const snapshot = teamSnapshot({ absences: [absence('a1', 'joris', '2026-10-12')] });
    const events = locationFeedEvents(snapshot, 'den_bosch', '2026-10-12', '2026-10-12');
    expect(summaries(events)).toEqual(['Bram (balie)', 'Ingrid (hiker/buitendienst)', 'Sanne (balie)']);
    expect(events.find((event) => event.summary === 'Ingrid (hiker/buitendienst)')).toMatchObject({ start: '07:30', end: '11:30' });
  });

  it('meldt dat de vestiging gesloten is', () => {
    const events = locationFeedEvents(teamSnapshot(), 'breda', '2026-04-27', '2026-04-27');
    expect(summaries(events)).toEqual(['Gesloten: Koningsdag']);
  });
});

describe('team-verlof', () => {
  it('toont iedereen die afwezig is, met dagdeel en status', () => {
    const snapshot = teamSnapshot({
      absences: [
        absence('a1', 'sanne', '2026-10-14', '2026-10-14', { dayPart: 'afternoon' }),
        absence('a2', 'eva', '2026-10-12', '2026-10-16', { status: 'requested' }),
        absence('a3', 'eva', '2025-01-01', '2025-01-02'),
      ],
    });
    const events = absenceFeedEvents(snapshot, '2026-09-14', '2027-04-14');
    expect(summaries(events)).toEqual(['Afwezig: Sanne (middag)', 'Afwezig: Eva (aangevraagd)']);
  });
});

describe('buildFeed', () => {
  it('bevat geen e-mailadressen en is stabiel', () => {
    const snapshot = teamSnapshot({ absences: [absence('a1', 'sanne', '2026-10-14')] });
    const first = buildFeed(snapshot, { kind: 'absences', employeeId: 'petra', groupId: null }, '2026-10-14');
    const second = buildFeed(snapshot, { kind: 'absences', employeeId: 'petra', groupId: null }, '2026-10-14');
    expect(second).toBe(first);
    expect(first).not.toMatch(/[^\s@:]+@[^\s@]+\.[a-z]{2,}/i);
    expect(first).toContain('X-WR-CALNAME:Planbord – Verlof team');
  });

  it('noemt een vestigingsfeed naar de vestiging', () => {
    const ics = buildFeed(teamSnapshot(), { kind: 'location', employeeId: 'petra', groupId: 'breda' }, '2026-10-14');
    expect(ics).toContain('X-WR-CALNAME:Planbord – Breda');
  });
});
