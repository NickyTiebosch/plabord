import { describe, expect, it } from 'vitest';
import { createClosureResolver } from '../engine/closures';
import { amsterdamInstant } from '../loans/time';
import type { VehicleLoan } from '../loans/types';
import type { CompletionRow } from '../registrations/status';
import type { Incident, Workshop } from '../registrations/types';
import {
  incidentReport,
  loanReport,
  overviewReport,
  reportCutoff,
  walkInReport,
  wasOverdue,
  workdaysIn,
  type IncidentBucket,
  type ReportContext,
  type ReportData,
  type WalkInBucket,
} from './build';
import { monthChoices, parseReportQuery, periodAt, queryRange, reportHref, shiftPeriod } from './periods';
import { DEFAULT_SIGNAL_SETTINGS, reportSignals, signalsSince, type SignalInput } from './signals';

const at = (date: string, time: string) => amsterdamInstant(date, time as never).toISOString();
const groupIds = ['den_bosch', 'eindhoven'];

describe('periodes (V67)', () => {
  it('maakt weken, maanden en jaren met een korte en een lange naam', () => {
    expect(periodAt('week', '2026-11-13')).toEqual({ unit: 'week', from: '2026-11-09', to: '2026-11-15', label: 'wk 46', title: 'week 46 (9–15 nov 2026)' });
    expect(periodAt('week', '2026-11-02')?.title).toBe('week 45 (2–8 nov 2026)');
    expect(periodAt('week', '2026-12-30')?.title).toBe('week 53 (28 dec – 3 jan 2027)');
    expect(periodAt('month', '2026-02-14')).toEqual({ unit: 'month', from: '2026-02-01', to: '2026-02-28', label: 'feb 2026', title: 'feb 2026' });
    expect(periodAt('year', '2026-07-01')).toMatchObject({ from: '2026-01-01', to: '2026-12-31', label: '2026' });
    expect(shiftPeriod(periodAt('month', '2026-01-10'), -1).from).toBe('2025-12-01');
  });

  it('leest de keuze uit het adres, met standaardwaarden', () => {
    const plain = parseReportQuery({}, '2026-11-13', groupIds);
    expect(plain.unit).toBe('month');
    expect(plain.periods.map((period) => period.label)).toEqual(['jun 2026', 'jul 2026', 'aug 2026', 'sep 2026', 'okt 2026', 'nov 2026']);
    expect(plain.previous[0]?.label).toBe('mei 2026');
    expect(plain.groupId).toBeNull();
    const weeks = parseReportQuery({ per: 'week', aantal: '3', vestiging: 'breda' }, '2026-11-13', groupIds);
    expect(weeks.periods.map((period) => period.from)).toEqual(['2026-10-26', '2026-11-02', '2026-11-09']);
    expect(weeks.groupId).toBeNull();
    expect(parseReportQuery({ per: 'jaar', aantal: '99' }, '2026-11-13', groupIds).count).toBe(5);
  });

  it('leest losse maanden, zonder toekomst en dubbelingen', () => {
    const query = parseReportQuery({ per: 'maand', maanden: '2026-09,2026-07,2026-09,2027-01,onzin', vestiging: 'eindhoven' }, '2026-11-13', groupIds);
    expect(query.months).toEqual(['2026-07', '2026-09']);
    expect(query.periods.map((period) => period.label)).toEqual(['jul 2026', 'sep 2026']);
    expect(query.previous.map((period) => period.label)).toEqual(['jun 2026', 'aug 2026']);
    expect(query.groupId).toBe('eindhoven');
    expect(queryRange(query)).toEqual({ from: '2026-06-01', to: '2026-09-30' });
    expect(reportHref('/rapporten', query)).toBe('/rapporten?per=maand&maanden=2026-07%2C2026-09&vestiging=eindhoven');
    expect(reportHref('/rapporten', query, { unit: 'week' })).toBe('/rapporten?per=week&aantal=8&vestiging=eindhoven');
    expect(reportHref('/rapporten', query, { groupId: null, months: [] , count: 3})).toBe('/rapporten?per=maand&aantal=3');
    expect(monthChoices('2026-11-13').slice(0, 2)).toEqual([
      { value: '2026-11', label: 'nov 2026' },
      { value: '2026-10', label: 'okt 2026' },
    ]);
  });
});

const workshops: Workshop[] = [
  { id: 'db-vw', groupId: 'den_bosch', name: 'Volkswagen', sortOrder: 1, isActive: true },
  { id: 'db-audi', groupId: 'den_bosch', name: 'Audi', sortOrder: 2, isActive: true },
  { id: 'e-vw', groupId: 'eindhoven', name: 'Volkswagen', sortOrder: 1, isActive: true },
  { id: 'e-oud', groupId: 'eindhoven', name: 'Oud', sortOrder: 9, isActive: false },
];
const groups = [
  { id: 'den_bosch', name: 'Den Bosch', mobilityPerDay: 2 },
  { id: 'eindhoven', name: 'Eindhoven', mobilityPerDay: 0 },
];
// Dinsdag 10 november is in Den Bosch dicht.
const closures = createClosureResolver([{ id: 'c', date: '2026-11-10', groupId: 'den_bosch', isClosed: true, label: 'Dicht' }]);

function loan(id: string, overrides: Partial<VehicleLoan>): VehicleLoan {
  return {
    id,
    groupId: 'den_bosch',
    plate: `AB${id}12`,
    model: 'VW Polo',
    destination: 'mobility',
    handedTo: 'Mobiliteit',
    handedOutBy: null,
    handedOutAt: at('2026-11-09', '09:00'),
    odometerOut: null,
    returnedAt: at('2026-11-09', '17:00'),
    returnedBy: null,
    odometerIn: null,
    wasUsed: true,
    note: null,
    returnNote: null,
    ...overrides,
  };
}

function context(params: Parameters<typeof parseReportQuery>[0], today = '2026-11-13'): ReportContext {
  return {
    query: parseReportQuery(params, today, groupIds),
    groups,
    workshops,
    today,
    now: new Date(`${today}T15:00:00Z`),
    closures,
    endOfDay: '18:00',
    firstLoanDates: new Map([['den_bosch', '2026-11-02']]),
    cutoff: reportCutoff(today),
  };
}

const walkIns: WalkInBucket[] = [
  { bucket: '2026-11-02', groupId: 'den_bosch', workshopId: 'db-vw', total: 10 },
  { bucket: '2026-11-09', groupId: 'den_bosch', workshopId: 'db-vw', total: 6 },
  { bucket: '2026-11-09', groupId: 'den_bosch', workshopId: 'db-audi', total: 4 },
  { bucket: '2026-11-09', groupId: 'eindhoven', workshopId: 'e-vw', total: 3 },
];
const incidents: IncidentBucket[] = [
  { bucket: '2026-11-02', groupId: 'den_bosch', workshopId: 'db-vw', kind: 'cancellation', total: 2, chargeable: 1, charged: 1 },
  { bucket: '2026-11-09', groupId: 'den_bosch', workshopId: 'db-vw', kind: 'cancellation', total: 2, chargeable: 2, charged: 0 },
  { bucket: '2026-11-09', groupId: 'den_bosch', workshopId: 'db-audi', kind: 'late_return', total: 1, chargeable: 0, charged: 0 },
  { bucket: '2026-11-09', groupId: 'eindhoven', workshopId: 'e-oud', kind: 'wrong_vehicle', total: 1, chargeable: 0, charged: 0 },
];
const loans: VehicleLoan[] = [
  loan('1', {}),
  loan('2', { handedOutAt: at('2026-11-09', '10:00'), wasUsed: false }),
  // Woensdag één auto, donderdag één: twee dagen te weinig (dinsdag was dicht).
  loan('3', { handedOutAt: at('2026-11-11', '09:00'), returnedAt: at('2026-11-12', '19:00') }),
  loan('4', { handedOutAt: at('2026-11-12', '09:00'), returnedAt: null, wasUsed: null }),
  loan('5', { handedOutAt: at('2026-11-03', '09:00'), returnedAt: at('2026-11-03', '12:00') }),
];
const data: ReportData = { walkIns, incidents, loans, loanTotals: [] };

describe('rapporten (V68)', () => {
  it('telt werkdagen zonder weekend en sluitingsdagen, tot en met vandaag', () => {
    expect(workdaysIn(periodAt('week', '2026-11-09'), 'den_bosch', '2026-11-13', closures)).toBe(4);
    expect(workdaysIn(periodAt('week', '2026-11-09'), 'eindhoven', '2026-11-11', closures)).toBe(3);
    expect(workdaysIn(periodAt('week', '2026-11-16'), 'eindhoven', '2026-11-13', closures)).toBe(0);
  });

  it('Overzicht: de kerncijfers per week, met het verschil met de week ervoor', () => {
    const report = overviewReport(data, context({ per: 'week', aantal: '2' }));
    const table = report.tables[0];
    expect(table?.columns).toEqual(['wk 45', 'wk 46', 'Verschil']);
    const row = (label: string) => table?.rows.find((candidate) => candidate.label === label)?.values;
    expect(row('Binnenvallers')).toEqual([10, 13, 3]);
    expect(row('Meldingen')).toEqual([2, 4, 2]);
    expect(row('Nog door te belasten')).toEqual([0, 2, 2]);
    expect(row('Auto’s aan Mobiliteit')).toEqual([1, 4, 3]);
    expect(row('· niet ingezet')).toEqual([0, 1, 1]);
    expect(report.charts[0]?.series).toEqual([
      { name: 'Den Bosch', values: [10, 10] },
      { name: 'Eindhoven', values: [0, 3] },
    ]);
  });

  it('Binnenvallers: per vestiging, per werkplaats, top 5 en gemiddeld per werkdag; één vestiging kan ook', () => {
    const report = walkInReport(data, context({ per: 'week', aantal: '2' }));
    expect(report.tables[0]?.rows).toEqual([
      { label: 'Den Bosch', strong: undefined, values: [10, 10, 20] },
      { label: 'Eindhoven', strong: undefined, values: [0, 3, 3] },
    ]);
    expect(report.tables[1]?.rows.map((row) => row.label)).toEqual(['Volkswagen (Den Bosch)', 'Audi (Den Bosch)', 'Volkswagen (Eindhoven)']);
    expect(report.tables[2]?.rows).toEqual([
      { label: 'Volkswagen (Den Bosch)', values: [16] },
      { label: 'Audi (Den Bosch)', values: [4] },
      { label: 'Volkswagen (Eindhoven)', values: [3] },
    ]);
    // Den Bosch week 46: 10 binnenvallers op 4 werkdagen.
    expect(report.tables[3]?.rows[0]?.values).toEqual([2, 2.5]);
    const one = walkInReport(data, context({ per: 'week', aantal: '2', vestiging: 'eindhoven' }));
    expect(one.tables[1]?.rows.map((row) => row.label)).toEqual(['Volkswagen']);
  });

  it('Meldingen: per soort, per 100 binnenvallers en doorbelasten; een inactieve werkplaats met meldingen telt mee', () => {
    const report = incidentReport(data, context({ per: 'week', aantal: '2' }));
    expect(report.tables[0]?.rows.at(-1)).toEqual({ label: 'Totaal', strong: true, values: [2, 4, 6] });
    expect(report.tables[2]?.rows).toEqual([
      { label: 'Volkswagen (Den Bosch)', values: [4, 16, 25] },
      { label: 'Audi (Den Bosch)', values: [1, 4, 25] },
      { label: 'Volkswagen (Eindhoven)', values: [0, 3, 0] },
      { label: 'Oud (Eindhoven)', values: [1, 0, null] },
    ]);
    expect(report.tables[3]?.rows.map((row) => row.values)).toEqual([
      [1, 2, 3],
      [1, 0, 1],
      [0, 2, 2],
    ]);
    expect(report.tables[4]?.rows).toEqual([{ label: 'Volkswagen (Den Bosch)', strong: undefined, values: [0, 2, 2] }]);
  });

  it('Mobiliteit: per werkdag, dagen te weinig, niet ingezet en te lang uit', () => {
    const report = loanReport(data, context({ per: 'week', aantal: '2' }));
    const values = (index: number) => report.tables[index]?.rows.map((row) => [row.label, ...row.values]);
    expect(values(0)).toEqual([
      ['Den Bosch', 1, 4, 5],
      ['Eindhoven', 0, 0, 0],
    ]);
    expect(values(1)?.[0]).toEqual(['Den Bosch (minimum 2)', 0.2, 1]);
    // Week 45: alleen dinsdag één auto, de rest geen. Week 46: woensdag en donderdag te weinig, vrijdag (vandaag) nog open.
    expect(values(2)).toEqual([['Den Bosch', 5, 2, 7]]);
    expect(values(3)?.[0]).toEqual(['Den Bosch', 0, 33]);
    // Auto 3 kwam donderdag om 19:00 terug: na het einde van de werkdag. Auto 4 staat sinds donderdag uit en is vandaag om 16:00 nog niet te laat.
    expect(values(4)?.[0]).toEqual(['Den Bosch', 0, 1, 1]);
  });

  it('een vestiging die nog geen auto aan Mobiliteit meegaf, krijgt een streepje bij dagen te weinig', () => {
    const ctx = { ...context({ per: 'week', aantal: '2' }), groups: groups.map((group) => ({ ...group, mobilityPerDay: 2 })) };
    const rows = loanReport(data, ctx).tables[2]?.rows;
    expect(rows?.find((row) => row.label === 'Eindhoven')?.values).toEqual([null, null, null]);
    expect(overviewReport(data, ctx).tables[0]?.note).toBe('Verschil: wk 46 ten opzichte van wk 45. wk 46 loopt nog.');
  });

  it('te lang uit volgt de regel van Mobiliteit', () => {
    const now = new Date(at('2026-11-13', '18:30'));
    expect(wasOverdue(loan('4', { handedOutAt: at('2026-11-12', '09:00'), returnedAt: null, wasUsed: null }), now, closures, '18:00')).toBe(true);
    expect(wasOverdue(loan('6', { handedOutAt: at('2026-11-09', '09:00'), returnedAt: at('2026-11-11', '08:00') }), now, closures, '18:00')).toBe(false);
  });

  it('telt maandtotalen mee voor maanden die al zijn opgeruimd, en toont dan geen dagcijfers', () => {
    const ctx = context({ per: 'maand', maanden: '2024-11' }, '2026-11-13');
    const old: ReportData = { ...data, loanTotals: [{ month: '2024-11-01', groupId: 'den_bosch', destination: 'mobility', total: 30, used: 20, unused: 10 }] };
    const report = loanReport(old, ctx);
    expect(report.tables[0]?.rows[0]?.values).toEqual([30, 30]);
    expect(report.tables[2]?.rows[0]?.values).toEqual([null, null]);
    expect(report.tables[3]?.rows[0]?.values).toEqual([33]);
  });
});

describe('signalen (V69)', () => {
  const completion = (open: number): CompletionRow => ({
    groupId: 'eindhoven',
    groupName: 'Eindhoven',
    open,
    cells: ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-06'].map((date, index) => ({
      date,
      label: date,
      state: index < open || date < '2026-11-09' ? 'open' : 'closed',
      walkIns: 0,
      incidents: 0,
      rentlinkChecked: false,
    })),
  });
  const charge = (id: string, date: string): Incident => ({
    id,
    groupId: 'den_bosch',
    workshopId: 'db-vw',
    occurredAt: at(date, '12:00'),
    kind: 'cancellation',
    missing: null,
    cancelledAt: '12:00',
    charge: true,
    chargedAt: null,
    chargedBy: null,
    plate: null,
    contractNumber: null,
    note: null,
    reportedBy: null,
    createdAt: at(date, '12:00'),
  });
  const base: SignalInput = {
    today: '2026-11-13',
    settings: DEFAULT_SIGNAL_SETTINGS,
    groups,
    workshops,
    weeklyIncidents: [
      { bucket: '2026-11-09', groupId: 'den_bosch', workshopId: 'db-vw', kind: 'cancellation', total: 3, chargeable: 0, charged: 0 },
      { bucket: '2026-10-26', groupId: 'den_bosch', workshopId: 'db-vw', kind: 'cancellation', total: 4, chargeable: 0, charged: 0 },
      { bucket: '2026-11-09', groupId: 'den_bosch', workshopId: 'db-audi', kind: 'late_return', total: 2, chargeable: 0, charged: 0 },
    ],
    completion: [completion(2)],
    openCharges: [charge('a', '2026-10-20'), charge('b', '2026-11-12')],
    loans,
    closures,
    firstLoanDates: new Map([['den_bosch', '2026-11-02']]),
  };

  it('geeft elk signaal met een link naar waar het uit komt', () => {
    expect(reportSignals(base)).toEqual([
      {
        href: '/rapporten/meldingen?per=week&aantal=9&vestiging=den_bosch',
        text: 'Volkswagen (Den Bosch) heeft deze week 3 meldingen, meer dan 2× het gemiddelde (0,5)',
      },
      { href: '/controle', text: 'Eindhoven sloot deze week 2 dagen niet af' },
      { href: '/meldingen/doorbelasten', text: '1 annulering staat langer dan 14 dagen op de doorbelastlijst' },
      { href: '/rapporten/mobiliteit?per=week&aantal=4&vestiging=den_bosch', text: 'Den Bosch gaf deze week op 2 dagen te weinig auto’s aan Mobiliteit' },
    ]);
  });

  it('laat een signaal weg dat uit staat of onder de grens blijft', () => {
    const quiet = reportSignals({
      ...base,
      settings: { ...DEFAULT_SIGNAL_SETTINGS, incidentMin: 4, unclosedDays: null, chargeDays: 30, shortDays: 3, unusedPercent: null },
    });
    expect(quiet).toEqual([]);
  });

  it('meldt een groot aandeel niet ingezet pas vanaf drie auto’s retour', () => {
    const unused = [
      loan('7', { handedOutAt: at('2026-11-02', '09:00'), wasUsed: false }),
      loan('8', { handedOutAt: at('2026-11-03', '09:00'), wasUsed: false }),
      loan('9', { handedOutAt: at('2026-11-04', '09:00'), wasUsed: true }),
    ];
    const signals = reportSignals({ ...base, loans: unused, settings: { ...DEFAULT_SIGNAL_SETTINGS, incidentFactor: null, unclosedDays: null, chargeDays: null, shortDays: null } });
    expect(signals).toEqual([{ href: '/rapporten/mobiliteit?per=maand&aantal=3&vestiging=den_bosch', text: 'Den Bosch: 2 van de 3 auto’s voor Mobiliteit zijn deze maand niet ingezet (67%)' }]);
    expect(reportSignals({ ...base, loans: unused.slice(0, 2), settings: { ...DEFAULT_SIGNAL_SETTINGS, incidentFactor: null, unclosedDays: null, chargeDays: null, shortDays: null } })).toEqual([]);
  });

  it('weet vanaf wanneer het moet laden', () => {
    expect(signalsSince('2026-11-13')).toEqual({ weeks: '2026-09-14', loans: '2026-11-01' });
    expect(signalsSince('2026-12-02')).toEqual({ weeks: '2026-10-05', loans: '2026-11-30' });
  });
});

describe('rapport als Excel (V70)', () => {
  it('zet elke tabel op een eigen tabblad, met een tabblad over het rapport', async () => {
    const { reportExport } = await import('../export/reports');
    const ctx = context({ per: 'week', aantal: '2' });
    const sheets = reportExport(loanReport(data, ctx), { title: 'Mobiliteit', query: ctx.query, groupName: null });
    expect(sheets.map((sheet) => sheet.sheet)).toEqual([
      'Over dit rapport',
      'Auto’s aan Mobiliteit',
      'Gemiddeld per werkdag',
      'Werkdagen met te weinig auto',
      'Niet ingezet',
      'Te lang uit',
    ]);
    expect(sheets[4]?.header).toEqual(['Niet ingezet (%)', 'wk 45', 'wk 46']);
    expect(sheets[4]?.rows[1]).toEqual(['Eindhoven', '', '']);
    expect(sheets[0]?.rows[1]).toEqual(['Perioden', 'week 45 (2–8 nov 2026), week 46 (9–15 nov 2026)']);
  });
});

describe('grenzen van de signalen', () => {
  it('leest het formulier: leeg is uit, buiten de grenzen geeft een fout', async () => {
    const { parseSignalForm } = await import('./signals');
    const form = (values: Record<string, string>) => {
      const data = new FormData();
      for (const [key, value] of Object.entries(values)) data.set(key, value);
      return data;
    };
    expect(parseSignalForm(form({ incidentFactor: '3', incidentMin: '4', unclosedDays: '', chargeDays: '21', shortDays: '1', unusedPercent: '' }))).toEqual({
      ok: true,
      settings: { incidentFactor: 3, incidentMin: 4, unclosedDays: null, chargeDays: 21, shortDays: 1, unusedPercent: null },
    });
    expect(parseSignalForm(form({ incidentFactor: '1', incidentMin: '3' }))).toMatchObject({ ok: false, error: expect.stringContaining('van 2 tot en met 10') });
    expect(parseSignalForm(form({ incidentMin: '' }))).toMatchObject({ ok: false, error: expect.stringContaining('vul een getal in') });
  });
});
