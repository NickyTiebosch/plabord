import type { Metadata } from 'next';
import { LeaveLegend, LeaveTimeline } from '@/components/leave-timeline';
import { LinkTabs, PeriodNav } from '@/components/schedule';
import { PageHeader } from '@/components/ui';
import { requireViewer } from '@/lib/auth/session';
import { loadPlanningSnapshot } from '@/lib/db/queries';
import { todayInAmsterdam } from '@/lib/engine/dates';
import { computeLeaveOverview } from '@/lib/engine/leave-overview';
import { LEAVE_VIEWS, leaveRange, parseAnchor, parseLeaveView, type LeaveView } from '@/lib/views/leave';

export const metadata: Metadata = { title: 'Verlofoverzicht' };

const VIEW_LABELS: Record<LeaveView, string> = { maand: 'Maand', kwartaal: 'Kwartaal', jaar: 'Jaar' };

function href(view: LeaveView, date?: string) {
  const params = new URLSearchParams();
  if (view !== 'maand') params.set('weergave', view);
  if (date) params.set('datum', date);
  const query = params.toString();
  return query ? `/verlof?${query}` : '/verlof';
}

export default async function LeaveOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ weergave?: string; datum?: string }>;
}) {
  const params = await searchParams;
  const viewer = await requireViewer();
  const today = todayInAmsterdam(new Date());
  const view = parseLeaveView(params.weergave);
  const range = leaveRange(view, parseAnchor(params.datum, today));
  const snapshot = await loadPlanningSnapshot(viewer.supabase, { from: range.from, to: range.to });
  const overview = computeLeaveOverview(snapshot, range.from, range.to);

  return (
    <>
      <PageHeader title="Verlofoverzicht" subtitle="Wie is wanneer afwezig. Vakantie, training en ziekte heten allemaal “Afwezig”." />
      <LinkTabs
        active={view}
        tabs={LEAVE_VIEWS.map((item) => ({ key: item, label: VIEW_LABELS[item], href: href(item, params.datum) }))}
      />
      <PeriodNav
        title={range.title}
        previousHref={href(view, range.previous)}
        nextHref={href(view, range.next)}
        todayHref={href(view)}
      />
      <LeaveLegend />
      <LeaveTimeline overview={overview} view={view} today={today} linkBars={viewer.isAdmin} />
      <p className="mt-3 text-xs text-slate-500">
        Per vestiging staat per week hoeveel medewerkers minstens een dagdeel afwezig zijn (ma–za), van het aantal in die
        vestiging.
      </p>
    </>
  );
}
