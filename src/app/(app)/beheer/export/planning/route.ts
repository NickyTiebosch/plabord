import { requireAdmin } from '@/lib/auth/session';
import { loadPlanningExport } from '@/lib/db/export-queries';
import { todayInAmsterdam } from '@/lib/engine/dates';
import { planningExport } from '@/lib/export/planning';
import { xlsxResponse } from '@/lib/export/response';
import { buildExportWorkbook } from '@/lib/export/xlsx';

export const dynamic = 'force-dynamic';

/** De hele planning als Excel-bestand (fase 3, V20). Eerst in het logboek; lukt dat niet, dan geen export. */
export async function GET() {
  const { supabase } = await requireAdmin();
  const logged = await supabase.rpc('log_export', { p_kind: 'planning', p_employee_id: null });
  if (logged.error) return new Response('De export kon niet in het logboek worden gezet. Probeer het opnieuw.', { status: 500 });
  const today = todayInAmsterdam(new Date());
  const file = await buildExportWorkbook(planningExport(await loadPlanningExport(supabase), today));
  return xlsxResponse(file, `planbord-export-${today}.xlsx`);
}
