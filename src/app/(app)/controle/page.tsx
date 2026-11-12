import type { Metadata } from 'next';
import Link from 'next/link';
import { Badge, Card, EmptyState, PageHeader, SectionTitle, cx } from '@/components/ui';
import { requireLeadWith } from '@/lib/auth/session';
import { loadEmployeeNames } from '@/lib/db/admin-queries';
import { loadClosures, loadCurrentLoans, loadEndOfDay, loadLoanGroups } from '@/lib/db/loan-queries';
import { todayInAmsterdam } from '@/lib/engine/dates';
import { formatDayShort } from '@/lib/engine/format';
import { parseTime } from '@/lib/engine/time';
import { formatPlate } from '@/lib/loans/plates';
import { formatLoanMoment, isOverdue, loanDueDate, mobilityDayCheck, recentWeekdays, sortOpenLoans, type DayCheckState } from '@/lib/loans/status';
import { DESTINATION_LABELS } from '@/lib/loans/types';

export const metadata: Metadata = { title: 'Controle' };

/** Zoveel werkdagen in de controle op Mobiliteit. */
const DAYS = 10;

const CELL: Record<DayCheckState, { className: string; text: (count: number) => string; label: string }> = {
  ok: { className: 'bg-emerald-50 text-emerald-800', text: (count) => String(count), label: 'in orde' },
  short: { className: 'bg-rose-50 font-semibold text-rose-700', text: (count) => String(count), label: 'te weinig' },
  pending: { className: 'bg-amber-50 text-amber-800', text: (count) => String(count), label: 'vandaag nog open' },
  closed: { className: 'bg-slate-50 text-slate-400', text: () => 'dicht', label: 'gesloten' },
};

/**
 * Controle (fase 5, V48), voor beheerder en teamleider: wat er nu uit staat en wat te lang uit
 * staat, en per vestiging of Mobiliteit elke werkdag genoeg auto's kreeg.
 */
export default async function CheckPage() {
  const now = new Date();
  const today = todayInAmsterdam(now);
  const days = recentWeekdays(today, DAYS);
  const first = days[0] ?? today;
  const [viewer, [groups, loans, closures, endOfDay, names]] = await requireLeadWith((supabase) =>
    Promise.all([
      loadLoanGroups(supabase),
      loadCurrentLoans(supabase, first),
      loadClosures(supabase, first, today),
      loadEndOfDay(supabase),
      loadEmployeeNames(supabase),
    ]),
  );
  const end = parseTime(endOfDay) ?? '18:00';
  const groupName = (id: string) => groups.find((group) => group.id === id)?.name ?? id;
  const open = sortOpenLoans(
    loans.filter((loan) => !loan.returnedAt),
    null,
  );
  const overdue = open.filter((loan) => isOverdue(loan, now, closures, end));
  const rows = mobilityDayCheck(loans, groups, days, today, closures);

  return (
    <>
      <PageHeader title="Controle" subtitle="De uitleen: wat er uit staat, en of Mobiliteit elke werkdag genoeg auto’s kreeg." />

      <section className="mb-6">
        <SectionTitle className="mb-2">Nu uit</SectionTitle>
        <Card className="p-4">
          <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            {groups.map((group) => {
              const count = open.filter((loan) => loan.groupId === group.id).length;
              return (
                <li key={group.id}>
                  <span className="text-slate-600">{group.name}: </span>
                  <span className="font-semibold text-slate-900">{count}</span>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-sm">
            <Link href="/registraties/uitleen" className="font-medium text-brand-800 underline underline-offset-2">
              Naar de uitleen
            </Link>
          </p>
        </Card>
      </section>

      <section className="mb-6">
        <SectionTitle className="mb-1">Te lang uit</SectionTitle>
        <p className="mb-2 text-sm text-slate-600">
          Niet retour gemeld aan het eind ({end}) van de eerstvolgende werkdag na het meegeven. Voor de werkplaats is dat de maandag na het
          weekend; sluitingsdagen tellen niet mee.
        </p>
        {overdue.length === 0 ? (
          <EmptyState title="Geen auto staat te lang uit." />
        ) : (
          <Card>
            <ul className="divide-y divide-slate-100">
              {overdue.map((loan) => (
                <li key={loan.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900">
                      <span className="font-mono tracking-wide">{formatPlate(loan.plate)}</span>
                      <span className="font-normal text-slate-600"> · {loan.model}</span>
                    </p>
                    <p className="text-sm text-slate-600">
                      {groupName(loan.groupId)} · aan {loan.handedTo} · sinds {formatLoanMoment(loan.handedOutAt, today)} · door{' '}
                      {loan.handedOutBy ? (names.get(loan.handedOutBy) ?? 'oud-collega') : 'oud-collega'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <Badge tone="brand">{DESTINATION_LABELS[loan.destination]}</Badge>
                    <Badge tone="warning">terug uiterlijk {formatDayShort(loanDueDate(loan, closures))}</Badge>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>

      <section>
        <SectionTitle className="mb-1">Mobiliteit per werkdag</SectionTitle>
        <p className="mb-2 text-sm text-slate-600">
          Hoeveel auto’s elke vestiging per werkdag aan Mobiliteit meegaf. Rood: minder dan de ondergrens. Meer mag altijd.
        </p>
        {rows.length === 0 ? (
          <EmptyState title="Er is geen ondergrens ingesteld.">
            {viewer.isAdmin ? (
              <Link href="/beheer/instellingen#uitleen" className="underline">
                Stel per vestiging het aantal in bij Instellingen.
              </Link>
            ) : (
              'De beheerder stelt dat per vestiging in.'
            )}
          </EmptyState>
        ) : (
          <Card className="overflow-x-auto">
            <table className="w-full min-w-max text-sm">
              <caption className="sr-only">Auto’s aan Mobiliteit per vestiging per werkdag</caption>
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                  <th scope="col" className="sticky left-0 bg-white px-3 py-2 font-medium">
                    Vestiging
                  </th>
                  {days.map((date) => (
                    <th key={date} scope="col" className={cx('px-2 py-2 text-center font-medium', date === today && 'text-brand-800')}>
                      {formatDayShort(date)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.groupId} className="border-b border-slate-100 last:border-0">
                    <th scope="row" className="sticky left-0 bg-white px-3 py-2 text-left font-medium text-slate-900">
                      {row.groupName}
                      <span className="block text-xs font-normal text-slate-500">minstens {row.required}</span>
                    </th>
                    {row.cells.map((cell) => (
                      <td key={cell.date} className="px-1 py-1 text-center">
                        <span
                          className={cx('inline-flex min-h-9 min-w-10 items-center justify-center rounded-md px-2', CELL[cell.state].className)}
                          title={`${cell.label}: ${cell.count} van minstens ${row.required}`}
                        >
                          {CELL[cell.state].text(cell.count)}
                          <span className="sr-only"> ({CELL[cell.state].label})</span>
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
        {viewer.isAdmin && rows.length > 0 ? (
          <p className="mt-2 text-sm">
            <Link href="/beheer/instellingen#uitleen" className="text-brand-800 underline underline-offset-2">
              Ondergrens per vestiging aanpassen
            </Link>
          </p>
        ) : null}
      </section>
    </>
  );
}
