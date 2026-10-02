import readExcelFile from 'read-excel-file/node';
import { describe, expect, it } from 'vitest';
import { absence, override, substitution, teamSnapshot } from '../engine/__fixtures__/team';
import { MAX_ROSTER_WEEKS, rosterExport, rosterFileName, rosterPeriod, type RosterSheet } from './roster';
import { buildRosterWorkbook } from './xlsx';

const TODAY = '2026-10-13';

describe('rooster exporteren: de periode (V22)', () => {
  it('neemt zonder keuze deze week en de drie weken erna', () => {
    expect(rosterPeriod(undefined, undefined, TODAY)).toEqual({
      from: '2026-10-12',
      to: '2026-11-07',
      mondays: ['2026-10-12', '2026-10-19', '2026-10-26', '2026-11-02'],
      shortened: false,
    });
    expect(rosterPeriod('geen datum', '2026-13-45', TODAY).mondays).toHaveLength(4);
  });

  it('rekent in hele weken van maandag tot en met zaterdag', () => {
    expect(rosterPeriod('2026-10-14', '2026-10-21', TODAY)).toMatchObject({ from: '2026-10-12', to: '2026-10-24' });
    // Een zondag hoort bij de week erna, zoals op het Rooster-scherm.
    expect(rosterPeriod('2026-10-18', '2026-10-18', TODAY)).toMatchObject({ from: '2026-10-19', to: '2026-10-24' });
    expect(rosterPeriod(undefined, undefined, '2026-10-18').from).toBe('2026-10-19');
  });

  it('draait omgekeerde datums om en kort een te lange periode in', () => {
    expect(rosterPeriod('2026-10-28', '2026-10-14', TODAY)).toMatchObject({ from: '2026-10-12', to: '2026-10-31' });
    const long = rosterPeriod('2026-10-12', '2027-03-01', TODAY);
    expect(long.mondays).toHaveLength(MAX_ROSTER_WEEKS);
    expect(long).toMatchObject({ from: '2026-10-12', to: '2027-01-09', shortened: true });
  });

  it('noemt de periode in de bestandsnaam', () => {
    expect(rosterFileName({ from: '2026-10-12', to: '2026-11-07' })).toBe('planbord-rooster-2026-10-12-tot-2026-11-07.xlsx');
  });
});

describe('rooster exporteren: het raster (V22)', () => {
  const snapshot = teamSnapshot({
    absences: [
      absence('a1', 'joris', '2026-10-13', '2026-10-13', { status: 'requested' }),
      absence('a2', 'sanne', '2026-10-16'),
      absence('a3', 'bram', '2026-10-16'),
    ],
    substitutions: [substitution('s1', 'danique', '2026-10-12', 'den_bosch', ['afternoon'])],
    shiftOverrides: [
      override('o1', 'sanne', '2026-10-14', { kind: 'off' }),
      override('o2', 'bram', '2026-10-15', { kind: 'shift', groupId: 'eindhoven', role: 'counter' }),
    ],
    closureOverrides: [{ id: 'c1', date: '2026-10-16', groupId: 'eindhoven', isClosed: true, label: 'Teamdag' }],
  });
  const sheets = rosterExport(snapshot, rosterPeriod('2026-10-12', '2026-10-17', TODAY), TODAY);
  const values = (sheet: RosterSheet | undefined) => (sheet?.rows ?? []).map((row) => row.map((cell) => cell.value));
  const sheet = (name: string) => sheets.find((item) => item.sheet === name);

  it('heeft een tabblad per tab van het Rooster-scherm', () => {
    expect(sheets.map((item) => item.sheet)).toEqual(['Den Bosch', 'Eindhoven', 'Breda', 'Ondersteunend']);
  });

  it('zet in een vestiging de mensen per rol onder elkaar, met de cellen van het scherm', () => {
    expect(values(sheet('Den Bosch'))).toEqual([
      ['Den Bosch · Week 42 · 12–17 okt'],
      ['', 'ma 12 okt', 'di 13 okt', 'wo 14 okt', 'do 15 okt', 'vr 16 okt', 'za 17 okt'],
      ['Balie', '', '', '', '', '', ''],
      ['Anouk', '', '07:30–18:00', '', '07:30–18:00', '', ''],
      // Bram werkt donderdag in Eindhoven (roosterwijziging): hier blijft die dag leeg.
      ['Bram', '07:30–18:00', '07:30–18:00', '07:30–18:00', '', 'Afwezig', ''],
      ['Fleur', '', '', '07:30–18:00', '07:30–18:00', '07:30–18:00', ''],
      ['Joris', '07:30–18:00', 'Afwezig (aangevraagd)', '07:30–18:00', '', '', ''],
      ['Sanne', '07:30–18:00', '07:30–18:00', 'Geen dienst (gewijzigd)', '07:30–18:00', 'Afwezig', ''],
      // Wie is ingeleend, staat onder de eigen mensen.
      ['Danique', '13:00–18:00 (ingeleend)', '', '', '', '', ''],
      ['Hiker/buitendienst', '', '', '', '', '', ''],
      ['Ingrid', '07:30–11:30', '', '07:30–11:30', '', '07:30–11:30', ''],
      ['Te weinig aan de balie', '', '', '', '', '1 te weinig aan de balie', ''],
    ]);
    const kinds = sheet('Den Bosch')?.rows.map((row) => [row[0]?.kind, row[0]?.tone]);
    expect(kinds?.[2]).toEqual(['section', 'counter']);
    expect(kinds?.[9]).toEqual(['section', 'cleaning']);
    expect(kinds?.at(-1)).toEqual(['shortage', undefined]);
  });

  it('meldt een sluitingsdag en een dienst elders', () => {
    const rows = values(sheet('Eindhoven'));
    expect(rows[2]).toEqual(['Gesloten', '', '', '', '', 'Teamdag', '']);
    expect(rows).toContainEqual(['Bram', '', '', '', '07:30–18:00 (gewijzigd)', '', '']);
    expect(rows).toContainEqual(['Zoë', '', '', '', '', '', '09:00–13:00']);
  });

  it('zet in Ondersteunend de mensen per groep, met de rol in de cel', () => {
    const rows = values(sheet('Ondersteunend'));
    expect(rows.filter((row) => row.length === 7 && row.slice(1).every((value) => value === '')).map((row) => row[0])).toEqual([
      'Logistiek',
      'Backoffice',
      'Overig',
    ]);
    expect(rows).toContainEqual(['Danique', 'backoffice · 07:30–13:00', 'backoffice · 07:30–18:00', 'backoffice · 07:30–18:00', 'backoffice · 07:30–18:00', 'backoffice · 07:30–18:00', '']);
    expect(rows).toContainEqual(['Petra', '07:30–18:00', '07:30–18:00', '07:30–18:00', '07:30–18:00', '07:30–18:00', '']);
  });

  it('zet de weken onder elkaar, met een lege regel ertussen', () => {
    const twoWeeks = rosterExport(snapshot, rosterPeriod('2026-10-12', '2026-10-19', TODAY), TODAY);
    const titles = twoWeeks[0]?.rows.filter((row) => row[0]?.kind === 'title').map((row) => row[0]?.value);
    expect(titles).toEqual(['Den Bosch · Week 42 · 12–17 okt', 'Den Bosch · Week 43 · 19–24 okt']);
    const second = twoWeeks[0]?.rows.findIndex((row) => row[0]?.value === titles?.[1]) ?? 0;
    expect(twoWeeks[0]?.rows[second - 1]).toEqual([]);
  });

  it('noemt geen e-mailadressen en geen redenen', () => {
    const text = JSON.stringify(sheets);
    expect(text).not.toContain('@');
    expect(text).not.toMatch(/vakantie|ziek/i);
  });

  it('kan als Excel-bestand worden gelezen', async () => {
    const file = await buildRosterWorkbook(sheets);
    const read = await readExcelFile(file);
    expect(read.map((item) => item.sheet)).toEqual(['Den Bosch', 'Eindhoven', 'Breda', 'Ondersteunend']);
    expect(read[0]?.data[0]?.[0]).toBe('Den Bosch · Week 42 · 12–17 okt');
    expect(read[0]?.data[7]).toEqual(['Sanne', '07:30–18:00', '07:30–18:00', 'Geen dienst (gewijzigd)', '07:30–18:00', 'Afwezig', null]);
  });
});
