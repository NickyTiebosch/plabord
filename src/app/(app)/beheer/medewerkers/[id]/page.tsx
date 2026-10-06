import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SubmitButton } from '@/components/client/form-controls';
import { Badge, Card, EmptyState, Field, Notice, PageHeader, SectionTitle, buttonClass, inputClass } from '@/components/ui';
import { deletionBlocker, deletionSummary } from '@/lib/admin/deletion';
import { isUuid } from '@/lib/admin/forms';
import { shiftsByWeekday } from '@/lib/admin/shifts';
import { requireAdminWith, type Viewer } from '@/lib/auth/session';
import { loadInvites } from '@/lib/db/admin-queries';
import { mapEmployee, mapRecurringShift } from '@/lib/db/mappers';
import { loadGroups, loadSettings, must } from '@/lib/db/queries';
import { todayInAmsterdam } from '@/lib/engine/dates';
import { formatDate, weekdayLong } from '@/lib/engine/format';
import { ROLE_LABELS } from '@/lib/engine/labels';
import { effectiveShiftTimes } from '@/lib/engine/schedule';
import { formatTimeRange } from '@/lib/engine/time';
import type { RecurringShift, Settings } from '@/lib/engine/types';
import { canBeInvited, inviteStatusText, latestInvites } from '@/lib/mail/invites';
import { revokeFeedLink } from '../../../agenda/actions';
import { Flash } from '../../admin-shared';
import { deleteShift, inviteEmployee, retryAccount } from '../actions';
import { DeleteEmployeeForm } from '../delete-form';
import { EmployeeForm } from '../employee-form';
import { ShiftEndForm, ShiftFromForm } from '../shift-forms';

export const metadata: Metadata = { title: 'Medewerker' };

const FEED_LABELS: Record<string, string> = { personal: 'Mijn rooster', location: 'Vestiging', absences: 'Verlof team' };

function ShiftText({ shift, settings, groupName }: { shift: RecurringShift; settings: Settings; groupName: string }) {
  const times = effectiveShiftTimes(shift, settings);
  const standard = shift.startTime === null && shift.endTime === null;
  return (
    <span>
      <span className="font-medium text-slate-900">{groupName}</span>
      <span className="text-slate-600">
        {' '}
        · {ROLE_LABELS[shift.role]} · {formatTimeRange(times.start, times.end)}
        {standard ? ' (standaard)' : ''}
      </span>
    </span>
  );
}

async function loadDeletionCounts(
  supabase: Viewer['supabase'],
  employeeId: string,
  today: string,
  account: boolean,
) {
  const count = async (
    table: 'recurring_shifts' | 'absences' | 'substitutions' | 'shift_overrides' | 'calendar_feeds' | 'push_subscriptions',
  ) => (await supabase.from(table).select('id', { count: 'exact', head: true }).eq('employee_id', employeeId)).count ?? 0;
  const [recurringShifts, absences, substitutions, shiftOverrides, calendarFeeds, pushDevices, upcoming] = await Promise.all([
    count('recurring_shifts'),
    count('absences'),
    count('substitutions'),
    count('shift_overrides'),
    count('calendar_feeds'),
    count('push_subscriptions'),
    supabase
      .from('substitutions')
      .select('id', { count: 'exact', head: true })
      .eq('employee_id', employeeId)
      .eq('status', 'active')
      .gte('date', today),
  ]);
  return deletionSummary({
    recurringShifts,
    absences,
    substitutions,
    upcomingSubstitutions: upcoming.count ?? 0,
    shiftOverrides,
    pushDevices,
    calendarFeeds,
    account,
  });
}

function DeleteShiftButton({ shift }: { shift: RecurringShift }) {
  return (
    <form action={deleteShift} className="inline">
      <input type="hidden" name="id" value={shift.id} />
      <input type="hidden" name="employeeId" value={shift.employeeId} />
      <SubmitButton
        size="sm"
        variant="ghost"
        confirm="Deze vaste dienst helemaal verwijderen? Doe dit alleen bij een vergissing; gebruik anders 'Dienst laten stoppen'."
      >
        Verwijderen
      </SubmitButton>
    </form>
  );
}

export default async function EmployeeDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ melding?: string; mail?: string }>;
}) {
  const [{ id }, { melding, mail }] = await Promise.all([params, searchParams]);
  if (!isUuid(id)) notFound();
  const today = todayInAmsterdam(new Date());

  const [{ supabase, employeeId: viewerId }, [groups, settings, employeeRow, account, eligibility, shifts, feeds, devices, invites]] =
    await requireAdminWith((supabase) =>
      Promise.all([
        loadGroups(supabase),
        loadSettings(supabase),
        supabase.from('employees').select('*').eq('id', id).maybeSingle(),
        supabase.from('employee_accounts').select('email, user_id').eq('employee_id', id).maybeSingle(),
        supabase.from('counter_eligibility').select('group_id').eq('employee_id', id),
        supabase.from('recurring_shifts').select('*').eq('employee_id', id),
        supabase.from('calendar_feeds').select('id, kind, group_id, created_at').eq('employee_id', id).is('revoked_at', null),
        // Fase 4: alleen het aantal toestellen met meldingen, nooit het adres.
        supabase.from('push_subscriptions').select('id', { count: 'exact', head: true }).eq('employee_id', id),
        loadInvites(supabase, id),
      ]),
    );
  const deviceCount = devices.count ?? 0;
  if (!employeeRow.data) notFound();
  const employee = mapEmployee(employeeRow.data, must(eligibility, 'de inzetbaarheid').map((row) => row.group_id));
  const groupName = (groupId: string | null) => groups.find((group) => group.id === groupId)?.name ?? groupId ?? '';
  const groupOptions = groups.map((group) => ({ id: group.id, name: group.name, hasCounter: group.hasCounter }));
  const weekdays = shiftsByWeekday(must(shifts, 'de vaste diensten').map(mapRecurringShift), today);
  const hasHistory = weekdays.some((day) => day.past.length > 0);
  // Volledig verwijderen (fase 3, V21): wat er verdwijnt, en of het nu mag.
  const blocker = deletionBlocker({ id: employee.id, isActive: employee.isActive }, viewerId);
  const counts = blocker ? null : await loadDeletionCounts(supabase, employee.id, today, Boolean(account.data));
  // De uitnodiging (V33): alleen voor wie actief is en kan inloggen.
  const invitable = canBeInvited({ id: employee.id, isActive: employee.isActive, hasAccount: Boolean(account.data?.user_id) });
  const lastInvite = latestInvites(invites).get(employee.id) ?? null;

  return (
    <>
      <PageHeader
        title={employee.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-1">
            {groupName(employee.groupId)}
            {employee.isAdmin ? <Badge tone="brand">beheerder</Badge> : null}
            {!employee.isActive ? <Badge tone="closed">inactief</Badge> : null}
          </span>
        }
        actions={
          <Link href="/beheer/medewerkers" className="text-sm underline">
            Alle medewerkers
          </Link>
        }
      />
      <Flash code={melding} mail={mail} />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Card className="p-4">
            <SectionTitle className="mb-3">Gegevens</SectionTitle>
            <EmployeeForm
              groups={groupOptions}
              defaults={{
                id: employee.id,
                name: employee.name,
                email: account.data?.email ?? null,
                groupId: employee.groupId,
                defaultRole: employee.defaultRole,
                counterGroupIds: employee.counterGroupIds,
                isAdmin: employee.isAdmin,
                isActive: employee.isActive,
              }}
            />
          </Card>

          <Card className="space-y-3 p-4">
            <SectionTitle>Inloggen</SectionTitle>
            {!account.data ? (
              <p className="text-sm text-slate-700">Geen werkmail: deze medewerker kan niet inloggen.</p>
            ) : account.data.user_id ? (
              <p className="text-sm text-slate-700">
                Kan inloggen met <strong>{account.data.email}</strong>.
                {!employee.isActive ? ' Inloggen is geblokkeerd zolang de medewerker inactief is.' : ''}
              </p>
            ) : (
              <>
                <Notice tone="warning">Er is nog geen inlogaccount voor {account.data.email}.</Notice>
                <form action={retryAccount}>
                  <input type="hidden" name="id" value={employee.id} />
                  <SubmitButton variant="secondary">Inlogaccount aanmaken</SubmitButton>
                </form>
              </>
            )}
            {account.data?.user_id ? (
              <p className="text-sm text-slate-700">
                {deviceCount === 0
                  ? 'Meldingen staan op geen enkel toestel aan.'
                  : `Meldingen aan op ${deviceCount} ${deviceCount === 1 ? 'toestel' : 'toestellen'}.`}
              </p>
            ) : null}
            {invitable ? (
              <form action={inviteEmployee} className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                <input type="hidden" name="id" value={employee.id} />
                <span className="text-sm text-slate-700">{inviteStatusText(lastInvite)}</span>
                <SubmitButton size="sm" variant={lastInvite ? 'secondary' : 'primary'}>
                  {lastInvite ? 'Opnieuw sturen' : 'Uitnodiging sturen'}
                </SubmitButton>
              </form>
            ) : null}
          </Card>

          <Card className="space-y-3 p-4">
            <SectionTitle>Gegevens downloaden en verwijderen</SectionTitle>
            <p className="text-sm text-slate-700">
              Alles wat Planbord over {employee.name} bewaart, als Excel-bestand. Bijvoorbeeld voor een inzageverzoek. Komt in
              het logboek.
            </p>
            {/* Een gewone link, zodat de browser hem niet vooraf ophaalt: elke klik is één export in het logboek. */}
            <a href={`/beheer/medewerkers/${employee.id}/gegevens`} download className={buttonClass('secondary', 'sm')}>
              Gegevens downloaden
            </a>
            {counts ? (
              <DeleteEmployeeForm id={employee.id} name={employee.name} summary={counts} />
            ) : (
              <p className="text-sm text-slate-600">
                <strong className="font-medium text-slate-800">Volledig verwijderen:</strong> {blocker}
              </p>
            )}
          </Card>

          <Card className="space-y-3 p-4">
            <SectionTitle>Agendalinks</SectionTitle>
            {(feeds.data ?? []).length === 0 ? (
              <p className="text-sm text-slate-600">Geen actieve agendalinks.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {(feeds.data ?? []).map((feed) => (
                  <li key={feed.id} className="flex items-center justify-between gap-2 py-2">
                    <span className="text-sm text-slate-800">
                      {FEED_LABELS[feed.kind] ?? feed.kind}
                      {feed.group_id ? ` ${groupName(feed.group_id)}` : ''}
                      <span className="text-slate-500"> · sinds {formatDate(todayInAmsterdam(new Date(feed.created_at)))}</span>
                    </span>
                    <form action={revokeFeedLink}>
                      <input type="hidden" name="id" value={feed.id} />
                      <SubmitButton size="sm" variant="danger" confirm="Deze agendalink intrekken?">
                        Intrekken
                      </SubmitButton>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-4">
            <SectionTitle className="mb-3">Vaste diensten</SectionTitle>
            {weekdays.every((day) => !day.current && day.upcoming.length === 0) ? (
              <EmptyState title="Geen vaste diensten">
                Zonder vaste diensten staat {employee.name} wel in het verlofoverzicht, maar niet in de roosters.
              </EmptyState>
            ) : (
              <ul className="divide-y divide-slate-100">
                {weekdays.map((day) => (
                  <li key={day.weekday} className="py-2">
                    <p className="text-sm font-semibold text-slate-500 capitalize">{weekdayLong(day.weekday)}</p>
                    {day.current ? (
                      <div className="flex flex-wrap items-center justify-between gap-1">
                        <ShiftText shift={day.current} settings={settings} groupName={groupName(day.current.groupId)} />
                        <span className="flex items-center gap-1 text-xs text-slate-500">
                          {day.current.validTo ? `t/m ${formatDate(day.current.validTo)}` : `sinds ${formatDate(day.current.validFrom)}`}
                          <DeleteShiftButton shift={day.current} />
                        </span>
                      </div>
                    ) : (
                      <p className="text-sm text-slate-400">
                        {day.upcoming.length > 0 ? 'Nu nog geen vaste dienst' : 'Vrij (geen vaste dienst)'}
                      </p>
                    )}
                    {day.upcoming.map((shift) => (
                      <div key={shift.id} className="mt-1 flex flex-wrap items-center justify-between gap-1 rounded-lg bg-amber-50 px-2 py-1">
                        <span className="text-sm">
                          <Badge tone="warning">
                            vanaf {formatDate(shift.validFrom)}
                            {shift.validTo ? ` t/m ${formatDate(shift.validTo)}` : ''}
                          </Badge>{' '}
                          <ShiftText shift={shift} settings={settings} groupName={groupName(shift.groupId)} />
                        </span>
                        <DeleteShiftButton shift={shift} />
                      </div>
                    ))}
                  </li>
                ))}
              </ul>
            )}
            {hasHistory ? (
              <details className="mt-3">
                <summary className="cursor-pointer text-sm font-medium text-slate-700">Eerdere vaste diensten</summary>
                <ul className="mt-2 space-y-1 text-sm">
                  {weekdays.flatMap((day) =>
                    day.past.map((shift) => (
                      <li key={shift.id} className="text-slate-600">
                        {weekdayLong(day.weekday)} {formatDate(shift.validFrom)} t/m {formatDate(shift.validTo ?? shift.validFrom)}:{' '}
                        <ShiftText shift={shift} settings={settings} groupName={groupName(shift.groupId)} />
                      </li>
                    )),
                  )}
                </ul>
              </details>
            ) : null}
          </Card>

          <Card className="p-4">
            <SectionTitle className="mb-3">Vaste diensten wijzigen of toevoegen</SectionTitle>
            <ShiftFromForm
              employeeId={employee.id}
              groups={groupOptions}
              defaultGroupId={employee.groupId}
              defaultRole={employee.defaultRole}
              today={today}
            />
          </Card>

          <Card className="p-4">
            <SectionTitle className="mb-3">Vaste diensten laten stoppen</SectionTitle>
            <ShiftEndForm employeeId={employee.id} today={today} />
          </Card>

          {employee.isActive ? (
            <Card className="p-4">
              <SectionTitle className="mb-1">Rooster voor één dag</SectionTitle>
              <p className="mb-3 text-sm text-slate-600">
                Geen dienst, een andere dienst of verplaatsen, alleen voor die dag. De vaste diensten blijven staan.
              </p>
              <form action={`/beheer/rooster/${employee.id}`} method="get" className="flex flex-wrap items-end gap-2">
                <Field label="Datum" htmlFor="day-change-date">
                  <input id="day-change-date" name="datum" type="date" required defaultValue={today} className={inputClass} />
                </Field>
                <button type="submit" className={buttonClass('secondary')}>
                  Bekijken
                </button>
              </form>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
