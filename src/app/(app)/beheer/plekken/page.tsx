import type { Metadata } from 'next';
import { SubmitButton } from '@/components/client/form-controls';
import { StatefulForm } from '@/components/client/stateful-form';
import { Card, PageHeader, SectionTitle, inputClass } from '@/components/ui';
import { requireAdminWith } from '@/lib/auth/session';
import { loadLocations, loadSpots } from '@/lib/db/location-queries';
import { loadCounterGroups } from '@/lib/db/registration-queries';
import { addSpots, saveSpot } from './actions';
import { LocationImport } from './location-import';

export const metadata: Metadata = { title: 'Plekken' };

/** Plekken per vestiging (fase 8, V73), en de startlijst inlezen. */
export default async function SpotsPage() {
  const [, [groups, spots, locations]] = await requireAdminWith((supabase) => Promise.all([loadCounterGroups(supabase), loadSpots(supabase), loadLocations(supabase)]));
  return (
    <>
      <PageHeader title="Plekken" subtitle="Voor Locatie: waar een auto op het terrein staat. Een vestiging zonder plekken ziet het onderdeel Locatie niet." />
      <div className="grid gap-6 lg:grid-cols-2">
        {groups.map((group) => {
          const own = spots.filter((spot) => spot.groupId === group.id).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'nl', { numeric: true }));
          return (
            <Card key={group.id} className="space-y-3 p-4">
              <SectionTitle>{group.name}</SectionTitle>
              {own.length === 0 ? <p className="text-sm text-slate-500">Nog geen plekken.</p> : null}
              <ul className="divide-y divide-slate-100">
                {own.map((spot) => {
                  const cars = locations.filter((location) => location.spotId === spot.id).length;
                  return (
                    <li key={spot.id} className="py-2">
                      <StatefulForm action={saveSpot} className="flex flex-wrap items-end gap-2">
                        <input type="hidden" name="id" value={spot.id} />
                        <label className="min-w-0 flex-1 text-xs text-slate-500">
                          Naam{cars > 0 ? ` · ${cars === 1 ? '1 auto' : `${cars} auto’s`}` : ''}
                          <input name="name" defaultValue={spot.name} maxLength={20} required aria-label={`Naam van ${spot.name}`} className={inputClass} />
                        </label>
                        <label className="w-20 text-xs text-slate-500">
                          Volgorde
                          <input name="sortOrder" type="number" min={0} max={999} defaultValue={spot.sortOrder} aria-label={`Volgorde van ${spot.name}`} className={inputClass} />
                        </label>
                        <label className="inline-flex min-h-11 items-center gap-2 text-sm text-slate-700">
                          <input type="checkbox" name="isActive" defaultChecked={spot.isActive} className="size-5" />
                          Actief
                        </label>
                        <SubmitButton size="sm" variant="secondary">
                          Opslaan
                        </SubmitButton>
                        <SubmitButton size="sm" variant="ghost" name="intent" value="delete" confirm={`${spot.name} verwijderen? Dat kan alleen als er geen auto staat.`}>
                          Verwijderen
                        </SubmitButton>
                      </StatefulForm>
                    </li>
                  );
                })}
              </ul>
              <StatefulForm action={addSpots} resetOnSuccess className="space-y-2 border-t border-slate-100 pt-3">
                <input type="hidden" name="groupId" value={group.id} />
                <label className="block text-xs text-slate-500">
                  Nieuwe plekken, één per regel
                  <textarea name="names" rows={3} required aria-label={`Nieuwe plekken in ${group.name}`} placeholder={'S 1\nS 2\nWasstraat'} className={inputClass} />
                </label>
                <SubmitButton size="sm">Toevoegen</SubmitButton>
              </StatefulForm>
            </Card>
          );
        })}
        <LocationImport groups={groups} />
      </div>
      <p className="mt-4 text-xs text-slate-500">Een inactieve plek staat niet meer in de keuzelijst. Auto’s die er nog staan, blijven zichtbaar tot ze zijn verzet.</p>
    </>
  );
}
