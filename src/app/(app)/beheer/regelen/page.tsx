import type { Metadata } from 'next';
import Link from 'next/link';
import { EmptyState, PageHeader } from '@/components/ui';
import { requireAdmin } from '@/lib/auth/session';
import { loadPlanningOverview } from '@/lib/db/admin-queries';
import { todayInAmsterdam } from '@/lib/engine/dates';
import { formatDateRange } from '@/lib/engine/format';
import { Flash } from '../admin-shared';
import { GapCard } from './gap-card';

export const metadata: Metadata = { title: 'Nog te regelen' };

export default async function GapsPage({ searchParams }: { searchParams: Promise<{ melding?: string; mail?: string }> }) {
  const { melding, mail } = await searchParams;
  const { supabase } = await requireAdmin();
  const planning = await loadPlanningOverview(supabase, todayInAmsterdam(new Date()));

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
        <div className="grid gap-3 lg:grid-cols-2">
          {planning.gaps.map((gap) => (
            <GapCard key={gap.key} gap={gap} returnTo="/beheer/regelen" />
          ))}
        </div>
      )}
    </>
  );
}
