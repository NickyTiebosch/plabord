/**
 * Wat het inlogscherm toont nadat Supabase een inlogcode verstuurde, weigerde of afwees (besluit
 * V36). Puur: de fout van Supabase komt binnen als parameter.
 *
 * Supabase weigert een nieuwe code met status 429:
 * - per adres pas na een minuut weer een code ("you can only request this after 42 seconds"). Er is
 *   dan net al een code gestuurd: die kun je gewoon invullen;
 * - voor het hele team een maximum aantal mails per uur, en een maximum aantal aanvragen per
 *   vijf minuten. Alle aanvragen komen van de server van Planbord, dus die tellen samen.
 */

export interface LoginState {
  step: 'email' | 'code';
  email: string;
  error?: string;
  message?: string;
}

/** Een fout van Supabase Auth, zoals `AuthError` die geeft. */
export interface AuthErrorLike {
  status?: number;
  code?: string;
  message: string;
}

export const CODE_SENT =
  'Als dit adres bij ons bekend is, krijg je binnen een minuut een e-mail met een inlogcode. Kijk ook in je map met ongewenste mail.';

const BUSY =
  'Er zijn net te veel inlogcodes aangevraagd. Probeer het over een paar minuten opnieuw. Heb je al een code? Tik dan op Ik heb al een code. Lukt het daarna nog niet, vraag het de beheerder.';

function isRateLimited(error: AuthErrorLike): boolean {
  return error.status === 429 || error.code === 'over_email_send_rate_limit' || error.code === 'over_request_rate_limit';
}

/** Na een code aanvragen. `error` is null als het versturen lukte. */
export function afterCodeRequest(email: string, error: AuthErrorLike | null): LoginState {
  if (!error) return { step: 'code', email, message: CODE_SENT };
  if (isRateLimited(error)) {
    // Nieuwere versies: "after 42 seconds", oudere: "once every 60 seconds".
    const wait = /(?:after|every) (\d+) seconds?/i.exec(error.message);
    if (wait) {
      const seconds = Number(wait[1]);
      return {
        step: 'code',
        email,
        message: `Je hebt net al een code gekregen. Vul de code uit de nieuwste mail in. Geen mail? Over ${seconds} ${seconds === 1 ? 'seconde' : 'seconden'} kun je een nieuwe aanvragen.`,
      };
    }
    return { step: 'email', email, error: BUSY };
  }
  // Een onbekend adres geeft ook een fout. We tonen dan dezelfde melding als bij succes, zodat
  // niemand kan uitproberen welke adressen bestaan.
  if (error.status === 400 || error.status === 422 || /signup|not allowed|not found/i.test(error.message)) {
    return { step: 'code', email, message: CODE_SENT };
  }
  return { step: 'email', email, error: 'Versturen lukte niet. Probeer het later opnieuw of vraag de beheerder.' };
}

/** Na een code die Supabase niet accepteerde. */
export function afterFailedVerify(email: string, error: AuthErrorLike): LoginState {
  if (isRateLimited(error)) {
    return { step: 'code', email, error: 'Er wordt net veel ingelogd. Wacht een minuut en probeer dezelfde code dan opnieuw.' };
  }
  return { step: 'code', email, error: 'Deze code klopt niet of is verlopen. Controleer de code of vraag een nieuwe aan.' };
}

/** "Ik heb al een code": naar de code, zonder een nieuwe aan te vragen. Die zou de vorige ongeldig maken. */
export function haveCode(email: string): LoginState {
  return { step: 'code', email, message: 'Vul de code uit de nieuwste mail in.' };
}
