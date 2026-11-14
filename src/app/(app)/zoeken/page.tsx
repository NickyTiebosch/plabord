import type { Metadata } from 'next';
import Link from 'next/link';
import { Badge, Card, PageHeader, SectionTitle, cx, inputClass, buttonClass } from '@/components/ui';
import { requireViewerWith } from '@/lib/auth/session';
import { loadEmployeeNames } from '@/lib/db/admin-queries';
import { mapLocation, mapSpot } from '@/lib/db/location-queries';
import { mapVehicleLoan } from '@/lib/db/loan-queries';
import { must } from '@/lib/db/queries';
import { loadCounterGroups, loadWorkshops, mapIncident } from '@/lib/db/registration-queries';
import { todayInAmsterdam } from '@/lib/engine/dates';
import { formatLoanMoment } from '@/lib/loans/status';
import { formatPlate, plateQuery } from '@/lib/loans/plates';
import { DESTINATION_LABELS } from '@/lib/loans/types';
import { isStale } from '@/lib/locations/status';
import { INCIDENT_KIND_LABELS } from '@/lib/registrations/types';

export const metadata: Metadata = { title: 'Zoeken op kenteken' };

/** Zoveel treffers per soort; daarna verfijnen. */
const LIMIT = 20;

/**
 * Zoeken op kenteken (fase 8, V76): alles wat Planbord zelf van een auto weet. Waar hij staat, de
 * uitleen en de meldingen. Geen wagenkaart en geen kopie van Rentwise.
 */
export default async function SearchPage({ searchParams }: { searchParams: Promise<{ kenteken?: string }> }) {
  const { kenteken = '' } = await searchParams;
  const query = plateQuery(kenteken);
  const today = todayInAmsterdam(new Date());
  const searching = query.length >= 2;
  const [, [groups, workshops, names, results]] = await requireViewerWith((supabase) =>
    Promise.all([
      loadCounterGroups(supabase),
      loadWorkshops(supabase),
      loadEmployeeNames(supabase),
      searching
        ? Promise.all([
            supabase.from('vehicle_locations').select('*').ilike('license_plate', `%${query}%`).order('license_plate').limit(LIMIT),
            supabase.from('parking_spots').select('*'),
            supabase.from('vehicle_loans').select('*').ilike('license_plate', `%${query}%`).order('handed_out_at', { ascending: false }).limit(LIMIT),
            supabase.from('incident_reports').select('*').ilike('license_plate', `%${query}%`).order('occurred_at', { ascending: false }).limit(LIMIT),
          ]).then(([locations, spots, loans, incidents]) => ({
            // Zonder fase 8 in de database: geen locaties, de rest wel.
            locations: locations.error ? [] : (locations.data ?? []).map(mapLocation),
            spots: spots.error ? [] : (spots.data ?? []).map(mapSpot),
            loans: must(loans, 'de uitleen').map(mapVehicleLoan),
            incidents: must(incidents, 'de meldingen').map(mapIncident),
          }))
        : Promise.resolve(null),
    ]),
  );
  const groupName = (id: string) => groups.find((group) => group.id === id)?.name ?? id;
  const person = (id: string | null) => (id ? (names.get(id) ?? 'oud-collega') : 'oud-collega');
  const nothing = results && results.locations.length + results.loans.length + results.incidents.length === 0;
  return (
    <>
      <PageHeader title="Zoeken op kenteken" subtitle="Wat Planbord van een auto weet: waar hij staat, de uitleen en de meldingen." />
      <Card className="mb-4 p-4">
        <form method="get" action="/zoeken" role="search" className="flex flex-wrap items-end gap-2">
          <label className="min-w-0 flex-1 text-sm font-medium text-slate-800">
            Kenteken, of een deel ervan
            <input
              name="kenteken"
              defaultValue={kenteken}
              autoFocus={!searching}
              autoCapitalize="characters"
              autoComplete="off"
              placeholder="GHP-39-K of 39K"
              className={cx(inputClass, 'mt-1 font-mono uppercase')}
            />
          </label>
          <button type="submit" className={buttonClass('primary')}>
            Zoeken
          </button>
        </form>
        {kenteken !== '' && !searching ? <p className="mt-2 text-sm text-rose-700">Vul minstens twee letters of cijfers in.</p> : null}
      </Card>

      {nothing ? <p className="text-sm text-slate-600">Niets gevonden voor {kenteken}.</p> : null}

      {results && results.locations.length > 0 ? (
        <Card className="mb-4">
          <div className="px-4 pt-3">
            <SectionTitle>Waar hij staat</SectionTitle>
          </div>
          <ul className="divide-y divide-slate-100">
            {results.locations.map((location) => (
              <li key={location.plate} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-sm">
                <span className="font-mono font-semibold text-slate-900">{formatPlate(location.plate)}</span>
                <span className="text-slate-800">
                  {groupName(location.groupId)}, {results.spots.find((spot) => spot.id === location.spotId)?.name ?? 'onbekende plek'}
                </span>
                {isStale(location, today) ? <Badge tone="neutral">lang niet gezien</Badge> : null}
                <span className="w-full text-xs text-slate-500">
                  {[location.model, `verzet door ${person(location.movedBy)}, ${formatLoanMoment(location.movedAt, today)}`].filter(Boolean).join(' · ')}
                </span>
                <Link href={`/locatie?vestiging=${location.groupId}&kenteken=${location.plate}#zetten`} className="text-sm font-medium text-brand-800 underline underline-offset-2">
                  Verzetten
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {results && results.loans.length > 0 ? (
        <Card className="mb-4">
          <div className="px-4 pt-3">
            <SectionTitle>Mobiliteit</SectionTitle>
          </div>
          <ul className="divide-y divide-slate-100">
            {results.loans.map((loan) => (
              <li key={loan.id} className="px-4 py-2 text-sm">
                <p>
                  <span className="font-mono font-semibold text-slate-900">{formatPlate(loan.plate)}</span>{' '}
                  <span className="text-slate-700">{loan.model}</span>{' '}
                  {loan.returnedAt ? null : <Badge tone="warning">nu uit</Badge>}
                </p>
                <p className="text-xs text-slate-500">
                  {DESTINATION_LABELS[loan.destination]} · {groupName(loan.groupId)} · meegegeven {formatLoanMoment(loan.handedOutAt, today)}
                  {loan.returnedAt ? ` · retour ${formatLoanMoment(loan.returnedAt, today)}${loan.wasUsed === false ? ', niet ingezet' : ''}` : ''}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {results && results.incidents.length > 0 ? (
        <Card className="mb-4">
          <div className="px-4 pt-3">
            <SectionTitle>Meldingen</SectionTitle>
          </div>
          <ul className="divide-y divide-slate-100">
            {results.incidents.map((incident) => (
              <li key={incident.id}>
                <Link href={`/meldingen/${incident.id}`} className="block px-4 py-2 text-sm hover:bg-slate-50">
                  <p>
                    <span className="font-mono font-semibold text-slate-900">{incident.plate ? formatPlate(incident.plate) : ''}</span>{' '}
                    <span className="text-slate-800">{INCIDENT_KIND_LABELS[incident.kind]}</span>
                  </p>
                  <p className="text-xs text-slate-500">
                    {groupName(incident.groupId)}, {workshops.find((workshop) => workshop.id === incident.workshopId)?.name ?? 'werkplaats'} ·{' '}
                    {formatLoanMoment(incident.occurredAt, today)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
      {results && (results.locations.length === LIMIT || results.loans.length === LIMIT || results.incidents.length === LIMIT) ? (
        <p className="text-xs text-slate-500">Er zijn meer treffers. Typ meer van het kenteken om te verfijnen.</p>
      ) : null}
    </>
  );
}
