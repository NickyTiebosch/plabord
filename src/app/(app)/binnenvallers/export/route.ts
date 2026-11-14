import { requireLead } from '@/lib/auth/session';
import { loadAllWalkIns, loadCounterGroups, loadWorkshops } from '@/lib/db/registration-queries';
import { todayInAmsterdam } from '@/lib/engine/dates';
import { walkInsExport } from '@/lib/export/registrations';
import { xlsxResponse } from '@/lib/export/response';
import { buildTitledWorkbook } from '@/lib/export/xlsx';

export const dynamic = 'force-dynamic';

/**
 * De binnenvallers als Excel-bestand (fase 6, V64), voor beheerder en teamleider. Eerst in het
 * logboek; lukt dat niet, dan geen export.
 */
export async function GET() {
  const { supabase } = await requireLead();
  const logged = await supabase.rpc('log_export', { p_kind: 'walk_ins', p_employee_id: null });
  if (logged.error) return new Response('De export kon niet in het logboek worden gezet. Probeer het opnieuw.', { status: 500 });
  const now = new Date();
  const [walkIns, groups, workshops] = await Promise.all([loadAllWalkIns(supabase), loadCounterGroups(supabase), loadWorkshops(supabase)]);
  const sheets = walkInsExport(walkIns, { groups, workshops, now });
  return xlsxResponse(await buildTitledWorkbook(sheets), `planbord-binnenvallers-${todayInAmsterdam(now)}.xlsx`);
}
