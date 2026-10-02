import { describe, expect, it } from 'vitest';
import { absence, substitution, teamSnapshot } from '../engine/__fixtures__/team';
import { absenceImpact } from '../engine/impact';
import {
  attentionItems,
  buildGapDetail,
  buildGapViews,
  dayPartsLabel,
  impactLines,
  planningWindow,
  reviewSummary,
  safeReturnPath,
  substitutionItems,
  warningTexts,
  withNotice,
} from './planning';

const MON = '2026-10-12';
const lotteAway = teamSnapshot({ absences: [absence('a1', 'lotte', MON)] });

describe('Nog te regelen', () => {
  it('kijkt vanaf vandaag zoveel weken vooruit als ingesteld', () => {
    expect(planningWindow('2026-10-01', 8)).toEqual({ from: '2026-10-01', to: '2026-11-25' });
  });

  it('toont per gat het tekort, de eerste drie voorstellen en een link naar alle keuzes', () => {
    const { gaps, ignored } = buildGapViews(lotteAway, { from: MON, to: MON }, []);
    expect(ignored).toEqual([]);
    expect(gaps).toHaveLength(1);
    expect(gaps[0]).toMatchObject({
      date: MON,
      dateLabel: 'ma 12 okt',
      groupName: 'Eindhoven',
      parts: [
        { dayPart: 'morning', label: 'ochtend 1/2', shortage: 1 },
        { dayPart: 'afternoon', label: 'middag 1/2', shortage: 1 },
      ],
      dayParts: ['morning', 'afternoon'],
      candidateCount: 4,
      href: '/beheer/regelen/eindhoven/2026-10-12',
    });
    expect(gaps[0]?.proposals.map((candidate) => candidate.name)).toEqual(['Danique', 'Hans', 'Sanne']);
  });

  it('zet genegeerde gaten apart', () => {
    const { gaps, ignored } = buildGapViews(lotteAway, { from: MON, to: MON }, [
      { groupId: 'eindhoven', date: MON, dayPart: 'morning', shortage: 1 },
    ]);
    expect(gaps.map((gap) => gap.parts.map((part) => part.dayPart))).toEqual([['afternoon']]);
    expect(ignored.map((gap) => gap.parts.map((part) => part.dayPart))).toEqual([['morning']]);
  });

  it('geeft op de pagina van een gat keuzes voor het hele gat en per dagdeel', () => {
    const detail = buildGapDetail(lotteAway, MON, 'eindhoven', []);
    expect(detail?.options.map((option) => [option.label, option.candidates.length])).toEqual([
      ['ochtend en middag', 4],
      ['ochtend', 4],
      ['middag', 4],
    ]);
    expect(detail?.options[0]?.excluded.map((item) => item.name)).toEqual([
      'Daan',
      'Lotte',
      'Milan',
      'Zoë',
    ]);
    expect(detail?.ignored).toBe(false);
    expect(buildGapDetail(lotteAway, MON, 'logistics', [])).toBeNull();
  });

  it('heeft geen keuzes als er geen tekort is', () => {
    expect(buildGapDetail(teamSnapshot(), MON, 'eindhoven', [])?.options).toEqual([]);
  });
});

describe('Let op', () => {
  const names = new Map([
    ['danique', 'Danique'],
    ['hans', 'Hans'],
  ]);
  const groupNames = new Map([['eindhoven', 'Eindhoven']]);

  it('toont vervallen invallen tot ze zijn afgehandeld', () => {
    const items = attentionItems(
      [
        substitution('s1', 'danique', MON, 'eindhoven', ['morning', 'afternoon'], { status: 'not_needed' }),
        substitution('s2', 'hans', MON, 'eindhoven', ['afternoon'], { status: 'reschedule' }),
        substitution('s3', 'hans', MON, 'eindhoven', ['morning'], { status: 'not_needed', handledAt: '2026-10-02T10:00:00Z' }),
        substitution('s4', 'hans', MON, 'eindhoven'),
      ],
      names,
      groupNames,
    );
    expect(items.map((item) => item.text)).toEqual([
      'Niet meer nodig: Danique (Eindhoven, ma 12 okt, ochtend en middag). Laat het de invaller weten.',
      'Opnieuw regelen: Hans kan niet invallen (Eindhoven, ma 12 okt, middag). Het gat staat weer bij Nog te regelen.',
    ]);
  });

  it('zegt erbij als de mail aan de invaller niet is verstuurd (fase 3, V19)', () => {
    const states = new Map([
      ['danique|2026-10-12', 'failed' as const],
      ['hans|2026-10-12', 'no-address' as const],
    ]);
    const items = attentionItems(
      [
        substitution('s1', 'danique', MON, 'eindhoven', ['morning', 'afternoon'], { status: 'not_needed' }),
        substitution('s2', 'hans', MON, 'eindhoven', ['afternoon'], { status: 'not_needed' }),
      ],
      names,
      groupNames,
      (employeeId, date) => states.get(`${employeeId}|${date}`) ?? null,
    );
    expect(items.map((item) => item.text)).toEqual([
      'Niet meer nodig: Danique (Eindhoven, ma 12 okt, ochtend en middag). De mail aan de invaller is niet gelukt; laat het hem zelf weten.',
      'Niet meer nodig: Hans (Eindhoven, ma 12 okt, middag). De invaller heeft geen werkmail; laat het hem zelf weten.',
    ]);
    expect(
      attentionItems(
        [substitution('s1', 'danique', MON, 'eindhoven', ['morning'], { status: 'not_needed' })],
        names,
        groupNames,
        () => 'off',
      )[0]?.text,
    ).toBe('Niet meer nodig: Danique (Eindhoven, ma 12 okt, ochtend). Mails staan uit; laat het de invaller weten.');
    expect(
      attentionItems(
        [substitution('s1', 'danique', MON, 'eindhoven', ['morning'], { status: 'not_needed' })],
        names,
        groupNames,
        () => 'pending',
      )[0]?.text,
    ).toBe('Niet meer nodig: Danique (Eindhoven, ma 12 okt, ochtend). De mail aan de invaller wordt nog verstuurd.');
  });

  it('beschrijft invallen die niet meer kloppen', () => {
    expect(
      warningTexts(
        [{ substitutionId: 's1', employeeId: 'danique', date: MON, groupId: 'eindhoven', status: 'reschedule', reason: 'werkt die dag niet meer' }],
        names,
        groupNames,
      ),
    ).toEqual(['De inval van Danique (Eindhoven, ma 12 okt) klopt niet meer: werkt die dag niet meer. Wordt: opnieuw regelen.']);
    expect(dayPartsLabel(['morning'])).toBe('ochtend');
  });
});

describe('impactcheck in gewone zinnen', () => {
  const names = new Map([['danique', 'Danique']]);
  const groupNames = new Map([['eindhoven', 'Eindhoven']]);

  it('zet ochtend en middag van één dag op één regel, met het voorstel', () => {
    const impact = absenceImpact(teamSnapshot(), { previous: null, next: absence('new', 'lotte', MON) }, '2026-10-01');
    expect(impactLines(impact, names, groupNames)).toEqual(['Eindhoven, ma 12 okt: ochtend 1/2, middag 1/2 · voorstel: Danique.']);
  });

  it('noemt vervallen invallen', () => {
    const snapshot = teamSnapshot({ absences: [absence('a1', 'lotte', MON)], substitutions: [substitution('s1', 'danique', MON, 'eindhoven')] });
    const impact = absenceImpact(snapshot, { previous: null, next: absence('new', 'danique', MON) }, '2026-10-01');
    expect(impactLines(impact, names, groupNames).at(-1)).toBe(
      'De inval van Danique in Eindhoven op ma 12 okt moet opnieuw geregeld worden (is zelf afwezig).',
    );
  });

  it('kort een lange lijst in', () => {
    // Milan is al afwezig; als Daan er ook drie weken niet is, zakt Eindhoven elke werkdag onder de norm.
    const snapshot = teamSnapshot({ absences: [absence('a1', 'milan', MON, '2026-10-29')] });
    const impact = absenceImpact(snapshot, { previous: null, next: absence('new', 'daan', MON, '2026-10-29') }, '2026-10-01');
    expect(impact.parts.length).toBeGreaterThan(8);
    const lines = impactLines(impact, names, groupNames);
    expect(lines).toHaveLength(9);
    expect(lines.at(-1)).toMatch(/^En nog \d+ gevolg\(en\)\.$/);
  });
});

describe('terugweg na een actie', () => {
  it('staat alleen paden binnen beheer en rooster toe', () => {
    expect(safeReturnPath('/beheer/regelen/eindhoven/2026-10-12', '/beheer')).toBe('/beheer/regelen/eindhoven/2026-10-12');
    expect(safeReturnPath('/rooster/den-bosch?week=2026-W42', '/beheer')).toBe('/rooster/den-bosch?week=2026-W42');
    expect(safeReturnPath('https://example.com', '/beheer')).toBe('/beheer');
    expect(safeReturnPath('//example.com', '/beheer')).toBe('/beheer');
    expect(safeReturnPath('/beheer//x', '/beheer')).toBe('/beheer');
    expect(safeReturnPath(null, '/beheer')).toBe('/beheer');
  });

  it('zet een melding in de URL', () => {
    expect(withNotice('/beheer', 'ingezet')).toBe('/beheer?melding=ingezet');
    expect(withNotice('/rooster/breda?week=2026-W42&melding=oud', 'ingezet')).toBe('/rooster/breda?week=2026-W42&melding=ingezet');
  });

  it('zet ook de uitkomst van de mails in de URL, en haalt een oude weg', () => {
    expect(withNotice('/beheer', 'ingezet', 'verstuurd')).toBe('/beheer?melding=ingezet&mail=verstuurd');
    expect(withNotice('/beheer?mail=mislukt', 'ingezet', null)).toBe('/beheer?melding=ingezet');
  });
});

describe('samenvatting van de controle', () => {
  const change = { substitutionId: 's1', employeeId: 'danique', date: MON, groupId: 'eindhoven', reason: '' };
  it('telt per uitkomst', () => {
    expect(reviewSummary([])).toBe('');
    expect(reviewSummary([{ ...change, status: 'not_needed' }])).toBe('1 inval is niet meer nodig. Zie "Let op" op het overzicht.');
    expect(
      reviewSummary([
        { ...change, status: 'not_needed' },
        { ...change, status: 'reschedule' },
        { ...change, status: 'reschedule' },
      ]),
    ).toBe('1 inval is niet meer nodig; 2 invallen moeten opnieuw geregeld worden. Zie "Let op" op het overzicht.');
  });
});

describe('lijst met invallen', () => {
  it('toont naam, vestiging, dag, dagdelen en wat er nog kan', () => {
    const items = substitutionItems(
      [
        substitution('s2', 'hans', '2026-10-13', 'eindhoven', ['afternoon'], { status: 'not_needed' }),
        substitution('s1', 'danique', MON, 'eindhoven'),
        substitution('s0', 'danique', '2026-09-30', 'eindhoven'),
      ],
      new Map([
        ['danique', 'Danique'],
        ['hans', 'Hans'],
      ]),
      new Map([['eindhoven', 'Eindhoven']]),
      '2026-10-01',
    );
    expect(items.map((item) => [item.title, item.detail, item.statusLabel, item.canWithdraw, item.needsHandling])).toEqual([
      ['Danique → Eindhoven', 'wo 30 sep · ochtend en middag', 'gaat door', false, false],
      ['Danique → Eindhoven', 'ma 12 okt · ochtend en middag', 'gaat door', true, false],
      ['Hans → Eindhoven', 'di 13 okt · middag', 'niet meer nodig', false, true],
    ]);
  });
});
