'use client';

import { startTransition, type FormEvent } from 'react';

/**
 * onSubmit voor een formulier met useActionState.
 *
 * Na een formulieractie zet React alle velden terug, ook als de actie een fout meldt. Dan is de
 * invoer weg. Met deze handler blijft de invoer staan. De verzendknop toont nog steeds "Bezig…",
 * want React volgt de transition die hier start (useFormStatus).
 */
export function submitKeepingValues(formAction: (formData: FormData) => void) {
  return (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const formData = new FormData(event.currentTarget, submitter);
    startTransition(() => formAction(formData));
  };
}
