'use client';

import { useActionState, type ReactNode } from 'react';
import type { ActionState } from '@/lib/admin/forms';
import { Notice } from '../ui';

/** Formulier voor een server action die een melding teruggeeft (opgeslagen of fout). */
export function StatefulForm({
  action,
  children,
  className,
}: {
  action: (previous: ActionState, formData: FormData) => Promise<ActionState>;
  children: ReactNode;
  className?: string;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(action, {});
  const fieldErrors = Object.values(state.fieldErrors ?? {});
  return (
    <form action={formAction} className={className}>
      {state.error ? (
        <Notice tone="error" className="mb-3">
          {state.error}
          {fieldErrors.length > 0 ? (
            <ul className="mt-1 list-disc pl-5">
              {fieldErrors.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          ) : null}
        </Notice>
      ) : null}
      {state.ok && state.message ? (
        <Notice tone="success" className="mb-3">
          {state.message}
        </Notice>
      ) : null}
      {children}
    </form>
  );
}
