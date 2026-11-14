import type { Metadata } from 'next';
import { SubmitButton } from '@/components/client/form-controls';
import { StatefulForm } from '@/components/client/stateful-form';
import { GroupSwitch } from '@/components/registrations';
import { Badge, Card, EmptyState, PageHeader, SectionTitle, cx, inputClass } from '@/components/ui';
import { requireViewerWith } from '@/lib/auth/session';
import { loadEmployeeNames } from '@/lib/db/admin-queries';
import { loadLocations, loadSpots } from '@/lib/db/location-queries';
import { loadCounterGroups } from '@/lib/db/registration-queries';
import { todayInAmsterdam } from '@/lib/engine/dates';
import { formatLoanMoment } from '@/lib/loans/status';
import { formatPlate, normalizePlate } from '@/lib/loans/plates';
import { STALE_DAYS, isStale, spotsWithVehicles } from '@/lib/locations/status';
import { pickGroup } from '@/lib/registrations/status';
import { placeVehicle, removeVehicle } from './actions';

export const metadata: Metadata = { title: 'Locatie' };

/**
 * Locatie (fase 8, V72): waar staat deze auto? Per plek de auto's, met bovenaan het formulier om
 * een auto op een plek te zetten: een kenteken en een plek.
 */
export default async function LocationPage({ searchParams }: { searchParams: Promise<{ vestiging?: string; plek?: string; kenteken?: string }> }) {
  const params = await searchParams;
  const today = todayInAmsterdam(new Date());
  const [viewer, [allGroups, spots, locations, names]] = await requireViewerWith((supabase) =>
    Promise.all([loadCounterGroups(supabase), loadSpots(supabase), loadLocations(supabase), loadEmployeeNames(supabase)]),
  );
  const groups = allGroups.filter((group) => spots.some((spot) => spot.groupId === group.id && spot.isActive));
  const group = pickGroup(groups, params.vestiging, viewer.groupId);
  if (!group) return <EmptyState title="Er zijn nog geen plekken.">De beheerder legt de plekken per vestiging vast onder Beheer → Plekken.</EmptyState>;
  const entries = spotsWithVehicles(spots, locations, group.id);
  const active = spots.filter((spot) => spot.groupId === group.id && spot.isActive).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'nl', { numeric: true }));
  const preset = normalizePlate(params.kenteken ?? '');
  const current = preset ? locations.find((location) => location.plate === preset) : undefined;
  const count = locations.filter((location) => location.groupId === group.id).length;
  return (
    <>
      <PageHeader
        title="Locatie"
        subtitle={`${group.name} · ${count === 1 ? '1 auto' : `${count} auto’s`} op het terrein`}
        actions={
          viewer.isLead ? (
            // Een gewone link: elke klik is één export in het logboek.
            <a href="/locatie/export" download className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-800 hover:bg-slate-50">
              Download (Excel)
            </a>
          ) : null
        }
      />
      <GroupSwitch groups={groups} current={group.id} href={(groupId) => `/locatie?vestiging=${groupId}`} />

      <Card id="zetten" className="mb-4 scroll-mt-20 p-4">
        <SectionTitle className="mb-3">{current ? `${formatPlate(current.plate)} verzetten` : 'Auto op een plek zetten'}</SectionTitle>
        <StatefulForm action={placeVehicle} resetOnSuccess className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
          <label className="block text-sm font-medium text-slate-800">
            Kenteken
            <input name="plate" required defaultValue={preset ? formatPlate(preset) : ''} autoCapitalize="characters" autoComplete="off" placeholder="GHP-39-K" className={cx(inputClass, 'mt-1 font-mono uppercase')} />
          </label>
          <label className="block text-sm font-medium text-slate-800">
            Plek
            <select name="spotId" required defaultValue={params.plek ?? ''} className={cx(inputClass, 'mt-1')}>
              <option value="" disabled>
                Kies een plek
              </option>
              {active.map((spot) => (
                <option key={spot.id} value={spot.id}>
                  {spot.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-800">
            Model <span className="font-normal text-slate-500">(mag leeg)</span>
            <input name="model" maxLength={60} defaultValue={current?.model ?? ''} placeholder="Vult zichzelf aan als hij bekend is" className={cx(inputClass, 'mt-1')} />
          </label>
          <SubmitButton>Zetten</SubmitButton>
        </StatefulForm>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {entries.map(({ spot, vehicles }) => (
          <Card key={spot.id} className="flex flex-col">
            <div className="flex items-center justify-between gap-2 px-4 pt-3">
              <SectionTitle>
                {spot.name}
                {!spot.isActive ? <span className="ml-2 text-xs font-normal text-slate-500">(niet meer in gebruik)</span> : null}
              </SectionTitle>
              {spot.isActive ? (
                <a href={`/locatie?vestiging=${group.id}&plek=${spot.id}#zetten`} className="inline-flex min-h-11 items-center text-sm font-medium text-brand-800 underline underline-offset-2">
                  Auto hier zetten
                </a>
              ) : null}
            </div>
            {vehicles.length === 0 ? (
              <p className="px-4 pt-1 pb-3 text-sm text-slate-400">Leeg</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {vehicles.map((vehicle) => (
                  <li key={vehicle.plate} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-mono font-semibold text-slate-900">
                        {formatPlate(vehicle.plate)}
                        {isStale(vehicle, today) ? (
                          <Badge tone="neutral" className="ml-2 align-middle font-sans">
                            lang niet gezien
                          </Badge>
                        ) : null}
                      </p>
                      <p className="text-xs text-slate-500">
                        {[vehicle.model, `${names.get(vehicle.movedBy ?? '') ?? 'oud-collega'}, ${formatLoanMoment(vehicle.movedAt, today)}`].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <a href={`/locatie?vestiging=${group.id}&kenteken=${vehicle.plate}#zetten`} className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-800 hover:bg-slate-50">
                      Verzetten
                    </a>
                    <StatefulForm action={removeVehicle}>
                      <input type="hidden" name="plate" value={vehicle.plate} />
                      <SubmitButton size="sm" variant="ghost" confirm={`${formatPlate(vehicle.plate)} van het terrein halen?`}>
                        Weg
                      </SubmitButton>
                    </StatefulForm>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ))}
      </div>
      <p className="mt-4 text-xs text-slate-500">
        Lang niet gezien: langer dan {STALE_DAYS} dagen niet verzet. Staat de auto er nog? Zet hem dan opnieuw op zijn plek. Weg = van het
        terrein, bijvoorbeeld verhuurd. Elke verplaatsing staat in het logboek.
      </p>
    </>
  );
}
