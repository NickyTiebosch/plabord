import { requireLead } from '@/lib/auth/session';
import { loadEmployeeNames } from '@/lib/db/admin-queries';
import { loadLocations, loadSpots } from '@/lib/db/location-queries';
import { loadCounterGroups } from '@/lib/db/registration-queries';
import { todayInAmsterdam } from '@/lib/engine/dates';
import { locationsExport } from '@/lib/export/locations';
import { xlsxResponse } from '@/lib/export/response';
import { buildTitledWorkbook } from '@/lib/export/xlsx';

export const dynamic = 'force-dynamic';

/**
 * De locatie van de huurauto's als Excel-bestand (fase 8, V78), voor beheerder en teamleider. Eerst
 * in het logboek; lukt dat niet, dan geen export.
 */
export async function GET() {
  const { supabase } = await requireLead();
  const logged = await supabase.rpc('log_export', { p_kind: 'locations', p_employee_id: null });
  if (logged.error) return new Response('De export kon niet in het logboek worden gezet. Probeer het opnieuw.', { status: 500 });
  const now = new Date();
  const [groups, spots, locations, names] = await Promise.all([loadCounterGroups(supabase), loadSpots(supabase), loadLocations(supabase), loadEmployeeNames(supabase)]);
  const sheets = locationsExport(locations, {
    groups,
    spots,
    now,
    today: todayInAmsterdam(now),
    personName: (id) => (id ? (names.get(id) ?? 'oud-collega') : 'oud-collega'),
  });
  return xlsxResponse(await buildTitledWorkbook(sheets), `planbord-locatie-${todayInAmsterdam(now)}.xlsx`);
}
