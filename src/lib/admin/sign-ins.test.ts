import { describe, expect, it } from 'vitest';
import {
  countByEmployee,
  lastSignInText,
  onboardingBadges,
  onboardingSummary,
  onboardingSummaryText,
  parseSignIns,
} from './sign-ins';

const person = (overrides: Partial<{ id: string; isActive: boolean; email: string | null; hasAccount: boolean }> = {}) => ({
  id: 'sanne',
  isActive: true,
  email: 'sanne@voorbeeld.nl',
  hasAccount: true,
  ...overrides,
});

describe('wie er is ingelogd (V38)', () => {
  it('leest het antwoord van de database, en negeert wat er niet klopt', () => {
    const signIns = parseSignIns([
      { employee_id: 'sanne', last_sign_in_at: '2026-10-06T12:05:00+00:00' },
      { employee_id: 'joris', last_sign_in_at: null },
      { employee_id: 42, last_sign_in_at: null },
      'onzin',
    ]);
    expect([...signIns]).toEqual([
      ['sanne', '2026-10-06T12:05:00+00:00'],
      ['joris', null],
    ]);
    expect(parseSignIns(null).size).toBe(0);
  });

  it('zegt wanneer iemand voor het laatst inlogde, in Nederlandse tijd', () => {
    expect(lastSignInText('2026-10-06T12:05:00Z')).toBe('Laatst ingelogd op di 6 okt om 14:05.');
    expect(lastSignInText('2026-12-31T23:30:00Z')).toBe('Laatst ingelogd op vr 1 jan om 00:30.');
    expect(lastSignInText(null)).toBe('Nog niet ingelogd.');
  });

  it('toont in de lijst hoe ver iemand is', () => {
    const status = { invite: 'none' as const, lastSignInAt: null, devices: 0 };
    expect(onboardingBadges(person({ email: null, hasAccount: false }), status)).toEqual([{ label: 'geen e-mail', tone: 'neutral' }]);
    expect(onboardingBadges(person({ hasAccount: false }), status)).toEqual([{ label: 'nog geen account', tone: 'warning' }]);
    expect(onboardingBadges(person(), status)).toEqual([{ label: 'nog niet ingelogd', tone: 'warning' }]);
    for (const invite of ['sent', 'pending'] as const) {
      expect(onboardingBadges(person(), { ...status, invite })).toEqual([
        { label: 'uitgenodigd', tone: 'success' },
        { label: 'nog niet ingelogd', tone: 'warning' },
      ]);
    }
    expect(onboardingBadges(person(), { invite: 'sent', lastSignInAt: '2026-10-06T12:05:00Z', devices: 0 })).toEqual([
      { label: 'ingelogd di 6 okt', tone: 'success' },
      { label: 'meldingen uit', tone: 'warning' },
    ]);
    expect(onboardingBadges(person(), { invite: 'sent', lastSignInAt: '2026-10-06T12:05:00Z', devices: 2 })).toEqual([
      { label: 'ingelogd di 6 okt', tone: 'success' },
      { label: 'meldingen aan', tone: 'success' },
    ]);
  });

  it('toont een mislukte uitnodiging als mislukt, niet als uitgenodigd (V39)', () => {
    const status = { lastSignInAt: null, devices: 0 };
    for (const invite of ['retrying', 'failed'] as const) {
      expect(onboardingBadges(person(), { ...status, invite })).toEqual([
        { label: 'uitnodiging mislukt', tone: 'warning' },
        { label: 'nog niet ingelogd', tone: 'warning' },
      ]);
    }
    expect(onboardingBadges(person(), { ...status, invite: 'skipped' })).toEqual([{ label: 'nog niet ingelogd', tone: 'warning' }]);
    expect(onboardingBadges(person(), { invite: 'failed', lastSignInAt: undefined, devices: 0 })).toEqual([
      { label: 'uitnodiging mislukt', tone: 'warning' },
    ]);
  });

  it('toont bij inactieve medewerkers en zonder gegevens over inloggen alleen wat er al stond', () => {
    expect(onboardingBadges(person({ isActive: false }), { invite: 'sent', lastSignInAt: '2026-10-06T12:05:00Z', devices: 1 })).toEqual([
      { label: 'uitgenodigd', tone: 'success' },
    ]);
    // Zonder de functie in de database (bundel nog niet opnieuw gedraaid) weet Planbord het niet.
    expect(onboardingBadges(person(), { invite: 'sent', lastSignInAt: undefined, devices: 1 })).toEqual([
      { label: 'uitgenodigd', tone: 'success' },
    ]);
  });

  it('telt de toestellen met meldingen per medewerker', () => {
    expect([...countByEmployee([{ employee_id: 'sanne' }, { employee_id: 'joris' }, { employee_id: 'sanne' }])]).toEqual([
      ['sanne', 2],
      ['joris', 1],
    ]);
  });

  it('vat samen hoeveel actieve collega’s met een account zijn ingelogd en meldingen aan hebben', () => {
    const employees = [
      person({ id: 'sanne' }),
      person({ id: 'joris' }),
      person({ id: 'danique' }),
      person({ id: 'oud', isActive: false }),
      person({ id: 'nieuw', hasAccount: false }),
    ];
    const signIns = new Map([
      ['sanne', '2026-10-06T12:05:00Z'],
      ['joris', '2026-10-05T08:00:00Z'],
      ['danique', null],
      ['oud', '2026-01-01T08:00:00Z'],
    ]);
    const devices = new Map([
      ['sanne', 1],
      ['oud', 1],
    ]);
    const summary = onboardingSummary(employees, signIns, devices);
    expect(summary).toEqual({ withAccount: 3, signedIn: 2, notifications: 1 });
    expect(onboardingSummaryText(summary)).toBe("2 van de 3 collega's met een inlogaccount zijn ingelogd. 1 heeft meldingen aan.");
    expect(onboardingSummaryText({ withAccount: 5, signedIn: 1, notifications: 0 })).toBe(
      "1 van de 5 collega's met een inlogaccount is ingelogd. 0 hebben meldingen aan.",
    );
    expect(onboardingSummary(employees, null, devices)).toBeNull();
    expect(onboardingSummaryText(null)).toBeNull();
    expect(onboardingSummaryText({ withAccount: 0, signedIn: 0, notifications: 0 })).toBeNull();
  });
});
