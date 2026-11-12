import type { Metadata } from 'next';
import Link from 'next/link';
import { SubmitButton } from '@/components/client/form-controls';
import { Badge, Card, EmptyState, LinkButton, PageHeader, SectionTitle } from '@/components/ui';
import { requireViewerWith } from '@/lib/auth/session';
import { loadEmployeeNames } from '@/lib/db/admin-queries';
import { loadClosures, loadCurrentLoans, loadEndOfDay, loadLoanGroups } from '@/lib/db/loan-queries';
import { addDays, todayInAmsterdam } from '@/lib/engine/dates';
import { parseTime } from '@/lib/engine/time';
import { formatPlate } from '@/lib/loans/plates';
import { formatLoanMoment, isOverdue, sortOpenLoans } from '@/lib/loans/status';
import { localMoment } from '@/lib/loans/time';
import { DESTINATION_LABELS, type VehicleLoan } from '@/lib/loans/types';
import { returnNotUsed, undoReturn } from './actions';
import { LoanFlash, type FlashParams } from './flash';

export const metadata: Metadata = { title: 'Uitleen' };

/** Zo ver terug laadt de pagina, voor Vandaag retour (en straks de controle). */
const LOOKBACK_DAYS = 21;

function PlateTitle({ loan }: { loan: VehicleLoan }) {
  return (
    <p className="font-semibold text-slate-900">
      <span className="font-mono tracking-wide">{formatPlate(loan.plate)}</span>
      <span className="font-normal text-slate-600"> · {loan.model}</span>
    </p>
  );
}

/** Registraties → Uitleen (fase 5, V45–V47): wat nu uit staat, en wat vandaag terugkwam. */
export default async function LoansPage({ searchParams }: { searchParams: Promise<FlashParams> }) {
  const params = await searchParams;
  const now = new Date();
  const today = todayInAmsterdam(now);
  const [viewer, [groups, loans, names, closures, endOfDay]] = await requireViewerWith((supabase) =>
    Promise.all([
      loadLoanGroups(supabase),
      loadCurrentLoans(supabase, addDays(today, -LOOKBACK_DAYS)),
      loadEmployeeNames(supabase),
      loadClosures(supabase, addDays(today, -LOOKBACK_DAYS), today),
      loadEndOfDay(supabase),
    ]),
  );
  const groupName = (id: string) => groups.find((group) => group.id === id)?.name ?? id;
  const personName = (id: string | null) => (id ? (names.get(id) ?? 'oud-collega') : 'oud-collega');
  const ownGroup = groups.some((group) => group.id === viewer.groupId) ? viewer.groupId : null;
  const open = sortOpenLoans(
    loans.filter((loan) => !loan.returnedAt),
    ownGroup,
  );
  const returnedToday = loans
    .filter((loan) => loan.returnedAt && localMoment(loan.returnedAt).date === today)
    .sort((a, b) => ((a.returnedAt ?? '') < (b.returnedAt ?? '') ? 1 : -1));
  const end = parseTime(endOfDay) ?? '18:00';

  return (
    <>
      <PageHeader
        title="Uitleen"
        subtitle="Auto’s voor Mobiliteit, en voor de werkplaats in het weekend."
        actions={
          <LinkButton href="/registraties/uitleen/nieuw" variant="primary">
            Auto aanmelden
          </LinkButton>
        }
      />
      <LoanFlash params={params} />

      <section className="mb-6" aria-labelledby="nu-uit">
        <SectionTitle className="mb-2">
          <span id="nu-uit">Nu uitgeleend{open.length > 0 ? ` (${open.length})` : ''}</span>
        </SectionTitle>
        {open.length === 0 ? (
          <EmptyState title="Er staat nu geen auto uit." />
        ) : (
          <Card>
            <ul className="divide-y divide-slate-100">
              {open.map((loan) => {
                const overdue = isOverdue(loan, now, closures, end);
                return (
                  <li key={loan.id} className={overdue ? 'bg-amber-50/60 px-4 py-3' : 'px-4 py-3'}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <PlateTitle loan={loan} />
                        <p className="text-sm text-slate-600">
                          Aan {loan.handedTo} · sinds {formatLoanMoment(loan.handedOutAt, today)} · door {personName(loan.handedOutBy)}
                        </p>
                        {loan.note ? <p className="text-sm text-slate-500">{loan.note}</p> : null}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        <Badge tone="brand">{DESTINATION_LABELS[loan.destination]}</Badge>
                        {loan.groupId !== ownGroup ? <Badge>{groupName(loan.groupId)}</Badge> : null}
                        {overdue ? <Badge tone="warning">te lang uit</Badge> : null}
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <LinkButton href={`/registraties/uitleen/${loan.id}/retour`} variant="primary" size="sm">
                        Retour · ingezet
                      </LinkButton>
                      <form action={returnNotUsed}>
                        <input type="hidden" name="id" value={loan.id} />
                        <input type="hidden" name="kenteken" value={loan.plate} />
                        <SubmitButton size="sm" variant="secondary">
                          Retour · niet ingezet
                        </SubmitButton>
                      </form>
                      {viewer.isLead ? (
                        <LinkButton href={`/registraties/uitleen/${loan.id}`} variant="ghost" size="sm">
                          Corrigeren
                        </LinkButton>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        )}
      </section>

      <section className="mb-6" aria-labelledby="vandaag-retour">
        <SectionTitle className="mb-2">
          <span id="vandaag-retour">Vandaag retour</span>
        </SectionTitle>
        {returnedToday.length === 0 ? (
          <EmptyState title="Vandaag is er nog niets retour gemeld." />
        ) : (
          <Card>
            <ul className="divide-y divide-slate-100">
              {returnedToday.map((loan) => (
                <li key={loan.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                  <div className="min-w-0">
                    <PlateTitle loan={loan} />
                    <p className="text-sm text-slate-600">
                      Retour {localMoment(loan.returnedAt ?? loan.handedOutAt).time} · door {personName(loan.returnedBy)}
                      {loan.returnNote ? ` · ${loan.returnNote}` : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {loan.wasUsed ? <Badge tone="success">ingezet</Badge> : <Badge>niet ingezet</Badge>}
                    {loan.returnedBy === viewer.employeeId || viewer.isLead ? (
                      <form action={undoReturn}>
                        <input type="hidden" name="id" value={loan.id} />
                        <input type="hidden" name="kenteken" value={loan.plate} />
                        <SubmitButton size="sm" variant="ghost">
                          Ongedaan maken
                        </SubmitButton>
                      </form>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>

      <p className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
        <Link href="/registraties/uitleen/archief" className="font-medium text-brand-800 underline underline-offset-2">
          Archief
        </Link>
        {viewer.isLead ? (
          <Link href="/controle" className="font-medium text-brand-800 underline underline-offset-2">
            Controle
          </Link>
        ) : null}
      </p>
    </>
  );
}
