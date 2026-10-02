'use client';

import { SubmitButton } from '@/components/client/form-controls';
import { StatefulForm } from '@/components/client/stateful-form';
import { Field, inputClass } from '@/components/ui';
import { deleteEmployeeCompletely } from './actions';

/** Volledig verwijderen (fase 3, V21): eerst zien wat er verdwijnt, dan de naam overtypen. */
export function DeleteEmployeeForm({ id, name, summary }: { id: string; name: string; summary: string[] }) {
  return (
    <div className="space-y-3 rounded-lg border border-rose-200 bg-rose-50/60 p-3">
      <p className="text-sm font-semibold text-rose-800">Volledig verwijderen</p>
      <p className="text-sm text-slate-700">Dit kan niet ongedaan worden gemaakt. Dit verdwijnt:</p>
      <ul className="list-disc pl-5 text-sm text-slate-700">
        <li>de medewerker zelf</li>
        {summary.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <p className="text-xs text-slate-500">
        Het logboek houdt zijn regels; daarin staan alleen id&rsquo;s. Er komt één regel bij: wie de medewerker wanneer
        verwijderde.
      </p>
      <StatefulForm action={deleteEmployeeCompletely} className="space-y-3">
        <input type="hidden" name="id" value={id} />
        <Field label={`Typ ter bevestiging de naam: ${name}`} htmlFor="delete-name">
          <input id="delete-name" name="naam" autoComplete="off" required className={inputClass} />
        </Field>
        <SubmitButton variant="danger" confirm={`${name} definitief verwijderen? Dit kan niet ongedaan worden gemaakt.`}>
          Definitief verwijderen
        </SubmitButton>
      </StatefulForm>
    </div>
  );
}
