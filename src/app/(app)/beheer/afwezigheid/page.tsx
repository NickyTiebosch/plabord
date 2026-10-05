import type { Metadata } from 'next';
import Link from 'next/link';
import { SubmitButton } from '@/components/client/form-controls';
import { Badge, Card, EmptyState, PageHeader, SectionTitle, buttonClass } from '@/components/ui';
import { isUuid } from '@/lib/admin/forms';
import { requireAdminWith } from '@/lib/auth/session';
import { loadEmployeeNames } from '@/lib/db/admin-queries';
import { mapAbsence, mapEmployee } from '@/lib/db/mappers';
import { loadGroups, must } from '@/lib/db/queries';
import { addDays, todayInAmsterdam } from '@/lib/engine/dates';
import { formatDateRange } from '@/lib/engine/format';
import { ABSENCE_PART_LABELS } from '@/lib/engine/labels';
import type { Absence } from '@/lib/engine/types';
import { Flash, employeeOptions } from '../admin-shared';
import { AbsenceForm } from './absence-form';
import { approveAbsence, deleteAbsence } from './actions';

export const metadata: Metadata = { title: 'Afwezigheid' };

function AbsenceRow({ absence, name }: { absence: Absence; name: string }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
      <div className="min-w-0">
        <p className="font-medium text-slate-900">{name}</p>
        <p className="text-sm text-slate-600">
          {formatDateRange(absence.startDate, absence.endDate)}
          {absence.dayPart !== 'full_day' ? ` · ${ABSENCE_PART_LABELS[absence.dayPart]}` : ''}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {absence.status === 'requested' ? <Badge tone="requested">aangevraagd</Badge> : <Badge tone="absent">goedgekeurd</Badge>}
        {absence.status === 'requested' ? (
          <form action={approveAbsence}>
            <input type="hidden" name="id" value={absence.id} />
            <SubmitButton size="sm">Goedkeuren</SubmitButton>
          </form>
        ) : null}
        <Link href={`/beheer/afwezigheid/${absence.id}`} className={buttonClass('secondary', 'sm')}>
          Wijzigen
        </Link>
        <form action={deleteAbsence}>
          <input type="hidden" name="id" value={absence.id} />
          <SubmitButton size="sm" variant="danger" confirm={`Afwezigheid van ${name} verwijderen?`}>
            Verwijderen
          </SubmitButton>
        </form>
      </div>
    </li>
  );
}

export default async function AbsenceAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ medewerker?: string; melding?: string; mail?: string }>;
}) {
  const params = await searchParams;
  const today = todayInAmsterdam(new Date());
  const since = addDays(today, -60);
  const employeeFilter = isUuid(params.medewerker) ? params.medewerker : '';

  const [, [groups, employees, names, absences]] = await requireAdminWith((supabase) => {
    let query = supabase.from('absences').select('*').gte('end_date', since).order('start_date').order('end_date');
    if (employeeFilter) query = query.eq('employee_id', employeeFilter);
    return Promise.all([
      loadGroups(supabase),
      supabase.from('employees').select('*').then((result) => must(result, 'de medewerkers').map((row) => mapEmployee(row))),
      loadEmployeeNames(supabase),
      query.then((result) => must(result, 'de afwezigheid').map(mapAbsence)),
    ]);
  });
  const options = employeeOptions(employees, groups);
  const current = absences.filter((absence) => absence.endDate >= today);
  const recent = absences.filter((absence) => absence.endDate < today).reverse();
  const nameOf = (id: string) => names.get(id) ?? 'Onbekend';

  return (
    <>
      <PageHeader title="Afwezigheid" subtitle="Invoeren, wijzigen en goedkeuren. Geen reden of soort: alles heet “Afwezig”." />
      <Flash code={params.melding} mail={params.mail} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_1fr]">
        <Card className="h-fit p-4">
          <SectionTitle className="mb-3">Nieuwe afwezigheid</SectionTitle>
          <AbsenceForm employees={options} />
        </Card>

        <div className="space-y-6">
          <form className="flex flex-wrap items-end gap-2" method="get">
            <label className="text-sm font-medium text-slate-800" htmlFor="filter">
              Toon
            </label>
            <select id="filter" name="medewerker" defaultValue={employeeFilter} className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm">
              <option value="">Iedereen</option>
              {options.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
            <button type="submit" className={buttonClass('secondary')}>
              Filteren
            </button>
          </form>

          <section>
            <SectionTitle className="mb-2">Lopend en komend</SectionTitle>
            {current.length === 0 ? (
              <EmptyState title="Geen afwezigheid gepland" />
            ) : (
              <Card>
                <ul className="divide-y divide-slate-100">
                  {current.map((absence) => (
                    <AbsenceRow key={absence.id} absence={absence} name={nameOf(absence.employeeId)} />
                  ))}
                </ul>
              </Card>
            )}
          </section>

          <section>
            <SectionTitle className="mb-2">Afgelopen 60 dagen</SectionTitle>
            {recent.length === 0 ? (
              <EmptyState title="Niets in de afgelopen 60 dagen" />
            ) : (
              <Card>
                <ul className="divide-y divide-slate-100">
                  {recent.map((absence) => (
                    <AbsenceRow key={absence.id} absence={absence} name={nameOf(absence.employeeId)} />
                  ))}
                </ul>
              </Card>
            )}
            <p className="mt-2 text-sm text-slate-500">
              Oudere afwezigheid zie je in het <Link href="/verlof?weergave=jaar" className="underline">verlofoverzicht</Link>.
            </p>
          </section>
        </div>
      </div>
    </>
  );
}
