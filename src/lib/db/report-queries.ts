/**
 * Gegevens voor de rapporten en signalen (fase 7). Met de sessie van wie kijkt: de functies in de
 * database controleren zelf dat het een beheerder of teamleider is.
 */
import type { PostgrestError } from '@supabase/supabase-js';
import type { IsoDate } from '../engine/types';
import { startOfLocalDay, endOfLocalDay } from '../loans/time';
import type { VehicleLoan } from '../loans/types';
import { todayInAmsterdam } from '../engine/dates';
import { parseTime } from '../engine/time';
import { REPORTS, needsLoans, reportCutoff, type IncidentBucket, type LoanTotal, type ReportContext, type ReportId, type WalkInBucket } from '../reports/build';
import { queryRange, type PeriodUnit, type ReportQuery } from '../reports/periods';
import { DEFAULT_SIGNAL_SETTINGS, type SignalSettings } from '../reports/signals';
import { isIncidentKind } from '../registrations/types';
import { loadClosures, loadEndOfDay, loadFirstLoanDates, loadLoanGroups, mapVehicleLoan } from './loan-queries';
import { loadWorkshops } from './registration-queries';
import { must, type DbClient } from './queries';

/** Supabase geeft hooguit 1000 regels per vraag: in delen ophalen. */
const PAGE = 1000;
const MAX_PAGES = 30;

async function allPages<T>(fetch: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: PostgrestError | null }>, what: string) {
  const rows: T[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const batch = must(await fetch(page * PAGE, page * PAGE + PAGE - 1), what);
    rows.push(...batch);
    if (batch.length < PAGE) break;
  }
  return rows;
}

export async function loadWalkInBuckets(client: DbClient, unit: PeriodUnit, from: IsoDate, to: IsoDate): Promise<WalkInBucket[]> {
  const rows = await allPages(
    (start, end) => client.rpc('report_walk_ins', { p_unit: unit, p_from: from, p_to: to }).range(start, end),
    'de binnenvallers',
  );
  return rows.map((row) => ({ bucket: row.bucket, groupId: row.group_id, workshopId: row.workshop_id, total: row.total }));
}

export async function loadIncidentBuckets(client: DbClient, unit: PeriodUnit, from: IsoDate, to: IsoDate): Promise<IncidentBucket[]> {
  const rows = await allPages(
    (start, end) => client.rpc('report_incidents', { p_unit: unit, p_from: from, p_to: to }).range(start, end),
    'de meldingen',
  );
  return rows.flatMap((row) =>
    isIncidentKind(row.kind)
      ? [{ bucket: row.bucket, groupId: row.group_id, workshopId: row.workshop_id, kind: row.kind, total: row.total, chargeable: row.chargeable, charged: row.charged }]
      : [],
  );
}

/** De uitleen die in de periode is meegegeven. */
export async function loadLoansBetween(client: DbClient, from: IsoDate, to: IsoDate): Promise<VehicleLoan[]> {
  const rows = await allPages(
    (start, end) =>
      client
        .from('vehicle_loans')
        .select('*')
        .gte('handed_out_at', startOfLocalDay(from))
        .lt('handed_out_at', endOfLocalDay(to))
        .order('handed_out_at')
        .order('id')
        .range(start, end),
    'de uitleen',
  );
  return rows.map(mapVehicleLoan);
}

/** De maandtotalen van de uitleen, voor maanden die al zijn opgeruimd. */
export async function loadLoanTotals(client: DbClient, from: IsoDate, before: IsoDate): Promise<LoanTotal[]> {
  if (from >= before) return [];
  const rows = must(await client.from('monthly_loan_totals').select('*').gte('month', from).lt('month', before), 'de maandtotalen');
  return rows.map((row) => ({ month: row.month, groupId: row.group_id, destination: row.destination, total: row.total, used: row.used, unused: row.unused }));
}

export async function loadSignalSettings(client: DbClient): Promise<SignalSettings> {
  const result = await client
    .from('settings')
    .select('signal_incident_factor, signal_incident_min, signal_unclosed_days, signal_charge_days, signal_short_days, signal_unused_percent')
    .maybeSingle();
  // Zonder fase 7 in de database: de standaardwaarden.
  if (result.error || !result.data) return DEFAULT_SIGNAL_SETTINGS;
  const row = result.data;
  return {
    incidentFactor: row.signal_incident_factor,
    incidentMin: row.signal_incident_min,
    unclosedDays: row.signal_unclosed_days,
    chargeDays: row.signal_charge_days,
    shortDays: row.signal_short_days,
    unusedPercent: row.signal_unused_percent,
  };
}

/** Alles voor één rapport: de cijfers van de gekozen perioden en die ervoor. */
export async function loadReport(client: DbClient, id: ReportId, query: ReportQuery, now: Date) {
  const today = todayInAmsterdam(now);
  const range = queryRange(query);
  const cutoff = reportCutoff(today);
  const loansFrom = range.from < cutoff ? cutoff : range.from;
  const withLoans = needsLoans(id);
  const [groups, workshops, walkIns, incidents, loans, loanTotals, closures, endOfDay] = await Promise.all([
    loadLoanGroups(client),
    loadWorkshops(client),
    loadWalkInBuckets(client, query.unit, range.from, range.to),
    id === 'binnenvallers' ? Promise.resolve([]) : loadIncidentBuckets(client, query.unit, range.from, range.to),
    withLoans && loansFrom <= range.to ? loadLoansBetween(client, loansFrom, range.to) : Promise.resolve([]),
    withLoans ? loadLoanTotals(client, range.from, cutoff) : Promise.resolve([]),
    loadClosures(client, range.from, range.to),
    loadEndOfDay(client),
  ]);
  const firstLoanDates = withLoans ? await loadFirstLoanDates(client, groups.map((group) => group.id)) : new Map<string, IsoDate>();
  const context: ReportContext = {
    query,
    groups,
    workshops,
    today,
    now,
    closures,
    endOfDay: parseTime(endOfDay) ?? '18:00',
    firstLoanDates,
    cutoff,
  };
  return { context, report: REPORTS[id].build({ walkIns, incidents, loans, loanTotals }, context) };
}
