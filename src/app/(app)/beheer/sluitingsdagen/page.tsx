import type { Metadata } from 'next';
import Link from 'next/link';
import { SubmitButton } from '@/components/client/form-controls';
import { StatefulForm } from '@/components/client/stateful-form';
import { IconChevronLeft, IconChevronRight } from '@/components/icons';
import { Badge, Card, Choice, EmptyState, Field, PageHeader, SectionTitle, buttonClass, inputClass } from '@/components/ui';
import { closureScope, holidaySummary } from '@/lib/admin/closures';
import { requireAdmin } from '@/lib/auth/session';
import { mapClosure } from '@/lib/db/mappers';
import { loadGroups, must } from '@/lib/db/queries';
import { closureOverviewForYear } from '@/lib/engine/closures';
import { todayInAmsterdam, yearOf } from '@/lib/engine/dates';
import { formatDayShort } from '@/lib/engine/format';
import { addClosure, deleteClosure, saveHoliday } from './actions';

export const metadata: Metadata = { title: 'Sluitingsdagen' };

export default async function ClosureDaysPage({ searchParams }: { searchParams: Promise<{ jaar?: string }> }) {
  const params = await searchParams;
  const { supabase } = await requireAdmin();
  const currentYear = yearOf(todayInAmsterdam(new Date()));
  const requested = Number(params.jaar);
  const year = Number.isInteger(requested) && requested >= 2000 && requested <= 2100 ? requested : currentYear;

  const [groups, overrides] = await Promise.all([
    loadGroups(supabase),
    supabase
      .from('closure_days')
      .select('*')
      .gte('date', `${year}-01-01`)
      .lte('date', `${year}-12-31`)
      .order('date')
      .then((result) => must(result, 'de sluitingsdagen').map(mapClosure)),
  ]);
  const overview = closureOverviewForYear(year, groups, overrides);
  const names = new Map(groups.map((group) => [group.id, group.name]));

  return (
    <>
      <PageHeader
        title="Sluitingsdagen"
        subtitle="De feestdagen worden elk jaar berekend en gelden voor alle groepen. Per groep kun je afwijken. Oudjaarsdag is een gewone werkdag."
      />
      <div className="mb-4 flex items-center gap-2">
        <Link href={`/beheer/sluitingsdagen?jaar=${year - 1}`} className={buttonClass('secondary')} aria-label="Vorig jaar">
          <IconChevronLeft />
        </Link>
        <Link href={`/beheer/sluitingsdagen?jaar=${year + 1}`} className={buttonClass('secondary')} aria-label="Volgend jaar">
          <IconChevronRight />
        </Link>
        <h2 className="ml-1 text-lg font-semibold text-slate-900">{year}</h2>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <SectionTitle className="mb-2">Feestdagen</SectionTitle>
          <Card>
            <ul className="divide-y divide-slate-100">
              {overview.holidays.map((holiday) => {
                const summary = holidaySummary(holiday.closedByGroup, names);
                return (
                  <li key={holiday.date} className="px-4 py-3">
                    <details>
                      <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2">
                        <span>
                          <span className="font-medium text-slate-900">{holiday.name}</span>
                          <span className="text-sm text-slate-500"> · {formatDayShort(holiday.date)}</span>
                        </span>
                        <Badge tone={summary === 'Dicht voor iedereen' ? 'closed' : 'warning'}>{summary}</Badge>
                      </summary>
                      <StatefulForm action={saveHoliday} className="mt-3 space-y-3">
                        <input type="hidden" name="date" value={holiday.date} />
                        <p className="text-sm text-slate-600">Aangevinkt = dicht.</p>
                        <div className="flex flex-wrap gap-2">
                          {groups.map((group) => (
                            <Choice
                              key={group.id}
                              type="checkbox"
                              name="closed"
                              value={group.id}
                              label={group.name}
                              defaultChecked={holiday.closedByGroup[group.id]}
                            />
                          ))}
                        </div>
                        <SubmitButton size="sm">Opslaan</SubmitButton>
                      </StatefulForm>
                    </details>
                  </li>
                );
              })}
            </ul>
          </Card>
        </section>

        <section className="space-y-3">
          <SectionTitle>Extra sluitingsdagen</SectionTitle>
          {overview.extraClosures.length === 0 ? (
            <EmptyState title={`Geen extra sluitingsdagen in ${year}`} />
          ) : (
            <Card>
              <ul className="divide-y divide-slate-100">
                {overview.extraClosures.map((closure) => (
                  <li key={closure.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                    <span>
                      <span className="font-medium text-slate-900">{formatDayShort(closure.date)}</span>
                      <span className="text-sm text-slate-600">
                        {' '}
                        · {closureScope(closure, names)}
                        {closure.label ? ` · ${closure.label}` : ''}
                      </span>
                    </span>
                    <form action={deleteClosure}>
                      <input type="hidden" name="id" value={closure.id} />
                      <SubmitButton size="sm" variant="danger" confirm="Deze sluitingsdag verwijderen?">
                        Verwijderen
                      </SubmitButton>
                    </form>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          <Card className="p-4">
            <SectionTitle className="mb-3">Sluitingsdag toevoegen</SectionTitle>
            <StatefulForm action={addClosure} className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Datum" htmlFor="closure-date">
                  <input id="closure-date" name="date" type="date" required min={`${year}-01-01`} max={`${year}-12-31`} className={inputClass} />
                </Field>
                <Field label="Voor" htmlFor="closure-group">
                  <select id="closure-group" name="groupId" defaultValue="all" className={inputClass}>
                    <option value="all">Alle groepen</option>
                    {groups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field label="Omschrijving (optioneel)" htmlFor="closure-label" hint="Bijvoorbeeld: Bedrijfsuitje. Geen persoonsgegevens.">
                <input id="closure-label" name="label" maxLength={60} className={inputClass} />
              </Field>
              <SubmitButton>Toevoegen</SubmitButton>
            </StatefulForm>
          </Card>
        </section>
      </div>
    </>
  );
}
