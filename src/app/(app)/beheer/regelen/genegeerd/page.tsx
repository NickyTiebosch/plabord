import type { Metadata } from 'next';
import Link from 'next/link';
import { SubmitButton } from '@/components/client/form-controls';
import { Card, EmptyState, PageHeader } from '@/components/ui';
import { requireAdminWith } from '@/lib/auth/session';
import { loadPlanningOverview } from '@/lib/db/admin-queries';
import { todayInAmsterdam } from '@/lib/engine/dates';
import { Flash } from '../../admin-shared';
import { unignoreGap } from '../actions';

export const metadata: Metadata = { title: 'Genegeerde gaten' };

export default async function IgnoredGapsPage({ searchParams }: { searchParams: Promise<{ melding?: string }> }) {
  const { melding } = await searchParams;
  const today = todayInAmsterdam(new Date());
  const [, planning] = await requireAdminWith((supabase) => loadPlanningOverview(supabase, today));

  return (
    <>
      <PageHeader
        title="Genegeerde gaten"
        subtitle="Een genegeerd gat komt vanzelf terug als het tekort groter wordt. Je kunt het ook nu terugzetten."
      />
      <Flash code={melding} />
      {planning.ignored.length === 0 ? (
        <EmptyState title="Geen genegeerde gaten">
          <Link href="/beheer/regelen" className="underline">
            Naar Nog te regelen
          </Link>
        </EmptyState>
      ) : (
        <Card>
          <ul className="divide-y divide-slate-100">
            {planning.ignored.map((gap) => (
              <li key={gap.key} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <div>
                  <p className="font-medium text-slate-900">
                    {gap.groupName} · {gap.dateLabel}
                  </p>
                  <p className="text-sm text-slate-600">{gap.parts.map((part) => part.label).join(', ')}</p>
                </div>
                <form action={unignoreGap}>
                  <input type="hidden" name="groupId" value={gap.groupId} />
                  <input type="hidden" name="date" value={gap.date} />
                  <input type="hidden" name="terug" value="/beheer/regelen/genegeerd" />
                  <SubmitButton size="sm" variant="secondary">
                    Terugzetten
                  </SubmitButton>
                </form>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
