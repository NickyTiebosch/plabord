import type { Metadata } from 'next';
import { GroupSwitch } from '@/components/registrations';
import { Card, EmptyState, PageHeader, buttonClass } from '@/components/ui';
import { requireViewerWith } from '@/lib/auth/session';
import { loadCounterGroups, loadWalkIns, loadWorkshops } from '@/lib/db/registration-queries';
import { todayInAmsterdam } from '@/lib/engine/dates';
import { formatDayShort } from '@/lib/engine/format';
import { pickGroup, recentDays, walkInRows } from '@/lib/registrations/status';

export const metadata: Metadata = { title: 'Binnenvallers: overzicht' };

const DAYS = 18;

/** De laatste drie weken per werkplaats, zoals het tabblad in het oude Excel-bestand. */
export default async function WalkInsOverviewPage({ searchParams }: { searchParams: Promise<{ vestiging?: string }> }) {
  const { vestiging } = await searchParams;
  const today = todayInAmsterdam(new Date());
  const days = recentDays(today, DAYS);
  const first = days.at(-1) ?? today;
  const [viewer, [groups, workshops, walkIns]] = await requireViewerWith((supabase) =>
    Promise.all([loadCounterGroups(supabase), loadWorkshops(supabase), loadWalkIns(supabase, first, today)]),
  );
  const group = pickGroup(groups, vestiging, viewer.groupId);
  if (!group) return <EmptyState title="Er is geen vestiging met een balie." />;
  const own = walkIns.filter((row) => row.groupId === group.id);
  const columns = workshops.filter((workshop) => workshop.groupId === group.id && (workshop.isActive || own.some((row) => row.workshopId === workshop.id && row.count > 0)));

  return (
    <>
      <PageHeader
        title="Binnenvallers: overzicht"
        subtitle={`${group.name} · de laatste drie weken`}
        actions={
          viewer.isLead ? (
            // Een gewone link: elke klik is één export in het logboek.
            <a href="/binnenvallers/export" download className={buttonClass('secondary')}>
              Download (Excel)
            </a>
          ) : null
        }
      />
      <GroupSwitch groups={groups} current={group.id} href={(groupId) => `/binnenvallers/overzicht?vestiging=${groupId}`} />
      <Card className="relative overflow-x-auto">
        <table className="w-full min-w-max text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-600">
              <th scope="col" className="sticky left-0 bg-white px-3 py-2 font-medium">
                Dag
              </th>
              {columns.map((workshop) => (
                <th key={workshop.id} scope="col" className="px-3 py-2 text-right font-medium">
                  {workshop.name}
                </th>
              ))}
              <th scope="col" className="px-3 py-2 text-right font-semibold text-slate-900">
                Totaal
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {days.map((date) => {
              const rows = new Map(walkInRows(workshops, own, group.id, date).map((row) => [row.workshop.id, row.count]));
              const total = [...rows.values()].reduce((sum, count) => sum + count, 0);
              return (
                <tr key={date} className={date === today ? 'bg-brand-50/60' : undefined}>
                  <th scope="row" className="sticky left-0 bg-inherit px-3 py-2 text-left font-medium whitespace-nowrap text-slate-900">
                    {date === today ? 'vandaag' : formatDayShort(date)}
                  </th>
                  {columns.map((workshop) => (
                    <td key={workshop.id} className="px-3 py-2 text-right tabular-nums text-slate-700">
                      {rows.get(workshop.id) || <span className="text-slate-300">0</span>}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-right font-semibold tabular-nums text-slate-900">{total}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </>
  );
}
