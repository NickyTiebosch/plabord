import type { Metadata } from 'next';
import Link from 'next/link';
import { Card, EmptyState, PageHeader, SectionTitle } from '@/components/ui';
import { gapWeeks, type GapView, type GapWeek } from '@/lib/admin/planning';
import { requireAdminWith } from '@/lib/auth/session';
import { loadPlanningOverview } from '@/lib/db/admin-queries';
import { todayInAmsterdam } from '@/lib/engine/dates';
import { formatDateRange } from '@/lib/engine/format';
import { Flash } from '../admin-shared';
import { GapCard } from './gap-card';

export const metadata: Metadata = { title: 'Nog te regelen' };

/** Het overzicht per week (V34): per week het aantal gaten en de dagen. Een tik springt naar die week. */
function WeekOverview({ weeks }: { weeks: readonly GapWeek<GapView>[] }) {
  return (
    <Card className="mb-6">
      <ul aria-label="Gaten per week" className="divide-y divide-slate-100">
        {weeks.map((week) => {
          const title = (
            <span>
              <span className="font-medium text-slate-900">Week {week.week}</span>
              <span className="text-slate-500"> · {week.rangeLabel}</span>
            </span>
          );
          const count = week.gaps.length;
          return (
            <li key={week.key}>
              {count > 0 ? (
                <a
                  href={`#week-${week.key}`}
                  className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-4 py-3 hover:bg-slate-50"
                >
                  {title}
                  <span className="text-sm">
                    <span className="font-medium text-rose-700">
                      {count} {count === 1 ? 'gat' : 'gaten'}
                    </span>
                    <span className="text-slate-600"> · {week.dayLabels.join(' · ')}</span>
                  </span>
                </a>
              ) : (
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-4 py-3">
                  {title}
                  <span className="text-sm text-slate-500">niets te regelen</span>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

export default async function GapsPage({ searchParams }: { searchParams: Promise<{ melding?: string; mail?: string }> }) {
  const { melding, mail } = await searchParams;
  const today = todayInAmsterdam(new Date());
  const [, planning] = await requireAdminWith((supabase) => loadPlanningOverview(supabase, today));
  const weeks = gapWeeks(planning.gaps, planning.window);

  return (
    <>
      <PageHeader
        title="Nog te regelen"
        subtitle={
          <>
            Gaten van {formatDateRange(planning.window.from, planning.window.to)}. Kies een voorstel; de app wijst nooit zelf toe.
            {planning.ignored.length > 0 ? (
              <>
                {' '}
                <Link href="/beheer/regelen/genegeerd" className="underline">
                  {planning.ignored.length} genegeerd
                </Link>
                .
              </>
            ) : null}
          </>
        }
      />
      <Flash code={melding} mail={mail} />
      {planning.gaps.length === 0 ? (
        <EmptyState title="Niets te regelen">Alle vestigingen zitten op de norm.</EmptyState>
      ) : (
        <>
          <WeekOverview weeks={weeks} />
          {weeks
            .filter((week) => week.gaps.length > 0)
            .map((week) => (
              <section key={week.key} id={`week-${week.key}`} className="mb-6 scroll-mt-20">
                <SectionTitle className="mb-2">
                  Week {week.week} · {week.rangeLabel}
                </SectionTitle>
                <div className="grid gap-3 lg:grid-cols-2">
                  {week.gaps.map((gap) => (
                    <GapCard key={gap.key} gap={gap} returnTo="/beheer/regelen" />
                  ))}
                </div>
              </section>
            ))}
        </>
      )}
    </>
  );
}
