'use client';

import { useActionState, useRef, type ReactNode } from 'react';
import type { ActionState } from '@/lib/admin/forms';
import { Notice } from '../ui';
import { submitKeepingValues } from './keep-values';

/**
 * Formulier voor een server action die een melding teruggeeft (opgeslagen of fout).
 * De invoer blijft staan, ook bij een fout. Met resetOnSuccess wordt het formulier na opslaan leeg.
 */
export function StatefulForm({
  action,
  children,
  className,
  resetOnSuccess = false,
}: {
  action: (previous: ActionState, formData: FormData) => Promise<ActionState>;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState<ActionState, FormData>(async (previous, formData) => {
    const result = await action(previous, formData);
    if (result.ok && resetOnSuccess) formRef.current?.reset();
    return result;
  }, {});
  const fieldErrors = Object.values(state.fieldErrors ?? {});
  return (
    <form ref={formRef} action={formAction} onSubmit={submitKeepingValues(formAction)} className={className}>
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
