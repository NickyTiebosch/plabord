'use client';

import { useActionState } from 'react';
import { SubmitButton } from '@/components/client/form-controls';
import { submitKeepingValues } from '@/components/client/keep-values';
import { Field, Notice, inputClass } from '@/components/ui';
import type { ActionState } from '@/lib/admin/forms';
import { ROLE_LABELS } from '@/lib/engine/labels';
import { ROLES, type Role } from '@/lib/engine/types';
import { endShift, saveShiftFrom } from './actions';
import type { GroupOption } from './employee-form';

const WEEKDAYS = [
  { value: 1, label: 'maandag' },
  { value: 2, label: 'dinsdag' },
  { value: 3, label: 'woensdag' },
  { value: 4, label: 'donderdag' },
  { value: 5, label: 'vrijdag' },
  { value: 6, label: 'zaterdag' },
];

function Result({ state }: { state: ActionState }) {
  if (state.error) return <Notice tone="error">{state.error}</Notice>;
  if (state.ok && state.message) return <Notice tone="success">{state.message}</Notice>;
  return null;
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
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Dag" htmlFor="shift-weekday" error={errors.weekday}>
          <select id="shift-weekday" name="weekday" defaultValue="1" className={inputClass}>
            {WEEKDAYS.map((day) => (
              <option key={day.value} value={day.value}>
                {day.label}
              </option>
            ))}
          </select>
        </Field>
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
        Een dienst die op die datum loopt, stopt de dag ervoor. Het verleden blijft zoals het was.
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
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Dag" htmlFor="end-weekday" error={errors.weekday}>
          <select id="end-weekday" name="weekday" defaultValue="1" className={inputClass}>
            {WEEKDAYS.map((day) => (
              <option key={day.value} value={day.value}>
                {day.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Laatste werkdag" htmlFor="end-lastDay" error={errors.lastDay}>
          <input id="end-lastDay" name="lastDay" type="date" defaultValue={today} required className={inputClass} />
        </Field>
      </div>
      <SubmitButton variant="secondary">Dienst laten stoppen</SubmitButton>
    </form>
  );
}
