/**
 * De rapporten (fase 7, V68): van opgetelde cijfers naar tabellen en grafieken. Puur: gegevens,
 * "vandaag" en "nu" komen binnen als parameter. Aantallen per vestiging en werkplaats, nooit per
 * medewerker (V71).
 */
import type { ClosureResolver } from '../engine/closures';
import { addMonths, eachDay, minDate, startOfMonth, weekdayOf } from '../engine/dates';
import type { IsoDate, TimeOfDay } from '../engine/types';
import { isLoanWorkday, isOverdue, loanDueDate, mobilityDayCheck } from '../loans/status';
import { localMoment } from '../loans/time';
import type { LoanGroup, VehicleLoan } from '../loans/types';
import { toMinutes } from '../engine/time';
import { INCIDENT_KINDS, INCIDENT_KIND_LABELS, type IncidentKind, type Workshop } from '../registrations/types';
import { inPeriod, type Period, type ReportQuery } from './periods';

export interface WalkInBucket {
  bucket: IsoDate;
  groupId: string;
  workshopId: string;
  total: number;
}

export interface IncidentBucket {
  bucket: IsoDate;
  groupId: string;
  workshopId: string;
  kind: IncidentKind;
  total: number;
  chargeable: number;
  charged: number;
}

/** De uitleen per maand, voor maanden waarvan de regels zelf al zijn opgeruimd. */
export interface LoanTotal {
  month: IsoDate;
  groupId: string;
  destination: string;
  total: number;
  used: number;
  unused: number;
}

export type ReportValue = number | string | null;

export interface ReportRow {
  label: string;
  values: ReportValue[];
  strong?: boolean;
}

export interface ReportTable {
  title: string;
  note?: string;
  columns: string[];
  rows: ReportRow[];
  /** Hoe de getallen worden getoond: aantallen, procenten of met één decimaal. */
  format?: 'count' | 'percent' | 'decimal';
}

export interface ReportChart {
  title: string;
  labels: string[];
  series: { name: string; values: number[] }[];
}

export interface Report {
  tables: ReportTable[];
  charts: ReportChart[];
}

export interface ReportContext {
  query: ReportQuery;
  groups: readonly LoanGroup[];
  workshops: readonly Workshop[];
  today: IsoDate;
  now: Date;
  closures: ClosureResolver;
  endOfDay: TimeOfDay;
  /** Per vestiging de eerste auto aan Mobiliteit: daarvoor telt de controle niet (V48). */
  firstLoanDates: ReadonlyMap<string, IsoDate>;
  /** De eerste maand waarvan de regels zelf er nog allemaal zijn. Ouder: alleen maandtotalen. */
  cutoff: IsoDate;
}

export interface ReportData {
  walkIns: readonly WalkInBucket[];
  incidents: readonly IncidentBucket[];
  loans: readonly VehicleLoan[];
  loanTotals: readonly LoanTotal[];
}

/** De eerste maand waarvan meldingen en uitleen er nog helemaal zijn: 23 maanden terug (zoals in de database). */
export function reportCutoff(today: IsoDate): IsoDate {
  return addMonths(startOfMonth(today), -23);
}

const sum = (values: readonly number[]) => values.reduce((total, value) => total + value, 0);

function shownGroups(context: ReportContext) {
  return context.groups.filter((group) => !context.query.groupId || group.id === context.query.groupId);
}

const inGroup = (context: ReportContext) => (row: { groupId: string }) => !context.query.groupId || row.groupId === context.query.groupId;

function workshopLabel(context: ReportContext, workshopId: string) {
  const workshop = context.workshops.find((candidate) => candidate.id === workshopId);
  const group = context.groups.find((candidate) => candidate.id === workshop?.groupId);
  const name = workshop?.name ?? 'Verwijderde werkplaats';
  return context.query.groupId || !group ? name : `${name} (${group.name})`;
}

/** Een tabel met een regel per onderwerp en een kolom per periode, met een totaal erachter. */
function periodTable(
  context: ReportContext,
  title: string,
  rows: { label: string; value: (period: Period) => number | null; strong?: boolean }[],
  options: { total?: boolean; format?: ReportTable['format']; note?: string } = {},
): ReportTable {
  const total = options.total ?? true;
  return {
    title,
    note: options.note,
    format: options.format,
    columns: [...context.query.periods.map((period) => period.label), ...(total ? ['Totaal'] : [])],
    rows: rows.map((row) => {
      const values = context.query.periods.map((period) => row.value(period));
      const known = values.filter((value): value is number => value !== null);
      return {
        label: row.label,
        strong: row.strong,
        values: total ? [...values, known.length > 0 ? sum(known) : null] : values,
      };
    }),
  };
}

/** Werkdagen (ma–vr, niet dicht) van een vestiging in een periode, tot en met vandaag. */
export function workdaysIn(period: Pick<Period, 'from' | 'to'>, groupId: string, today: IsoDate, closures: ClosureResolver): number {
  if (period.from > today) return 0;
  return eachDay(period.from, minDate(period.to, today)).filter((date) => isLoanWorkday(date, groupId, closures)).length;
}

function walkInsIn(data: ReportData, period: Period, filter: (row: WalkInBucket) => boolean): number {
  return sum(data.walkIns.filter((row) => row.bucket === period.from && filter(row)).map((row) => row.total));
}

function incidentsIn(data: ReportData, period: Period, filter: (row: IncidentBucket) => boolean, field: 'total' | 'chargeable' | 'charged' = 'total') {
  return sum(data.incidents.filter((row) => row.bucket === period.from && filter(row)).map((row) => row[field]));
}

function mobilityLoans(data: ReportData, context: ReportContext, period: Period, groupId: string | null, field: 'total' | 'unused' | 'returned') {
  const raw = data.loans.filter(
    (loan) => loan.destination === 'mobility' && (!groupId || loan.groupId === groupId) && inPeriod(localMoment(loan.handedOutAt).date, period),
  );
  const totals = data.loanTotals.filter(
    (row) => row.destination === 'mobility' && (!groupId || row.groupId === groupId) && row.month < context.cutoff && inPeriod(row.month, period),
  );
  if (field === 'total') return raw.length + sum(totals.map((row) => row.total));
  if (field === 'unused') return raw.filter((loan) => loan.wasUsed === false).length + sum(totals.map((row) => row.unused));
  return raw.filter((loan) => loan.wasUsed !== null).length + sum(totals.map((row) => row.used + row.unused));
}

const difference = (current: number, previous: number) => current - previous;

/** Overzicht: per periode de kerncijfers, met het verschil met de periode ervoor. */
export function overviewReport(data: ReportData, context: ReportContext): Report {
  const filter = inGroup(context);
  const lines: { label: string; value: (period: Period) => number; strong?: boolean }[] = [
    { label: 'Binnenvallers', value: (period) => walkInsIn(data, period, filter), strong: true },
    { label: 'Meldingen', value: (period) => incidentsIn(data, period, filter), strong: true },
    ...INCIDENT_KINDS.map((kind) => ({
      label: `· ${INCIDENT_KIND_LABELS[kind]}`,
      value: (period: Period) => incidentsIn(data, period, (row) => filter(row) && row.kind === kind),
    })),
    { label: 'Door te belasten', value: (period) => incidentsIn(data, period, filter, 'chargeable') },
    { label: 'Doorbelast', value: (period) => incidentsIn(data, period, filter, 'charged') },
    { label: 'Nog door te belasten', value: (period) => incidentsIn(data, period, filter, 'chargeable') - incidentsIn(data, period, filter, 'charged') },
    { label: 'Auto’s aan Mobiliteit', value: (period) => mobilityLoans(data, context, period, context.query.groupId, 'total'), strong: true },
    { label: '· niet ingezet', value: (period) => mobilityLoans(data, context, period, context.query.groupId, 'unused') },
  ];
  const last = context.query.periods.length - 1;
  const lastPeriod = context.query.periods[last];
  const before = context.query.previous[last];
  const table: ReportTable = {
    title: 'Kerncijfers',
    note:
      lastPeriod && before
        ? `Verschil: ${lastPeriod.label} ten opzichte van ${before.label}.${lastPeriod.to >= context.today ? ` ${lastPeriod.label} loopt nog.` : ''}`
        : undefined,
    columns: [...context.query.periods.map((period) => period.label), 'Verschil'],
    rows: lines.map((line) => ({
      label: line.label,
      strong: line.strong,
      values: [
        ...context.query.periods.map((period) => line.value(period)),
        lastPeriod && before ? difference(line.value(lastPeriod), line.value(before)) : null,
      ],
    })),
  };
  const labels = context.query.periods.map((period) => period.label);
  const groups = shownGroups(context);
  return {
    tables: [table],
    charts: [
      {
        title: 'Binnenvallers',
        labels,
        series: groups.map((group) => ({
          name: group.name,
          values: context.query.periods.map((period) => walkInsIn(data, period, (row) => row.groupId === group.id)),
        })),
      },
      {
        title: 'Meldingen',
        labels,
        series: groups.map((group) => ({
          name: group.name,
          values: context.query.periods.map((period) => incidentsIn(data, period, (row) => row.groupId === group.id)),
        })),
      },
    ],
  };
}

/** De werkplaatsen in beeld: actief, of met cijfers in de gekozen perioden. Op vestiging en volgorde. */
function shownWorkshops(context: ReportContext, used: ReadonlySet<string>) {
  const groupOrder = (id: string) => context.groups.findIndex((group) => group.id === id);
  return context.workshops
    .filter((workshop) => (!context.query.groupId || workshop.groupId === context.query.groupId) && (workshop.isActive || used.has(workshop.id)))
    .sort((a, b) => groupOrder(a.groupId) - groupOrder(b.groupId) || a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'nl'));
}

function inPeriods(context: ReportContext) {
  const keys = new Set(context.query.periods.map((period) => period.from));
  return (row: { bucket: IsoDate }) => keys.has(row.bucket);
}

/** Binnenvallers: per vestiging, per werkplaats, de top 5 en gemiddeld per werkdag. */
export function walkInReport(data: ReportData, context: ReportContext): Report {
  const filter = inGroup(context);
  const groups = shownGroups(context);
  const current = data.walkIns.filter((row) => filter(row) && inPeriods(context)(row));
  const workshops = shownWorkshops(context, new Set(current.map((row) => row.workshopId)));
  const perWorkshop = workshops
    .map((workshop) => ({ workshop, total: sum(current.filter((row) => row.workshopId === workshop.id).map((row) => row.total)) }))
    .sort((a, b) => b.total - a.total || a.workshop.name.localeCompare(b.workshop.name, 'nl'));
  return {
    tables: [
      periodTable(
        context,
        'Per vestiging',
        groups.map((group) => ({ label: group.name, value: (period) => walkInsIn(data, period, (row) => row.groupId === group.id) })),
      ),
      periodTable(
        context,
        'Per werkplaats',
        workshops.map((workshop) => ({
          label: workshopLabel(context, workshop.id),
          value: (period) => walkInsIn(data, period, (row) => row.workshopId === workshop.id),
        })),
      ),
      {
        title: 'Top 5 werkplaatsen',
        note: 'Over alle gekozen perioden samen.',
        columns: ['Binnenvallers'],
        rows: perWorkshop
          .filter((entry) => entry.total > 0)
          .slice(0, 5)
          .map((entry) => ({ label: workshopLabel(context, entry.workshop.id), values: [entry.total] })),
      },
      periodTable(
        context,
        'Gemiddeld per werkdag',
        groups.map((group) => ({
          label: group.name,
          value: (period) => {
            const days = workdaysIn(period, group.id, context.today, context.closures);
            return days === 0 ? null : Math.round((walkInsIn(data, period, (row) => row.groupId === group.id) / days) * 10) / 10;
          },
        })),
        { total: false, format: 'decimal', note: 'Werkdagen: maandag tot en met vrijdag, zonder sluitingsdagen, tot en met vandaag.' },
      ),
    ],
    charts: [
      {
        title: 'Binnenvallers per vestiging',
        labels: context.query.periods.map((period) => period.label),
        series: groups.map((group) => ({
          name: group.name,
          values: context.query.periods.map((period) => walkInsIn(data, period, (row) => row.groupId === group.id)),
        })),
      },
    ],
  };
}

/** Meldingen: per soort, per vestiging, per werkplaats met meldingen per 100 binnenvallers, en doorbelasten. */
export function incidentReport(data: ReportData, context: ReportContext): Report {
  const filter = inGroup(context);
  const groups = shownGroups(context);
  const within = inPeriods(context);
  const incidents = data.incidents.filter((row) => filter(row) && within(row));
  const walkIns = data.walkIns.filter((row) => filter(row) && within(row));
  const workshops = shownWorkshops(context, new Set([...incidents, ...walkIns].map((row) => row.workshopId)));
  const per100 = workshops
    .map((workshop) => {
      const count = sum(incidents.filter((row) => row.workshopId === workshop.id).map((row) => row.total));
      const visits = sum(walkIns.filter((row) => row.workshopId === workshop.id).map((row) => row.total));
      return { workshop, count, visits, rate: visits > 0 ? Math.round((count / visits) * 1000) / 10 : null };
    })
    .filter((row) => row.count > 0 || row.visits > 0)
    .sort((a, b) => (b.rate ?? -1) - (a.rate ?? -1) || b.count - a.count || a.workshop.name.localeCompare(b.workshop.name, 'nl'));
  const charge = (period: Period, rowFilter: (row: IncidentBucket) => boolean) => ({
    chargeable: incidentsIn(data, period, (row) => filter(row) && rowFilter(row), 'chargeable'),
    charged: incidentsIn(data, period, (row) => filter(row) && rowFilter(row), 'charged'),
  });
  const chargeWorkshops = workshops.filter((workshop) => incidents.some((row) => row.workshopId === workshop.id && row.chargeable > 0));
  return {
    tables: [
      periodTable(
        context,
        'Per soort',
        [
          ...INCIDENT_KINDS.map((kind) => ({
            label: INCIDENT_KIND_LABELS[kind],
            value: (period: Period) => incidentsIn(data, period, (row) => filter(row) && row.kind === kind),
          })),
          { label: 'Totaal', strong: true, value: (period: Period) => incidentsIn(data, period, filter) },
        ],
      ),
      periodTable(
        context,
        'Per vestiging',
        groups.map((group) => ({ label: group.name, value: (period) => incidentsIn(data, period, (row) => row.groupId === group.id) })),
      ),
      {
        title: 'Per werkplaats, per 100 binnenvallers',
        note: 'Over alle gekozen perioden samen. Zo vergelijk je een drukke werkplaats eerlijk met een rustige.',
        columns: ['Meldingen', 'Binnenvallers', 'Per 100'],
        format: 'decimal',
        rows: per100.map((row) => ({ label: workshopLabel(context, row.workshop.id), values: [row.count, row.visits, row.rate] })),
      },
      periodTable(
        context,
        'Doorbelasten: annuleringen vanaf het tijdstip',
        [
          { label: 'Door te belasten', value: (period) => charge(period, () => true).chargeable, strong: true },
          { label: 'Doorbelast', value: (period) => charge(period, () => true).charged },
          {
            label: 'Nog open',
            value: (period) => {
              const counts = charge(period, () => true);
              return counts.chargeable - counts.charged;
            },
          },
        ],
      ),
      periodTable(
        context,
        'Nog door te belasten, per werkplaats',
        chargeWorkshops.map((workshop) => ({
          label: workshopLabel(context, workshop.id),
          value: (period) => {
            const counts = charge(period, (row) => row.workshopId === workshop.id);
            return counts.chargeable - counts.charged;
          },
        })),
      ),
    ],
    charts: [
      {
        title: 'Meldingen per soort',
        labels: context.query.periods.map((period) => period.label),
        series: INCIDENT_KINDS.map((kind) => ({
          name: INCIDENT_KIND_LABELS[kind],
          values: context.query.periods.map((period) => incidentsIn(data, period, (row) => filter(row) && row.kind === kind)),
        })),
      },
    ],
  };
}

/** Is de auto te laat retour gemeld, of staat hij nu te lang uit? Zelfde regel als bij Mobiliteit (V48). */
export function wasOverdue(loan: VehicleLoan, now: Date, closures: ClosureResolver, endOfDay: TimeOfDay): boolean {
  if (!loan.returnedAt) return isOverdue(loan, now, closures, endOfDay);
  const due = loanDueDate(loan, closures);
  const back = localMoment(loan.returnedAt);
  return back.date > due || (back.date === due && toMinutes(back.time as TimeOfDay) >= toMinutes(endOfDay));
}

/** Mobiliteit: auto's per werkdag tegen het minimum, het aandeel niet ingezet en wat te lang uit stond. */
export function loanReport(data: ReportData, context: ReportContext): Report {
  const groups = shownGroups(context);
  const old = (period: Period) => period.from < context.cutoff;
  const dayChecks = (period: Period) => {
    if (period.from > context.today) return [];
    const days = eachDay(period.from, minDate(period.to, context.today)).filter((date) => weekdayOf(date) <= 5);
    return mobilityDayCheck(data.loans, groups, days, context.today, context.closures, context.firstLoanDates);
  };
  const shortDays = (period: Period, groupId: string) => {
    if (old(period)) return null;
    const row = dayChecks(period).find((candidate) => candidate.groupId === groupId);
    // Telde de vestiging nog niet mee (vóór de eerste auto aan Mobiliteit), dan geen getal maar een streepje.
    if (!row || !row.cells.some((cell) => cell.state === 'short' || cell.state === 'ok')) return null;
    return row.cells.filter((cell) => cell.state === 'short').length;
  };
  const overdue = (period: Period, groupId: string) =>
    old(period)
      ? null
      : data.loans.filter(
          (loan) => loan.groupId === groupId && inPeriod(localMoment(loan.handedOutAt).date, period) && wasOverdue(loan, context.now, context.closures, context.endOfDay),
        ).length;
  const unusedShare = (period: Period, groupId: string) => {
    const returned = mobilityLoans(data, context, period, groupId, 'returned');
    return returned === 0 ? null : Math.round((mobilityLoans(data, context, period, groupId, 'unused') / returned) * 100);
  };
  return {
    tables: [
      periodTable(
        context,
        'Auto’s aan Mobiliteit',
        groups.map((group) => ({ label: group.name, value: (period) => mobilityLoans(data, context, period, group.id, 'total') })),
      ),
      periodTable(
        context,
        'Gemiddeld per werkdag',
        groups.map((group) => ({
          label: `${group.name}${group.mobilityPerDay > 0 ? ` (minimum ${group.mobilityPerDay})` : ''}`,
          value: (period) => {
            const days = workdaysIn(period, group.id, context.today, context.closures);
            return days === 0 ? null : Math.round((mobilityLoans(data, context, period, group.id, 'total') / days) * 10) / 10;
          },
        })),
        { total: false, format: 'decimal' },
      ),
      periodTable(
        context,
        'Werkdagen met te weinig auto’s',
        groups.filter((group) => group.mobilityPerDay > 0).map((group) => ({ label: group.name, value: (period) => shortDays(period, group.id) })),
        { note: 'Vanaf de eerste auto die de vestiging aan Mobiliteit meegaf. Vandaag telt pas morgen mee.' },
      ),
      periodTable(
        context,
        'Niet ingezet',
        groups.map((group) => ({ label: group.name, value: (period) => unusedShare(period, group.id) })),
        { total: false, format: 'percent', note: 'Van de auto’s die retour zijn gemeld.' },
      ),
      periodTable(
        context,
        'Te lang uit',
        groups.map((group) => ({ label: group.name, value: (period) => overdue(period, group.id) })),
        { note: 'Later retour gemeld dan het einde van de eerstvolgende werkdag, of nu nog te lang uit. Mobiliteit en werkplaats.' },
      ),
    ],
    charts: [
      {
        title: 'Auto’s aan Mobiliteit',
        labels: context.query.periods.map((period) => period.label),
        series: groups.map((group) => ({
          name: group.name,
          values: context.query.periods.map((period) => mobilityLoans(data, context, period, group.id, 'total')),
        })),
      },
    ],
  };
}

export const REPORTS = {
  overzicht: { title: 'Overzicht', build: overviewReport },
  binnenvallers: { title: 'Binnenvallers', build: walkInReport },
  meldingen: { title: 'Meldingen', build: incidentReport },
  mobiliteit: { title: 'Mobiliteit', build: loanReport },
} as const;
export type ReportId = keyof typeof REPORTS;
export const isReportId = (value: unknown): value is ReportId => typeof value === 'string' && value in REPORTS;

/** De gegevens die een rapport nodig heeft: alleen de uitleen voor Overzicht en Mobiliteit. */
export function needsLoans(id: ReportId): boolean {
  return id === 'overzicht' || id === 'mobiliteit';
}
