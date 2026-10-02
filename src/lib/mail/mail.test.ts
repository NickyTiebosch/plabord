import { describe, expect, it } from 'vitest';
import {
  absence,
  employees,
  groups,
  override,
  substitution,
  teamSnapshot,
} from '../engine/__fixtures__/team';
import { composeMail, escapeHtml, formatDateList, personalDaysFor } from './messages';
import { cancelledSubstitutionNotices, mergeNotices } from './notices';
import { MAX_ATTEMPTS, queueCleanupBefore, reminderDateAt, reminderTargets, shouldRetry } from './reminders';

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
});
