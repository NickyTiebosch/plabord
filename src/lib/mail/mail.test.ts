import { describe, expect, it } from 'vitest';
import {
  absence,
  employees,
  groups,
  override,
  substitution,
  teamSnapshot,
} from '../engine/__fixtures__/team';
import { reviewNotices } from '../db/review';
import { ConfigError } from '../env';
import { MAIL_KIND_LABELS, mailFailureReason, mailStatusLabel, previewReminderDate, pushLabel, testMailErrorText } from './labels';
import { inviteEveryoneText, inviteState, inviteStatusText, inviteTargets, latestInvites } from './invites';
import { composeMail, escapeHtml, formatDateList, guideUrl, personalDaysFor } from './messages';
import { cancelledSubstitutionNotices, mergeNotices } from './notices';
import { isMailOutcome, mailOutcome, NO_MAILS } from './outcome';
import { MAX_ATTEMPTS, queueCleanupBefore, reminderDateAt, reminderTargets, shouldRetry } from './reminders';
import { failureCode, mailErrorCode, mailFailure, serverUnavailable } from './smtp-errors';
import { alwaysSent } from './types';

const WED = '2026-10-14';

describe('mails: wanneer de herinnering komt (V15)', () => {
  it('om 16:00 in Amsterdam, voor de dag erna', () => {
    expect(reminderDateAt(new Date('2026-10-14T14:00:00Z'))).toBe('2026-10-15');
    expect(reminderDateAt(new Date('2026-10-14T14:59:00Z'))).toBe('2026-10-15');
    expect(reminderDateAt(new Date('2026-10-14T13:59:00Z'))).toBeNull();
    expect(reminderDateAt(new Date('2026-10-14T15:00:00Z'))).toBeNull();
  });

  it('op vrijdag voor zaterdag, op zondag voor maandag, en op zaterdag niet', () => {
    expect(reminderDateAt(new Date('2026-10-16T14:00:00Z'))).toBe('2026-10-17');
    expect(reminderDateAt(new Date('2026-10-17T14:00:00Z'))).toBeNull();
    expect(reminderDateAt(new Date('2026-10-18T14:00:00Z'))).toBe('2026-10-19');
  });

  it('ook rond de wisseling van zomer- en wintertijd', () => {
    // 25 oktober 2026: de klok gaat terug, 16:00 is dan 15:00 UTC.
    expect(reminderDateAt(new Date('2026-10-25T15:00:00Z'))).toBe('2026-10-26');
    expect(reminderDateAt(new Date('2026-10-25T14:00:00Z'))).toBeNull();
    // 29 maart 2026: de klok gaat vooruit, 16:00 is dan 14:00 UTC.
    expect(reminderDateAt(new Date('2026-03-29T14:00:00Z'))).toBe('2026-03-30');
    expect(reminderDateAt(new Date('2026-03-29T15:00:00Z'))).toBeNull();
  });
});

describe('mails: wie krijgt een herinnering', () => {
  const names = (snapshot: ReturnType<typeof teamSnapshot>, date = WED) =>
    reminderTargets(snapshot, date).map((target) => target.name);

  it('niemand als iedereen volgens zijn vaste rooster werkt', () => {
    expect(names(teamSnapshot())).toEqual([]);
  });

  it('wie invalt, een andere dienst heeft of door een wijziging vrij is', () => {
    const snapshot = teamSnapshot({
      substitutions: [substitution('s1', 'danique', WED, 'eindhoven', ['afternoon'])],
      shiftOverrides: [
        override('o1', 'sanne', WED, { kind: 'shift', groupId: 'breda', role: 'counter' }),
        override('o2', 'joris', WED, { kind: 'off' }),
      ],
    });
    expect(names(snapshot)).toEqual(['Danique', 'Joris', 'Sanne']);
  });

  it('niet bij afwezigheid de hele dag, wel bij een halve dag', () => {
    const snapshot = teamSnapshot({
      substitutions: [substitution('s1', 'danique', WED, 'eindhoven', ['afternoon'])],
      shiftOverrides: [override('o1', 'fleur', WED, { kind: 'off' }), override('o2', 'sanne', WED, { kind: 'off' })],
      absences: [absence('a1', 'danique', WED), absence('a2', 'sanne', WED, WED, { dayPart: 'morning' })],
    });
    expect(names(snapshot)).toEqual(['Fleur', 'Sanne']);
  });

  it('niet als de vestiging die dag dicht is, en niet voor wie inactief is', () => {
    // Koningsdag: alles dicht.
    const kingsDay = teamSnapshot({
      shiftOverrides: [override('o1', 'sanne', '2026-04-27', { kind: 'shift', groupId: 'breda', role: 'counter' })],
    });
    expect(names(kingsDay, '2026-04-27')).toEqual([]);
    const inactive = teamSnapshot({
      employees: employees.map((employee) => (employee.id === 'danique' ? { ...employee, isActive: false } : employee)),
      substitutions: [substitution('s1', 'danique', WED, 'eindhoven', ['afternoon'])],
    });
    expect(names(inactive)).toEqual([]);
  });
});

describe('mails: één mail per persoon per actie (V14)', () => {
  it('voegt mails per persoon samen, met de dagen op volgorde', () => {
    expect(
      mergeNotices(
        [
          { employeeId: 'sanne', kind: 'day_changed', dates: ['2026-10-16'] },
          { employeeId: 'sanne', kind: 'day_changed', dates: ['2026-10-14', '2026-10-16'] },
          { employeeId: 'danique', kind: 'substitution_assigned', dates: [WED] },
        ],
        WED,
      ),
    ).toEqual([
      { employeeId: 'danique', kind: 'substitution_assigned', dates: [WED] },
      { employeeId: 'sanne', kind: 'day_changed', dates: ['2026-10-14', '2026-10-16'] },
    ]);
  });

  it('maakt van verschillende soorten "rooster gewijzigd"', () => {
    expect(
      mergeNotices(
        [
          { employeeId: 'danique', kind: 'substitution_cancelled', dates: [WED] },
          { employeeId: 'danique', kind: 'day_changed', dates: ['2026-10-15'] },
        ],
        WED,
      ),
    ).toEqual([{ employeeId: 'danique', kind: 'day_changed', dates: [WED, '2026-10-15'] }]);
  });

  it('mailt niet over het verleden', () => {
    expect(
      mergeNotices(
        [
          { employeeId: 'sanne', kind: 'day_changed', dates: ['2026-10-13', WED] },
          { employeeId: 'joris', kind: 'day_changed', dates: ['2026-10-13'] },
        ],
        WED,
      ),
    ).toEqual([{ employeeId: 'sanne', kind: 'day_changed', dates: [WED] }]);
  });

  it('mailt een invaller niet over een vervallen inval als hij die dag zelf afwezig is', () => {
    const absent = new Set(['danique|2026-10-14']);
    expect(
      cancelledSubstitutionNotices(
        [
          { employeeId: 'danique', date: WED },
          { employeeId: 'sanne', date: WED },
        ],
        (employeeId, date) => absent.has(`${employeeId}|${date}`),
      ),
    ).toEqual([{ employeeId: 'sanne', kind: 'substitution_cancelled', dates: [WED] }]);
  });
});

describe('mails: de tekst', () => {
  const withSubstitution = teamSnapshot({ substitutions: [substitution('s1', 'danique', WED, 'eindhoven', ['afternoon'])] });

  function mail(kind: Parameters<typeof composeMail>[0]['kind'], snapshot = withSubstitution, dates = [WED], employeeId = 'danique') {
    const name = employees.find((employee) => employee.id === employeeId)?.name ?? '';
    return composeMail({
      kind,
      name,
      days: personalDaysFor(snapshot, employeeId, dates),
      groups,
      appUrl: 'https://planbord.example/',
    });
  }

  it('noemt de dagen zoals in de app', () => {
    expect(formatDateList([WED])).toBe('wo 14 okt');
    expect(formatDateList(['2026-10-12', WED])).toBe('ma 12 okt en wo 14 okt');
    expect(formatDateList(['2026-10-12', '2026-10-13', WED])).toBe('ma 12 okt, di 13 okt en wo 14 okt');
  });

  it('zegt bij een inval waar en wanneer, met het rooster van die dag', () => {
    const content = mail('substitution_assigned');
    expect(content.subject).toBe('Planbord: je valt in op wo 14 okt');
    expect(content.text).toBe(
      [
        'Hoi Danique,',
        '',
        'Je valt in op wo 14 okt.',
        '',
        'Zo ziet je rooster er nu uit:',
        '',
        'wo 14 okt',
        '- Invallen in Eindhoven · balie · 13:00–18:00',
        '- Backoffice · backoffice · 07:30–13:00 (deels elders invallen)',
        '',
        'Bekijk je rooster in Planbord: https://planbord.example/',
        '',
        'Deze mail komt van Planbord, de planning van het verhuurteam.',
        '',
      ].join('\n'),
    );
  });

  it('zegt wanneer een inval niet doorgaat, en hoe de dag er nu uitziet', () => {
    const content = mail('substitution_cancelled', teamSnapshot());
    expect(content.subject).toBe('Planbord: je inval op wo 14 okt gaat niet door');
    expect(content.text).toContain('Je inval op wo 14 okt gaat niet door.');
    expect(content.text).toContain('- Backoffice · backoffice · 07:30–18:00');
  });

  it('spreekt zichzelf nooit tegen als het rooster intussen anders is', () => {
    expect(mail('substitution_assigned', teamSnapshot()).subject).toBe('Planbord: je rooster voor wo 14 okt is gewijzigd');
    expect(mail('substitution_cancelled').subject).toBe('Planbord: je rooster voor wo 14 okt is gewijzigd');
  });

  it('meldt een roosterwijziging, ook geen dienst, over meerdere dagen', () => {
    const snapshot = teamSnapshot({
      shiftOverrides: [
        override('o1', 'sanne', '2026-10-12', { kind: 'off' }),
        override('o2', 'sanne', WED, { kind: 'shift', groupId: 'breda', role: 'counter', startTime: '09:00', endTime: '17:00' }),
      ],
    });
    const content = mail('day_changed', snapshot, [WED, '2026-10-12'], 'sanne');
    expect(content.subject).toBe('Planbord: je rooster voor ma 12 okt en wo 14 okt is gewijzigd');
    expect(content.text).toContain('ma 12 okt\n- Geen dienst (gewijzigd)');
    expect(content.text).toContain('wo 14 okt\n- Breda · balie · 09:00–17:00 (gewijzigd)');
  });

  it('herinnert de dag ervoor', () => {
    const content = mail('reminder');
    expect(content.subject).toBe('Planbord: morgen (wo 14 okt) wijkt je rooster af');
    expect(content.text).toContain('Morgen, wo 14 okt, wijkt je rooster af van je vaste rooster.');
  });

  it('heeft een testmail zonder rooster', () => {
    const content = composeMail({ kind: 'test', name: 'Anna de Boer', days: [], groups, appUrl: null });
    expect(content.subject).toBe('Planbord: testmail');
    expect(content.text).toBe(
      [
        'Hoi Anna,',
        '',
        'Dit is een testmail van Planbord. Komt hij aan, dan werkt het versturen van mails.',
        '',
        'Deze mail komt van Planbord, de planning van het verhuurteam.',
        '',
      ].join('\n'),
    );
  });

  it('noemt alleen het eigen rooster: geen collega’s en geen e-mailadressen', () => {
    const snapshot = teamSnapshot({
      substitutions: [substitution('s1', 'danique', WED, 'eindhoven', ['afternoon'])],
      absences: [absence('a1', 'lotte', WED)],
    });
    const content = mail('substitution_assigned', snapshot);
    const others = employees.filter((employee) => employee.id !== 'danique').map((employee) => employee.name);
    for (const name of others) {
      expect(content.text).not.toContain(name);
      expect(content.html).not.toContain(name);
    }
    expect(content.text).not.toContain('@');
    expect(content.html).not.toMatch(/<img|<script/i);
  });

  it('ontsnapt tekst in de html-versie', () => {
    expect(escapeHtml(`<b>"Eva" & 'Bo'</b>`)).toBe('&lt;b&gt;&quot;Eva&quot; &amp; &#39;Bo&#39;&lt;/b&gt;');
    const renamed = groups.map((group) => (group.id === 'eindhoven' ? { ...group, name: 'Eindhoven & <Zuid>' } : group));
    const content = composeMail({
      kind: 'substitution_assigned',
      name: 'Danique',
      days: personalDaysFor(withSubstitution, 'danique', [WED]),
      groups: renamed,
      appUrl: null,
    });
    expect(content.html).toContain('Invallen in Eindhoven &amp; &lt;Zuid&gt;');
    expect(content.html).not.toContain('<Zuid>');
  });
});

describe('mails: opnieuw proberen en opruimen', () => {
  const base = { kind: 'day_changed' as const, status: 'failed' as const, attempts: 1, dates: [WED] };

  it('probeert een mislukte mail opnieuw, hooguit drie keer, en niet over het verleden', () => {
    expect(shouldRetry(base, WED)).toBe(true);
    expect(shouldRetry({ ...base, status: 'pending' }, WED)).toBe(true);
    expect(shouldRetry({ ...base, attempts: MAX_ATTEMPTS }, WED)).toBe(false);
    expect(shouldRetry({ ...base, status: 'sent' }, WED)).toBe(false);
    expect(shouldRetry({ ...base, status: 'skipped' }, WED)).toBe(false);
    expect(shouldRetry(base, '2026-10-15')).toBe(false);
    expect(shouldRetry({ ...base, kind: 'test', dates: [] }, WED)).toBe(false);
  });

  it('ruimt regels op die ouder zijn dan 90 dagen', () => {
    expect(queueCleanupBefore(new Date('2026-10-14T12:00:00Z'))).toBe('2026-07-16T12:00:00.000Z');
  });

  it('stopt na een fout van de mailserver zelf, maar niet als één adres wordt geweigerd', () => {
    const smtpError = (code: string) => Object.assign(new Error('550 geweigerd: iemand@voorbeeld.nl'), { code });
    for (const code of ['ECONNECTION', 'ETIMEDOUT', 'ESOCKET', 'EDNS', 'ETLS', 'EAUTH']) expect(serverUnavailable(smtpError(code))).toBe(true);
    expect(serverUnavailable(smtpError('EENVELOPE'))).toBe(false);
    expect(serverUnavailable(smtpError('EMESSAGE'))).toBe(false);
    expect(serverUnavailable(new Error('iets anders'))).toBe(false);
    expect(serverUnavailable('geen fout')).toBe(false);
  });

  it('logt alleen de code van een fout, nooit de melding met het adres', () => {
    expect(mailErrorCode(Object.assign(new Error('geweigerd: iemand@voorbeeld.nl'), { code: 'EENVELOPE' }))).toBe('EENVELOPE');
    expect(mailErrorCode(new TypeError('iemand@voorbeeld.nl'))).toBe('TypeError');
    expect(mailErrorCode(null)).toBe('onbekend');
  });
});

describe('mails: de melding na een actie', () => {
  it('zegt in één woord hoe het met de mails ging', () => {
    expect(mailOutcome(NO_MAILS)).toBeNull();
    expect(mailOutcome({ ...NO_MAILS, sent: 2 })).toBe('verstuurd');
    expect(mailOutcome({ ...NO_MAILS, failed: 1 })).toBe('mislukt');
    expect(mailOutcome({ ...NO_MAILS, disabled: 3 })).toBe('uit');
    expect(mailOutcome({ ...NO_MAILS, noAddress: 1 })).toBe('geen-adres');
    expect(mailOutcome({ ...NO_MAILS, sent: 1, failed: 1 })).toBe('deels');
    expect(mailOutcome({ ...NO_MAILS, sent: 1, noAddress: 1 })).toBe('deels');
  });

  it('herkent alleen bekende codes uit de URL', () => {
    expect(isMailOutcome('verstuurd')).toBe(true);
    expect(isMailOutcome('toString')).toBe(false);
    expect(isMailOutcome(undefined)).toBe(false);
  });
});

describe('mails: vervallen invallen na de controle', () => {
  const sub = substitution('s1', 'danique', WED, 'eindhoven', ['afternoon']);
  const change = { substitutionId: 's1', employeeId: 'danique', date: WED, groupId: 'eindhoven', reason: '' };

  it('mailt de invaller, ook als hij alleen in een ander dagdeel afwezig is', () => {
    const snapshot = teamSnapshot({ substitutions: [sub], absences: [absence('a1', 'danique', WED, WED, { dayPart: 'morning' })] });
    expect(reviewNotices(snapshot, [{ ...change, status: 'not_needed' }])).toEqual([
      { employeeId: 'danique', kind: 'substitution_cancelled', dates: [WED] },
    ]);
  });

  it('mailt niet als hij afwezig is in een dagdeel van de inval', () => {
    const snapshot = teamSnapshot({ substitutions: [sub], absences: [absence('a1', 'danique', WED, WED, { dayPart: 'afternoon' })] });
    expect(reviewNotices(snapshot, [{ ...change, status: 'reschedule' }])).toEqual([]);
  });
});

describe('mails: woorden in het beheer', () => {
  it('noemt soort en status in gewone taal', () => {
    expect(MAIL_KIND_LABELS.substitution_cancelled).toBe('Inval gaat niet door');
    expect(mailStatusLabel('sent', null, 1)).toBe('verstuurd');
    expect(mailStatusLabel('failed', 'versturen mislukt', 1)).toBe('mislukt');
    expect(mailStatusLabel('failed', 'versturen mislukt', 3)).toBe('mislukt (3× geprobeerd)');
    expect(mailStatusLabel('skipped', 'mails uit', 0)).toBe('niet verstuurd: mails uit');
    expect(mailStatusLabel('skipped', 'geen werkmail', 0)).toBe('niet verstuurd: geen werkmail');
  });

  it('noemt naar hoeveel toestellen de push ging (fase 4)', () => {
    expect(pushLabel(0)).toBeNull();
    expect(pushLabel(1)).toBe('push naar 1 toestel');
    expect(pushLabel(3)).toBe('push naar 3 toestellen');
  });

  it('toont het voorbeeld voor de eerstvolgende werkdag', () => {
    expect(previewReminderDate('2026-10-14')).toEqual({ date: '2026-10-15', sendDate: '2026-10-14' });
    // Op zaterdag: de herinneringen voor maandag gaan zondag weg.
    expect(previewReminderDate('2026-10-17')).toEqual({ date: '2026-10-19', sendDate: '2026-10-18' });
    expect(previewReminderDate('2026-10-16')).toEqual({ date: '2026-10-17', sendDate: '2026-10-16' });
  });
});

describe('mails: de uitnodiging (V33)', () => {
  const invite = composeMail({ kind: 'invite', name: 'Sanne de Vries', days: [], groups, appUrl: 'https://planbord.example/' });

  it('legt uit hoe je begint, met een link naar de app en de uitleg', () => {
    expect(invite.subject).toBe('Je bent uitgenodigd voor Planbord');
    expect(invite.text).toBe(
      [
        'Hoi Sanne,',
        '',
        'Je bent uitgenodigd voor Planbord, de planning van het verhuurteam. Je ziet er je eigen diensten, het rooster van je vestiging en wie er afwezig is.',
        '',
        'Zo begin je:',
        '1. Open Planbord op je telefoon: https://planbord.example/',
        '   Op een iPhone in Safari, op Android in Chrome (niet in Samsung Internet).',
        '2. Zet Planbord op je beginscherm. Dat hoeft maar één keer.',
        '   - iPhone: tik op de deelknop (het vierkantje met het pijltje; op nieuwere iPhones zit hij achter •••). Kies Zet op beginscherm, laat Open als webapp aan staan en tik op Voeg toe.',
        '   - Android: tik rechtsboven op ⋮, kies App installeren (of Toevoegen aan startscherm) en tik op Installeren.',
        '3. Open Planbord voortaan via het icoon en log in met je werkmail: het adres waarop je deze mail krijgt. Je krijgt dan een mail met een code van 6 cijfers. Vul de code in. Een wachtwoord is niet nodig.',
        '4. Vergeet niet de meldingen aan te zetten. Scrol op Mijn rooster helemaal naar beneden, tik op Meldingen aanzetten en kies Sta toe (iPhone) of Toestaan (Android). Dan krijg je een melding als je rooster verandert.',
        '',
        "Korte video's van elke stap: https://planbord.example/uitleg",
        '',
        'Deze mail komt van Planbord, de planning van het verhuurteam.',
        '',
      ].join('\n'),
    );
    expect(guideUrl('https://planbord-ten.vercel.app/')).toBe('https://planbord-ten.vercel.app/uitleg');
  });

  it('zet in de html dezelfde stappen, met iPhone en Android apart', () => {
    expect(invite.html).toContain('<li>Open <a href="https://planbord.example/">Planbord</a> op je telefoon. Op een iPhone in Safari, op Android in Chrome (niet in Samsung Internet).</li>');
    expect(invite.html).toContain('<li><strong>iPhone:</strong> tik op de deelknop');
    expect(invite.html).toContain('<li><strong>Android:</strong> tik rechtsboven op ⋮, kies App installeren (of Toevoegen aan startscherm) en tik op Installeren.</li>');
    expect(invite.html).toContain('<strong>Vergeet niet de meldingen aan te zetten.</strong> Scrol op Mijn rooster');
    expect(invite.html.match(/<li>/g)).toHaveLength(6);
  });

  it('heeft geen inloglink, geen plaatjes en geen namen of adressen van anderen', () => {
    const links = [...invite.html.matchAll(/href="([^"]+)"/g)].map((match) => match[1]);
    expect(links).toEqual(['https://planbord.example/', 'https://planbord.example/uitleg']);
    expect(invite.html).not.toMatch(/<img|<script/i);
    expect(invite.text).not.toContain('@');
    for (const other of employees.filter((employee) => employee.id !== 'sanne')) {
      expect(invite.text).not.toContain(other.name);
      expect(invite.html).not.toContain(other.name);
    }
  });

  it('werkt ook zonder het adres van de app', () => {
    const plain = composeMail({ kind: 'invite', name: 'Bo', days: [], groups, appUrl: null });
    expect(plain.text).toContain('1. Open Planbord op je telefoon.\n   Op een iPhone in Safari, op Android in Chrome (niet in Samsung Internet).\n2. Zet Planbord');
    expect(plain.text).not.toContain('http');
    expect(plain.html).not.toContain('href');
  });

  it('gaat altijd, zonder push, en blijft het proberen hoewel hij geen datums heeft', () => {
    expect(alwaysSent('invite')).toBe(true);
    expect(alwaysSent('test')).toBe(true);
    expect(alwaysSent('reminder')).toBe(false);
    const queued = { kind: 'invite' as const, status: 'failed' as const, attempts: 1, dates: [] };
    expect(shouldRetry(queued, WED)).toBe(true);
    expect(shouldRetry({ ...queued, attempts: MAX_ATTEMPTS }, WED)).toBe(false);
    expect(shouldRetry({ ...queued, status: 'sent' }, WED)).toBe(false);
  });

  const NOW = new Date('2026-10-06T15:00:00Z');
  const inviteRow = (
    employeeId: string,
    status: 'sent' | 'pending' | 'failed' | 'skipped',
    createdAt = '2026-10-06T12:00:00Z',
    attempts = status === 'pending' ? 0 : 1,
  ) => ({ employeeId, status, createdAt, attempts, sentAt: status === 'sent' ? createdAt : null });
  const colleague = (id: string, overrides: Partial<{ isActive: boolean; hasAccount: boolean }> = {}) => ({
    id,
    isActive: true,
    hasAccount: true,
    ...overrides,
  });

  it('kiest bij Iedereen uitnodigen wie actief is, kan inloggen en geen uitnodiging heeft die verstuurd is of klaarstaat (V39)', () => {
    const people = [
      colleague('zelf'),
      colleague('nieuw'),
      colleague('verstuurd'),
      colleague('klaar'),
      colleague('mislukt'),
      colleague('gestopt'),
      colleague('overgeslagen'),
      colleague('later-gelukt'),
      colleague('later-mislukt'),
      colleague('inactief', { isActive: false }),
      colleague('geen-account', { hasAccount: false }),
    ];
    const invites = [
      inviteRow('verstuurd', 'sent'),
      inviteRow('klaar', 'pending'),
      inviteRow('mislukt', 'failed'),
      inviteRow('gestopt', 'failed', '2026-10-06T09:00:00Z', MAX_ATTEMPTS),
      inviteRow('overgeslagen', 'skipped'),
      // Per collega telt de laatste uitnodiging.
      inviteRow('later-gelukt', 'failed', '2026-10-06T09:00:00Z', MAX_ATTEMPTS),
      inviteRow('later-gelukt', 'sent', '2026-10-06T14:00:00Z'),
      inviteRow('later-mislukt', 'sent', '2026-10-01T09:00:00Z'),
      inviteRow('later-mislukt', 'failed', '2026-10-06T14:00:00Z'),
    ];
    expect(inviteTargets(people, invites, 'zelf', NOW)).toEqual(['nieuw', 'mislukt', 'gestopt', 'overgeslagen', 'later-mislukt']);
    expect(inviteEveryoneText(people, invites, 'zelf', NOW)).toEqual({
      count: 5,
      text: "2 collega's kunnen inloggen maar hebben nog geen uitnodiging gehad. Bij 3 collega's is de uitnodiging mislukt.",
    });
  });

  it('zegt bij Iedereen uitnodigen voor wie de knop is, ook in het enkelvoud', () => {
    const people = [colleague('zelf'), colleague('nieuw'), colleague('mislukt')];
    expect(inviteEveryoneText(people, [inviteRow('mislukt', 'failed')], 'zelf', NOW)).toEqual({
      count: 2,
      text: '1 collega kan inloggen maar heeft nog geen uitnodiging gehad. Bij 1 collega is de uitnodiging mislukt.',
    });
    expect(inviteEveryoneText(people, [inviteRow('nieuw', 'sent'), inviteRow('mislukt', 'failed')], 'zelf', NOW)).toEqual({
      count: 1,
      text: 'Bij 1 collega is de uitnodiging mislukt.',
    });
    expect(inviteEveryoneText(people, [inviteRow('nieuw', 'sent'), inviteRow('mislukt', 'pending')], 'zelf', NOW)).toEqual({
      count: 0,
      text: 'Iedereen die kan inloggen, heeft een uitnodiging gehad. Een nieuwe collega nodig je uit op diens pagina.',
    });
  });

  it('toont bij een medewerker de stand van de laatste uitnodiging', () => {
    expect(inviteStatusText(null, NOW)).toBe('Nog niet uitgenodigd.');
    // 22:30 UTC is in Amsterdam al de volgende dag.
    expect(inviteStatusText({ ...inviteRow('sanne', 'sent', '2026-10-06T22:29:00Z'), sentAt: '2026-10-06T22:30:00Z' }, NOW)).toBe(
      'Uitgenodigd op wo 7 okt.',
    );
    expect(inviteStatusText(inviteRow('sanne', 'pending'), NOW)).toBe('De uitnodiging wordt verstuurd.');
    expect(inviteStatusText(inviteRow('sanne', 'skipped'), NOW)).toBe('De uitnodiging is niet verstuurd: er was geen werkmail.');
    const latest = latestInvites([inviteRow('sanne', 'sent', '2026-10-06T09:00:00Z'), inviteRow('sanne', 'failed', '2026-10-01T09:00:00Z')]);
    expect(latest.get('sanne')?.status).toBe('sent');
    expect(MAIL_KIND_LABELS.invite).toBe('Uitnodiging');
  });

  it('zegt eerlijk of Planbord een mislukte uitnodiging nog opnieuw probeert (V39)', () => {
    expect(inviteStatusText(inviteRow('sanne', 'failed', '2026-10-06T12:00:00Z', 1), NOW)).toBe(
      'De uitnodiging is nog niet gelukt. Planbord probeert het elk uur opnieuw (nog 2 keer).',
    );
    expect(inviteStatusText(inviteRow('sanne', 'failed', '2026-10-06T12:00:00Z', 2), NOW)).toBe(
      'De uitnodiging is nog niet gelukt. Planbord probeert het elk uur opnieuw (nog 1 keer).',
    );
    const stopped =
      'De uitnodiging is niet gelukt en Planbord probeert het niet meer. Doe eerst een testmail (Beheer → Instellingen); lukt die, stuur hem dan opnieuw.';
    expect(inviteStatusText(inviteRow('sanne', 'failed', '2026-10-06T12:00:00Z', MAX_ATTEMPTS), NOW)).toBe(stopped);
    // Ouder dan een week: daar kijkt de geplande taak niet meer naar.
    expect(inviteStatusText(inviteRow('sanne', 'failed', '2026-09-29T14:59:00Z', 1), NOW)).toBe(stopped);
    expect(inviteStatusText(inviteRow('sanne', 'pending', '2026-09-29T14:59:00Z'), NOW)).toBe(stopped);
    expect(inviteState(inviteRow('sanne', 'failed', '2026-09-29T15:01:00Z', 1), NOW)).toBe('retrying');
    expect(inviteState(inviteRow('sanne', 'failed', '2026-09-29T14:59:00Z', 1), NOW)).toBe('failed');
    expect(inviteState(undefined, NOW)).toBe('none');
  });

  it('noemt een uitnodiging die door een nieuwe is vervangen (V39)', () => {
    expect(mailStatusLabel('skipped', 'vervangen', 1)).toBe('niet verstuurd: vervangen door een nieuwe');
  });
});

describe('mails: de oorzaak als versturen mislukt (V39)', () => {
  // De melding van de mailserver kan een adres bevatten; Planbord kijkt alleen naar de code.
  const smtpError = (code: string) => Object.assign(new Error('535 5.7.8 geweigerd: iemand@voorbeeld.nl'), { code });

  it('herkent het soort fout', () => {
    expect(mailFailure(new ConfigError('SMTP_PASSWORD'))).toEqual({ kind: 'config', variable: 'SMTP_PASSWORD' });
    expect(mailFailure(smtpError('EAUTH'))).toEqual({ kind: 'auth' });
    expect(mailFailure(smtpError('ENOAUTH'))).toEqual({ kind: 'auth' });
    for (const code of ['ECONNECTION', 'ETIMEDOUT', 'ESOCKET', 'EDNS', 'ETLS', 'EPROXY']) {
      expect(mailFailure(smtpError(code))).toEqual({ kind: 'connection' });
    }
    expect(mailFailure(smtpError('EENVELOPE'))).toEqual({ kind: 'rejected' });
    expect(mailFailure(smtpError('EMESSAGE'))).toEqual({ kind: 'rejected' });
    expect(mailFailure(new Error('iets anders'))).toEqual({ kind: 'unknown' });
    expect(mailFailure('geen fout')).toEqual({ kind: 'unknown' });
  });

  it('bewaart in de wachtrij een korte oorzaak, zonder adres of wachtwoord', () => {
    expect(failureCode({ kind: 'config', variable: 'SMTP_PASSWORD' })).toBe('mailserver niet ingesteld');
    expect(failureCode({ kind: 'auth' })).toBe('inloggen bij mailserver geweigerd');
    expect(failureCode({ kind: 'connection' })).toBe('mailserver onbereikbaar');
    expect(failureCode({ kind: 'rejected' })).toBe('mail geweigerd');
    expect(failureCode({ kind: 'unknown' })).toBe('versturen mislukt');
    expect(failureCode(null)).toBe('versturen mislukt');
  });

  it('toont in Beheer → Mails waarom een mail mislukte', () => {
    expect(mailFailureReason('failed', 'inloggen bij mailserver geweigerd')).toBe('inloggen bij mailserver geweigerd');
    expect(mailFailureReason('failed', 'mailserver onbereikbaar')).toBe('mailserver onbereikbaar');
    expect(mailFailureReason('failed', 'mailserver niet ingesteld')).toBe('mailserver niet ingesteld');
    expect(mailFailureReason('failed', 'mail geweigerd')).toBe('mail geweigerd');
    // Niets extra als het niets toevoegt, of als het geen bekende oorzaak is.
    expect(mailFailureReason('failed', 'versturen mislukt')).toBeNull();
    expect(mailFailureReason('failed', null)).toBeNull();
    expect(mailFailureReason('failed', 'iets anders')).toBeNull();
    expect(mailFailureReason('sent', null)).toBeNull();
    expect(mailFailureReason('skipped', 'mails uit')).toBeNull();
  });

  it('zegt bij de testmail wat er mis is en wat je doet', () => {
    expect(testMailErrorText({ kind: 'config', variable: 'SMTP_PASSWORD' })).toBe(
      'De testmail kon niet weg: in Vercel ontbreekt SMTP_PASSWORD. Vul die in bij Settings → Environment Variables en start daarna een nieuwe deploy (Deployments → de bovenste → ⋯ → Redeploy).',
    );
    expect(testMailErrorText({ kind: 'auth' })).toBe(
      'De mailserver weigert het inloggen: SMTP_USER of SMTP_PASSWORD klopt niet. Maak een nieuw app-wachtwoord voor die mailbox, zet het in Vercel bij SMTP_PASSWORD en start daarna een nieuwe deploy (Deployments → de bovenste → ⋯ → Redeploy).',
    );
    expect(testMailErrorText({ kind: 'connection' })).toBe(
      'De mailserver is niet bereikbaar. Controleer in Vercel SMTP_HOST en SMTP_PORT (bij Google: smtp.gmail.com en 465) en start daarna een nieuwe deploy (Deployments → de bovenste → ⋯ → Redeploy). Klopt dat, probeer het dan over een paar minuten opnieuw.',
    );
    expect(testMailErrorText({ kind: 'rejected' })).toBe(
      'De mailserver weigerde de testmail. Controleer in Vercel MAIL_FROM: dat moet het adres van de mailbox zijn, of een alias ervan. Controleer ook je eigen werkmail in Planbord.',
    );
    expect(testMailErrorText({ kind: 'unknown' })).toBe(
      'De testmail kon niet worden verstuurd. Controleer in Vercel SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD en MAIL_FROM (zie de README).',
    );
  });
});
