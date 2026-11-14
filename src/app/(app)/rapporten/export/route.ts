import type { NextRequest } from 'next/server';
import { requireLead } from '@/lib/auth/session';
import { loadReport } from '@/lib/db/report-queries';
import { loadCounterGroups } from '@/lib/db/registration-queries';
import { todayInAmsterdam } from '@/lib/engine/dates';
import { reportExport } from '@/lib/export/reports';
import { xlsxResponse } from '@/lib/export/response';
import { buildExportWorkbook } from '@/lib/export/xlsx';
import { REPORTS, isReportId } from '@/lib/reports/build';
import { parseReportQuery } from '@/lib/reports/periods';

export const dynamic = 'force-dynamic';

/**
 * Een rapport als Excel-bestand (fase 7, V70), met dezelfde periode en cijfers als op het scherm.
 * Eerst in het logboek; lukt dat niet, dan geen export.
 */
export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams;
  const id = search.get('rapport');
  if (!isReportId(id)) return new Response('Onbekend rapport.', { status: 404 });
  const { supabase } = await requireLead();
  const logged = await supabase.rpc('log_export', { p_kind: 'reports', p_employee_id: null });
  if (logged.error) return new Response('De export kon niet in het logboek worden gezet. Probeer het opnieuw.', { status: 500 });
  const now = new Date();
  const today = todayInAmsterdam(now);
  const groups = await loadCounterGroups(supabase);
  const query = parseReportQuery(
    {
      per: search.get('per') ?? undefined,
      aantal: search.get('aantal') ?? undefined,
      maanden: search.getAll('maanden'),
      vestiging: search.get('vestiging') ?? undefined,
    },
    today,
    groups.map((group) => group.id),
  );
  const { report } = await loadReport(supabase, id, query, now);
  const sheets = reportExport(report, {
    title: REPORTS[id].title,
    query,
    groupName: groups.find((group) => group.id === query.groupId)?.name ?? null,
  });
  return xlsxResponse(await buildExportWorkbook(sheets), `planbord-rapport-${id}-${today}.xlsx`);
}
