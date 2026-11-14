/**
 * Binnenvallers, meldingen en dag afsluiten laden (fase 6). Met de sessie van wie kijkt: RLS geldt.
 * Iedere ingelogde collega mag dit lezen.
 */
import { parseTime } from '../engine/time';
import type { IsoDate, TimeOfDay } from '../engine/types';
import { endOfLocalDay, startOfLocalDay } from '../loans/time';
import {
  isIncidentKind,
  isMissing,
  type CounterGroup,
  type DayClosure,
  type Incident,
  type IncidentKind,
  type WalkIn,
  type Workshop,
} from '../registrations/types';
import type { Tables } from './database.types';
import { must, type DbClient } from './queries';

const iso = (value: string) => new Date(value).toISOString();

export function mapWorkshop(row: Tables<'workshops'>): Workshop {
  return { id: row.id, groupId: row.group_id, name: row.name, sortOrder: row.sort_order, isActive: row.is_active };
}

export function mapWalkIn(row: Tables<'walk_ins'>): WalkIn {
  return {
    groupId: row.group_id,
    workshopId: row.workshop_id,
    date: row.date,
    count: row.count,
    updatedBy: row.updated_by,
    updatedAt: iso(row.updated_at),
  };
}

export function mapIncident(row: Tables<'incident_reports'>): Incident {
  return {
    id: row.id,
    groupId: row.group_id,
    workshopId: row.workshop_id,
    occurredAt: iso(row.occurred_at),
    kind: isIncidentKind(row.kind) ? row.kind : 'wrong_vehicle',
    missing: isMissing(row.missing) ? row.missing : null,
    cancelledAt: row.cancelled_at ? parseTime(row.cancelled_at.slice(0, 5)) : null,
    charge: row.charge,
    chargedAt: row.charged_at ? iso(row.charged_at) : null,
    chargedBy: row.charged_by,
    plate: row.license_plate,
    contractNumber: row.contract_number,
    note: row.note,
    reportedBy: row.reported_by,
    createdAt: iso(row.created_at),
  };
}

export function mapDayClosure(row: Tables<'day_closures'>): DayClosure {
  return { groupId: row.group_id, date: row.date, rentlinkChecked: row.rentlink_checked, closedBy: row.closed_by, closedAt: iso(row.closed_at) };
}

/** De vestigingen met een balie. */
export async function loadCounterGroups(client: DbClient): Promise<CounterGroup[]> {
  const rows = must(await client.from('groups').select('id, name').eq('has_counter', true).order('sort_order'), 'de vestigingen');
  return rows.map((row) => ({ id: row.id, name: row.name }));
}

export async function loadWorkshops(client: DbClient): Promise<Workshop[]> {
  const rows = must(await client.from('workshops').select('*').order('sort_order').order('name'), 'de werkplaatsen');
  return rows.map(mapWorkshop);
}

export async function loadWalkIns(client: DbClient, from: IsoDate, to: IsoDate, groupId?: string): Promise<WalkIn[]> {
  let query = client.from('walk_ins').select('*').gte('date', from).lte('date', to);
  if (groupId) query = query.eq('group_id', groupId);
  return must(await query, 'de binnenvallers').map(mapWalkIn);
}

export interface IncidentFilter {
  from: IsoDate;
  to: IsoDate;
  groupId?: string | null;
  kind?: IncidentKind | null;
  workshopId?: string | null;
  plate?: string;
}

/** Hooguit zoveel meldingen op het scherm; de export heeft alles. */
export const INCIDENT_LIMIT = 300;

export async function loadIncidents(client: DbClient, filter: IncidentFilter): Promise<{ incidents: Incident[]; more: boolean }> {
  let query = client
    .from('incident_reports')
    .select('*')
    .gte('occurred_at', startOfLocalDay(filter.from))
    .lt('occurred_at', endOfLocalDay(filter.to))
    .order('occurred_at', { ascending: false })
    .limit(INCIDENT_LIMIT + 1);
  if (filter.groupId) query = query.eq('group_id', filter.groupId);
  if (filter.kind) query = query.eq('kind', filter.kind);
  if (filter.workshopId) query = query.eq('workshop_id', filter.workshopId);
  if (filter.plate) query = query.ilike('license_plate', `%${filter.plate}%`);
  const rows = must(await query, 'de meldingen').map(mapIncident);
  return { incidents: rows.slice(0, INCIDENT_LIMIT), more: rows.length > INCIDENT_LIMIT };
}

export async function loadIncident(client: DbClient, id: string): Promise<Incident | null> {
  const result = await client.from('incident_reports').select('*').eq('id', id).maybeSingle();
  if (result.error) throw new Error(`Laden van de melding is mislukt: ${result.error.message}`);
  return result.data ? mapIncident(result.data) : null;
}

/** Alle annuleringen die doorbelast moeten worden (V62). */
export async function loadChargeable(client: DbClient): Promise<Incident[]> {
  const rows = must(
    await client.from('incident_reports').select('*').eq('charge', true).order('occurred_at', { ascending: false }).limit(1000),
    'de doorbelastlijst',
  );
  return rows.map(mapIncident);
}

export async function loadDayClosures(client: DbClient, from: IsoDate, to: IsoDate): Promise<DayClosure[]> {
  return must(await client.from('day_closures').select('*').gte('date', from).lte('date', to), 'de afgesloten dagen').map(mapDayClosure);
}

/** Per vestiging de eerste dag die in Planbord is afgesloten: de invulcontrole telt vanaf dan (V61). */
export async function loadFirstClosedDates(client: DbClient, groupIds: readonly string[]): Promise<Map<string, IsoDate>> {
  const results = await Promise.all(
    groupIds.map((groupId) => client.from('day_closures').select('date').eq('group_id', groupId).order('date').limit(1)),
  );
  const dates = new Map<string, IsoDate>();
  results.forEach((result, index) => {
    const first = must(result, 'de eerste afgesloten dag')[0];
    const groupId = groupIds[index];
    if (first && groupId) dates.set(groupId, first.date);
  });
  return dates;
}

export interface RegistrationSettings {
  chargeFrom: TimeOfDay;
  reminderAt: TimeOfDay | null;
}

export async function loadRegistrationSettings(client: DbClient): Promise<RegistrationSettings> {
  const result = await client.from('settings').select('charge_cancellation_from, day_close_reminder_at').maybeSingle();
  if (result.error) throw new Error(`Laden van de instellingen is mislukt: ${result.error.message}`);
  return {
    chargeFrom: parseTime((result.data?.charge_cancellation_from ?? '11:00').slice(0, 5)) ?? '11:00',
    reminderAt: result.data?.day_close_reminder_at ? parseTime(result.data.day_close_reminder_at.slice(0, 5)) : null,
  };
}

/** Alles van één dag van alle vestigingen, voor Start en de invulcontrole. */
export async function loadDayData(client: DbClient, from: IsoDate, to: IsoDate) {
  const [closures, walkIns, incidents] = await Promise.all([
    loadDayClosures(client, from, to),
    loadWalkIns(client, from, to),
    client
      .from('incident_reports')
      .select('*')
      .gte('occurred_at', startOfLocalDay(from))
      .lt('occurred_at', endOfLocalDay(to))
      .then((result) => must(result, 'de meldingen').map(mapIncident)),
  ]);
  return { closures, walkIns, incidents };
}

/** Alles voor de export (V64). */
export async function loadAllWalkIns(client: DbClient): Promise<WalkIn[]> {
  const rows: WalkIn[] = [];
  // Supabase geeft hooguit 1000 regels per vraag: per jaar laden.
  const firstYear = 2026;
  const lastYear = new Date().getUTCFullYear() + 1;
  for (let year = firstYear; year <= lastYear; year++) {
    for (const [from, to] of [[`${year}-01-01`, `${year}-03-31`], [`${year}-04-01`, `${year}-06-30`], [`${year}-07-01`, `${year}-09-30`], [`${year}-10-01`, `${year}-12-31`]] as const) {
      rows.push(...(await loadWalkIns(client, from, to)));
    }
  }
  return rows;
}

export async function loadAllIncidents(client: DbClient): Promise<Incident[]> {
  const rows: Incident[] = [];
  for (let page = 0; page < 50; page++) {
    const batch = must(
      await client.from('incident_reports').select('*').order('occurred_at').order('id').range(page * 1000, page * 1000 + 999),
      'de meldingen',
    );
    rows.push(...batch.map(mapIncident));
    if (batch.length < 1000) break;
  }
  return rows;
}

