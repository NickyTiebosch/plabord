'use client';

import { useActionState, useState } from 'react';
import { SubmitButton } from '@/components/client/form-controls';
import { Choice, Field, Fieldset, Notice, inputClass } from '@/components/ui';
import type { ActionState } from '@/lib/admin/forms';
import type { AbsencePart, AbsenceStatus } from '@/lib/engine/types';
import { saveAbsence } from './actions';

export interface EmployeeOption {
  id: string;
  name: string;
  groupName: string;
}

export interface AbsenceDefaults {
  id?: string;
  employeeId?: string;
  startDate?: string;
  endDate?: string;
  dayPart?: AbsencePart;
  status?: AbsenceStatus;
}

export function AbsenceForm({
  employees,
  defaults = {},
  submitLabel = 'Opslaan',
}: {
  employees: EmployeeOption[];
  defaults?: AbsenceDefaults;
  submitLabel?: string;
}) {
  const [startDate, setStartDate] = useState(defaults.startDate ?? '');
  const [endDate, setEndDate] = useState(defaults.endDate ?? '');
  const [state, formAction] = useActionState<ActionState, FormData>(async (previous, formData) => {
    const result = await saveAbsence(previous, formData);
    // Na het opslaan van een nieuwe afwezigheid: klaar voor de volgende.
    if (result.ok && !defaults.id) {
      setStartDate('');
      setEndDate('');
    }
    return result;
  }, {});
  const singleDay = startDate !== '' && (endDate === '' || endDate === startDate);

  const groups = [...new Set(employees.map((employee) => employee.groupName))];
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-4">
      {defaults.id ? <input type="hidden" name="id" value={defaults.id} /> : null}
      {state.error ? <Notice tone="error">{state.error}</Notice> : null}
      {state.ok && state.message ? (
        <Notice tone={state.message.includes('Let op') ? 'warning' : 'success'}>{state.message}</Notice>
      ) : null}

      <Field label="Medewerker" htmlFor="employeeId" error={errors.employeeId}>
        <select id="employeeId" name="employeeId" defaultValue={defaults.employeeId ?? ''} required className={inputClass}>
          <option value="" disabled>
            Kies een medewerker
          </option>
          {groups.map((group) => (
            <optgroup key={group} label={group}>
              {employees
                .filter((employee) => employee.groupName === group)
                .map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.name}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Van" htmlFor="startDate" error={errors.startDate}>
          <input
            id="startDate"
            name="startDate"
            type="date"
            required
            value={startDate}
            onChange={(event) => {
              const value = event.target.value;
              setStartDate(value);
              if (!endDate || endDate < value) setEndDate(value);
            }}
            className={inputClass}
          />
        </Field>
        <Field label="Tot en met" htmlFor="endDate" error={errors.endDate}>
          <input
            id="endDate"
            name="endDate"
            type="date"
            required
            min={startDate || undefined}
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
            className={inputClass}
          />
        </Field>
      </div>

      <Fieldset legend="Dagdeel" hint={singleDay ? undefined : 'Een halve dag kan alleen bij één dag.'}>
        <div className="flex flex-wrap gap-2" key={singleDay ? 'enkel' : 'meer'}>
          <Choice type="radio" name="dayPart" value="full_day" label="Hele dag" defaultChecked={!singleDay || (defaults.dayPart ?? 'full_day') === 'full_day'} />
          <Choice type="radio" name="dayPart" value="morning" label="Ochtend" disabled={!singleDay} defaultChecked={singleDay && defaults.dayPart === 'morning'} />
          <Choice type="radio" name="dayPart" value="afternoon" label="Middag" disabled={!singleDay} defaultChecked={singleDay && defaults.dayPart === 'afternoon'} />
        </div>
        {errors.dayPart ? <p className="text-sm text-rose-700">{errors.dayPart}</p> : null}
      </Fieldset>

      <Fieldset legend="Status" hint="Aangevraagd = nog niet verwerkt in MyHR. Beide tellen als afwezig.">
        <div className="flex flex-wrap gap-2">
          <Choice type="radio" name="status" value="approved" label="Goedgekeurd" defaultChecked={(defaults.status ?? 'approved') === 'approved'} />
          <Choice type="radio" name="status" value="requested" label="Aangevraagd" defaultChecked={defaults.status === 'requested'} />
        </div>
      </Fieldset>

      <SubmitButton className="w-full sm:w-auto">{submitLabel}</SubmitButton>
    </form>
  );
}
