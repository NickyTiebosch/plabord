'use client';

import { SubmitButton } from '@/components/client/form-controls';
import { StatefulForm } from '@/components/client/stateful-form';
import { Field, inputClass } from '@/components/ui';
import { ROLE_LABELS } from '@/lib/engine/labels';
import { ROLES, type Role } from '@/lib/engine/types';
import { moveDayShift, setDayShift } from '../../actions';

export interface DayFormDefaults {
  employeeId: string;
  date: string;
  groupId: string;
  role: Role;
  startTime: string;
  endTime: string;
  returnTo: string;
}

function ShiftFields({ defaults, groups, prefix }: { defaults: DayFormDefaults; groups: { id: string; name: string }[]; prefix: string }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Groep" htmlFor={`${prefix}-group`}>
        <select id={`${prefix}-group`} name="groupId" defaultValue={defaults.groupId} className={inputClass}>
          {groups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Rol" htmlFor={`${prefix}-role`}>
        <select id={`${prefix}-role`} name="role" defaultValue={defaults.role} className={inputClass}>
          {ROLES.map((role) => (
            <option key={role} value={role}>
              {ROLE_LABELS[role]}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Begintijd" htmlFor={`${prefix}-start`} hint="Leeg = standaarddienst">
        <input id={`${prefix}-start`} name="startTime" type="time" defaultValue={defaults.startTime} className={inputClass} />
      </Field>
      <Field label="Eindtijd" htmlFor={`${prefix}-end`} hint="Leeg = standaarddienst">
        <input id={`${prefix}-end`} name="endTime" type="time" defaultValue={defaults.endTime} className={inputClass} />
      </Field>
    </div>
  );
}

/** Andere dienst deze dag: ook om een dienst toe te voegen op een dag zonder vaste dienst. */
export function DayShiftForm({ defaults, groups, label }: { defaults: DayFormDefaults; groups: { id: string; name: string }[]; label: string }) {
  return (
    <StatefulForm action={setDayShift} className="space-y-3">
      <input type="hidden" name="employeeId" value={defaults.employeeId} />
      <input type="hidden" name="date" value={defaults.date} />
      <input type="hidden" name="terug" value={defaults.returnTo} />
      <ShiftFields defaults={defaults} groups={groups} prefix="day" />
      <SubmitButton>{label}</SubmitButton>
    </StatefulForm>
  );
}

/** Verplaatsen naar een andere dag (besluit V6). */
export function MoveShiftForm({ defaults, groups }: { defaults: DayFormDefaults; groups: { id: string; name: string }[] }) {
  return (
    <StatefulForm action={moveDayShift} className="space-y-3">
      <input type="hidden" name="employeeId" value={defaults.employeeId} />
      <input type="hidden" name="date" value={defaults.date} />
      <input type="hidden" name="terug" value={defaults.returnTo} />
      <Field label="Naar" htmlFor="move-to" hint="Een dag van maandag t/m zaterdag.">
        <input id="move-to" name="to" type="date" required className={inputClass} />
      </Field>
      <ShiftFields defaults={defaults} groups={groups} prefix="move" />
      <SubmitButton variant="secondary">Verplaatsen</SubmitButton>
    </StatefulForm>
  );
}
