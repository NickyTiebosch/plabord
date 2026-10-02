import { isUuid } from '@/lib/admin/forms';
import { requireAdmin } from '@/lib/auth/session';
import { loadEmployeeExport } from '@/lib/db/export-queries';
import { todayInAmsterdam } from '@/lib/engine/dates';
import { employeeExport } from '@/lib/export/employee';
import { xlsxResponse } from '@/lib/export/response';
import { buildExportWorkbook } from '@/lib/export/xlsx';

export const dynamic = 'force-dynamic';

/**
 * Alle gegevens van één medewerker als Excel-bestand (fase 3, V20), bijvoorbeeld voor een
 * inzageverzoek. Eerst in het logboek; lukt dat niet, dan geen export.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) return new Response('Niet gevonden', { status: 404 });
  const { supabase } = await requireAdmin();
  const data = await loadEmployeeExport(supabase, id);
  if (!data) return new Response('Niet gevonden', { status: 404 });
  const logged = await supabase.rpc('log_export', { p_kind: 'employee', p_employee_id: id });
  if (logged.error) return new Response('De export kon niet in het logboek worden gezet. Probeer het opnieuw.', { status: 500 });
  const file = await buildExportWorkbook(employeeExport(data));
  return xlsxResponse(file, `planbord-gegevens-medewerker-${todayInAmsterdam(new Date())}.xlsx`);
}
