import { describe, expect, it } from 'vitest';
import { absence, override, substitution, teamSnapshot } from '../engine/__fixtures__/team';
import { absenceImpact } from '../engine/impact';
import { reviewSubstitutions } from '../engine/review';
import {
  attentionItems,
  buildGapDetail,
  buildGapViews,
  dayPartsLabel,
  gapPath,
  gapWeeks,
  impactLines,
  planningWindow,
  reviewSummary,
  safeReturnPath,
  substitutionItems,
  warningTexts,
  withNotice,
  withSelfCover,
} from './planning';

const MON = '2026-10-12';
const TUE = '2026-10-13';
const lotteAway = teamSnapshot({ absences: [absence('a1', 'lotte', MON)] });

describe('Nog te regelen', () => {
  it('kijkt vanaf vandaag zoveel weken vooruit als ingesteld', () => {
    expect(planningWindow('2026-10-01', 8)).toEqual({ from: '2026-10-01', to: '2026-11-25' });
  });

  it('deelt de gaten in per week, ook de weken zonder gat (V34)', () => {
    // Woensdag 7 oktober t/m dinsdag 20 oktober: drie (delen van) weken.
    const gaps = [
      { date: '2026-10-08', id: 'a' },
      { date: '2026-10-08', id: 'b' },
      { date: '2026-10-10', id: 'c' },
      { date: '2026-10-20', id: 'd' },
    ];
    const weeks = gapWeeks(gaps, { from: '2026-10-07', to: '2026-10-20' });
    expect(weeks.map((week) => [week.key, week.week, week.from, week.to, week.rangeLabel])).toEqual([
      ['2026-W41', 41, '2026-10-07', '2026-10-11', '7–11 okt'],
      ['2026-W42', 42, '2026-10-12', '2026-10-18', '12–18 okt'],
      ['2026-W43', 43, '2026-10-19', '2026-10-20', '19–20 okt'],
    ]);
    expect(weeks.map((week) => week.gaps.map((gap) => gap.id))).toEqual([['a', 'b', 'c'], [], ['d']]);
    expect(weeks.map((week) => week.dayLabels)).toEqual([['do 8', 'za 10'], [], ['di 20']]);
  });

  it('telt de weken over de jaarwisseling goed', () => {
    const weeks = gapWeeks([{ date: '2027-01-02' }], { from: '2026-12-28', to: '2027-01-10' });
    expect(weeks.map((week) => [week.key, week.rangeLabel, week.gaps.length])).toEqual([
      ['2026-W53', '28 dec 2026 – 3 jan 2027', 1],
      ['2027-W01', '4–10 jan', 0],
    ]);
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

describe('schuiven en zelf inspringen (V40)', () => {
  // Maandag: Lotte, Joris, Danique, Hans en Yara afwezig. Eindhoven heeft alleen Daan;
  // Den Bosch (Sanne en Bram) en Breda (Eva en Thijs) zitten precies op de norm.
  const tightAbsences = ['lotte', 'joris', 'danique', 'hans', 'yara'].map((id, index) => absence(`t${index}`, id, MON));
  const tight = teamSnapshot({ absences: tightAbsences });
  // Wouter (Overig, ma/wo/vr) speelt de beheerder die kijkt.
  const wouter = { employeeId: 'wouter', today: MON };

  it('zet wie alleen op de norm van de eigen vestiging afvalt onder Schuiven, met de vraag vooraf', () => {
    const option = buildGapDetail(tight, MON, 'eindhoven', [])?.options[0];
    expect(option?.candidates).toEqual([]);
    expect(option?.shortfall.map((item) => [item.candidate.name, item.key])).toEqual([
      ['Sanne', 'den_bosch|morning:1/2,afternoon:1/2'],
      ['Thijs', 'breda|morning:1/2,afternoon:1/2'],
    ]);
    expect(option?.shortfall[0]?.confirm).toBe(
      'Sanne valt dan op ma 12 okt in bij Eindhoven (ochtend en middag). Den Bosch zakt daardoor onder de norm: ochtend 1/2, middag 1/2. Daarna kies je wie er in Den Bosch komt. Doorgaan?',
    );
    // Bij "Wie kan niet" staan ze dan niet meer.
    expect(option?.excluded.map((item) => item.name)).toEqual(['Daan', 'Danique', 'Hans', 'Lotte', 'Milan', 'Zoë']);
    // Zonder kijker geen Zelf inspringen.
    expect(option?.selfCover).toBeNull();
  });

  it('telt op de kaart in Nog te regelen wie onder Schuiven staat', () => {
    const { gaps } = buildGapViews(tight, { from: MON, to: MON }, []);
    expect(gaps.map((gap) => [gap.groupId, gap.candidateCount, gap.shortfallCount, gap.selfCover])).toEqual([
      ['eindhoven', 0, 2, null],
    ]);
  });

  it('toont Zelf inspringen met wat er met je eigen dienst gebeurt', () => {
    const options = buildGapDetail(lotteAway, MON, 'eindhoven', [], wouter)?.options;
    expect(options?.[0]?.selfCover).toEqual({
      kind: 'possible',
      text: 'Jij: aan de balie in Eindhoven, 07:30–18:00. Je dienst van die dag (overig, 07:30–18:00) vervalt.',
      hint: null,
      confirm:
        'Jij staat dan op ma 12 okt aan de balie in Eindhoven, 07:30–18:00. Je dienst van die dag (overig, 07:30–18:00) vervalt. Doorgaan?',
      dayParts: ['morning', 'afternoon'],
      key: 'replace|other:none:07:30-18:00|eindhoven|morning+afternoon|07:30-18:00|-',
    });
    expect(options?.[2]?.selfCover).toMatchObject({
      text: 'Jij: aan de balie in Eindhoven, 13:00–18:00. Je dienst van die dag (overig, 07:30–18:00) vervalt.',
    });
  });

  it('zegt het als je die dag nog niet ingeroosterd bent, of op geen dienst stond', () => {
    const tuesday = teamSnapshot({ absences: [absence('a1', 'lotte', TUE), absence('a2', 'milan', TUE)] });
    expect(buildGapDetail(tuesday, TUE, 'eindhoven', [], { employeeId: 'wouter', today: TUE })?.options[0]?.selfCover).toMatchObject({
      text: 'Jij: aan de balie in Eindhoven, 07:30–18:00. Je staat die dag nog niet ingeroosterd.',
      confirm: 'Jij staat dan op di 13 okt aan de balie in Eindhoven, 07:30–18:00. Doorgaan?',
    });
    const off = teamSnapshot({ absences: [absence('a1', 'lotte', MON)], shiftOverrides: [override('o1', 'wouter', MON, { kind: 'off' })] });
    expect(buildGapDetail(off, MON, 'eindhoven', [], wouter)?.options[0]?.selfCover).toMatchObject({
      text: 'Jij: aan de balie in Eindhoven, 07:30–18:00. Je stond die dag op geen dienst; dat vervalt.',
      confirm: 'Jij staat dan op ma 12 okt aan de balie in Eindhoven, 07:30–18:00. Je stond die dag op geen dienst; dat vervalt. Doorgaan?',
    });
  });

  it('maakt je dienst langer als je al aan dezelfde balie staat', () => {
    const snapshot = teamSnapshot({
      absences: [absence('a1', 'bram', MON, MON, { dayPart: 'afternoon' })],
      shiftOverrides: [override('o1', 'joris', MON, { kind: 'shift', groupId: 'den_bosch', role: 'counter', startTime: '07:30', endTime: '13:00' })],
    });
    expect(buildGapDetail(snapshot, MON, 'den_bosch', [], { employeeId: 'joris', today: MON })?.options[0]?.selfCover).toMatchObject({
      text: 'Jij: aan de balie in Den Bosch, 07:30–18:00. Je dienst daar wordt langer (was 07:30–13:00).',
      confirm: 'Jij staat dan op ma 12 okt aan de balie in Den Bosch, 07:30–18:00. Dat is in plaats van 07:30–13:00. Doorgaan?',
    });
  });

  it('zegt erbij als je ook gewoon kunt invallen, zodat de rest van je dienst blijft', () => {
    // Hans (Overig) mag in Eindhoven invallen en staat in de lijst.
    expect(buildGapDetail(lotteAway, MON, 'eindhoven', [], { employeeId: 'hans', today: MON })?.options[0]?.selfCover).toMatchObject({
      kind: 'possible',
      hint: 'Je staat ook in de lijst om in te vallen; dan blijft de rest van je dienst staan.',
    });
  });

  it('noemt de balie waar je vandaan komt, en of die onder de norm zakt', () => {
    const bram = { employeeId: 'bram', today: MON };
    expect(buildGapDetail(tight, MON, 'eindhoven', [], bram)?.options[0]?.selfCover).toMatchObject({
      text: 'Jij: aan de balie in Eindhoven, 07:30–18:00. Je dienst van die dag (balie Den Bosch, 07:30–18:00) vervalt, en Den Bosch zakt dan onder de norm: ochtend 1/2, middag 1/2.',
      confirm:
        'Jij staat dan op ma 12 okt aan de balie in Eindhoven, 07:30–18:00. Je dienst van die dag (balie Den Bosch, 07:30–18:00) vervalt, en Den Bosch zakt daardoor onder de norm: ochtend 1/2, middag 1/2. Daarna kies je wie er in Den Bosch komt. Doorgaan?',
    });
    expect(buildGapDetail(lotteAway, MON, 'eindhoven', [], bram)?.options[0]?.selfCover).toMatchObject({
      text: 'Jij: aan de balie in Eindhoven, 07:30–18:00. Je dienst van die dag (balie Den Bosch, 07:30–18:00) vervalt; Den Bosch blijft op de norm.',
    });
  });

  it('zegt waarom zelf inspringen niet kan, en toont niets op een voorbije dag', () => {
    const self = (snapshot: typeof lotteAway, employeeId: string, today = MON) =>
      buildGapDetail(snapshot, MON, 'eindhoven', [], { employeeId, today })?.options[0]?.selfCover;
    expect(self(teamSnapshot({ absences: [absence('a1', 'lotte', MON), absence('a2', 'wouter', MON)] }), 'wouter')).toEqual({
      kind: 'blocked',
      text: 'Zelf inspringen kan niet: je bent die dag afwezig (ochtend en middag).',
    });
    expect(self(teamSnapshot({ absences: [absence('a1', 'lotte', MON)], substitutions: [substitution('s1', 'danique', MON, 'breda', ['morning'])] }), 'danique')).toEqual({
      kind: 'blocked',
      text: 'Zelf inspringen kan niet: je valt die dag al in bij Breda. Trek die inval eerst in bij Beheer → Invallen.',
    });
    expect(self(lotteAway, 'daan')).toEqual({
      kind: 'blocked',
      text: 'Zelf inspringen kan niet: je staat die dag (ochtend en middag) al aan de balie in Eindhoven.',
    });
    expect(self(lotteAway, 'wouter', TUE)).toBeNull();
  });

  it('zet Zelf inspringen op de kaarten, alleen als het kan', () => {
    const { gaps } = buildGapViews(lotteAway, { from: MON, to: MON }, []);
    expect(withSelfCover(lotteAway, gaps, wouter)[0]?.selfCover).toMatchObject({ kind: 'possible', dayParts: ['morning', 'afternoon'] });
    expect(withSelfCover(lotteAway, gaps, { employeeId: 'daan', today: MON })[0]?.selfCover).toBeNull();
    // De kaart zelf blijft verder gelijk.
    expect(withSelfCover(lotteAway, gaps, wouter)[0]).toMatchObject({ key: gaps[0]?.key, proposals: gaps[0]?.proposals });
  });

  it('heeft een pad naar de pagina van een gat, dat ook als terugweg mag', () => {
    expect(gapPath('den_bosch', MON)).toBe('/beheer/regelen/den-bosch/2026-10-12');
    expect(safeReturnPath(gapPath('den_bosch', MON), '/beheer')).toBe('/beheer/regelen/den-bosch/2026-10-12');
  });

  it('lost een schuif op: Sanne toch naar Eindhoven, en Wouter springt zelf in in Den Bosch', () => {
    // 1. Sanne staat onder Schuiven.
    expect(buildGapDetail(tight, MON, 'eindhoven', [])?.options[0]?.shortfall[0]?.candidate.employeeId).toBe('sanne');
    // 2. Na Toch inzetten heeft Den Bosch een gat. Petra kan invallen, Daan staat onder Schuiven, en Wouter kan zelf inspringen.
    const moved = [substitution('s1', 'sanne', MON, 'eindhoven')];
    const afterMove = teamSnapshot({ absences: tightAbsences, substitutions: moved });
    const denBosch = buildGapDetail(afterMove, MON, 'den_bosch', [], wouter);
    expect(denBosch?.shortParts).toEqual(['morning', 'afternoon']);
    expect(denBosch?.options[0]?.candidates.map((item) => item.name)).toEqual(['Petra']);
    expect(denBosch?.options[0]?.shortfall.map((item) => item.candidate.name)).toEqual(['Daan']);
    expect(denBosch?.options[0]?.selfCover).toMatchObject({ kind: 'possible' });
    // 3. Met de roosterwijziging van Wouter is er die dag nergens meer een gat, en vervalt er geen inval.
    const done = teamSnapshot({
      absences: tightAbsences,
      substitutions: moved,
      shiftOverrides: [override('o1', 'wouter', MON, { kind: 'shift', groupId: 'den_bosch', role: 'counter' })],
    });
    expect(buildGapViews(done, { from: MON, to: MON }, []).gaps).toEqual([]);
    expect(reviewSubstitutions(done, [MON], MON)).toEqual([]);
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
