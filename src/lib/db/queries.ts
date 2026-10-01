import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';
import { addDays } from '../engine/dates';
import { HISTORY_DAYS } from '../engine/history';
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
  mapShiftOverride,
  mapStaffingNorm,
  mapSubstitution,
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

export async function loadStaffingNorms(client: DbClient) {
  const rows = must(await client.from('staffing_norms').select('group_id, weekday, day_part, min_staff'), 'de normen');
  return rows.map(mapStaffingNorm);
}

/**
 * Alle gegevens die de engine nodig heeft voor een periode: vaste diensten, afwezigheid,
 * roosterwijzigingen en sluitingsdagen die de periode raken, en de normen. Invallen vanaf
 * 90 dagen vóór de periode, voor de teller "het minst ingevallen" (besluit V7).
 */
export async function loadPlanningSnapshot(
  client: DbClient,
  range: { from: IsoDate; to: IsoDate },
): Promise<PlanningSnapshot> {
  const [settings, groups, employees, eligibility, shifts, absences, closures, substitutions, overrides, norms] =
    await Promise.all([
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
      client.from('substitutions').select('*').gte('date', addDays(range.from, -HISTORY_DAYS)).lte('date', range.to),
      client.from('shift_overrides').select('*').gte('date', range.from).lte('date', range.to),
      loadStaffingNorms(client),
    ]);
  const counters = counterGroupsByEmployee(must(eligibility, 'de inzetbaarheid'));
  return {
    settings,
    groups,
    employees: must(employees, 'de medewerkers').map((row) => mapEmployee(row, counters.get(row.id) ?? [])),
    recurringShifts: must(shifts, 'de vaste diensten').map(mapRecurringShift),
    absences: must(absences, 'de afwezigheid').map(mapAbsence),
    closureOverrides: must(closures, 'de sluitingsdagen').map(mapClosure),
    substitutions: must(substitutions, 'de invallen').map(mapSubstitution),
    shiftOverrides: must(overrides, 'de roosterwijzigingen').map(mapShiftOverride),
    staffingNorms: norms,
  };
}
