import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { SubmitButton } from '@/components/client/form-controls';
import { StatefulForm } from '@/components/client/stateful-form';
import { Card, PageHeader } from '@/components/ui';
import { isUuid } from '@/lib/admin/forms';
import { requireViewerWith } from '@/lib/auth/session';
import { loadCounterGroups, loadIncident, loadRegistrationSettings, loadWorkshops } from '@/lib/db/registration-queries';
import { todayInAmsterdam } from '@/lib/engine/dates';
import { localMoment } from '@/lib/loans/time';
import { canEditOwn } from '@/lib/registrations/status';
import { deleteIncident, updateIncident } from '../actions';
import { IncidentFields } from '../incident-fields';

export const metadata: Metadata = { title: 'Melding wijzigen' };

/** Een melding wijzigen of verwijderen (V59): de maker op dezelfde dag, anders beheerder of teamleider. */
export default async function EditIncidentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const [viewer, [incident, groups, workshops, settings]] = await requireViewerWith((supabase) =>
    Promise.all([loadIncident(supabase, id), loadCounterGroups(supabase), loadWorkshops(supabase), loadRegistrationSettings(supabase)]),
  );
  if (!incident) redirect('/meldingen?melding=niet-gevonden');
  const today = todayInAmsterdam(new Date());
  if (!canEditOwn({ ownerId: incident.reportedBy, createdAt: incident.createdAt }, viewer, today)) redirect('/meldingen?melding=geen-rechten');
  const moment = localMoment(incident.occurredAt);
  return (
    <>
      <PageHeader
        title="Melding wijzigen"
        actions={
          <Link href={`/meldingen?vestiging=${incident.groupId}`} className="text-sm underline">
            Terug
          </Link>
        }
      />
      <Card className="p-4">
        <StatefulForm action={updateIncident} className="space-y-5">
          <input type="hidden" name="id" value={incident.id} />
          <IncidentFields
            groups={groups}
            workshops={workshops.filter((workshop) => workshop.isActive || workshop.id === incident.workshopId)}
            ownGroupId={incident.groupId}
            chargeFrom={settings.chargeFrom}
            defaults={{
              workshopId: incident.workshopId,
              kind: incident.kind,
              missing: incident.missing ?? '',
              cancelledAt: incident.cancelledAt ?? '',
              charge: incident.charge === true ? 'ja' : incident.charge === false ? 'nee' : '',
              plate: incident.plate ?? '',
              contractNumber: incident.contractNumber ?? '',
              note: incident.note ?? '',
              date: moment.date,
              time: moment.time,
            }}
          />
          <SubmitButton>Opslaan</SubmitButton>
        </StatefulForm>
      </Card>
      <form action={deleteIncident} className="mt-6">
        <input type="hidden" name="id" value={incident.id} />
        <SubmitButton variant="danger" confirm="Deze melding verwijderen? Dat staat in het logboek.">
          Melding verwijderen
        </SubmitButton>
      </form>
    </>
  );
}
