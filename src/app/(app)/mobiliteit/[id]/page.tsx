import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SubmitButton } from '@/components/client/form-controls';
import { StatefulForm } from '@/components/client/stateful-form';
import { Card, Choice, Field, Fieldset, PageHeader, SectionTitle, inputClass } from '@/components/ui';
import { isUuid } from '@/lib/admin/forms';
import { requireLeadWith } from '@/lib/auth/session';
import { loadEmployeeNames } from '@/lib/db/admin-queries';
import { loadCurrentLoans, loadLoan, loadLoanGroups } from '@/lib/db/loan-queries';
import { addDays, todayInAmsterdam } from '@/lib/engine/dates';
import { formatPlate } from '@/lib/loans/plates';
import { formatLoanMoment } from '@/lib/loans/status';
import { localMoment } from '@/lib/loans/time';
import { correctLoan, deleteLoan } from '../actions';
import { HandOutFields, recentValues } from '../loan-fields';

export const metadata: Metadata = { title: 'Registratie corrigeren' };

/** Corrigeren (teamleider of beheerder, V47): alles van de registratie, en verwijderen. */
export default async function CorrectLoanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const today = todayInAmsterdam(new Date());
  const [, [loan, groups, recent, names]] = await requireLeadWith((supabase) =>
    Promise.all([
      loadLoan(supabase, id),
      loadLoanGroups(supabase),
      loadCurrentLoans(supabase, addDays(today, -30)),
      loadEmployeeNames(supabase),
    ]),
  );
  if (!loan) notFound();
  const out = localMoment(loan.handedOutAt);
  const back = loan.returnedAt ? '/mobiliteit/archief' : '/mobiliteit';
  const personName = (personId: string | null) => (personId ? (names.get(personId) ?? 'oud-collega') : 'oud-collega');
  const sorted = [...recent].sort((a, b) => (a.handedOutAt < b.handedOutAt ? 1 : -1));
  const returned = loan.returnedAt ? localMoment(loan.returnedAt) : null;

  return (
    <>
      <PageHeader
        title="Registratie corrigeren"
        subtitle={
          <>
            <span className="font-mono font-semibold tracking-wide text-slate-900">{formatPlate(loan.plate)}</span> · meegegeven door{' '}
            {personName(loan.handedOutBy)}, {formatLoanMoment(loan.handedOutAt, today)}
            {loan.returnedAt ? ` · retour gemeld door ${personName(loan.returnedBy)}, ${formatLoanMoment(loan.returnedAt, today)}` : ''}
          </>
        }
        actions={
          <Link href={back} className="text-sm underline">
            Terug
          </Link>
        }
      />
      <Card className="p-4">
        <StatefulForm action={correctLoan} className="space-y-5">
          <input type="hidden" name="id" value={loan.id} />
          <HandOutFields
            groups={groups}
            defaults={{
              groupId: loan.groupId,
              plate: loan.plate,
              model: loan.model,
              odometerOut: loan.odometerOut === null ? '' : String(loan.odometerOut),
              date: out.date,
              time: out.time,
              destination: loan.destination,
              handedTo: loan.handedTo,
              note: loan.note ?? '',
            }}
            models={recentValues(sorted.map((item) => item.model))}
            recipients={recentValues(sorted.map((item) => item.handedTo))}
          />
          {returned ? (
            <div className="space-y-4 border-t border-slate-100 pt-4">
              <SectionTitle>Retour</SectionTitle>
              <Fieldset legend="Ingezet?">
                <div className="grid grid-cols-2 gap-2">
                  <Choice type="radio" name="wasUsed" value="ja" label="Ja, ingezet" defaultChecked={loan.wasUsed === true} />
                  <Choice type="radio" name="wasUsed" value="nee" label="Nee, niet ingezet" defaultChecked={loan.wasUsed === false} />
                </div>
              </Fieldset>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Datum retour" htmlFor="returnDate">
                  <input id="returnDate" name="returnDate" type="date" defaultValue={returned.date} required className={inputClass} />
                </Field>
                <Field label="Tijd retour" htmlFor="returnTime">
                  <input id="returnTime" name="returnTime" type="time" defaultValue={returned.time} required className={inputClass} />
                </Field>
              </div>
              <Field label="Kilometerstand bij retour" htmlFor="odometerIn" hint="Mag leeg blijven.">
                <input
                  id="odometerIn"
                  name="odometerIn"
                  defaultValue={loan.odometerIn === null ? '' : String(loan.odometerIn)}
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={9}
                  className={inputClass}
                />
              </Field>
              <Field label="Opmerking bij retour" htmlFor="returnNote" hint="Klantgegevens zijn niet nodig.">
                <input id="returnNote" name="returnNote" defaultValue={loan.returnNote ?? ''} maxLength={200} className={inputClass} />
              </Field>
            </div>
          ) : null}
          <SubmitButton>Opslaan</SubmitButton>
          <p className="text-xs text-slate-500">Elke wijziging komt in het logboek, zonder de vrije tekst.</p>
        </StatefulForm>
      </Card>

      <Card className="mt-4 space-y-2 p-4">
        <SectionTitle>Verwijderen</SectionTitle>
        <p className="text-sm text-slate-700">Bijvoorbeeld een dubbele of verkeerde registratie. Dit kan niet ongedaan worden gemaakt.</p>
        <form action={deleteLoan}>
          <input type="hidden" name="id" value={loan.id} />
          <SubmitButton variant="danger" confirm={`Registratie van ${formatPlate(loan.plate)} verwijderen?`}>
            Verwijderen
          </SubmitButton>
        </form>
      </Card>
    </>
  );
}
