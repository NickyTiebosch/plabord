import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SubmitButton } from '@/components/client/form-controls';
import { Card, EmptyState, Notice, PageHeader, SectionTitle } from '@/components/ui';
import { buildGapDetail } from '@/lib/admin/planning';
import { requireAdmin } from '@/lib/auth/session';
import { mapGapDismissal } from '@/lib/db/mappers';
import { loadPlanningSnapshot, must } from '@/lib/db/queries';
import { isIsoDate, isoWeekKey, todayInAmsterdam } from '@/lib/engine/dates';
import { groupSlug } from '@/lib/views/tabs';
import { Flash } from '../../../admin-shared';
import { ignoreGap, unignoreGap } from '../../actions';
import { CandidateRow } from '../../gap-card';

export const metadata: Metadata = { title: 'Regelen' };

export default async function GapDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ vestiging: string; datum: string }>;
  searchParams: Promise<{ melding?: string; mail?: string }>;
}) {
  const [{ vestiging, datum }, { melding, mail }] = await Promise.all([params, searchParams]);
  if (!isIsoDate(datum) || !/^[a-z-]{1,40}$/.test(vestiging)) notFound();
  const { supabase } = await requireAdmin();
  const groupId = vestiging.replace(/-/g, '_');
  const [snapshot, dismissals] = await Promise.all([
    loadPlanningSnapshot(supabase, { from: datum, to: datum }),
    supabase
      .from('gap_dismissals')
      .select('group_id, date, day_part, shortage')
      .eq('group_id', groupId)
      .eq('date', datum)
      .then((result) => must(result, 'de genegeerde gaten').map(mapGapDismissal)),
  ]);
  const detail = buildGapDetail(snapshot, datum, groupId, dismissals);
  if (!detail) notFound();
  const past = datum < todayInAmsterdam(new Date());
  const here = `/beheer/regelen/${groupSlug(groupId)}/${datum}`;

  return (
    <>
      <PageHeader
        title={`${detail.groupName} · ${detail.dateLabel}`}
        subtitle={
          <Link href={`/rooster/${groupSlug(groupId)}?week=${isoWeekKey(datum)}`} className="underline">
            Naar het rooster van die week
          </Link>
        }
      />
      <Flash code={melding} mail={mail} />
      <p className="mb-4 flex flex-wrap gap-1.5" aria-label="Bezetting aan de balie">
        {detail.staffing.map((part) => (
          <span
            key={part.dayPart}
            className={
              part.short
                ? 'inline-flex rounded-full bg-rose-600 px-2 py-0.5 text-xs font-semibold text-white tabular-nums'
                : 'inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200 tabular-nums'
            }
          >
            {part.label}
          </span>
        ))}
      </p>

      {detail.closed ? (
        <EmptyState title="Gesloten">Op deze dag is {detail.groupName} dicht; er is niets te regelen.</EmptyState>
      ) : detail.shortParts.length === 0 ? (
        <EmptyState title="Geen tekort">{detail.groupName} zit deze dag op de norm.</EmptyState>
      ) : (
        <div className="space-y-6">
          {past ? <Notice tone="warning">Deze dag is voorbij; een inval toewijzen kan niet meer.</Notice> : null}
          {detail.ignored ? (
            <Notice tone="info" className="flex flex-wrap items-center justify-between gap-2">
              <span>Dit gat is genegeerd.</span>
              <form action={unignoreGap}>
                <input type="hidden" name="groupId" value={groupId} />
                <input type="hidden" name="date" value={datum} />
                <input type="hidden" name="terug" value={here} />
                <SubmitButton size="sm" variant="secondary">
                  Terugzetten
                </SubmitButton>
              </form>
            </Notice>
          ) : null}
          {detail.options.map((option, optionIndex) => (
            <section key={option.label}>
              <SectionTitle className="mb-2">Inval voor de {option.label}</SectionTitle>
              <Card className="px-4">
                {option.candidates.length === 0 ? (
                  <p className="py-3 text-sm text-slate-600">Niemand kan invallen.</p>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {option.candidates.map((candidate, index) => (
                      <CandidateRow
                        key={candidate.employeeId}
                        candidate={candidate}
                        groupId={groupId}
                        date={datum}
                        dayParts={option.dayParts}
                        returnTo={here}
                        primary={optionIndex === 0 && index === 0}
                      />
                    ))}
                  </ul>
                )}
                {option.excluded.length > 0 ? (
                  <details className="border-t border-slate-100 py-3">
                    <summary className="cursor-pointer text-sm font-medium text-slate-700">
                      Wie kan niet, en waarom ({option.excluded.length})
                    </summary>
                    <ul className="mt-2 space-y-1 text-sm text-slate-600">
                      {option.excluded.map((item) => (
                        <li key={item.employeeId}>
                          <span className="font-medium text-slate-800">{item.name}</span>: {item.reason}
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null}
              </Card>
            </section>
          ))}
          {detail.ignored ? null : (
            <form action={ignoreGap}>
              <input type="hidden" name="groupId" value={groupId} />
              <input type="hidden" name="date" value={datum} />
              <input type="hidden" name="terug" value="/beheer" />
              <SubmitButton variant="secondary" confirm="Dit gat negeren? Het komt terug als het tekort groter wordt.">
                Gat negeren
              </SubmitButton>
            </form>
          )}
        </div>
      )}
    </>
  );
}
