import { requireLead } from '@/lib/auth/session';
import { loadEmployeeNames } from '@/lib/db/admin-queries';
import { loadNotes } from '@/lib/db/handover-queries';
import { loadCounterGroups } from '@/lib/db/registration-queries';
import { todayInAmsterdam } from '@/lib/engine/dates';
import { handoverExport } from '@/lib/export/handover';
import { xlsxResponse } from '@/lib/export/response';
import { buildTitledWorkbook } from '@/lib/export/xlsx';

export const dynamic = 'force-dynamic';

/** De overdracht als Excel-bestand (fase 8), voor beheerder en teamleider. Eerst in het logboek. */
export async function GET() {
  const { supabase } = await requireLead();
  const logged = await supabase.rpc('log_export', { p_kind: 'handover', p_employee_id: null });
  if (logged.error) return new Response('De export kon niet in het logboek worden gezet. Probeer het opnieuw.', { status: 500 });
  const now = new Date();
  const [groups, notes, names] = await Promise.all([loadCounterGroups(supabase), loadNotes(supabase), loadEmployeeNames(supabase)]);
  const sheets = handoverExport(notes, { groups, now, personName: (id) => (id ? (names.get(id) ?? 'oud-collega') : 'oud-collega') });
  return xlsxResponse(await buildTitledWorkbook(sheets), `planbord-overdracht-${todayInAmsterdam(now)}.xlsx`);
}
