'use server';

import { redirect } from 'next/navigation';
import { afterCodeRequest, afterFailedVerify, haveCode, type LoginState } from '@/lib/auth/login';
import { safeNextPath } from '@/lib/auth/redirect';
import { createClient } from '@/lib/db/server';
import { isValidEmail, normalizeEmail } from '@/lib/import/cells';

async function sendCode(email: string): Promise<LoginState> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
  const state = afterCodeRequest(email, error);
  // Zonder e-mailadres in het log: alleen wat Supabase zei, zodat de beheerder ziet welke grens het was.
  if (error && (error.status === 429 || state.step === 'email')) {
    console.error('Inlogcode versturen mislukt', error.status, error.code, error.message);
  }
  return state;
}

/**
 * Eén actie voor het hele inlogformulier: code aanvragen, zeggen dat je al een code hebt, de code
 * controleren of opnieuw beginnen. Wat het scherm daarna toont, staat in src/lib/auth/login.ts.
 */
export async function loginAction(previous: LoginState, formData: FormData): Promise<LoginState> {
  const intent = formData.get('intent');
  const email = normalizeEmail(String(formData.get('email') ?? previous.email ?? ''));

  if (intent === 'reset') return { step: 'email', email: '' };

  if (!isValidEmail(email)) return { step: 'email', email, error: 'Vul een geldig e-mailadres in.' };

  if (intent === 'have-code') return haveCode(email);
  if (intent !== 'verify') return sendCode(email);

  const token = String(formData.get('code') ?? '').replace(/\s+/g, '');
  if (!/^\d{6,10}$/.test(token)) {
    return { step: 'code', email, error: 'Vul de code van 6 cijfers uit de e-mail in.' };
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
  if (error) {
    if (error.status === 429) console.error('Inlogcode controleren geweigerd', error.status, error.code, error.message);
    return afterFailedVerify(email, error);
  }
  redirect(safeNextPath(formData.get('volgende')));
}
