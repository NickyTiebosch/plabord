import { requireLead } from '@/lib/auth/session';
import { loadEmployeeNames } from '@/lib/db/admin-queries';
import { loadAllIncidents, loadCounterGroups, loadWorkshops } from '@/lib/db/registration-queries';
import { todayInAmsterdam } from '@/lib/engine/dates';
import { incidentsExport } from '@/lib/export/registrations';
import { xlsxResponse } from '@/lib/export/response';
import { buildTitledWorkbook } from '@/lib/export/xlsx';

export const dynamic = 'force-dynamic';

/**
 * De werkplaatsmeldingen als Excel-bestand (fase 6, V64), voor beheerder en teamleider: per
 * vestiging een tabblad en een tabblad Doorbelasten. Eerst in het logboek; lukt dat niet, dan geen
 * export.
 */
export async function GET() {
  const { supabase } = await requireLead();
  const logged = await supabase.rpc('log_export', { p_kind: 'incidents', p_employee_id: null });
  if (logged.error) return new Response('De export kon niet in het logboek worden gezet. Probeer het opnieuw.', { status: 500 });
  const now = new Date();
  const [incidents, groups, workshops, names] = await Promise.all([
    loadAllIncidents(supabase),
    loadCounterGroups(supabase),
    loadWorkshops(supabase),
    loadEmployeeNames(supabase),
  ]);
  const sheets = incidentsExport(incidents, {
    groups,
    workshops,
    now,
    personName: (id) => (id ? (names.get(id) ?? 'oud-collega') : ''),
  });
  return xlsxResponse(await buildTitledWorkbook(sheets), `planbord-meldingen-${todayInAmsterdam(now)}.xlsx`);
}
