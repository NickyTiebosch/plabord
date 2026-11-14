import type { Metadata } from 'next';
import { SubmitButton } from '@/components/client/form-controls';
import { Card, EmptyState, Field, LinkButton, PageHeader, buttonClass, inputClass } from '@/components/ui';
import { requireViewerWith } from '@/lib/auth/session';
import { loadEmployeeNames } from '@/lib/db/admin-queries';
import { INCIDENT_LIMIT, loadCounterGroups, loadIncidents, loadWorkshops, type IncidentFilter } from '@/lib/db/registration-queries';
import { addDays, isIsoDate, todayInAmsterdam } from '@/lib/engine/dates';
import { plateQuery } from '@/lib/loans/plates';
import { canEditOwn } from '@/lib/registrations/status';
import { INCIDENT_KIND_LABELS, INCIDENT_KINDS, isIncidentKind } from '@/lib/registrations/types';
import { IncidentRow } from '../incident-row';

export const metadata: Metadata = { title: 'Archief meldingen' };

interface Params {
  zoek?: string;
  vestiging?: string;
  soort?: string;
  van?: string;
  tot?: string;
}

const DEFAULT_DAYS = 30;

/** Het archief van de meldingen: zoeken op periode, vestiging, soort en kenteken. */
export default async function IncidentArchivePage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const today = todayInAmsterdam(new Date());
  const to = isIsoDate(params.tot) ? params.tot : today;
  const fromCandidate = isIsoDate(params.van) ? params.van : addDays(to, -DEFAULT_DAYS);
  const from = fromCandidate <= to ? fromCandidate : to;
  const filter: IncidentFilter = {
    from,
    to,
    groupId: params.vestiging && /^[a-z_]{1,40}$/.test(params.vestiging) ? params.vestiging : null,
    kind: isIncidentKind(params.soort) ? params.soort : null,
    plate: plateQuery(params.zoek ?? ''),
  };
  const [viewer, [groups, workshops, names, found]] = await requireViewerWith((supabase) =>
    Promise.all([loadCounterGroups(supabase), loadWorkshops(supabase), loadEmployeeNames(supabase), loadIncidents(supabase, filter)]),
  );
  const workshopName = (id: string) => workshops.find((workshop) => workshop.id === id)?.name ?? 'Onbekende werkplaats';
  const groupName = (id: string) => groups.find((group) => group.id === id)?.name ?? id;

  return (
    <>
      <PageHeader
        title="Archief meldingen"
        subtitle="Meldingen blijven 24 maanden bewaard."
        actions={
          viewer.isLead ? (
            // Een gewone link: elke klik is één export in het logboek.
            <a href="/meldingen/export" download className={buttonClass('secondary')}>
              Download (Excel)
            </a>
          ) : null
        }
      />
      <Card className="mb-4 p-4">
        <form className="grid gap-3 sm:grid-cols-3" role="search">
          <Field label="Kenteken" htmlFor="zoek">
            <input id="zoek" name="zoek" defaultValue={params.zoek ?? ''} autoCapitalize="characters" autoComplete="off" spellCheck={false} placeholder="bijv. 39-K" className={`${inputClass} font-mono uppercase`} />
          </Field>
          <Field label="Van" htmlFor="van">
            <input id="van" name="van" type="date" defaultValue={from} className={inputClass} />
          </Field>
          <Field label="Tot en met" htmlFor="tot">
            <input id="tot" name="tot" type="date" defaultValue={to} className={inputClass} />
          </Field>
          <Field label="Vestiging" htmlFor="vestiging">
            <select id="vestiging" name="vestiging" defaultValue={filter.groupId ?? ''} className={inputClass}>
              <option value="">Alle vestigingen</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Soort" htmlFor="soort">
            <select id="soort" name="soort" defaultValue={filter.kind ?? ''} className={inputClass}>
              <option value="">Alle soorten</option>
              {INCIDENT_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {INCIDENT_KIND_LABELS[kind]}
                </option>
              ))}
            </select>
          </Field>
          <div className="flex items-end gap-2">
            <SubmitButton>Zoeken</SubmitButton>
            <LinkButton href="/meldingen/archief" variant="ghost">
              Wissen
            </LinkButton>
          </div>
        </form>
      </Card>

      {found.incidents.length === 0 ? (
        <EmptyState title="Niets gevonden">Kies een langere periode of wis de filters.</EmptyState>
      ) : (
        <>
          <p className="mb-2 text-sm text-slate-600">
            {found.incidents.length} {found.incidents.length === 1 ? 'melding' : 'meldingen'}
            {found.more ? ` (de eerste ${INCIDENT_LIMIT}; kies een kortere periode voor de rest)` : ''}
          </p>
          <Card>
            <ul className="divide-y divide-slate-100">
              {found.incidents.map((incident) => (
                <IncidentRow
                  key={incident.id}
                  incident={incident}
                  workshopName={workshopName(incident.workshopId)}
                  groupName={groupName(incident.groupId)}
                  reporterName={incident.reportedBy ? (names.get(incident.reportedBy) ?? 'een oud-collega') : 'onbekend'}
                  today={today}
                  editable={canEditOwn({ ownerId: incident.reportedBy, createdAt: incident.createdAt }, viewer, today)}
                />
              ))}
            </ul>
          </Card>
        </>
      )}
    </>
  );
}
