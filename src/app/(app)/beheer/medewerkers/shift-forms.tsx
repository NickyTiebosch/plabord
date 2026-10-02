'use client';

import { useActionState } from 'react';
import { SubmitButton } from '@/components/client/form-controls';
import { submitKeepingValues } from '@/components/client/keep-values';
import { Choice, Field, Fieldset, Notice, inputClass } from '@/components/ui';
import type { ActionState } from '@/lib/admin/forms';
import { weekdayLong, weekdayShort } from '@/lib/engine/format';
import { ROLE_LABELS } from '@/lib/engine/labels';
import { ROLES, SHIFT_WEEKDAYS, type Role } from '@/lib/engine/types';
import { endShift, saveShiftFrom } from './actions';
import type { GroupOption } from './employee-form';

function Result({ state }: { state: ActionState }) {
  if (state.error) return <Notice tone="error">{state.error}</Notice>;
  if (state.ok && state.message) return <Notice tone="success">{state.message}</Notice>;
  return null;
}

/** Vakjes ma t/m za: je kiest in één keer alle dagen met dezelfde dienst. */
function WeekdayChoices({ legend, hint, error }: { legend: string; hint: string; error?: string }) {
  return (
    <Fieldset legend={legend} hint={hint} error={error}>
      <div className="flex flex-wrap gap-2">
        {SHIFT_WEEKDAYS.map((weekday) => (
          <Choice
            key={weekday}
            type="checkbox"
            name="weekday"
            value={String(weekday)}
            label={
              <>
                <span aria-hidden="true">{weekdayShort(weekday)}</span>
                <span className="sr-only">{weekdayLong(weekday)}</span>
              </>
            }
          />
        ))}
      </div>
    </Fieldset>
  );
}

export function ShiftFromForm({
  employeeId,
  groups,
  defaultGroupId,
  defaultRole,
  today,
}: {
  employeeId: string;
  groups: GroupOption[];
  defaultGroupId: string;
  defaultRole: Role;
  today: string;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(saveShiftFrom, {});
  const errors = state.fieldErrors ?? {};
  return (
    <form action={formAction} onSubmit={submitKeepingValues(formAction)} className="space-y-3">
      <input type="hidden" name="employeeId" value={employeeId} />
      <Result state={state} />
      <WeekdayChoices
        legend="Dagen"
        hint="Vink alle dagen aan met deze dienst. Een vaste vrije dag vink je niet aan."
        error={errors.weekdays}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Geldig vanaf" htmlFor="shift-validFrom" error={errors.validFrom}>
          <input id="shift-validFrom" name="validFrom" type="date" defaultValue={today} required className={inputClass} />
        </Field>
        <Field label="Groep" htmlFor="shift-groupId" error={errors.groupId}>
          <select id="shift-groupId" name="groupId" defaultValue={defaultGroupId} className={inputClass}>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Rol" htmlFor="shift-role" error={errors.role}>
          <select id="shift-role" name="role" defaultValue={defaultRole} className={inputClass}>
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Begintijd" htmlFor="shift-start" error={errors.startTime} hint="Leeg = standaarddienst">
          <input id="shift-start" name="startTime" type="time" className={inputClass} />
        </Field>
        <Field label="Eindtijd" htmlFor="shift-end" error={errors.endTime} hint="Leeg = standaarddienst">
          <input id="shift-end" name="endTime" type="time" className={inputClass} />
        </Field>
      </div>
      <p className="text-xs text-slate-500">
        Een dienst die op die datum loopt, stopt de dag ervoor. Dagen zonder vinkje blijven zoals ze zijn. Moet een dag
        vrij worden, gebruik dan &lsquo;Dienst laten stoppen&rsquo;. Het verleden blijft zoals het was.
      </p>
      <SubmitButton>Opslaan vanaf deze datum</SubmitButton>
    </form>
  );
}

export function ShiftEndForm({ employeeId, today }: { employeeId: string; today: string }) {
  const [state, formAction] = useActionState<ActionState, FormData>(endShift, {});
  const errors = state.fieldErrors ?? {};
  return (
    <form action={formAction} onSubmit={submitKeepingValues(formAction)} className="space-y-3">
      <input type="hidden" name="employeeId" value={employeeId} />
      <Result state={state} />
      <WeekdayChoices legend="Dagen" hint="Vink de dagen aan waarop de dienst stopt." error={errors.weekdays} />
      <Field label="Laatste werkdag" htmlFor="end-lastDay" error={errors.lastDay}>
        <input id="end-lastDay" name="lastDay" type="date" defaultValue={today} required className={inputClass} />
      </Field>
      <SubmitButton variant="secondary">Dienst laten stoppen</SubmitButton>
    </form>
  );
}
