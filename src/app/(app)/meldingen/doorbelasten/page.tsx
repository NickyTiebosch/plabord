import type { Metadata } from 'next';
import { SubmitButton } from '@/components/client/form-controls';
import { RegistrationFlash } from '@/components/registrations';
import { Card, EmptyState, PageHeader, SectionTitle } from '@/components/ui';
import { requireViewerWith } from '@/lib/auth/session';
import { loadEmployeeNames } from '@/lib/db/admin-queries';
import { loadChargeable, loadCounterGroups, loadWorkshops } from '@/lib/db/registration-queries';
import { todayInAmsterdam } from '@/lib/engine/dates';
import { formatPlate } from '@/lib/loans/plates';
import { formatLoanMoment } from '@/lib/loans/status';
import { chargeList } from '@/lib/registrations/status';
import type { Incident } from '@/lib/registrations/types';
import { setCharged } from '../actions';

export const metadata: Metadata = { title: 'Doorbelasten' };

/** Zoveel afgehandelde regels op het scherm; de export heeft alles. */
const DONE_ON_SCREEN = 30;

/** De doorbelastlijst (V62): annuleringen die doorbelast moeten worden. Omzetten doet de teamleider of beheerder. */
export default async function ChargePage({ searchParams }: { searchParams: Promise<{ melding?: string }> }) {
  const { melding } = await searchParams;
  const today = todayInAmsterdam(new Date());
  const [viewer, [incidents, groups, workshops, names]] = await requireViewerWith((supabase) =>
    Promise.all([loadChargeable(supabase), loadCounterGroups(supabase), loadWorkshops(supabase), loadEmployeeNames(supabase)]),
  );
  const list = chargeList(incidents);
  const workshopName = (id: string) => workshops.find((workshop) => workshop.id === id)?.name ?? 'Onbekende werkplaats';
  const groupName = (id: string) => groups.find((group) => group.id === id)?.name ?? id;
  const row = (incident: Incident, done: boolean) => (
    <li key={incident.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
      <div className="min-w-0">
        <p className="font-medium text-slate-900">
          {workshopName(incident.workshopId)} <span className="font-normal text-slate-600">({groupName(incident.groupId)})</span>
        </p>
        <p className="text-sm text-slate-600">
          {formatLoanMoment(incident.occurredAt, today)}
          {incident.cancelledAt ? ` · geannuleerd om ${incident.cancelledAt}` : ''}
          {incident.plate ? ` · ${formatPlate(incident.plate)}` : ''}
          {incident.contractNumber ? ` · nr. ${incident.contractNumber}` : ''}
        </p>
        {incident.note ? <p className="text-sm text-slate-500">{incident.note}</p> : null}
        {done && incident.chargedAt ? (
          <p className="text-xs text-slate-500">
            Doorbelast {formatLoanMoment(incident.chargedAt, today)}
            {incident.chargedBy ? ` door ${names.get(incident.chargedBy) ?? 'een oud-collega'}` : ''}
          </p>
        ) : null}
      </div>
      {viewer.isLead ? (
        <form action={setCharged}>
          <input type="hidden" name="id" value={incident.id} />
          <input type="hidden" name="charged" value={done ? 'nee' : 'ja'} />
          <SubmitButton size="sm" variant={done ? 'ghost' : 'primary'}>
            {done ? 'Toch niet doorbelast' : 'Doorbelast'}
          </SubmitButton>
        </form>
      ) : null}
    </li>
  );

  return (
    <>
      <PageHeader title="Doorbelasten" subtitle="Annuleringen door de werkplaats die doorbelast moeten worden." />
      <RegistrationFlash code={melding} />
      <section className="mb-6">
        <SectionTitle className="mb-2">Nog door te belasten{list.open.length > 0 ? ` (${list.open.length})` : ''}</SectionTitle>
        {list.open.length === 0 ? (
          <EmptyState title="Alles is doorbelast." />
        ) : (
          <Card>
            <ul className="divide-y divide-slate-100">{list.open.map((incident) => row(incident, false))}</ul>
          </Card>
        )}
        {!viewer.isLead ? <p className="mt-2 text-sm text-slate-500">De teamleider of beheerder zet een regel op doorbelast.</p> : null}
      </section>
      {list.done.length > 0 ? (
        <section>
          <SectionTitle className="mb-2">Doorbelast</SectionTitle>
          <Card>
            <ul className="divide-y divide-slate-100">{list.done.slice(0, DONE_ON_SCREEN).map((incident) => row(incident, true))}</ul>
          </Card>
          {list.done.length > DONE_ON_SCREEN ? <p className="mt-2 text-sm text-slate-500">De oudere regels staan in de export.</p> : null}
        </section>
      ) : null}
    </>
  );
}
