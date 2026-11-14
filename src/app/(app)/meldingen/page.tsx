import type { Metadata } from 'next';
import { DayCloseCard, GroupSwitch, RegistrationFlash } from '@/components/registrations';
import { Card, EmptyState, LinkButton, PageHeader, SectionTitle } from '@/components/ui';
import { requireViewerWith } from '@/lib/auth/session';
import { loadEmployeeNames } from '@/lib/db/admin-queries';
import { loadCounterGroups, loadDayClosures, loadIncidents, loadWorkshops } from '@/lib/db/registration-queries';
import { addDays, todayInAmsterdam } from '@/lib/engine/dates';
import { canEditOwn, incidentDate, pickGroup } from '@/lib/registrations/status';
import { IncidentRow } from './incident-row';

export const metadata: Metadata = { title: 'Meldingen' };

/**
 * Meldingen (fase 6, V58): wat er vandaag en de afgelopen week bij een vestiging is gemeld, met de
 * knop voor een nieuwe melding en het afsluiten van de dag.
 */
export default async function IncidentsPage({ searchParams }: { searchParams: Promise<{ vestiging?: string; melding?: string }> }) {
  const params = await searchParams;
  const today = todayInAmsterdam(new Date());
  const weekAgo = addDays(today, -7);
  const [viewer, [groups, workshops, names, recent, closures]] = await requireViewerWith((supabase) =>
    Promise.all([
      loadCounterGroups(supabase),
      loadWorkshops(supabase),
      loadEmployeeNames(supabase),
      loadIncidents(supabase, { from: weekAgo, to: today }),
      loadDayClosures(supabase, today, today),
    ]),
  );
  const group = pickGroup(groups, params.vestiging, viewer.groupId);
  if (!group) return <EmptyState title="Er is geen vestiging met een balie." />;
  const own = recent.incidents.filter((incident) => incident.groupId === group.id);
  const todays = own.filter((incident) => incidentDate(incident) === today);
  const earlier = own.filter((incident) => incidentDate(incident) !== today);
  const workshopName = (id: string) => workshops.find((workshop) => workshop.id === id)?.name ?? 'Onbekende werkplaats';
  const person = (id: string | null) => (id ? (names.get(id) ?? 'een oud-collega') : 'onbekend');
  const closure = closures.find((item) => item.groupId === group.id) ?? null;
  const back = `/meldingen?vestiging=${group.id}`;
  const list = (items: typeof own) => (
    <Card>
      <ul className="divide-y divide-slate-100">
        {items.map((incident) => (
          <IncidentRow
            key={incident.id}
            incident={incident}
            workshopName={workshopName(incident.workshopId)}
            reporterName={person(incident.reportedBy)}
            today={today}
            editable={canEditOwn({ ownerId: incident.reportedBy, createdAt: incident.createdAt }, viewer, today)}
          />
        ))}
      </ul>
    </Card>
  );

  return (
    <>
      <PageHeader
        title="Meldingen"
        subtitle={`${group.name} · wat er misging bij een werkplaats`}
        actions={
          <LinkButton href={`/meldingen/nieuw?vestiging=${group.id}`} variant="primary">
            Nieuwe melding
          </LinkButton>
        }
      />
      <RegistrationFlash code={params.melding} />
      <GroupSwitch groups={groups} current={group.id} href={(groupId) => `/meldingen?vestiging=${groupId}`} />

      <section className="mb-6">
        <SectionTitle className="mb-2">Vandaag{todays.length > 0 ? ` (${todays.length})` : ''}</SectionTitle>
        {todays.length === 0 ? <EmptyState title="Vandaag is er nog niets gemeld." /> : list(todays)}
      </section>

      <div className="mb-6">
        <DayCloseCard
          group={group}
          date={today}
          today={today}
          closure={closure}
          closedByName={closure?.closedBy ? (names.get(closure.closedBy) ?? null) : null}
          canReopen={viewer.isLead}
          back={back}
        />
      </div>

      {earlier.length > 0 ? (
        <section className="mb-6">
          <SectionTitle className="mb-2">De afgelopen week</SectionTitle>
          {list(earlier)}
        </section>
      ) : null}
    </>
  );
}
