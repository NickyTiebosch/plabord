import { PeriodPicker, ReportView } from '@/components/reports';
import { PageHeader } from '@/components/ui';
import { requireLeadWith } from '@/lib/auth/session';
import { loadReport } from '@/lib/db/report-queries';
import { loadCounterGroups } from '@/lib/db/registration-queries';
import { todayInAmsterdam } from '@/lib/engine/dates';
import { REPORTS, type ReportId } from '@/lib/reports/build';
import { parseReportQuery, reportHref, type ReportParams } from '@/lib/reports/periods';

export const REPORT_PATHS: Record<ReportId, string> = {
  overzicht: '/rapporten',
  binnenvallers: '/rapporten/binnenvallers',
  meldingen: '/rapporten/meldingen',
  mobiliteit: '/rapporten/mobiliteit',
};

const SUBTITLES: Record<ReportId, string> = {
  overzicht: 'De kerncijfers per periode, met het verschil met de periode ervoor.',
  binnenvallers: 'Per vestiging en werkplaats, de top 5, en gemiddeld per werkdag.',
  meldingen: 'Per soort, vestiging en werkplaats, per 100 binnenvallers, en doorbelasten.',
  mobiliteit: 'Auto’s per werkdag tegen het minimum, niet ingezet en te lang uit.',
};

/**
 * Een rapport (fase 7, V68), voor beheerder en teamleider. De keuze van de periode staat in het
 * adres. Aantallen per vestiging en werkplaats, nooit per medewerker (V71).
 */
export async function ReportPage({ id, params }: { id: ReportId; params: ReportParams }) {
  const now = new Date();
  const today = todayInAmsterdam(now);
  const [viewer, groups] = await requireLeadWith((supabase) => loadCounterGroups(supabase));
  const query = parseReportQuery(params, today, groups.map((group) => group.id));
  const { report } = await loadReport(viewer.supabase, id, query, now);
  const path = REPORT_PATHS[id];
  const groupName = groups.find((group) => group.id === query.groupId)?.name;
  const exportHref = reportHref('/rapporten/export', query).replace('?', `?rapport=${id}&`);
  return (
    <>
      <PageHeader
        title={REPORTS[id].title}
        subtitle={`${SUBTITLES[id]}${groupName ? ` · ${groupName}` : ''}`}
        actions={
          // Een gewone link: elke klik is één export in het logboek.
          <a href={exportHref} download className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-800 hover:bg-slate-50">
            Download (Excel)
          </a>
        }
      />
      <PeriodPicker path={path} query={query} groups={groups} today={today} />
      <ReportView report={report} />
    </>
  );
}
