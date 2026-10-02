import type { Metadata } from 'next';
import Link from 'next/link';
import { SubmitButton } from '@/components/client/form-controls';
import { Badge, Card, EmptyState, PageHeader, SectionTitle } from '@/components/ui';
import { substitutionItems, type SubstitutionItem } from '@/lib/admin/planning';
import { requireAdmin } from '@/lib/auth/session';
import { loadEmployeeNames } from '@/lib/db/admin-queries';
import { mapSubstitution } from '@/lib/db/mappers';
import { loadGroups, must } from '@/lib/db/queries';
import { addDays, todayInAmsterdam } from '@/lib/engine/dates';
import { Flash } from '../admin-shared';
import { markHandled, withdrawSubstitution } from '../regelen/actions';

export const metadata: Metadata = { title: 'Invallen' };

/** Zoveel dagen terug tonen we invallen. */
const PAST_DAYS = 30;

function ItemRow({ item }: { item: SubstitutionItem }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
      <div className="min-w-0">
        <p className="font-medium text-slate-900">{item.title}</p>
        <p className="text-sm text-slate-600">{item.detail}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={item.status === 'active' ? 'brand' : 'warning'}>{item.statusLabel}</Badge>
        {item.canWithdraw ? (
          <form action={withdrawSubstitution}>
            <input type="hidden" name="id" value={item.id} />
            <input type="hidden" name="terug" value="/beheer/invallen" />
            <SubmitButton size="sm" variant="danger" confirm="Deze inval intrekken? Laat het de invaller daarna weten.">
              Intrekken
            </SubmitButton>
          </form>
        ) : null}
        {item.needsHandling ? (
          <form action={markHandled}>
            <input type="hidden" name="id" value={item.id} />
            <input type="hidden" name="terug" value="/beheer/invallen" />
            <SubmitButton size="sm" variant="secondary">
              Afgehandeld
            </SubmitButton>
          </form>
        ) : null}
      </div>
    </li>
  );
}

export default async function SubstitutionsPage({ searchParams }: { searchParams: Promise<{ melding?: string; mail?: string }> }) {
  const { melding, mail } = await searchParams;
  const { supabase } = await requireAdmin();
  const today = todayInAmsterdam(new Date());
  const [names, groups, rows] = await Promise.all([
    loadEmployeeNames(supabase),
    loadGroups(supabase),
    supabase
      .from('substitutions')
      .select('*')
      .gte('date', addDays(today, -PAST_DAYS))
      .order('date')
      .then((result) => must(result, 'de invallen').map(mapSubstitution)),
  ]);
  const items = substitutionItems(rows, names, new Map(groups.map((group) => [group.id, group.name])), today);
  const upcoming = items.filter((item) => item.date >= today);
  const past = items.filter((item) => item.date < today).reverse();

  return (
    <>
      <PageHeader
        title="Invallen"
        subtitle={
          <>
            Nieuwe invallen wijs je toe via{' '}
            <Link href="/beheer/regelen" className="underline">
              Nog te regelen
            </Link>
            . Intrekken verwijdert niets: de inval krijgt de status &ldquo;niet meer nodig&rdquo;.
          </>
        }
      />
      <Flash code={melding} mail={mail} />
      <div className="space-y-6">
        <section>
          <SectionTitle className="mb-2">Komend</SectionTitle>
          {upcoming.length === 0 ? (
            <EmptyState title="Geen invallen gepland" />
          ) : (
            <Card>
              <ul className="divide-y divide-slate-100">
                {upcoming.map((item) => (
                  <ItemRow key={item.id} item={item} />
                ))}
              </ul>
            </Card>
          )}
        </section>
        <section>
          <SectionTitle className="mb-2">Afgelopen {PAST_DAYS} dagen</SectionTitle>
          {past.length === 0 ? (
            <EmptyState title="Geen invallen" />
          ) : (
            <Card>
              <ul className="divide-y divide-slate-100">
                {past.map((item) => (
                  <ItemRow key={item.id} item={item} />
                ))}
              </ul>
            </Card>
          )}
        </section>
      </div>
    </>
  );
}
