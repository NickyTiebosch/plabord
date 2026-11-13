import type { Metadata } from 'next';
import Link from 'next/link';
import { SubmitButton } from '@/components/client/form-controls';
import { StatefulForm } from '@/components/client/stateful-form';
import { Card, EmptyState, PageHeader } from '@/components/ui';
import { requireViewerWith } from '@/lib/auth/session';
import { loadCounterGroups, loadRegistrationSettings, loadWorkshops } from '@/lib/db/registration-queries';
import { amsterdamDateTime } from '@/lib/engine/dates';
import { pickGroup } from '@/lib/registrations/status';
import { createIncident } from '../actions';
import { IncidentFields } from '../incident-fields';

export const metadata: Metadata = { title: 'Nieuwe melding' };

export default async function NewIncidentPage({ searchParams }: { searchParams: Promise<{ vestiging?: string }> }) {
  const { vestiging } = await searchParams;
  const [viewer, [groups, workshops, settings]] = await requireViewerWith((supabase) =>
    Promise.all([loadCounterGroups(supabase), loadWorkshops(supabase), loadRegistrationSettings(supabase)]),
  );
  const group = pickGroup(groups, vestiging, viewer.groupId);
  const active = workshops.filter((workshop) => workshop.isActive);
  if (!group || active.length === 0) {
    return <EmptyState title="Er zijn nog geen werkplaatsen.">De beheerder voegt ze toe onder Beheer → Instellingen.</EmptyState>;
  }
  const now = amsterdamDateTime(new Date());
  return (
    <>
      <PageHeader
        title="Nieuwe melding"
        actions={
          <Link href={`/meldingen?vestiging=${group.id}`} className="text-sm underline">
            Terug
          </Link>
        }
      />
      <Card className="p-4">
        <StatefulForm action={createIncident} className="space-y-5">
          <IncidentFields
            groups={groups}
            workshops={active}
            ownGroupId={group.id}
            chargeFrom={settings.chargeFrom}
            defaults={{ workshopId: '', kind: '', missing: '', cancelledAt: '', charge: '', plate: '', contractNumber: '', note: '', date: now.date, time: now.time }}
          />
          <SubmitButton>Melding opslaan</SubmitButton>
        </StatefulForm>
      </Card>
    </>
  );
}
