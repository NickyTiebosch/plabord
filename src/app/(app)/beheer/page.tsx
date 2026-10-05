import type { Metadata } from 'next';
import Link from 'next/link';
import { SubmitButton } from '@/components/client/form-controls';
import { Badge, Card, EmptyState, LinkButton, PageHeader, SectionTitle } from '@/components/ui';
import { requireAdminWith } from '@/lib/auth/session';
import { loadEmployeesWithAccounts, loadPlanningOverview } from '@/lib/db/admin-queries';
import { mapAbsence } from '@/lib/db/mappers';
import { must } from '@/lib/db/queries';
import { addDays, isoWeekOf, startOfIsoWeek, todayInAmsterdam } from '@/lib/engine/dates';
import { formatDateRange } from '@/lib/engine/format';
import { ABSENCE_PART_LABELS } from '@/lib/engine/labels';
import { listAbsencesInRange } from '@/lib/engine/leave-overview';
import { Flash } from './admin-shared';
import { approveAbsence } from './afwezigheid/actions';
import { applyWarnings, markHandled } from './regelen/actions';
import { GapCard } from './regelen/gap-card';

export const metadata: Metadata = { title: 'Beheer' };

/** Zoveel gaten op het overzicht; de rest staat op /beheer/regelen. */
const GAPS_ON_OVERVIEW = 5;

export default async function AdminOverviewPage({ searchParams }: { searchParams: Promise<{ melding?: string; mail?: string }> }) {
  const { melding, mail } = await searchParams;
  const today = todayInAmsterdam(new Date());
  const monday = startOfIsoWeek(today);
  const saturday = addDays(monday, 5);

  const [, [planning, employees, requested, thisWeek]] = await requireAdminWith((supabase) =>
    Promise.all([
      loadPlanningOverview(supabase, today),
      loadEmployeesWithAccounts(supabase),
      supabase
        .from('absences')
        .select('*')
        .eq('status', 'requested')
        .order('start_date')
        .then((result) => must(result, 'de aanvragen').map(mapAbsence)),
      supabase
        .from('absences')
        .select('*')
        .lte('start_date', saturday)
        .gte('end_date', monday)
        .then((result) => must(result, 'de afwezigheid').map(mapAbsence)),
    ]),
  );
  const names = new Map(employees.map((employee) => [employee.id, employee.name]));
  const absentThisWeek = listAbsencesInRange(employees, thisWeek, monday, saturday);
  const withoutEmail = employees.filter((employee) => employee.isActive && !employee.email).length;
  const withoutAccount = employees.filter((employee) => employee.isActive && employee.email && !employee.hasAccount).length;

  return (
    <>
      <PageHeader
        title="Beheer"
        actions={
          <>
            <LinkButton href="/beheer/afwezigheid" variant="primary">
              Afwezigheid invoeren
            </LinkButton>
            <LinkButton href="/beheer/medewerkers/nieuw">Medewerker toevoegen</LinkButton>
          </>
        }
      />

      <Flash code={melding} mail={mail} />

      <section className="mb-6">
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <SectionTitle>Nog te regelen</SectionTitle>
          <p className="text-sm text-slate-500">
            {formatDateRange(planning.window.from, planning.window.to)}
            {planning.ignored.length > 0 ? (
              <>
                {' · '}
                <Link href="/beheer/regelen/genegeerd" className="underline">
                  {planning.ignored.length} genegeerd
                </Link>
              </>
            ) : null}
          </p>
        </div>
        {planning.gaps.length === 0 ? (
          <EmptyState title="Niets te regelen">Alle vestigingen zitten op de norm.</EmptyState>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {planning.gaps.slice(0, GAPS_ON_OVERVIEW).map((gap) => (
              <GapCard key={gap.key} gap={gap} returnTo="/beheer" />
            ))}
          </div>
        )}
        {planning.gaps.length > GAPS_ON_OVERVIEW ? (
          <p className="mt-3">
            <LinkButton href="/beheer/regelen">Alle {planning.gaps.length} gaten</LinkButton>
          </p>
        ) : null}
      </section>

      {planning.attention.length + planning.warnings.length > 0 ? (
        <section className="mb-6">
          <SectionTitle className="mb-2">Let op</SectionTitle>
          <Card>
            <ul className="divide-y divide-slate-100">
              {planning.attention.map((item) => (
                <li key={item.substitutionId} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                  <p className="min-w-0 flex-1 text-sm text-slate-800">{item.text}</p>
                  <form action={markHandled}>
                    <input type="hidden" name="id" value={item.substitutionId} />
                    <SubmitButton size="sm" variant="secondary">
                      Afgehandeld
                    </SubmitButton>
                  </form>
                </li>
              ))}
              {planning.warnings.map((text) => (
                <li key={text} className="px-4 py-3 text-sm text-slate-800">
                  {text}
                </li>
              ))}
            </ul>
            {planning.warnings.length > 0 ? (
              <form action={applyWarnings} className="border-t border-slate-100 px-4 py-3">
                <SubmitButton size="sm">Invallen bijwerken</SubmitButton>
              </form>
            ) : null}
          </Card>
        </section>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <SectionTitle className="mb-2">Openstaande aanvragen</SectionTitle>
          {requested.length === 0 ? (
            <EmptyState title="Geen openstaande aanvragen" />
          ) : (
            <Card>
              <ul className="divide-y divide-slate-100">
                {requested.map((absence) => (
                  <li key={absence.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                    <div>
                      <p className="font-medium text-slate-900">{names.get(absence.employeeId) ?? 'Onbekend'}</p>
                      <p className="text-sm text-slate-600">
                        {formatDateRange(absence.startDate, absence.endDate)}
                        {absence.dayPart !== 'full_day' ? ` · ${ABSENCE_PART_LABELS[absence.dayPart]}` : ''}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <form action={approveAbsence}>
                        <input type="hidden" name="id" value={absence.id} />
                        <SubmitButton size="sm">Goedkeuren</SubmitButton>
                      </form>
                      <LinkButton href={`/beheer/afwezigheid/${absence.id}`} size="sm">
                        Wijzigen
                      </LinkButton>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </section>

        <section>
          <SectionTitle className="mb-2">Deze week afwezig (week {isoWeekOf(today).week})</SectionTitle>
          {absentThisWeek.length === 0 ? (
            <EmptyState title="Niemand afwezig deze week" />
          ) : (
            <Card>
              <ul className="divide-y divide-slate-100">
                {absentThisWeek.map(({ absence, employeeName }) => (
                  <li key={absence.id} className="flex items-center justify-between gap-2 px-4 py-3">
                    <span className="font-medium text-slate-900">{employeeName}</span>
                    <span className="flex items-center gap-2 text-sm text-slate-600">
                      {formatDateRange(absence.startDate, absence.endDate)}
                      {absence.dayPart !== 'full_day' ? ` · ${ABSENCE_PART_LABELS[absence.dayPart]}` : ''}
                      {absence.status === 'requested' ? <Badge tone="requested">aangevraagd</Badge> : null}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </section>
      </div>

      {withoutEmail + withoutAccount > 0 ? (
        <p className="mt-6 text-sm text-slate-600">
          {withoutEmail > 0 ? `${withoutEmail} actieve medewerker(s) zonder e-mailadres. ` : ''}
          {withoutAccount > 0 ? `${withoutAccount} met e-mailadres maar nog zonder inlogaccount. ` : ''}
          <Link href="/beheer/medewerkers" className="underline">
            Naar medewerkers
          </Link>
        </p>
      ) : null}
    </>
  );
}
