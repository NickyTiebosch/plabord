import { requireLead } from '@/lib/auth/session';
import { loadEmployeeNames } from '@/lib/db/admin-queries';
import { loadAllLoans, loadLoanGroups } from '@/lib/db/loan-queries';
import { todayInAmsterdam } from '@/lib/engine/dates';
import { loansExport } from '@/lib/export/loans';
import { xlsxResponse } from '@/lib/export/response';
import { buildLoansWorkbook } from '@/lib/export/xlsx';

export const dynamic = 'force-dynamic';

/**
 * De uitleen als Excel-bestand (fase 5, V50), voor beheerder en teamleider. Eerst in het logboek;
 * lukt dat niet, dan geen export.
 */
export async function GET() {
  const { supabase } = await requireLead();
  const logged = await supabase.rpc('log_export', { p_kind: 'loans', p_employee_id: null });
  if (logged.error) return new Response('De export kon niet in het logboek worden gezet. Probeer het opnieuw.', { status: 500 });
  const now = new Date();
  const [loans, groups, names] = await Promise.all([loadAllLoans(supabase), loadLoanGroups(supabase), loadEmployeeNames(supabase)]);
  const sheets = loansExport(loans, {
    now,
    groupName: (id) => groups.find((group) => group.id === id)?.name ?? id,
    personName: (id) => (id ? (names.get(id) ?? 'oud-collega') : 'oud-collega'),
  });
  return xlsxResponse(await buildLoansWorkbook(sheets), `planbord-mobiliteit-${todayInAmsterdam(now)}.xlsx`);
}
