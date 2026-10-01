'use client';

import { useActionState } from 'react';
import { SubmitButton } from '@/components/client/form-controls';
import { Field, Notice, inputClass } from '@/components/ui';
import { loginAction, type LoginState } from './actions';

const initialState: LoginState = { step: 'email', email: '' };

export function LoginForm({ next }: { next: string }) {
  const [state, formAction] = useActionState(loginAction, initialState);

  if (state.step === 'email') {
    return (
      <form action={formAction} className="space-y-4" noValidate>
        <input type="hidden" name="intent" value="request" />
        <input type="hidden" name="volgende" value={next} />
        <Field label="Je werkmail" htmlFor="email" error={state.error}>
          <input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            required
            defaultValue={state.email}
            className={inputClass}
            placeholder="naam@bedrijf.nl"
          />
        </Field>
        <SubmitButton className="w-full">Stuur mij een inlogcode</SubmitButton>
        <p className="text-sm text-slate-600">
          Je krijgt een code van 6 cijfers per e-mail. Nog geen account? Vraag het de beheerder.
        </p>
      </form>
    );
  }

  return (
    <div className="space-y-4">
      {state.message ? <Notice tone="info">{state.message}</Notice> : null}
      <form action={formAction} className="space-y-4" noValidate>
        <input type="hidden" name="intent" value="verify" />
        <input type="hidden" name="email" value={state.email} />
        <input type="hidden" name="volgende" value={next} />
        <Field
          label="Inlogcode"
          htmlFor="code"
          error={state.error}
          hint={
            <>
              Gestuurd naar <strong>{state.email}</strong>.
            </>
          }
        >
          <input
            id="code"
            name="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={10}
            required
            autoFocus
            className={`${inputClass} text-center font-mono text-2xl tracking-[0.4em]`}
            placeholder="••••••"
          />
        </Field>
        <SubmitButton className="w-full">Inloggen</SubmitButton>
      </form>
      <div className="flex flex-wrap gap-2">
        <form action={formAction}>
          <input type="hidden" name="intent" value="resend" />
          <input type="hidden" name="email" value={state.email} />
          <SubmitButton variant="ghost" size="sm">
            Nieuwe code sturen
          </SubmitButton>
        </form>
        <form action={formAction}>
          <input type="hidden" name="intent" value="reset" />
          <SubmitButton variant="ghost" size="sm">
            Ander e-mailadres
          </SubmitButton>
        </form>
      </div>
    </div>
  );
}
