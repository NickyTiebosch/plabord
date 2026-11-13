import type { Metadata } from 'next';
import Link from 'next/link';
import { SubmitButton } from '@/components/client/form-controls';
import { StatefulForm } from '@/components/client/stateful-form';
import { Card, PageHeader, SectionTitle } from '@/components/ui';
import { requireViewerWith } from '@/lib/auth/session';
import { loadCurrentLoans, loadLoanGroups } from '@/lib/db/loan-queries';
import { addDays, amsterdamDateTime, todayInAmsterdam } from '@/lib/engine/dates';
import { formatPlate, normalizePlate } from '@/lib/loans/plates';
import { REISSUE_DAYS, reissueOptions } from '@/lib/loans/status';
import { DESTINATION_LABELS, isDestination } from '@/lib/loans/types';
import { handOutVehicle } from '../actions';
import { HandOutFields, recentValues } from '../loan-fields';

export const metadata: Metadata = { title: 'Auto aanmelden' };

interface Params {
  kenteken?: string;
  model?: string;
  bestemming?: string;
  aan?: string;
  vestiging?: string;
}

/** Auto aanmelden (V46): Opnieuw uitgeven bovenaan, daaronder het formulier. */
export default async function NewLoanPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const now = new Date();
  const today = todayInAmsterdam(now);
  const [viewer, [groups, loans]] = await requireViewerWith((supabase) =>
    Promise.all([loadLoanGroups(supabase), loadCurrentLoans(supabase, addDays(today, -REISSUE_DAYS))]),
  );
  const isGroup = (id: string | undefined): id is string => Boolean(id && groups.some((group) => group.id === id));
  const groupId = isGroup(params.vestiging) ? params.vestiging : isGroup(viewer.groupId) ? viewer.groupId : '';
  const options = groupId ? reissueOptions(loans, groupId, today) : [];
  const recent = [...loans].sort((a, b) => (a.handedOutAt < b.handedOutAt ? 1 : -1));
  const moment = amsterdamDateTime(now);
  const defaults = {
    groupId,
    plate: params.kenteken ? (normalizePlate(params.kenteken) ?? '') : '',
    model: (params.model ?? '').slice(0, 40),
    odometerOut: '',
    date: moment.date,
    time: moment.time,
    destination: isDestination(params.bestemming) ? params.bestemming : ('' as const),
    handedTo: (params.aan ?? '').slice(0, 60),
    note: '',
  };
  // Een andere keuze bij Opnieuw uitgeven moet het formulier opnieuw vullen.
  const formKey = [defaults.groupId, defaults.plate, defaults.model, defaults.destination, defaults.handedTo].join('|');
  const reissueHref = (option: (typeof options)[number]) =>
    `/mobiliteit/nieuw?${new URLSearchParams({
      kenteken: option.plate,
      model: option.model,
      bestemming: option.destination,
      aan: option.handedTo,
      vestiging: groupId,
    })}`;

  return (
    <>
      <PageHeader
        title="Auto aanmelden"
        actions={
          <Link href="/mobiliteit" className="text-sm underline">
            Terug
          </Link>
        }
      />

      {options.length > 0 ? (
        <section className="mb-5">
          <SectionTitle className="mb-1">Opnieuw uitgeven</SectionTitle>
          <p className="mb-2 text-sm text-slate-600">Uitgeleend in de laatste {REISSUE_DAYS} dagen. Eén tik vult het formulier.</p>
          <ul className="flex flex-wrap gap-2">
            {options.map((option) => (
              <li key={option.plate}>
                <Link
                  href={reissueHref(option)}
                  scroll={false}
                  className="flex min-h-11 flex-col justify-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-left hover:border-brand-600 hover:bg-brand-50"
                >
                  <span className="font-mono text-sm font-semibold tracking-wide text-slate-900">{formatPlate(option.plate)}</span>
                  <span className="text-xs text-slate-600">
                    {option.model} · {DESTINATION_LABELS[option.destination]}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <Card className="p-4">
        <StatefulForm key={formKey} action={handOutVehicle} className="space-y-5">
          <HandOutFields
            groups={groups}
            defaults={defaults}
            models={recentValues(recent.map((loan) => loan.model))}
            recipients={recentValues(['Mobiliteit', ...recent.map((loan) => loan.handedTo)])}
          />
          <SubmitButton>Aanmelden</SubmitButton>
        </StatefulForm>
      </Card>
    </>
  );
}
