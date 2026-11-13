import { Choice, Field, Fieldset, inputClass } from '@/components/ui';
import { DESTINATION_LABELS, DESTINATIONS, type Destination, type LoanGroup } from '@/lib/loans/types';

export interface HandOutDefaults {
  groupId: string;
  plate: string;
  model: string;
  odometerOut: string;
  date: string;
  time: string;
  destination: Destination | '';
  handedTo: string;
  note: string;
}

/**
 * De velden van het aanmelden (V46), ook gebruikt bij corrigeren. Vrije velden zijn gewoon tekst:
 * geen keuzelijsten. Bij model en "meegegeven aan" doet de telefoon suggesties uit de laatste weken.
 */
export function HandOutFields({
  groups,
  defaults,
  models,
  recipients,
}: {
  groups: readonly LoanGroup[];
  defaults: HandOutDefaults;
  models: readonly string[];
  recipients: readonly string[];
}) {
  return (
    <div className="space-y-4">
      <Field label="Vestiging" htmlFor="groupId" hint="De vestiging die de auto meegeeft.">
        <select id="groupId" name="groupId" defaultValue={defaults.groupId} required className={inputClass}>
          <option value="" disabled>
            Kies een vestiging
          </option>
          {groups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Kenteken" htmlFor="plate">
          <input
            id="plate"
            name="plate"
            defaultValue={defaults.plate}
            required
            maxLength={14}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            placeholder="GHP-39-K"
            className={`${inputClass} font-mono uppercase tracking-wide`}
          />
        </Field>
        <Field label="Model" htmlFor="model">
          <input
            id="model"
            name="model"
            defaultValue={defaults.model}
            required
            maxLength={40}
            autoComplete="off"
            list="loan-models"
            placeholder="Polo"
            className={inputClass}
          />
          <datalist id="loan-models">
            {models.map((model) => (
              <option key={model} value={model} />
            ))}
          </datalist>
        </Field>
      </div>

      <Fieldset legend="Bestemming">
        <div className="grid grid-cols-2 gap-2">
          {DESTINATIONS.map((destination) => (
            <Choice
              key={destination}
              type="radio"
              name="destination"
              value={destination}
              label={DESTINATION_LABELS[destination]}
              defaultChecked={defaults.destination === destination}
            />
          ))}
        </div>
      </Fieldset>

      <Field label="Meegegeven aan" htmlFor="handedTo" hint="De naam van de persoon of de afdeling.">
        <input
          id="handedTo"
          name="handedTo"
          defaultValue={defaults.handedTo}
          required
          maxLength={60}
          autoComplete="off"
          list="loan-recipients"
          className={inputClass}
        />
        <datalist id="loan-recipients">
          {recipients.map((recipient) => (
            <option key={recipient} value={recipient} />
          ))}
        </datalist>
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Datum" htmlFor="date">
          <input id="date" name="date" type="date" defaultValue={defaults.date} required className={inputClass} />
        </Field>
        <Field label="Tijd" htmlFor="time">
          <input id="time" name="time" type="time" defaultValue={defaults.time} required className={inputClass} />
        </Field>
      </div>

      <Field label="Kilometerstand" htmlFor="odometerOut" hint="Mag leeg blijven.">
        <input
          id="odometerOut"
          name="odometerOut"
          defaultValue={defaults.odometerOut}
          inputMode="numeric"
          autoComplete="off"
          maxLength={9}
          placeholder="45210"
          className={inputClass}
        />
      </Field>

      <Field label="Reden of opmerking" htmlFor="note" hint="Kort, bijvoorbeeld Pech onderweg. Klantgegevens zijn niet nodig.">
        <input id="note" name="note" defaultValue={defaults.note} maxLength={200} autoComplete="off" className={inputClass} />
      </Field>
    </div>
  );
}

/** Unieke waarden, de meest recente eerst, hooguit `limit`. */
export function recentValues(values: readonly string[], limit = 12): string[] {
  const result: string[] = [];
  for (const value of values) {
    if (!result.some((item) => item.toLowerCase() === value.toLowerCase())) result.push(value);
    if (result.length === limit) break;
  }
  return result;
}
