import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SubmitButton } from '@/components/client/form-controls';
import { Badge, Card, Notice, PageHeader, SectionTitle } from '@/components/ui';
import { isUuid } from '@/lib/admin/forms';
import { safeReturnPath } from '@/lib/admin/planning';
import { requireAdminWith } from '@/lib/auth/session';
import { loadPlanningSnapshot } from '@/lib/db/queries';
import { isIsoDate, isoWeekKey, weekdayOf } from '@/lib/engine/dates';
import { formatDayShort } from '@/lib/engine/format';
import { ABSENCE_PART_LABELS, DAY_PART_LABELS, ROLE_LABELS } from '@/lib/engine/labels';
import { createScheduleContext } from '@/lib/engine/schedule';
import { formatTimeRange } from '@/lib/engine/time';
import { groupSlug } from '@/lib/views/tabs';
import { Flash } from '../../../admin-shared';
import { clearDayChange, setDayOff } from '../../actions';
import { DayShiftForm, MoveShiftForm } from './day-forms';

export const metadata: Metadata = { title: 'Rooster voor één dag' };

export default async function DayChangePage({
  params,
  searchParams,
}: {
  params: Promise<{ medewerker: string; datum: string }>;
  searchParams: Promise<{ terug?: string; melding?: string; mail?: string }>;
}) {
  const [{ medewerker, datum }, { terug, melding, mail }] = await Promise.all([params, searchParams]);
  if (!isUuid(medewerker) || !isIsoDate(datum)) notFound();
  const [, snapshot] = await requireAdminWith((supabase) => loadPlanningSnapshot(supabase, { from: datum, to: datum }));
  const context = createScheduleContext(snapshot);
  const employee = context.employeesById.get(medewerker);
  if (!employee) notFound();

  const entries = context.entriesOn(datum).filter((entry) => entry.employeeId === medewerker);
  const regular = entries.find((entry) => entry.kind === 'regular') ?? null;
  const substitution = entries.find((entry) => entry.kind === 'substitution') ?? null;
  const override = context.overrideOn(medewerker, datum);
  const absences = context.absencesOn(medewerker, datum);
  const groupName = (id: string) => context.groupsById.get(id)?.name ?? id;
  const sunday = weekdayOf(datum) === 7;
  const fallback = `/rooster/${groupSlug(regular?.groupId ?? employee.groupId)}?week=${isoWeekKey(datum)}`;
  const returnTo = safeReturnPath(terug, fallback);
  const here = `/beheer/rooster/${medewerker}/${datum}?terug=${encodeURIComponent(returnTo)}`;
  const groups = [...context.groupsById.values()]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((group) => ({ id: group.id, name: group.name }));
  const defaults = {
    employeeId: medewerker,
    date: datum,
    groupId: regular?.groupId ?? employee.groupId,
    role: regular?.role ?? employee.defaultRole,
    startTime: override?.startTime ?? '',
    endTime: override?.endTime ?? '',
    returnTo: here,
  };

  return (
    <>
      <PageHeader
        title={`${employee.name} · ${formatDayShort(datum)}`}
        subtitle={
          <Link href={returnTo} className="underline">
            Terug
          </Link>
        }
      />
      <Flash code={melding} mail={mail} />

      <Card className="mb-6 p-4">
        <SectionTitle className="mb-2">Deze dag</SectionTitle>
        {regular ? (
          <p className="text-slate-800">
            {groupName(regular.groupId)}
            {regular.role !== 'none' ? ` · ${ROLE_LABELS[regular.role]}` : ''} · {formatTimeRange(regular.start, regular.end)}
            {regular.changed ? (
              <Badge tone="warning" className="ml-2">
                gewijzigd
              </Badge>
            ) : null}
            {regular.closure ? (
              <Badge tone="closed" className="ml-2">
                Gesloten: {regular.closure.name ?? 'sluitingsdag'}
              </Badge>
            ) : null}
          </p>
        ) : (
          <p className="text-slate-800">
            Geen dienst
            {override?.kind === 'off' ? (
              <Badge tone="warning" className="ml-2">
                gewijzigd
              </Badge>
            ) : null}
          </p>
        )}
        {substitution ? (
          <p className="mt-1 text-sm text-slate-600">
            Valt in bij {groupName(substitution.groupId)} ({substitution.dayParts.map((part) => DAY_PART_LABELS[part]).join(' en ')}).
          </p>
        ) : null}
        {absences.length > 0 ? (
          <p className="mt-1 text-sm text-slate-600">
            Afwezig: {absences.map((absence) => ABSENCE_PART_LABELS[absence.dayPart]).join(', ')}
            {absences.some((absence) => absence.status === 'requested') ? ' (aangevraagd)' : ''}.
          </p>
        ) : null}
        {override ? (
          <form action={clearDayChange} className="mt-3">
            <input type="hidden" name="employeeId" value={medewerker} />
            <input type="hidden" name="date" value={datum} />
            <input type="hidden" name="terug" value={here} />
            <SubmitButton size="sm" variant="secondary">
              Terug naar de vaste dienst
            </SubmitButton>
          </form>
        ) : null}
      </Card>

      {sunday ? (
        <Notice tone="info">Op zondag zijn er geen diensten.</Notice>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {regular && !regular.closure ? (
            <section className="lg:col-span-2">
              <form action={setDayOff}>
                <input type="hidden" name="employeeId" value={medewerker} />
                <input type="hidden" name="date" value={datum} />
                <input type="hidden" name="terug" value={here} />
                <SubmitButton variant="secondary" confirm={`${employee.name} heeft op ${formatDayShort(datum)} geen dienst. Doorgaan?`}>
                  Geen dienst deze dag
                </SubmitButton>
              </form>
              <p className="mt-1 text-sm text-slate-500">
                Dit is geen afwezigheid: {employee.name} is die dag gewoon niet ingeroosterd. De vaste dienst blijft verder staan.
              </p>
            </section>
          ) : null}
          <Card className="p-4">
            <SectionTitle className="mb-3">{regular ? 'Andere dienst deze dag' : 'Dienst toevoegen'}</SectionTitle>
            <DayShiftForm defaults={defaults} groups={groups} label={regular ? 'Opslaan voor deze dag' : 'Toevoegen'} />
          </Card>
          {regular ? (
            <Card className="p-4">
              <SectionTitle className="mb-3">Verplaatsen naar een andere dag</SectionTitle>
              <MoveShiftForm defaults={defaults} groups={groups} />
            </Card>
          ) : null}
        </div>
      )}
    </>
  );
}
