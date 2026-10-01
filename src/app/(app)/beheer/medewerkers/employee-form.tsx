'use client';

import { useActionState } from 'react';
import { SubmitButton } from '@/components/client/form-controls';
import { submitKeepingValues } from '@/components/client/keep-values';
import { Choice, Field, Fieldset, Notice, inputClass } from '@/components/ui';
import type { ActionState } from '@/lib/admin/forms';
import { ROLE_LABELS } from '@/lib/engine/labels';
import { ROLES, type Role } from '@/lib/engine/types';
import { createEmployee, updateEmployee } from './actions';

export interface GroupOption {
  id: string;
  name: string;
  hasCounter: boolean;
}

export interface EmployeeDefaults {
  id: string;
  name: string;
  email: string | null;
  groupId: string;
  defaultRole: Role;
  counterGroupIds: readonly string[];
  isAdmin: boolean;
  isActive: boolean;
}

export function EmployeeForm({ groups, defaults }: { groups: GroupOption[]; defaults?: EmployeeDefaults }) {
  const [state, formAction] = useActionState<ActionState, FormData>(defaults ? updateEmployee : createEmployee, {});
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} onSubmit={submitKeepingValues(formAction)} className="space-y-4">
      {defaults ? <input type="hidden" name="id" value={defaults.id} /> : null}
      {defaults ? <input type="hidden" name="isActivePresent" value="1" /> : null}
      {state.error ? <Notice tone="error">{state.error}</Notice> : null}
      {state.ok && state.message ? (
        <Notice tone={state.message.startsWith('Opgeslagen, maar') ? 'warning' : 'success'}>{state.message}</Notice>
      ) : null}

      <Field label="Naam" htmlFor="name" error={errors.name} hint="Uniek; zo koppelt ook de Excel-import.">
        <input id="name" name="name" defaultValue={defaults?.name} required maxLength={80} className={inputClass} autoComplete="off" />
      </Field>

      <Field
        label="Werkmail"
        htmlFor="email"
        error={errors.email}
        hint="Leeg = staat wel in het rooster, maar kan niet inloggen. Alleen beheerders en de medewerker zelf zien dit adres."
      >
        <input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoCapitalize="none"
          spellCheck={false}
          defaultValue={defaults?.email ?? ''}
          className={inputClass}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Groep" htmlFor="groupId" error={errors.groupId}>
          <select id="groupId" name="groupId" defaultValue={defaults?.groupId ?? ''} required className={inputClass}>
            <option value="" disabled>
              Kies een groep
            </option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Standaardrol" htmlFor="defaultRole" error={errors.defaultRole}>
          <select id="defaultRole" name="defaultRole" defaultValue={defaults?.defaultRole ?? 'none'} className={inputClass}>
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Fieldset legend="Inzetbaar aan de balie in">
        <div className="flex flex-wrap gap-2">
          {groups
            .filter((group) => group.hasCounter)
            .map((group) => (
              <Choice
                key={group.id}
                type="checkbox"
                name="counterGroupIds"
                value={group.id}
                label={group.name}
                defaultChecked={defaults?.counterGroupIds.includes(group.id)}
              />
            ))}
        </div>
      </Fieldset>

      <div className="flex flex-wrap gap-2">
        <Choice type="checkbox" name="isAdmin" value="on" label="Beheerder" defaultChecked={defaults?.isAdmin} />
        {defaults ? (
          <Choice type="checkbox" name="isActive" value="on" label="Actief" defaultChecked={defaults.isActive} />
        ) : null}
      </div>
      {defaults ? (
        <p className="text-xs text-slate-500">
          Inactief: kan niet meer inloggen en verdwijnt uit de roosters, het verlofoverzicht en de feeds. De gegevens blijven
          bewaard.
        </p>
      ) : null}

      <SubmitButton>{defaults ? 'Opslaan' : 'Medewerker aanmaken'}</SubmitButton>
    </form>
  );
}
