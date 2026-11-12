import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { SubmitButton } from '@/components/client/form-controls';
import { StatefulForm } from '@/components/client/stateful-form';
import { Card, Field, PageHeader, inputClass } from '@/components/ui';
import { isUuid } from '@/lib/admin/forms';
import { requireViewerWith } from '@/lib/auth/session';
import { loadLoan } from '@/lib/db/loan-queries';
import { amsterdamDateTime, todayInAmsterdam } from '@/lib/engine/dates';
import { formatPlate } from '@/lib/loans/plates';
import { formatLoanMoment, formatOdometer } from '@/lib/loans/status';
import { DESTINATION_LABELS } from '@/lib/loans/types';
import { returnUsed } from '../../actions';

export const metadata: Metadata = { title: 'Retour melden' };

/** Retour · ingezet (V47): kilometerstand, tijdstip (staat op nu) en een opmerking. */
export default async function ReturnPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const [, loan] = await requireViewerWith((supabase) => loadLoan(supabase, id));
  if (!loan) notFound();
  if (loan.returnedAt) redirect(`/registraties/uitleen?melding=al-retour&kenteken=${loan.plate}`);
  const now = new Date();
  const moment = amsterdamDateTime(now);

  return (
    <>
      <PageHeader
        title="Retour · ingezet"
        subtitle={
          <>
            <span className="font-mono font-semibold tracking-wide text-slate-900">{formatPlate(loan.plate)}</span> · {loan.model} ·{' '}
            {DESTINATION_LABELS[loan.destination]} · aan {loan.handedTo} · sinds {formatLoanMoment(loan.handedOutAt, todayInAmsterdam(now))}
          </>
        }
        actions={
          <Link href="/registraties/uitleen" className="text-sm underline">
            Terug
          </Link>
        }
      />
      <Card className="p-4">
        <StatefulForm action={returnUsed} className="space-y-4">
          <input type="hidden" name="id" value={loan.id} />
          <Field
            label="Kilometerstand"
            htmlFor="odometerIn"
            hint={loan.odometerOut !== null ? `Bij het meegeven: ${formatOdometer(loan.odometerOut)}. Mag leeg blijven.` : 'Mag leeg blijven.'}
          >
            <input
              id="odometerIn"
              name="odometerIn"
              inputMode="numeric"
              autoComplete="off"
              maxLength={9}
              className={inputClass}
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Datum" htmlFor="date">
              <input id="date" name="date" type="date" defaultValue={moment.date} required className={inputClass} />
            </Field>
            <Field label="Tijd" htmlFor="time">
              <input id="time" name="time" type="time" defaultValue={moment.time} required className={inputClass} />
            </Field>
          </div>
          <Field label="Reden of opmerking" htmlFor="note" hint="Kort, bijvoorbeeld Pech onderweg of Binnenvaller. Klantgegevens zijn niet nodig.">
            <input id="note" name="note" maxLength={200} autoComplete="off" className={inputClass} />
          </Field>
          <SubmitButton>Retour melden</SubmitButton>
          <p className="text-sm text-slate-600">
            Niet ingezet? Tik dan op{' '}
            <Link href="/registraties/uitleen" className="underline">
              Retour · niet ingezet
            </Link>{' '}
            in de lijst.
          </p>
        </StatefulForm>
      </Card>
    </>
  );
}
