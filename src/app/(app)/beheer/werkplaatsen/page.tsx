import type { Metadata } from 'next';
import { SubmitButton } from '@/components/client/form-controls';
import { StatefulForm } from '@/components/client/stateful-form';
import { Card, Field, PageHeader, SectionTitle, inputClass } from '@/components/ui';
import { requireAdminWith } from '@/lib/auth/session';
import { loadCounterGroups, loadRegistrationSettings, loadWorkshops } from '@/lib/db/registration-queries';
import { addWorkshop, saveRegistrationTimes, saveWorkshop } from './actions';

export const metadata: Metadata = { title: 'Werkplaatsen' };

/** Werkplaatsen per vestiging (V56), en de tijdstippen voor doorbelasten en de herinnering. */
export default async function WorkshopsPage() {
  const [, [groups, workshops, settings]] = await requireAdminWith((supabase) =>
    Promise.all([loadCounterGroups(supabase), loadWorkshops(supabase), loadRegistrationSettings(supabase)]),
  );
  return (
    <>
      <PageHeader title="Werkplaatsen" subtitle="Voor Binnenvallers en Meldingen." />
      <div className="grid gap-6 lg:grid-cols-2">
        {groups.map((group) => {
          const own = workshops.filter((workshop) => workshop.groupId === group.id);
          return (
            <Card key={group.id} className="space-y-3 p-4">
              <SectionTitle>{group.name}</SectionTitle>
              <ul className="divide-y divide-slate-100">
                {own.map((workshop) => (
                  <li key={workshop.id} className="py-2">
                    <StatefulForm action={saveWorkshop} className="flex flex-wrap items-end gap-2">
                      <input type="hidden" name="id" value={workshop.id} />
                      <label className="min-w-0 flex-1 text-xs text-slate-500">
                        Naam
                        <input name="name" defaultValue={workshop.name} maxLength={40} required aria-label={`Naam van ${workshop.name}`} className={inputClass} />
                      </label>
                      <label className="w-16 text-xs text-slate-500">
                        Volgorde
                        <input name="sortOrder" type="number" min={0} max={99} defaultValue={workshop.sortOrder} aria-label={`Volgorde van ${workshop.name}`} className={inputClass} />
                      </label>
                      <label className="inline-flex min-h-11 items-center gap-2 text-sm text-slate-700">
                        <input type="checkbox" name="isActive" defaultChecked={workshop.isActive} className="size-5" />
                        Actief
                      </label>
                      <SubmitButton size="sm" variant="secondary">
                        Opslaan
                      </SubmitButton>
                      <SubmitButton size="sm" variant="ghost" name="intent" value="delete" confirm={`${workshop.name} verwijderen? Dat kan alleen als er geen cijfers aan hangen.`}>
                        Verwijderen
                      </SubmitButton>
                    </StatefulForm>
                  </li>
                ))}
              </ul>
              <StatefulForm action={addWorkshop} resetOnSuccess className="flex flex-wrap items-end gap-2 border-t border-slate-100 pt-3">
                <input type="hidden" name="groupId" value={group.id} />
                <label className="min-w-0 flex-1 text-xs text-slate-500">
                  Nieuwe werkplaats
                  <input name="name" maxLength={40} required aria-label={`Nieuwe werkplaats in ${group.name}`} className={inputClass} />
                </label>
                <SubmitButton size="sm">Toevoegen</SubmitButton>
              </StatefulForm>
              <p className="text-xs text-slate-500">Een inactieve werkplaats staat niet meer bij de tellers en in het formulier. De cijfers blijven bewaard.</p>
            </Card>
          );
        })}

        <Card className="p-4 lg:col-span-2">
          <SectionTitle className="mb-3">Tijdstippen</SectionTitle>
          <StatefulForm action={saveRegistrationTimes} className="grid gap-4 sm:grid-cols-2">
            <Field label="Annulering doorbelasten vanaf" htmlFor="chargeFrom" hint="Een annulering door de werkplaats vanaf dit tijdstip staat vanzelf op doorbelasten.">
              <input id="chargeFrom" name="chargeFrom" type="time" defaultValue={settings.chargeFrom} required className={inputClass} />
            </Field>
            <Field
              label="Herinnering: dag nog niet afgesloten"
              htmlFor="reminderAt"
              hint="Wie die dag op de vestiging werkt, krijgt dan een pushmelding. Leeg = geen herinnering. De taak draait elk heel uur."
            >
              <input id="reminderAt" name="reminderAt" type="time" defaultValue={settings.reminderAt ?? ''} className={inputClass} />
            </Field>
            <div className="sm:col-span-2">
              <SubmitButton>Opslaan</SubmitButton>
            </div>
          </StatefulForm>
        </Card>
      </div>
    </>
  );
}
