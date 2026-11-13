/**
 * De uitleen laden (fase 5). Met de sessie van wie kijkt: RLS geldt. Iedere ingelogde collega mag
 * de uitleen lezen.
 */
import { createClosureResolver, type ClosureResolver } from '../engine/closures';
import { addDays } from '../engine/dates';
import type { IsoDate } from '../engine/types';
import { endOfLocalDay, localMoment, startOfLocalDay } from '../loans/time';
import { isDestination, type Destination, type LoanGroup, type VehicleLoan } from '../loans/types';
import type { Tables } from './database.types';
import { mapClosure } from './mappers';
import { must, type DbClient } from './queries';

const iso = (value: string) => new Date(value).toISOString();

export function mapVehicleLoan(row: Tables<'vehicle_loans'>): VehicleLoan {
  return {
    id: row.id,
    groupId: row.group_id,
    plate: row.license_plate,
    model: row.model,
    destination: isDestination(row.destination) ? row.destination : 'mobility',
    handedTo: row.handed_to,
    handedOutBy: row.handed_out_by,
    handedOutAt: iso(row.handed_out_at),
    odometerOut: row.odometer_out,
    returnedAt: row.returned_at ? iso(row.returned_at) : null,
    returnedBy: row.returned_by,
    odometerIn: row.odometer_in,
    wasUsed: row.was_used,
    note: row.note,
    returnNote: row.return_note,
  };
}

/** De vestigingen die auto's uitlenen (V52), met hun ondergrens voor Mobiliteit (V48). */
export async function loadLoanGroups(client: DbClient): Promise<LoanGroup[]> {
  const rows = must(
    await client.from('groups').select('id, name, mobility_loans_per_day').eq('lends_vehicles', true).order('sort_order'),
    'de vestigingen',
  );
  return rows.map((row) => ({ id: row.id, name: row.name, mobilityPerDay: row.mobility_loans_per_day }));
}

export interface LoanSetting extends LoanGroup {
  lendsVehicles: boolean;
}

/** Voor de instellingen: alle vestigingen met een balie, ook die niet uitlenen. */
export async function loadLoanSettings(client: DbClient): Promise<LoanSetting[]> {
  const rows = must(
    await client.from('groups').select('id, name, mobility_loans_per_day, lends_vehicles').eq('has_counter', true).order('sort_order'),
    'de vestigingen',
  );
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    mobilityPerDay: row.mobility_loans_per_day,
    lendsVehicles: row.lends_vehicles,
  }));
}

/**
 * Wat de uitleenpagina nodig heeft: alles wat nu uit staat, en alles wat sinds `since` is meegegeven
 * of retour gemeld (voor Vandaag retour, Opnieuw uitgeven en de controle).
 */
export async function loadCurrentLoans(client: DbClient, since: IsoDate): Promise<VehicleLoan[]> {
  const from = startOfLocalDay(since);
  const rows = must(
    await client
      .from('vehicle_loans')
      .select('*')
      .or(`returned_at.is.null,handed_out_at.gte.${from},returned_at.gte.${from}`)
      .order('handed_out_at'),
    'de uitleen',
  );
  return rows.map(mapVehicleLoan);
}

export async function loadLoan(client: DbClient, id: string): Promise<VehicleLoan | null> {
  const result = await client.from('vehicle_loans').select('*').eq('id', id).maybeSingle();
  if (result.error) throw new Error(`Laden van de uitleen is mislukt: ${result.error.message}`);
  return result.data ? mapVehicleLoan(result.data) : null;
}

export interface ArchiveFilter {
  from: IsoDate;
  to: IsoDate;
  groupId: string | null;
  destination: Destination | null;
  wasUsed: boolean | null;
  /** Een (deel van een) kenteken, al genormaliseerd. */
  plate: string;
}

/** Hooguit zoveel regels in het archief op het scherm; de export heeft alles. */
export const ARCHIVE_LIMIT = 300;

/** Het archief (V47): wat retour is, meegegeven in de periode, de nieuwste eerst. */
export async function loadArchive(client: DbClient, filter: ArchiveFilter): Promise<{ loans: VehicleLoan[]; more: boolean }> {
  let query = client
    .from('vehicle_loans')
    .select('*')
    .not('returned_at', 'is', null)
    .gte('handed_out_at', startOfLocalDay(filter.from))
    .lt('handed_out_at', endOfLocalDay(filter.to))
    .order('handed_out_at', { ascending: false })
    .limit(ARCHIVE_LIMIT + 1);
  if (filter.groupId) query = query.eq('group_id', filter.groupId);
  if (filter.destination) query = query.eq('destination', filter.destination);
  if (filter.wasUsed !== null) query = query.eq('was_used', filter.wasUsed);
  if (filter.plate) query = query.ilike('license_plate', `%${filter.plate}%`);
  const rows = must(await query, 'het archief').map(mapVehicleLoan);
  return { loans: rows.slice(0, ARCHIVE_LIMIT), more: rows.length > ARCHIVE_LIMIT };
}

/**
 * Per vestiging de dag van de eerste uitleen in Planbord: de controle telt de dagen daarvoor niet mee.
 * Een vestiging zonder uitleen staat er niet in.
 */
export async function loadFirstLoanDates(client: DbClient, groupIds: readonly string[]): Promise<Map<string, IsoDate>> {
  const results = await Promise.all(
    groupIds.map((groupId) =>
      client.from('vehicle_loans').select('handed_out_at').eq('group_id', groupId).order('handed_out_at').limit(1),
    ),
  );
  const dates = new Map<string, IsoDate>();
  results.forEach((result, index) => {
    const first = must(result, 'de eerste uitleen')[0];
    const groupId = groupIds[index];
    if (first && groupId) dates.set(groupId, localMoment(new Date(first.handed_out_at).toISOString()).date);
  });
  return dates;
}

/** Alles, voor de export (V50). */
export async function loadAllLoans(client: DbClient): Promise<VehicleLoan[]> {
  const rows = must(await client.from('vehicle_loans').select('*').order('handed_out_at', { ascending: false }), 'de uitleen');
  return rows.map(mapVehicleLoan);
}

/** Sluitingsdagen rond een periode, voor "te lang uit" en de controle. */
export async function loadClosures(client: DbClient, from: IsoDate, to: IsoDate): Promise<ClosureResolver> {
  const rows = must(
    await client.from('closure_days').select('*').gte('date', addDays(from, -7)).lte('date', addDays(to, 21)),
    'de sluitingsdagen',
  );
  return createClosureResolver(rows.map(mapClosure));
}

/** Het einde van de werkdag: het einde van de standaarddienst (18:00). */
export async function loadEndOfDay(client: DbClient): Promise<string> {
  const result = await client.from('settings').select('standard_shift_end').maybeSingle();
  if (result.error) throw new Error(`Laden van de instellingen is mislukt: ${result.error.message}`);
  return (result.data?.standard_shift_end ?? '18:00').slice(0, 5);
}
