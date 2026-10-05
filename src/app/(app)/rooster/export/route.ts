import { requireViewer } from '@/lib/auth/session';
import { loadPlanningSnapshot } from '@/lib/db/queries';
import { todayInAmsterdam } from '@/lib/engine/dates';
import { xlsxResponse } from '@/lib/export/response';
import { rosterExport, rosterFileName, rosterPeriod } from '@/lib/export/roster';
import { buildRosterWorkbook } from '@/lib/export/xlsx';

export const dynamic = 'force-dynamic';

/**
 * Het rooster als Excel-bestand (aanvulling op fase 3, besluit V22), voor iedereen die kan
 * inloggen. Met de eigen sessie, dus met dezelfde rechten als het Rooster-scherm. Niet in het
 * logboek: er staat niets in wat het scherm niet ook laat zien, en geen e-mailadressen.
 */
export async function GET(request: Request) {
  const viewer = await requireViewer();
  const params = new URL(request.url).searchParams;
  const today = todayInAmsterdam(new Date());
  const period = rosterPeriod(params.get('van'), params.get('tot'), today);
  const snapshot = await loadPlanningSnapshot(viewer.supabase, { from: period.from, to: period.to });
  const file = await buildRosterWorkbook(rosterExport(snapshot, period, today));
  return xlsxResponse(file, rosterFileName(period));
}
