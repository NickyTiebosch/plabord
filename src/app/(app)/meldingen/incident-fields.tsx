import { Choice, Field, Fieldset, inputClass } from '@/components/ui';
import { INCIDENT_KIND_LABELS, INCIDENT_KINDS, MISSING_LABELS, MISSING_OPTIONS, type CounterGroup, type Workshop } from '@/lib/registrations/types';

export interface IncidentDefaults {
  workshopId: string;
  kind: string;
  missing: string;
  cancelledAt: string;
  charge: '' | 'ja' | 'nee';
  plate: string;
  contractNumber: string;
  note: string;
  date: string;
  time: string;
}

/**
 * De velden van een melding (V58), ook gebruikt bij wijzigen. De werkplaatsen staan per vestiging
 * gegroepeerd, die van `ownGroupId` bovenaan. De velden die alleen bij één soort horen, verschijnen
 * pas als die soort is gekozen (met CSS, zonder JavaScript).
 */
export function IncidentFields({
  groups,
  workshops,
  ownGroupId,
  defaults,
  chargeFrom,
  errors,
}: {
  groups: readonly CounterGroup[];
  workshops: readonly Workshop[];
  ownGroupId: string;
  defaults: IncidentDefaults;
  chargeFrom: string;
  errors?: Record<string, string>;
}) {
  const ordered = [...groups].sort((a, b) => Number(b.id === ownGroupId) - Number(a.id === ownGroupId));
  return (
    <div className="group/incident space-y-4">
      <Field label="Werkplaats" htmlFor="workshopId" error={errors?.workshopId}>
        <select id="workshopId" name="workshopId" defaultValue={defaults.workshopId} required className={inputClass}>
          <option value="" disabled>
            Kies een werkplaats
          </option>
          {ordered.map((group) => (
            <optgroup key={group.id} label={group.name}>
              {workshops
                .filter((workshop) => workshop.groupId === group.id)
                .map((workshop) => (
                  <option key={workshop.id} value={workshop.id}>
                    {workshop.name}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
      </Field>

      <Fieldset legend="Soort melding" error={errors?.kind}>
        <div className="flex flex-col gap-2">
          {INCIDENT_KINDS.map((kind) => (
            <Choice key={kind} type="radio" name="kind" value={kind} label={INCIDENT_KIND_LABELS[kind]} defaultChecked={defaults.kind === kind} />
          ))}
        </div>
      </Fieldset>

      <div className="hidden group-has-[input[name=kind][value=contract_license]:checked]/incident:block">
        <Fieldset legend="Wat ontbrak?" error={errors?.missing}>
          <div className="flex flex-wrap gap-2">
            {MISSING_OPTIONS.map((option) => (
              <Choice key={option} type="radio" name="missing" value={option} label={MISSING_LABELS[option]} defaultChecked={defaults.missing === option} />
            ))}
          </div>
        </Fieldset>
      </div>

      <div className="hidden space-y-4 group-has-[input[name=kind][value=cancellation]:checked]/incident:block">
        <Field label="Hoe laat annuleerde de werkplaats?" htmlFor="cancelledAt" error={errors?.cancelledAt}>
          <input id="cancelledAt" name="cancelledAt" type="time" defaultValue={defaults.cancelledAt} className={inputClass} />
        </Field>
        <Field label="Doorbelasten" htmlFor="charge" hint={`Vanaf ${chargeFrom} wordt een annulering doorbelast. Je kunt het hier omzetten.`}>
          <select id="charge" name="charge" defaultValue={defaults.charge} className={inputClass}>
            <option value="">Volgens de regel (vanaf {chargeFrom})</option>
            <option value="ja">Ja, doorbelasten</option>
            <option value="nee">Nee, niet doorbelasten</option>
          </select>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Kenteken" htmlFor="plate" hint="Mag leeg blijven." error={errors?.plate}>
          <input
            id="plate"
            name="plate"
            defaultValue={defaults.plate}
            maxLength={14}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            placeholder="GHP-39-K"
            className={`${inputClass} font-mono uppercase tracking-wide`}
          />
        </Field>
        <Field label="Contract- of reserveringsnummer" htmlFor="contractNumber" hint="Mag leeg blijven." error={errors?.contractNumber}>
          <input id="contractNumber" name="contractNumber" defaultValue={defaults.contractNumber} maxLength={20} inputMode="numeric" autoComplete="off" className={inputClass} />
        </Field>
      </div>

      <Field label="Bijzonderheden" htmlFor="note" hint="Kort. Klantgegevens zijn niet nodig." error={errors?.note}>
        <textarea id="note" name="note" defaultValue={defaults.note} maxLength={300} rows={2} className={inputClass} />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Datum" htmlFor="date" error={errors?.date}>
          <input id="date" name="date" type="date" defaultValue={defaults.date} required className={inputClass} />
        </Field>
        <Field label="Tijd" htmlFor="time" error={errors?.time}>
          <input id="time" name="time" type="time" defaultValue={defaults.time} required className={inputClass} />
        </Field>
      </div>
    </div>
  );
}
