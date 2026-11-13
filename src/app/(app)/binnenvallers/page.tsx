import type { Metadata } from 'next';
import Link from 'next/link';
import { SubmitButton } from '@/components/client/form-controls';
import { DayCloseCard, GroupSwitch, RegistrationFlash } from '@/components/registrations';
import { Card, EmptyState, PageHeader } from '@/components/ui';
import { requireViewerWith } from '@/lib/auth/session';
import { loadEmployeeNames } from '@/lib/db/admin-queries';
import { loadCounterGroups, loadDayClosures, loadWalkIns, loadWorkshops } from '@/lib/db/registration-queries';
import { addDays, isIsoDate, todayInAmsterdam } from '@/lib/engine/dates';
import { formatDayShort } from '@/lib/engine/format';
import type { IsoDate } from '@/lib/engine/types';
import { pickGroup, walkInRows } from '@/lib/registrations/status';
import { adjustWalkIn } from './actions';

export const metadata: Metadata = { title: 'Binnenvallers' };

/** Zo ver terug kan iedere collega nog bijwerken; ouder doet de teamleider (V57). */
const DAYS_BACK = 7;

/**
 * Binnenvallers (fase 6, V57): per werkplaats een teller met plus en min, voor één vestiging en
 * één dag. De hele dag door bij te werken.
 */
export default async function WalkInsPage({ searchParams }: { searchParams: Promise<{ vestiging?: string; dag?: string; melding?: string }> }) {
  const params = await searchParams;
  const today = todayInAmsterdam(new Date());
  const [viewer, [groups, workshops, names]] = await requireViewerWith((supabase) =>
    Promise.all([loadCounterGroups(supabase), loadWorkshops(supabase), loadEmployeeNames(supabase)]),
  );
  const group = pickGroup(groups, params.vestiging, viewer.groupId);
  if (!group) return <EmptyState title="Er is geen vestiging met een balie." />;
  const oldest = addDays(today, viewer.isLead ? -60 : -DAYS_BACK);
  const date: IsoDate = params.dag && isIsoDate(params.dag) && params.dag <= today && params.dag >= oldest ? params.dag : today;
  const [walkIns, closures] = await Promise.all([
    loadWalkIns(viewer.supabase, date, date, group.id),
    loadDayClosures(viewer.supabase, date, date),
  ]);
  const rows = walkInRows(workshops, walkIns, group.id, date);
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  const closure = closures.find((item) => item.groupId === group.id) ?? null;
  const here = (groupId: string, day: IsoDate) =>
    `/binnenvallers?${new URLSearchParams({ vestiging: groupId, ...(day === today ? {} : { dag: day }) })}`;
  const back = here(group.id, date);

  return (
    <>
      <PageHeader title="Binnenvallers" subtitle={`${group.name} · ${date === today ? 'vandaag' : formatDayShort(date)} · totaal ${total}`} />
      <RegistrationFlash code={params.melding} />
      <GroupSwitch groups={groups} current={group.id} href={(groupId) => here(groupId, date)} />

      <div className="mb-4 flex items-center justify-between gap-2 text-sm">
        {date > oldest ? (
          <Link href={here(group.id, addDays(date, -1))} className="inline-flex min-h-11 items-center font-medium text-brand-800 underline underline-offset-2">
            Dag eerder
          </Link>
        ) : (
          <span />
        )}
        {date < today ? (
          <Link href={here(group.id, addDays(date, 1) >= today ? today : addDays(date, 1))} className="inline-flex min-h-11 items-center font-medium text-brand-800 underline underline-offset-2">
            {addDays(date, 1) >= today ? 'Naar vandaag' : 'Dag later'}
          </Link>
        ) : null}
      </div>

      {rows.length === 0 ? (
        <EmptyState title="Deze vestiging heeft nog geen werkplaatsen.">De beheerder voegt ze toe onder Beheer → Instellingen.</EmptyState>
      ) : (
        <Card className="mb-6">
          <ul className="divide-y divide-slate-100">
            {rows.map(({ workshop, count }) => (
              <li key={workshop.id} className="flex items-center gap-3 px-4 py-2">
                <p className="min-w-0 flex-1 font-medium text-slate-900">{workshop.name}</p>
                <form action={adjustWalkIn}>
                  <input type="hidden" name="workshopId" value={workshop.id} />
                  <input type="hidden" name="date" value={date} />
                  <input type="hidden" name="delta" value="-1" />
                  <input type="hidden" name="back" value={back} />
                  <SubmitButton variant="secondary" className="size-12 !px-0 text-xl" >
                    <span aria-hidden="true">−</span>
                    <span className="sr-only">Eén minder bij {workshop.name}</span>
                  </SubmitButton>
                </form>
                <p className="w-10 text-center text-xl font-semibold tabular-nums text-slate-900" aria-label={`${count} bij ${workshop.name}`}>
                  {count}
                </p>
                <form action={adjustWalkIn}>
                  <input type="hidden" name="workshopId" value={workshop.id} />
                  <input type="hidden" name="date" value={date} />
                  <input type="hidden" name="delta" value="1" />
                  <input type="hidden" name="back" value={back} />
                  <SubmitButton className="size-12 !px-0 text-xl">
                    <span aria-hidden="true">+</span>
                    <span className="sr-only">Eén erbij bij {workshop.name}</span>
                  </SubmitButton>
                </form>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <DayCloseCard
        group={group}
        date={date}
        today={today}
        closure={closure}
        closedByName={closure?.closedBy ? (names.get(closure.closedBy) ?? null) : null}
        canReopen={viewer.isLead}
        back={back}
      />
    </>
  );
}
