'use server';

import { redirect } from 'next/navigation';
import { safeNextPath } from '@/lib/auth/redirect';
import { createClient } from '@/lib/db/server';
import { isValidEmail, normalizeEmail } from '@/lib/import/cells';

export interface LoginState {
  step: 'email' | 'code';
  email: string;
  error?: string;
  message?: string;
}

const CODE_SENT =
  'Als dit adres bij ons bekend is, krijg je binnen een minuut een e-mail met een inlogcode. Kijk ook in je map met ongewenste mail.';

async function sendCode(email: string): Promise<LoginState> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
  if (error) {
    if (error.status === 429) {
      return { step: 'email', email, error: 'Te veel pogingen. Wacht even en probeer het dan opnieuw.' };
    }
    // Een onbekend adres geeft ook een fout. We tonen dan dezelfde melding als bij succes,
    // zodat niemand kan uitproberen welke adressen bestaan.
    const unknownAddress = error.status === 400 || error.status === 422 || /signup|not allowed|not found/i.test(error.message);
    if (!unknownAddress) {
      console.error('Inlogcode versturen mislukt', error.status, error.message);
      return { step: 'email', email, error: 'Versturen lukte niet. Probeer het later opnieuw of vraag de beheerder.' };
    }
  }
  return { step: 'code', email, message: CODE_SENT };
}

/** Eén actie voor het hele inlogformulier: code aanvragen, code controleren of opnieuw beginnen. */
export async function loginAction(previous: LoginState, formData: FormData): Promise<LoginState> {
  const intent = formData.get('intent');
  const email = normalizeEmail(String(formData.get('email') ?? previous.email ?? ''));

  if (intent === 'reset') return { step: 'email', email: '' };

  if (!isValidEmail(email)) return { step: 'email', email, error: 'Vul een geldig e-mailadres in.' };

  if (intent === 'request' || intent === 'resend') return sendCode(email);

  const token = String(formData.get('code') ?? '').replace(/\s+/g, '');
  if (!/^\d{6,10}$/.test(token)) {
    return { step: 'code', email, error: 'Vul de code van 6 cijfers uit de e-mail in.' };
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
  if (error) {
    return {
      step: 'code',
      email,
      error: 'Deze code klopt niet of is verlopen. Controleer de code of vraag een nieuwe aan.',
    };
  }
  redirect(safeNextPath(formData.get('volgende')));
}
