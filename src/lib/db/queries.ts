import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';
import type { IsoDate, PlanningSnapshot } from '../engine/types';
import type { Database } from './database.types';
import {
  counterGroupsByEmployee,
  mapAbsence,
  mapClosure,
  mapEmployee,
  mapGroup,
  mapRecurringShift,
  mapSettings,
} from './mappers';

export type DbClient = SupabaseClient<Database>;

export class DataError extends Error {}

/** Geeft de data terug, of gooit een fout met een Nederlandse omschrijving. */
export function must<T>(result: { data: T | null; error: PostgrestError | null }, what: string): T {
  if (result.error) throw new DataError(`Laden van ${what} is mislukt: ${result.error.message}`);
  if (result.data === null) throw new DataError(`Geen ${what} gevonden.`);
  return result.data;
}

export async function loadSettings(client: DbClient) {
  const result = await client.from('settings').select('*').maybeSingle();
  if (result.error) throw new DataError(`Laden van de instellingen is mislukt: ${result.error.message}`);
  if (!result.data) throw new DataError('De instellingen ontbreken. Draai supabase/setup/fase-1.sql in Supabase.');
  return mapSettings(result.data);
}

export async function loadGroups(client: DbClient) {
  const rows = must(await client.from('groups').select('*').order('sort_order'), 'de groepen');
  return rows.map(mapGroup);
}

/**
 * Alle gegevens die de engine nodig heeft voor een periode: vaste diensten en afwezigheid die
 * de periode raken, en de afwijkingen op de sluitingsdagen erin.
 */
export async function loadPlanningSnapshot(
  client: DbClient,
  range: { from: IsoDate; to: IsoDate },
): Promise<PlanningSnapshot> {
  const [settings, groups, employees, eligibility, shifts, absences, closures] = await Promise.all([
    loadSettings(client),
    loadGroups(client),
    client.from('employees').select('*'),
    client.from('counter_eligibility').select('employee_id, group_id'),
    client
      .from('recurring_shifts')
      .select('*')
      .lte('valid_from', range.to)
      .or(`valid_to.is.null,valid_to.gte.${range.from}`),
    client.from('absences').select('*').lte('start_date', range.to).gte('end_date', range.from),
    client.from('closure_days').select('*').gte('date', range.from).lte('date', range.to),
  ]);
  const counters = counterGroupsByEmployee(must(eligibility, 'de inzetbaarheid'));
  return {
    settings,
    groups,
    employees: must(employees, 'de medewerkers').map((row) => mapEmployee(row, counters.get(row.id) ?? [])),
    recurringShifts: must(shifts, 'de vaste diensten').map(mapRecurringShift),
    absences: must(absences, 'de afwezigheid').map(mapAbsence),
    closureOverrides: must(closures, 'de sluitingsdagen').map(mapClosure),
    substitutions: [],
    shiftOverrides: [],
    staffingNorms: [],
  };
}
